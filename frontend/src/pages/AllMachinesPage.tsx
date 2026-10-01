import { Link } from 'react-router-dom';
import { Cpu, Activity, AlertTriangle } from 'lucide-react';
import { useMachine } from '../contexts/MachineContext';
import { useLiveFeed } from '../hooks/useLiveFeed';

function MachineCard({ machineId, name }: { machineId: string, name: string }) {
  const { reading, feedState } = useLiveFeed(machineId);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', cursor: 'pointer', transition: 'all 0.2s ease', borderTop: reading?.status === 'critical' ? '2px solid var(--red)' : reading?.status === 'warning' ? '2px solid var(--amber)' : '2px solid transparent' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="flex items-center gap-2">
          <Cpu size={16} color={feedState.state === 'connected' ? 'var(--cyan)' : 'var(--text-muted)'} />
          <h2 style={{ fontSize: 'var(--text-md)', margin: 0, fontFamily: 'var(--font-mono)' }}>{name}</h2>
        </div>
        <div className="flex items-center gap-2" style={{ fontSize: 'var(--text-xs)' }}>
          <div className={`status-dot ${feedState.state === 'connected' ? (reading?.status === 'normal' ? 'normal' : reading?.status === 'warning' ? 'warning' : 'critical') : 'warning'}`} />
          <span style={{ color: feedState.state === 'connected' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {feedState.state === 'connected' ? (reading?.status || 'Waiting') : 'Offline'}
          </span>
        </div>
      </div>
      
      <div style={{ flex: 1, marginBottom: 'var(--space-4)' }}>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
          ID: <code style={{ color: 'var(--text-secondary)' }}>{machineId}</code>
        </p>
        {reading && (
          <div style={{ padding: 'var(--space-3)', background: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Health Score
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ 
                fontSize: 'var(--text-lg)', 
                fontWeight: 600, 
                fontFamily: 'var(--font-mono)',
                color: reading.status === 'critical' ? 'var(--red)' : reading.status === 'warning' ? 'var(--amber)' : 'var(--green)'
              }}>
                {reading.rul_severity_pct !== null && reading.rul_severity_pct !== undefined 
                  ? Math.round(100 - Math.min(reading.rul_severity_pct, 100))
                  : (reading.status === 'critical' ? 0 : reading.status === 'warning' ? 50 : 100)}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>/ 100</span>
            </div>
          </div>
        )}
      </div>

      {reading?.alert_reason && (
        <div style={{ 
          fontSize: 'var(--text-xs)', 
          color: 'var(--red)', 
          padding: 'var(--space-2)', 
          background: 'var(--red-dim)', 
          borderRadius: 'var(--radius-sm)',
          marginBottom: 'var(--space-4)',
          display: 'flex',
          gap: 'var(--space-2)',
          alignItems: 'flex-start'
        }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {reading.alert_reason}
          </span>
        </div>
      )}

      <div style={{ marginTop: 'auto', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
        <Link to={`/dashboard?machine=${machineId}`} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
          <Activity size={14} />
          View Dashboard
        </Link>
      </div>
    </div>
  );
}

export function AllMachinesPage() {
  const { machines, setSelectedMachineId } = useMachine();

  // Ensure that when navigating back to dashboard we update selected machine if provided in URL
  // But actually the Link in MachineCard will just change the URL, we should handle that in App or Dashboard
  // To keep it simple, the Link will just click, but we want it to actually set the Machine Context.
  // We can pass a click handler to the Link to update context.

  return (
    <main className="page" id="main-content" tabIndex={-1}>
      <div style={{ marginBottom: 'var(--space-8)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '4px' }}>FACILITY OVERVIEW</div>
        <h1 style={{ marginBottom: 'var(--space-1)' }}>All Machines</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
          Overview of all registered machines across the facility.
        </p>
      </div>

      {machines.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No machines registered yet.</p>
          <Link to="/settings" className="btn btn-primary" style={{ marginTop: 'var(--space-4)', display: 'inline-flex' }}>
            Go to Settings
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {machines.map(m => (
            <div key={m.machine_id} onClick={() => setSelectedMachineId(m.machine_id)}>
              <MachineCard machineId={m.machine_id} name={m.name} />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
