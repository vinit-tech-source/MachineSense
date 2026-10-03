"""
MQTT subscriber service.

Subscribes to vigil/machines/+/readings and pipes every received message
through the same process_reading() pipeline that the HTTP endpoint uses.
This ensures no behavioral divergence between the two ingestion paths.

Topic format: vigil/machines/<machine_id>/readings
Payload:      JSON matching SensorReadingIngest schema

This module runs as a background asyncio task started in app lifespan.
"""
from __future__ import annotations

import asyncio
import json
import logging
from contextlib import suppress

import aiomqtt

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.schemas.schemas import SensorReadingIngest
from app.services.ingestion_service import process_reading
from app.services.ws_manager import manager

logger = logging.getLogger(__name__)


def _machine_id_from_topic(topic: str) -> str | None:
    """
    Extract machine_id from topic: vigil/machines/<machine_id>/readings
    Returns None if topic doesn't match expected pattern.
    """
    parts = topic.split("/")
    if len(parts) == 4 and parts[0] == "vigil" and parts[1] == "machines" and parts[3] == "readings":
        return parts[2]
    return None


async def mqtt_subscriber_loop() -> None:
    """
    Reconnecting MQTT subscriber loop.
    Runs indefinitely as a background task.
    If the broker is unavailable at startup, retries every 10s with logged warnings.
    """
    reconnect_delay = 5

    while True:
        try:
            mqtt_kwargs: dict = {
                "hostname": settings.mqtt_host,
                "port":     settings.mqtt_port,
            }
            if settings.mqtt_username:
                mqtt_kwargs["username"] = settings.mqtt_username
                mqtt_kwargs["password"] = settings.mqtt_password

            async with aiomqtt.Client(**mqtt_kwargs) as client:
                reconnect_delay = 5  # reset on successful connect
                logger.info("MQTT connected to %s:%d", settings.mqtt_host, settings.mqtt_port)
                await client.subscribe(settings.mqtt_topic)
                logger.info("MQTT subscribed to topic: %s", settings.mqtt_topic)

                async for message in client.messages:
                    await _handle_message(str(message.topic), message.payload)

        except aiomqtt.MqttError as exc:
            logger.warning(
                "MQTT connection lost (%s). Retrying in %ds...",
                exc, reconnect_delay
            )
            await asyncio.sleep(reconnect_delay)
            reconnect_delay = min(reconnect_delay * 2, 60)
        except Exception as exc:
            logger.error("Unexpected MQTT error: %s", exc, exc_info=True)
            await asyncio.sleep(reconnect_delay)


async def _handle_message(topic: str, payload: bytes) -> None:
    machine_id = _machine_id_from_topic(topic)
    if machine_id is None:
        logger.warning("Ignoring message on unexpected topic: %s", topic)
        return

    try:
        data = json.loads(payload)
        # Override/fill machine_id from topic — topic is authoritative
        data["machine_id"] = machine_id
        reading_in = SensorReadingIngest.model_validate(data)
    except Exception as exc:
        logger.warning("Invalid MQTT payload on topic %s: %s", topic, exc)
        return

    try:
        async with AsyncSessionLocal() as db:
            reading = await process_reading(db, reading_in)
            await db.commit()

        # Broadcast to WebSocket clients
        await manager.broadcast(machine_id, {
            "id":                 reading.id,
            "timestamp":          reading.timestamp.isoformat(),
            "machine_id":         reading.machine_id,
            "current_a":          reading.current_a,
            "voltage_v":          reading.voltage_v,
            "vibration_mm_s":     reading.vibration_mm_s,
            "temp_c":             reading.temp_c,
            "rpm":                reading.rpm,
            "power_factor":       reading.power_factor,
            "count_in":           reading.count_in,
            "count_out":          reading.count_out,
            "reject_count":       reading.reject_count,
            "pressure_bar":       reading.pressure_bar,
            "is_simulated":       reading.is_simulated,
            "confidence_badge":   reading.confidence_badge,
            "status":             reading.status.value,
            "operating_state":    reading.operating_state.value,
            "alert_reason":       reading.alert_reason,
            "est_days_remaining": reading.est_days_remaining,
        })
    except Exception as exc:
        logger.error("Failed to process MQTT reading for machine %s: %s", machine_id, exc, exc_info=True)
