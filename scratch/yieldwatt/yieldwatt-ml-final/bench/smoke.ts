import { bootstrapPlant, tickPlant, plantKpis } from "../src/lib/yieldwatt/plant";
const plant = bootstrapPlant(42);
const show = (tag: string) => { console.log("--", tag); for (const m of plant.machines) { const i = m.inference; console.log(m.engine.profile.id.padEnd(8), m.engine.phase.padEnd(13), i.state.padEnd(9), "alerting", String(i.alerting).padEnd(5), "shift", i.shift.padEnd(5), "alerts", m.alerts.length, m.alerts[0]?.title ?? "", "| rollSEC", i.secRolling?.toFixed(3), "best", m.engine.personalBest.toFixed(3), "vsBest", i.vsBestPct?.toFixed(0)); } };
show("boot (EXTR-04 has the demo power-factor fault)");
// local 10:00 on a weekday, 1 s ticks
const base = Date.UTC(2026, 9, 5, 4, 30);
let now = base;
for (let k = 0; k < 600; k++) { now += 1000; tickPlant(plant, now); }
show("after 600 ticks healthy (others)");
plant.machines.find((m) => m.engine.profile.id === "IM-01")!.fault = "bearing";
for (let k = 0; k < 60; k++) { now += 1000; tickPlant(plant, now); }
show("60 ticks after bearing fault injected on IM-01");
plant.machines.find((m) => m.engine.profile.id === "IM-01")!.fault = "none";
plant.machines.find((m) => m.engine.profile.id === "EXTR-04")!.fault = "none";
for (let k = 0; k < 400; k++) { now += 1000; tickPlant(plant, now); }
show("faults cleared, 400 ticks later");
console.log(plantKpis(plant));
console.log(plant.machines[0]!.engine.modelCard());
