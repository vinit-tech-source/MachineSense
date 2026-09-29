"""
Machine and reading read API routes.
All routes are scoped by machine_id — no cross-machine data leakage.
"""
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import Machine, SensorReading, AlertRecord, EnergySession
from app.schemas.schemas import (
    MachineOut, MachineCreate, SensorReadingOut,
    AlertRecordOut, AnomalyContributionOut,
    EnergyMetricsOut, HistoricalPointOut, BaselineStatsOut, SignalStats,
)
from app.services.anomaly_service import get_baseline
from app.services.power_service import compute_power_w

router = APIRouter(prefix="/machines")


# ─── Machine ──────────────────────────────────────────────────────────────────

@router.get("/{machine_id}", response_model=MachineOut, summary="Get machine info")
async def get_machine(machine_id: str, db: AsyncSession = Depends(get_db)) -> MachineOut:
    result = await db.execute(select(Machine).where(Machine.machine_id == machine_id))
    machine = result.scalar_one_or_none()
    if not machine:
        raise HTTPException(404, f"Machine '{machine_id}' not found.")
    return MachineOut.model_validate(machine)


@router.post("", response_model=MachineOut, status_code=201, summary="Register a machine")
async def create_machine(payload: MachineCreate, db: AsyncSession = Depends(get_db)) -> MachineOut:
    result = await db.execute(select(Machine).where(Machine.machine_id == payload.machine_id))
    if result.scalar_one_or_none():
        raise HTTPException(409, f"Machine '{payload.machine_id}' already exists.")
    machine = Machine(**payload.model_dump())
    db.add(machine)
    await db.flush()
    await db.refresh(machine)
    return MachineOut.model_validate(machine)


# ─── Latest reading ───────────────────────────────────────────────────────────

@router.get(
    "/{machine_id}/readings/latest",
    response_model=SensorReadingOut,
    summary="Get the most recent sensor reading",
)
async def get_latest_reading(machine_id: str, db: AsyncSession = Depends(get_db)) -> SensorReadingOut:
    result = await db.execute(
        select(SensorReading)
        .where(SensorReading.machine_id == machine_id)
        .order_by(SensorReading.timestamp.desc())
        .limit(1)
    )
    reading = result.scalar_one_or_none()
    if not reading:
        raise HTTPException(404, f"No readings found for machine '{machine_id}'.")
    return SensorReadingOut.model_validate(reading)


# ─── Historical readings ──────────────────────────────────────────────────────

@router.get(
    "/{machine_id}/readings/history",
    response_model=List[HistoricalPointOut],
    summary="Get historical readings for trend charts",
)
async def get_readings_history(
    machine_id: str,
    hours: float = Query(default=1, ge=0.1, le=8760, description="Number of hours to look back"),
    limit: int   = Query(default=300, ge=1, le=2000, description="Maximum number of records to return"),
    db: AsyncSession = Depends(get_db),
) -> List[HistoricalPointOut]:
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    result = await db.execute(
        select(SensorReading)
        .where(
            SensorReading.machine_id == machine_id,
            SensorReading.timestamp >= since,
        )
        .order_by(SensorReading.timestamp.asc())
        .limit(limit)
    )
    rows = result.scalars().all()

    return [
        HistoricalPointOut(
            timestamp=r.timestamp,
            current_a=r.current_a,
            voltage_v=r.voltage_v,
            vibration_mm_s=r.vibration_mm_s,
            temp_c=r.temp_c,
            rpm=r.rpm,
            power_w=compute_power_w(r.current_a, r.voltage_v),
            status=r.status.value,  # type: ignore[arg-type]
        )
        for r in rows
    ]


# ─── Energy metrics ───────────────────────────────────────────────────────────

@router.get(
    "/{machine_id}/energy",
    response_model=EnergyMetricsOut,
    summary="Get current session energy and cost",
)
async def get_energy_metrics(machine_id: str, db: AsyncSession = Depends(get_db)) -> EnergyMetricsOut:
    # Get active session
    result = await db.execute(
        select(EnergySession)
        .where(EnergySession.machine_id == machine_id, EnergySession.is_active == True)
        .order_by(EnergySession.session_start.desc())
        .limit(1)
    )
    session = result.scalar_one_or_none()

    # Get latest reading for instantaneous power
    result2 = await db.execute(
        select(SensorReading)
        .where(SensorReading.machine_id == machine_id)
        .order_by(SensorReading.timestamp.desc())
        .limit(1)
    )
    latest = result2.scalar_one_or_none()

    power_w = compute_power_w(latest.current_a, latest.voltage_v) if latest else 0.0

    if session is None:
        # No session yet
        return EnergyMetricsOut(
            power_w=power_w,
            energy_kwh=0.0,
            cost_inr=0.0,
            session_start=datetime.now(timezone.utc),
        )

    return EnergyMetricsOut(
        power_w=power_w,
        energy_kwh=round(session.energy_kwh, 4),
        cost_inr=round(session.cost_inr, 4),
        session_start=session.session_start,
    )


# ─── Alerts ───────────────────────────────────────────────────────────────────

@router.get(
    "/{machine_id}/alerts",
    response_model=List[AlertRecordOut],
    summary="Get alert log",
)
async def get_alerts(
    machine_id: str,
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> List[AlertRecordOut]:
    result = await db.execute(
        select(AlertRecord)
        .where(AlertRecord.machine_id == machine_id)
        .order_by(AlertRecord.timestamp.desc())
        .limit(limit)
    )
    rows = result.scalars().all()

    output = []
    for r in rows:
        contribs = [AnomalyContributionOut(**c) for c in r.contributions]
        output.append(AlertRecordOut(
            id=r.id,
            timestamp=r.timestamp,
            machine_id=r.machine_id,
            status=r.status.value,  # type: ignore[arg-type]
            alert_reason=r.alert_reason,
            contributions=contribs,
            resolved_at=r.resolved_at,
        ))
    return output


# ─── Baseline stats ───────────────────────────────────────────────────────────

@router.get(
    "/{machine_id}/baseline",
    response_model=BaselineStatsOut,
    summary="Get current anomaly detection baseline statistics",
)
async def get_baseline_stats(machine_id: str) -> BaselineStatsOut:
    baseline = get_baseline(machine_id)
    stats = baseline.stats()
    return BaselineStatsOut(
        machine_id=machine_id,
        sample_count=baseline.sample_count,
        current_a=SignalStats(**stats.get("current_a", {"mean": 0, "std": 0})),
        vibration_mm_s=SignalStats(**stats.get("vibration_mm_s", {"mean": 0, "std": 0})),
        temp_c=SignalStats(**stats.get("temp_c", {"mean": 0, "std": 0})),
        rpm=SignalStats(**stats.get("rpm", {"mean": 0, "std": 0})),
        voltage_v=SignalStats(**stats.get("voltage_v", {"mean": 0, "std": 0})),
        computed_at=datetime.now(timezone.utc),
    )
