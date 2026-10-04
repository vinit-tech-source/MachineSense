# YieldWatt ML — final (Claude v2 + Grok policy/energy layer)

Drop-in for `src/lib/yieldwatt/*`. Dashboard contract unchanged; new `Inference` fields are additive
(`alerting`, `shift`, `impactPct`, `confidence`, `residualKw`, `wasteInrPerHour`, `wasteKgCo2PerHour`).
New method: `engine.rawForestHit(sample)` (forest only, no state gate, for the generic-model demo).

Run: `npx tsx bench/smoke.ts`, `npx tsx bench/policy.ts` (seconds), `npx tsx bench/run.ts` (~5 min, writes bench/RESULTS_RAW.txt).

## Measured (simulator, not real-plant accuracy)
- Healthy: 0 alert events/day (naive 32-35, v1 16-20); 0 in 30 days on IM-01 and EXTR-04.
- Abrupt faults: 17/18 detected in 1-2 min, 0 false alerts before onset. Miss: CNC quality at sev 0.3 (+4% SEC, under the 8% rule).
- Gradual: bearing 5-9% severity, quality 9-10% (CNC no reject sensor: 50% via SEC), power factor 20-32% (EXTR-04 now 20% via the energy residual).
- Benign drift (3 days): 0-1 false alert events (v1: 119-139), classified `drift`, 0 after operator confirm. EXTR-04 had 1 event.
- Generic model fails: IM-01's forest flags 100% of clean EXTR-04 producing samples; EXTR-04's own forest flags 0%.
- Idle waste: detected ~46 min after idling starts (bench shows time from fault onset). Overload needs 3+ consecutive samples, so isolated spikes are not alerted.

## Honest limits
Faults are multipliers in a simulator. Drift-vs-fault is rule-based (3 sigma, +8% SEC). The kW~throughput model has little to learn here because simulated kW barely depends on units. Real logs from one machine are the biggest credibility gain left.
