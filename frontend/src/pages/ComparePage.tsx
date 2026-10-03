import { useMachine } from '../contexts/MachineContext';
import { useDailySummaries } from '../hooks/useDailySummaries';
import type { DailySummary } from '../types';
import { useState } from 'react';
import { GitCompare, TrendingUp, TrendingDown, Minus, AlertTriangle, Zap, IndianRupee, Package, Clock, Activity } from 'lucide-react';

function delta(a: number, b: number): { value: number; pct: number } {
  return { value: b - a, pct: a !== 0 ? ((b - a) / a) * 100 : 0 };
}

function DeltaBadge({ val, pct, positiveIsGood = true }: { val: number; pct: number; positiveIsGood?: boolean }) {
  const isGood = positiveIsGood ? val > 0 : val < 0;
  const isBad  = positiveIsGood ? val < 0 : val > 0;
  const color  = isGood ? 'var(--green)' : isBad ? 'var(--red)' : 'var(--text-muted)';
  const Icon   = val > 0 ? TrendingUp : val < 0 ? TrendingDown : Minus;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11px', fontWeight: 600, color }}>
      <Icon size={11} />
      {val > 0 ? '+' : ''}{typeof val === 'number' && Math.abs(val) < 10 ? val.toFixed(2) : val.toFixed(0)}
      {' '}({pct > 0 ? '+' : ''}{pct.toFixed(1)}%)
    </span>
  );
}

function CompareRow({ label, a, b, unit, positiveIsGood = true, precision = 1 }: {
  label: string; a: number; b: number; unit: string; positiveIsGood?: boolean; precision?: number;
}) {
  const d = delta(a, b);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', textAlign: 'right' }}>
        {a.toFixed(precision)} <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{unit}</span>
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', textAlign: 'right' }}>
        {b.toFixed(precision)} <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{unit}</span>
      </span>
      <div style={{ textAlign: 'right' }}>
        <DeltaBadge val={d.value} pct={d.pct} positiveIsGood={positiveIsGood} />
      </div>
    </div>
  );
}

function RootCauseNarrative({ a, b }: { a: DailySummary; b: DailySummary }) {
  const causes: Array<{ confidence: 'HIGH' | 'MED' | 'LOW'; text: string }> = [];

  const vibDelta = b.avg_vibration_mm_s - a.avg_vibration_mm_s;
  const unitDelta = b.good_units - a.good_units;
  const rejectDelta = b.reject_units - a.reject_units;
  const idleDelta = b.idle_minutes - a.idle_minutes;
  const alertDelta = b.alert_count - a.alert_count;
  const tempDelta = b.avg_temp_c - a.avg_temp_c;

  if (vibDelta > 1.0 && alertDelta > 2) {
    causes.push({
      confidence: 'HIGH',
      text: `Mechanical degradation: Vibration rose ${vibDelta.toFixed(1)} mm/s (+${((vibDelta / a.avg_vibration_mm_s) * 100).toFixed(0)}%) and ${alertDelta} more alerts fired. Likely bearing or imbalance developing. Impact: estimated ${Math.abs(Math.round(unitDelta * 0.5))} lost units.`
    });
  }
  if (rejectDelta > 3) {
    causes.push({
      confidence: vibDelta > 0.5 ? 'HIGH' : 'MED',
      text: `Elevated reject rate: ${b.reject_units} rejects vs ${a.reject_units} on reference day (+${rejectDelta}). ${vibDelta > 0.5 ? 'Consistent with vibration-induced dimensional inaccuracy.' : 'Review raw material batch or operator shift.'} Wasted energy: ${(b.reject_kwh - a.reject_kwh).toFixed(3)} kWh extra.`
    });
  }
  if (idleDelta > 10) {
    causes.push({
      confidence: 'MED',
      text: `Increased idle time: ${idleDelta} extra idle minutes reduced effective run time. Idle energy wasted: ${(b.idle_kwh - a.idle_kwh).toFixed(3)} kWh.`
    });
  }
  if (tempDelta > 5) {
    causes.push({
      confidence: 'LOW',
      text: `Higher ambient or motor temperature (+${tempDelta.toFixed(1)}°C). This may have affected material tolerances, cooling efficiency, or operator comfort.`
    });
  }
  if (b.avg_current_a > a.avg_current_a * 1.1) {
    causes.push({
      confidence: 'MED',
      text: `Higher average current draw (${b.avg_current_a.toFixed(1)}A vs ${a.avg_current_a.toFixed(1)}A). Machine worked harder — check load conditions or mechanical resistance.`
    });
  }

  if (causes.length === 0 && unitDelta < 0) {
    causes.push({ confidence: 'LOW', text: 'No significant signal deviations found. Production drop may be due to operator, material, or shift schedule factors not captured by sensors.' });
  }

  if (causes.length === 0) return null;

  const confColor = { HIGH: 'var(--red)', MED: 'var(--amber)', LOW: 'var(--cyan)' };

  return (
    <div className="card" style={{ marginTop: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-4)' }}>
        <AlertTriangle size={16} color="var(--amber)" />
        <span style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>Root Cause Analysis</span>
        {unitDelta !== 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 'var(--text-sm)', color: unitDelta < 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
            {unitDelta < 0 ? '▼' : '▲'} {Math.abs(unitDelta)} units vs reference
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {causes.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: 'var(--space-3)', background: 'var(--bg-raised)', borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${confColor[c.confidence]}` }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: confColor[c.confidence], flexShrink: 0, padding: '2px 6px', background: `${confColor[c.confidence]}18`, borderRadius: 4, alignSelf: 'flex-start', whiteSpace: 'nowrap' }}>
              {c.confidence}
            </span>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComparePage() {
  const { selectedMachineId } = useMachine();
  const { summaries, loading } = useDailySummaries(selectedMachineId, 30);
  const [dateA, setDateA] = useState('');
  const [dateB, setDateB] = useState('');

  const summaryA = summaries.find(s => s.date === dateA);
  const summaryB = summaries.find(s => s.date === dateB);
  const availableDates = summaries.map(s => s.date).sort((a, b) => b.localeCompare(a));

  return (
    <main className="page" id="main-content" tabIndex={-1}>
      <div style={{ marginBottom: 'var(--space-8)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '4px' }}>PRODUCTION INTELLIGENCE</div>
        <h1 style={{ marginBottom: 'var(--space-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <GitCompare size={24} color="var(--cyan)" /> Day-over-Day Comparison
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
          Compare any two production days and get an automated root cause analysis.
        </p>
      </div>

      {/* Date pickers */}
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 'var(--space-4)', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 'var(--space-2)' }}>REFERENCE DAY (A)</div>
            <select value={dateA} onChange={e => setDateA(e.target.value)} style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)' }}>
              <option value="">Select a day…</option>
              {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ fontSize: '1.5rem', color: 'var(--text-muted)', paddingTop: 20 }}>vs</div>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 'var(--space-2)' }}>COMPARISON DAY (B)</div>
            <select value={dateB} onChange={e => setDateB(e.target.value)} style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)' }}>
              <option value="">Select a day…</option>
              {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
          <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-4)' }}>Loading daily summaries…</p>
        </div>
      )}

      {!loading && availableDates.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <Activity size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p style={{ color: 'var(--text-secondary)' }}>No daily summaries yet. They are computed automatically at end of each shift.</p>
        </div>
      )}

      {summaryA && summaryB && (
        <>
          {/* Header summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            {[
              { label: 'Good Units', a: summaryA.good_units, b: summaryB.good_units, icon: <Package size={14} />, unit: '', positiveIsGood: true, prec: 0 },
              { label: 'SEC (kWh/unit)', a: summaryA.sec ?? 0, b: summaryB.sec ?? 0, icon: <Zap size={14} />, unit: '', positiveIsGood: false, prec: 3 },
              { label: 'Session Cost', a: summaryA.total_cost_inr, b: summaryB.total_cost_inr, icon: <IndianRupee size={14} />, unit: '₹', positiveIsGood: false, prec: 0 },
              { label: 'Idle Time', a: summaryA.idle_minutes, b: summaryB.idle_minutes, icon: <Clock size={14} />, unit: 'min', positiveIsGood: false, prec: 0 },
            ].map(({ label, a, b, icon, unit, positiveIsGood, prec }) => {
              const d = delta(a, b);
              const isGood = positiveIsGood ? d.value >= 0 : d.value <= 0;
              return (
                <div key={label} className="card" style={{ borderTop: `2px solid ${isGood ? 'var(--green)' : 'var(--red)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-2)', color: 'var(--text-muted)' }}>{icon}<span style={{ fontSize: '11px' }}>{label}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Day A</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 600 }}>{unit}{a.toFixed(prec)}</div>
                    </div>
                    <div style={{ fontSize: '1.2rem', color: 'var(--text-muted)', margin: '0 8px' }}>→</div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Day B</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 600, color: isGood ? 'var(--green)' : 'var(--red)' }}>{unit}{b.toFixed(prec)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full comparison table */}
          <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', marginBottom: 'var(--space-4)' }}>Full Signal Comparison</div>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', padding: '0 0 8px 0', borderBottom: '1px solid var(--border-default)' }}>
              {['Metric', `Day A — ${summaryA.date}`, `Day B — ${summaryB.date}`, 'Change'].map(h => (
                <span key={h} style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', textAlign: h === 'Metric' ? 'left' : 'right' }}>{h}</span>
              ))}
            </div>
            <CompareRow label="Run Hours"         a={summaryA.run_hours}           b={summaryB.run_hours}           unit="h"      positiveIsGood={true}  precision={1} />
            <CompareRow label="Good Units"        a={summaryA.good_units}          b={summaryB.good_units}          unit="units"  positiveIsGood={true}  precision={0} />
            <CompareRow label="Reject Units"      a={summaryA.reject_units}        b={summaryB.reject_units}        unit="units"  positiveIsGood={false} precision={0} />
            <CompareRow label="Total kWh"         a={summaryA.total_kwh}           b={summaryB.total_kwh}           unit="kWh"    positiveIsGood={false} precision={2} />
            <CompareRow label="SEC (kWh/unit)"    a={summaryA.sec ?? 0}            b={summaryB.sec ?? 0}            unit="kWh/u"  positiveIsGood={false} precision={3} />
            <CompareRow label="Cost (₹)"          a={summaryA.total_cost_inr}      b={summaryB.total_cost_inr}      unit="₹"      positiveIsGood={false} precision={0} />
            <CompareRow label="CO₂e"              a={summaryA.co2e_kg}             b={summaryB.co2e_kg}             unit="kg"     positiveIsGood={false} precision={2} />
            <CompareRow label="Idle Time"         a={summaryA.idle_minutes}        b={summaryB.idle_minutes}        unit="min"    positiveIsGood={false} precision={0} />
            <CompareRow label="Avg Current"       a={summaryA.avg_current_a}       b={summaryB.avg_current_a}       unit="A"      positiveIsGood={false} precision={2} />
            <CompareRow label="Avg Vibration"     a={summaryA.avg_vibration_mm_s}  b={summaryB.avg_vibration_mm_s}  unit="mm/s"   positiveIsGood={false} precision={2} />
            <CompareRow label="Avg Temperature"   a={summaryA.avg_temp_c}          b={summaryB.avg_temp_c}          unit="°C"     positiveIsGood={false} precision={1} />
            <CompareRow label="Avg RPM"           a={summaryA.avg_rpm}             b={summaryB.avg_rpm}             unit="RPM"    positiveIsGood={true}  precision={0} />
            <CompareRow label="Alerts Fired"      a={summaryA.alert_count}         b={summaryB.alert_count}         unit=""       positiveIsGood={false} precision={0} />
            {summaryA.avg_power_factor != null && summaryB.avg_power_factor != null && (
              <CompareRow label="Power Factor" a={summaryA.avg_power_factor} b={summaryB.avg_power_factor} unit="PF" positiveIsGood={true} precision={2} />
            )}
          </div>

          {/* Root cause narrative */}
          <RootCauseNarrative a={summaryA} b={summaryB} />
        </>
      )}
    </main>
  );
}
