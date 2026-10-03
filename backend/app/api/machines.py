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
    MachineOut, MachineCreate, MachineUpdate, SensorReadingOut,
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


@router.get("", response_model=List[MachineOut], summary="List all machines")
async def list_machines(db: AsyncSession = Depends(get_db)) -> List[MachineOut]:
    result = await db.execute(select(Machine).order_by(Machine.name.asc()))
    machines = result.scalars().all()
    return [MachineOut.model_validate(m) for m in machines]


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


@router.put("/{machine_id}", response_model=MachineOut, summary="Update machine settings")
async def update_machine(machine_id: str, payload: MachineUpdate, db: AsyncSession = Depends(get_db)) -> MachineOut:
    result = await db.execute(select(Machine).where(Machine.machine_id == machine_id))
    machine = result.scalar_one_or_none()
    if not machine:
        raise HTTPException(404, f"Machine '{machine_id}' not found.")
    
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(machine, key, value)
        
    await db.flush()
    await db.refresh(machine)
    return MachineOut.model_validate(machine)


@router.delete("/{machine_id}", status_code=204, summary="Remove a machine")
async def delete_machine(machine_id: str, db: AsyncSession = Depends(get_db)) -> None:
    result = await db.execute(select(Machine).where(Machine.machine_id == machine_id))
    machine = result.scalar_one_or_none()
    if not machine:
        raise HTTPException(404, f"Machine '{machine_id}' not found.")
    
    await db.delete(machine)
    await db.flush()


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
            operating_state=r.operating_state.value, # type: ignore[arg-type]
        )
        for r in rows
    ]

import io
from fastapi.responses import StreamingResponse
import csv

@router.get(
    "/{machine_id}/readings/export",
    summary="Export historical readings as CSV",
)
async def export_readings_csv(
    machine_id: str,
    hours: float = Query(default=24, ge=1, le=8760, description="Number of hours to look back"),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    result = await db.execute(
        select(SensorReading)
        .where(
            SensorReading.machine_id == machine_id,
            SensorReading.timestamp >= since,
        )
        .order_by(SensorReading.timestamp.asc())
    )
    rows = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["timestamp", "current_a", "voltage_v", "vibration_mm_s", "temp_c", "rpm", "power_w", "status"])
    for r in rows:
        writer.writerow([
            r.timestamp.isoformat(),
            r.current_a,
            r.voltage_v,
            r.vibration_mm_s,
            r.temp_c,
            r.rpm,
            compute_power_w(r.current_a, r.voltage_v),
            r.status.value,
        ])

    output.seek(0)
    filename = f"machine_{machine_id}_export_{int(hours)}h.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


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
            co2e_kg=0.0,
            productive_kwh=0.0,
            idle_kwh=0.0,
            startup_kwh=0.0,
            reject_kwh=0.0,
            degradation_kwh=0.0,
            peak_kwh=0.0,
            good_units=0,
            sec=None,
            session_start=datetime.now(timezone.utc),
        )
        
    sec_value = None
    if session.good_units > 0:
        sec_value = round(session.energy_kwh / session.good_units, 4)

    return EnergyMetricsOut(
        power_w=power_w,
        energy_kwh=round(session.energy_kwh, 4),
        cost_inr=round(session.cost_inr, 4),
        co2e_kg=round(session.co2e_kg, 4),
        productive_kwh=round(session.productive_kwh, 4),
        idle_kwh=round(session.idle_kwh, 4),
        startup_kwh=round(session.startup_kwh, 4),
        reject_kwh=round(session.reject_kwh, 4),
        degradation_kwh=round(session.degradation_kwh, 4),
        peak_kwh=round(session.peak_kwh, 4),
        good_units=session.good_units,
        sec=sec_value,
        session_start=session.session_start,
    )

# ─── Daily Summaries ──────────────────────────────────────────────────────────

from pydantic import BaseModel
from typing import List

class DailySummaryOut(BaseModel):
    date: str
    machine_id: str
    run_hours: float
    good_units: int
    reject_units: int
    yield_pct: float
    total_kwh: float
    productive_kwh: float
    idle_kwh: float
    reject_kwh: float
    degradation_kwh: float
    peak_kwh: float
    total_cost_inr: float
    co2e_kg: float
    sec: float | None
    avg_current_a: float
    avg_vibration_mm_s: float
    avg_temp_c: float
    avg_rpm: float
    avg_power_factor: float | None
    alert_count: int
    idle_minutes: int
    rul_days_at_end: int | None

@router.get(
    "/{machine_id}/daily",
    response_model=List[DailySummaryOut],
    summary="Get daily summaries for comparative analysis",
)
async def get_daily_summaries(machine_id: str, days: int = 14, db: AsyncSession = Depends(get_db)):
    # Note: In a production system, these are pre-calculated by a cron job into a DailySummary table.
    # For this demonstration, we'll return mock data for yesterday and today based on the current session.
    
    # Get the active session to generate realistic numbers for "today"
    result = await db.execute(
        select(EnergySession)
        .where(EnergySession.machine_id == machine_id)
        .order_by(EnergySession.session_start.desc())
        .limit(1)
    )
    session = result.scalar_one_or_none()
    
    today_date = datetime.now().strftime("%Y-%m-%d")
    yesterday_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    
    import random
    summaries = []
    base_energy = session.energy_kwh if session else 50.0
    base_units = session.good_units if session else 150
    base_cost = session.cost_inr if session else 425.0
    
    for i in range(days):
        date_str = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
        
        # Add some random variation
        var = random.uniform(0.7, 1.2) if i > 0 else 1.0 # today is exactly the session data if available
        
        # Construct mock summary
        energy = base_energy * var
        units = max(1, int(base_units * var * random.uniform(0.9, 1.1)))
        
        summaries.append(
            DailySummaryOut(
                date=date_str,
                machine_id=machine_id,
                run_hours=6.0 if i == 0 else round(random.uniform(5.5, 8.0), 1),
                good_units=units,
                reject_units=int(units * random.uniform(0.01, 0.08)),
                yield_pct=round(random.uniform(85, 98), 1),
                total_kwh=energy,
                productive_kwh=energy * random.uniform(0.7, 0.9),
                idle_kwh=energy * random.uniform(0.05, 0.15),
                reject_kwh=energy * random.uniform(0.01, 0.05),
                degradation_kwh=energy * random.uniform(0.01, 0.05),
                peak_kwh=(session.peak_kwh if session else 12.0) if i == 0 else (session.peak_kwh if session else 12.0) * random.uniform(0.9, 1.1),
                total_cost_inr=base_cost * var,
                co2e_kg=(session.co2e_kg if session else 15.0) * var,
                sec=round(energy / units, 3),
                avg_current_a=11.2 * random.uniform(0.9, 1.1),
                avg_vibration_mm_s=2.8 * random.uniform(0.8, 1.4),
                avg_temp_c=65.2 * random.uniform(0.9, 1.1),
                avg_rpm=1455 * random.uniform(0.98, 1.02),
                avg_power_factor=0.88 * random.uniform(0.95, 1.05),
                alert_count=random.randint(0, 3),
                idle_minutes=int((energy * random.uniform(0.05, 0.15)) * 10),
                rul_days_at_end=42 - i,
            )
        )
    
    # Sort so oldest is first
    summaries.reverse()
    return summaries


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


# ─── Manual Analytics ───────────────────────────────────────────────────────────

from app.schemas.schemas import ManualAnalyticsInput, ManualAnalyticsOut

@router.post(
    "/{machine_id}/manual-analytics",
    response_model=ManualAnalyticsOut,
    summary="Generate analytics and inference from manual production log",
)
async def generate_manual_analytics(
    machine_id: str,
    payload: ManualAnalyticsInput,
    db: AsyncSession = Depends(get_db),
) -> ManualAnalyticsOut:
    # Query all readings for the given date (UTC)
    try:
        target_date = datetime.strptime(payload.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")
        
    start_dt = datetime.combine(target_date, datetime.min.time(), tzinfo=timezone.utc)
    end_dt = start_dt + timedelta(days=1)
    
    result = await db.execute(
        select(SensorReading)
        .where(
            SensorReading.machine_id == machine_id,
            SensorReading.timestamp >= start_dt,
            SensorReading.timestamp < end_dt
        )
    )
    readings = result.scalars().all()
    
    if not readings:
        return ManualAnalyticsOut(
            date=payload.date,
            machine_id=machine_id,
            working_hours=payload.working_hours,
            production_units=payload.production_units,
            total_energy_kwh=0.0,
            sec=0.0,
            avg_power_w=0.0,
            avg_temp_c=0.0,
            avg_vibration_mm_s=0.0,
            inference_text="No sensor data found for this date. Cannot generate energy or health inferences."
        )

    # Compute averages
    temps = [r.temp_c for r in readings]
    vibs = [r.vibration_mm_s for r in readings]
    powers = [compute_power_w(r.current_a, r.voltage_v) for r in readings]
    
    avg_temp = sum(temps) / len(temps)
    avg_vib = sum(vibs) / len(vibs)
    avg_power = sum(powers) / len(powers)
    
    # Calculate energy assuming readings are 1 second apart (from simulator)
    # Energy kWh = Sum(Power W) / 1000 / 3600
    total_energy_kwh = sum(powers) / 3600000.0
    
    sec = total_energy_kwh / payload.production_units if payload.production_units > 0 else None
    
    from app.schemas.schemas import ProblemRemedy
    problems = []
    
    expected_units_per_hour = 16.6  # Baseline assumption: 100 units / 6 hrs
    actual_uph = payload.production_units / payload.working_hours
    
    if actual_uph < expected_units_per_hour * 0.8:
        problems.append(ProblemRemedy(
            problem=f"Low Production Rate ({actual_uph:.1f} units/hr). Target is {expected_units_per_hour:.1f}.",
            remedy="Check for mechanical binding, worn tooling, or operator delays.",
            severity="warning"
        ))
        
        if avg_vib > 5.0:
            problems.append(ProblemRemedy(
                problem=f"High vibration ({avg_vib:.2f} mm/s) correlates with slow cycles.",
                remedy="Inspect bearings and spindle balance immediately.",
                severity="critical"
            ))
            
        if avg_temp > 68.0:
            problems.append(ProblemRemedy(
                problem=f"Elevated temperature ({avg_temp:.1f}°C) may be causing thermal throttling.",
                remedy="Clean cooling fins, check coolant flow, verify ambient temp.",
                severity="warning"
            ))
    elif sec and sec > 0.05:
        problems.append(ProblemRemedy(
            problem=f"High Energy Intensity (SEC: {sec:.3f} kWh/unit).",
            remedy="Machine is running but producing few units. Review micro-stoppages and idle time.",
            severity="warning"
        ))
        
    if not problems:
        problems.append(ProblemRemedy(
            problem="None detected.",
            remedy="Production rate and energy efficiency are within nominal parameters.",
            severity="info"
        ))
        
    return ManualAnalyticsOut(
        date=payload.date,
        machine_id=machine_id,
        working_hours=payload.working_hours,
        production_units=payload.production_units,
        total_energy_kwh=round(total_energy_kwh, 4),
        cost_inr=round(total_energy_kwh * 8.5, 2), # Default tariff
        co2e_kg=round(total_energy_kwh * 0.85, 2), # Grid factor
        yield_rate_pct=round(min(100.0, (actual_uph / expected_units_per_hour) * 100), 1),
        sec=round(sec, 4) if sec else None,
        avg_power_w=round(avg_power, 2),
        avg_temp_c=round(avg_temp, 2),
        avg_vibration_mm_s=round(avg_vib, 2),
        problems_detected=problems
    )

# ─── Baseline stats ───────────────────────────────────────────────────────────

@router.get(
    "/{machine_id}/baseline",
    response_model=BaselineStatsOut,
    summary="Get current anomaly detection baseline statistics",
)
async def get_baseline_stats(machine_id: str, db: AsyncSession = Depends(get_db)) -> BaselineStatsOut:
    baseline = await get_baseline(db, machine_id)
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
