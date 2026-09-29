"""
HTTP ingestion endpoint (POST /api/ingest).

This is the HTTP fallback for sensor nodes that cannot use MQTT,
and the primary path for the development simulator.

Both this endpoint and the MQTT path call the same process_reading() function,
ensuring identical behavior from both transports.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.schemas import SensorReadingIngest, SensorReadingOut
from app.services.ingestion_service import process_reading
from app.services.ws_manager import manager

router = APIRouter()


@router.post(
    "/ingest",
    response_model=SensorReadingOut,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest a sensor reading",
    description=(
        "Primary HTTP ingestion endpoint. Accepts a single sensor reading, "
        "runs anomaly detection, updates energy metrics, and returns the persisted record. "
        "Use the MQTT path for production sensor nodes. This endpoint is also used by the simulator."
    ),
)
async def ingest_reading(
    payload: SensorReadingIngest,
    db: AsyncSession = Depends(get_db),
) -> SensorReadingOut:
    try:
        reading = await process_reading(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {exc}")

    # Broadcast to any connected WebSocket clients
    await manager.broadcast(reading.machine_id, {
        "id":                 reading.id,
        "timestamp":          reading.timestamp.isoformat(),
        "machine_id":         reading.machine_id,
        "current_a":          reading.current_a,
        "voltage_v":          reading.voltage_v,
        "vibration_mm_s":     reading.vibration_mm_s,
        "temp_c":             reading.temp_c,
        "rpm":                reading.rpm,
        "status":             reading.status.value,
        "alert_reason":       reading.alert_reason,
        "est_days_remaining": reading.est_days_remaining,
    })

    return SensorReadingOut.model_validate(reading)
