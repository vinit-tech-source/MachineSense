/**
 * YieldWatt machine intelligence — ONE class for every machine.
 *
 * v2 (Claude) + policy fixes (Grok):
 *  1. Gated learning   — flagged samples never enter the baseline (quarantined).
 *                        Baseline is median/MAD, not mean/std.
 *  2. Drift vs fault   — Page-Hinkley on deviation from a frozen anchor.
 *                        Drift => propose re-baseline. Fault => alert.
 *  3. Calibrated alarm — per-machine forest + z thresholds; k-of-m persistence.
 *  4. Honest SEC       — windowed SEC; personal best from this machine's own
 *                        clean shifts (not profile.bestSec).
 *  5. States           — OFF / IDLE / RUN (PRODUCING+HIGH_LOAD share a baseline)
 *                        / OVERLOAD. Idle judged by episode length.
 *  6. Energy residual  — per-machine OLS: kW ~ a + b · goodUnits, frozen at
 *                        the last confirmed baseline. Waste ₹ / CO₂ derived.
 *  7. Hybrid attrib.   — forest OR robust-z OR energy residual. On alert only,
 *                        occlude one forest feature to train-mean.
 *  Forest skips currentA (derived from kW and PF). Dropped sensors are imputed
 *  with the train mean so the vector dimension never changes after fit.
 */

import {
  anomalyScore,
  fitIsolationForest,
  occlusionDrops,
  ML_THRESHOLD,
  type FittedForest,
} from "./isolation-forest";
import {
  FEATURE_LABEL,
  FEATURE_ORDER,
  FOREST_SKIP,
  PLANT_UTC_OFFSET_MIN,
  type FeatureName,
  type Inference,
  type LearningPhase,
  type MachineProfile,
  type OperatingState,
  type Recommendation,
  type Sample,
  type ShiftClass,
  type TrainedModelCard,
} from "./types";
import { mulberry32 } from "./rng";

const MIN_BOOTSTRAP = 200;
const REF_EVERY = 150;
const ACCEPT_WINDOW = 3000;
const CALIBRATE_MIN = 600;
const Z_DEFAULT = 4.0;
const Z_FLOOR = 3.5;
const PERSIST_K = 6;
const PERSIST_M = 10;
const RECENT_N = 200;
const SHIFT_EVERY = 25;
const PH_DELTA = 0.3;
const PH_LAMBDA = 50;
const SEC_WINDOW = 480;
const SHIFT_MS = 8 * 3600_000;
const REFIT_EVERY = 2500;
const IDLE_FLOOR_MS = 45 * 60_000;
const OVERLOAD_CONSEC = 3;
const ENERGY_Z = 4.0;

type Group = "OFF" | "IDLE" | "RUN" | "OVERLOAD";
const groupOf = (s: OperatingState): Group =>
  s === "PRODUCING" || s === "HIGH_LOAD" ? "RUN" : s;

interface Ref {
  med: number[];
  scale: number[];
  n: number;
}

interface EnergyModel {
  a: number;
  b: number;
  sigma: number;
  n: number;
}

function quantile(a: number[], q: number) {
  if (!a.length) return NaN;
  const s = a.slice().sort((x, y) => x - y);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return s[lo]! + (s[hi]! - s[lo]!) * (i - lo);
}

function buildRef(rows: number[][], mask: boolean[]): Ref {
  const d = FEATURE_ORDER.length;
  const med = new Array<number>(d).fill(0);
  const scale = new Array<number>(d).fill(1);
  for (let j = 0; j < d; j++) {
    if (!mask[j]) continue;
    const col = rows.map((r) => r[j]!);
    const m = quantile(col, 0.5);
    const mad = quantile(
      col.map((v) => Math.abs(v - m)),
      0.5,
    );
    let sigma = 1.4826 * mad;
    const iqr = quantile(col, 0.75) - quantile(col, 0.25);
    sigma = Math.max(sigma, iqr / 1.349 / 2, Math.abs(m) * 1e-3, 1e-6);
    med[j] = m;
    scale[j] = sigma;
  }
  return { med, scale, n: rows.length };
}

function zVec(x: number[], ref: Ref, mask: boolean[]) {
  return x.map((v, j) => (mask[j] ? (v - ref.med[j]!) / ref.scale[j]! : 0));
}

function fitEnergy(pairs: { kw: number; good: number }[]): EnergyModel {
  const n = pairs.length;
  if (n < 40) return { a: 0, b: 0, sigma: 1, n };
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const p of pairs) {
    sx += p.good;
    sy += p.kw;
    sxx += p.good * p.good;
    sxy += p.good * p.kw;
  }
  const den = n * sxx - sx * sx;
  let b = 0;
  let a = sy / n;
  if (den > n * 1e-6) {
    b = (n * sxy - sx * sy) / den;
    a = (sy - b * sx) / n;
  }
  const resid = pairs.map((p) => p.kw - (a + b * p.good));
  const med = quantile(resid, 0.5);
  const mad = quantile(
    resid.map((r) => Math.abs(r - med)),
    0.5,
  );
  return { a, b, sigma: Math.max(1.4826 * mad, 0.05), n };
}

class Ring<T> {
  buf: T[] = [];
  constructor(private cap: number) {}
  push(v: T) {
    this.buf.push(v);
    if (this.buf.length > this.cap) this.buf.shift();
  }
  get length() {
    return this.buf.length;
  }
}

export function detectState(
  kw: number,
  profile: MachineProfile,
  prev: OperatingState,
  producing?: boolean,
): OperatingState {
  if (kw < 0.25) return "OFF";
  if (kw >= profile.overloadKw) return "OVERLOAD";
  if (producing != null && profile.hasProductionCounter !== false) {
    if (!producing) return "IDLE";
    return kw >= profile.highLoadKw ? "HIGH_LOAD" : "PRODUCING";
  }
  const idle = profile.idleKw;
  const slack = prev === "IDLE" ? idle * 0.15 : 0;
  if (kw < idle + 0.8 + slack) return "IDLE";
  if (kw >= profile.highLoadKw) return "HIGH_LOAD";
  if (kw >= profile.producingKw * 0.55) return "PRODUCING";
  return prev === "OFF" ? "IDLE" : prev;
}

export function featureVector(
  sample: Sample,
  profile: MachineProfile,
): { values: number[]; mask: boolean[] } {
  const rejectPct =
    sample.goodUnits + sample.rejects > 0
      ? (100 * sample.rejects) / (sample.goodUnits + sample.rejects)
      : 0;
  const raw: Record<FeatureName, number> = {
    kw: sample.kw,
    pf: sample.pf,
    tempC: sample.tempC,
    vibRms: sample.vibRms,
    currentA: sample.currentA,
    rejectPct,
  };
  return {
    values: FEATURE_ORDER.map((f) => raw[f]),
    mask: FEATURE_ORDER.map((f) => profile.sensors.includes(f)),
  };
}

export class MachineIntelligence {
  profile: MachineProfile;
  phase: LearningPhase = "commissioning";
  forest: FittedForest | null = null;
  mlThreshold = ML_THRESHOLD;
  zCrit = Z_DEFAULT;
  private zCritVec: number[] = new Array(FEATURE_ORDER.length).fill(Z_DEFAULT);
  rng: () => number;

  producingCount = 0;
  kwhProducing = 0;
  goodProducing = 0;
  kwhIdle = 0;
  quarantined = 0;
  rollingSec: number | null = null;
  personalBest = 0;
  lastState: OperatingState = "OFF";

  private mask: boolean[];
  private forestIdx: number[];
  private accepted = new Ring<number[]>(ACCEPT_WINDOW);
  private acceptedE = new Ring<{ kw: number; good: number }>(ACCEPT_WINDOW);
  private recent = new Ring<number[]>(RECENT_N);
  private recentE = new Ring<{ kw: number; good: number }>(RECENT_N);
  private adaptive: Ref | null = null;
  private anchor: Ref | null = null;
  private energy: EnergyModel | null = null;
  private energyAnchor: EnergyModel | null = null;
  private anchorD0 = 1;
  private sinceRef = 0;
  private sinceFit = 0;
  private calibrated = false;

  private flags: boolean[] = [];
  private ph = { sum: 0, min: 0 };
  private phAlarm = false;
  private shiftState: ShiftClass = "none";
  private shiftVec: number[] = new Array(FEATURE_ORDER.length).fill(0);
  private sinceShift = 0;

  private secBuf: { kwh: number; good: number }[] = [];
  private secKwh = 0;
  private secGood = 0;
  private curShift = { key: -1, kwh: 0, good: 0, n: 0, flagged: 0 };
  private shiftSecs: number[] = [];
  private anchorSec: number | null = null;
  secUpPct = 0;

  private idleStart: number | null = null;
  private idleLast = 0;
  private idleEpisodes: number[] = [];
  private overloadRun = 0;

  constructor(profile: MachineProfile) {
    this.profile = profile;
    this.mask = FEATURE_ORDER.map((f) => profile.sensors.includes(f));
    this.forestIdx = FEATURE_ORDER.map((_, i) => i).filter(
      (i) => this.mask[i] && !FOREST_SKIP.has(FEATURE_ORDER[i]!),
    );
    this.rng = mulberry32(
      [...profile.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7),
    );
  }

  private compact(values: number[]): number[] {
    return this.forestIdx.map((i, k) => {
      const v = values[i]!;
      if (Number.isFinite(v)) return v;
      return this.forest?.mean[k] ?? this.adaptive?.med[i] ?? 0;
    });
  }

  private refreshPhase() {
    if (this.shiftState === "drift") this.phase = "drifting";
    else if (this.forest) this.phase = "ml_ready";
    else if (this.anchor && this.accepted.length >= 400) this.phase = "statistical";
    else this.phase = "commissioning";
  }

  /**
   * Feed one sample into the machine's own history. Returns the operating state.
   * `keepTrainBuffer` is accepted for backwards compatibility; the engine always
   * keeps its own gated window.
   */
  observe(sample: Sample, _opts?: { keepTrainBuffer?: boolean }): OperatingState {
    const producing = sample.goodUnits + sample.rejects > 0;
    const state = detectState(sample.kw, this.profile, this.lastState, producing);
    this.lastState = state;
    const g = groupOf(state);
    const { values } = featureVector(sample, this.profile);

    this.trackIdle(sample, state);
    this.overloadRun = state === "OVERLOAD" ? this.overloadRun + 1 : 0;

    if (g === "IDLE") this.kwhIdle += sample.kwhDelta;
    if (g !== "RUN") {
      this.refreshPhase();
      return state;
    }

    this.producingCount += 1;
    this.kwhProducing += sample.kwhDelta;
    this.goodProducing += sample.goodUnits;
    this.updateSec(sample);

    const energyPt = { kw: sample.kw, good: sample.goodUnits };
    const verdict = this.judge(values, energyPt);
    this.flags.push(verdict.hit);
    if (verdict.hit) this.curShift.flagged += 1;
    if (this.flags.length > PERSIST_M) this.flags.shift();
    this.recent.push(values);
    this.recentE.push(energyPt);

    const bootstrapping = this.accepted.length < MIN_BOOTSTRAP;
    if (bootstrapping || !verdict.hit) {
      this.accepted.push(values);
      this.acceptedE.push(energyPt);
      this.sinceRef += 1;
      this.sinceFit += 1;
    } else {
      this.quarantined += 1;
    }

    if (this.accepted.length >= MIN_BOOTSTRAP) {
      if (!this.anchor) this.refreshRef(true);
      else if (this.sinceRef >= REF_EVERY) this.refreshRef(false);
    }

    this.updateDrift(values, energyPt);
    this.maybeRefit();
    this.refreshPhase();
    return state;
  }

  private refreshRef(first: boolean) {
    const rows = this.accepted.buf;
    this.adaptive = buildRef(rows, this.mask);
    this.energy = fitEnergy(this.acceptedE.buf);
    this.sinceRef = 0;
    if (!this.anchor && first) this.setAnchor(this.adaptive, rows);
    if (!this.calibrated && rows.length >= CALIBRATE_MIN) this.calibrateZ(rows);
  }

  private setAnchor(ref: Ref, rows: number[][]) {
    this.anchor = ref;
    this.energyAnchor = this.energy ? { ...this.energy } : fitEnergy(this.acceptedE.buf);
    this.anchorSec = null;
    this.secUpPct = 0;
    const ds = rows.map((r) => this.devMagnitude(r, ref));
    this.anchorD0 = ds.reduce((a, b) => a + b, 0) / Math.max(1, ds.length);
    this.ph = { sum: 0, min: 0 };
    this.phAlarm = false;
    this.shiftState = "none";
    this.shiftVec.fill(0);
  }

  private calibrateZ(rows: number[][]) {
    if (!this.adaptive) return;
    const zs = rows.map((r) => zVec(r, this.adaptive!, this.mask));
    this.zCritVec = FEATURE_ORDER.map((_, j) =>
      this.mask[j]
        ? Math.max(Z_FLOOR, 1.15 * quantile(zs.map((z) => Math.abs(z[j]!)), 0.999))
        : Z_DEFAULT,
    );
    const present = this.zCritVec.filter((_, j) => this.mask[j]);
    this.zCrit = quantile(present, 0.5);
    this.calibrated = true;
  }

  private devMagnitude(x: number[], ref: Ref) {
    const z = zVec(x, ref, this.mask);
    let s = 0;
    let n = 0;
    for (let i = 0; i < z.length; i++) {
      if (!this.mask[i]) continue;
      if (FEATURE_ORDER[i] === "currentA") continue;
      s += z[i]! * z[i]!;
      n += 1;
    }
    return Math.sqrt(s / Math.max(1, n));
  }

  private residual(pt: { kw: number; good: number }, model: EnergyModel | null) {
    if (!model || model.n < 40) return 0;
    return pt.kw - (model.a + model.b * pt.good);
  }

  private judge(values: number[], pt: { kw: number; good: number }) {
    if (!this.adaptive) {
      return {
        statHit: false,
        mlHit: false,
        energyHit: false,
        hit: false,
        score: null as number | null,
        z: values.map(() => 0),
        residualKw: 0,
      };
    }
    const z = zVec(values, this.adaptive, this.mask);
    const statHit = z.some(
      (v, i) => this.mask[i] && FEATURE_ORDER[i] !== "currentA" && Math.abs(v) >= this.zCritVec[i]!,
    );
    let score: number | null = null;
    let mlHit = false;
    if (this.forest) {
      score = anomalyScore(this.forest, this.compact(values));
      mlHit = score >= this.mlThreshold;
    }
    const resid = this.residual(pt, this.energy);
    const energyHit =
      !!this.energy && this.energy.n >= 40 && Math.abs(resid) >= ENERGY_Z * this.energy.sigma;
    return { statHit, mlHit, energyHit, hit: statHit || mlHit || energyHit, score, z, residualKw: resid };
  }

  private updateDrift(values: number[], pt: { kw: number; good: number }) {
    if (!this.anchor) return;
    if (this.anchorSec == null && this.secBuf.length >= SEC_WINDOW && this.flags.every((f) => !f)) {
      this.anchorSec = this.rollingSec;
    }
    this.secUpPct =
      this.anchorSec && this.rollingSec != null && this.secBuf.length >= SEC_WINDOW / 2
        ? (this.rollingSec / this.anchorSec - 1) * 100
        : 0;

    const d = this.devMagnitude(values, this.anchor);
    this.ph.sum += d - this.anchorD0 - PH_DELTA;
    if (this.ph.sum < this.ph.min) this.ph.min = this.ph.sum;
    this.phAlarm = this.ph.sum - this.ph.min > PH_LAMBDA;

    this.sinceShift += 1;
    if (this.sinceShift < SHIFT_EVERY || this.recent.length < RECENT_N) return;
    this.sinceShift = 0;
    const secLimit = this.secLimitPct();
    const secFault = this.secUpPct >= secLimit;

    let energyFault = false;
    if (this.energyAnchor && this.recentE.length >= 60) {
      const rs = this.recentE.buf.slice(-60).map((p) => this.residual(p, this.energyAnchor));
      const medR = quantile(rs, 0.5);
      energyFault = medR >= 3 * this.energyAnchor.sigma;
    }

    const rows = this.recent.buf;
    const S = FEATURE_ORDER.map((_, j) => {
      if (!this.mask[j] || FEATURE_ORDER[j] === "currentA") return 0;
      const m = quantile(rows.map((r) => r[j]!), 0.5);
      return (m - this.anchor!.med[j]!) / this.anchor!.scale[j]!;
    });
    this.shiftVec = S;
    if (secFault || energyFault) {
      this.shiftState = "fault";
      return;
    }
    if (!this.phAlarm) {
      this.shiftState = "none";
      return;
    }
    const at = (f: FeatureName) => S[FEATURE_ORDER.indexOf(f)]!;
    const maxAbs = Math.max(...S.map(Math.abs));
    const mechanical = at("vibRms") >= 2.5 && at("tempC") >= 2 && at("kw") >= 1.5;
    const fault =
      at("vibRms") >= 3 ||
      at("pf") <= -3 ||
      at("rejectPct") >= 2.5 ||
      Math.abs(at("kw")) >= 3 ||
      mechanical ||
      maxAbs >= 4;
    this.shiftState = fault ? "fault" : maxAbs >= 1 ? "drift" : "none";
  }

  private secLimitPct() {
    if (this.shiftSecs.length < 4) return 8;
    const m = quantile(this.shiftSecs, 0.5);
    const mad = quantile(this.shiftSecs.map((v) => Math.abs(v - m)), 0.5);
    return Math.max(8, (100 * 5 * 1.4826 * mad) / m);
  }

  confirmRebaseline() {
    const rows = this.recent.buf.slice();
    if (rows.length < MIN_BOOTSTRAP) return false;
    this.accepted = new Ring<number[]>(ACCEPT_WINDOW);
    this.acceptedE = new Ring<{ kw: number; good: number }>(ACCEPT_WINDOW);
    rows.forEach((r) => this.accepted.push(r));
    this.recentE.buf.forEach((p) => this.acceptedE.push(p));
    this.adaptive = buildRef(rows, this.mask);
    this.energy = fitEnergy(this.acceptedE.buf);
    this.calibrated = false;
    this.calibrateZ(rows);
    this.setAnchor(this.adaptive, rows);
    this.flags = [];
    this.sinceFit = 0;
    if (this.forest) this.refit();
    this.refreshPhase();
    return true;
  }

  fitForest(rng?: () => number) {
    if (rng) this.rng = rng;
    if (this.accepted.length < 200) return;
    this.refit();
    this.refreshPhase();
  }

  private maybeRefit() {
    if (!this.forest || this.sinceFit < REFIT_EVERY) return;
    if (this.shiftState !== "none" || this.flags.some(Boolean)) return;
    this.refit();
  }

  private refit() {
    const rows = this.accepted.buf.map((r) => this.compact(r));
    const idx = rows.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [idx[i], idx[j]] = [idx[j]!, idx[i]!];
    }
    const nCal = Math.max(50, Math.floor(rows.length * 0.2));
    const cal = idx.slice(0, nCal).map((i) => rows[i]!);
    const train = idx.slice(nCal).map((i) => rows[i]!);
    this.forest = fitIsolationForest(train, this.rng, 80, 256);
    const scores = cal.map((r) => anomalyScore(this.forest!, r));
    this.mlThreshold = Math.max(ML_THRESHOLD - 0.05, quantile(scores, 0.995) + 0.01);
    this.sinceFit = 0;
  }

  private trackIdle(sample: Sample, state: OperatingState) {
    if (state === "IDLE") {
      if (this.idleStart == null || sample.t - this.idleLast > 20 * 60_000) {
        this.closeIdle();
        this.idleStart = sample.t;
      }
      this.idleLast = sample.t;
    } else {
      this.closeIdle();
    }
  }
  private closeIdle() {
    if (this.idleStart != null) {
      const dur = this.idleLast - this.idleStart;
      if (dur > 0) {
        this.idleEpisodes.push(dur);
        if (this.idleEpisodes.length > 60) this.idleEpisodes.shift();
      }
    }
    this.idleStart = null;
  }
  private idleLimitMs() {
    if (this.idleEpisodes.length < 2) return IDLE_FLOOR_MS;
    return Math.max(IDLE_FLOOR_MS, 1.5 * quantile(this.idleEpisodes, 0.95));
  }
  private idleDurationMs() {
    return this.idleStart != null ? this.idleLast - this.idleStart : 0;
  }

  private updateSec(sample: Sample) {
    this.secBuf.push({ kwh: sample.kwhDelta, good: sample.goodUnits });
    this.secKwh += sample.kwhDelta;
    this.secGood += sample.goodUnits;
    if (this.secBuf.length > SEC_WINDOW) {
      const o = this.secBuf.shift()!;
      this.secKwh -= o.kwh;
      this.secGood -= o.good;
    }
    if (this.secBuf.length >= 60 && this.secGood > 0) this.rollingSec = this.secKwh / this.secGood;

    const key = Math.floor((sample.t + PLANT_UTC_OFFSET_MIN * 60_000) / SHIFT_MS);
    if (key !== this.curShift.key) {
      const shiftSec = this.curShift.good > 0 ? this.curShift.kwh / this.curShift.good : NaN;
      const clean =
        this.curShift.n >= 30 &&
        this.curShift.flagged / this.curShift.n < 0.1 &&
        (this.anchorSec == null || shiftSec <= this.anchorSec * 1.08);
      if (clean && Number.isFinite(shiftSec)) {
        this.shiftSecs.push(shiftSec);
        if (this.shiftSecs.length > 60) this.shiftSecs.shift();
      }
      this.curShift = { key, kwh: 0, good: 0, n: 0, flagged: 0 };
    }
    this.curShift.kwh += sample.kwhDelta;
    this.curShift.good += sample.goodUnits;
    this.curShift.n += 1;
    this.personalBest =
      this.shiftSecs.length >= 3
        ? quantile(this.shiftSecs, 0.1)
        : (this.rollingSec ?? 0);
  }

  get secIncludingIdle() {
    return this.goodProducing > 0 ? (this.kwhProducing + this.kwhIdle) / this.goodProducing : null;
  }
  get idleSharePct() {
    const tot = this.kwhProducing + this.kwhIdle;
    return tot > 0 ? (100 * this.kwhIdle) / tot : 0;
  }

  private impactPct(): number | null {
    if (!this.anchor || this.recent.length < 60) return null;
    const rows = this.recent.buf.slice(-60);
    const jk = FEATURE_ORDER.indexOf("kw");
    const jr = FEATURE_ORDER.indexOf("rejectPct");
    const kwNow = quantile(rows.map((r) => r[jk]!), 0.5);
    const kwRef = this.anchor.med[jk]!;
    let ratio = kwNow > 0 ? kwNow / kwRef : 1;
    if (this.mask[jr]) {
      const rejNow = quantile(rows.map((r) => r[jr]!), 0.5);
      const rejRef = this.anchor.med[jr]!;
      ratio *= (100 - rejRef) / Math.max(1, 100 - rejNow);
    }
    const channel = Math.max(0, (1 - 1 / ratio) * 100);
    const viaSec = this.secUpPct > 0 ? (1 - 1 / (1 + this.secUpPct / 100)) * 100 : 0;
    let viaEnergy = 0;
    if (this.energyAnchor && this.recentE.length >= 60) {
      const medR = quantile(
        this.recentE.buf.slice(-60).map((p) => this.residual(p, this.energyAnchor)),
        0.5,
      );
      viaEnergy = kwNow > 0 ? Math.max(0, (100 * medR) / kwNow) : 0;
    }
    return Math.max(channel, viaSec, viaEnergy);
  }

  private confidence(hit: boolean, agree: boolean) {
    const volume = this.accepted.length / (this.accepted.length + 500);
    const persist = this.flags.length ? this.flags.filter(Boolean).length / this.flags.length : 0;
    const base = 0.35 + 0.65 * volume * (hit ? Math.max(persist, 0.4) : 1);
    return Math.min(0.95, Math.max(0.3, base * (agree ? 1 : 0.85)));
  }

  /** Forest-only verdict, no state gating. Used for the "generic model fails" demo (foreign machine's forest on this machine's data). */
  rawForestHit(sample: Sample): boolean {
    if (!this.forest) return false;
    const { values } = featureVector(sample, this.profile);
    return anomalyScore(this.forest, this.compact(values)) >= this.mlThreshold;
  }

  infer(sample: Sample): Inference {
    const producing = sample.goodUnits + sample.rejects > 0;
    const state = detectState(sample.kw, this.profile, this.lastState, producing);
    const g = groupOf(state);
    const { values, mask } = featureVector(sample, this.profile);
    const zeros = values.map(() => 0);
    const pt = { kw: sample.kw, good: sample.goodUnits };

    let statHit = false;
    let mlHit = false;
    let energyHit = false;
    let score: number | null = null;
    let z = zeros;
    let residualKw = 0;
    if (g === "RUN" && this.adaptive) {
      const v = this.judge(values, pt);
      statHit = v.statHit;
      mlHit = v.mlHit;
      energyHit = v.energyHit;
      score = v.score;
      z = v.z;
      residualKw = v.residualKw;
    } else if (g === "RUN") {
      residualKw = this.residual(pt, this.energyAnchor ?? this.energy);
    }
    const hit = statHit || mlHit || energyHit;

    const flagged = this.flags.filter(Boolean).length;
    const persistent = g === "RUN" && flagged >= PERSIST_K && this.flags.length >= PERSIST_M;
    const shiftFault = g === "RUN" && this.shiftState === "fault";
    const idleLong = state === "IDLE" && this.idleDurationMs() > this.idleLimitMs();
    const overload = state === "OVERLOAD" && this.overloadRun >= OVERLOAD_CONSEC;
    const alerting = persistent || shiftFault || idleLong || overload;

    const diag = shiftFault || this.shiftState === "drift" ? this.shiftVec : z;

    // Alert-time forest occlusion; never on the 1.6s hot path unless we already alert.
    if (alerting && mlHit && this.forest) {
      const drops = occlusionDrops(this.forest, this.compact(values));
      for (let k = 0; k < this.forestIdx.length; k++) {
        const i = this.forestIdx[k]!;
        if (drops[k]! > 0.02) diag[i] = Math.sign(diag[i] || 1) * Math.max(Math.abs(diag[i]!), 2 + 8 * drops[k]!);
      }
    }

    const freezeResid = this.residual(pt, this.energyAnchor ?? this.energy);
    const wasteKw = Math.max(0, freezeResid);
    const wasteInrPerHour = this.energyAnchor || this.energy ? wasteKw * this.profile.rupeePerKwh : null;
    const wasteKgCo2PerHour = this.energyAnchor || this.energy ? wasteKw * this.profile.kgCo2PerKwh : null;

    const secInstant = sample.goodUnits > 0 ? sample.kwhDelta / sample.goodUnits : null;
    const vsBest =
      this.rollingSec != null && this.personalBest > 0
        ? ((this.rollingSec - this.personalBest) / this.personalBest) * 100
        : null;
    const contributions = FEATURE_ORDER.map((feature, i) => ({
      feature,
      z: mask[i] ? diag[i]! : 0,
    })).sort((a, b) => Math.abs(b.z) - Math.abs(a.z));

    const detectors = [statHit, mlHit, energyHit].filter(Boolean).length;
    const agree = !this.forest ? true : detectors >= 2 || detectors === 0;

    return {
      state,
      features: values,
      presentMask: mask,
      zScores: z,
      anomalyScore: score,
      statisticalHit: statHit,
      mlHit,
      secInstant,
      secRolling: this.rollingSec,
      vsBestPct: vsBest,
      contributions,
      hit,
      alerting,
      shift: g === "RUN" ? this.shiftState : "none",
      impactPct: alerting || this.shiftState !== "none" ? this.impactPct() : null,
      confidence: this.confidence(hit || shiftFault, agree),
      residualKw: g === "RUN" ? freezeResid : null,
      wasteInrPerHour: g === "RUN" ? wasteInrPerHour : null,
      wasteKgCo2PerHour: g === "RUN" ? wasteKgCo2PerHour : null,
    };
  }

  recommend(sample: Sample, inf: Inference): Recommendation[] {
    const recs: Recommendation[] = [];
    const zOf = (f: FeatureName) => inf.contributions.find((c) => c.feature === f)?.z ?? 0;
    const zKw = zOf("kw");
    const zPf = zOf("pf");
    const zTemp = zOf("tempC");
    const zVib = zOf("vibRms");
    const zRej = zOf("rejectPct");
    const impact = inf.impactPct ?? 0;
    const conf = inf.confidence;
    const active = inf.alerting && inf.state !== "IDLE" && inf.state !== "OVERLOAD";
    const waste =
      inf.wasteInrPerHour != null && inf.wasteInrPerHour > 2
        ? ` About ₹${inf.wasteInrPerHour.toFixed(0)}/h and ${(inf.wasteKgCo2PerHour ?? 0).toFixed(1)} kg CO₂/h versus this machine's own energy baseline.`
        : "";

    if (inf.state === "OVERLOAD" && inf.alerting) {
      recs.push({
        category: "maintenance",
        title: "Sustained overload",
        why: `Machine has drawn ${sample.kw.toFixed(1)} kW (limit ${this.profile.overloadKw} kW) for ${this.overloadRun} consecutive samples.`,
        action: "Reduce load or feed rate now and inspect for jams, wrong recipe or a failing drive. Repeated overload shortens motor life.",
        severity: "high",
        expectedSecDropPct: 0,
        confidence: conf,
      });
    }

    if (inf.state === "IDLE" && inf.alerting) {
      const mins = Math.round(this.idleDurationMs() / 60_000);
      const normal = Math.round(this.idleLimitMs() / 60_000);
      recs.push({
        category: "energy",
        title: "Idle running is burning kWh with no output",
        why: `Idle for ${mins} min at ${sample.kw.toFixed(1)} kW; this machine's normal idle spell is under ${normal} min. Idle is ${this.idleSharePct.toFixed(0)}% of its energy so far.`,
        action: "Shut down or auto-sleep after the idle timeout. Check why the cycle is not starting.",
        severity: mins > 2 * normal ? "high" : "medium",
        expectedSecDropPct: Math.round(this.idleSharePct * 10) / 10,
        confidence: conf,
      });
    }

    if (active) {
      const mech = zVib > 2.2 && zTemp > 1.6;
      if (mech) {
        recs.push({
          category: "maintenance",
          title: "Mechanical degradation (bearing / alignment / tool wear)",
          why:
            "Power, vibration and temperature moved together away from this machine's own normal, the signature of mechanical friction rather than a process setpoint." +
            waste,
          action: "Inspect bearings, coupling alignment and tool condition at the next planned stop. Do not wait for a trip.",
          severity: "high",
          expectedSecDropPct: impact,
          confidence: conf,
        });
      } else if (zVib > 3) {
        recs.push({
          category: "maintenance",
          title: "Vibration well above this machine's normal — early bearing / alignment wear",
          why: `Vibration is ${zVib.toFixed(1)} sigma above this machine's own baseline while temperature has not yet followed. This is the earliest stage of mechanical degradation.`,
          action: "Schedule a bearing, coupling and lubrication check at the next planned stop, before temperature and power start to climb.",
          severity: "medium",
          expectedSecDropPct: impact,
          confidence: conf,
        });
      } else if (zPf < -2 && Math.abs(zVib) < 1.4) {
        recs.push({
          category: "energy",
          title: "Electrical inefficiency — power factor collapsed",
          why:
            "Power factor fell while vibration is normal, so energy is being lost electrically (capacitor bank, motor load mismatch, filter)." +
            waste,
          action: "Check capacitor bank, inlet filter / cooling, and whether the motor is oversized for the current recipe.",
          severity: "medium",
          expectedSecDropPct: impact,
          confidence: conf,
        });
      } else if (zRej > 2.2 && Math.abs(zKw) < 1.6) {
        recs.push({
          category: "process",
          title: "Quality loss is inflating SEC",
          why:
            "Energy per cycle is normal but the good-unit share is down. SEC = kWh / good units, so rejects silently destroy efficiency." +
            waste,
          action: "Hold the current recipe; check material feed, mould temperature and last tool change. Do not raise speed to catch up.",
          severity: "high",
          expectedSecDropPct: impact,
          confidence: conf,
        });
      } else if (this.secUpPct >= this.secLimitPct() && Math.abs(zKw) < 2) {
        recs.push({
          category: "process",
          title: "Yield loss is inflating SEC",
          why: `Rolling SEC is ${this.secUpPct.toFixed(0)}% above this machine's own normal while power per cycle is unchanged, so fewer good units are coming out for the same energy.`,
          action: "Check material, tooling and last changeover; inspect rejected parts. No reject sensor is needed to see this: it comes from the good-unit counter.",
          severity: "high",
          expectedSecDropPct: impact,
          confidence: conf,
        });
      } else if (zKw > 2.4) {
        recs.push({
          category: "energy",
          title: "Producing at an unusually high specific load",
          why: `Power is ${zKw.toFixed(1)} sigma above this machine's own run baseline.` + waste,
          action: "Compare recipe, speed and cooling against the shift that set the personal-best SEC.",
          severity: "medium",
          expectedSecDropPct: impact,
          confidence: conf,
        });
      } else if (inf.hit || this.flags.filter(Boolean).length >= 3) {
        const top = inf.contributions[0];
        recs.push({
          category: "process",
          title: "Sustained deviation from this machine's normal",
          why: `${top ? FEATURE_LABEL[top.feature] : "A channel"} is ${top ? Math.abs(top.z).toFixed(1) : "?"} sigma away from the machine's own baseline and has persisted.`,
          action: "Compare the current recipe, material and ambient conditions with a recent good shift.",
          severity: "medium",
          expectedSecDropPct: impact,
          confidence: conf,
        });
      }
    }

    if (inf.shift === "drift") {
      recs.push({
        category: "process",
        title: "Baseline is moving — confirm if this is the new normal",
        why: "A small, gradual, multi-channel shift (under 3 sigma in every channel, no mechanical signature) has persisted. This looks like wear or season, not a fault.",
        action: "If nothing changed on purpose, keep watching. If it is expected (new recipe, season, tool), confirm re-baseline so the model learns it.",
        severity: "low",
        expectedSecDropPct: 0,
        confidence: conf,
      });
    }

    if (
      inf.vsBestPct != null &&
      inf.vsBestPct > 8 &&
      (inf.state === "PRODUCING" || inf.state === "HIGH_LOAD") &&
      recs.length === 0
    ) {
      recs.push({
        category: "process",
        title: "SEC has drifted from this machine's personal best",
        why: `Rolling SEC is ${inf.vsBestPct.toFixed(0)}% worse than the 10th-percentile shift this machine has achieved.`,
        action: "Replay the last known-good recipe and shift conditions. The model keeps watching.",
        severity: "low",
        expectedSecDropPct: Math.round((inf.vsBestPct / (1 + inf.vsBestPct / 100)) * 10) / 10,
        confidence: conf,
      });
    }

    if (this.phase === "commissioning" || this.phase === "statistical") {
      recs.push({
        category: "process",
        title:
          this.phase === "commissioning"
            ? "Still learning this machine's normal — recommendations are conservative"
            : "Statistical baseline is live; ML anomaly layer starts after more clean run data",
        why: `Learned from ${this.accepted.length.toLocaleString("en-IN")} clean run samples (${this.quarantined.toLocaleString("en-IN")} suspect samples quarantined, not learned). First-week commissioning samples are ignored at train time.`,
        action: "Keep running normal production. Do not inject unusual recipes during the first learning window if you can avoid it.",
        severity: "low",
        expectedSecDropPct: 0,
        confidence: 0.95,
      });
    }

    return recs.slice(0, 3);
  }

  modelCard(): TrainedModelCard {
    return {
      phase: this.phase,
      producingSamples: this.producingCount,
      trees: this.forest?.nTrees ?? 0,
      subsample: this.forest?.sampleSize ?? 0,
      featureCount: this.forestIdx.length,
      threshold: Math.round(this.mlThreshold * 1000) / 1000,
      statThreshold: Math.round(this.zCrit * 100) / 100,
      quarantined: this.quarantined,
      acceptedSamples: this.accepted.length,
      trainedOn: this.forest
        ? `${this.profile.id} clean RUN data only (gated; currentA excluded)`
        : "not yet",
      note: this.forest
        ? "Same code as every other machine. Thresholds, trees and kW~throughput baseline are this machine's own."
        : "Engine is collecting a machine-specific baseline. No generic model is used.",
    };
  }
}
