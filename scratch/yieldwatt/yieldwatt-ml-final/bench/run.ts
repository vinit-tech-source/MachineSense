/**
 * YieldWatt ML benchmark harness.
 * Compares: NAIVE (frozen mean/std, any |z|>=3, no persistence)  vs  V1 (original engine)  vs  V2.
 * All engines see byte-identical sample streams from the same simulator.
 */
import { MachineIntelligence as V2 } from "../src/lib/yieldwatt/engine";
import { PROFILES as P2 } from "../src/lib/yieldwatt/profiles";
import { emitSample } from "../src/lib/yieldwatt/simulate";
import { PLANT_UTC_OFFSET_MIN, type Sample, type FaultKind, FEATURE_ORDER } from "../src/lib/yieldwatt/types";
import { mulberry32 } from "../src/lib/yieldwatt/rng";
import { MachineIntelligence as V1 } from "./v1/engine";
import { PROFILES as P1 } from "./v1/profiles";
import { featureVector } from "../src/lib/yieldwatt/engine";
import * as fs from "fs";

const OFF = PLANT_UTC_OFFSET_MIN * 60_000;
const DAY = 86_400_000;
const STEP = 15_000;
const BOOT = 1_728_036_900_000;
const START = Math.floor((BOOT + OFF) / DAY) * DAY - OFF + DAY + 7 * 3600_000; // next day 07:00 local

type Spec = {
  name: string;
  fault: FaultKind;
  sev: (elapsedMs: number) => number; // severity over time since onset
  drift?: (elapsedMs: number) => number;
  onsetAfterMs: number; // healthy warm-up
  durationMs: number;
  overloadRate?: number;
};

function histSamples(profileId: string, seed: number): Sample[] {
  const profile = P2.find((p) => p.id === profileId)!;
  const rng = mulberry32(seed);
  const n = Math.max(40, Math.floor(profile.historyDays * 16 * 12 * 0.7));
  const start = BOOT - profile.historyDays * DAY;
  let prev = profile.producingKw;
  const out: Sample[] = [];
  for (let i = 0; i < n; i++) {
    const s = emitSample(profile, start + i * 5 * 60_000, rng, "none", prev, { overloadRate: 0 });
    prev = s.kw;
    out.push(s);
  }
  return out;
}

interface Det {
  step(s: Sample): { alert: boolean; shift: string; hit: boolean };
  confirm?(): void;
}

function makeNaive(profileId: string, hist: Sample[]): Det {
  const profile = P2.find((p) => p.id === profileId)!;
  const rows = hist.filter((s) => s.goodUnits + s.rejects > 0).map((s) => featureVector(s, profile));
  const d = FEATURE_ORDER.length;
  const mean = new Array(d).fill(0), sd = new Array(d).fill(1);
  const mask = rows[0]!.mask;
  for (let j = 0; j < d; j++) {
    if (!mask[j]) continue;
    const col = rows.map((r) => r.values[j]!);
    const m = col.reduce((a, b) => a + b, 0) / col.length;
    mean[j] = m;
    sd[j] = Math.sqrt(col.reduce((a, b) => a + (b - m) ** 2, 0) / col.length) || 1;
  }
  return {
    step(s) {
      if (!(s.goodUnits + s.rejects > 0)) return { alert: false, shift: "none", hit: false };
      const { values } = featureVector(s, profile);
      const hit = values.some((v, j) => mask[j] && Math.abs((v - mean[j]) / sd[j]) >= 3);
      return { alert: hit, shift: "none", hit };
    },
  };
}

function makeV1(profileId: string, hist: Sample[]): Det {
  const profile = P1.find((p) => p.id === profileId)!;
  const e = new V1(profile);
  const keep = profile.learningTarget === "ml_ready";
  hist.forEach((s) => e.observe(s, { keepTrainBuffer: keep }));
  if (keep) e.fitForest(mulberry32(99));
  return {
    step(s) {
      e.observe(s);
      const inf = e.infer(s);
      const recs = e.recommend(s, inf);
      const top = recs[0];
      const alert = !!top && top.severity !== "low" && (inf.mlHit || inf.statisticalHit || inf.state === "IDLE");
      return { alert, shift: "none", hit: inf.mlHit || inf.statisticalHit };
    },
  };
}

function makeV2(profileId: string, hist: Sample[]): Det & { e: V2 } {
  const profile = P2.find((p) => p.id === profileId)!;
  const e = new V2(profile);
  const keep = profile.learningTarget === "ml_ready";
  hist.forEach((s) => e.observe(s));
  if (keep) e.fitForest(mulberry32(99));
  return {
    e,
    step(s) {
      e.observe(s);
      const inf = e.infer(s);
      const recs = e.recommend(s, inf);
      const top = recs[0];
      const alert = !!top && top.severity !== "low" && inf.alerting;
      return { alert, shift: inf.shift, hit: inf.hit };
    },
    confirm() {
      e.confirmRebaseline();
    },
  };
}

type Kind = "naive" | "v1" | "v2";
function makeDet(kind: Kind, id: string, hist: Sample[]): Det {
  return kind === "naive" ? makeNaive(id, hist) : kind === "v1" ? makeV1(id, hist) : makeV2(id, hist);
}

interface Result {
  events: number; // alert events (10-min merged) during whole run
  preOnsetEvents: number;
  detected: boolean;
  ttdMin: number | null;
  sevAtDetect: number | null;
  lastDayAlertPct: number; // % of run samples in final 24h of fault window that are alerting
  maxShift: string;
  postConfirmEvents: number;
}

function run(kind: Kind, id: string, spec: Spec, seed: number, opts?: { confirmOnDrift?: boolean }): Result {
  const hist = histSamples(id, seed);
  const det = makeDet(kind, id, hist);
  const profile = P2.find((p) => p.id === id)!;
  const rng = mulberry32(seed + 5);
  const total = spec.onsetAfterMs + spec.durationMs;
  const onsetT = START + spec.onsetAfterMs;
  let prev = profile.producingKw;
  let lastAlertT = -Infinity;
  const r: Result = { events: 0, preOnsetEvents: 0, detected: false, ttdMin: null, sevAtDetect: null, lastDayAlertPct: 0, maxShift: "none", postConfirmEvents: 0 };
  let lastDayRun = 0, lastDayAlert = 0, confirmed = false;
  for (let el = 0; el < total; el += STEP) {
    const t = START + el;
    const faultEl = el - spec.onsetAfterMs;
    const active = faultEl >= 0;
    const sev = active ? spec.sev(faultEl) : 0;
    const dr = active && spec.drift ? spec.drift(faultEl) : 0;
    const s = emitSample(profile, t, rng, active ? spec.fault : "none", prev, {
      severity: active ? Math.max(0.0001, sev) : 1,
      drift: dr,
      overloadRate: spec.overloadRate ?? 0,
    });
    prev = s.kw;
    const o = det.step(s);
    if (o.shift === "fault" || (o.shift === "drift" && r.maxShift !== "fault")) r.maxShift = o.shift;
    if (opts?.confirmOnDrift && kind === "v2" && !confirmed && o.shift === "drift" && det.confirm) {
      det.confirm();
      confirmed = true;
      lastAlertT = -Infinity;
    }
    if (o.alert) {
      if (t - lastAlertT > 10 * 60_000) {
        r.events++;
        if (confirmed) r.postConfirmEvents++;
        if (!active) r.preOnsetEvents++;
        else if (!r.detected) {
          r.detected = true;
          r.ttdMin = (t - onsetT) / 60_000;
          r.sevAtDetect = sev;
        }
      }
      lastAlertT = t;
    }
    if (el >= total - DAY && s.goodUnits + s.rejects > 0) {
      lastDayRun++;
      if (o.alert) lastDayAlert++;
    }
  }
  r.lastDayAlertPct = lastDayRun ? (100 * lastDayAlert) / lastDayRun : 0;
  return r;
}

const f1 = (x: number | null, d = 0) => (x == null ? "  -  " : x.toFixed(d));
const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);
const kinds: Kind[] = ["naive", "v1", "v2"];
const machines = ["IM-01", "EXTR-04", "CNC-02"];
const out: Record<string, unknown> = {};
const lines: string[] = [];
const log = (s = "") => {
  console.log(s);
  lines.push(s);
};

// -------- 1. false alarms on healthy data --------
log("## 1. Healthy plant, 7 days live (alert events per day; lower is better)");
log(pad("machine", 10) + kinds.map((k) => pad(k, 9)).join(""));
for (const m of machines) {
  const row: number[] = [];
  for (const k of kinds) {
    const r = run(k, m, { name: "healthy", fault: "none", sev: () => 1, onsetAfterMs: 7 * DAY, durationMs: 0 }, 11);
    row.push(r.events / 7);
  }
  log(pad(m, 10) + row.map((v) => pad(v.toFixed(2), 9)).join(""));
  (out.healthy as any) = { ...(out.healthy as any), [m]: row };
}

// -------- 1b. long healthy soak (v2 only) --------
{
  const soak: string[] = [];
  for (const m of ["IM-01", "EXTR-04"]) {
    const r = run("v2", m, { name: "soak", fault: "none", sev: () => 1, onsetAfterMs: 30 * DAY, durationMs: 0 }, 77);
    soak.push(`${m}: ${r.events} alert events in 30 days`);
  }
  log("\n## 1b. v2 healthy soak, 30 days live: " + soak.join("; "));
}

// -------- 2. abrupt faults --------
log("\n## 2. Abrupt faults, held 2 days after 1 healthy day.  detected / time-to-detect (min) / % of final-day samples still alerting");
const faults: FaultKind[] = ["bearing", "power_factor", "quality"];
const sevs = [0.3, 1.0];
log(pad("machine/fault/sev", 26) + kinds.map((k) => pad(k, 24)).join(""));
for (const m of machines) {
  for (const f of faults) {
    for (const sv of sevs) {
      const cells: string[] = [];
      for (const k of kinds) {
        const r = run(k, m, { name: f, fault: f, sev: () => sv, onsetAfterMs: DAY, durationMs: 2 * DAY }, 21);
        cells.push(pad(`${r.detected ? "Y" : "N"} ${f1(r.ttdMin)}m  pre:${r.preOnsetEvents}  late:${f1(r.lastDayAlertPct)}%`, 24));
      }
      log(pad(`${m}/${f}/${sv}`, 26) + cells.join(""));
    }
  }
}

// -------- 3. gradual faults --------
log("\n## 3. Gradual faults, severity ramps 0 -> 1 over 3 days.  detected at severity (lower is better)");
log(pad("machine/fault", 24) + kinds.map((k) => pad(k, 16)).join(""));
for (const m of machines) {
  for (const f of faults) {
    const cells: string[] = [];
    for (const k of kinds) {
      const r = run(k, m, { name: f, fault: f, sev: (e) => Math.min(1, e / (3 * DAY)), onsetAfterMs: DAY, durationMs: 3 * DAY }, 31);
      cells.push(pad(r.detected ? `sev ${(r.sevAtDetect! * 100).toFixed(0)}% (pre:${r.preOnsetEvents})` : `MISSED (pre:${r.preOnsetEvents})`, 16));
    }
    log(pad(`${m}/${f}`, 24) + cells.join(""));
  }
}

// -------- 4. benign drift --------
log("\n## 4. Benign drift (wear/season) 0 -> 1 over 3 days. False alert events during drift; v2 also: drift classified? / after operator confirm");
log(pad("machine", 10) + kinds.map((k) => pad(k, 10)).join("") + "  v2 shift-class / events-after-confirm");
for (const m of machines) {
  const ev: number[] = [];
  for (const k of kinds) {
    const r = run(k, m, { name: "drift", fault: "none", sev: () => 1, drift: (e) => Math.min(1, e / (3 * DAY)), onsetAfterMs: DAY, durationMs: 4 * DAY }, 41);
    ev.push(r.events);
  }
  const r2 = run("v2", m, { name: "drift", fault: "none", sev: () => 1, drift: (e) => Math.min(1, e / (3 * DAY)), onsetAfterMs: DAY, durationMs: 4 * DAY }, 41, { confirmOnDrift: true });
  log(pad(m, 10) + ev.map((v) => pad(String(v), 10)).join("") + `  ${r2.maxShift} / ${r2.postConfirmEvents}`);
}

// -------- 5. idle waste & overload --------
log("\n## 5. Idle waste (machine left idling overnight) and overload excursions (0.5% of run samples)");
for (const m of machines) {
  const cells: string[] = [];
  for (const k of kinds) {
    const r = run(k, m, { name: "idle", fault: "idle_waste", sev: () => 1, onsetAfterMs: DAY, durationMs: 2 * DAY }, 51);
    cells.push(`${k}: ${r.detected ? "Y " + f1(r.ttdMin) + "m" : "N"} pre:${r.preOnsetEvents}`);
  }
  log(pad(m + " idle_waste", 22) + cells.join("   "));
}
for (const m of machines) {
  const cells: string[] = [];
  for (const k of kinds) {
    const r = run(k, m, { name: "ovl", fault: "none", sev: () => 1, onsetAfterMs: 0, durationMs: 2 * DAY, overloadRate: 0.005 }, 61);
    cells.push(`${k}: ${r.events} events`);
  }
  log(pad(m + " overload", 22) + cells.join("   "));
}

fs.writeFileSync(new URL("./RESULTS_RAW.txt", import.meta.url).pathname, lines.join("\n"));
