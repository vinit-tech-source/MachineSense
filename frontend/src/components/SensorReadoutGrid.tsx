import type { SensorReading } from '../types';
import { formatValue } from '../utils/format';
import { Zap } from 'lucide-react';

interface Props {
  reading: SensorReading;
}

const CORE_SIGNALS: Array<{
  key: keyof Pick<SensorReading, 'current_a' | 'voltage_v' | 'vibration_mm_s' | 'temp_c' | 'rpm'>;
  color: string;
  glow: string;
}> = [
  { key: 'current_a',      color: 'var(--data-current)',   glow: 'rgba(59,130,246,0.3)' },
  { key: 'voltage_v',      color: 'var(--data-voltage)',   glow: 'rgba(139,92,246,0.3)' },
  { key: 'vibration_mm_s', color: 'var(--data-vibration)', glow: 'rgba(245,158,11,0.3)' },
  { key: 'temp_c',         color: 'var(--data-temp)',      glow: 'rgba(239,68,68,0.3)'  },
  { key: 'rpm',            color: 'var(--data-rpm)',       glow: 'rgba(16,185,129,0.3)' },
];

export function SensorReadoutGrid({ reading }: Props) {
  const powerW = reading.current_a * reading.voltage_v;
  const powerKw = powerW / 1000;

  return (
    <div role="region" aria-label="Live sensor readings">
      {/* Core sensors row */}
      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 'var(--space-4)' }}>
        {CORE_SIGNALS.map(({ key, color, glow }) => {
          const { label, unit, value } = formatValue(reading, key);
          return (
            <div
              key={key}
              className="card"
              style={{ borderTop: `2px solid ${color}`, position: 'relative', overflow: 'hidden' }}
              aria-label={`${label}: ${value} ${unit}`}
            >
              <div
                style={{
                  position: 'absolute', top: 0, right: 0, width: 80, height: 80,
                  background: `radial-gradient(circle at top right, ${glow}, transparent 70%)`,
                  pointerEvents: 'none',
                }}
              />
              <div className="metric-label" style={{ marginBottom: 'var(--space-3)' }}>{label}</div>
              <div className="flex items-end gap-1">
                <span className="metric-value" style={{ color }}>{value}</span>
                <span className="metric-unit">{unit}</span>
              </div>
            </div>
          );
        })}

        {/* Power (derived) */}
        <div className="card" style={{ borderTop: '2px solid var(--cyan)', position: 'relative', overflow: 'hidden' }}
          aria-label={`Power: ${powerW.toFixed(0)} W`}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: 80, height: 80, background: 'radial-gradient(circle at top right, rgba(0,180,216,0.2), transparent 70%)', pointerEvents: 'none' }} />
          <div className="metric-label" style={{ marginBottom: 'var(--space-3)' }}>Power</div>
          <div className="flex items-end gap-1">
            <span className="metric-value" style={{ color: 'var(--cyan)' }}>
              {powerKw >= 1 ? powerKw.toFixed(2) : powerW.toFixed(0)}
            </span>
            <span className="metric-unit">{powerKw >= 1 ? 'kW' : 'W'}</span>
          </div>
        </div>
      </div>

      {/* Extended sensors row — only shown if data available */}
      {(reading.power_factor != null || reading.pressure_bar != null || reading.count_out != null) && (
        <div className="grid grid-cols-4 gap-4">
          {reading.power_factor != null && (
            <div className="card" style={{ borderTop: '2px solid #9b59b6' }}>
              <div className="metric-label" style={{ marginBottom: 'var(--space-3)' }}>Power Factor</div>
              <div className="flex items-end gap-1">
                <span className="metric-value" style={{ color: reading.power_factor < 0.8 ? 'var(--amber)' : '#9b59b6' }}>
                  {reading.power_factor.toFixed(2)}
                </span>
                <span className="metric-unit">PF</span>
              </div>
              {reading.power_factor < 0.8 && (
                <div style={{ fontSize: '10px', color: 'var(--amber)', marginTop: 4 }}>⚠ Low PF — energy waste</div>
              )}
            </div>
          )}
          {reading.pressure_bar != null && (
            <div className="card" style={{ borderTop: '2px solid var(--cyan)' }}>
              <div className="metric-label" style={{ marginBottom: 'var(--space-3)' }}>Pressure</div>
              <div className="flex items-end gap-1">
                <span className="metric-value" style={{ color: reading.pressure_bar < 4.5 ? 'var(--red)' : 'var(--cyan)' }}>
                  {reading.pressure_bar.toFixed(1)}
                </span>
                <span className="metric-unit">bar</span>
              </div>
              {reading.pressure_bar < 4.5 && (
                <div style={{ fontSize: '10px', color: 'var(--red)', marginTop: 4 }}>⛔ Low pressure — check for leak</div>
              )}
            </div>
          )}
          {reading.count_out != null && (
            <div className="card" style={{ borderTop: '2px solid var(--green)' }}>
              <div className="metric-label" style={{ marginBottom: 'var(--space-3)' }}>Production Count</div>
              <div className="flex items-end gap-1">
                <span className="metric-value" style={{ color: 'var(--green)' }}>{reading.count_out}</span>
                <span className="metric-unit">units</span>
              </div>
              {reading.reject_count != null && reading.reject_count > 0 && (
                <div style={{ fontSize: '10px', color: 'var(--amber)', marginTop: 4 }}>
                  {reading.reject_count} rejects ({((reading.reject_count / Math.max(reading.count_out, 1)) * 100).toFixed(1)}%)
                </div>
              )}
            </div>
          )}
          {/* Sim badge */}
          {reading.is_simulated && (
            <div className="card" style={{ borderTop: '2px solid var(--text-muted)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="metric-label" style={{ marginBottom: 'var(--space-3)' }}>Data Source</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={14} color="var(--text-muted)" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>SIMULATED</span>
                {reading.confidence_badge && (
                  <span style={{ fontSize: '10px', background: 'var(--cyan-dim)', color: 'var(--cyan)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                    Grade {reading.confidence_badge}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Exported separately for the history/trend page */
export function signalColor(key: string): string {
  const map: Record<string, string> = {
    current_a:      '#00B4D8',
    voltage_v:      '#7C83FD',
    vibration_mm_s: '#E8A020',
    temp_c:         '#FF6B6B',
    rpm:            '#A8DADC',
    power_w:        '#00B4D8',
  };
  return map[key] ?? '#8A96A4';
}

export { formatSignalLabel } from '../utils/format';
