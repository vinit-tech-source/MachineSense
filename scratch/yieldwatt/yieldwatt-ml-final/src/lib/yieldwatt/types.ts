/** Plant wall-clock offset from UTC (India = +5:30). Shift/lunch/night logic runs on plant-local time. */
export const PLANT_UTC_OFFSET_MIN = 330;

export type OperatingState =
  | "OFF"
  | "IDLE"
  | "PRODUCING"
  | "HIGH_LOAD"
  | "OVERLOAD";

export type LearningPhase =
  | "commissioning"
  | "statistical"
  | "ml_ready"
  | "drifting";

export type RecCategory = "energy" | "maintenance" | "process";

export type FaultKind =
  | "none"
  | "bearing"
  | "power_factor"
  | "idle_waste"
  | "quality";

export type FeatureName =
  | "kw"
  | "pf"
  | "tempC"
  | "vibRms"
  | "currentA"
  | "rejectPct";

export const FEATURE_ORDER: FeatureName[] = [
  "kw",
  "pf",
  "tempC",
  "vibRms",
  "currentA",
  "rejectPct",
];

/** currentA = kW / (√3 · 0.415 · PF) — a duplicate of power. Forest skips it. */
export const FOREST_SKIP: ReadonlySet<FeatureName> = new Set(["currentA"]);

export const FEATURE_LABEL: Record<FeatureName, string> = {
  kw: "Power kW",
  pf: "Power factor",
  tempC: "Temperature",
  vibRms: "Vibration RMS",
  currentA: "Current A",
  rejectPct: "Reject %",
};

export interface MachineProfile {
  id: string;
  name: string;
  make: string;
  hall: string;
  kind: string;
  /** Sensors this SME actually wired. Missing ones are ignored by the engine. */
  sensors: FeatureName[];
  ratedKw: number;
  idleKw: number;
  producingKw: number;
  producingKwStd: number;
  highLoadKw: number;
  overloadKw: number;
  pf: number;
  tempC: number;
  vibRms: number;
  currentA: number;
  rejectPct: number;
  cycleSec: number;
  unitsPerCycle: number;
  /** Personal-best SEC this machine has historically achieved (kWh / good unit). */
  bestSec: number;
  /** How many calendar days of its own data we simulate at boot. */
  historyDays: number;
  learningTarget: LearningPhase;
  /** False if the plant has no production counter: state detection falls back to power bands. Default true. */
  hasProductionCounter?: boolean;
  rupeePerKwh: number;
  kgCo2PerKwh: number;
}

export interface Sample {
  t: number;
  machineId: string;
  kw: number;
  kwhDelta: number;
  pf: number;
  tempC: number;
  vibRms: number;
  currentA: number;
  freqHz: number;
  goodUnits: number;
  rejects: number;
  rpm?: number;
  pressure?: number;
}

export interface StateStats {
  n: number;
  mean: number[];
  m2: number[];
}

/** What a persistent change in this machine's behaviour looks like. */
export type ShiftClass = "none" | "drift" | "fault";

export interface Inference {
  state: OperatingState;
  features: number[];
  presentMask: boolean[];
  zScores: number[];
  anomalyScore: number | null;
  statisticalHit: boolean;
  mlHit: boolean;
  secInstant: number | null;
  secRolling: number | null;
  vsBestPct: number | null;
  contributions: { feature: FeatureName; z: number }[];
  /** this sample alone is outside the machine's own normal (either detector). */
  hit: boolean;
  /** an operator-facing alert is justified (persistence / sustained shift / long idle / overload). */
  alerting: boolean;
  /** persistent shift classified as benign drift (propose re-baseline) or fault. */
  shift: ShiftClass;
  /** SEC improvement available if the deviation is removed, derived from this machine's own data. */
  impactPct: number | null;
  /** evidence-based confidence (data volume x persistence x detector agreement). */
  confidence: number;
  /** kW minus this machine's own kW ~ a + b·goodUnits (frozen at last confirmed baseline). */
  residualKw: number | null;
  wasteInrPerHour: number | null;
  wasteKgCo2PerHour: number | null;
}

export interface Recommendation {
  category: RecCategory;
  title: string;
  why: string;
  action: string;
  severity: "low" | "medium" | "high";
  expectedSecDropPct: number;
  confidence: number;
}

export interface AlertEvent {
  id: string;
  t: number;
  machineId: string;
  title: string;
  why: string;
  severity: "low" | "medium" | "high";
  score: number;
}

export interface TrainedModelCard {
  phase: LearningPhase;
  producingSamples: number;
  trees: number;
  subsample: number;
  featureCount: number;
  threshold: number;
  trainedOn: string;
  note: string;
  /** extras (optional so existing UI keeps working). */
  statThreshold?: number;
  quarantined?: number;
  acceptedSamples?: number;
}
