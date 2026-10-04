import { MachineIntelligence } from "./engine";
import { clamp, gauss, mulberry32 } from "./rng";
import type { FaultKind, MachineProfile, OperatingState, Sample } from "./types";

function intendedState(profile: MachineProfile, t: number, rng: () => number): OperatingState {
  const dayMin = ((t / 60000) % (24 * 60) + 24 * 60) % (24 * 60);
  const hour = dayMin / 60;
  if (hour < 6 || hour > 22) return rng() > 0.85 ? "IDLE" : "OFF";
  if (hour >= 12.0 && hour < 12.6) return "IDLE";
  if (profile.kind === "compressor" && rng() < 0.12) return "IDLE";
  if (rng() < 0.04) return "HIGH_LOAD";
  return "PRODUCING";
}

export function emitSample(
  profile: MachineProfile,
  t: number,
  rng: () => number,
  fault: FaultKind,
  prevKw: number,
): Sample {
  let state = intendedState(profile, t, rng);
  if (fault === "idle_waste" && state === "OFF") state = "IDLE";

  let kw = 0.02;
  let pf = 0.99;
  let temp = profile.tempC - 18;
  let vib = profile.vibRms * 0.2;
  let current = 0.4;
  let good = 0;
  let rejects = 0;
  const dtH = 15 / 3600;

  if (state === "IDLE") {
    kw = profile.idleKw * (0.9 + rng() * 0.2);
    pf = profile.pf + 0.03 + gauss(rng) * 0.01;
    temp = profile.tempC - 10 + gauss(rng) * 1.2;
    vib = profile.vibRms * 0.35 + Math.abs(gauss(rng) * 0.05);
    current = kw / (Math.sqrt(3) * 0.415 * Math.max(0.5, pf));
  } else if (state === "PRODUCING" || state === "HIGH_LOAD") {
    const load = state === "HIGH_LOAD" ? 1.18 : 1;
    kw = profile.producingKw * load + gauss(rng) * profile.producingKwStd;
    pf = profile.pf + gauss(rng) * 0.015;
    temp = profile.tempC + gauss(rng) * 1.8;
    vib = profile.vibRms + Math.abs(gauss(rng) * 0.12);
    current = kw / (Math.sqrt(3) * 0.415 * Math.max(0.5, pf));
    const cycles = (15 / profile.cycleSec) * (0.85 + rng() * 0.2);
    const units = cycles * profile.unitsPerCycle;
    const rejFrac = Math.max(0, profile.rejectPct / 100 + gauss(rng) * 0.004);
    rejects = units * rejFrac;
    good = Math.max(0, units - rejects);
  } else if (state === "OVERLOAD") {
    kw = profile.overloadKw + gauss(rng) * 0.6;
    pf = profile.pf - 0.06;
    temp = profile.tempC + 12;
    vib = profile.vibRms * 1.6;
    current = kw / (Math.sqrt(3) * 0.4 * 0.8);
  }

  if (fault === "bearing" && state !== "OFF") {
    kw *= 1.16;
    temp += 14 + gauss(rng) * 1.2;
    vib *= 3.2;
    current *= 1.14;
  } else if (fault === "power_factor" && state !== "OFF") {
    pf = clamp(pf - 0.22, 0.52, 0.99);
    kw *= 1.14;
  } else if (fault === "idle_waste") {
    if (state === "IDLE" || state === "OFF") {
      kw = profile.idleKw * 1.15;
      pf = profile.pf;
      good = 0;
      rejects = 0;
    }
  } else if (fault === "quality" && (state === "PRODUCING" || state === "HIGH_LOAD")) {
    rejects = (good + rejects) * 0.14;
    good = Math.max(0, good - rejects);
  }

  kw = clamp(0.6 * kw + 0.4 * (prevKw || kw), 0, profile.ratedKw * 1.15);
  pf = clamp(pf, 0.5, 1);
  const kwhDelta = kw * dtH;

  return {
    t,
    machineId: profile.id,
    kw,
    kwhDelta,
    pf,
    tempC: temp,
    vibRms: vib,
    currentA: current,
    freqHz: 50 + gauss(rng) * 0.04,
    goodUnits: good,
    rejects,
  };
}

export function trainFromHistory(engine: MachineIntelligence, seed: number, now: number) {
  const profile = engine.profile;
  const rng = mulberry32(seed);
  const samplesPerDay = 16 * 12;
  const n = Math.max(40, Math.floor(profile.historyDays * samplesPerDay * 0.7));
  const start = now - profile.historyDays * 24 * 3600 * 1000;
  let prev = profile.producingKw;
  const keep = profile.learningTarget === "ml_ready";
  for (let i = 0; i < n; i++) {
    const t = start + i * 5 * 60 * 1000;
    const s = emitSample(profile, t, rng, "none", prev);
    prev = s.kw;
    engine.observe(s, { keepTrainBuffer: keep });
  }
  if (keep) engine.fitForest(rng);
  return n;
}
