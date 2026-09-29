"""
Anomaly detection service — unsupervised, baseline-deviation approach.

Design:
  - Requires no labeled fault data (F4: Must).
  - Uses a rolling window of recent healthy readings to compute a baseline
    mean and standard deviation for each signal.
  - Compares each new reading to its baseline using a z-score.
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


class RollingBaseline:
    """
    Maintains a rolling window of readings for one machine and computes
    per-signal mean and std. Thread-safe for single-process asyncio use.
    """

    def __init__(
        self,
        window: int = 300,
        min_samples: int = 60,
        warning_z: float = 2.5,
        critical_z: float = 4.0,
    ) -> None:
        self._window = window
        self._min_samples = min_samples
        self._warning_z = warning_z
        self._critical_z = critical_z
        self._buffers: Dict[str, Deque[float]] = {
            sig["key"]: deque(maxlen=window) for sig in MONITORED_SIGNALS
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
        result = {}
        for sig in MONITORED_SIGNALS:
            arr = np.array(self._buffers[sig["key"]])
            if len(arr) < 2:
                result[sig["key"]] = {"mean": 0.0, "std": 1.0}
            else:
                std = float(np.std(arr, ddof=1))
                result[sig["key"]] = {
                    "mean": float(np.mean(arr)),
                    "std":  max(std, 1e-6),  # avoid division by zero
                }
        return result

    def evaluate(self, reading: dict) -> tuple[MachineStatus, list[AnomalyContributionOut], str | None]:
        """
        Evaluate a reading against the current baseline.

        Returns:
            (status, contributions, plain_language_reason)

        If not enough data yet, returns (normal, [], None).
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

            mean = baseline[key]["mean"]
            std  = baseline[key]["std"]
            z    = (float(actual) - mean) / std

            if abs(z) >= self._warning_z:
                level = MachineStatus.critical if abs(z) >= self._critical_z else MachineStatus.warning
                if level == MachineStatus.critical:
                    worst_status = MachineStatus.critical
                elif worst_status == MachineStatus.normal:
                    worst_status = MachineStatus.warning

                contributions.append(AnomalyContributionOut(
                    signal=key,
                    label=sig["label"],
                    actual=round(float(actual), 3),
                    baseline_mean=round(mean, 3),
                    baseline_std=round(std, 3),
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
        severity  = "well above" if magnitude >= 4.0 else "above" if magnitude >= 2.5 else "slightly above"
        parts.append(
            f"{c.label} is {severity} its normal range "
            f"({c.actual:.2f} {c.unit} vs baseline {c.baseline_mean:.2f} {c.unit}, "
            f"{magnitude:.1f} standard deviations {direction} normal)."
        )
    return " ".join(parts)


def estimate_rul(baseline: RollingBaseline, contributions: list[AnomalyContributionOut]) -> int | None:
    """
    F7 (Should): Simple remaining-useful-life estimate.
    Returns None until enough baseline data exists — never fabricates a number.

    Method:
      - Start from a nominal service interval (90 days baseline assumption).
      - Reduce proportionally to the severity of the worst anomaly signal.
      - This is an approximation with no pretense of certified accuracy.
        It is marked as an estimate in all UI copy.
    """
    if not baseline.ready:
        return None  # explicitly null until baseline is established

    if not contributions:
        return 90   # no anomalies detected: full nominal interval

    worst_z = max(abs(c.z_score) for c in contributions)
    # Linear degradation: at z=2.5 -> 60d, at z=4 -> 30d, at z>=6 -> 5d
    if worst_z >= 6.0:
        return 5
    elif worst_z >= 4.0:
        return max(5, int(30 - (worst_z - 4.0) * 10))
    elif worst_z >= 2.5:
        return max(15, int(60 - (worst_z - 2.5) * 20))
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
        )
    return _baselines[machine_id]
