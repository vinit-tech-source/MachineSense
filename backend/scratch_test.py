import sys
import os
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from simulator.simulate import generate_reading
from app.services.anomaly_service import get_baseline

def run_test():
    baseline = get_baseline("test-machine-2")
    
    warnings = 0
    criticals = 0
    normals = 0
    
    for i in range(200):
        t = i * 3.0
        reading = generate_reading("normal", t)
        
        status, contribs, reason = baseline.evaluate(reading)
        if status.value == "warning":
            warnings += 1
            print(f"[{i}] WARNING: {reason}")
        elif status.value == "critical":
            criticals += 1
            print(f"[{i}] CRITICAL: {reason}")
        else:
            normals += 1
            
        baseline.add(reading)
        
    print(f"Total readings: 200")
    print(f"Normals: {normals}")
    print(f"Warnings: {warnings}")
    print(f"Criticals: {criticals}")
    
if __name__ == "__main__":
    run_test()
