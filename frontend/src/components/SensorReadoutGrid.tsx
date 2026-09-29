import type { SensorReading } from '../types';
import { formatSignalLabel, formatValue } from '../utils/format';

interface Props {
  reading: SensorReading;
}

const SIGNALS: Array<{
  key: keyof Pick<SensorReading, 'current_a' | 'voltage_v' | 'vibration_mm_s' | 'temp_c' | 'rpm'>;
  color: string;
}> = [
  { key: 'current_a',      color: 'var(--data-current)' },
  { key: 'voltage_v',      color: 'var(--data-voltage)' },
  { key: 'vibration_mm_s', color: 'var(--data-vibration)' },
  { key: 'temp_c',         color: 'var(--data-temp)' },
  { key: 'rpm',            color: 'var(--data-rpm)' },
];

export function SensorReadoutGrid({ reading }: Props) {
  return (
    <div className="grid grid-cols-4 gap-4" role="region" aria-label="Live sensor readings">
      {SIGNALS.map(({ key, color }) => {
        const { label, unit, value } = formatValue(reading, key);
        return (
          <div
            key={key}
            className="card"
            style={{ borderTop: `2px solid ${color}` }}
            aria-label={`${label}: ${value} ${unit}`}
          >
            <div className="metric-label" style={{ marginBottom: 'var(--space-3)' }}>{label}</div>
            <div className="flex items-end gap-1">
              <span className="metric-value" style={{ color }}>{value}</span>
              <span className="metric-unit">{unit}</span>
            </div>
          </div>
        );
      })}
      {/* Power derived metric */}
      <div
        className="card"
        style={{ borderTop: '2px solid var(--cyan)' }}
        aria-label={`Power: ${(reading.current_a * reading.voltage_v).toFixed(0)} W`}
      >
        <div className="metric-label" style={{ marginBottom: 'var(--space-3)' }}>Power</div>
        <div className="flex items-end gap-1">
          <span className="metric-value" style={{ color: 'var(--cyan)' }}>
            {(reading.current_a * reading.voltage_v).toFixed(0)}
          </span>
          <span className="metric-unit">W</span>
        </div>
      </div>
    </div>
  );
}

/** Exported separately for the history/trend page */
export function signalColor(key: string): string {
  const map: Record<string, string> = {
    current_a:      '#00B4D8', // --data-current
    voltage_v:      '#7C83FD', // --data-voltage
    vibration_mm_s: '#E8A020', // --data-vibration
    temp_c:         '#FF6B6B', // --data-temp
    rpm:            '#A8DADC', // --data-rpm
    power_w:        '#00B4D8', // --cyan
  };
  return map[key] ?? '#8A96A4'; // --text-secondary
}

export { formatSignalLabel };
