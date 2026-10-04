import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AlertTriangle, Activity, ChevronRight, MapPin, Cpu, Brain, CheckCircle, TrendingDown } from 'lucide-react';
import { usePlant } from '../lib/yieldwatt/store';
import { formatTimestamp } from '../utils/format';
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, ReferenceLine, Tooltip, CartesianGrid } from 'recharts';

function WhyPanel({ contributions }: { contributions: { feature: string; z: number }[] }) {
  const sorted = [...contributions].sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  return (
    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
      <h2 style={{ fontSize: 'var(--text-md)', marginBottom: 4 }}>Why? (Root Cause)</h2>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
        Shows which sensors deviate most from the baseline. Higher Z-scores indicate anomalies.
      </p>
      <div className="flex flex-col gap-3">
        {sorted.map(c => (
          <div key={c.feature} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 80, fontSize: 'var(--text-xs)', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{c.feature}</div>
            <div style={{ flex: 1, background: 'var(--bg-elevated)', height: 12, borderRadius: 6, position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: c.z < 0 ? `${50 + (c.z / 10) * 50}%` : '50%',
                width: `${Math.min(50, Math.abs(c.z) / 10 * 50)}%`,
                background: Math.abs(c.z) > 2.5 ? 'var(--red)' : 'var(--cyan)',
                borderRadius: 6
              }} />
              <div style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 2, background: 'var(--border-subtle)' }} />
            </div>
            <div style={{ width: 50, fontSize: 'var(--text-xs)', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{c.z > 0 ? '+' : ''}{c.z.toFixed(1)}z</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WhatIfTester({ 
  isManual, setIsManual,
  manualKw, setManualKw,
  manualPf, setManualPf,
  manualTemp, setManualTemp,
  manualVib, setManualVib,
  displayInference
}: any) {
  
  const handleInput = (setter: any) => (e: any) => {
    setter(e.target.value);
    if (!isManual) setIsManual(true);
  };

  return (
    <div className="card" style={{ background: 'var(--bg-elevated)', border: isManual ? '1px solid var(--cyan)' : '1px solid var(--border-default)', transition: 'all 0.2s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 style={{ fontSize: 'var(--text-md)', margin: 0 }}>Manual Test Mode</h2>
        {isManual && (
          <button 
            style={{ padding: 0, fontSize: '11px', background: 'none', border: 'none', color: 'var(--cyan)', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => setIsManual(false)}
          >
            Resume Live
          </button>
        )}
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: isManual ? 'var(--space-4)' : 0 }}>
        <div>
          <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>POWER (kW)</label>
          <input className="input" type="number" step="0.1" value={manualKw} onChange={handleInput(setManualKw)} style={{ width: '100%', padding: '4px 8px', fontSize: 'var(--text-sm)' }} />
        </div>
        <div>
          <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>PF</label>
          <input className="input" type="number" step="0.01" value={manualPf} onChange={handleInput(setManualPf)} style={{ width: '100%', padding: '4px 8px', fontSize: 'var(--text-sm)' }} />
        </div>
        <div>
          <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>TEMP (°C)</label>
          <input className="input" type="number" step="0.1" value={manualTemp} onChange={handleInput(setManualTemp)} style={{ width: '100%', padding: '4px 8px', fontSize: 'var(--text-sm)' }} />
        </div>
        <div>
          <label style={{ fontSize: '9px', color: 'var(--text-muted)' }}>VIB (mm/s)</label>
          <input className="input" type="number" step="0.1" value={manualVib} onChange={handleInput(setManualVib)} style={{ width: '100%', padding: '4px 8px', fontSize: 'var(--text-sm)' }} />
        </div>
      </div>

      {isManual && (
        <div style={{ 
          padding: '8px 12px', 
          borderRadius: '4px',
          fontSize: 'var(--text-sm)',
          background: displayInference.alerting ? 'var(--red-dim)' : 'var(--green-dim)',
          color: displayInference.alerting ? 'var(--red)' : 'var(--green)',
          border: `1px solid ${displayInference.alerting ? 'var(--red)' : 'var(--green)'}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontWeight: 600
        }}>
          <span>AI Decision: {displayInference.alerting ? 'FAULT' : 'NORMAL'}</span>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{(displayInference.anomalyScore ?? 0).toFixed(2)} score</span>
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const [params, setParams] = useSearchParams();
  const machineId = params.get('machine') || 'IM-01';
  
  const m = usePlant(s => s.machine(machineId));
  const setFault = usePlant(s => s.setFault);
  const plant = usePlant(s => s.plant);

  const [isManual, setIsManual] = React.useState(false);
  const [manualKw, setManualKw] = React.useState("");
  const [manualPf, setManualPf] = React.useState("");
  const [manualTemp, setManualTemp] = React.useState("");
  const [manualVib, setManualVib] = React.useState("");

  React.useEffect(() => {
    if (m && !isManual) {
      setManualKw(m.sample.kw.toFixed(1));
      setManualPf(m.sample.pf.toFixed(2));
      setManualTemp(m.sample.tempC.toFixed(1));
      setManualVib(m.sample.vibRms.toFixed(2));
    }
  }, [m, isManual]);

  if (!m) return <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>Machine not found</div>;

  const customSample = {
    ...m.sample,
    kw: parseFloat(manualKw) || 0,
    pf: parseFloat(manualPf) || 0,
    tempC: parseFloat(manualTemp) || 0,
    vibRms: parseFloat(manualVib) || 0
  };

  const displaySample = isManual ? customSample : m.sample;
  const displayInference = isManual ? m.engine.infer(customSample) : m.inference;
  const displayRecs = isManual ? m.engine.recommend(customSample, displayInference) : m.recs;
  const displaySecHistory = isManual && displayInference.secRolling != null 
    ? [...m.secHistory, { t: Date.now(), sec: displayInference.secRolling }] 
    : m.secHistory;

  const profile = m.engine.profile;
  const model = m.engine.modelCard();

  return (
    <main className="page" id="main-content" tabIndex={-1}>

      {/* Page header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-8)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '4px' }}>LIVE TELEMETRY</div>
          <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-2)', fontFamily: 'var(--font-mono)' }}>
            {profile.name}
          </h1>
          <div className="flex items-center gap-4" style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
            <div className="flex items-center gap-1">
              <Cpu size={14} strokeWidth={1.5} color="var(--cyan)" />
              ID: {profile.id}
            </div>
            <div className="flex items-center gap-1">
              <MapPin size={14} strokeWidth={1.5} color="var(--amber)" />
              {profile.hall}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center">
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginRight: '12px', fontWeight: 600 }}>MONITORING:</div>
            <select 
              value={machineId}
              onChange={(e) => {
                setParams({ machine: e.target.value });
                setIsManual(false);
              }}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--cyan-dim)',
                color: 'var(--cyan)',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                cursor: 'pointer',
                boxShadow: '0 0 10px rgba(0, 180, 216, 0.1)'
              }}
            >
              {plant.machines.map(x => (
                <option key={x.engine.profile.id} value={x.engine.profile.id} style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
                  {x.engine.profile.id} — {x.engine.profile.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ textAlign: 'right', background: 'var(--bg-raised)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '4px' }}>LAST READING</div>
            <div className="flex items-center gap-2" style={{ color: 'var(--cyan)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              <div className="status-dot normal" style={{ width: 8, height: 8 }} />
              {formatTimestamp(displaySample.t)}
            </div>
          </div>
        </div>
      </div>

      {displayInference.shift === 'drift' && (
        <div style={{ background: 'var(--amber-dim)', border: '1px solid var(--amber)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="flex items-center gap-3" style={{ color: 'var(--amber)' }}>
            <AlertTriangle size={24} />
            <strong style={{ fontSize: 'var(--text-md)' }}>Pattern shifted - looks like wear/season, not a fault</strong>
          </div>
          <button className="btn btn-primary" onClick={() => m.engine.confirmRebaseline()} style={{ fontSize: 'var(--text-sm)', padding: '8px 16px' }}>
            Confirm new normal
          </button>
        </div>
      )}

      {displayInference.shift === 'fault' && (
        <div style={{ background: 'var(--red-dim)', border: '1px solid var(--red)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 12, color: 'var(--red)' }}>
          <AlertTriangle size={24} />
          <strong style={{ fontSize: 'var(--text-md)' }}>Fault detected - anomalous pattern shift</strong>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-md)' }}>Rolling SEC</h2>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Specific Energy Consumption (kWh per unit of work). <strong>Lower is better.</strong></div>
            </div>
            {displaySecHistory.length > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--cyan)' }}>
                  {displaySecHistory[displaySecHistory.length - 1].sec.toFixed(4)}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>kWh/unit</div>
              </div>
            )}
          </div>
          <div style={{ flex: 1, minHeight: 180, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displaySecHistory} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--cyan)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--cyan)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis dataKey="t" hide />
                <YAxis 
                  domain={['auto', 'auto']} 
                  tick={{ fill: 'var(--text-muted)', fontSize: 10 }} 
                  width={55} 
                  tickFormatter={(val) => val.toFixed(4)} 
                />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  itemStyle={{ color: 'var(--cyan)', fontWeight: 'bold' }}
                  labelStyle={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}
                  formatter={(val: number) => [val.toFixed(4) + ' kWh/unit', 'SEC']}
                  labelFormatter={(label) => new Date(label).toLocaleTimeString()}
                />
                <ReferenceLine 
                  y={profile.bestSec} 
                  stroke="var(--green)" 
                  strokeDasharray="4 4" 
                  label={{ position: 'top', value: 'Personal Best', fill: 'var(--green)', fontSize: 10, fontWeight: 'bold' }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="sec" 
                  stroke="var(--cyan)" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorSec)" 
                  isAnimationActive={false} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card">
            <h2 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={18} color="var(--amber)" /> Demo Fault Injector
            </h2>
            <div style={{ position: 'relative' }}>
              <select 
                value={m.fault}
                onChange={(e) => {
                  setFault(machineId, e.target.value as any);
                  setIsManual(false);
                }}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500,
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none',
                  transition: 'all 0.2s ease',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--cyan)';
                  e.target.style.boxShadow = '0 0 0 2px var(--cyan-dim)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border-default)';
                  e.target.style.boxShadow = 'none';
                }}
                onMouseEnter={(e) => e.target.style.background = 'var(--bg-raised)'}
                onMouseLeave={(e) => e.target.style.background = 'var(--bg-surface)'}
              >
                <option value="none">Healthy (No faults)</option>
                <option value="bearing">Bearing wear</option>
                <option value="power_factor">Low PF</option>
                <option value="idle_waste">Idle running</option>
                <option value="quality">High rejects</option>
              </select>
              <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                <ChevronRight size={16} style={{ transform: 'rotate(90deg)' }} />
              </div>
            </div>
          </div>

          <WhatIfTester 
            isManual={isManual} setIsManual={setIsManual}
            manualKw={manualKw} setManualKw={setManualKw}
            manualPf={manualPf} setManualPf={setManualPf}
            manualTemp={manualTemp} setManualTemp={setManualTemp}
            manualVib={manualVib} setManualVib={setManualVib}
            displayInference={displayInference}
          />

          <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Power</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 600 }}>{displaySample.kw.toFixed(1)} kW</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>PF</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 600 }}>{displaySample.pf.toFixed(2)}</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Temp</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 600 }}>{displaySample.tempC.toFixed(1)} °C</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vibration</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-lg)', fontWeight: 600 }}>{displaySample.vibRms.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <WhyPanel contributions={displayInference.contributions} />
        
        <div className="card">
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontSize: 'var(--text-md)', marginBottom: 4 }}>Trained ML Model</h2>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
              The Isolation Forest is trained exclusively on this machine's historical data to learn its unique "normal" baseline.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Phase:</span> <br/>
              <span style={{ color: 'var(--cyan)', textTransform: 'uppercase', fontWeight: 600 }}>{model.phase.replace('_', ' ')}</span>
            </div>
            <div><span style={{ color: 'var(--text-muted)' }}>Trees:</span> <br/>{model.trees}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>Producing Samples:</span> <br/>{model.producingSamples}</div>
            <div><span style={{ color: 'var(--text-muted)' }}>Threshold:</span> <br/>{model.threshold.toFixed(2)}</div>
            {model.statThreshold && <div><span style={{ color: 'var(--text-muted)' }}>Stat Threshold:</span> <br/>{model.statThreshold.toFixed(2)}</div>}
            {model.quarantined != null && <div><span style={{ color: 'var(--text-muted)' }}>Quarantined:</span> <br/>{model.quarantined}</div>}
            {model.acceptedSamples != null && <div><span style={{ color: 'var(--text-muted)' }}>Accepted:</span> <br/>{model.acceptedSamples}</div>}
          </div>
          <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <strong>Trained on:</strong> {model.trainedOn} <br/>
            <strong>Note:</strong> {model.note}
          </div>
        </div>
      </div>
      
      <div className="card">
        <h2 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={20} color="var(--cyan)" /> Recent AI Conclusions
        </h2>
        {displayRecs.length === 0 ? (
           <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)', color: 'var(--green)', padding: 'var(--space-6)', background: 'var(--green-dim)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-lg)' }}>
             <CheckCircle size={36} />
             <div>
               <h4 style={{ margin: '0 0 6px', fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--green)' }}>System Nominal</h4>
               <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.5, opacity: 0.9 }}>
                 The Isolation Forest is actively monitoring. No significant anomalies or inefficiencies detected in the current telemetry window.
               </p>
             </div>
           </div>
        ) : (
          <div className="flex flex-col gap-4">
            {displayRecs.map((r, i) => (
              <div key={i} style={{ padding: 'var(--space-5)', border: '1px solid var(--border-default)', borderLeft: `4px solid ${r.severity === 'high' ? 'var(--red)' : r.severity === 'medium' ? 'var(--amber)' : 'var(--cyan)'}`, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', fontWeight: 600, textTransform: 'uppercase' }}>
                    {r.category}
                  </div>
                  <div className={`badge ${r.severity === 'high' ? 'badge-critical' : r.severity === 'medium' ? 'badge-warning' : 'badge-normal'}`} style={{ fontSize: '10px' }}>
                    {Math.round(r.confidence * 100)}% Confidence
                  </div>
                </div>
                <h4 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>{r.title}</h4>
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{r.why}</p>
                <div style={{ fontSize: 'var(--text-sm)', background: 'var(--bg-surface)', padding: '12px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)' }}>
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>Recommended Action:</strong> <span style={{ color: 'var(--text-secondary)' }}>{r.action}</span>
                  </div>
                  {r.expectedSecDropPct > 0 && (
                    <div style={{ color: 'var(--green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)' }}>
                      <TrendingDown size={16} /> -{r.expectedSecDropPct.toFixed(1)}% SEC
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
