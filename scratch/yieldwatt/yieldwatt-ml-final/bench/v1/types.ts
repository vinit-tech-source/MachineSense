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
}
