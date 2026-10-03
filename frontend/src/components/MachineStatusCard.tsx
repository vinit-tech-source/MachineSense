import type { SensorReading } from '../types';
import { useBaselineStats } from '../hooks/useBaselineStats';

interface Props {
  reading: SensorReading;
}

// Days-remaining value that equals the RUL floor defined in anomaly_service.py.
// When est_days_remaining <= RUL_FLOOR_DAYS, we surface severity_pct instead
// of (or in addition to) the countdown, because the countdown is no longer moving.
const RUL_FLOOR_DAYS = 5;

/**
 * Maps rul_severity_pct to a plain-language severity tier.
 * Operators see a label like "High Risk" rather than a raw number.
 *
 * Tiers (chosen to communicate escalating urgency):
 *   0  – 39 %  → Monitoring     (normal ops, sub-alert degradation visible)
 *   40 – 69 %  → Elevated Risk  (amber — plan service within the next few shifts)
 *   70 – 89 %  → High Risk      (deep amber/orange — service soon, do not defer)
 *   90 – 100 % → Critical Risk  (red — service now, continued operation not advised)
 */
function getSeverityTier(pct: number): {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  pulseClass?: string;
} {
  if (pct >= 90) {
    return {
      label: 'Critical Risk',
      color: 'var(--red)',
      bgColor: 'var(--red-dim)',
      borderColor: 'rgba(192, 57, 43, 0.45)',
      pulseClass: 'severity-pulse-red',
    };
  }
  if (pct >= 70) {
    return {
      label: 'High Risk',
      color: '#D4731A',            // deep amber-orange, distinct from warning amber
      bgColor: 'rgba(212, 115, 26, 0.14)',
      borderColor: 'rgba(212, 115, 26, 0.35)',
      pulseClass: 'severity-pulse-orange',
    };
  }
  if (pct >= 40) {
    return {
      label: 'Elevated Risk',
      color: 'var(--amber)',
      bgColor: 'var(--amber-dim)',
      borderColor: 'rgba(232, 160, 32, 0.3)',
    };
  }
  return {
    label: 'Monitoring',
    color: 'var(--cyan)',
    bgColor: 'var(--cyan-dim)',
    borderColor: 'rgba(0, 180, 216, 0.25)',
  };
}

/**
 * Renders the current machine health status card.
 * If status is not normal, shows the alert_reason in full and any signal contributions.
 * Never renders an alert without a reason.
 */
export function MachineStatusCard({ reading }: Props) {
  const { status, operating_state, alert_reason, est_days_remaining, rul_severity_pct } = reading;

  const isCalibrating = status === 'normal' && est_days_remaining === null;

  const statusConfig = {
    normal:   { label: 'Normal',   dotClass: 'normal',   textColor: 'var(--green)', bg: 'var(--green-dim)' },
    warning:  { label: 'Warning',  dotClass: 'warning',  textColor: 'var(--amber)', bg: 'var(--amber-dim)' },
    critical: { label: 'Critical', dotClass: 'critical', textColor: 'var(--red)',   bg: 'var(--red-dim)'   },
    calibrating: { label: 'Calibrating baseline...', dotClass: 'normal', textColor: 'var(--cyan)', bg: 'var(--cyan-dim)' },
  } as const;

  const cfg = isCalibrating
    ? statusConfig.calibrating
    : (statusConfig[status as keyof typeof statusConfig] ?? statusConfig.normal);

  return (
    <div
      className="card"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.textColor}30`,
      }}
      role="region"
      aria-label={`Machine health status: ${cfg.label}`}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="flex items-center gap-3">
          <div className={`status-dot ${cfg.dotClass}`} style={{ width: 12, height: 12 }} />
          <span
            style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 700,
              color: cfg.textColor,
              letterSpacing: '-0.01em',
            }}
          >
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Operating State Badge */}
          <span
            className="badge"
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: 'var(--text-secondary)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            {(operating_state || 'UNKNOWN').toUpperCase().replace('_', ' ')}
          </span>
          <span
            className="badge"
            style={{
              background: `${cfg.textColor}18`,
              color: cfg.textColor,
              border: `1px solid ${cfg.textColor}40`,
            }}
          >
            {(status || 'UNKNOWN').toUpperCase()}
          </span>
        </div>
      </div>

      {/* Alert reason — mandatory when not normal */}
      {status !== 'normal' && alert_reason && (
        <div
          style={{
            background: `${cfg.textColor}10`,
            border: `1px solid ${cfg.textColor}30`,
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-4)',
          }}
          role="alert"
          aria-live="polite"
        >
          <div
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: cfg.textColor,
              marginBottom: 'var(--space-2)',
            }}
          >
            Alert reason
          </div>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {alert_reason}
          </p>
        </div>
      )}

      {/* RUL estimate */}
      <RULSection days={est_days_remaining} severityPct={rul_severity_pct} status={status} machineId={reading.machine_id} />

      {/* Normal state message */}
      {status === 'normal' && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
          All signals within the learned healthy baseline. No action required.
        </p>
      )}
    </div>
  );
}

interface RULSectionProps {
  days: number | null;
  severityPct: number | null;
  status: string;
  machineId: string;
}

function RULSection({ days, severityPct, machineId }: RULSectionProps) {
  const { stats } = useBaselineStats(machineId);

  if (days === null) {
    const count = stats?.sample_count ?? 0;
    const required = 60; // From ANOMALY_MIN_BASELINE_SAMPLES
    const pct = Math.min(100, (count / required) * 100);
    
    return (
      <div style={{ padding: 'var(--space-3) 0' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase' }}>
            Calibrating Baseline
          </span>
          <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>
            {count} / {required}
          </span>
        </div>
        <div style={{ height: 4, background: 'var(--bg-raised)', borderRadius: 2, overflow: 'hidden' }}>
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: 'var(--cyan)',
              transition: 'width 1s ease',
            }}
          />
        </div>
      </div>
    );
  }

  // ── Normal countdown bar (shown always while days > floor) ──────────────
  const isAtFloor = days <= RUL_FLOOR_DAYS;
  const countdownPct = Math.min(100, Math.max(0, (days / 90) * 100));
  const countdownColor = days > 30 ? 'var(--green)' : days > 10 ? 'var(--amber)' : 'var(--red)';

  // ── Severity tier (shown when at/near the floor AND severity is available) ──
  const showSeverityBadge = isAtFloor && severityPct !== null;
  const tier = showSeverityBadge ? getSeverityTier(severityPct!) : null;

  return (
    <div>
      {/* Row: label + days counter */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
        <span style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          fontWeight: 500,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          Est. days to next service
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-lg)',
          color: countdownColor,
          fontWeight: 600,
        }}>
          {days}d
        </span>
      </div>

      {/* Standard countdown progress bar */}
      <div className="rul-bar-track" style={{ marginBottom: isAtFloor ? 'var(--space-4)' : 0 }}>
        <div
          className="rul-bar-fill"
          style={{ width: `${countdownPct}%`, background: countdownColor }}
          role="progressbar"
          aria-valuenow={days}
          aria-valuemin={0}
          aria-valuemax={90}
          aria-label={`${days} days estimated remaining`}
        />
      </div>

      {/* ── Severity badge — only shown once days is at the floor ─────────── */}
      {showSeverityBadge && tier && (
        <div
          className={tier.pulseClass ?? ''}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            background: tier.bgColor,
            border: `1px solid ${tier.borderColor}`,
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
          }}
          role="status"
          aria-label={`Service urgency: ${tier.label}`}
        >
          {/* Severity indicator dot */}
          <div style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: tier.color,
            flexShrink: 0,
            boxShadow: `0 0 8px ${tier.color}80`,
          }} />

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Label row */}
            <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
              <span style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: tier.color,
              }}>
                {tier.label}
              </span>
              <span style={{
                fontSize: 'var(--text-xs)',
                fontFamily: 'var(--font-mono)',
                color: tier.color,
                opacity: 0.75,
              }}>
                {severityPct!.toFixed(0)}%
              </span>
            </div>

            {/* Severity fill bar — distinct track height from the countdown bar */}
            <div style={{
              height: 4,
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 2,
              overflow: 'hidden',
            }}>
              <div
                style={{
                  width: `${severityPct}%`,
                  height: '100%',
                  borderRadius: 2,
                  background: tier.color,
                  transition: 'width 1s ease',
                  boxShadow: `0 0 6px ${tier.color}80`,
                }}
                role="progressbar"
                aria-valuenow={severityPct!}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Severity ${severityPct!.toFixed(0)}%`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Contextual note below the severity badge */}
      {showSeverityBadge && tier && (
        <p style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          marginTop: 'var(--space-2)',
          lineHeight: 1.5,
        }}>
          {severityPct! >= 90
            ? 'Service overdue. Continued operation increases failure risk.'
            : severityPct! >= 70
            ? 'Schedule service at earliest opportunity to prevent unplanned downtime.'
            : 'Signals trending toward service limit. Monitor closely and plan service.'}
        </p>
      )}
    </div>
  );
}
