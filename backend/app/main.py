"""
FastAPI application entry point.

Startup sequence:
  1. Create database tables (idempotent)
  2. Start MQTT subscriber as a background task
  3. Register all API routers

The MQTT subscriber is started even if the broker is unreachable —
it will retry automatically. This means the HTTP path works standalone
without MQTT if needed (e.g., during development without a broker).
"""
import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import create_tables
from app.api import ingest, machines, websocket
from app.services.mqtt_service import mqtt_subscriber_loop

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

_mqtt_task: asyncio.Task | None = None


def create_app() -> FastAPI:
    app = FastAPI(
        title="MachineSense Machine Health API",
        description=(
            "Backend for MachineSense — real-time machine health and energy monitoring "
            "for SME manufacturing. Accepts readings via HTTP POST or MQTT, "
            "runs anomaly detection, and streams live data to dashboard clients via WebSocket."
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    allowed_origins = list(set(settings.cors_origins_list + [
        "https://machine-sense.vercel.app",
        "https://machinesense.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ]))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Lifespan ──────────────────────────────────────────────────────────────
    @app.on_event("startup")
    async def startup() -> None:
        global _mqtt_task, _scheduler_task, _simulator_task
        logger.info("Creating database tables...")
        await create_tables()
        logger.info("Starting MQTT subscriber...")
        _mqtt_task = asyncio.create_task(mqtt_subscriber_loop(), name="mqtt-subscriber")
        logger.info("Starting shift report scheduler...")
        from app.services.scheduler_service import shift_report_loop
        _scheduler_task = asyncio.create_task(shift_report_loop(interval_hours=8), name="shift-scheduler")
        
        logger.info("Starting autonomous cloud simulator...")
        try:
            from app.services.cloud_simulator import start_cloud_simulator
            _simulator_task = asyncio.create_task(start_cloud_simulator(), name="cloud-simulator")
        except Exception as e:
            logger.error(f"Failed to start simulator: {e}")

    @app.on_event("shutdown")
    async def shutdown() -> None:
        if _mqtt_task and not _mqtt_task.done():
            _mqtt_task.cancel()
            try:
                await _mqtt_task
            except asyncio.CancelledError:
                pass
        if '_simulator_task' in globals() and _simulator_task and not _simulator_task.done():
            _simulator_task.cancel()
            try:
                await _simulator_task
            except asyncio.CancelledError:
                pass

    # ── Routers ───────────────────────────────────────────────────────────────
    app.include_router(ingest.router,    prefix="/api", tags=["Ingestion"])
    app.include_router(machines.router,  prefix="/api", tags=["Machines"])
    
    from app.api import copilot
    app.include_router(copilot.router,   prefix="/api/copilot", tags=["Copilot"])
    
    app.include_router(websocket.router,              tags=["Live Feed"])

    @app.get("/health", tags=["Health"])
    async def health_check() -> dict:
        return {"status": "ok", "service": "vigil-backend"}

    return app


app = create_app()
