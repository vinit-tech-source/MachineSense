"""
Tests for anomaly_service.py

Requirements being tested:
  F4: Detects abnormal patterns against a learned healthy baseline
  F6: Returns which signal caused it and by how much
  F7: Returns RUL estimate (None until baseline ready)

Critical invariants:
  - Zero false alerts during a healthy run with realistic (Gaussian) noise
  - Genuine persistent faults detected within debounce_count readings
  - A single transient spike must NOT fire an alert (debounce logic)
  - Intermittent faults (alternating bad/good) must eventually trigger where
    hard-reset logic would not
  - Alert direction text ("above"/"below") must match the actual deviation direction
  - RulEstimate.severity_pct is continuous beyond the days floor
"""
import pytest
from app.services.anomaly_service import (
    RollingBaseline, estimate_rul, _build_reason, RulEstimate,
)
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

        # Immediately followed by a normal reading — streak decrements to 0
        status, contribs, reason = bl.evaluate(_healthy_reading())
        assert status == MachineStatus.normal, (
            "A single spike followed by normal must not fire after decrement"
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

    def test_streak_decrements_on_recovery_not_resets(self):
        """
        A normal reading decrements the streak by 1, not zero.
        After building streak to N-1 and then getting one good reading,
        the streak should be N-2 (not 0), so the next fault reading brings
        it to N-1 again.
        """
        N = 4
        bl = RollingBaseline(min_samples=10, warning_z=2.5, debounce_count=N)
        _populate_baseline(bl, 10)

        fault = _healthy_reading(vibration=10.0)
        normal = _healthy_reading()

        # Build up streak to N-1
        for _ in range(N - 1):
            bl.evaluate(fault)
        # After N-1 faults, vibration streak should be N-1
        assert bl._above_warning_streak["vibration_mm_s"] == N - 1

        # One normal reading → streak decrements to N-2 (not 0)
        bl.evaluate(normal)
        assert bl._above_warning_streak["vibration_mm_s"] == N - 2, (
            f"Expected streak {N-2} after one recovery, got "
            f"{bl._above_warning_streak['vibration_mm_s']}"
        )

    def test_intermittent_fault_eventually_triggers(self):
        """
        An alternating bad/good pattern must eventually trigger an alert.

        With the old hard-reset logic, bad→good→bad→good→… would never build
        the streak (good reading zeroed it).  With decrement-by-1 logic, each
        bad reading adds 1 and each good reading subtracts 1.  If the pattern is
        perfectly alternating (net +0 per pair), it never fires — which is correct.

        The realistic intermittent pattern is 2 bad / 1 good (net +1 per triplet),
        which eventually accumulates to the threshold.

        debounce_count=4, pattern [fault, fault, normal] repeating:
          net per triplet = +2 - 1 = +1
          → threshold reached after 4 triplets = 12 readings
        """
        N = 4
        bl = RollingBaseline(min_samples=10, warning_z=2.5, debounce_count=N)
        _populate_baseline(bl, 10)

        fault  = _healthy_reading(vibration=10.0)
        normal = _healthy_reading()

        fired = False
        # Run up to 30 readings to give enough room for the pattern to accumulate
        for i in range(30):
            reading = fault if i % 3 != 2 else normal  # pattern: fault, fault, normal
            status, contribs, _ = bl.evaluate(reading)
            if status != MachineStatus.normal:
                fired = True
                break

        assert fired, (
            "Intermittent fault pattern (2 bad / 1 good) must eventually trigger "
            "with decrement-by-1 debounce logic"
        )
        assert any(c.signal == "vibration_mm_s" for c in contribs)

    def test_pure_alternating_pattern_does_not_fire(self):
        """
        A perfectly alternating bad/good/bad/good pattern (net 0 per pair)
        must NOT fire — the counter oscillates between 0 and 1 and never
        reaches debounce_count > 1.
        """
        bl = RollingBaseline(min_samples=10, warning_z=2.5, debounce_count=3)
        _populate_baseline(bl, 10)

        fault  = _healthy_reading(vibration=10.0)
        normal = _healthy_reading()

        for i in range(20):
            reading = fault if i % 2 == 0 else normal
            status, _, _ = bl.evaluate(reading)

        # After 20 perfectly alternating readings, streak should be 0 or 1
        assert bl._above_warning_streak["vibration_mm_s"] <= 1

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
        assert isinstance(rul, RulEstimate)
        assert rul.days is None
        assert rul.severity_pct is None

    def test_90_days_and_zero_severity_when_no_anomalies(self):
        bl = RollingBaseline(min_samples=10)
        _populate_baseline(bl, 10)
        rul = estimate_rul(bl, _healthy_reading(), [])
        assert rul.days == 90
        assert rul.severity_pct == 0.0

    def test_reduced_days_on_high_z(self):
        bl = RollingBaseline(min_samples=10)
        _populate_baseline(bl, 10)

        contrib = AnomalyContributionOut(
            signal="vibration_mm_s", label="Vibration",
            actual=10.0, baseline_mean=2.0, baseline_std=0.2,
            z_score=5.0, unit="mm/s",
        )
        rul = estimate_rul(bl, _healthy_reading(vibration=10.0), [contrib])
        assert rul.days is not None
        assert rul.days < 90
        assert rul.days >= 5

    def test_critical_z_gives_minimal_days(self):
        bl = RollingBaseline(min_samples=10)
        _populate_baseline(bl, 10)

        contrib = AnomalyContributionOut(
            signal="vibration_mm_s", label="Vibration",
            actual=50.0, baseline_mean=2.0, baseline_std=0.2,
            z_score=12.0, unit="mm/s",
        )
        rul = estimate_rul(bl, _healthy_reading(vibration=50.0), [contrib])
        assert rul.days == 5

    def test_severity_pct_continues_beyond_days_floor(self):
        """
        When effective_z is high enough to hit the days floor, severity_pct
        must keep growing beyond it, distinguishing severity levels that days
        can no longer distinguish.

        Both z=6 and z=8 are at or past the days floor (effective_z >= 6 → 5 days),
        but severity_pct must be higher for z=8 than z=6 because it maps linearly
        to SEVERITY_MAX_Z=10 without capping.
        """
        bl = RollingBaseline(min_samples=10)
        _populate_baseline(bl, 10)

        # z=8 contrib — past days floor, high severity
        contrib_high = AnomalyContributionOut(
            signal="vibration_mm_s", label="Vibration",
            actual=30.0, baseline_mean=2.0, baseline_std=0.2,
            z_score=8.0, unit="mm/s",
        )
        # z=6 contrib — just at the floor boundary
        contrib_floor = AnomalyContributionOut(
            signal="vibration_mm_s", label="Vibration",
            actual=20.0, baseline_mean=2.0, baseline_std=0.2,
            z_score=6.0, unit="mm/s",
        )

        rul_high  = estimate_rul(bl, _healthy_reading(vibration=2.0), [contrib_high])
        rul_floor = estimate_rul(bl, _healthy_reading(vibration=2.0), [contrib_floor])

        # Both should be at the days floor
        assert rul_high.days == 5
        assert rul_floor.days == 5

        # But severity_pct must distinguish them
        assert rul_high.severity_pct is not None
        assert rul_floor.severity_pct is not None
        assert rul_high.severity_pct > rul_floor.severity_pct, (
            f"z=8 severity ({rul_high.severity_pct}%) should be greater "
            f"than z=6 severity ({rul_floor.severity_pct}%)"
        )

    def test_severity_pct_capped_at_100(self):
        """severity_pct must never exceed 100.0."""
        bl = RollingBaseline(min_samples=10)
        _populate_baseline(bl, 10)

        contrib = AnomalyContributionOut(
            signal="vibration_mm_s", label="Vibration",
            actual=9999.0, baseline_mean=2.0, baseline_std=0.2,
            z_score=10000.0, unit="mm/s",
        )
        rul = estimate_rul(bl, _healthy_reading(vibration=9999.0), [contrib])
        assert rul.severity_pct is not None
        assert rul.severity_pct <= 100.0

    def test_severity_pct_increases_with_z(self):
        """severity_pct must be monotonically non-decreasing as z increases."""
        bl = RollingBaseline(min_samples=10)
        _populate_baseline(bl, 10)

        z_values = [0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0]
        severities = []
        for z in z_values:
            contrib = AnomalyContributionOut(
                signal="vibration_mm_s", label="Vibration",
                actual=2.0 + z * 0.2, baseline_mean=2.0, baseline_std=0.2,
                z_score=z, unit="mm/s",
            )
            contribs = [contrib] if z > 0 else []
            rul = estimate_rul(bl, _healthy_reading(vibration=2.0 + z * 0.2), contribs)
            severities.append(rul.severity_pct)

        for i in range(1, len(severities)):
            assert severities[i] >= severities[i - 1], (
                f"severity_pct decreased at z={z_values[i]}: "
                f"{severities[i-1]} → {severities[i]}"
            )

    def test_rul_decay_is_monotone_on_worsening_trend(self):
        """
        Step 4 verification: slowly worsening vibration+temp must produce a
        monotonically non-increasing RUL sequence.

        We build the baseline with realistically noisy (but healthy) readings,
        then evaluate degrading readings WITHOUT feeding them back in.  This
        mirrors real-world behaviour: the machine degrades after a healthy
        calibration period, and the rolling window still reflects healthy history.
        """
        import random as _random
        _random.seed(42)  # deterministic for the test

        bl = RollingBaseline(min_samples=60)
        # Build baseline with realistic Gaussian noise so MAD is non-zero
        for _ in range(200):
            bl.add({
                "current_a":      _random.gauss(10.5, 0.3),
                "voltage_v":      _random.gauss(230.0, 1.5),
                "vibration_mm_s": _random.gauss(2.1, 0.2),
                "temp_c":         _random.gauss(65.0, 0.5),
                "rpm":            _random.gauss(1450.0, 10.0),
            })

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
            results.append(rul.days)
            # Do NOT add reading to baseline — baseline stays anchored to healthy period

        # Must be monotonically non-increasing (worsening readings → shorter RUL)
        for i in range(1, len(results)):
            assert results[i] <= results[i - 1], (
                f"RUL increased at step {i}: {results[i-1]} → {results[i]} "
                f"(not monotone with frozen healthy baseline)"
            )

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
