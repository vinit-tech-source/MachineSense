/**
 * Fast policy checks — poisoning, FA, residual, generic-model claim.
 * Run: node --experimental-strip-types bench/policy.ts
 */
import { MachineIntelligence } from "../src/lib/yieldwatt/engine";
import { PROFILES } from "../src/lib/yieldwatt/profiles";
import { emitSample, trainFromHistory } from "../src/lib/yieldwatt/simulate";
import { mulberry32 } from "../src/lib/yieldwatt/rng";

const now = 1_728_036_900_000;
const im = PROFILES.find((p) => p.id === "IM-01")!;
const extr = PROFILES.find((p) => p.id === "EXTR-04")!;

function train(profile = im, seed = 1) {
  const e = new MachineIntelligence(profile);
  trainFromHistory(e, seed, now);
  return e;
}

function runFault(e: MachineIntelligence, fault: "quality" | "bearing" | "power_factor", n: number, seed = 9) {
  const rng = mulberry32(seed);
  let prev = e.profile.producingKw;
  let hits = 0;
  let alerts = 0;
  for (let i = 0; i < n; i++) {
    const s = emitSample(e.profile, now + i * 15_000, rng, fault, prev, { severity: 1 });
    prev = s.kw;
    e.observe(s);
    const inf = e.infer(s);
    if (inf.hit) hits++;
    if (inf.alerting) alerts++;
  }
  return { hits, alerts, quarantined: e.quarantined, accepted: e.modelCard().acceptedSamples ?? 0 };
}

function healthyFA() {
  const e = train();
  const rng = mulberry32(21);
  let prev = im.producingKw;
  let alerts = 0;
  let n = 0;
  for (let i = 0; i < 800; i++) {
    const s = emitSample(im, now + i * 15_000, rng, "none", prev, { overloadRate: 0 });
    prev = s.kw;
    e.observe(s);
    const inf = e.infer(s);
    if (inf.state === "PRODUCING" || inf.state === "HIGH_LOAD") {
      n++;
      if (inf.alerting) alerts++;
    }
  }
  return { alerts, n, rate: n ? alerts / n : 0 };
}

function genericVsOwn() {
  const eIm = train(im, 3);
  const eEx = train(extr, 4);
  const rng = mulberry32(5);
  let prev = extr.producingKw;
  let foreign = 0;
  let own = 0;
  let n = 0;
  for (let i = 0; i < 200; i++) {
    const s = emitSample(extr, now + i * 15_000, rng, "none", prev, { overloadRate: 0 });
    prev = s.kw;
    if (s.goodUnits + s.rejects === 0) continue;
    n++;
    if (eIm.rawForestHit(s)) foreign++;
    if (eEx.rawForestHit(s)) own++;
  }
  return { n, foreignPct: (100 * foreign) / n, ownPct: (100 * own) / n };
}

function poison() {
  const e = train();
  const q0 = e.quarantined;
  const a0 = e.modelCard().acceptedSamples ?? 0;
  const r = runFault(e, "quality", 2000, 11);
  return { q0, a0, ...r, learnedDuringFault: r.accepted - a0 };
}

const fa = healthyFA();
const po = poison();
const gv = genericVsOwn();
const brg = train();
const bearing = runFault(brg, "bearing", 400, 12);

console.log(JSON.stringify({ healthyFA: fa, poison: po, generic: gv, bearing, card: train().modelCard() }, null, 2));
