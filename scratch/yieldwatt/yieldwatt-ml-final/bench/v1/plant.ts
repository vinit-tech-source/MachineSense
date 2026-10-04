import { MachineIntelligence } from "./engine";
import { PROFILES } from "./profiles";
import { mulberry32 } from "./rng";
import { emitSample, trainFromHistory } from "./simulate";
import type { AlertEvent, Inference, Recommendation, Sample } from "./types";

export const BOOT_T = 1_728_036_900_000;

export interface MachineLive {
  engine: MachineIntelligence;
  sample: Sample;
  inference: Inference;
  recs: Recommendation[];
  spark: number[];
  secHistory: { t: number; sec: number }[];
  fault: import("./types").FaultKind;
  alerts: AlertEvent[];
  historySamples: number;
}

export interface Plant {
  machines: MachineLive[];
  startedAt: number;
}

let alertSeq = 1;

function pushAlert(m: MachineLive, inf: Inference, recs: Recommendation[]) {
  if (!recs.length) return;
  const top = recs[0]!;
  if (top.severity === "low") return;
  if (!(inf.mlHit || inf.statisticalHit || inf.state === "IDLE")) return;
  const last = m.alerts[0];
  if (last && last.title === top.title && m.sample.t - last.t < 45_000) return;
  m.alerts.unshift({
    id: `a${alertSeq++}`,
    t: m.sample.t,
    machineId: m.engine.profile.id,
    title: top.title,
    why: top.why,
    severity: top.severity,
    score: inf.anomalyScore ?? Math.max(...inf.zScores.map((z) => Math.abs(z)), 0),
  });
  m.alerts = m.alerts.slice(0, 8);
}

export function bootstrapPlant(seed = 42): Plant {
  const machines: MachineLive[] = PROFILES.map((profile, i) => {
    const engine = new MachineIntelligence(profile);
    const n = trainFromHistory(engine, seed + i * 97, BOOT_T);
    const rng = mulberry32(seed + 1000 + i);
    const sample = emitSample(profile, BOOT_T, rng, "none", profile.producingKw);
    const inference = engine.infer(sample);
    const recs = engine.recommend(sample, inference);
    const live: MachineLive = {
      engine,
      sample,
      inference,
      recs,
      spark: Array.from({ length: 24 }, (_, k) =>
        profile.producingKw * (0.9 + ((k + i) % 5) * 0.02),
      ),
      secHistory: [],
      fault: "none",
      alerts: [],
      historySamples: n,
    };
    if (inference.secRolling != null) {
      live.secHistory.push({ t: sample.t, sec: inference.secRolling });
    }
    return live;
  });

  const extr = machines.find((m) => m.engine.profile.id === "EXTR-04");
  if (extr) {
    extr.fault = "power_factor";
    const rng = mulberry32(seed + 44);
    const s = emitSample(extr.engine.profile, BOOT_T, rng, "power_factor", extr.sample.kw);
    extr.sample = s;
    extr.inference = extr.engine.infer(s);
    extr.recs = extr.engine.recommend(s, extr.inference);
    pushAlert(extr, extr.inference, extr.recs);
  }

  return { machines, startedAt: BOOT_T };
}

export function tickPlant(plant: Plant, now = Date.now()) {
  plant.machines.forEach((m, i) => {
    const rng = mulberry32(((now / 80) | 0) + i * 13);
    const s = emitSample(m.engine.profile, now, rng, m.fault, m.sample.kw);
    m.engine.observe(s);
    m.sample = s;
    m.inference = m.engine.infer(s);
    m.recs = m.engine.recommend(s, m.inference);
    m.spark = [...m.spark.slice(-47), s.kw];
    if (
      m.inference.secRolling != null &&
      (m.inference.state === "PRODUCING" || m.inference.state === "HIGH_LOAD")
    ) {
      m.secHistory = [...m.secHistory.slice(-60), { t: now, sec: m.inference.secRolling }];
    }
    pushAlert(m, m.inference, m.recs);
  });
}

export function plantKpis(plant: Plant) {
  let kwh = 0;
  let good = 0;
  for (const m of plant.machines) {
    kwh += m.engine.kwhProducing;
    good += m.engine.goodProducing;
  }
  const alerts = plant.machines.reduce(
    (n, m) => n + m.alerts.filter((a) => a.severity !== "low").length,
    0,
  );
  const producing = plant.machines.filter(
    (m) => m.inference.state === "PRODUCING" || m.inference.state === "HIGH_LOAD",
  ).length;
  return {
    kwh,
    good,
    sec: good > 0 ? kwh / good : 0,
    rupee: kwh * 8.5,
    co2: kwh * 0.82,
    alerts,
    producing,
  };
}
