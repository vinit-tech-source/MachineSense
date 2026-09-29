import type { AlertRecord } from '../types';
import { AlertTriangle, XCircle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { formatSignalLabel } from '../utils/format';

interface Props {
  alerts: AlertRecord[];
  loading: boolean;
  compact?: boolean;
}

export function AlertLog({ alerts, loading, compact = false }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 72 }} />)}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div
        style={{
          padding: 'var(--space-8)',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: 'var(--text-sm)',
        }}
      >
        No alerts recorded.
      </div>
    );
  }

  const displayAlerts = compact ? alerts.slice(0, 5) : alerts;

  return (
    <div className="flex flex-col gap-2" role="log" aria-label="Alert log" aria-live="polite">
      {displayAlerts.map(alert => (
        <AlertItem key={alert.id} alert={alert} />
      ))}
    </div>
  );
}

function AlertItem({ alert }: { alert: AlertRecord }) {
  const [expanded, setExpanded] = useState(false);

  const Icon = alert.status === 'critical' ? XCircle : AlertTriangle;
  const color = alert.status === 'critical' ? 'var(--red)' : 'var(--amber)';

  const ts = new Date(alert.timestamp).toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const hasContributions = alert.contributions && alert.contributions.length > 0;

  return (
    <div
      className={`alert-item ${alert.status}`}
      role="listitem"
      aria-label={`${alert.status} alert at ${ts}`}
    >
      <Icon size={16} color={color} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 2 }} />
      <div className="flex flex-col gap-1" style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center justify-between gap-2" style={{ flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {ts}
          </span>
          <span
            className="badge"
            style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}
          >
            {alert.status}
          </span>
        </div>

        <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)', lineHeight: 1.5 }}>
          {alert.alert_reason}
        </p>

        {alert.resolved_at && (
          <div className="flex items-center gap-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--green)' }}>
            <CheckCircle size={11} strokeWidth={2} />
            Resolved {new Date(alert.resolved_at).toLocaleString('en-IN', {
              hour: '2-digit', minute: '2-digit',
            })}
          </div>
        )}

        {hasContributions && (
          <button
            className="btn btn-ghost"
            style={{ alignSelf: 'flex-start', padding: '2px 0', fontSize: 'var(--text-xs)', gap: 4 }}
            onClick={() => setExpanded(e => !e)}
            aria-expanded={expanded}
            aria-label="Toggle signal breakdown"
            id={`alert-expand-${alert.id}`}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Hide' : 'Show'} signal breakdown
          </button>
        )}

        {expanded && hasContributions && (
          <div
            style={{
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--space-3)',
              marginTop: 'var(--space-2)',
            }}
          >
            <table className="data-table" aria-label="Signal contributions">
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>Actual</th>
                  <th>Baseline</th>
                  <th>Deviation (z)</th>
                </tr>
              </thead>
              <tbody>
                {alert.contributions.map(c => (
                  <tr key={c.signal}>
                    <td style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-secondary)' }}>
                      {c.label ?? formatSignalLabel(c.signal)}
                    </td>
                    <td>{c.actual.toFixed(2)} {c.unit}</td>
                    <td>{c.baseline_mean.toFixed(2)} {c.unit}</td>
                    <td style={{ color: Math.abs(c.z_score) > 3 ? 'var(--red)' : 'var(--amber)' }}>
                      {c.z_score > 0 ? '+' : ''}{c.z_score.toFixed(1)} std
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
