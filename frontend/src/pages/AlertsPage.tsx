import { useAlerts } from '../hooks/useAlerts';
import { AlertLog } from '../components/AlertLog';
import { RefreshCw } from 'lucide-react';

import { useMachine } from '../contexts/MachineContext';
import { MachineSelector } from '../components/MachineSelector';

export function AlertsPage() {
  const { selectedMachineId: MACHINE_ID, machines } = useMachine();
  const { alerts, loading, refresh } = useAlerts(MACHINE_ID);
  const currentMachine = machines.find(m => m.machine_id === MACHINE_ID);
  const shortId = currentMachine ? currentMachine.name.split(' ')[0] : MACHINE_ID;

  const criticalCount = alerts.filter(a => a.status === 'critical').length;
  const warningCount  = alerts.filter(a => a.status === 'warning').length;
  const resolvedCount = alerts.filter(a => a.resolved_at !== null).length;

  return (
    <main className="page" id="main-content" tabIndex={-1}>
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-8)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '4px' }}>EVENT LOG</div>
          <h1 style={{ marginBottom: 'var(--space-1)' }}>Alert History</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            Full history of machine alerts with signal attribution for <code style={{ color: 'var(--cyan)' }}>{shortId}</code>.
          </p>
        </div>
        <div className="flex gap-4 items-center" style={{ flexWrap: 'wrap' }}>
          <MachineSelector />
          <button
            className="btn btn-secondary"
          onClick={refresh}
          id="alerts-refresh"
          aria-label="Refresh alert log"
        >
          <RefreshCw size={14} strokeWidth={1.5} />
          Refresh
        </button>
      </div>
      </div>

      {/* Summary counts */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="card" style={{ borderTop: '2px solid var(--red)' }}>
            <div className="metric-label" style={{ marginBottom: 'var(--space-2)' }}>Critical</div>
            <div className="metric-value" style={{ color: 'var(--red)' }}>{criticalCount}</div>
          </div>
          <div className="card" style={{ borderTop: '2px solid var(--amber)' }}>
            <div className="metric-label" style={{ marginBottom: 'var(--space-2)' }}>Warning</div>
            <div className="metric-value" style={{ color: 'var(--amber)' }}>{warningCount}</div>
          </div>
          <div className="card" style={{ borderTop: '2px solid var(--green)' }}>
            <div className="metric-label" style={{ marginBottom: 'var(--space-2)' }}>Resolved</div>
            <div className="metric-value" style={{ color: 'var(--green)' }}>{resolvedCount}</div>
          </div>
        </div>
      )}

      <div className="card">
        <AlertLog alerts={alerts} loading={loading} compact={false} />
      </div>
    </main>
  );
}
