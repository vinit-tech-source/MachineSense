import type { SensorReading } from '../types';

type SignalKey = keyof Pick<SensorReading, 'current_a' | 'voltage_v' | 'vibration_mm_s' | 'temp_c' | 'rpm'>;

export function formatSignalLabel(key: string): string {
  const labels: Record<string, string> = {
    current_a:      'Current',
    voltage_v:      'Voltage',
    vibration_mm_s: 'Vibration',
    temp_c:         'Temperature',
    rpm:            'Speed',
    power_w:        'Power',
  };
  return labels[key] ?? key;
}

export function formatValue(
  reading: SensorReading,
  key: SignalKey
): { label: string; unit: string; value: string } {
  const config: Record<SignalKey, { label: string; unit: string; precision: number }> = {
    current_a:      { label: 'Current',     unit: 'A',    precision: 2 },
    voltage_v:      { label: 'Voltage',     unit: 'V',    precision: 1 },
    vibration_mm_s: { label: 'Vibration',   unit: 'mm/s', precision: 2 },
    temp_c:         { label: 'Temperature', unit: '°C',   precision: 1 },
    rpm:            { label: 'Speed',       unit: 'RPM',  precision: 0 },
  };

  const cfg = config[key];
  const raw = reading[key] as number;

  return {
    label: cfg.label,
    unit:  cfg.unit,
    value: raw.toFixed(cfg.precision),
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatRelativeTime(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}
