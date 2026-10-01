"""
Anomaly detection service — unsupervised, baseline-deviation approach.

Design:
  - Requires no labeled fault data (F4: Must).
  - Uses a rolling window of recent healthy readings to compute a baseline
    median and MAD (Median Absolute Deviation) for each signal.
  - Compares each new reading to its baseline using the *modified z-score*
    (Iglewicz & Hoaglin 1993):
        modified_z = 0.6745 * (x - median) / MAD
    MAD is far more robust to occasional outlier spikes than mean/stddev —
    a single 4-sigma spike does not corrupt the baseline.
  - Requires ANOMALY_DEBOUNCE_COUNT readings beyond the threshold before raising
    an alert.  On recovery (signal within bounds) each counter decrements by 1
    (floor 0) rather than hard-resetting.  This means an intermittent fault
    pattern (bad / good / bad / good …) still accumulates toward the threshold
    instead of being wiped out by a single good reading.
  - Returns which signals deviated, by how much, and why — in plain language (F6: Must).
  - Does not produce any output until ANOMALY_MIN_BASELINE_SAMPLES readings
    have been collected (est_days_remaining is None until then).

Extension points:
  - The baseline dict can be replaced with a more sophisticated model later
    (e.g., time-of-day seasonal baseline) without changing the API contract.
  - F11/F12 (federated learning, on-device inference) can be dropped in as
    alternative backends for this service.
"""
from __future__ import annotations

import logging
from collections import deque
from datetime import datetime, timezone
from typing import Deque, Dict, NamedTuple, Optional

import numpy as np

from app.core.config import settings
from app.schemas.schemas import MachineStatus, AnomalyContributionOut

logger = logging.getLogger(__name__)

# Signals we monitor, with human-readable labels and units
MONITORED_SIGNALS: list[dict] = [
    {"key": "current_a",      "label": "Current draw",  "unit": "A"},
    {"key": "vibration_mm_s", "label": "Vibration",     "unit": "mm/s"},
    {"key": "temp_c",         "label": "Temperature",   "unit": "°C"},
    {"key": "rpm",            "label": "Shaft speed",   "unit": "RPM"},
    {"key": "voltage_v",      "label": "Supply voltage","unit": "V"},
]

# Iglewicz & Hoaglin scaling constant for modified z-score.
# 0.6745 = scipy.stats.norm.ppf(0.75) — the 75th percentile of a standard normal.
# Modified z = 0.6745 * (x − median) / MAD reproduces the ordinary z-score when
# the data is exactly normal, while being resistant to individual outliers.
_MAD_K = 0.6745


class RollingBaseline:
    """
    Maintains a rolling window of readings for one machine and computes
    per-signal robust statistics (median + MAD).

    Alert logic:
      1. Statistics (median, MAD) are computed from the rolling buffer using
         numpy — resistant to occasional outlier spikes because median/MAD are
         breakdown-point-50% estimators.
      2. Each signal carries two independent exceedance counters
         (_above_warning_streak, _above_critical_streak).
         On a threshold crossing: counter increments by 1.
         On recovery (signal within bounds): counter decrements by 1, floored at 0.
         This is intentionally softer than a hard reset: an intermittent fault
         pattern (bad reading, good reading, bad reading …) accumulates toward
         the alert threshold rather than being wiped out by each good sample.
         A sustained healthy run will still drain the counter all the way to 0
         because the counter can never go below 0.
      3. An alert is raised for a signal only after the counter reaches
         DEBOUNCE_COUNT.  At 3 s/reading and debounce=5, a persistent fault
         fires in ~15 s; an alternating bad/good pattern fires in ~30 s.

    Thread-safe for single-process asyncio use.
    """

    def __init__(
        self,
        window: int = 300,
        min_samples: int = 60,
        warning_z: float = 2.5,
        critical_z: float = 4.0,
        debounce_count: int = 5,
    ) -> None:
        self._window = window
        self._min_samples = min_samples
        self._warning_z = warning_z
        self._critical_z = critical_z
        # DEBOUNCE_COUNT: how many readings above threshold the counter must
        # accumulate before an alert fires.  The counter increments on every
        # exceedance and decrements by 1 (floor 0) on every in-bounds reading —
        # so a persistent fault saturates it in DEBOUNCE_COUNT readings, while
        # a burst of N bad readings followed by M good readings leaves a residual
        # of max(0, N - M) ready for the next burst to continue building on.
        # Tune this to balance responsiveness vs. false-alarm rate.
        # At 3 s/reading: debounce=5 → ~15 s lag for a persistent fault.
        self._debounce_count = debounce_count
        self._buffers: Dict[str, Deque[float]] = {
            sig["key"]: deque(maxlen=window) for sig in MONITORED_SIGNALS
        }
        # Per-signal exceedance counters.  Increment on threshold crossing,
        # decrement-by-1 (floor 0) on recovery.  See class docstring for rationale.
        self._above_warning_streak: Dict[str, int] = {
            sig["key"]: 0 for sig in MONITORED_SIGNALS
        }
        self._above_critical_streak: Dict[str, int] = {
            sig["key"]: 0 for sig in MONITORED_SIGNALS
        }
        self._sample_count = 0

    def add(self, reading: dict) -> None:
        """Add a new reading to the rolling window."""
        for sig in MONITORED_SIGNALS:
            val = reading.get(sig["key"])
            if val is not None:
                self._buffers[sig["key"]].append(float(val))
        self._sample_count += 1

    @property
    def ready(self) -> bool:
        return self._sample_count >= self._min_samples

    @property
    def sample_count(self) -> int:
        return self._sample_count

    def stats(self) -> Dict[str, Dict[str, float]]:
        """
        Return robust per-signal baseline statistics.

        Returns median and MAD (Median Absolute Deviation).
        Falls back to mean/std labelling for callers that only read ['mean']/['std']
        but the values are actually median/MAD — the key names are kept for
        backward API compat with estimate_rul() and tests.
        """
        result = {}
        for sig in MONITORED_SIGNALS:
            arr = np.array(self._buffers[sig["key"]])
            if len(arr) < 2:
                result[sig["key"]] = {"mean": 0.0, "std": 1.0}
            else:
                median = float(np.median(arr))
                mad = float(np.median(np.abs(arr - median)))
                # Avoid division by zero: if MAD == 0 (all samples identical),
                # use 1e-6 so z-scores are computed but are near-infinity for
                # genuine deviations from a perfectly-flat baseline.
                result[sig["key"]] = {
                    "mean": median,          # NOTE: this IS the median, not arithmetic mean
                    "std":  max(mad, 1e-6),  # NOTE: this IS the MAD, not standard deviation
                }
        return result

    def _modified_z(self, actual: float, median: float, mad: float) -> float:
        """
        Iglewicz & Hoaglin modified z-score.
        Equivalent to the ordinary z-score for Gaussian data; resistant to outliers.
        """
        return _MAD_K * (actual - median) / max(mad, 1e-6)

    def evaluate(self, reading: dict) -> tuple[MachineStatus, list[AnomalyContributionOut], str | None]:
        """
        Evaluate a reading against the current baseline.

        Returns:
            (status, contributions, plain_language_reason)

        If not enough data yet, returns (normal, [], None).

        Alert firing logic:
          - Computes modified z-score for each signal.
          - Updates per-signal exceedance counter:
              above threshold  → counter += 1
              within bounds    → counter = max(0, counter - 1)   ← decrement, not zero
          - Emits an alert contribution for a signal only if its counter
            has reached self._debounce_count.
          - Once a counter reaches debounce_count it stays there until enough
            consecutive in-bounds readings bring it back to 0.
        """
        if not self.ready:
            return MachineStatus.normal, [], None

        baseline = self.stats()
        contributions: list[AnomalyContributionOut] = []
        worst_status = MachineStatus.normal

        for sig in MONITORED_SIGNALS:
            key = sig["key"]
            actual = reading.get(key)
            if actual is None:
                continue

            median = baseline[key]["mean"]   # actually median — see stats() note
            mad    = baseline[key]["std"]    # actually MAD — see stats() note
            z      = self._modified_z(float(actual), median, mad)

            # ── Exceedance counter update (decrement-on-recovery) ─────────────
            if abs(z) >= self._critical_z:
                self._above_critical_streak[key] = min(
                    self._above_critical_streak[key] + 1, self._debounce_count + 10
                )
                self._above_warning_streak[key] = min(
                    self._above_warning_streak[key] + 1, self._debounce_count + 10
                )
            elif abs(z) >= self._warning_z:
                # Fell back below critical — decrement critical streak
                self._above_critical_streak[key] = max(0, self._above_critical_streak[key] - 1)
                self._above_warning_streak[key] = min(
                    self._above_warning_streak[key] + 1, self._debounce_count + 10
                )
            else:
                # Signal is within normal bounds — decrement both streaks by 1
                self._above_warning_streak[key]  = max(0, self._above_warning_streak[key] - 1)
                self._above_critical_streak[key] = max(0, self._above_critical_streak[key] - 1)

            # ── Decide whether to fire an alert for this signal ──────────────
            # We fire the highest applicable level for which debounce is satisfied.
            fire_critical = (
                self._above_critical_streak[key] >= self._debounce_count
            )
            fire_warning = (
                self._above_warning_streak[key] >= self._debounce_count
            )

            if fire_critical:
                worst_status = MachineStatus.critical
            elif fire_warning:
                if worst_status == MachineStatus.normal:
                    worst_status = MachineStatus.warning
            else:
                continue  # streak not yet reached debounce threshold

            contributions.append(AnomalyContributionOut(
                signal=key,
                label=sig["label"],
                actual=round(float(actual), 3),
                baseline_mean=round(median, 3),
                baseline_std=round(mad, 3),
                z_score=round(z, 2),
                unit=sig["unit"],
            ))

        # Sort by severity (highest |z| first) for readability
        contributions.sort(key=lambda c: abs(c.z_score), reverse=True)

        reason = _build_reason(contributions) if contributions else None
        return worst_status, contributions, reason


def _build_reason(contributions: list[AnomalyContributionOut]) -> str:
    """
    Build a plain-language alert reason from signal contributions.
    F6 requirement: every alert must state which signal caused it and by how much.
    No bare flags — a human must be able to understand this without the UI context.
    """
    parts = []
    for c in contributions:
        direction = "above" if c.z_score > 0 else "below"
        magnitude = abs(c.z_score)
        severity  = f"well {direction}" if magnitude >= 4.0 else f"{direction}" if magnitude >= 2.5 else f"slightly {direction}"
        parts.append(
            f"{c.label} is {severity} its normal range "
            f"({c.actual:.2f} {c.unit} vs baseline {c.baseline_mean:.2f} {c.unit}, "
            f"{magnitude:.1f} standard deviations {direction} normal)."
        )
    return " ".join(parts)


class RulEstimate(NamedTuple):
    """
    Return type of estimate_rul.

    Fields:
      days          — estimated days to next service interval, or None before
                      baseline is ready.  Floors at RUL_FLOOR_DAYS (default 5)
                      once the machine enters the high-risk zone.

      severity_pct  — a continuous 0–100 severity score that keeps growing
                      beyond the floor, so operators can distinguish
                      "just past the service threshold" (e.g. 60%) from
                      "far past it" (e.g. 95%).  None before baseline is ready.
                      Maps: effective_z = 0 → 0 %, effective_z >= SEVERITY_MAX_Z → 100 %.
                      Callers should round to 1 decimal place for display.
    """
    days:         int   | None
    severity_pct: float | None


# Effective-z at which severity_pct reaches 100 % (used for the severity curve).
# z=10 is well into the "machine is actively failing" zone and gives a smooth 0–100
# scale that covers all practically useful points on the degradation curve.
_SEVERITY_MAX_Z = 10.0

# Days-remaining floor — when the machine enters high-risk territory (effective_z >= 6)
# the displayed countdown stops at this value so we don't mislead with "0 days."
_RUL_FLOOR_DAYS = 5


def estimate_rul(
    baseline: RollingBaseline,
    reading: dict,
    contributions: list[AnomalyContributionOut],
) -> RulEstimate:
    """
    F7 (Should): Simple remaining-useful-life estimate.
    Returns RulEstimate(days=None, severity_pct=None) until baseline is ready.

    Returns:
        RulEstimate.days         — int countdown to service (floors at _RUL_FLOOR_DAYS)
        RulEstimate.severity_pct — float 0–100 beyond-floor severity indicator

    Method:
      - Compute effective_z: worst of the fired alert z-scores and the sub-alert
        vibration+temperature trend, using the same MAD-based modified z-score.
      - Map effective_z → days via piecewise linear decay.
      - Map effective_z → severity_pct via a continuous 0–100 % curve that
        never stops growing, even after days hits the floor.
    """
    if not baseline.ready:
        return RulEstimate(days=None, severity_pct=None)

    worst_anomaly_z = max((abs(c.z_score) for c in contributions), default=0.0)

    # Calculate sub-alert degradation from vibration and temp using MAD z-scores
    stats = baseline.stats()
    vib_z = 0.0
    if "vibration_mm_s" in reading:
        vib_median = stats["vibration_mm_s"]["mean"]   # median (see stats() note)
        vib_mad    = stats["vibration_mm_s"]["std"]    # MAD (see stats() note)
        vib_z = max(0, baseline._modified_z(float(reading["vibration_mm_s"]), vib_median, vib_mad))

    temp_z = 0.0
    if "temp_c" in reading:
        temp_median = stats["temp_c"]["mean"]   # median
        temp_mad    = stats["temp_c"]["std"]    # MAD
        temp_z = max(0, baseline._modified_z(float(reading["temp_c"]), temp_median, temp_mad))

    # Combine: use the worse of the fired anomaly z and the sub-alert trend
    effective_z = max(worst_anomaly_z, (vib_z + temp_z) / 2.0)

    # ── Days remaining — piecewise linear decay ───────────────────────────────
    #   z = 0      → 90 days (nominal service interval)
    #   z = 4      → 30 days (enter elevated-risk zone)
    #   z = 6      →  5 days (approach service limit → floor)
    #   z >= 6     →  5 days (floor — machine should be serviced)
    if effective_z >= 6.0:
        days = _RUL_FLOOR_DAYS
    elif effective_z >= 4.0:
        days = max(_RUL_FLOOR_DAYS, int(30 - (effective_z - 4.0) * 12.5))
    elif effective_z > 0.0:
        days = max(30, int(90 - effective_z * 15))
    else:
        days = 90

    # ── Severity percentage — continuous 0–100 %, never stops growing ─────────
    # Uses the same effective_z but is NOT clipped at the floor, so it
    # distinguishes "just reached the service limit" from "far past it."
    # Formula: linear 0 % at z=0 → 100 % at z=_SEVERITY_MAX_Z, capped at 100.
    severity_pct = round(min(100.0, (effective_z / _SEVERITY_MAX_Z) * 100.0), 1)

    return RulEstimate(days=days, severity_pct=severity_pct)


from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import SensorReading

# ─── Per-machine singleton registry ───────────────────────────────────────────

_baselines: Dict[str, RollingBaseline] = {}


async def get_baseline(db: AsyncSession, machine_id: str) -> RollingBaseline:
    if machine_id not in _baselines:
        baseline = RollingBaseline(
            window=settings.anomaly_baseline_window,
            min_samples=settings.anomaly_min_baseline_samples,
            warning_z=settings.anomaly_warning_z,
            critical_z=settings.anomaly_critical_z,
            debounce_count=settings.anomaly_debounce_count,
        )
        
        # Hydrate baseline from recent history so it survives server restarts
        result = await db.execute(
            select(SensorReading)
            .where(SensorReading.machine_id == machine_id)
            .order_by(SensorReading.timestamp.desc())
            .limit(baseline._window)
        )
        # Reverse to get chronological order (oldest to newest)
        readings = reversed(result.scalars().all())
        for r in readings:
            baseline.add({
                "current_a": r.current_a,
                "vibration_mm_s": r.vibration_mm_s,
                "temp_c": r.temp_c,
                "rpm": r.rpm,
                "voltage_v": r.voltage_v
            })
            
        _baselines[machine_id] = baseline
        
    return _baselines[machine_id]

