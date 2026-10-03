// ─── Core Data Types ────────────────────────────────────────────────────────

export type MachineStatus = 'normal' | 'warning' | 'critical';

export type OperatingState = 'off' | 'startup' | 'idle' | 'producing' | 'high_load' | 'overload';

export type ConnectionState = 'connected' | 'connecting' | 'stale' | 'disconnected';

/** A single sensor reading record. Fields match the specified data model exactly. */
export interface SensorReading {
  id?: number;
  timestamp: string;             // ISO 8601
  machine_id: string;
  current_a: number;             // Amperes
  voltage_v: number;             // Volts
  vibration_mm_s: number;        // mm/s RMS
  temp_c: number;                // Celsius
  rpm: number;                   // Revolutions per minute
  power_factor: number | null;
  count_in: number | null;
  count_out: number | null;
  reject_count: number | null;
  pressure_bar: number | null;
  is_simulated: boolean;
  confidence_badge: string | null;
  status: MachineStatus;
  operating_state: OperatingState;
  alert_reason: string | null;   // Plain-language explanation; null when status=normal
  est_days_remaining: number | null; // RUL estimate; null until sufficient baseline
  // 0–100 % severity score that keeps rising even after days hits the floor (5d).
  // Allows distinguishing "just past service threshold" from "far past it".
  // null during the baseline calibration period.
  rul_severity_pct: number | null;
}

/** Derived energy/cost metrics computed from readings */
export interface EnergyMetrics {
  power_w: number;               // Instantaneous power (W)
  energy_kwh: number;            // Accumulated since session start (kWh)
  cost_inr: number;              // Cost in INR at configured tariff
  co2e_kg: number;               // Scope 2 CO2e emissions
  productive_kwh: number;
  idle_kwh: number;
  startup_kwh: number;
  reject_kwh: number;
  degradation_kwh: number;
  peak_kwh: number;
  good_units: number;            // Accumulated good production units
  sec: number | null;            // Specific Energy Consumption (kWh/good unit)
  session_start: string;         // ISO 8601
}

/** Single anomaly signal contribution for explainability */
export interface AnomalyContribution {
  signal: 'current_a' | 'vibration_mm_s' | 'temp_c' | 'rpm' | 'voltage_v';
  label: string;
  actual: number;
  baseline_mean: number;
  baseline_std: number;
  z_score: number;               // How many std-devs from baseline mean
  unit: string;
}

/** Full anomaly detection result */
export interface AnomalyResult {
  status: MachineStatus;
  contributions: AnomalyContribution[];
  alert_reason: string | null;
  triggered_at: string;
}

/** Machine info and configuration */
export interface MachineInfo {
  machine_id: string;
  name: string;
  location: string;
  rated_power_kw: number;
  tariff_inr_per_kwh: number;
  commissioned_at: string;
}

/** Alert record from the alerts log */
export interface AlertRecord {
  id: number;
  timestamp: string;
  machine_id: string;
  status: MachineStatus;
  alert_reason: string;
  contributions: AnomalyContribution[];
  resolved_at: string | null;
}

/** Historical reading summary for trend view */
export interface HistoricalPoint {
  timestamp: string;
  current_a: number;
  voltage_v: number;
  vibration_mm_s: number;
  temp_c: number;
  rpm: number;
  power_w: number;
  status: MachineStatus;
  operating_state: OperatingState;
}

/** Connection/feed state for the dashboard */
export interface FeedState {
  state: ConnectionState;
  last_received_at: string | null;
  seconds_stale: number;
}

/** Baseline stats used for anomaly detection display */
export interface BaselineStats {
  machine_id: string;
  sample_count: number;
  current_a: { mean: number; std: number };
  vibration_mm_s: { mean: number; std: number };
  temp_c: { mean: number; std: number };
  rpm: { mean: number; std: number };
  voltage_v: { mean: number; std: number };
  computed_at: string;
}

/** API response wrapper */
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

/** Daily aggregated summary for comparison view */
export interface DailySummary {
  date: string;
  machine_id: string;
  run_hours: number;
  good_units: number;
  reject_units: number;
  yield_pct: number;
  total_kwh: number;
  productive_kwh: number;
  idle_kwh: number;
  reject_kwh: number;
  degradation_kwh: number;
  peak_kwh: number;
  total_cost_inr: number;
  co2e_kg: number;
  sec: number | null;
  avg_current_a: number;
  avg_vibration_mm_s: number;
  avg_temp_c: number;
  avg_rpm: number;
  avg_power_factor: number | null;
  alert_count: number;
  idle_minutes: number;
  rul_days_at_end: number | null;
}
