"""
Tests for anomaly_service.py

Requirements being tested:
  F4: Detects abnormal patterns against a learned healthy baseline
  F6: Returns which signal caused it and by how much
  F7: Returns RUL estimate (None until baseline ready)

Critical: zero false alerts during healthy run, and detection under 10s.
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
        bl = RollingBaseline(min_samples=10, warning_z=2.5)
        _populate_baseline(bl, 10)
        status, contribs, reason = bl.evaluate(_healthy_reading())
        assert status == MachineStatus.normal
        assert contribs == []
        assert reason is None

    def test_vibration_fault_detected(self):
        """Injecting vibration 5x normal should trigger an alert."""
        bl = RollingBaseline(min_samples=10, warning_z=2.5, critical_z=4.0)
        _populate_baseline(bl, 10)

        # Healthy std should be very small (all identical) — use a small std guard
        # RollingBaseline uses max(std, 1e-6), so std ~ 1e-6 for identical samples.
        # Any nonzero deviation will produce huge z. Inject clear fault.
        reading = _healthy_reading(vibration=10.0)  # way above baseline of 2.0
        status, contribs, reason = bl.evaluate(reading)

        assert status in (MachineStatus.warning, MachineStatus.critical)
        assert any(c.signal == "vibration_mm_s" for c in contribs)
        assert reason is not None
        assert "Vibration" in reason

    def test_temp_fault_detected(self):
        bl = RollingBaseline(min_samples=10, warning_z=2.5)
        _populate_baseline(bl, 10)
        reading = _healthy_reading(temp=120.0)
        status, contribs, reason = bl.evaluate(reading)
        assert status != MachineStatus.normal
        assert any(c.signal == "temp_c" for c in contribs)

    def test_current_fault_detected(self):
        bl = RollingBaseline(min_samples=10, warning_z=2.5)
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
        bl = RollingBaseline(min_samples=10, warning_z=2.5)
        _populate_baseline(bl, 10)
        reading = _healthy_reading(vibration=10.0, temp=120.0)
        _, contribs, _ = bl.evaluate(reading)
        if len(contribs) >= 2:
            assert abs(contribs[0].z_score) >= abs(contribs[1].z_score)

    def test_rolling_window_evicts_old(self):
        """After window_size readings, old data is evicted."""
        bl = RollingBaseline(window=50, min_samples=10)
        _populate_baseline(bl, 50)
        # Now add noise to shift the baseline
        for _ in range(50):
            bl.add(_healthy_reading(current=20.0))
        stats = bl.stats()
        # Baseline mean should have shifted toward 20.0
        assert stats["current_a"]["mean"] > 12.0


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
