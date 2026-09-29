"""
WebSocket endpoint for live sensor feed.

Each dashboard client connects to /ws/machines/{machine_id}/live
and receives JSON-serialized SensorReading objects as they arrive
from either the MQTT subscriber or the HTTP ingest endpoint.

On disconnect (network drop, browser close), the connection is removed
from the manager — no cleanup needed from the client side.
"""
import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.ws_manager import manager

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws/machines/{machine_id}/live")
async def live_feed_ws(machine_id: str, websocket: WebSocket) -> None:
    await manager.connect(machine_id, websocket)
    try:
        # Keep connection alive; incoming messages from client are ignored
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                # Send a keepalive ping
                try:
                    await websocket.send_text(json.dumps({"type": "ping"}))
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug("WebSocket closed: %s", exc)
    finally:
        manager.disconnect(machine_id, websocket)
