"""
Power and energy calculation service.

Formulas:
  power_w   = current_a * voltage_v           (instantaneous apparent power, W)
  energy_kwh += power_w * delta_t_hours       (trapezoidal accumulation, kWh)
  cost_inr   = energy_kwh * tariff_inr/kWh

These are the quantities visible to the user.
Any change here is a change to billed cost — validate carefully.
"""
from datetime import datetime, timezone

# Standard grid emission factor for India (approx 0.71 kg CO2e / kWh)
GRID_EMISSION_FACTOR = 0.71


def compute_power_w(current_a: float, voltage_v: float) -> float:
    """
    Instantaneous apparent power in Watts.
    Real power requires power factor (PF); without a PF sensor we use apparent.
    This is documented as a known limitation — not silently hidden.
    """
    if current_a < 0 or voltage_v < 0:
        raise ValueError(f"Negative sensor value: current={current_a}, voltage={voltage_v}")
    return round(current_a * voltage_v, 3)


def compute_energy_kwh(
    power_w: float,
    prev_power_w: float,
    prev_timestamp: datetime,
    current_timestamp: datetime,
) -> float:
    """
    Incremental energy in kWh using the trapezoidal rule.
    Returns the energy increment for this interval only.
    """
    delta_s = (current_timestamp - prev_timestamp).total_seconds()
    if delta_s <= 0:
        return 0.0
    # Trapezoidal: average of start/end power over the interval
    avg_power_w = (prev_power_w + power_w) / 2.0
    delta_h = delta_s / 3600.0
    return round(avg_power_w * delta_h / 1000.0, 6)  # convert W*h to kWh


def compute_cost_inr(energy_kwh: float, base_tariff: float, dt: datetime = None) -> float:
    """
    Cost in Indian Rupees using Time-of-Day (ToD) slabs.
    - Peak (18:00 to 22:00): 1.5x base tariff
    - Off-peak (22:00 to 06:00): 0.8x base tariff
    - Normal (06:00 to 18:00): 1.0x base tariff
    """
    if base_tariff <= 0:
        raise ValueError(f"Tariff must be positive, got {base_tariff}")
        
    multiplier = 1.0
    if dt:
        hour = dt.hour
        if 18 <= hour < 22:
            multiplier = 1.5
        elif hour >= 22 or hour < 6:
            multiplier = 0.8
            
    return round(energy_kwh * base_tariff * multiplier, 4)

def compute_co2e_kg(energy_kwh: float) -> float:
    """Scope 2 CO2e emissions based on grid factor."""
    return round(energy_kwh * GRID_EMISSION_FACTOR, 4)


def estimate_load_from_current(
    current_a: float,
    rated_current_a: float,
    rated_power_kw: float,
) -> float:
    """
    F9 (Could): Estimate load (%) from current draw vs rated current.
    This is an approximation — current is not perfectly linear with load,
    but it is the best we can do without a dedicated torque/load sensor.
    """
    if rated_current_a <= 0:
        return 0.0
    return round(min(100.0, (current_a / rated_current_a) * 100.0), 1)
