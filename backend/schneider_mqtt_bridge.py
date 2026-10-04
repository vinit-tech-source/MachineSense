import asyncio
import json
import logging
import os
import random
from datetime import datetime, timezone

from pymodbus.client import AsyncModbusTcpClient
import paho.mqtt.client as mqtt

# --- Configuration ---
MODBUS_HOST = os.getenv("MODBUS_HOST", "192.168.1.100") # IP of the PM5000 meter
MODBUS_PORT = int(os.getenv("MODBUS_PORT", 502))
MQTT_BROKER = os.getenv("MQTT_BROKER", "127.0.0.1")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "factory/site/line/machine-001/electrical")
MACHINE_ID = "machine-001"

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

def get_mqtt_client():
    client = mqtt.Client()
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()
        return client
    except Exception as e:
        logging.error(f"Failed to connect to MQTT Broker: {e}")
        return None

async def read_schneider_meter():
    """Reads power metrics from a Schneider Electric PM5000 series meter over Modbus TCP."""
    mqtt_client = get_mqtt_client()
    if not mqtt_client:
        return

    # Connect to the Schneider meter via Modbus TCP
    modbus_client = AsyncModbusTcpClient(MODBUS_HOST, port=MODBUS_PORT)
    # NOTE: In a real environment, uncomment the following line to connect:
    # await modbus_client.connect()
    
    # if not modbus_client.connected:
    #     logging.error(f"Could not connect to Schneider Meter at {MODBUS_HOST}:{MODBUS_PORT}")
    #     return

    logging.info(f"Initialized Schneider Modbus Reader (Target: {MODBUS_HOST}:{MODBUS_PORT})")
    logging.info("NOTE: Running in demo mode. Connect to a real meter by uncommenting 'modbus_client.connect()'.")
    
    try:
        while True:
            try:
                # ==============================================================================
                # REAL IMPLEMENTATION (when connected to a PM5000 meter):
                # ------------------------------------------------------------------------------
                # PM5000 uses IEEE 32-bit floats spanning 2 registers.
                # Example: Current L1 is at address 3000, Voltage L1-N is at 3028.
                #
                # from pymodbus.payload import BinaryPayloadDecoder
                # from pymodbus.constants import Endian
                #
                # response = await modbus_client.read_holding_registers(3000, 2, slave=1)
                # decoder = BinaryPayloadDecoder.fromRegisters(response.registers, byteorder=Endian.Big, wordorder=Endian.Little)
                # current = decoder.decode_32bit_float()
                # ==============================================================================

                # For demo purposes, we generate some synthetic data close to what a PM5000 returns
                voltage = 230.0 + random.gauss(0, 1.0)
                current = 10.5 + random.gauss(0, 0.2)
                power_factor = min(1.0, 0.95 + random.gauss(0, 0.01))
                
                # Other sensor data (Vibration, Temp) would typically come from an EcoStruxure Edge Gateway 
                # or secondary Modbus I/O modules connected to the same network.
                vibration = 2.1 + random.gauss(0, 0.1)
                temp_c = 65.0 + random.gauss(0, 0.5)
                rpm = 1450.0 + random.gauss(0, 2.0)

                payload = {
                    "machine_id": MACHINE_ID,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "current_a": round(current, 3),
                    "voltage_v": round(voltage, 3),
                    "power_factor": round(power_factor, 3),
                    "vibration_mm_s": round(vibration, 3),
                    "temp_c": round(temp_c, 3),
                    "rpm": round(rpm, 1),
                    "source": "schneider_pm5000_gateway",
                    # Added for MachineSense expected fields
                    "count_in": 1,
                    "count_out": 1,
                    "reject_count": 0
                }

                mqtt_client.publish(MQTT_TOPIC, json.dumps(payload), qos=1)
                logging.info(f"Published Modbus reading to {MQTT_TOPIC}")

            except Exception as e:
                logging.error(f"Error reading from Modbus: {e}")

            await asyncio.sleep(5)  # Poll every 5 seconds (industrial standard polling rate)
            
    except KeyboardInterrupt:
        logging.info("Stopping reader...")
    finally:
        modbus_client.close()
        mqtt_client.loop_stop()

if __name__ == "__main__":
    asyncio.run(read_schneider_meter())
