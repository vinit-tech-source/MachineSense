import { useState } from 'react';
import { useHistoricalReadings } from '../hooks/useHistoricalReadings';
import { TrendChart } from '../components/TrendChart';
import { formatTimestamp } from '../utils/format';
import { signalColor } from '../components/SensorReadoutGrid';

const MACHINE_ID = import.meta.env.VITE_MACHINE_ID ?? 'machine-001';

type SignalKey = 'current_a' | 'voltage_v' | 'vibration_mm_s' | 'temp_c' | 'rpm' | 'power_w';

const SIGNALS: Array<{ key: SignalKey; label: string; unit: string }> = [
  { key: 'current_a',      label: 'Current',     unit: 'A' },
  { key: 'voltage_v',      label: 'Voltage',     unit: 'V' },
  { key: 'vibration_mm_s', label: 'Vibration',   unit: 'mm/s' },
  { key: 'temp_c',         label: 'Temperature', unit: '°C' },
  { key: 'rpm',            label: 'Speed',       unit: 'RPM' },
  { key: 'power_w',        label: 'Power',       unit: 'W' },
];

const HOUR_OPTIONS = [
  { label: '1 hour',  value: 1 },
  { label: '6 hours', value: 6 },
  { label: '24 hours',value: 24 },
  { label: '7 days',  value: 168 },
];

export function HistoryPage() {
  const [hours, setHours] = useState(1);
  const [activeSignal, setActiveSignal] = useState<SignalKey>('current_a');
  const { readings, loading } = useHistoricalReadings(MACHINE_ID, hours);

  return (
    <main className="page" id="main-content" tabIndex={-1}>
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ marginBottom: 'var(--space-1)' }}>Signal History</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            Recorded sensor readings for {MACHINE_ID}.
          </p>
        </div>

        {/* Time range selector */}
        <div className="flex gap-2" role="radiogroup" aria-label="Time range">
          {HOUR_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`btn ${hours === opt.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setHours(opt.value)}
              aria-pressed={hours === opt.value}
              id={`history-range-${opt.value}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Signal tabs */}
      <div
        className="flex gap-2"
        style={{ marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}
        role="tablist"
        aria-label="Signal selector"
      >
        {SIGNALS.map(sig => {
          const color = signalColor(sig.key);
          return (
            <button
              key={sig.key}
              role="tab"
              aria-selected={activeSignal === sig.key}
              className={`btn ${activeSignal === sig.key ? 'btn-secondary' : 'btn-ghost'}`}
              style={activeSignal === sig.key ? { borderColor: color, color } : {}}
              onClick={() => setActiveSignal(sig.key)}
              id={`history-signal-${sig.key}`}
            >
              {sig.label}
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>({sig.unit})</span>
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        {loading ? (
          <div className="skeleton" style={{ height: 280 }} />
        ) : (
          <TrendChart readings={readings} signal={activeSignal} height={280} />
        )}
      </div>

      {/* Raw data table */}
      <div className="card">
        <h2 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-4)' }}>
          Raw Readings ({readings.length} records)
        </h2>
        {loading ? (
          <div className="flex flex-col gap-2">
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 36 }} />)}
          </div>
        ) : readings.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No readings in this time window.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" aria-label="Historical readings">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Current (A)</th>
                  <th>Voltage (V)</th>
                  <th>Vibration (mm/s)</th>
                  <th>Temp (°C)</th>
                  <th>RPM</th>
                  <th>Power (W)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {readings.slice(0, 200).map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{formatTimestamp(r.timestamp)}</td>
                    <td>{r.current_a.toFixed(2)}</td>
                    <td>{r.voltage_v.toFixed(1)}</td>
                    <td>{r.vibration_mm_s.toFixed(2)}</td>
                    <td>{r.temp_c.toFixed(1)}</td>
                    <td>{Math.round(r.rpm)}</td>
                    <td>{r.power_w.toFixed(0)}</td>
                    <td>
                      <span
                        className={`badge badge-${r.status}`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {readings.length > 200 && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', padding: 'var(--space-3) var(--space-4)' }}>
                Showing 200 of {readings.length} records. Export functionality is on the roadmap.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
