import { Target, Zap, Activity, AlertCircle } from 'lucide-react';
import type { SensorReading, EnergyMetrics } from '../types';

interface QuickInsightsRibbonProps {
  reading: SensorReading;
  metrics: EnergyMetrics | null;
  activeAlertCount: number;
}

export function QuickInsightsRibbon({ reading, metrics: _metrics, activeAlertCount }: QuickInsightsRibbonProps) {
  // 1. Yield
  const countIn = reading.count_in ?? 0;
  const countOut = reading.count_out ?? 0;
  const yieldPct = countIn > 0 ? (countOut / countIn) * 100 : 100;

  // 2. Real-time cost per hour
  // SensorReading doesn't always have power_w on the frontend type depending on the backend version, calculate it
  const powerKw = (reading.current_a * reading.voltage_v * (reading.power_factor || 0.85)) / 1000;
  // Assume a fixed tariff if not easily accessible here, or pass it down. 
  // Let's use 8.5 as a rough industrial average in INR.
  const costPerHour = powerKw * 8.5;

  // 3. Health Index
  const healthIndex = reading.rul_severity_pct != null 
    ? Math.max(0, 100 - reading.rul_severity_pct) 
    : 100;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: 'var(--space-4)',
      marginBottom: 'var(--space-6)'
    }}>
      {/* Metric 1: Yield */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-surface)' }}>
        <div style={{ background: 'rgba(52, 211, 153, 0.1)', padding: '12px', borderRadius: '12px' }}>
          <Target size={24} color="#34d399" />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Production Yield</div>
          <div style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            {yieldPct.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Metric 2: Run Cost Rate */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-surface)' }}>
        <div style={{ background: 'rgba(251, 191, 36, 0.1)', padding: '12px', borderRadius: '12px' }}>
          <Zap size={24} color="#fbbf24" />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Run Cost Rate</div>
          <div style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            ₹{costPerHour.toFixed(2)} <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>/hr</span>
          </div>
        </div>
      </div>

      {/* Metric 3: Machine Health */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-surface)' }}>
        <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '12px', borderRadius: '12px' }}>
          <Activity size={24} color="#38bdf8" />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Health Index</div>
          <div style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
            {healthIndex.toFixed(0)} <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>/100</span>
          </div>
        </div>
      </div>

      {/* Metric 4: Active Alerts */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-surface)' }}>
        <div style={{ background: activeAlertCount > 0 ? 'rgba(248, 113, 113, 0.1)' : 'rgba(156, 163, 175, 0.1)', padding: '12px', borderRadius: '12px' }}>
          <AlertCircle size={24} color={activeAlertCount > 0 ? '#f87171' : '#9ca3af'} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Alerts</div>
          <div style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: activeAlertCount > 0 ? '#f87171' : 'inherit' }}>
            {activeAlertCount}
          </div>
        </div>
      </div>
    </div>
  );
}
