import type { EnergyMetrics } from '../types';
import { Zap, IndianRupee, Clock } from 'lucide-react';

interface Props {
  metrics: EnergyMetrics | null;
  loading: boolean;
}

export function EnergyMetricsPanel({ metrics, loading }: Props) {
  if (loading || !metrics) {
    return (
      <div className="card">
        <div className="metric-label" style={{ marginBottom: 'var(--space-4)' }}>Energy &amp; Cost</div>
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 40 }} />
          ))}
        </div>
      </div>
    );
  }

  const sessionStart = new Date(metrics.session_start);
  const hoursRunning = ((Date.now() - sessionStart.getTime()) / 3_600_000).toFixed(1);

  return (
    <div className="card" role="region" aria-label="Energy and cost metrics">
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="metric-label">Energy &amp; Cost</div>
        <div className="flex items-center gap-2" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          <Clock size={12} strokeWidth={1.5} />
          {hoursRunning}h session
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {/* Instantaneous power */}
        <MetricRow
          icon={<Zap size={16} color="var(--cyan)" strokeWidth={1.5} />}
          label="Instantaneous power"
          value={metrics.power_w >= 1000
            ? `${(metrics.power_w / 1000).toFixed(2)}`
            : `${metrics.power_w.toFixed(0)}`}
          unit={metrics.power_w >= 1000 ? 'kW' : 'W'}
          color="var(--cyan)"
        />

        {/* Accumulated energy */}
        <MetricRow
          icon={<Zap size={16} color="var(--data-voltage)" strokeWidth={1.5} />}
          label="Session energy"
          value={metrics.energy_kwh.toFixed(3)}
          unit="kWh"
          color="var(--data-voltage)"
        />

        {/* Cost */}
        <MetricRow
          icon={<IndianRupee size={16} color="var(--amber)" strokeWidth={1.5} />}
          label="Session cost"
          value={metrics.cost_inr.toFixed(2)}
          unit="INR"
          color="var(--amber)"
        />
      </div>

      <div
        style={{
          marginTop: 'var(--space-5)',
          paddingTop: 'var(--space-4)',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
        }}
      >
        Session started {sessionStart.toLocaleString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}
      </div>
    </div>
  );
}

function MetricRow({
  icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <div className="flex items-end gap-1">
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xl)', fontWeight: 500, color }}>
          {value}
        </span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{unit}</span>
      </div>
    </div>
  );
}
