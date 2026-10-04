"""
Autonomous Cloud Simulator Service for MachineSense.

Runs inside the FastAPI process on Render / Cloud hosting.
Directly ingests synthetic telemetry data into the database and broadcasts
to WebSocket subscribers without requiring external ports, HTTP loopbacks,
or a local laptop/VS Code terminal running.
"""
import asyncio
import logging
import math
import random
import time
from datetime import datetime, timezone
from typing import Dict, Any

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.models import Machine
from app.schemas.schemas import SensorReadingIngest
from app.services.ingestion_service import process_reading
from app.services.ws_manager import manager

logger = logging.getLogger(__name__)

# Default machines to seed and simulate
# machine_id -> (baseline_offset_multiplier, initial_mode, display_name, rated_power_kw)
SIMULATED_MACHINES = {
    "machine-001": (1.0, "normal", "CNC Milling Unit 01", 15.0),
    "machine-002": (1.2, "fault_vibration", "Lathe Motor 02", 7.5),
    "machine-003": (0.8, "normal", "Air Compressor 03", 22.0),
}

BASELINE = {
    "current_a":      10.5,
    "voltage_v":      230.0,
    "vibration_mm_s": 2.1,
    "temp_c":         65.0,
    "rpm":            1450.0,
    "pressure_bar":   6.5,
    "power_factor":   0.85,
}

NOISE = {
    "current_a":      0.3,
    "voltage_v":      1.5,
    "vibration_mm_s": 0.2,
    "temp_c":         0.5,
    "rpm":            10.0,
    "pressure_bar":   0.1,
    "power_factor":   0.02,
}

FAULT_CONFIGS = {
    "normal": {},
    "fault_vibration": {
        "vibration_mm_s": {"offset": 8.0, "noise_multiplier": 2.0},
    },
    "fault_temp": {
        "temp_c": {"offset": 30.0, "noise_multiplier": 1.5},
        "current_a": {"offset": 2.0, "noise_multiplier": 1.2},
    },
    "fault_current": {
        "current_a": {"offset": 12.0, "noise_multiplier": 2.5},
        "temp_c":    {"offset": 15.0, "noise_multiplier": 1.5},
    },
}

MACHINE_STATE: Dict[str, Dict[str, int]] = {
    m_id: {"count_in": 120, "count_out": 115, "reject_count": 5}
    for m_id in SIMULATED_MACHINES.keys()
}


def generate_reading_payload(machine_id: str, mode: str, base_mult: float, t: float) -> SensorReadingIngest:
    fault = FAULT_CONFIGS.get(mode, {})
    reading_dict: Dict[str, Any] = {}
    
    for key, base_val in BASELINE.items():
        val = base_val * base_mult
        noise_std = NOISE[key]
        cfg = fault.get(key, {})
        offset = cfg.get("offset", 0.0)
        noise_mult = cfg.get("noise_multiplier", 1.0)

        drift = val * 0.01 * math.sin(t / 120.0)
        noise = random.gauss(0, noise_std * noise_mult)

        value = max(0.0, val + offset + drift + noise)
        if key == "power_factor":
            value = min(1.0, value)
        reading_dict[key] = round(value, 4)

    state = MACHINE_STATE.setdefault(machine_id, {"count_in": 0, "count_out": 0, "reject_count": 0})
    if random.random() < 0.3:
        state["count_in"] += 1
        if random.random() < 0.95:
            state["count_out"] += 1
        else:
            state["count_out"] += 1
            state["reject_count"] += 1

    reading_dict["count_in"] = state["count_in"]
    reading_dict["count_out"] = state["count_out"]
    reading_dict["reject_count"] = state["reject_count"]
    reading_dict["is_simulated"] = True
    reading_dict["confidence_badge"] = "A"
    reading_dict["machine_id"] = machine_id
    reading_dict["timestamp"] = datetime.now(timezone.utc)

    return SensorReadingIngest(**reading_dict)


async def seed_machines_if_needed() -> None:
    """Ensure baseline machines exist in the database."""
    try:
        async with AsyncSessionLocal() as session:
            for m_id, (_, _, name, power_kw) in SIMULATED_MACHINES.items():
                res = await session.execute(select(Machine).where(Machine.machine_id == m_id))
                if res.scalar_one_or_none() is None:
                    machine = Machine(
                        machine_id=m_id,
                        name=name,
                        location="Factory Floor — Bay A",
                        rated_power_kw=power_kw,
                        tariff_inr_per_kwh=8.50,
                    )
                    session.add(machine)
                    logger.info(f"Seeded machine: {m_id} ({name})")
            await session.commit()
    except Exception as e:
        logger.error(f"Error seeding default machines: {e}")


async def start_cloud_simulator() -> None:
    """Continuously generates telemetry directly into DB and broadcasts to WebSocket."""
    logger.info("Autonomous cloud simulator starting...")
    await asyncio.sleep(2)  # Give DB migration a moment to settle
    await seed_machines_if_needed()

    start_time = time.monotonic()
    cycle = 0

    while True:
        try:
            t = time.monotonic() - start_time
            cycle += 1

            async with AsyncSessionLocal() as session:
                for m_id, (base_mult, mode, _, _) in SIMULATED_MACHINES.items():
                    payload = generate_reading_payload(m_id, mode, base_mult, t)
                    reading = await process_reading(session, payload)
                    
                    # Broadcast live update to any connected frontend dashboard
                    await manager.broadcast(m_id, {
                        "id": reading.id,
                        "timestamp": reading.timestamp.isoformat(),
                        "machine_id": reading.machine_id,
                        "current_a": reading.current_a,
                        "voltage_v": reading.voltage_v,
                        "vibration_mm_s": reading.vibration_mm_s,
                        "temp_c": reading.temp_c,
                        "rpm": reading.rpm,
                        "status": reading.status.value,
                        "alert_reason": reading.alert_reason,
                        "est_days_remaining": reading.est_days_remaining,
                    })

                await session.commit()

            if cycle % 20 == 0:
                logger.info(f"Cloud simulator running smoothly. Generated cycle #{cycle}.")

        except asyncio.CancelledError:
            logger.info("Cloud simulator stopped.")
            break
        except Exception as exc:
            logger.error(f"Error in cloud simulator iteration: {exc}", exc_info=False)

        await asyncio.sleep(3.0)
