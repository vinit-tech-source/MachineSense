import { useState, useEffect } from 'react';
import { useHistoricalReadings } from '../hooks/useHistoricalReadings';
import { TrendChart } from '../components/TrendChart';
import { formatTimestamp } from '../utils/format';
import { signalColor } from '../components/SensorReadoutGrid';

import { Download } from 'lucide-react';
import { useMachine } from '../contexts/MachineContext';
import { MachineSelector } from '../components/MachineSelector';

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
  const { selectedMachineId: MACHINE_ID, machines } = useMachine();
  const [hours, setHours] = useState(1);
  const [activeSignals, setActiveSignals] = useState<SignalKey[]>(['vibration_mm_s', 'temp_c']);
  const [visibleCount, setVisibleCount] = useState(20);
  const { readings, loading } = useHistoricalReadings(MACHINE_ID, hours);
  
  useEffect(() => {
    setVisibleCount(20);
  }, [MACHINE_ID, hours]);

  const currentMachine = machines.find(m => m.machine_id === MACHINE_ID);
  const shortId = currentMachine ? currentMachine.name.split(' ')[0] : MACHINE_ID;

  const toggleSignal = (key: SignalKey) => {
    setActiveSignals(prev => {
      if (prev.includes(key)) {
        return prev.length > 1 ? prev.filter(k => k !== key) : prev;
      } else {
        return prev.length >= 3 ? [...prev.slice(1), key] : [...prev, key];
      }
    });
  };

  return (
    <main className="page" id="main-content" tabIndex={-1}>
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-8)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '4px' }}>TELEMETRY LOGS</div>
          <h1 style={{ marginBottom: 'var(--space-1)' }}>Signal History</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            Recorded sensor readings for <code style={{ color: 'var(--cyan)' }}>{shortId}</code>
          </p>
        </div>

        {/* Time range selector and Machine Selector */}
        <div className="flex gap-4 items-center" style={{ flexWrap: 'wrap' }}>
          <MachineSelector />
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
      </div>

      <div style={{ marginBottom: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Signal tabs */}
        <div
          className="flex gap-2"
          style={{ flexWrap: 'wrap' }}
          role="tablist"
          aria-label="Signal selector"
        >
          {SIGNALS.map(sig => {
            const color = signalColor(sig.key);
            const isActive = activeSignals.includes(sig.key);
            return (
              <button
                key={sig.key}
                role="tab"
                aria-selected={isActive}
                className={`btn ${isActive ? 'btn-secondary' : 'btn-ghost'}`}
                style={isActive ? { borderColor: color, color } : {}}
                onClick={() => toggleSignal(sig.key)}
                id={`history-signal-${sig.key}`}
              >
                {sig.label}
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>({sig.unit})</span>
              </button>
            );
          })}
        </div>
        
        {activeSignals.length > 1 && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '12px', height: '2px', background: 'var(--text-muted)' }} /> Normalized Scale (0-100%)
            </div>
            <span>Select up to 3 to overlay</span>
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        {loading ? (
          <div className="skeleton" style={{ height: 280 }} />
        ) : (
          <TrendChart readings={readings} signals={activeSignals} height={280} />
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--text-md)' }}>
            Raw Readings ({readings.length} records)
          </h2>
          <a
            href={`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/machines/${MACHINE_ID}/readings/export?hours=${hours}`}
            className="btn btn-secondary"
            download
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Download size={14} />
            Export CSV
          </a>
        </div>
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
                  <th style={{ textAlign: 'right' }}>Current (A)</th>
                  <th style={{ textAlign: 'right' }}>Voltage (V)</th>
                  <th style={{ textAlign: 'right' }}>Vibration (mm/s)</th>
                  <th style={{ textAlign: 'right' }}>Temp (°C)</th>
                  <th style={{ textAlign: 'right' }}>RPM</th>
                  <th style={{ textAlign: 'right' }}>Power (W)</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {readings.slice(0, visibleCount).map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{formatTimestamp(r.timestamp)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{r.current_a.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{r.voltage_v.toFixed(1)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{r.vibration_mm_s.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{r.temp_c.toFixed(1)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{Math.round(r.rpm)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--cyan)' }}>{r.power_w.toFixed(0)}</td>
                    <td style={{ textAlign: 'center' }}>
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
            
            {visibleCount < readings.length && (
              <div style={{ padding: 'var(--space-4)', textAlign: 'center', borderTop: '1px solid var(--border-subtle)' }}>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
                  Showing {visibleCount} of {readings.length} records.
                </p>
                <button onClick={() => setVisibleCount(prev => prev + 50)} className="btn btn-secondary">
                  Load More
                </button>
              </div>
            )}
            
            {visibleCount >= readings.length && readings.length > 0 && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', padding: 'var(--space-3) var(--space-4)', textAlign: 'center' }}>
                Showing all {readings.length} records.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
