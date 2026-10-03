import type { AlertRecord, AnomalyContribution } from '../types';
import { AlertTriangle, XCircle, CheckCircle, ChevronDown, ChevronUp, Activity, ShieldCheck, Info } from 'lucide-react';
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
      <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
        <ShieldCheck size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
        No alerts recorded. Machine is healthy.
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

function ConfidenceBadge({ grade }: { grade: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    'A': { bg: 'rgba(5,150,105,0.15)', text: 'var(--green)' },
    'B': { bg: 'rgba(232,160,32,0.15)', text: 'var(--amber)' },
    'C': { bg: 'rgba(192,57,43,0.15)', text: 'var(--red)' },
  };
  const c = colors[grade] ?? colors['C'];
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: c.bg, color: c.text, letterSpacing: '0.05em' }}>
      GRADE {grade}
    </span>
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

  let duration: string | null = null;
  if (isResolved && alert.resolved_at) {
    const ms = new Date(alert.resolved_at).getTime() - new Date(alert.timestamp).getTime();
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    duration = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  // Infer confidence grade from z-scores
  const maxZ = alert.contributions?.reduce((m, c) => Math.max(m, Math.abs(c.z_score)), 0) ?? 0;
  const grade = maxZ >= 6 ? 'A' : maxZ >= 4 ? 'B' : 'C';
  const isSafeToAct = alert.contributions?.length >= 2 || maxZ >= 5;

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
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{ts}</span>
            <div className="flex items-center gap-2">
              <ConfidenceBadge grade={grade} />
              {isSafeToAct && (
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'rgba(0,180,216,0.12)', color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck size={10} strokeWidth={2} /> SAFE TO ACT
                </span>
              )}
              {isResolved ? (
                <span className="badge badge-normal">RESOLVED</span>
              ) : (
                <span className="badge" style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}>
                  {alert.status.toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Alert reason */}
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 'var(--space-2)' }}>
            {alert.alert_reason}
          </p>

          {/* Resolved info */}
          {isResolved && alert.resolved_at && (
            <div className="flex items-center gap-3" style={{ fontSize: 'var(--text-xs)', color: 'var(--green)' }}>
              <div className="flex items-center gap-1">
                <CheckCircle size={11} strokeWidth={2} />
                Resolved at {new Date(alert.resolved_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {duration && <span style={{ color: 'var(--text-muted)' }}>· lasted {duration}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Evidence note for grade C (low confidence) */}
      {grade === 'C' && !isResolved && (
        <div style={{ marginLeft: 'calc(16px + var(--space-3))', display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', color: 'var(--text-muted)' }}>
          <Info size={12} />
          Low-confidence signal — verify manually before acting
        </div>
      )}

      {/* Contributions toggle */}
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
          <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
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
  const barPct = Math.min(100, (absZ / 8) * 100);
  const direction = c.z_score > 0 ? '▲' : '▼';

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {c.label}
        </span>
        <div className="flex items-center gap-3" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
          <span style={{ color: barColor }}>{direction} {c.actual.toFixed(2)} {c.unit}</span>
          <span style={{ color: 'var(--text-muted)' }}>vs {c.baseline_mean.toFixed(2)} {c.unit}</span>
          <span style={{ color: barColor, fontWeight: 700 }}>{c.z_score > 0 ? '+' : ''}{c.z_score.toFixed(1)}σ</span>
        </div>
      </div>
      <div style={{ height: 3, background: 'var(--bg-raised)', borderRadius: 2, overflow: 'hidden' }}>
        <div
          style={{ width: `${barPct}%`, height: '100%', background: barColor, borderRadius: 2, boxShadow: `0 0 4px ${barColor}80`, transition: 'width 0.4s ease' }}
        />
      </div>
    </div>
  );
}
