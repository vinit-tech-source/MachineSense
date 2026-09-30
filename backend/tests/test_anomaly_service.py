"""
Tests for anomaly_service.py

Requirements being tested:
  F4: Detects abnormal patterns against a learned healthy baseline
  F6: Returns which signal caused it and by how much
  F7: Returns RUL estimate (None until baseline ready)

Critical invariants:
  - Zero false alerts during a healthy run with realistic (Gaussian) noise
  - Genuine persistent faults detected within debounce_count + 1 readings
  - A single transient spike must NOT fire an alert (debounce logic)
  - Alert direction text ("above"/"below") must match the actual deviation direction
"""
import pytest
from app.services.anomaly_service import RollingBaseline, estimate_rul, _build_reason
from app.schemas.schemas import MachineStatus, AnomalyContributionOut


def _healthy_reading(
    current=10.0, voltage=230.0, vibration=2.0, temp=65.0, rpm=1450.0
) -> dict:
    return {
        "current_a":      current,
        "voltage_v":      voltage,
        "vibration_mm_s": vibration,
        "temp_c":         temp,
        "rpm":            rpm,
    }


def _populate_baseline(baseline: RollingBaseline, n: int = 100) -> None:
    """Feed n identical healthy readings to build a stable baseline."""
    for _ in range(n):
        baseline.add(_healthy_reading())


class TestRollingBaseline:
    def test_not_ready_before_min_samples(self):
        bl = RollingBaseline(min_samples=60)
        for _ in range(59):
            bl.add(_healthy_reading())
        assert not bl.ready

    def test_ready_after_min_samples(self):
        bl = RollingBaseline(min_samples=60)
        _populate_baseline(bl, 60)
        assert bl.ready

    def test_normal_reading_no_alert(self):
        """A single healthy reading must never trigger an alert regardless of debounce."""
        bl = RollingBaseline(min_samples=10, warning_z=2.5, debounce_count=1)
        _populate_baseline(bl, 10)
        status, contribs, reason = bl.evaluate(_healthy_reading())
        assert status == MachineStatus.normal
        assert contribs == []
        assert reason is None

    def test_vibration_fault_detected_after_debounce(self):
        """
        A persistent fault must fire after debounce_count consecutive exceedances.
        debounce_count=1 means it fires on the very first exceedance.
        """
        bl = RollingBaseline(min_samples=10, warning_z=2.5, critical_z=4.0, debounce_count=1)
        _populate_baseline(bl, 10)

        # Healthy std is ~1e-6 (all identical samples), so any real deviation is huge z.
        reading = _healthy_reading(vibration=10.0)  # far above baseline of 2.0
        status, contribs, reason = bl.evaluate(reading)

        assert status in (MachineStatus.warning, MachineStatus.critical)
        assert any(c.signal == "vibration_mm_s" for c in contribs)
        assert reason is not None
        assert "Vibration" in reason

    def test_single_spike_does_not_fire_with_debounce(self):
        """
        A single above-threshold reading followed by a normal reading must NOT
        fire an alert when debounce_count > 1. This is the core false-alert test.
        """
        bl = RollingBaseline(min_samples=10, warning_z=2.5, debounce_count=3)
        _populate_baseline(bl, 10)

        # One spike — streak = 1, below debounce_count=3
        bl.evaluate(_healthy_reading(vibration=10.0))  # streak: vib=1

        # Immediately followed by a normal reading — streak resets to 0
        status, contribs, reason = bl.evaluate(_healthy_reading())
        assert status == MachineStatus.normal, (
            "A single spike followed by normal must not fire after reset"
        )

    def test_persistent_fault_fires_after_N_consecutive(self):
        """
        N consecutive readings above threshold must fire on reading number N.
        N-1 readings must NOT yet fire.
        """
        N = 4
        bl = RollingBaseline(min_samples=10, warning_z=2.5, debounce_count=N)
        _populate_baseline(bl, 10)

        fault_reading = _healthy_reading(vibration=10.0)

        # First N-1 evaluations must stay silent
        for i in range(N - 1):
            status, _, _ = bl.evaluate(fault_reading)
            assert status == MachineStatus.normal, (
                f"Should not alert on reading {i+1} of {N} (debounce not yet reached)"
            )

        # N-th consecutive evaluation must fire
        status, contribs, reason = bl.evaluate(fault_reading)
        assert status != MachineStatus.normal, (
            f"Should alert on reading {N} (debounce reached)"
        )
        assert any(c.signal == "vibration_mm_s" for c in contribs)

    def test_streak_resets_on_recovery(self):
        """
        After a spike partially builds a streak, a normal reading resets it.
        Subsequent spikes must rebuild from scratch.
        """
        N = 4
        bl = RollingBaseline(min_samples=10, warning_z=2.5, debounce_count=N)
        _populate_baseline(bl, 10)

        fault = _healthy_reading(vibration=10.0)
        normal = _healthy_reading()

        # Build up streak to N-1
        for _ in range(N - 1):
            bl.evaluate(fault)

        # One normal reading resets streak
        bl.evaluate(normal)

        # Next fault reading restarts streak — should NOT fire yet
        status, _, _ = bl.evaluate(fault)
        assert status == MachineStatus.normal, (
            "After streak reset, first re-exceedance must not immediately fire"
        )

    def test_temp_fault_detected(self):
        bl = RollingBaseline(min_samples=10, warning_z=2.5, debounce_count=1)
        _populate_baseline(bl, 10)
        reading = _healthy_reading(temp=120.0)
        status, contribs, reason = bl.evaluate(reading)
        assert status != MachineStatus.normal
        assert any(c.signal == "temp_c" for c in contribs)

    def test_current_fault_detected(self):
        bl = RollingBaseline(min_samples=10, warning_z=2.5, debounce_count=1)
        _populate_baseline(bl, 10)
        reading = _healthy_reading(current=50.0)
        status, contribs, reason = bl.evaluate(reading)
        assert status != MachineStatus.normal
        assert any(c.signal == "current_a" for c in contribs)

    def test_not_ready_returns_normal(self):
        """Baseline not yet ready: must return normal, not fire spurious alert."""
        bl = RollingBaseline(min_samples=60)
        for _ in range(5):
            bl.add(_healthy_reading())
        # Even with injected fault data, must return normal (no baseline yet)
        status, contribs, reason = bl.evaluate(_healthy_reading(vibration=999.0))
        assert status == MachineStatus.normal
        assert contribs == []

    def test_contributions_sorted_by_severity(self):
        """Most severe signal should be first in the contributions list."""
        bl = RollingBaseline(min_samples=10, warning_z=2.5, debounce_count=1)
        _populate_baseline(bl, 10)
        reading = _healthy_reading(vibration=10.0, temp=120.0)
        _, contribs, _ = bl.evaluate(reading)
        if len(contribs) >= 2:
            assert abs(contribs[0].z_score) >= abs(contribs[1].z_score)

    def test_rolling_window_evicts_old(self):
        """After window_size readings, old data is evicted."""
        bl = RollingBaseline(window=50, min_samples=10)
        _populate_baseline(bl, 50)
        # Now add data to shift the baseline median
        for _ in range(50):
            bl.add(_healthy_reading(current=20.0))
        stats = bl.stats()
        # Baseline median should have shifted toward 20.0
        assert stats["current_a"]["mean"] > 12.0

    def test_mad_baseline_robust_to_single_spike(self):
        """
        A single massive spike must not corrupt the MAD-based baseline median.
        This tests the core MAD robustness property.
        """
        bl = RollingBaseline(min_samples=10, warning_z=2.5)
        _populate_baseline(bl, 99)   # 99 healthy readings
        bl.add(_healthy_reading(vibration=500.0))  # one massive outlier
        stats = bl.stats()
        # Median should still be close to 2.0 (the healthy value)
        assert abs(stats["vibration_mm_s"]["mean"] - 2.0) < 0.5, (
            "MAD baseline median should be robust to a single outlier spike"
        )


class TestEstimateRul:
    def test_none_when_baseline_not_ready(self):
        bl = RollingBaseline(min_samples=60)
        rul = estimate_rul(bl, _healthy_reading(), [])
        assert rul is None

    def test_90_days_when_no_anomalies(self):
        bl = RollingBaseline(min_samples=10)
        _populate_baseline(bl, 10)
        rul = estimate_rul(bl, _healthy_reading(), [])
        assert rul == 90

    def test_reduced_days_on_high_z(self):
        bl = RollingBaseline(min_samples=10)
        _populate_baseline(bl, 10)

        contrib = AnomalyContributionOut(
            signal="vibration_mm_s", label="Vibration",
            actual=10.0, baseline_mean=2.0, baseline_std=0.2,
            z_score=5.0, unit="mm/s",
        )
        rul = estimate_rul(bl, _healthy_reading(vibration=10.0), [contrib])
        assert rul is not None
        assert rul < 90
        assert rul >= 5

    def test_critical_z_gives_minimal_days(self):
        bl = RollingBaseline(min_samples=10)
        _populate_baseline(bl, 10)

        contrib = AnomalyContributionOut(
            signal="vibration_mm_s", label="Vibration",
            actual=50.0, baseline_mean=2.0, baseline_std=0.2,
            z_score=12.0, unit="mm/s",
        )
        rul = estimate_rul(bl, _healthy_reading(vibration=50.0), [contrib])
        assert rul == 5

    def test_rul_decay_is_monotone_on_worsening_trend(self):
        """
        Step 4 verification: slowly worsening vibration+temp must produce a
        monotonically non-increasing RUL sequence.

        Note on baseline adaptation:
          We build the baseline with realistically noisy (but healthy) readings,
          then evaluate degrading readings WITHOUT feeding them back in.  This
          mirrors real-world behaviour: the machine degrades after a healthy
          calibration period, and the rolling window still reflects healthy history.
          We use varied baseline samples (not identical) so the MAD is non-zero
          and z-scores are finite, giving a meaningful decay curve.
        """
        import random as _random
        _random.seed(42)  # deterministic for the test

        bl = RollingBaseline(min_samples=60)
        # Build baseline with realistic Gaussian noise so MAD is non-zero
        for _ in range(200):  # use 200 to fill window well beyond min_samples
            bl.add({
                "current_a":      _random.gauss(10.5, 0.3),
                "voltage_v":      _random.gauss(230.0, 1.5),
                "vibration_mm_s": _random.gauss(2.1, 0.2),
                "temp_c":         _random.gauss(65.0, 0.5),
                "rpm":            _random.gauss(1450.0, 10.0),
            })

        # Now simulate slow degradation across 80 steps WITHOUT updating the baseline.
        # Vibration: 2.1 → 7.0 mm/s, Temperature: 65 → 80 °C
        results = []
        STEPS = 80
        for i in range(STEPS):
            frac = i / (STEPS - 1)
            vib = 2.1 + frac * 4.9    # 2.1 → 7.0
            temp = 65.0 + frac * 15.0  # 65 → 80
            reading = {
                "current_a":      10.5,
                "voltage_v":      230.0,
                "vibration_mm_s": vib,
                "temp_c":         temp,
                "rpm":            1450.0,
            }
            rul = estimate_rul(bl, reading, [])
            results.append(rul)
            # Do NOT add reading to baseline — baseline stays anchored to healthy period

        # Must be monotonically non-increasing (worsening readings → shorter RUL)
        for i in range(1, len(results)):
            assert results[i] <= results[i - 1], (
                f"RUL increased at step {i}: {results[i-1]} → {results[i]} "
                f"(not monotone with frozen healthy baseline)"
            )

        # Final RUL must be meaningfully lower than starting RUL
        assert results[-1] < results[0], (
            f"RUL should decrease over a worsening trend: "
            f"start={results[0]}, end={results[-1]}"
        )


class TestBuildReason:
    def test_reason_mentions_signal_label(self):
        contrib = AnomalyContributionOut(
            signal="vibration_mm_s", label="Vibration",
            actual=10.0, baseline_mean=2.0, baseline_std=0.2,
            z_score=4.5, unit="mm/s",
        )
        reason = _build_reason([contrib])
        assert "Vibration" in reason
        assert "10.00 mm/s" in reason
        assert "2.00 mm/s" in reason

    def test_reason_includes_direction_above(self):
        contrib = AnomalyContributionOut(
            signal="temp_c", label="Temperature",
            actual=120.0, baseline_mean=65.0, baseline_std=1.0,
            z_score=55.0, unit="°C",
        )
        reason = _build_reason([contrib])
        assert "above" in reason
        assert "below" not in reason

    def test_reason_includes_direction_below(self):
        contrib = AnomalyContributionOut(
            signal="rpm", label="Shaft speed",
            actual=1405.0, baseline_mean=1463.0, baseline_std=10.0,
            z_score=-5.8, unit="RPM",
        )
        reason = _build_reason([contrib])
        assert "below" in reason
        assert "above" not in reason

    def test_empty_contributions_returns_empty(self):
        assert _build_reason([]) == ""
