import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import type { SensorReading, EnergyMetricsOut } from '../api/client';

interface AiDiagnosticBannerProps {
  reading: SensorReading;
  metrics: EnergyMetricsOut | null;
}

export function AiDiagnosticBanner({ reading, metrics }: AiDiagnosticBannerProps) {
  
  const generateInsight = () => {
    const yieldPct = reading.count_in && reading.count_in > 0 
      ? (reading.count_out! / reading.count_in) * 100 
      : 100;
    
    let text = `The machine is currently in ${reading.operating_state} state. `;
    
    if (reading.status === 'normal') {
      text += `Vibration and thermal signatures are perfectly aligned with the baseline profile. `;
    } else if (reading.status === 'warning') {
      text += `A minor anomaly has been detected in the ${reading.alert_reason ?? 'sensor signals'}. Predictive maintenance is advised. `;
    } else if (reading.status === 'critical') {
      text += `CRITICAL FAULT DETECTED: ${reading.alert_reason}. Immediate shutdown and inspection is strongly recommended to prevent secondary damage! `;
    }

    if (metrics && metrics.sec) {
      text += `Specific Energy Consumption (SEC) is averaging ${metrics.sec.toFixed(2)} kWh/unit. `;
      if (metrics.idle_kwh > metrics.productive_kwh * 0.2) {
        text += `Idle energy wastage is unusually high (${((metrics.idle_kwh/metrics.energy_kwh)*100).toFixed(0)}%). Consider shutting down auxiliary systems during standby.`;
      }
    }
    
    if (yieldPct < 95 && reading.count_in! > 10) {
      text += ` Production yield has dropped to ${yieldPct.toFixed(1)}%. Inspect recent rejects to isolate quality issues.`;
    }

    return text;
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(8, 145, 178, 0.1) 0%, rgba(13, 148, 136, 0.05) 100%)',
      border: '1px solid rgba(8, 145, 178, 0.2)',
      borderRadius: '12px',
      padding: '16px 20px',
      marginBottom: 'var(--space-6)',
      display: 'flex',
      gap: '16px',
      alignItems: 'flex-start'
    }}>
      <div style={{ 
        background: 'var(--cyan)', 
        color: 'white', 
        padding: '8px', 
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(8, 145, 178, 0.3)'
      }}>
        <Sparkles size={20} />
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--cyan)', margin: '0 0 6px 0', fontWeight: 700 }}>
          Live AI Diagnostic
        </h3>
        <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.5' }}>
          {generateInsight()}
        </p>
      </div>
    </div>
  );
}
