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

API_URL     = os.getenv("VITE_API_URL", "http://127.0.0.1:8000")
SIM_INTERVAL = float(os.getenv("SIMULATOR_INTERVAL_S", "3"))

# Machine configurations to simulate
# machine_id -> (baseline_offset_multiplier, mode)
SIMULATED_MACHINES = {
    "machine-001": (1.0, "normal"),           # Standard baseline
    "machine-002": (1.2, "fault_vibration"),  # 20% higher baseline, with vibration fault
    "machine-003": (0.8, "normal"),           # 20% lower baseline, normal
}


# ── Baseline operating parameters (healthy machine) ──────────────────────────
BASELINE = {
    "current_a":      10.5,   # A (typical running current)
    "voltage_v":      230.0,  # V (single-phase 230V)
    "vibration_mm_s": 2.1,    # mm/s RMS (healthy bearing)
    "temp_c":         65.0,   # °C (normal operating temp)
    "rpm":            1450.0, # RPM (4-pole 50Hz motor, slight slip)
    "pressure_bar":   6.5,    # Bar (for M3 compressor)
    "power_factor":   0.85,
}

# ── Noise levels (std dev) ────────────────────────────────────────────────────
NOISE = {
    "current_a":      0.3,
    "voltage_v":      1.5,
    "vibration_mm_s": 0.2,
    "temp_c":         0.5,
    "rpm":            10.0,
    "pressure_bar":   0.1,
    "power_factor":   0.02,
}

# Persistent counters for simulated machines
MACHINE_STATE = {
    m_id: {"count_in": 0, "count_out": 0, "reject_count": 0} 
    for m_id in SIMULATED_MACHINES.keys()
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


def generate_reading(machine_id: str, mode: str, base_mult: float, t: float) -> dict:
    """Generate a single reading for the given fault mode and time t (seconds)."""
    fault = FAULT_CONFIGS.get(mode, {})
    reading = {}
    for key, base_val in BASELINE.items():
        base_val *= base_mult
        noise_std = NOISE[key]
        cfg = fault.get(key, {})
        offset = cfg.get("offset", 0.0)
        noise_mult = cfg.get("noise_multiplier", 1.0)

        # Slow sinusoidal drift (~1% amplitude) to simulate realistic load variation.
        drift = base_val * 0.01 * math.sin(t / 120.0)
        noise = random.gauss(0, noise_std * noise_mult)

        value = base_val + offset + drift + noise
        value = max(0.0, value)  # physical values can't be negative
        if key == "power_factor":
            value = min(1.0, value)
        reading[key] = round(value, 4)

    # Increment counters based on simulated production rate (approx 1 unit per 10 seconds)
    state = MACHINE_STATE[machine_id]
    # Randomly increment count_in and count_out
    if random.random() < (SIM_INTERVAL / 10.0):
        state["count_in"] += 1
        if random.random() < 0.95:  # 95% yield
            state["count_out"] += 1
        else:
            state["count_out"] += 1
            state["reject_count"] += 1

    reading["count_in"] = state["count_in"]
    reading["count_out"] = state["count_out"]
    reading["reject_count"] = state["reject_count"]
    reading["is_simulated"] = True
    reading["confidence_badge"] = "A"

    reading["machine_id"] = machine_id
    reading["timestamp"]  = datetime.now(timezone.utc).isoformat()
    return reading


async def register_machine(client: httpx.AsyncClient, machine_id: str, name: str, power_kw: float) -> None:
    """Ensure the machine is registered with the backend before sending data."""
    # Check if exists
    try:
        resp = await client.get(f"{API_URL}/api/machines/{machine_id}")
        if resp.status_code == 200:
            return  # Already exists
    except httpx.HTTPError:
        pass

    # Register
    print(f"[SIMULATOR] Registering machine {machine_id}...")
    try:
        resp = await client.post(f"{API_URL}/api/machines", json={
            "machine_id": machine_id,
            "name": name,
            "location": "Simulated Factory Floor",
            "rated_power_kw": power_kw,
            "tariff_inr_per_kwh": 8.50
        })
        resp.raise_for_status()
    except Exception as exc:
        print(f"[ERROR] Failed to register {machine_id}: {exc}")


async def simulate_machine(client: httpx.AsyncClient, machine_id: str, base_mult: float, mode: str, start_time: float) -> None:
    print(f"[SIMULATOR] Worker started for {machine_id} in mode='{mode}'")
    while True:
        t = time.monotonic() - start_time
        reading = generate_reading(machine_id, mode, base_mult, t)
        try:
            resp = await client.post(f"{API_URL}/api/ingest", json=reading)
            resp.raise_for_status()
            data = resp.json()
            print(
                f"[{datetime.now().strftime('%H:%M:%S')}] {machine_id} | mode={mode} | "
                f"I={reading['current_a']:.1f}A V={reading['voltage_v']:.0f}V "
                f"vib={reading['vibration_mm_s']:.1f}mm/s T={reading['temp_c']:.1f}°C "
                f"RPM={reading['rpm']:.0f} | status={data.get('status')}"
            )
        except httpx.HTTPStatusError as exc:
            print(f"[ERROR] HTTP {exc.response.status_code} for {machine_id}: {exc.response.text}")
        except Exception as exc:
            print(f"[ERROR] {machine_id}: {exc}")

        await asyncio.sleep(SIM_INTERVAL)


# Persistent tracking of simulated machines
# machine_id -> {"task": asyncio.Task, "mode": str, "base_mult": float}
ACTIVE_TASKS = {}

async def discover_and_simulate(client: httpx.AsyncClient):
    print(f"[SIMULATOR] Discovery loop started. Target API: {API_URL}/api")
    while True:
        try:
            resp = await client.get(f"{API_URL}/api/machines")
            if resp.status_code == 200:
                machines = resp.json()
                t_start = time.monotonic()
                for i, m in enumerate(machines):
                    m_id = m["machine_id"]
                    if m_id not in ACTIVE_TASKS:
                        # Randomize baseline and mode for new machines
                        base_mult = random.uniform(0.8, 1.2)
                        mode = random.choices(
                            ["normal", "fault_vibration", "fault_temp", "fault_current"], 
                            weights=[0.7, 0.1, 0.1, 0.1]
                        )[0]
                        
                        if m_id not in MACHINE_STATE:
                            MACHINE_STATE[m_id] = {"count_in": 0, "count_out": 0, "reject_count": 0}
                            
                        print(f"[SIMULATOR] Discovered new machine {m_id}, starting simulation (mode={mode})")
                        task = asyncio.create_task(simulate_machine(client, m_id, base_mult, mode, t_start))
                        ACTIVE_TASKS[m_id] = {"task": task, "mode": mode, "base_mult": base_mult}
        except Exception as e:
            print(f"[ERROR] Discovery loop failed: {e}")
            
        await asyncio.sleep(10) # Check for new machines every 10s

async def main() -> None:
    print(f"[SIMULATOR] This is a development/demo tool. Not for production use.\n")

    # Hardcoded machines just to ensure they exist on startup
    INITIAL_MACHINES = {
        "machine-001": (1.0, "normal"),
        "machine-002": (1.2, "fault_vibration"),
        "machine-003": (0.8, "normal"),
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        # Register initial machines
        for i, (m_id, _) in enumerate(INITIAL_MACHINES.items()):
            await register_machine(client, m_id, f"Machine {m_id.split('-')[-1]}", power_kw=5.0 * (i+1))
            
        # Start discovery loop (which will also pick up the initial machines)
        await discover_and_simulate(client)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[SIMULATOR] Stopped.")
