"""
Step 3 & 4 Verification Script
================================

Step 3: 10-minute zero-fault test with REALISTIC (Gaussian) noise.
Step 4: RUL decay curve monotonicity test with slow worsening trend.

Run from backend/:
    python scratch_test.py
"""
import sys
import random
import math
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from simulator.simulate import generate_reading, NOISE, BASELINE
from app.services.anomaly_service import RollingBaseline, estimate_rul
from app.core.config import settings


# ─── Verify simulate.py is using Gaussian noise ──────────────────────────────
import simulator.simulate as sim_mod
import inspect
src = inspect.getsource(sim_mod.generate_reading)
assert "random.gauss" in src and "random.uniform" not in src, (
    "FAIL: simulate.py is NOT using Gaussian noise. Revert the simulator first."
)
print("✓  Noise model confirmed: random.gauss (realistic, unbounded tail)\n")


# ─── Step 3: 10-minute zero-fault test ───────────────────────────────────────
print("=" * 65)
print("STEP 3  –  10-minute zero-fault test (realistic Gaussian noise)")
print(f"          Noise model : random.gauss, σ per NOISE constants")
print(f"          Debounce N  : {settings.anomaly_debounce_count} consecutive readings")
print(f"          Baseline stat: MAD-based modified z-score (Iglewicz & Hoaglin)")
print(f"          Z threshold : warning={settings.anomaly_warning_z}, critical={settings.anomaly_critical_z}")
print("=" * 65)

baseline = RollingBaseline(
    window=settings.anomaly_baseline_window,
    min_samples=settings.anomaly_min_baseline_samples,
    warning_z=settings.anomaly_warning_z,
    critical_z=settings.anomaly_critical_z,
    debounce_count=settings.anomaly_debounce_count,
)

INTERVAL_S = 3.0
DURATION_S = 600.0  # 10 minutes
total_readings = int(DURATION_S / INTERVAL_S)  # 200

normals = warnings = criticals = 0
warning_events = []

for i in range(total_readings):
    t = i * INTERVAL_S
    reading = generate_reading("normal", t)

    status, contribs, reason = baseline.evaluate(reading)

    if status.value == "warning":
        warnings += 1
        warning_events.append((i, reason))
    elif status.value == "critical":
        criticals += 1
        warning_events.append((i, f"CRITICAL: {reason}"))
    else:
        normals += 1

    baseline.add(reading)

print(f"\nTotal readings   : {total_readings}")
print(f"  Normal         : {normals}")
print(f"  Warning        : {warnings}")
print(f"  Critical       : {criticals}")

if warning_events:
    print(f"\nWarning/Critical events ({len(warning_events)}):")
    for idx, reason in warning_events:
        print(f"  [{idx:3d}] {reason}")
else:
    print("\n✓  Zero false alerts across 10 minutes of realistic Gaussian noise")

print()


# ─── Step 4: RUL decay curve ──────────────────────────────────────────────────
print("=" * 65)
print("STEP 4  –  RUL decay curve (slow worsening trend, 4 simulated hours)")
print("          Vibration : 2.1 → 7.0 mm/s over 80 steps")
print("          Temperature: 65 → 80 °C over 80 steps")
print("=" * 65)

bl_rul = RollingBaseline(
    window=settings.anomaly_baseline_window,
    min_samples=60,
    warning_z=settings.anomaly_warning_z,
    critical_z=settings.anomaly_critical_z,
    debounce_count=settings.anomaly_debounce_count,
)

# Seed baseline with 60 healthy readings
def healthy_reading(vibration=2.1, temp=65.0):
    return {
        "current_a": 10.5,
        "voltage_v": 230.0,
        "vibration_mm_s": vibration,
        "temp_c": temp,
        "rpm": 1450.0,
    }

import random as _rand
_rand.seed(42)

for _ in range(200):  # fill window with realistic Gaussian noise
    bl_rul.add({
        "current_a":      _rand.gauss(10.5, 0.3),
        "voltage_v":      _rand.gauss(230.0, 1.5),
        "vibration_mm_s": _rand.gauss(2.1, 0.2),
        "temp_c":         _rand.gauss(65.0, 0.5),
        "rpm":            _rand.gauss(1450.0, 10.0),
    })

print(f"\n{'Step':>4}  {'Vib (mm/s)':>12}  {'Temp (°C)':>10}  {'RUL (days)':>11}")
print("-" * 44)

rul_values = []
STEPS = 80
for i in range(STEPS):
    frac = i / (STEPS - 1)
    vib = 2.1 + frac * 4.9    # 2.1 → 7.0
    temp = 65.0 + frac * 15.0  # 65 → 80
    r = healthy_reading(vibration=vib, temp=temp)
    rul = estimate_rul(bl_rul, r, [])
    rul_values.append(rul)
    # Do NOT add to baseline — baseline is frozen at healthy calibration period
    # (adding degraded readings would cause the rolling window to adapt its median,
    #  making strict monotone impossible — see test docstring for rationale)
    if i % 5 == 0 or i == STEPS - 1:
        print(f"{i:>4}  {vib:>12.2f}  {temp:>10.1f}  {rul if rul is not None else 'None':>11}")

# Monotonicity check
violations = [
    (i, rul_values[i-1], rul_values[i])
    for i in range(1, len(rul_values))
    if rul_values[i] is not None and rul_values[i-1] is not None
    and rul_values[i] > rul_values[i-1]
]

print()
if violations:
    print(f"✗  Monotonicity VIOLATIONS ({len(violations)}):")
    for step, prev, curr in violations:
        print(f"   step {step}: {prev} → {curr}  (increased)")
else:
    print(f"✓  RUL is strictly monotonically non-increasing across all {STEPS} steps")
    print(f"   Start: {rul_values[0]} days  →  End: {rul_values[-1]} days")
