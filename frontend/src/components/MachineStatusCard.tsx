import type { SensorReading } from '../types';

interface Props {
  reading: SensorReading;
}

/**
 * Renders the current machine health status card.
 * If status is not normal, shows the alert_reason in full and any signal contributions.
 * Never renders an alert without a reason.
 */
export function MachineStatusCard({ reading }: Props) {
  const { status, alert_reason, est_days_remaining } = reading;

  const isCalibrating = status === 'normal' && est_days_remaining === null;

  const statusConfig = {
    normal:   { label: 'Normal',   dotClass: 'normal',   textColor: 'var(--green)', bg: 'var(--green-dim)' },
    warning:  { label: 'Warning',  dotClass: 'warning',  textColor: 'var(--amber)', bg: 'var(--amber-dim)' },
    critical: { label: 'Critical', dotClass: 'critical', textColor: 'var(--red)',   bg: 'var(--red-dim)'   },
    calibrating: { label: 'Calibrating baseline...', dotClass: 'normal', textColor: 'var(--cyan)', bg: 'var(--cyan-dim)' },
  } as const;

  const cfg = isCalibrating ? statusConfig.calibrating : statusConfig[status];

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
        <span
          className="badge"
          style={{
            background: `${cfg.textColor}18`,
            color: cfg.textColor,
            border: `1px solid ${cfg.textColor}40`,
          }}
        >
          {status.toUpperCase()}
        </span>
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
      <RULSection days={est_days_remaining} status={status} />

      {/* Normal state message */}
      {status === 'normal' && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
          All signals within the learned healthy baseline. No action required.
        </p>
      )}
    </div>
  );
}

function RULSection({ days }: { days: number | null; status: string }) {
  if (days === null) {
    return (
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
        Remaining-useful-life estimate: not yet available. Requires sufficient baseline history.
      </div>
    );
  }

  const pct = Math.min(100, Math.max(0, (days / 90) * 100));
  const color = days > 30 ? 'var(--green)' : days > 10 ? 'var(--amber)' : 'var(--red)';

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-2)' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Est. days to next service
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', color, fontWeight: 600 }}>
          {days}d
        </span>
      </div>
      <div className="rul-bar-track">
        <div
          className="rul-bar-fill"
          style={{ width: `${pct}%`, background: color }}
          role="progressbar"
          aria-valuenow={days}
          aria-valuemin={0}
          aria-valuemax={90}
          aria-label={`${days} days estimated remaining`}
        />
      </div>
    </div>
  );
}
