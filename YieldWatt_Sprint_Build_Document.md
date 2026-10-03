# YieldWatt / MachineSense
# Complete Technical Build Document — Sprint by Sprint
### From Bare Sensors → Full AI-Powered Factory Intelligence Platform

---

> **Document version:** 1.0  
> **Prepared for:** Manufacturing SME stakeholders, development team  
> **Coverage:** Hardware → Data → ML Models → Automation → Insight → Business ROI

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Sprint 1 — Sensor Selection, Purpose & Wiring](#sprint-1--sensor-selection-purpose--wiring)
3. [Sprint 2 — Sensor Data Ingestion & Storage](#sprint-2--sensor-data-ingestion--storage)
4. [Sprint 3 — ML Model Training & Baseline Learning](#sprint-3--ml-model-training--baseline-learning)
5. [Sprint 4 — Real-Time Anomaly Detection & Decision Engine](#sprint-4--real-time-anomaly-detection--decision-engine)
6. [Sprint 5 — Automated Control & Notification System](#sprint-5--automated-control--notification-system)
7. [Sprint 6 — Date/Time Comparative Analysis & Production Intelligence](#sprint-6--datetime-comparative-analysis--production-intelligence)
8. [Sprint 7 — Dashboards, Reports & Business Insights](#sprint-7--dashboards-reports--business-insights)
9. [Full System Architecture Diagram](#full-system-architecture-diagram)
10. [Technology Stack Summary](#technology-stack-summary)
11. [ROI & Business Case](#roi--business-case)

---

## Executive Summary

YieldWatt is a real-time industrial IoT + AI platform for small and medium manufacturing plants.
It collects raw electrical, thermal, mechanical, and process data from existing machines, learns their
healthy operating patterns, detects abnormalities, automatically controls connected actuators (cooling fans,
air compressors, alarms), and delivers daily production intelligence that tells supervisors **exactly why
today's output differed from yesterday's.**

The system never shuts down a machine autonomously. All actuator actions are advisory, logged, and
require operator confirmation via Telegram or the dashboard — unless the operator has pre-authorised
automatic actions for specific conditions (e.g., "start cooling fan if temp > 80°C").

---

## Sprint 1 — Sensor Selection, Purpose & Wiring

**Duration:** 2 weeks  
**Goal:** Select, procure, install, and wire all sensors for a single machine (M1). Validate live data flow.

---

### 1.1 — The Full Sensor Set (Per Machine)

---

#### SENSOR 1 — Current Sensor (PZEM-004T v3.0)
| Attribute | Value |
|-----------|-------|
| **Measures** | Current (A), Voltage (V), Active Power (W), Energy (kWh), Power Factor, Frequency (Hz) |
| **Why we need it** | The single most important sensor. Current draw is the direct signature of machine load. A motor pulling 15A when it normally pulls 10A is working harder — bearing friction, misalignment, or overload. |
| **Conclusions it gives us** | Is the machine running? Is it loaded or idle? Is it drawing excess current (fault developing)? Is power factor dropping (winding insulation degradation)? |
| **Cost (India)** | ₹400 – ₹700 per unit |
| **Where to buy** | Robu.in, Evelta, Amazon India |
| **How to connect to machine** | Clamp the current transformer (CT) around one phase wire of the machine's power supply cable. No need to cut wires. CT clamps are non-invasive. |
| **How to connect to software** | PZEM-004T → UART/RS485 → ESP32 microcontroller → MQTT/HTTP → YieldWatt backend. ESP32 reads via SoftwareSerial on pins RX/TX (GPIO16/17). |

---

#### SENSOR 2 — Vibration Sensor (SW-420 or ADXL345 or MPU-6050)
| Attribute | Value |
|-----------|-------|
| **Measures** | Vibration amplitude (mm/s RMS), acceleration (g), shock events |
| **Why we need it** | Vibration is the earliest indicator of bearing failure, shaft imbalance, or loose fasteners. A healthy bearing vibrates at < 3 mm/s; a failing one at > 8 mm/s weeks before it seizes. |
| **Conclusions it gives us** | Is the bearing developing a fault? Is the shaft misaligned? Is something mechanically loose? RUL (Remaining Useful Life) estimate. |
| **Which to choose** | ADXL345 or MPU-6050 for precision digital readings via I2C; SW-420 for simple threshold digital trigger (less precise) |
| **Cost (India)** | SW-420: ₹30; ADXL345: ₹150–250; MPU-6050: ₹100–180 |
| **Where to buy** | Robu.in, Electronicscomp, Amazon India |
| **How to connect to machine** | Mount directly on the bearing housing or motor frame using adhesive or magnetic mount. Location should be < 50 mm from the bearing. |
| **How to connect to software** | MPU-6050/ADXL345 → I2C (SDA/SCL) → ESP32 → MQTT. RMS vibration computed in ESP32 firmware over 512-sample windows. |

---

#### SENSOR 3 — Temperature Sensor (DS18B20 or NTC Thermistor or MLX90614)
| Attribute | Value |
|-----------|-------|
| **Measures** | Surface / ambient temperature in °C |
| **Why we need it** | Excess heat indicates friction (bearing failure), overload, poor cooling, or electrical fault. Temperature rise precedes most mechanical failures by hours to days. |
| **Conclusions it gives us** | Is the machine overheating? Is the cooling system effective? Is there thermal asymmetry indicating partial winding fault? |
| **Which to choose** | DS18B20 (contact, ±0.5°C, cheap) for motor body; MLX90614 (non-contact IR) for fast-rotating shafts or hazardous surfaces |
| **Cost (India)** | DS18B20: ₹50–80; MLX90614: ₹400–600 |
| **Where to buy** | Robu.in, Amazon India |
| **How to connect to machine** | DS18B20: Attach to motor casing with thermal paste + zip tie. MLX90614: Mount 2–5 cm away from target surface. |
| **How to connect to software** | DS18B20 → 1-Wire protocol → ESP32 (GPIO4) → MQTT. MLX90614 → I2C → ESP32. |

---

#### SENSOR 4 — RPM / Tachometer (Hall Effect Sensor — A3144)
| Attribute | Value |
|-----------|-------|
| **Measures** | Shaft rotational speed in RPM |
| **Why we need it** | A motor running at 1350 RPM when it should be at 1450 RPM is slipping more than it should — indicating overload or a mechanical resistance (stuck conveyor, jammed process). |
| **Conclusions it gives us** | Is the motor loaded beyond capacity? Is there a downstream mechanical fault? Is the process running at correct speed? |
| **Cost (India)** | ₹20–50 for Hall Effect sensor; a small magnet on the shaft |
| **Where to buy** | Robu.in, Amazon India |
| **How to connect to machine** | Fix a small neodymium magnet on the shaft (or coupling). Mount Hall Effect sensor 2–3 mm away, pointing at magnet. Each magnet pass = 1 pulse. |
| **How to connect to software** | Hall sensor → GPIO interrupt pin on ESP32 → Calculate RPM as (pulses/second × 60). Send via MQTT. |

---

#### SENSOR 5 — Pressure Sensor (0-10 Bar, 4-20mA or I2C — BMP388 or HX710)
| Attribute | Value |
|-----------|-------|
| **Measures** | Air / fluid pressure in Bar or PSI |
| **Why we need it** | For air compressors, hydraulic systems, or pneumatic presses. Compressor output pressure dropping over time = gradual air leak. Spike in pressure = blocked line. |
| **Conclusions it gives us** | Is the compressor delivering rated pressure? Is there a leak? Is a pneumatic actuator malfunctioning? |
| **Cost (India)** | BMP388: ₹350–500; 4-20mA transducers: ₹500–1500 |
| **Where to buy** | Robu.in, Amazon Industrial |
| **How to connect to machine** | Screw into existing pressure test port (BSP/NPT thread) on air line, hydraulic line, or compressor outlet. |
| **How to connect to software** | I2C: BMP388 → ESP32 directly. 4-20mA: → 250Ω resistor → 0-5V → ADC pin on ESP32 (or ADS1115 for better precision). |

---

#### SENSOR 6 — Production Counter (IR Proximity — E18-D80NK or Photoelectric)
| Attribute | Value |
|-----------|-------|
| **Measures** | Count of parts passing a detection point (inlet and exit separately) |
| **Why we need it** | The only true measure of output. SEC (Specific Energy Consumption) = kWh / Good Units. Without this, we can only track kWh but never efficiency. |
| **Conclusions it gives us** | How many units were produced per shift? What is the reject rate? What is the kWh per good unit today vs yesterday? |
| **Cost (India)** | ₹150–400 per sensor |
| **Where to buy** | Amazon India, IndiaMart, Robu.in |
| **How to connect to machine** | Mount at the exit point of the machine (conveyor belt, punch press exit, lathe exit). Each part breaks the beam = +1 count. |
| **How to connect to software** | Output pin → GPIO interrupt on ESP32 → increment counter → send accumulated count via MQTT with each reading. Separate inlet counter optional (for WIP tracking). |

---

#### SENSOR 7 — Reject Button (Momentary Push Button + Pull-up Resistor)
| Attribute | Value |
|-----------|-------|
| **Measures** | Operator-logged reject events |
| **Why we need it** | Automatically counted parts include rejects. The operator presses this button once for each reject. reject_count feeds the SEC calculation and energy waterfall (reject kWh bucket). |
| **Conclusions it gives us** | True yield rate. kWh wasted on rejected parts. Days with high reject rates correlated with operator shifts, temperature, raw material batches. |
| **Cost (India)** | ₹20–50 |
| **How to connect** | Button → GPIO pin (with pull-up) → ESP32. Debounced in firmware. Sent as cumulative `reject_count` in each MQTT message. |

---

#### SENSOR 8 — Ambient Temperature & Humidity (DHT22 / BME280)
| Attribute | Value |
|-----------|-------|
| **Measures** | Ambient air temperature (°C) and relative humidity (%) |
| **Why we need it** | High ambient temperature affects machine cooling. High humidity affects electronics and metal cutting. Day-to-day production comparison must account for ambient conditions. |
| **Conclusions it gives us** | Was poor performance today caused by a 5°C hotter workshop? Was the machine not at fault at all? |
| **Cost (India)** | DHT22: ₹100–150; BME280: ₹200–400 |
| **How to connect** | Mount near machine (not on it). DHT22 → single-wire GPIO. BME280 → I2C. |

---

### 1.2 — Bill of Materials Per Machine (Single Machine Node)

| Component | Part | Cost (₹) |
|-----------|------|-----------|
| Microcontroller | ESP32 Dev Board (30-pin) | 400–600 |
| Current / Energy | PZEM-004T v3.0 | 500 |
| Vibration | MPU-6050 | 150 |
| Temperature (Motor) | DS18B20 waterproof | 80 |
| Temperature (Ambient) | DHT22 | 130 |
| RPM | A3144 Hall + magnet | 50 |
| Pressure (Compressor only) | HX710 / BMP388 | 450 |
| Counter (IR) | E18-D80NK × 2 | 600 |
| Reject Button | Push button | 30 |
| Enclosure | IP65 ABS box | 300 |
| PCB / Breadboard + wires | — | 200 |
| Power supply (5V) | HLK-5M05 | 150 |
| **TOTAL** | | **~₹3,000–4,000** |

---

### 1.3 — ESP32 Firmware Architecture

```
ESP32 (Per Machine Node)
│
├── WiFi / MQTT connection (PubSubClient or aiomqtt)
│   └── publishes to: factory/site/line/{machine_id}/electrical
│
├── Sensor reading loop (every 10 seconds)
│   ├── PZEM-004T  → current_a, voltage_v, power_w, energy_kwh, power_factor
│   ├── MPU-6050   → compute RMS vibration in m/s², convert to mm/s
│   ├── DS18B20    → temp_c (motor body)
│   ├── DHT22      → ambient_temp_c, humidity_pct
│   ├── Hall ISR   → rpm (interrupt-driven counter)
│   ├── IR counter → count_in, count_out (interrupt-driven)
│   └── Reject btn → reject_count (interrupt-driven, debounced)
│
├── JSON payload assembly
│   └── {"machine_id": "M1", "current_a": 10.5, "rpm": 1447, ...}
│
├── MQTT publish (QoS 1, retained=false)
│
└── Store-and-forward buffer (ring buffer, 50 readings)
    └── Retransmit when WiFi reconnects
```

---

## Sprint 2 — Sensor Data Ingestion & Storage

**Duration:** 2 weeks  
**Goal:** Reliable ingestion of all sensor streams, validated storage in PostgreSQL, and real-time WebSocket feed to the dashboard.

---

### 2.1 — Ingestion Architecture

```
[ESP32 Nodes] → MQTT Broker (Mosquitto / HiveMQ)
                     │
               [YieldWatt Backend — FastAPI]
                     │
               mqtt_service.py (subscriber loop)
                     │
               ingestion_service.py (process_reading pipeline)
                     │
          ┌──────────┼──────────┐
          │          │          │
   anomaly_service  power_service  baseline learning
          │          │
   SensorReading  EnergySession
   (PostgreSQL)   (PostgreSQL)
          │
   ws_manager.broadcast()
          │
   [React Dashboard — WebSocket]
```

### 2.2 — Data Validation Rules (Per Reading)

| Field | Type | Valid Range | Action if Invalid |
|-------|------|-------------|-------------------|
| current_a | float | 0 – 200A | Reject, log warning |
| voltage_v | float | 180 – 260V | Reject, log warning |
| vibration_mm_s | float | 0 – 50 mm/s | Reject if negative |
| temp_c | float | -40 – 200°C | Reject if out of range |
| rpm | float | 0 – 100,000 | Reject if negative |
| power_factor | float | 0 – 1 | Clip to [0,1] |
| pressure_bar | float | 0 – 15 bar | Reject if negative |
| count_in / out | int | 0 – unlimited | Reject if delta > 1000 |

### 2.3 — Data Table Structure (PostgreSQL)

**`sensor_readings`** — raw telemetry (1 row per reading, ~10s intervals)  
**`energy_sessions`** — per-shift energy accumulators (kWh, cost, CO2e, good_units, SEC, waterfall buckets)  
**`alert_records`** — every fired anomaly alert with contributions and evidence  
**`machines`** — machine configuration (name, rated power, tariff, location)  
**`baseline_samples`** — the rolling window of recent readings used to compute each machine's healthy baseline  
**`maintenance_logs`** — engineer-entered events that trigger a baseline reset  
**`daily_summaries`** — pre-computed daily aggregates for comparative analysis  

### 2.4 — Data Volume Estimate

| Metric | Value |
|--------|-------|
| Reading interval | 10 seconds |
| Fields per reading | 15 |
| Readings per machine per day | 8,640 |
| Machines on a 10-machine line | 10 |
| Rows per day | 86,400 |
| Storage per row | ~300 bytes |
| Storage per day | ~26 MB |
| Storage per year | ~9.5 GB |
| Retention strategy | Raw data: 90 days; 1-min rollups: 1 year; 15-min rollups: 5 years |

---

## Sprint 3 — ML Model Training & Baseline Learning

**Duration:** 3 weeks  
**Goal:** Train the initial healthy-baseline model per machine, validate it, and deploy it for live inference.

---

### 3.1 — Why Train Per Machine?

Every machine behaves differently. A 5.5 kW lathe has different current signatures than a 7.5 kW press.
Even two identical machines in the same factory differ because of age, installation, lubrication, and load profile.
**We do not use a generic model. We train one model per machine from that machine's own healthy data.**

---

### 3.2 — Training Data Requirements

| Phase | Data Needed | Duration |
|-------|-------------|----------|
| **Commissioning period** | Machine running in known-healthy state | Minimum 5 days (60 readings minimum per baseline window) |
| **Labelled anomaly data** | Optional — manually trigger and log faults (vibration fault, temp fault, overload) | 1–2 days with the simulator |
| **Seasonal variation** | Data across different ambient temperatures and load levels | Ideally 2–4 weeks |

**For new machines with zero history:** The simulator generates statistically realistic 48-hour pre-seeded data using the machine's rated parameters (power, voltage, RPM) as the baseline. This gives the model enough samples to start on day 1.

---

### 3.3 — Model Architecture: Unsupervised Baseline (Sprint 3a)

**Algorithm:** Rolling-window Median + MAD (Median Absolute Deviation)  
**Why this?** It requires zero labelled fault data. It works with as few as 60 samples. It is robust to outliers.

**Mathematical model per signal:**

```
For each signal s (current, voltage, vibration, temp, rpm):
  baseline_median[s] = median(last N readings of s)
  MAD[s] = median(|readings[s] - baseline_median[s]|)
  modified_z_score[s] = 0.6745 × (current_value[s] - baseline_median[s]) / MAD[s]
  ANOMALY if |modified_z_score[s]| > threshold (default: 3.5)
```

**What this tells us:**
- Computes the machine's "fingerprint" — what is normal for THIS machine
- Detects when any signal deviates statistically significantly from that fingerprint
- Works even if the machine is at high load — it's deviation from the *machine's own normal*, not from a fixed limit

---

### 3.4 — Model Architecture: Multi-Signal Correlation (Sprint 3b)

**Algorithm:** Mahalanobis Distance  
**Why this?** Individual signals can be normal, but the combination can be wrong.

**Example:**
- Current = 12A (elevated but not alarming)
- Vibration = 4 mm/s (elevated but not alarming)
- Temp = 72°C (elevated but not alarming)
- **Together:** This exact combination is highly unusual. Mahalanobis catches it. Z-score per signal misses it.

```python
# Mahalanobis distance formula
D² = (x - μ)ᵀ × Σ⁻¹ × (x - μ)

# Where:
# x = current signal vector [current, vibration, temp, rpm]
# μ = baseline mean vector
# Σ = covariance matrix of baseline data
# D > threshold → multi-signal anomaly
```

---

### 3.5 — Model Architecture: RUL (Remaining Useful Life) Estimation (Sprint 3c)

**Algorithm:** Trend analysis on compound degradation score

```
For each reading:
  vib_z  = modified_z_score(vibration_mm_s)
  temp_z = modified_z_score(temp_c)
  degradation_score = max(vib_z, temp_z, 0)   # only upward drift matters

Smooth with exponential moving average (α = 0.1)

est_days_remaining = RUL_max × (1 - (smoothed_score / critical_threshold))
```

This gives the dashboard the "Days to Next Service" countdown bar.

---

### 3.6 — Testing the Model

Before deploying to production, we run 3 tests:

| Test | What We Do | Pass Criterion |
|------|------------|---------------|
| **False positive rate** | Feed 1,000 known-good readings | < 1% flagged as anomaly |
| **Detection sensitivity** | Inject simulated faults (vib +8 mm/s, temp +30°C, current +12A) | > 95% detected within 3 readings |
| **RUL accuracy** | Simulate gradual drift over 50 readings | RUL countdown monotonically decreases |

---

### 3.7 — Model Retraining Triggers

| Event | Action |
|-------|--------|
| Engineer logs a maintenance event | Discard pre-maintenance readings, start fresh baseline |
| Model false positive rate > 5% in 24h | Alert ML engineer to review |
| Machine upgraded (new bearings, rewound motor) | Force rebaseline after commissioning confirmation |
| Seasonal shift (ambient temp Δ > 10°C from training data) | Weight recent readings 3× in baseline |

---

## Sprint 4 — Real-Time Anomaly Detection & Decision Engine

**Duration:** 2 weeks  
**Goal:** Every incoming reading is evaluated in < 200ms. Decisions are logged with full explainability.

---

### 4.1 — Decision Flow Per Reading

```
Incoming sensor reading
        │
        ▼
Is this machine's baseline ready? (≥ 60 samples)
        │
   NO ──┤── Display "Calibrating..." on dashboard. Store reading.
        │
   YES  ▼
Compute Z-scores for all 5 signals
        │
        ▼
Apply "High Load Guard":
  IF operating_state == HIGH_LOAD AND SEC is flat:
     → Signal is NOT a fault. Suppress anomaly.
     → Reason: "High load, efficient production — not a fault."
        │
        ▼
Is any signal's |Z-score| > 3.5?
        │
   NO ──┤── status = NORMAL. Store reading. Update baseline.
        │
   YES  ▼
Which signals are firing?
        │
        ▼
Apply evidence stacking:
  - supporting signals (multiple signals elevated) → raise severity
  - contradicting signals (RPM normal, vibration elevated) → note in reason
        │
        ▼
Build plain-language reason:
  "Current draw 2.3× above baseline (12.4A vs 5.4A median).
   Motor temperature also elevated (+12°C). Possible: bearing friction,
   overload, or cooling failure. RPM is normal — mechanical seizure unlikely."
        │
        ▼
Assign severity: WARNING (1 signal) or CRITICAL (2+ signals or Z > 6)
        │
        ▼
Store AlertRecord with contributions JSON
        │
        ▼
Trigger notification → Telegram (Hindi) + Dashboard WebSocket
```

---

### 4.2 — Fault Hypothesis Table (What Each Signal Combination Means)

| Signal Combination | Hypothesis | Confidence |
|-------------------|------------|-----------|
| Current↑ + Temp↑ + Vibration↑ | Bearing failure (classic triad) | A (High) |
| Vibration↑ only | Shaft imbalance or looseness | B (Medium) |
| Temp↑ + Current↑, RPM normal | Cooling failure or overload | B (Medium) |
| Current↑ only, others normal | Partial overload or load increase | C (Low) |
| RPM↓ + Current↑ | Mechanical resistance downstream (jam) | A (High) |
| Pressure↓ (compressor) | Air leak developing | A (High) |
| Vibration↑ + Temp↑, Current normal | External vibration, heating problem | B (Medium) |
| Power factor↓ only | Winding insulation degradation | A (High) |

---

## Sprint 5 — Automated Control & Notification System

**Duration:** 2 weeks  
**Goal:** System advises or automatically controls actuators based on live sensor state. All actions are logged.

---

### 5.1 — The Control Philosophy

> **The system never overrides operator intent.**  
> Advisory mode: System suggests → Operator approves via Telegram button.  
> Automatic mode: Pre-approved by the operator for specific, safe conditions only.

---

### 5.2 — Actuator Connections

To physically control machines or auxiliary equipment, the ESP32 node (or a separate Raspberry Pi) connects to:

| Actuator | Control Method | Hardware Required | Cost (₹) |
|----------|---------------|-------------------|-----------|
| Cooling fan (industrial) | Relay module | 5V relay, NC contacts | 80–150 |
| Air compressor | Relay or Modbus command | 5V relay | 80 |
| Alarm buzzer | Digital output | Piezo buzzer | 30 |
| Conveyor belt (slow/stop) | Modbus RTU / VFD input | RS485 → VFD control | 500–2000 |
| Machine warning light (Andon) | Digital output | 24V RGB tower light | 1000–2500 |

---

### 5.3 — Automated Rules Engine

Each rule consists of: **Condition → Actuator Action → Log Entry → Notification**

---

**RULE 1 — Thermal Protection (Cooling Fan)**
```
IF machine.temp_c > machine.temp_threshold_high (default: 80°C)
    AND status in [WARNING, CRITICAL]
    THEN:
        → Turn ON cooling fan relay (GPIO HIGH)
        → Log: "Cooling fan started. Temp: 82°C. Threshold: 80°C."
        → Telegram: "🌡 M1 ज़्यादा गर्म (Overheating). कूलिंग फैन चालू किया।"
        → Dashboard: orange indicator on Machine card

IF machine.temp_c < machine.temp_threshold_low (default: 65°C)
    AND cooling_fan is ON
    THEN:
        → Turn OFF cooling fan relay (GPIO LOW)
        → Log: "Cooling fan stopped. Temp normalised: 64°C."
        → Telegram: "✅ M1 तापमान सामान्य। कूलिंग फैन बंद किया। ऊर्जा बचत।"
        → Dashboard: green indicator, idle_kwh bucket increases
```

---

**RULE 2 — Pressure Recovery (Compressor)**
```
IF compressor.pressure_bar < 4.5 (rated: 6.5 bar)
    AND pressure_drop_rate > 0.5 bar/min
    THEN:
        → ADVISORY: Telegram button "Start compressor?" or "Inspect for leak?"
        → If operator confirms → start_compressor via relay
        → If no response in 10 min → escalate to shift supervisor

IF compressor.pressure_bar > 7.5 (overpressure)
    THEN:
        → AUTOMATIC: Stop compressor relay
        → Critical alert: "⛔ Overpressure! Compressor stopped automatically."
```

---

**RULE 3 — Idle Waste Reduction**
```
IF machine.operating_state == IDLE
    AND machine.current_a > machine.idle_threshold
    AND duration_idle > 15 minutes
    THEN:
        → ADVISORY: Telegram: "⚡ M1 15 मिनट से खाली चल रही है। बंद करें?"
        → Idle_kwh bucket increments
        → Dashboard: idle waste insight card shown
```

---

**RULE 4 — Production Jam / Downstream Block**
```
IF rpm < rpm_baseline × 0.85
    AND current > current_baseline × 1.15
    AND count_in > count_out (WIP building up)
    THEN:
        → ADVISORY: "🚫 M1 पर रुकावट लग रही है। लाइन की जाँच करें।"
        → Status → CRITICAL
```

---

### 5.4 — Telegram Bot Commands

Operators can send these commands directly in the Telegram group:

| Command | Action |
|---------|--------|
| `/status M1` | Get current reading, status, RUL for M1 |
| `/start_fan M1` | Manually start cooling fan on M1 |
| `/stop_fan M1` | Manually stop cooling fan on M1 |
| `/silence M1 30` | Suppress alerts for M1 for 30 minutes |
| `/report today` | Get today's full production and energy report |
| `/compare M1 yesterday` | Get yesterday vs today comparison for M1 |

---

## Sprint 6 — Date/Time Comparative Analysis & Production Intelligence

**Duration:** 3 weeks  
**Goal:** Automatically detect and explain production anomalies using historical data. Answer "why was today different?"

---

### 6.1 — The Core Question

> **Day A:** Machine ran 6 hours. 100 units produced.  
> **Day B:** Machine ran 6 hours. 70 units produced.  
> **What happened?**

The system answers this by comparing all available dimensions across the two periods.

---

### 6.2 — Comparison Dimensions

For each pair of days/shifts, the system compares:

| Dimension | Day A (Good) | Day B (Poor) | Delta |
|-----------|-------------|-------------|-------|
| Run hours | 6.0h | 6.0h | 0 |
| Good units | 100 | 70 | **-30** |
| Reject count | 5 | 22 | **+17** ⚠ |
| SEC (kWh/unit) | 0.8 | 1.3 | **+63%** ⚠ |
| Avg current (A) | 10.3 | 11.8 | **+14%** ⚠ |
| Avg vibration (mm/s) | 2.2 | 4.1 | **+87%** ⚠ |
| Avg temp (°C) | 64 | 71 | **+11%** |
| Avg RPM | 1452 | 1438 | **-1%** |
| Avg ambient temp | 28°C | 35°C | **+7°C** |
| Idle time | 22 min | 48 min | **+26 min** ⚠ |
| Alerts fired | 1 | 7 | **+6** ⚠ |
| Power factor avg | 0.87 | 0.81 | **-7%** |

---

### 6.3 — Automated Root Cause Analysis

The system weights these deltas and generates a ranked list of probable causes:

```
=== DAY-OVER-DAY ANALYSIS: M1 — Oct 3 vs Oct 2 ===

Production dropped 30% (100 → 70 units).
Run time was identical. Here are the probable causes, ranked:

1. [HIGH CONFIDENCE] Mechanical degradation:
   Vibration rose 87% (2.2 → 4.1 mm/s). This matches a developing
   bearing fault, confirmed by 7 alerts vs 1 on the good day.
   Impact: ~12–15 lost units from machine slowdowns and stops.

2. [MEDIUM CONFIDENCE] Elevated reject rate:
   Rejects rose from 5 to 22. This is consistent with vibration-induced
   dimensional inaccuracy in the machined parts.
   Impact: ~17 reject units, ~₹850 wasted material + ₹2.3 wasted energy.

3. [MEDIUM CONFIDENCE] Ambient temperature effect:
   Workshop was 7°C hotter than reference day.
   This contributed to motor temp (+7°C) and may have softened material
   tolerances slightly.

4. [LOW CONFIDENCE] Increased idle time:
   26 extra minutes of idle time wasted 0.3 kWh and reduced
   effective run time by 7%.

=== RECOMMENDED ACTIONS ===
  ① Schedule bearing inspection for M1 (RUL: 12 days remaining)
  ② Review reject parts with QC — dimensional defect likely
  ③ Ensure cooling fans run when ambient > 32°C (automated rule exists)
  ④ Review idle gaps — two 13-minute breaks without production
```

---

### 6.4 — Daily Summary Computation (Automated at Shift End)

At 22:00 every day, a background job computes and stores:

```python
class DailySummary:
  date: date
  machine_id: str
  
  # Production
  total_run_hours: float
  good_units: int
  reject_units: int
  yield_pct: float         # good / (good + reject) × 100
  
  # Energy
  total_kwh: float
  productive_kwh: float
  idle_kwh: float
  reject_kwh: float
  degradation_kwh: float
  peak_kwh: float
  total_cost_inr: float
  co2e_kg: float
  sec: float               # kWh / good_unit — THE key metric
  
  # Signals (averages for comparison)
  avg_current_a: float
  avg_vibration_mm_s: float
  avg_temp_c: float
  avg_rpm: float
  avg_power_factor: float
  avg_ambient_temp_c: float
  
  # Events
  alert_count: int
  idle_minutes: int
  
  # ML outputs
  rul_days_at_end: int
  degradation_score: float
```

---

### 6.5 — Trend Analysis Reports (Weekly / Monthly)

| Report | Content | Delivery |
|--------|---------|---------|
| **Daily Shift Report** | Production vs target, top 3 alerts, SEC trend | Telegram at 22:00 |
| **Weekly Efficiency** | SEC trend per machine, idle waste, reject patterns | Dashboard PDF every Monday |
| **Monthly Energy** | Total kWh, cost, CO2e, waterfall breakdown, best/worst days | Dashboard PDF on 1st |
| **RUL Service Planner** | Which machines need service in next 30 days, ordered by urgency | Dashboard weekly |

---

## Sprint 7 — Dashboards, Reports & Business Insights

**Duration:** 2 weeks  
**Goal:** Unified interface showing all machine health, energy, and production intelligence in one place.

---

### 7.1 — Dashboard Screens

| Screen | Key Widgets |
|--------|-------------|
| **Fleet Overview** | All machines: status dot, SEC, RUL days, live kW |
| **Machine Detail** | Operating state, status card, RUL countdown, vibration/temp trends |
| **Energy Panel** | Instantaneous kW, session kWh, cost (₹), CO2e, waterfall chart |
| **Alert Log** | All alerts with signal contributions, evidence grade (A/B/C), safe-to-act flag |
| **History Trends** | Multi-signal chart, time range selector, export to CSV |
| **Day Comparison** | Side-by-side table + root cause narrative for any two days |
| **Settings** | Machine CRUD, tariff config, alert thresholds, Telegram config |

---

### 7.2 — Business Conclusions the System Provides

Every day, shift supervisors and plant managers can read these answers from the dashboard:

**Energy:**
- How much energy did each machine consume? (kWh, ₹, kg CO₂e)
- What percentage was productive vs wasted (idle + reject + degradation)?
- Which machine has the worst SEC? By how much?
- Are we in peak tariff hours? Should we reschedule heavy loads?

**Production:**
- What is today's good unit count per machine?
- What is the reject rate? Which machine is responsible?
- Why did output drop vs yesterday? (automated narrative)
- Which machine is the production bottleneck?

**Maintenance:**
- Which machine is closest to needing service? (RUL countdown)
- Has any machine's vibration/temperature been trending up over the past 7 days?
- Was the last maintenance event effective? (compare pre/post baseline)

**Financial:**
- How much did idle waste cost this week in electricity?
- How much did the degraded bearing on M1 cost in excess energy this month?
- If we fix M1's bearing, how much will we save per month?

---

## Full System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        FACTORY FLOOR                        │
│                                                             │
│  [Machine M1]     [Machine M2]     [Machine M3]             │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐            │
│  │ ESP32    │     │ ESP32    │     │ ESP32    │            │
│  │ Sensors: │     │ Sensors: │     │ Sensors: │            │
│  │ PZEM-004T│     │ PZEM-004T│     │ PZEM-004T│            │
│  │ MPU-6050 │     │ MPU-6050 │     │ + Pressure           │
│  │ DS18B20  │     │ DS18B20  │     │ Sensor   │            │
│  │ Hall RPM │     │ Hall RPM │     │          │            │
│  │ IR Count │     │ IR Count │     │          │            │
│  │ Reject   │     │ Reject   │     │          │            │
│  └────┬─────┘     └────┬─────┘     └────┬─────┘            │
│       │               │               │                     │
└───────┼───────────────┼───────────────┼─────────────────────┘
        │               │               │
        └───────────────┴───────────────┘
                    WiFi / LAN
                        │
              ┌──────────────────┐
              │  MQTT Broker     │
              │  (Mosquitto)     │
              └────────┬─────────┘
                       │
              ┌────────▼─────────┐
              │  YieldWatt       │
              │  Backend (FastAPI│
              │  + asyncpg)      │
              │                  │
              │  ingestion_svc   │
              │  anomaly_svc     │
              │  power_svc       │
              │  rules_engine    │
              │  notification_svc│
              └────┬──────┬──────┘
                   │      │
          ┌────────┘      └────────┐
          │                       │
  ┌───────▼──────┐     ┌──────────▼──────┐
  │  PostgreSQL  │     │  React Dashboard │
  │  (raw data,  │     │  (WebSocket live │
  │  sessions,   │     │   feed + REST    │
  │  alerts,     │     │   API)           │
  │  daily_sum)  │     └──────────────────┘
  └──────────────┘
          │
  ┌───────▼──────────────────┐
  │   Background Jobs        │
  │   (APScheduler)          │
  │   - 22:00 daily summary  │
  │   - shift report 8h      │
  │   - RUL recalculation    │
  └──────────────────────────┘
          │
  ┌───────▼──────────────────┐
  │   Telegram Bot           │
  │   - Hindi/Marathi alerts │
  │   - Inline keyboards     │
  │   - /status, /compare    │
  │   - Control commands     │
  └──────────────────────────┘
```

---

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Sensor Node** | ESP32 + C++ (Arduino/IDF) | Reads sensors, publishes MQTT |
| **MQTT Broker** | Mosquitto (Docker) | Message routing |
| **Backend** | Python 3.12 + FastAPI + asyncpg | API, ingestion, ML, rules |
| **Database** | PostgreSQL 16 | Persistent storage |
| **ML/Stats** | NumPy + SciPy (MAD, Mahalanobis) | Baseline, anomaly detection |
| **Task Scheduler** | APScheduler | Daily reports, RUL recalc |
| **Notifications** | Telegram Bot API + httpx | Alerts with inline keyboards |
| **WebSocket** | FastAPI WebSocket + ws_manager | Real-time dashboard feed |
| **Frontend** | React 19 + TypeScript + Vite | Dashboard UI |
| **CSS** | Vanilla CSS (dark mode, CSS variables) | Styling |
| **Charts** | Custom SVG (TrendChart) + Stacked bar (Waterfall) | Visualisations |
| **Deployment** | Docker Compose | Single-command full-stack deploy |

---

## ROI & Business Case

### For a 10-Machine Production Line

| Saving Category | Monthly Saving | Annual Saving |
|-----------------|---------------|--------------|
| **Idle waste elimination** (avg 30 min/machine/day saved) | ₹3,500 | ₹42,000 |
| **SEC improvement** (5% better energy per unit) | ₹6,000 | ₹72,000 |
| **Predictive maintenance** (avoid 2 unplanned breakdowns/year) | ₹8,333 | ₹100,000 |
| **Reject rate reduction** (from 8% to 5% due to early fault detection) | ₹12,000 | ₹144,000 |
| **Peak tariff avoidance** (shift 1h of heavy load to off-peak) | ₹2,500 | ₹30,000 |
| **CO2e reduction** (creditable under green supply chain requirements) | — | 2,400 kg CO₂e |
| **TOTAL** | **₹32,333** | **₹3,88,000** |

### System Investment

| Item | Cost (₹) |
|------|----------|
| Sensors per machine (×10) | 30,000 – 40,000 |
| ESP32 nodes (×10) | 5,000 – 6,000 |
| Raspberry Pi 4 / mini PC (server) | 8,000 – 15,000 |
| Installation + wiring (2 days, 1 technician) | 4,000 – 6,000 |
| Software (open source, self-hosted) | ₹0 |
| **Total Hardware** | **₹47,000 – ₹67,000** |

**Payback period: 2–3 months**

---

## Sprint Summary Timeline

| Sprint | Duration | Deliverable |
|--------|----------|-------------|
| Sprint 1 | 2 weeks | All sensors wired on M1, live data visible |
| Sprint 2 | 2 weeks | Full ingestion pipeline, PostgreSQL, WebSocket dashboard |
| Sprint 3 | 3 weeks | Baseline ML model trained, validated, deployed |
| Sprint 4 | 2 weeks | Real-time anomaly detection, hypothesis engine, RUL |
| Sprint 5 | 2 weeks | Telegram bot, automated fan/compressor control rules |
| Sprint 6 | 3 weeks | Daily summary, day-over-day comparison, root cause narrative |
| Sprint 7 | 2 weeks | Full dashboard with all widgets, reports, PDF export |
| **TOTAL** | **16 weeks** | **Full production system** |

---

*Document generated by YieldWatt Technical Team.*  
*For questions, implementation support, or hardware procurement, contact the development team.*
