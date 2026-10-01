import type { AlertRecord, AnomalyContribution } from '../types';
import { AlertTriangle, XCircle, CheckCircle, ChevronDown, ChevronUp, Activity } from 'lucide-react';
import { useState } from 'react';

interface Props {
  alerts: AlertRecord[];
  loading: boolean;
  compact?: boolean;
}

export function AlertLog({ alerts, loading, compact = false }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
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

  const isCritical = alert.status === 'critical';
  const Icon = isCritical ? XCircle : AlertTriangle;
  const color = isCritical ? 'var(--red)' : 'var(--amber)';

  const ts = new Date(alert.timestamp).toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const isResolved = !!alert.resolved_at;
  const hasContributions = alert.contributions && alert.contributions.length > 0;

  // Compute duration if resolved
  let duration: string | null = null;
  if (isResolved && alert.resolved_at) {
    const ms = new Date(alert.resolved_at).getTime() - new Date(alert.timestamp).getTime();
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  return (
    <div
      className={`alert-item ${isResolved ? 'normal' : alert.status}`}
      role="listitem"
      aria-label={`${alert.status} alert at ${ts}`}
      style={{ flexDirection: 'column', gap: 'var(--space-3)' }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {isResolved
          ? <CheckCircle size={16} color="var(--green)" strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 3 }} />
          : <Icon size={16} color={color} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 3 }} />
        }

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top row: timestamp + badges */}
          <div className="flex items-center justify-between gap-2" style={{ flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {ts}
            </span>
            <div className="flex items-center gap-2">
              {isResolved ? (
                <span className="badge badge-normal">RESOLVED</span>
              ) : (
                <span
                  className="badge"
                  style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}
                >
                  {alert.status.toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Alert reason */}
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 'var(--space-2)' }}>
            {alert.alert_reason}
          </p>

          {/* Resolved info row */}
          {isResolved && alert.resolved_at && (
            <div className="flex items-center gap-3" style={{ fontSize: 'var(--text-xs)', color: 'var(--green)' }}>
              <div className="flex items-center gap-1">
                <CheckCircle size={11} strokeWidth={2} />
                Resolved at {new Date(alert.resolved_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {duration && (
                <span style={{ color: 'var(--text-muted)' }}>· lasted {duration}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Contributions toggle button */}
      {hasContributions && (
        <button
          className="btn btn-ghost"
          style={{
            alignSelf: 'flex-start',
            marginLeft: 'calc(16px + var(--space-3))',
            padding: '2px 8px',
            fontSize: 'var(--text-xs)',
            gap: 4,
            color: isResolved ? 'var(--green)' : color,
            border: `1px solid ${isResolved ? 'var(--green)' : color}30`,
            borderRadius: 'var(--radius-sm)',
          }}
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          id={`alert-expand-${alert.id}`}
        >
          <Activity size={11} strokeWidth={2} />
          {expanded ? 'Hide' : 'Show'} signal breakdown ({alert.contributions.length})
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      )}

      {/* Expanded contributions panel */}
      {expanded && hasContributions && (
        <div
          style={{
            marginLeft: 'calc(16px + var(--space-3))',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            border: `1px solid ${isResolved ? 'var(--green)' : color}20`,
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: 'var(--space-3)',
            }}
          >
            Contributing Signals
          </div>
          <div className="flex flex-col gap-3">
            {alert.contributions.map(c => (
              <ContributionRow key={c.signal} c={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ContributionRow({ c }: { c: AnomalyContribution }) {
  const absZ = Math.abs(c.z_score);
  const isCritical = absZ >= 4.0;
  const barColor = isCritical ? 'var(--red)' : 'var(--amber)';
  // Cap bar at z=8 for display purposes
  const barPct = Math.min(100, (absZ / 8) * 100);
  const direction = c.z_score > 0 ? '▲' : '▼';

  return (
    <div>
      {/* Signal name + values */}
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <span style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-sans)',
        }}>
          {c.label}
        </span>
        <div className="flex items-center gap-3" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
          <span style={{ color: barColor }}>
            {direction} {c.actual.toFixed(2)} {c.unit}
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            vs {c.baseline_mean.toFixed(2)} {c.unit}
          </span>
          <span style={{ color: barColor, fontWeight: 700 }}>
            {c.z_score > 0 ? '+' : ''}{c.z_score.toFixed(1)}σ
          </span>
        </div>
      </div>
      {/* Z-score severity bar */}
      <div style={{ height: 3, background: 'var(--bg-raised)', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{
            width: `${barPct}%`,
            height: '100%',
            background: barColor,
            borderRadius: 2,
            boxShadow: `0 0 4px ${barColor}80`,
            transition: 'width 0.4s ease',
          }}
        />
      </div>
    </div>
  );
}

