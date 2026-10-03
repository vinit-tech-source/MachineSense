import { Link } from 'react-router-dom';
import { Cpu, Activity, AlertTriangle, Zap, Package, BarChart2 } from 'lucide-react';
import { useMachine } from '../contexts/MachineContext';
import { useLiveFeed } from '../hooks/useLiveFeed';
import { useEnergyMetrics } from '../hooks/useEnergyMetrics';
import type { OperatingState } from '../types';

const OP_STATE_CONFIG: Record<OperatingState, { label: string; color: string; dot: string }> = {
  off:       { label: 'Off',        color: 'var(--text-muted)', dot: 'var(--text-disabled)' },
  startup:   { label: 'Startup',    color: 'var(--amber)',      dot: 'var(--amber)' },
  idle:      { label: 'Idle',       color: 'var(--cyan)',       dot: 'var(--cyan)' },
  producing: { label: 'Producing',  color: 'var(--green)',      dot: 'var(--green)' },
  high_load: { label: 'High Load',  color: '#D4731A',           dot: '#D4731A' },
  overload:  { label: 'Overload',   color: 'var(--red)',        dot: 'var(--red)' },
};

function MachineCard({ machineId, name, location }: { machineId: string; name: string; location: string }) {
  const { reading, feedState } = useLiveFeed(machineId);
  const { metrics } = useEnergyMetrics(machineId);

  const opCfg = reading?.operating_state
    ? OP_STATE_CONFIG[reading.operating_state] ?? OP_STATE_CONFIG.off
    : OP_STATE_CONFIG.off;

  const statusColor =
    reading?.status === 'critical' ? 'var(--red)' :
    reading?.status === 'warning'  ? 'var(--amber)' :
    reading?.status === 'normal'   ? 'var(--green)' : 'var(--text-muted)';

  const isConnected = feedState.state === 'connected';

  const healthScore = reading
    ? reading.rul_severity_pct !== null && reading.rul_severity_pct !== undefined
      ? Math.round(100 - Math.min(reading.rul_severity_pct, 100))
      : (reading.status === 'critical' ? 0 : reading.status === 'warning' ? 55 : 98)
    : null;

  return (
    <div
      className="card"
      style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        cursor: 'pointer', transition: 'all 0.25s ease',
        borderTop: `2px solid ${statusColor}`,
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Background glow based on status */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 100, height: 100,
        background: `radial-gradient(circle at top right, ${statusColor}12, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-3)' }}>
        <div className="flex items-center gap-2">
          <Cpu size={15} color={isConnected ? 'var(--cyan)' : 'var(--text-muted)'} strokeWidth={1.5} />
          <h2 style={{ fontSize: 'var(--text-md)', margin: 0, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{name}</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Operating state pill */}
          <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: `${opCfg.color}18`, color: opCfg.color, letterSpacing: '0.05em', border: `1px solid ${opCfg.color}30` }}>
            {opCfg.label ? opCfg.label.toUpperCase() : 'UNKNOWN'}
          </span>
          <div className={`status-dot ${reading?.status === 'normal' ? 'normal' : reading?.status === 'warning' ? 'warning' : 'critical'}`} />
        </div>
      </div>

      {/* Location */}
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 var(--space-4)' }}>{location}</p>

      {/* Key metrics row */}
      {reading && reading.current_a != null && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <MiniMetric label="Current" value={`${reading.current_a?.toFixed(1) ?? 0}A`} color="var(--data-current)" />
          <MiniMetric label="Temp" value={`${reading.temp_c?.toFixed(0) ?? 0}°C`} color={(reading.temp_c ?? 0) > 75 ? 'var(--red)' : 'var(--data-temp)'} />
          <MiniMetric label="Vibration" value={`${reading.vibration_mm_s?.toFixed(1) ?? 0}`} color={(reading.vibration_mm_s ?? 0) > 5 ? 'var(--amber)' : 'var(--data-vibration)'} />
        </div>
      )}

      {/* Health + Energy row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        {healthScore !== null && (
          <div style={{ padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 6, textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 2 }}>Health</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 700, color: statusColor }}>{healthScore}</div>
          </div>
        )}
        {metrics && metrics.energy_kwh != null && (
          <div style={{ padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Zap size={9} /> kWh
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--amber)' }}>
              {metrics.energy_kwh.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* SEC */}
      {metrics?.sec != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 6, marginBottom: 'var(--space-3)' }}>
          <Package size={11} color="var(--text-muted)" />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex: 1 }}>SEC</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
            {metrics.sec.toFixed(3)} kWh/unit
          </span>
        </div>
      )}

      {/* Alert reason */}
      {reading?.alert_reason && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--red)', padding: 'var(--space-2)', background: 'var(--red-dim)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {reading.alert_reason}
          </span>
        </div>
      )}

      {/* RUL bar */}
      {reading?.est_days_remaining != null && (
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Service in</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: reading.est_days_remaining <= 10 ? 'var(--red)' : reading.est_days_remaining <= 30 ? 'var(--amber)' : 'var(--green)' }}>
              {reading.est_days_remaining}d
            </span>
          </div>
          <div style={{ height: 3, background: 'var(--bg-elevated)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, (reading.est_days_remaining / 90) * 100)}%`, height: '100%', background: reading.est_days_remaining <= 10 ? 'var(--red)' : reading.est_days_remaining <= 30 ? 'var(--amber)' : 'var(--green)', transition: 'width 0.8s ease' }} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 'auto', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
        <Link to={`/dashboard?machine=${machineId}`} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: 'var(--text-xs)' }}>
          <Activity size={13} /> Open Dashboard
        </Link>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: '6px 8px', background: 'var(--bg-elevated)', borderRadius: 5, textAlign: 'center' }}>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color }}>{value}</div>
    </div>
  );
}

export function AllMachinesPage() {
  const { machines, setSelectedMachineId } = useMachine();

  const totalMachines = machines.length;

  return (
    <main className="page" id="main-content" tabIndex={-1}>
      <div style={{ marginBottom: 'var(--space-8)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '4px' }}>FACILITY OVERVIEW</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ marginBottom: 'var(--space-1)' }}>All Machines</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              {totalMachines} machine{totalMachines !== 1 ? 's' : ''} registered — live status, energy, health and SEC at a glance.
            </p>
          </div>
          <Link to="/compare" className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <BarChart2 size={14} /> Compare Days
          </Link>
        </div>
      </div>

      {machines.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No machines registered yet.</p>
          <Link to="/settings" className="btn btn-primary" style={{ marginTop: 'var(--space-4)', display: 'inline-flex' }}>Go to Settings</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
          {machines.map(m => (
            <div key={m.machine_id} onClick={() => setSelectedMachineId(m.machine_id)}>
              <MachineCard machineId={m.machine_id} name={m.name} location={m.location} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
