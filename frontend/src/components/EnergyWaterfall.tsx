import type { EnergyMetrics } from '../types';
import { Activity, Zap, ShieldAlert, Cpu, Sunrise, Clock } from 'lucide-react';

interface Props {
  metrics: EnergyMetrics | null;
  loading: boolean;
}

export function EnergyWaterfall({ metrics, loading }: Props) {
  if (loading || !metrics) {
    return (
      <div className="card">
        <div className="metric-label" style={{ marginBottom: 'var(--space-4)' }}>Energy Waterfall</div>
        <div className="skeleton" style={{ height: 100 }} />
      </div>
    );
  }

  const total = metrics.energy_kwh > 0 ? metrics.energy_kwh : 1; 

  const buckets = [
    { label: 'Productive', value: metrics.productive_kwh, color: 'var(--green)', icon: <Activity size={14} /> },
    { label: 'Idle', value: metrics.idle_kwh, color: 'var(--cyan)', icon: <Cpu size={14} /> },
    { label: 'Startup', value: metrics.startup_kwh, color: 'var(--amber)', icon: <Sunrise size={14} /> },
    { label: 'Peak (ToD)', value: metrics.peak_kwh, color: '#9b59b6', icon: <Clock size={14} /> },
    { label: 'Reject', value: metrics.reject_kwh, color: '#e67e22', icon: <ShieldAlert size={14} /> },
    { label: 'Degradation', value: metrics.degradation_kwh, color: 'var(--red)', icon: <Zap size={14} /> },
  ];

  // Calculate percentages
  const slices = buckets.map(b => ({
    ...b,
    pct: (b.value / total) * 100
  })).filter(b => b.value > 0);

  return (
    <div className="card" role="region" aria-label="Energy Waterfall breakdown">
      <div className="metric-label" style={{ marginBottom: 'var(--space-4)' }}>Energy Flow (Waterfall)</div>
      
      {/* The Stacked Bar */}
      <div style={{
        display: 'flex',
        height: '32px',
        width: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'var(--bg-raised)',
        marginBottom: 'var(--space-5)'
      }}>
        {slices.length === 0 ? (
          <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'var(--text-muted)' }}>Awaiting telemetry...</div>
        ) : slices.map((s, idx) => (
          <div key={s.label} style={{
            width: `${s.pct}%`,
            background: s.color,
            transition: 'width 1s ease',
            opacity: 0.9,
            borderRight: idx < slices.length -1 ? '1px solid var(--bg-surface)' : 'none'
          }} title={`${s.label}: ${s.value.toFixed(2)} kWh`} />
        ))}
      </div>

      {/* The Legend */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: 'var(--space-3)'
      }}>
        {buckets.map(b => (
          <div key={b.label} className="flex items-center justify-between" style={{
            padding: '8px 10px',
            background: 'var(--bg-raised)',
            borderRadius: '6px',
            border: `1px solid ${b.color}30`
          }}>
            <div className="flex items-center gap-2">
               <div style={{ color: b.color, opacity: 0.8 }}>{b.icon}</div>
               <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{b.label}</span>
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: b.color }}>
              {b.value.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
