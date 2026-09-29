import { useLiveFeed } from '../hooks/useLiveFeed';
import { useEnergyMetrics } from '../hooks/useEnergyMetrics';
import { useAlerts } from '../hooks/useAlerts';
import { useHistoricalReadings } from '../hooks/useHistoricalReadings';
import { SensorReadoutGrid } from '../components/SensorReadoutGrid';
import { MachineStatusCard } from '../components/MachineStatusCard';
import { EnergyMetricsPanel } from '../components/EnergyMetricsPanel';
import { AlertLog } from '../components/AlertLog';
import { StalenessBar } from '../components/StalenessBar';
import { TrendChart } from '../components/TrendChart';
import { formatTimestamp } from '../utils/format';
import { Link } from 'react-router-dom';
import { ChevronRight, MapPin, Cpu } from 'lucide-react';

// In v1 there is exactly one machine. Machine ID comes from env or defaults.
const MACHINE_ID = import.meta.env.VITE_MACHINE_ID ?? 'machine-001';

export function DashboardPage() {
  const { reading, feedState } = useLiveFeed(MACHINE_ID);
  const { metrics, loading: metricsLoading } = useEnergyMetrics(MACHINE_ID);
  const { alerts, loading: alertsLoading } = useAlerts(MACHINE_ID);
  const { readings: history, loading: historyLoading } = useHistoricalReadings(MACHINE_ID, 1);

  const hasReading = reading !== null;

  return (
    <main className="page" id="main-content" tabIndex={-1}>

      {/* Page header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h1 style={{ marginBottom: 'var(--space-1)' }}>Machine Dashboard</h1>
          <div className="flex items-center gap-3" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            <div className="flex items-center gap-1">
              <Cpu size={13} strokeWidth={1.5} />
              {MACHINE_ID}
            </div>
            <div className="flex items-center gap-1">
              <MapPin size={13} strokeWidth={1.5} />
              Production Line A
            </div>
          </div>
        </div>
        {hasReading && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'right' }}>
            <div>Last reading</div>
            <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {formatTimestamp(reading!.timestamp)}
            </div>
          </div>
        )}
      </div>

      {/* Staleness / disconnection indicator */}
      {feedState.state !== 'connected' && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <StalenessBar feedState={feedState} lastReadingTime={feedState.last_received_at} />
        </div>
      )}

      {/* No reading yet */}
      {!hasReading && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <div className="spinner" style={{ margin: '0 auto var(--space-4)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>
            Waiting for the first sensor reading from <strong>{MACHINE_ID}</strong>.
          </p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
            Make sure the sensor node or simulator is sending data to the backend.
          </p>
        </div>
      )}

      {/* Main content — only shown once we have a reading */}
      {hasReading && (
        <>
          {/* Machine status + Energy side by side */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 320px',
              gap: 'var(--space-4)',
              marginBottom: 'var(--space-4)',
            }}
            className="status-energy-row"
          >
            <MachineStatusCard reading={reading!} />
            <EnergyMetricsPanel metrics={metrics} loading={metricsLoading} />
          </div>

          {/* Sensor readout grid */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <SensorReadoutGrid reading={reading!} />
          </div>

          {/* Trend charts */}
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-5)' }}>
              <h2 style={{ fontSize: 'var(--text-md)' }}>Signal Trends (last 1 hour)</h2>
              <Link
                to="/history"
                className="btn btn-ghost"
                style={{ fontSize: 'var(--text-xs)' }}
                id="dashboard-view-history"
              >
                Full history <ChevronRight size={12} />
              </Link>
            </div>
            {historyLoading ? (
              <div className="skeleton" style={{ height: 160 }} />
            ) : (
              <div className="flex flex-col gap-6">
                {(['current_a', 'vibration_mm_s', 'temp_c'] as const).map(sig => (
                  <div key={sig}>
                    <div
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                        fontWeight: 500,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        marginBottom: 'var(--space-2)',
                      }}
                    >
                      {sig === 'current_a' ? 'Current (A)' : sig === 'vibration_mm_s' ? 'Vibration (mm/s)' : 'Temperature (°C)'}
                    </div>
                    <TrendChart readings={history} signal={sig} height={120} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent alerts */}
          <div className="card">
            <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-5)' }}>
              <h2 style={{ fontSize: 'var(--text-md)' }}>Recent Alerts</h2>
              <Link
                to="/alerts"
                className="btn btn-ghost"
                style={{ fontSize: 'var(--text-xs)' }}
                id="dashboard-view-alerts"
              >
                All alerts <ChevronRight size={12} />
              </Link>
            </div>
            <AlertLog alerts={alerts} loading={alertsLoading} compact />
          </div>
        </>
      )}
    </main>
  );
}
