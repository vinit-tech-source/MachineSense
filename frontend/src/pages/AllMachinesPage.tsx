import { Link } from 'react-router-dom';
import { Cpu, Activity, AlertTriangle, Zap, Leaf, DollarSign, Brain, CheckCircle, TrendingDown } from 'lucide-react';
import { usePlant } from '../lib/yieldwatt/store';
import type { MachineLive } from '../lib/yieldwatt/plant';

const OP_STATE_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  OFF:       { label: 'Off',        color: 'var(--text-muted)', dot: 'var(--text-disabled)' },
  IDLE:      { label: 'Idle',       color: 'var(--cyan)',       dot: 'var(--cyan)' },
  PRODUCING: { label: 'Producing',  color: 'var(--green)',      dot: 'var(--green)' },
  HIGH_LOAD: { label: 'High Load',  color: '#D4731A',           dot: '#D4731A' },
  OVERLOAD:  { label: 'Overload',   color: 'var(--red)',        dot: 'var(--red)' },
};

const PHASE_COLORS: Record<string, string> = {
  commissioning: 'var(--text-muted)',
  statistical: 'var(--amber)',
  ml_ready: 'var(--green)',
  drifting: 'var(--red)',
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length === 0) return <div style={{ height: 20 }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * 100},${20 - ((d - min) / range) * 20}`).join(' ');
  return (
    <svg viewBox="0 0 100 20" style={{ width: '100%', height: 20, overflow: 'visible' }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function MiniMetric({ label, value, color, children }: { label: string; value: React.ReactNode; color: string; children?: React.ReactNode }) {
  return (
    <div style={{ padding: '6px 8px', background: 'var(--bg-elevated)', borderRadius: 5, textAlign: 'center', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color, marginTop: 'auto', marginBottom: children ? 4 : 'auto' }}>{value}</div>
      {children}
    </div>
  );
}

function MachineCard({ m }: { m: MachineLive }) {
  const { profile } = m.engine;
  const inf = m.inference;
  
  const opCfg = OP_STATE_CONFIG[inf.state] ?? OP_STATE_CONFIG.OFF;
  const statusColor = inf.alerting ? 'var(--red)' : 'var(--green)';

  return (
    <div
      className="card"
      style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        transition: 'all 0.25s ease',
        borderTop: `2px solid ${statusColor}`,
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 100, height: 100,
        background: `radial-gradient(circle at top right, ${statusColor}12, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-3)' }}>
        <div className="flex items-center gap-2">
          <Cpu size={15} color="var(--cyan)" strokeWidth={1.5} />
          <h2 style={{ fontSize: 'var(--text-md)', margin: 0, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{profile.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: `${opCfg.color}18`, color: opCfg.color, letterSpacing: '0.05em', border: `1px solid ${opCfg.color}30` }}>
            {opCfg.label.toUpperCase()}
          </span>
          <div className={`status-dot ${inf.alerting ? 'critical' : 'normal'}`} />
        </div>
      </div>

      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '0 0 var(--space-4)' }}>{profile.id} • {profile.make}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <MiniMetric label="Power (kW)" value={m.sample.kw.toFixed(1)} color="var(--cyan)">
          <Sparkline data={m.spark} color="var(--cyan)" />
        </MiniMetric>
        <MiniMetric label="Rolling SEC" value={inf.secRolling ? inf.secRolling.toFixed(3) : '--'} color="var(--amber)">
          {inf.vsBestPct != null && (
            <div style={{ fontSize: '9px', color: inf.vsBestPct > 5 ? 'var(--red)' : 'var(--green)' }}>
              {inf.vsBestPct > 0 ? '+' : ''}{inf.vsBestPct.toFixed(1)}% vs PB
            </div>
          )}
        </MiniMetric>
        <MiniMetric label="Learning Phase" value={m.engine.phase.replace('_', ' ').toUpperCase()} color={PHASE_COLORS[m.engine.phase]} />
      </div>

      {inf.alerting && m.recs.length > 0 && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--red)', padding: 'var(--space-2)', background: 'var(--red-dim)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {m.recs[0]?.title || 'Alert triggered'}
          </span>
        </div>
      )}

      <div style={{ marginTop: 'auto', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
        <Link to={`/dashboard?machine=${profile.id}`} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: 'var(--text-xs)' }}>
          <Activity size={13} /> Open Dashboard
        </Link>
      </div>
    </div>
  );
}

function TopAiConclusions({ machines }: { machines: MachineLive[] }) {
  const allRecs = machines.flatMap(m => m.recs.map(r => ({ ...r, machineId: m.engine.profile.id, alerting: m.inference.alerting, impactPct: m.inference.impactPct, wasteInr: m.inference.wasteInrPerHour, wasteCo2: m.inference.wasteKgCo2PerHour })));
  const sortedRecs = allRecs.sort((a, b) => {
    const sevMap = { high: 3, medium: 2, low: 1 };
    if (sevMap[a.severity] !== sevMap[b.severity]) return sevMap[b.severity] - sevMap[a.severity];
    return b.confidence - a.confidence;
  }).slice(0, 6);

  if (sortedRecs.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', color: 'var(--green)', padding: 'var(--space-6)', background: 'var(--green-dim)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-lg)' }}>
        <CheckCircle size={36} />
        <div>
          <h4 style={{ margin: '0 0 6px', fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--green)' }}>Fleet Nominal</h4>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.5, opacity: 0.9 }}>
            The Isolation Forest is actively monitoring all machines. No significant anomalies or inefficiencies detected across the fleet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
      {sortedRecs.map((r, i) => (
        <div key={i} style={{ padding: 'var(--space-5)', border: '1px solid var(--border-default)', borderLeft: `4px solid ${r.severity === 'high' ? 'var(--red)' : r.severity === 'medium' ? 'var(--amber)' : 'var(--cyan)'}`, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', fontWeight: 600, textTransform: 'uppercase' }}>
              <span style={{ color: 'var(--text-primary)' }}>{r.machineId}</span> • {r.category}
            </div>
            <div className={`badge ${r.severity === 'high' ? 'badge-critical' : r.severity === 'medium' ? 'badge-warning' : 'badge-normal'}`} style={{ fontSize: '10px' }}>
              {Math.round(r.confidence * 100)}% Conf
            </div>
          </div>
          <h4 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, lineHeight: 1.3 }}>{r.title}</h4>
          <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r.why}</p>
          <div style={{ fontSize: 'var(--text-sm)', background: 'var(--bg-surface)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'auto' }}>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Action:</strong> <span style={{ color: 'var(--text-secondary)' }}>{r.action}</span>
            </div>
            {r.expectedSecDropPct > 0 && (
              <div style={{ color: 'var(--green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)' }}>
                <TrendingDown size={16} /> -{r.expectedSecDropPct.toFixed(1)}% SEC
              </div>
            )}
          </div>
          {r.alerting && r.wasteInr != null && (
            <div className="flex justify-between" style={{ fontSize: '11px', color: 'var(--red)', marginTop: 'var(--space-2)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)', fontWeight: 600 }}>
              <span>+{r.impactPct?.toFixed(1)}% SEC Cost</span>
              <span>₹{r.wasteInr.toFixed(0)}/hr</span>
              <span>{r.wasteCo2?.toFixed(1)}kg CO2/hr</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function AllMachinesPage() {
  const plant = usePlant(s => s.plant);
  const kpis = usePlant(s => s.kpis);
  const totalMachines = plant.machines.length;

  return (
    <main className="page" id="main-content" tabIndex={-1}>
      <div style={{ marginBottom: 'var(--space-8)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '4px' }}>FACILITY OVERVIEW</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ marginBottom: 'var(--space-1)' }}>All Machines</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', maxWidth: 600, lineHeight: 1.5 }}>
              Welcome to <strong>MachineSense</strong>. This dashboard uses live sensor telemetry and unsupervised Machine Learning (Isolation Forests) to continuously monitor the health and efficiency of your fleet. 
              <br/><br/>
              It automatically learns the unique "normal" baseline for each machine and flags anomalies (like bearing wear or idle waste) before they cause downtime or waste energy.
            </p>
          </div>
          <div style={{ background: 'var(--bg-elevated)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
             <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>FLEET STATUS</div>
             <div style={{ fontSize: 'var(--text-sm)' }}>{totalMachines} machine{totalMachines !== 1 ? 's' : ''} actively monitored</div>
          </div>
        </div>
      </div>

      {/* PLANT KPI STRIP */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Zap size={24} color="var(--amber)" />
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>TOTAL ENERGY</div>
            <div style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.round(kpis.kwh).toLocaleString()} kWh</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DollarSign size={24} color="var(--green)" />
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>EST COST</div>
            <div style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>₹{Math.round(kpis.rupee).toLocaleString()}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Leaf size={24} color="var(--cyan)" />
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>CARBON (CO2)</div>
            <div style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{Math.round(kpis.co2).toLocaleString()} kg</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={24} color={kpis.alerts > 0 ? 'var(--red)' : 'var(--green)'} />
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>OPEN ALERTS</div>
            <div style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-mono)', fontWeight: 700, color: kpis.alerts > 0 ? 'var(--red)' : 'var(--green)' }}>{kpis.alerts}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
        {plant.machines.map(m => (
          <MachineCard key={m.engine.profile.id} m={m} />
        ))}
      </div>

      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={24} color="var(--cyan)" /> Top AI Conclusions
        </h2>
        <TopAiConclusions machines={plant.machines} />
      </div>
    </main>
  );
}
