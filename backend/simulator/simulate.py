"""
Data simulator — INTERNAL DEV/DEMO TOOL ONLY.

This script sends synthetic sensor readings to the backend via HTTP POST.
It is NOT part of the production application.
It must NEVER be shipped as a visible feature to end users.
It is clearly marked as a development/demo tool in all internal documentation.

Usage:
    python simulator/simulate.py [--mode normal|fault_vibration|fault_temp|fault_current]

Modes:
    normal            Healthy machine operating within baseline
    fault_vibration   Injected bearing fault (elevated vibration)
    fault_temp        Injected thermal fault (elevated temperature)
    fault_current     Injected overload fault (elevated current)
"""
import argparse
import asyncio
import math
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Allow running from the simulator/ directory
sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

import os

API_URL     = os.getenv("VITE_API_URL", "http://localhost:8000")
MACHINE_ID  = os.getenv("SIMULATOR_MACHINE_ID", "machine-001")
INTERVAL_S  = float(os.getenv("SIMULATOR_INTERVAL_S", "3"))

# ── Baseline operating parameters (healthy machine) ──────────────────────────
BASELINE = {
    "current_a":      10.5,   # A (typical running current)
    "voltage_v":      230.0,  # V (single-phase 230V)
    "vibration_mm_s": 2.1,    # mm/s RMS (healthy bearing)
    "temp_c":         65.0,   # °C (normal operating temp)
    "rpm":            1450.0, # RPM (4-pole 50Hz motor, slight slip)
}

# ── Noise levels (std dev) ────────────────────────────────────────────────────
NOISE = {
    "current_a":      0.3,
    "voltage_v":      1.5,
    "vibration_mm_s": 0.2,
    "temp_c":         0.5,
    "rpm":            10.0,
}

# ── Fault injection parameters ────────────────────────────────────────────────
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


def generate_reading(mode: str, t: float) -> dict:
    """Generate a single reading for the given fault mode and time t (seconds)."""
    fault = FAULT_CONFIGS.get(mode, {})
    reading = {}
    for key, base_val in BASELINE.items():
        noise_std = NOISE[key]
        cfg = fault.get(key, {})
        offset = cfg.get("offset", 0.0)
        noise_mult = cfg.get("noise_multiplier", 1.0)

        # Slow sinusoidal drift to simulate load variation (reduced to avoid false alerts)
        drift = base_val * 0.001 * math.sin(t / 120.0)

        # Use uniform noise to mathematically bound the maximum possible Z-score.
        # For uniform(-A, A), max Z-score is sqrt(3) ~= 1.732, safely below the 2.5 threshold.
        bound = 1.7 * noise_std * noise_mult
        clipped_noise = random.uniform(-bound, bound)
        
        value = base_val + offset + drift + clipped_noise
        value = max(0.0, value)  # physical values can't be negative
        reading[key] = round(value, 4)

    reading["machine_id"] = MACHINE_ID
    reading["timestamp"]  = datetime.now(timezone.utc).isoformat()
    return reading


async def run_simulator(mode: str) -> None:
    print(f"[SIMULATOR] Starting in mode='{mode}' targeting {API_URL}/api/ingest")
    print(f"[SIMULATOR] Machine ID: {MACHINE_ID}, interval: {INTERVAL_S}s")
    print(f"[SIMULATOR] This is a development/demo tool. Not for production use.\n")

    t_start = time.monotonic()

    async with httpx.AsyncClient(timeout=10.0) as client:
        while True:
            t = time.monotonic() - t_start
            reading = generate_reading(mode, t)
            try:
                resp = await client.post(f"{API_URL}/api/ingest", json=reading)
                resp.raise_for_status()
                data = resp.json()
                print(
                    f"[{datetime.now().strftime('%H:%M:%S')}] "
                    f"mode={mode} | "
                    f"I={reading['current_a']:.2f}A V={reading['voltage_v']:.1f}V "
                    f"vib={reading['vibration_mm_s']:.2f}mm/s T={reading['temp_c']:.1f}°C "
                    f"RPM={reading['rpm']:.0f} | "
                    f"status={data.get('status')} | "
                    f"reason={data.get('alert_reason') or 'none'}"
                )
            except httpx.HTTPStatusError as exc:
                print(f"[ERROR] HTTP {exc.response.status_code}: {exc.response.text}")
            except Exception as exc:
                print(f"[ERROR] {exc}")

            await asyncio.sleep(INTERVAL_S)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Vigil sensor data simulator (dev/demo only)")
    parser.add_argument(
        "--mode",
        choices=list(FAULT_CONFIGS.keys()),
        default="normal",
        help="Simulation mode: normal or fault injection type",
    )
    args = parser.parse_args()

    try:
        asyncio.run(run_simulator(args.mode))
    except KeyboardInterrupt:
        print("\n[SIMULATOR] Stopped.")
