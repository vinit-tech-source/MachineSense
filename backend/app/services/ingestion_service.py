"""
Ingestion pipeline: core logic for processing a single sensor reading.

This is the central function called by both:
  - The HTTP POST /api/ingest endpoint
  - The MQTT subscriber

Both paths call process_reading() with the same SensorReadingIngest payload,
so the logic is tested once and runs identically regardless of transport.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import SensorReading, AlertRecord, EnergySession, Machine, MachineStatusEnum, OperatingStateEnum
from app.schemas.schemas import SensorReadingIngest, SensorReadingOut, MachineStatus, OperatingState
from app.services.anomaly_service import get_baseline, estimate_rul
from app.services.power_service import compute_power_w, compute_energy_kwh, compute_cost_inr, compute_co2e_kg
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)


async def ensure_machine_exists(db: AsyncSession, machine_id: str) -> Machine:
    """
    Ensure a machine record exists before ingesting its data.
    Raises ValueError if unregistered.
    """
    result = await db.execute(select(Machine).where(Machine.machine_id == machine_id))
    machine = result.scalar_one_or_none()
    if machine is None:
        raise ValueError(f"Machine '{machine_id}' is not registered. Cannot ingest data.")
    return machine


async def get_or_create_energy_session(
    db: AsyncSession,
    machine: Machine,
    now: datetime,
) -> EnergySession:
    """
    Get the active energy session, or start a new one.
    A session gap of >5 minutes starts a new session.
    """
    result = await db.execute(
        select(EnergySession)
        .where(EnergySession.machine_id == machine.machine_id, EnergySession.is_active == True)
        .order_by(EnergySession.session_start.desc())
        .limit(1)
    )
    session = result.scalar_one_or_none()

    if session is None:
        session = EnergySession(
            machine_id=machine.machine_id,
            session_start=now,
            energy_kwh=0.0,
            cost_inr=0.0,
            co2e_kg=0.0,
            productive_kwh=0.0,
            idle_kwh=0.0,
            startup_kwh=0.0,
            reject_kwh=0.0,
            degradation_kwh=0.0,
            peak_kwh=0.0,
            is_active=True,
        )
        db.add(session)
        await db.flush()
    else:
        # Check for session gap — if last reading was >5 min ago, start fresh
        result2 = await db.execute(
            select(SensorReading)
            .where(SensorReading.machine_id == machine.machine_id)
            .order_by(SensorReading.timestamp.desc())
            .limit(1)
        )
        last = result2.scalar_one_or_none()
        if last is not None:
            gap_s = (now - last.timestamp.replace(tzinfo=timezone.utc)).total_seconds()
            if gap_s > 300:  # 5-minute gap = new session
                session.is_active = False
                session.session_end = now
                session = EnergySession(
                    machine_id=machine.machine_id,
                    session_start=now,
                    energy_kwh=0.0,
                    cost_inr=0.0,
                    co2e_kg=0.0,
                    productive_kwh=0.0,
                    idle_kwh=0.0,
                    startup_kwh=0.0,
                    reject_kwh=0.0,
                    degradation_kwh=0.0,
                    peak_kwh=0.0,
                    is_active=True,
                )
                db.add(session)
                await db.flush()

    return session


async def process_reading(
    db: AsyncSession,
    payload: SensorReadingIngest,
    notify_websocket: bool = True,
) -> SensorReading:
    """
    End-to-end reading pipeline:
      1. Ensure machine record exists
      2. Update anomaly baseline
      3. Run anomaly detection
      4. Compute power / update energy session
      5. Estimate RUL
      6. Persist reading + alert (if any)
      7. Return ORM row (caller handles WebSocket broadcast)
    """
    now = payload.timestamp or datetime.now(timezone.utc)

    machine = await ensure_machine_exists(db, payload.machine_id)

    reading_dict = {
        "current_a":      payload.current_a,
        "voltage_v":      payload.voltage_v,
        "vibration_mm_s": payload.vibration_mm_s,
        "temp_c":         payload.temp_c,
        "rpm":            payload.rpm,
    }

    # ── Anomaly detection ────────────────────────────────────────────────────
    baseline = await get_baseline(db, payload.machine_id)
    status, contributions, reason = baseline.evaluate(reading_dict)
    rul = estimate_rul(baseline, reading_dict, contributions)

    # Add AFTER evaluation so anomaly detection uses prior baseline
    baseline.add(reading_dict)

    # ── Power / energy ───────────────────────────────────────────────────────
    power_w = compute_power_w(payload.current_a, payload.voltage_v)
    session = await get_or_create_energy_session(db, machine, now)

    # ── Operating State ───────────────────────────────────────────────────────
    # Determine operating state based on load % (current vs rated current)
    rated_i = (machine.rated_power_kw * 1000) / 230.0 if machine.rated_power_kw > 0 else 15.0
    load_pct = (payload.current_a / rated_i) * 100 if rated_i > 0 else 0
    
    op_state = OperatingStateEnum.off
    if load_pct < 2:
        op_state = OperatingStateEnum.off
    elif load_pct < 15:
        op_state = OperatingStateEnum.idle
    elif load_pct < 85:
        op_state = OperatingStateEnum.producing
    elif load_pct < 110:
        op_state = OperatingStateEnum.high_load
    else:
        op_state = OperatingStateEnum.overload

    # Get previous reading for energy delta
    result = await db.execute(
        select(SensorReading)
        .where(SensorReading.machine_id == payload.machine_id)
        .order_by(SensorReading.timestamp.desc())
        .limit(1)
    )
    prev_reading = result.scalar_one_or_none()

    if prev_reading is not None:
        prev_power_w = compute_power_w(prev_reading.current_a, prev_reading.voltage_v)
        prev_ts = prev_reading.timestamp.replace(tzinfo=timezone.utc)
        delta_kwh = compute_energy_kwh(power_w, prev_power_w, prev_ts, now)
        delta_cost = compute_cost_inr(delta_kwh, machine.tariff_inr_per_kwh, dt=now)
        delta_co2e = compute_co2e_kg(delta_kwh)
        session.energy_kwh += delta_kwh
        session.cost_inr   += delta_cost
        session.co2e_kg    += delta_co2e
        
        # Calculate good units (if counters are provided)
        delta_out = 0
        delta_reject = 0
        if payload.count_out is not None and prev_reading.count_out is not None:
            delta_out = max(0, payload.count_out - prev_reading.count_out)
            delta_reject = max(0, (payload.reject_count or 0) - (prev_reading.reject_count or 0))
            delta_good = max(0, delta_out - delta_reject)
            session.good_units += delta_good
            
        # Energy Waterfall Allocation
        if 18 <= now.hour < 22:
            session.peak_kwh += delta_kwh
        elif op_state == OperatingStateEnum.startup:
            session.startup_kwh += delta_kwh
        elif op_state in (OperatingStateEnum.idle, OperatingStateEnum.off):
            session.idle_kwh += delta_kwh
        elif rul.severity_pct and rul.severity_pct > 50:
            session.degradation_kwh += delta_kwh
        elif delta_out > 0 and delta_reject > 0:
            reject_ratio = min(1.0, delta_reject / delta_out)
            rej_kwh = delta_kwh * reject_ratio
            session.reject_kwh += rej_kwh
            session.productive_kwh += (delta_kwh - rej_kwh)
        else:
            session.productive_kwh += delta_kwh

    # ── Persist reading ───────────────────────────────────────────────────────
    orm_status = MachineStatusEnum(status.value)
    reading = SensorReading(
        timestamp=now,
        machine_id=payload.machine_id,
        current_a=payload.current_a,
        voltage_v=payload.voltage_v,
        vibration_mm_s=payload.vibration_mm_s,
        temp_c=payload.temp_c,
        rpm=payload.rpm,
        power_factor=payload.power_factor,
        count_in=payload.count_in,
        count_out=payload.count_out,
        reject_count=payload.reject_count,
        pressure_bar=payload.pressure_bar,
        is_simulated=payload.is_simulated,
        confidence_badge=payload.confidence_badge,
        status=orm_status,
        operating_state=op_state,
        alert_reason=reason,
        est_days_remaining=rul.days,
        rul_severity_pct=rul.severity_pct,
    )
    db.add(reading)

    # ── Persist alert record (if not normal) ──────────────────────────────────
    if status != MachineStatus.normal and reason:
        # Check if there is already an open alert for this machine
        existing = await db.execute(
            select(AlertRecord)
            .where(AlertRecord.machine_id == payload.machine_id, AlertRecord.resolved_at.is_(None))
            .limit(1)
        )
        if existing.scalar_one_or_none() is None:
            alert = AlertRecord(
                timestamp=now,
                machine_id=payload.machine_id,
                status=orm_status,
                alert_reason=reason,
            )
            alert.contributions = [c.model_dump() for c in contributions]
            db.add(alert)
            
            # Trigger Mobile Notification
            if notification_service.is_configured():
                severity_val = rul.severity_pct if rul.severity_pct is not None else (80.0 if status == MachineStatus.critical else 50.0)
                await notification_service.notify_anomaly(
                    machine_id=payload.machine_id,
                    severity=severity_val,
                    details=reason
                )
    elif status == MachineStatus.normal:
        # If normal, resolve any open alerts for this machine
        await db.execute(
            update(AlertRecord)
            .where(AlertRecord.machine_id == payload.machine_id, AlertRecord.resolved_at.is_(None))
            .values(resolved_at=now)
        )

    await db.flush()
    await db.refresh(reading)
    return reading
