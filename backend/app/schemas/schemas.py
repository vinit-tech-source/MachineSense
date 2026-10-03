"""
Pydantic schemas for API request/response validation.
Separate from ORM models to keep the data layer clean.
"""
from datetime import datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, model_validator


class MachineStatus(str, Enum):
    normal   = "normal"
    warning  = "warning"
    critical = "critical"


class OperatingState(str, Enum):
    off       = "off"
    startup   = "startup"
    idle      = "idle"
    producing = "producing"
    high_load = "high_load"
    overload  = "overload"


# ─── Ingest ──────────────────────────────────────────────────────────────────

class SensorReadingIngest(BaseModel):
    """
    Payload accepted by the HTTP ingestion endpoint (POST /api/ingest).
    The MQTT ingestion path uses the same structure deserialized from JSON.
    machine_id is required in v1 — all readings must be scoped to a machine.
    """
    timestamp:      Optional[datetime] = Field(
        default=None,
        description="Reading timestamp. Server-assigned if omitted."
    )
    machine_id:     str = Field(..., min_length=1, max_length=64)
    current_a:      float = Field(..., ge=0, le=10_000)
    voltage_v:      float = Field(..., ge=0, le=100_000)
    vibration_mm_s: float = Field(..., ge=0, le=10_000)
    temp_c:         float = Field(..., ge=-40, le=1_000)
    rpm:            float = Field(..., ge=0, le=1_000_000)
    
    # New YieldWatt Fields
    power_factor:   Optional[float] = Field(None, ge=0, le=1)
    count_in:       Optional[int] = Field(None, ge=0)
    count_out:      Optional[int] = Field(None, ge=0)
    reject_count:   Optional[int] = Field(None, ge=0)
    pressure_bar:   Optional[float] = Field(None, ge=0)
    is_simulated:   bool = Field(False)
    confidence_badge: Optional[str] = Field(None)

    @model_validator(mode="after")
    def assign_timestamp(self) -> "SensorReadingIngest":
        if self.timestamp is None:
            from datetime import timezone
            self.timestamp = datetime.now(timezone.utc)
        return self


# ─── Reading response ─────────────────────────────────────────────────────────

class AnomalyContributionOut(BaseModel):
    signal:         str
    label:          str
    actual:         float
    baseline_mean:  float
    baseline_std:   float
    z_score:        float
    unit:           str


class SensorReadingOut(BaseModel):
    id:                 int
    timestamp:          datetime
    machine_id:         str
    current_a:          float
    voltage_v:          float
    vibration_mm_s:     float
    temp_c:             float
    rpm:                float
    power_factor:       Optional[float]
    count_in:           Optional[int]
    count_out:          Optional[int]
    reject_count:       Optional[int]
    pressure_bar:       Optional[float]
    is_simulated:       bool
    confidence_badge:   Optional[str]
    status:             MachineStatus
    operating_state:    OperatingState
    alert_reason:       Optional[str]
    est_days_remaining: Optional[int]
    # Continuous 0–100 % severity score that keeps growing beyond the days floor.
    # Allows operators to distinguish "just past service threshold" from "far past it".
    # None during the baseline calibration period (same lifecycle as est_days_remaining).
    rul_severity_pct:   Optional[float]

    model_config = {"from_attributes": True}


# ─── Energy metrics ───────────────────────────────────────────────────────────

class EnergyMetricsOut(BaseModel):
    power_w:       float
    energy_kwh:    float
    cost_inr:      float
    co2e_kg:       float
    
    productive_kwh:  float
    idle_kwh:        float
    startup_kwh:     float
    reject_kwh:      float
    degradation_kwh: float
    peak_kwh:        float
    
    good_units:    int
    sec:           Optional[float] # Specific Energy Consumption (kWh/good unit)
    session_start: datetime


# ─── Alerts ───────────────────────────────────────────────────────────────────

class AlertRecordOut(BaseModel):
    id:             int
    timestamp:      datetime
    machine_id:     str
    status:         MachineStatus
    alert_reason:   str
    contributions:  List[AnomalyContributionOut]
    resolved_at:    Optional[datetime]

    model_config = {"from_attributes": True}


# ─── Machine ──────────────────────────────────────────────────────────────────

class MachineOut(BaseModel):
    machine_id:         str
    name:               str
    location:           str
    rated_power_kw:     float
    tariff_inr_per_kwh: float
    commissioned_at:    datetime

    model_config = {"from_attributes": True}


class MachineCreate(BaseModel):
    machine_id:         str = Field(..., min_length=1, max_length=64)
    name:               str = Field(..., min_length=1, max_length=256)
    location:           str = Field(default="")
    rated_power_kw:     float = Field(default=0.0, ge=0)
    tariff_inr_per_kwh: float = Field(default=8.50, gt=0)


class MachineUpdate(BaseModel):
    name:               Optional[str] = Field(None, min_length=1, max_length=256)
    location:           Optional[str] = Field(None)
    rated_power_kw:     Optional[float] = Field(None, ge=0)
    tariff_inr_per_kwh: Optional[float] = Field(None, gt=0)


# ─── Historical (trend chart) ─────────────────────────────────────────────────

class HistoricalPointOut(BaseModel):
    timestamp:      datetime
    current_a:      float
    voltage_v:      float
    vibration_mm_s: float
    temp_c:         float
    rpm:            float
    power_w:        float
    status:         MachineStatus
    operating_state: OperatingState

    model_config = {"from_attributes": True}


# ─── Baseline stats ───────────────────────────────────────────────────────────

class SignalStats(BaseModel):
    mean: float
    std:  float


class BaselineStatsOut(BaseModel):
    machine_id:     str
    sample_count:   int
    current_a:      SignalStats
    vibration_mm_s: SignalStats
    temp_c:         SignalStats
    rpm:            SignalStats
    voltage_v:      SignalStats
    computed_at:    datetime

# ─── Manual Analytics ─────────────────────────────────────────────────────────

class ManualAnalyticsInput(BaseModel):
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    working_hours: float = Field(..., gt=0)
    production_units: int = Field(..., ge=0)

class ProblemRemedy(BaseModel):
    problem: str
    remedy: str
    severity: str

class ManualAnalyticsOut(BaseModel):
    date: str
    machine_id: str
    working_hours: float
    production_units: int
    total_energy_kwh: float
    cost_inr: float
    co2e_kg: float
    yield_rate_pct: float
    sec: Optional[float]
    avg_power_w: float
    avg_temp_c: float
    avg_vibration_mm_s: float
    problems_detected: List[ProblemRemedy]
