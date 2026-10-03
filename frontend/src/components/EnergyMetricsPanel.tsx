import type { EnergyMetrics, SensorReading } from '../types';
import { Zap, IndianRupee, Clock, Lightbulb, AlertTriangle, Cloud } from 'lucide-react';

interface Props {
  metrics: EnergyMetrics | null;
  loading: boolean;
  reading?: SensorReading;
}

export function EnergyMetricsPanel({ metrics, loading, reading }: Props) {
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

        {/* SEC and Units */}
        {metrics.sec !== null && (
          <MetricRow
            icon={<Zap size={16} color="var(--purple, #9b59b6)" strokeWidth={1.5} />}
            label="Specific Energy (SEC)"
            value={metrics.sec.toFixed(3)}
            unit="kWh / unit"
            color="var(--purple, #9b59b6)"
          />
        )}
        
        {/* CO2e */}
        <MetricRow
          icon={<Cloud size={16} color="var(--text-muted)" strokeWidth={1.5} />}
          label="Scope 2 Emissions"
          value={metrics.co2e_kg.toFixed(2)}
          unit="kg CO₂e"
          color="var(--text-primary)"
        />

        {metrics.good_units > 0 && (
          <div className="flex items-center justify-between" style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Good Production</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-md)', fontWeight: 500, color: 'var(--text-primary)' }}>
              {metrics.good_units} <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>units</span>
            </span>
          </div>
        )}
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

      {reading && (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <div className="metric-label" style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lightbulb size={12} color="var(--amber)" /> Energy Insights
          </div>
          <div className="flex flex-col gap-2">
            {reading.current_a > 1.0 && reading.vibration_mm_s < 0.5 && (
              <Insight msg="Idle waste detected: Machine drawing power without mechanical load. Consider switching off." type="warn" />
            )}
            {reading.rul_severity_pct && reading.rul_severity_pct > 50 ? (
              <Insight msg="Degraded machine state is wasting excess energy (~15-30% inefficiency)." type="warn" />
            ) : null}
            {reading.temp_c > 75 && (
              <Insight msg="High temperature indicates thermal inefficiency and energy loss." type="warn" />
            )}
            {new Date().getHours() >= 18 && new Date().getHours() <= 22 ? (
              <Insight msg="Currently in peak tariff hours. Consider scheduling heavy loads later." type="info" />
            ) : (
              <Insight msg="Currently in off-peak tariff hours. Optimal time for heavy operations." type="good" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Insight({ msg, type }: { msg: string, type: 'warn' | 'info' | 'good' }) {
  const colors = {
    warn: { bg: 'var(--amber-dim)', text: 'var(--amber)', border: 'rgba(232, 160, 32, 0.3)' },
    info: { bg: 'var(--cyan-dim)', text: 'var(--cyan)', border: 'rgba(0, 180, 216, 0.25)' },
    good: { bg: 'var(--green-dim)', text: 'var(--green)', border: 'rgba(39, 174, 96, 0.25)' }
  };
  const style = colors[type];
  
  return (
    <div style={{
      background: style.bg,
      border: `1px solid ${style.border}`,
      borderRadius: '4px',
      padding: '8px 10px',
      fontSize: '11px',
      color: 'var(--text-primary)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px',
      lineHeight: 1.4
    }}>
      {type === 'warn' && <AlertTriangle size={14} color={style.text} style={{ flexShrink: 0, marginTop: '2px' }} />}
      {type === 'info' && <Lightbulb size={14} color={style.text} style={{ flexShrink: 0, marginTop: '2px' }} />}
      {type === 'good' && <Zap size={14} color={style.text} style={{ flexShrink: 0, marginTop: '2px' }} />}
      <span>{msg}</span>
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
