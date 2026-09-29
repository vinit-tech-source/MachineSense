"""
WebSocket connection manager.
Manages per-machine subscriber sets and broadcasts new readings
to all connected dashboard clients for that machine.
"""
from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from typing import DefaultDict, Set

from fastapi import WebSocket
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        # machine_id -> set of active WebSocket connections
        self._connections: DefaultDict[str, Set[WebSocket]] = defaultdict(set)

    async def connect(self, machine_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[machine_id].add(websocket)
        logger.info("WS connected: machine=%s total=%d", machine_id, len(self._connections[machine_id]))

    def disconnect(self, machine_id: str, websocket: WebSocket) -> None:
        self._connections[machine_id].discard(websocket)
        logger.info("WS disconnected: machine=%s total=%d", machine_id, len(self._connections[machine_id]))

    async def broadcast(self, machine_id: str, payload: dict) -> None:
        """
        Send payload to all connected clients for this machine.
        Silently removes dead connections — never crashes the ingestion pipeline.
        """
        dead: list[WebSocket] = []
        message = json.dumps(payload, default=str)

        for ws in list(self._connections[machine_id]):
            if ws.client_state == WebSocketState.DISCONNECTED:
                dead.append(ws)
                continue
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self._connections[machine_id].discard(ws)


manager = ConnectionManager()
