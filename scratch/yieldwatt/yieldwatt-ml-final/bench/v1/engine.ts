/**
 * YieldWatt machine intelligence — ONE class for every machine.
 *
 * You do not write a different model per machine type.
 * You instantiate this engine, feed it that machine's own data,
 * and it learns that machine's normal. Profiles only describe
 * sensors, nameplate ratings, and idle/producing bands.
 */

import { anomalyScore, fitIsolationForest, ML_THRESHOLD, type FittedForest } from "./isolation-forest";
import { FEATURE_ORDER, type FeatureName, type Inference, type LearningPhase, type MachineProfile, type OperatingState, type Recommendation, type Sample, type TrainedModelCard } from "./types";

const Z_HIT = 3;

export function detectState(
  kw: number,
  profile: MachineProfile,
  prev: OperatingState,
): OperatingState {
  const idle = profile.idleKw;
  const prod = profile.producingKw;
  const high = profile.highLoadKw;
  const over = profile.overloadKw;
  // Hysteresis so chatter at band edges does not flip state.
  const slack = prev === "IDLE" ? idle * 0.15 : 0;
  if (kw < 0.25) return "OFF";
  if (kw < idle + 0.8 + slack) return "IDLE";
  if (kw >= over) return "OVERLOAD";
  if (kw >= high) return "HIGH_LOAD";
  if (kw >= prod * 0.55) return "PRODUCING";
  return prev === "OFF" ? "IDLE" : prev;
}

export function featureVector(sample: Sample, profile: MachineProfile): { values: number[]; mask: boolean[] } {
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
  const values = FEATURE_ORDER.map((f) => raw[f]);
  const mask = FEATURE_ORDER.map((f) => profile.sensors.includes(f));
  return { values, mask };
}

class RunningMoments {
  n = 0;
  mean: number[];
  m2: number[];
  constructor(dim: number) {
    this.mean = Array.from({ length: dim }, () => 0);
    this.m2 = Array.from({ length: dim }, () => 0);
  }
  push(x: number[], mask: boolean[]) {
    this.n += 1;
    const n = this.n;
    for (let i = 0; i < x.length; i++) {
      if (!mask[i]) continue;
      const d = x[i]! - this.mean[i]!;
      this.mean[i]! += d / n;
      this.m2[i]! += d * (x[i]! - this.mean[i]!);
    }
  }
  std(i: number) {
    if (this.n < 2) return 1;
    return Math.sqrt(this.m2[i]! / (this.n - 1)) || 1;
  }
  z(x: number[], mask: boolean[]) {
    return x.map((v, i) => {
      if (!mask[i] || this.n < 8) return 0;
      return (v - this.mean[i]!) / this.std(i);
    });
  }
}

export class MachineIntelligence {
  profile: MachineProfile;
  phase: LearningPhase = "commissioning";
  byState: Record<OperatingState, RunningMoments>;
  producingX: number[][] = [];
  forest: FittedForest | null = null;
  producingCount = 0;
  kwhProducing = 0;
  goodProducing = 0;
  rollingSec: number | null = null;
  personalBest: number;
  lastState: OperatingState = "OFF";
  readonly mlThreshold = ML_THRESHOLD;

  constructor(profile: MachineProfile) {
    this.profile = profile;
    this.personalBest = profile.bestSec;
    this.byState = {
      OFF: new RunningMoments(FEATURE_ORDER.length),
      IDLE: new RunningMoments(FEATURE_ORDER.length),
      PRODUCING: new RunningMoments(FEATURE_ORDER.length),
      HIGH_LOAD: new RunningMoments(FEATURE_ORDER.length),
      OVERLOAD: new RunningMoments(FEATURE_ORDER.length),
    };
  }

  private refreshPhase() {
    if (this.forest) this.phase = "ml_ready";
    else if (this.producingCount >= 400) this.phase = "statistical";
    else this.phase = "commissioning";
  }

  observe(sample: Sample, opts?: { keepTrainBuffer?: boolean }) {
    const state = detectState(sample.kw, this.profile, this.lastState);
    this.lastState = state;
    const { values, mask } = featureVector(sample, this.profile);
    this.byState[state].push(values, mask);
    if (state === "PRODUCING" || state === "HIGH_LOAD") {
      this.producingCount += 1;
      this.kwhProducing += sample.kwhDelta;
      this.goodProducing += sample.goodUnits;
      if (this.goodProducing > 0) {
        this.rollingSec = this.kwhProducing / this.goodProducing;
        if (this.rollingSec < this.personalBest) this.personalBest = this.rollingSec;
      }
      if (opts?.keepTrainBuffer) this.producingX.push(values.filter((_, i) => mask[i]));
    }
    this.refreshPhase();
    return state;
  }

  fitForest(rng: () => number) {
    if (this.producingX.length < 200) return;
    this.forest = fitIsolationForest(this.producingX, rng, 80, 256);
    this.producingX = [];
    this.phase = "ml_ready";
  }

  infer(sample: Sample): Inference {
    const state = detectState(sample.kw, this.profile, this.lastState);
    const { values, mask } = featureVector(sample, this.profile);
    const stats = this.byState[state];
    const zScores = stats.z(values, mask);
    const statisticalHit =
      state !== "OFF" && zScores.some((z, i) => mask[i] && Math.abs(z) >= Z_HIT);
    let anomalyScoreVal: number | null = null;
    let mlHit = false;
    if (this.forest && (state === "PRODUCING" || state === "HIGH_LOAD")) {
      const compact = values.filter((_, i) => mask[i]);
      anomalyScoreVal = anomalyScore(this.forest, compact);
      mlHit = anomalyScoreVal >= this.mlThreshold;
    }
    const good = sample.goodUnits;
    const secInstant = good > 0 ? sample.kwhDelta / good : null;
    const vsBest =
      this.rollingSec != null && this.personalBest > 0
        ? ((this.rollingSec - this.personalBest) / this.personalBest) * 100
        : null;
    const contributions = FEATURE_ORDER.map((feature, i) => ({
      feature,
      z: mask[i] ? zScores[i]! : 0,
    })).sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
    return {
      state,
      features: values,
      presentMask: mask,
      zScores,
      anomalyScore: anomalyScoreVal,
      statisticalHit,
      mlHit,
      secInstant,
      secRolling: this.rollingSec,
      vsBestPct: vsBest,
      contributions,
    };
  }

  recommend(sample: Sample, inf: Inference): Recommendation[] {
    const recs: Recommendation[] = [];
    const zOf = (f: FeatureName) =>
      inf.contributions.find((c) => c.feature === f)?.z ?? 0;
    const zKw = zOf("kw");
    const zPf = zOf("pf");
    const zTemp = zOf("tempC");
    const zVib = zOf("vibRms");
    const zRej = zOf("rejectPct");
    const hit = inf.mlHit || inf.statisticalHit;

    if (inf.state === "IDLE" && sample.kw > this.profile.idleKw * 0.6) {
      recs.push({
        category: "energy",
        title: "Idle running is burning kWh with no output",
        why: `Machine is IDLE at ${sample.kw.toFixed(1)} kW. SEC explodes because the denominator (good units) is zero.`,
        action: "Shut down or auto-sleep after the set idle timeout. Check why the cycle is not starting.",
        severity: sample.kw > this.profile.idleKw ? "high" : "medium",
        expectedSecDropPct: 6,
        confidence: 0.9,
      });
    }

    if (hit && zVib > 2.2 && zTemp > 1.6) {
      recs.push({
        category: "maintenance",
        title: "Mechanical degradation (bearing / alignment / tool wear)",
        why: "Power, vibration and temperature are rising together — classic mechanical friction, not a process setpoint issue.",
        action: "Inspect bearings, coupling alignment and tool condition at the next planned stop. Do not wait for a trip.",
        severity: "high",
        expectedSecDropPct: 4,
        confidence: 0.82,
      });
    } else if (hit && zPf < -2.0 && Math.abs(zVib) < 1.4) {
      recs.push({
        category: "energy",
        title: "Electrical inefficiency — power factor collapsed",
        why: "kW is high and PF is low while vibration is normal. Energy is being wasted electrically (filter, capacitor bank, or motor load mismatch).",
        action: "Check inlet filter / cooling, capacitor bank, and whether the motor is oversized for the current recipe.",
        severity: "medium",
        expectedSecDropPct: 5,
        confidence: 0.78,
      });
    } else if (hit && zRej > 2.2 && Math.abs(zKw) < 1.6) {
      recs.push({
        category: "process",
        title: "Quality loss is inflating SEC",
        why: "Energy is normal but good-unit output is down. SEC = kWh / good units — rejects silently destroy efficiency.",
        action: "Hold the current recipe, check material feed, mould temperature and last tool change. Do not raise speed to 'catch up'.",
        severity: "high",
        expectedSecDropPct: 8,
        confidence: 0.8,
      });
    } else if (hit && zKw > 2.4) {
      recs.push({
        category: "energy",
        title: "Producing at an unusually high specific load",
        why: `Power is ${zKw.toFixed(1)}σ above this machine's own PRODUCING baseline.`,
        action: "Compare recipe, speed and cooling against the shift that set the personal-best SEC.",
        severity: "medium",
        expectedSecDropPct: 3,
        confidence: 0.7,
      });
    }

    if (
      inf.vsBestPct != null &&
      inf.vsBestPct > 8 &&
      inf.state === "PRODUCING" &&
      recs.length === 0
    ) {
      recs.push({
        category: "process",
        title: "SEC has drifted from this machine's personal best",
        why: `Rolling SEC is ${inf.vsBestPct.toFixed(0)}% worse than the best window this same machine has achieved.`,
        action: "Replay the last known-good recipe and shift conditions. The model will keep watching.",
        severity: "low",
        expectedSecDropPct: inf.vsBestPct / 2,
        confidence: 0.6,
      });
    }

    if (this.phase !== "ml_ready") {
      recs.push({
        category: "process",
        title:
          this.phase === "commissioning"
            ? "Still learning this machine's normal — recommendations are conservative"
            : "Statistical baseline is live; ML anomaly layer starts after more PRODUCING data",
        why: `Observed ${this.producingCount.toLocaleString("en-IN")} PRODUCING samples. Isolation Forest needs a clean window of this machine only — never a generic dataset.`,
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
      featureCount: this.profile.sensors.length,
      threshold: this.mlThreshold,
      trainedOn: this.forest
        ? `${this.profile.id} PRODUCING data only`
        : "not yet",
      note: this.forest
        ? "Same Isolation Forest code as every other machine. Only the fitted trees differ."
        : "Engine is collecting a machine-specific baseline. No generic model is used.",
    };
  }
}
