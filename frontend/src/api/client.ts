import type { SensorReading, EnergyMetrics, AlertRecord, HistoricalPoint, BaselineStats, MachineInfo, DailySummary } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001';
const WS_BASE  = import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8001';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

// ─── Machine ────────────────────────────────────────────────────────────────
export const listMachines = () =>
  request<MachineInfo[]>('/api/machines');

export const getMachineInfo = (machineId: string) =>
  request<MachineInfo>(`/api/machines/${machineId}`);

export const createMachine = (data: Partial<MachineInfo>) =>
  request<MachineInfo>('/api/machines', { method: 'POST', body: JSON.stringify(data) });

export const updateMachine = (machineId: string, data: Partial<MachineInfo>) =>
  request<MachineInfo>(`/api/machines/${machineId}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteMachine = (machineId: string) =>
  request<void>(`/api/machines/${machineId}`, { method: 'DELETE' });

// ─── Latest reading ─────────────────────────────────────────────────────────
export const getLatestReading = (machineId: string) =>
  request<SensorReading>(`/api/machines/${machineId}/readings/latest`);

// ─── Energy metrics ─────────────────────────────────────────────────────────
export const getEnergyMetrics = (machineId: string) =>
  request<EnergyMetrics>(`/api/machines/${machineId}/energy`);

// ─── Historical readings ─────────────────────────────────────────────────────
export const getHistoricalReadings = (
  machineId: string,
  hours: number = 1,
  limit: number = 200
) =>
  request<HistoricalPoint[]>(
    `/api/machines/${machineId}/readings/history?hours=${hours}&limit=${limit}`
  );

// ─── Alerts ─────────────────────────────────────────────────────────────────
export const getAlerts = (machineId: string, limit: number = 50) =>
  request<AlertRecord[]>(`/api/machines/${machineId}/alerts?limit=${limit}`);

// ─── Baseline stats ──────────────────────────────────────────────────────────
export const getBaseline = (machineId: string) =>
  request<BaselineStats>(`/api/machines/${machineId}/baseline`);

// ─── Daily summaries ─────────────────────────────────────────────────────────
export const getDailySummaries = (machineId: string, days: number = 14) =>
  request<DailySummary[]>(`/api/machines/${machineId}/daily?days=${days}`);

// ─── Manual Analytics ────────────────────────────────────────────────────────
export interface ManualAnalyticsInput {
  date: string;
  working_hours: number;
  production_units: number;
}

export interface ProblemRemedy {
  problem: string;
  remedy: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface ManualAnalyticsOut {
  date: string;
  machine_id: string;
  working_hours: number;
  production_units: number;
  total_energy_kwh: number;
  cost_inr: number;
  co2e_kg: number;
  yield_rate_pct: number;
  sec: number | null;
  avg_power_w: number;
  avg_temp_c: number;
  avg_vibration_mm_s: number;
  problems_detected: ProblemRemedy[];
}

export const generateManualAnalytics = (machineId: string, data: ManualAnalyticsInput) =>
  request<ManualAnalyticsOut>(`/api/machines/${machineId}/manual-analytics`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

// ─── Ingest (HTTP fallback) ──────────────────────────────────────────────────
export const ingestReading = (reading: Omit<SensorReading, 'id' | 'status' | 'alert_reason' | 'est_days_remaining'>) =>
  request<SensorReading>('/api/ingest', { method: 'POST', body: JSON.stringify(reading) });

// ─── WebSocket factory ───────────────────────────────────────────────────────
export function createLiveFeed(
  machineId: string,
  onMessage: (reading: SensorReading) => void,
  onStateChange: (state: 'connected' | 'connecting' | 'disconnected') => void
): () => void {
  let ws: WebSocket | null = null;
  let destroyed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = 1500;

  function connect() {
    if (destroyed) return;
    onStateChange('connecting');

    ws = new WebSocket(`${WS_BASE}/ws/machines/${machineId}/live`);

    ws.onopen = () => {
      reconnectDelay = 1500;
      onStateChange('connected');
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as SensorReading;
        onMessage(data);
      } catch {
        // Malformed frame — ignore, do not crash
      }
    };

    ws.onerror = () => {
      // onerror is always followed by onclose, handle there
    };

    ws.onclose = () => {
      if (destroyed) return;
      onStateChange('disconnected');
      reconnectDelay = Math.min(reconnectDelay * 1.5, 15000);
      reconnectTimer = setTimeout(connect, reconnectDelay);
    };
  }

  connect();

  return () => {
    destroyed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ws?.close();
  };
}
