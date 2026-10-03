"""
SQLAlchemy ORM models.
Field names match the data model specified in the product requirements exactly.
"""
from datetime import datetime, timezone
from enum import Enum as PyEnum
import json

from sqlalchemy import (
    String, Float, Integer, Text, DateTime, Enum,
    ForeignKey, Boolean, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MachineStatusEnum(str, PyEnum):
    normal   = "normal"
    warning  = "warning"
    critical = "critical"


class OperatingStateEnum(str, PyEnum):
    off       = "off"
    startup   = "startup"
    idle      = "idle"
    producing = "producing"
    high_load = "high_load"
    overload  = "overload"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Machine(Base):
    """
    Represents a monitored machine.
    v1 is single-machine, but machine_id is never hardcoded —
    all queries are scoped through this table for clean future extension.
    """
    __tablename__ = "machines"

    machine_id:       Mapped[str]   = mapped_column(String(64), primary_key=True)
    name:             Mapped[str]   = mapped_column(String(256), nullable=False)
    location:         Mapped[str]   = mapped_column(String(256), nullable=False, default="")
    rated_power_kw:   Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    tariff_inr_per_kwh: Mapped[float] = mapped_column(Float, nullable=False, default=8.50)
    commissioned_at:  Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    readings: Mapped[list["SensorReading"]] = relationship(
        "SensorReading", back_populates="machine", lazy="noload"
    )
    alerts: Mapped[list["AlertRecord"]] = relationship(
        "AlertRecord", back_populates="machine", lazy="noload"
    )


class SensorReading(Base):
    """
    A single reading snapshot from the sensor node.
    Fields match the data model exactly as specified.
    """
    __tablename__ = "sensor_readings"
    __table_args__ = (
        Index("ix_readings_machine_ts", "machine_id", "timestamp"),
    )

    id:              Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp:       Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True, default=utcnow
    )
    machine_id:      Mapped[str]      = mapped_column(String(64), ForeignKey("machines.machine_id"), nullable=False)
    current_a:       Mapped[float]    = mapped_column(Float, nullable=False)
    voltage_v:       Mapped[float]    = mapped_column(Float, nullable=False)
    vibration_mm_s:  Mapped[float]    = mapped_column(Float, nullable=False)
    temp_c:          Mapped[float]    = mapped_column(Float, nullable=False)
    rpm:             Mapped[float]    = mapped_column(Float, nullable=False)
    power_factor:    Mapped[float | None] = mapped_column(Float, nullable=True)
    count_in:        Mapped[int | None]   = mapped_column(Integer, nullable=True)
    count_out:       Mapped[int | None]   = mapped_column(Integer, nullable=True)
    reject_count:    Mapped[int | None]   = mapped_column(Integer, nullable=True)
    pressure_bar:    Mapped[float | None] = mapped_column(Float, nullable=True)
    is_simulated:    Mapped[bool]     = mapped_column(Boolean, nullable=False, default=False)
    confidence_badge: Mapped[str | None] = mapped_column(String(10), nullable=True)
    
    status:          Mapped[MachineStatusEnum] = mapped_column(
        Enum(MachineStatusEnum), nullable=False, default=MachineStatusEnum.normal
    )
    operating_state: Mapped[OperatingStateEnum] = mapped_column(
        Enum(OperatingStateEnum), nullable=False, default=OperatingStateEnum.off
    )
    alert_reason:    Mapped[str | None] = mapped_column(Text, nullable=True)
    est_days_remaining: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Continuous 0–100 % severity score beyond the days floor.
    # Populated alongside est_days_remaining; None during calibration.
    rul_severity_pct: Mapped[float | None] = mapped_column(Float, nullable=True)

    machine: Mapped["Machine"] = relationship("Machine", back_populates="readings")


class AlertRecord(Base):
    """
    Persisted alert event. Created whenever status is not normal.
    Stores the full explainability payload (contributions) as JSON.
    """
    __tablename__ = "alert_records"
    __table_args__ = (
        Index("ix_alerts_machine_ts", "machine_id", "timestamp"),
    )

    id:           Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp:    Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    machine_id:   Mapped[str]      = mapped_column(String(64), ForeignKey("machines.machine_id"), nullable=False)
    status:       Mapped[MachineStatusEnum] = mapped_column(Enum(MachineStatusEnum), nullable=False)
    alert_reason: Mapped[str]      = mapped_column(Text, nullable=False)
    # JSON-encoded list of AnomalyContribution dicts for explainability
    contributions_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    resolved_at:  Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    machine: Mapped["Machine"] = relationship("Machine", back_populates="alerts")

    @property
    def contributions(self) -> list:
        try:
            return json.loads(self.contributions_json)
        except Exception:
            return []

    @contributions.setter
    def contributions(self, value: list) -> None:
        self.contributions_json = json.dumps(value)


class EnergySession(Base):
    """
    Tracks accumulated energy (kWh) and cost for a continuous run session.
    A new session starts when the machine comes online after a gap.
    """
    __tablename__ = "energy_sessions"

    id:             Mapped[int]      = mapped_column(Integer, primary_key=True, autoincrement=True)
    machine_id:     Mapped[str]      = mapped_column(String(64), ForeignKey("machines.machine_id"), nullable=False)
    session_start:  Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    session_end:    Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    energy_kwh:     Mapped[float]    = mapped_column(Float, nullable=False, default=0.0)
    cost_inr:       Mapped[float]    = mapped_column(Float, nullable=False, default=0.0)
    co2e_kg:        Mapped[float]    = mapped_column(Float, nullable=False, default=0.0)
    
    # Energy Waterfall Buckets
    productive_kwh:  Mapped[float]   = mapped_column(Float, nullable=False, default=0.0)
    idle_kwh:        Mapped[float]   = mapped_column(Float, nullable=False, default=0.0)
    startup_kwh:     Mapped[float]   = mapped_column(Float, nullable=False, default=0.0)
    reject_kwh:      Mapped[float]   = mapped_column(Float, nullable=False, default=0.0)
    degradation_kwh: Mapped[float]   = mapped_column(Float, nullable=False, default=0.0)
    peak_kwh:        Mapped[float]   = mapped_column(Float, nullable=False, default=0.0)
    
    good_units:     Mapped[int]      = mapped_column(Integer, nullable=False, default=0)
    is_active:      Mapped[bool]     = mapped_column(Boolean, nullable=False, default=True)
