"""
Tests for power_service.py

These calculations affect billed cost for an industrial customer.
Any regression here is a financial error. Test coverage is non-negotiable.
"""
import pytest
from datetime import datetime, timezone
from app.services.power_service import (
    compute_power_w,
    compute_energy_kwh,
    compute_cost_inr,
    estimate_load_from_current,
)


class TestComputePowerW:
    def test_basic(self):
        assert compute_power_w(10.0, 230.0) == 2300.0

    def test_zero_current(self):
        assert compute_power_w(0.0, 230.0) == 0.0

    def test_zero_voltage(self):
        assert compute_power_w(10.0, 0.0) == 0.0

    def test_negative_current_raises(self):
        with pytest.raises(ValueError, match="Negative sensor value"):
            compute_power_w(-1.0, 230.0)

    def test_negative_voltage_raises(self):
        with pytest.raises(ValueError, match="Negative sensor value"):
            compute_power_w(10.0, -1.0)

    def test_rounding(self):
        # 10.555 * 230.1 = 2428.6155 -> rounded to 3 dp
        result = compute_power_w(10.555, 230.1)
        assert result == round(10.555 * 230.1, 3)


class TestComputeEnergyKwh:
    def _ts(self, iso: str) -> datetime:
        return datetime.fromisoformat(iso).replace(tzinfo=timezone.utc)

    def test_constant_power_one_hour(self):
        """1000W constant for 1 hour = 1.0 kWh"""
        kwh = compute_energy_kwh(
            1000.0, 1000.0,
            self._ts("2024-01-01T00:00:00"),
            self._ts("2024-01-01T01:00:00"),
        )
        assert abs(kwh - 1.0) < 1e-5

    def test_constant_power_one_second(self):
        """2300W for 1 second = 2300/3600/1000 kWh (rounded to 6dp by service)"""
        kwh = compute_energy_kwh(
            2300.0, 2300.0,
            self._ts("2024-01-01T00:00:00"),
            self._ts("2024-01-01T00:00:01"),
        )
        expected = 2300.0 / 3_600_000.0
        # Service rounds to 6dp; tolerance accounts for that rounding
        assert abs(kwh - expected) < 1e-6

    def test_trapezoidal_ramp(self):
        """Ramp from 0W to 2000W over 1 hour = 1.0 kWh (trapezoid)"""
        kwh = compute_energy_kwh(
            2000.0, 0.0,
            self._ts("2024-01-01T00:00:00"),
            self._ts("2024-01-01T01:00:00"),
        )
        assert abs(kwh - 1.0) < 1e-5

    def test_zero_delta_returns_zero(self):
        ts = self._ts("2024-01-01T00:00:00")
        assert compute_energy_kwh(1000.0, 1000.0, ts, ts) == 0.0

    def test_negative_delta_returns_zero(self):
        kwh = compute_energy_kwh(
            1000.0, 1000.0,
            self._ts("2024-01-01T01:00:00"),
            self._ts("2024-01-01T00:00:00"),
        )
        assert kwh == 0.0


class TestComputeCostInr:
    def test_basic(self):
        cost = compute_cost_inr(1.0, 8.50)
        assert cost == 8.50

    def test_fractional(self):
        cost = compute_cost_inr(0.5, 10.0)
        assert abs(cost - 5.0) < 1e-4

    def test_zero_energy(self):
        assert compute_cost_inr(0.0, 8.50) == 0.0

    def test_zero_tariff_raises(self):
        with pytest.raises(ValueError, match="Tariff must be positive"):
            compute_cost_inr(1.0, 0.0)

    def test_negative_tariff_raises(self):
        with pytest.raises(ValueError, match="Tariff must be positive"):
            compute_cost_inr(1.0, -1.0)


class TestEstimateLoad:
    def test_full_load(self):
        assert estimate_load_from_current(10.0, 10.0, 5.0) == 100.0

    def test_half_load(self):
        assert estimate_load_from_current(5.0, 10.0, 5.0) == 50.0

    def test_overload_clamps_to_100(self):
        assert estimate_load_from_current(15.0, 10.0, 5.0) == 100.0

    def test_zero_rated_current(self):
        assert estimate_load_from_current(10.0, 0.0, 5.0) == 0.0
