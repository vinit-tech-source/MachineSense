import { useAlerts } from '../hooks/useAlerts';
import { AlertLog } from '../components/AlertLog';
import { RefreshCw } from 'lucide-react';

const MACHINE_ID = import.meta.env.VITE_MACHINE_ID ?? 'machine-001';

export function AlertsPage() {
  const { alerts, loading, refresh } = useAlerts(MACHINE_ID);

  const criticalCount = alerts.filter(a => a.status === 'critical').length;
  const warningCount  = alerts.filter(a => a.status === 'warning').length;
  const resolvedCount = alerts.filter(a => a.resolved_at !== null).length;

  return (
    <main className="page" id="main-content" tabIndex={-1}>
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h1 style={{ marginBottom: 'var(--space-1)' }}>Alert Log</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            Full history of machine alerts with signal attribution for each event.
          </p>
        </div>
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
