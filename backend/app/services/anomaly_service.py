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
  - Requires ANOMALY_DEBOUNCE_COUNT consecutive readings beyond the threshold
    before raising an alert.  This prevents single-sensor transients (electrical
    interference, nearby vibration, brief voltage sags) from firing false warnings.
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
from typing import Deque, Dict, Optional

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
      2. Each signal carries an independent consecutive-exceedance counter.
         A counter increments when the modified z-score exceeds the threshold
         and resets to 0 the moment the signal returns within bounds.
      3. An alert is raised for a signal only after the counter reaches
         DEBOUNCE_COUNT.  This means N consecutive readings (not just one)
         must all exceed the threshold before the operator sees anything.

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
        # DEBOUNCE_COUNT: how many *consecutive* readings above threshold before
        # an alert fires.  Tune this constant to balance responsiveness vs.
        # false-alarm rate.  At 3 s/reading, debounce=5 means ~15 s lag to
        # first alert on a genuine persistent fault — acceptable for this use case.
        self._debounce_count = debounce_count
        self._buffers: Dict[str, Deque[float]] = {
            sig["key"]: deque(maxlen=window) for sig in MONITORED_SIGNALS
        }
        # Per-signal consecutive-exceedance counters (reset on return to normal)
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
          - Updates per-signal consecutive-exceedance counter.
          - Emits an alert contribution for a signal only if its counter
            has reached self._debounce_count.
          - Counters reset to 0 when a signal returns within bounds.
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

            # ── Debounce / consecutive-exceedance logic ──────────────────────
            # Increment streak counters if threshold crossed, reset if within bounds.
            if abs(z) >= self._critical_z:
                self._above_critical_streak[key] += 1
                self._above_warning_streak[key]  += 1
            elif abs(z) >= self._warning_z:
                self._above_critical_streak[key]  = 0  # fell back below critical
                self._above_warning_streak[key]  += 1
            else:
                # Signal is within normal bounds — reset both streaks
                self._above_warning_streak[key]  = 0
                self._above_critical_streak[key] = 0

            # ── Decide whether to fire an alert for this signal ──────────────
            # We fire the highest applicable level for which debounce is satisfied.
            fire_critical = (
                self._above_critical_streak[key] >= self._debounce_count
            )
            fire_warning = (
                self._above_warning_streak[key] >= self._debounce_count
            )

            if fire_critical:
                level = MachineStatus.critical
                worst_status = MachineStatus.critical
            elif fire_warning:
                level = MachineStatus.warning
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


def estimate_rul(baseline: RollingBaseline, reading: dict, contributions: list[AnomalyContributionOut]) -> int | None:
    """
    F7 (Should): Simple remaining-useful-life estimate.
    Returns None until enough baseline data exists — never fabricates a number.

    Method:
      - Start from a nominal service interval (90 days baseline assumption).
      - Reduce proportionally to the severity of the worst anomaly signal.
      - Also reduce based on sub-alert trend in vibration and temperature,
        using the same MAD-based modified z-score as the detector.
    """
    if not baseline.ready:
        return None  # explicitly null until baseline is established

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

    # Smooth piecewise-linear decay:
    #   z = 0      → 90 days (nominal service interval)
    #   z = 4      → 30 days (enter elevated-risk zone)
    #   z = 6      →  5 days (approach service limit)
    #   z >= 6     →  5 days (floor)
    if effective_z >= 6.0:
        return 5
    elif effective_z >= 4.0:
        return max(5, int(30 - (effective_z - 4.0) * 12.5))
    elif effective_z > 0.0:
        return max(30, int(90 - effective_z * 15))
    return 90


# ─── Per-machine singleton registry ───────────────────────────────────────────

_baselines: Dict[str, RollingBaseline] = {}


def get_baseline(machine_id: str) -> RollingBaseline:
    if machine_id not in _baselines:
        _baselines[machine_id] = RollingBaseline(
            window=settings.anomaly_baseline_window,
            min_samples=settings.anomaly_min_baseline_samples,
            warning_z=settings.anomaly_warning_z,
            critical_z=settings.anomaly_critical_z,
            debounce_count=settings.anomaly_debounce_count,
        )
    return _baselines[machine_id]
