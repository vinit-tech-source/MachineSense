import React, { useState, useEffect } from 'react';
import { ClipboardList, AlertTriangle, ArrowRight, Activity, TrendingUp, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { useMachine } from '../contexts/MachineContext';
import { generateManualAnalytics, getDailySummaries } from '../api/client';
import type { ManualAnalyticsOut } from '../api/client';
import type { DailySummary } from '../types';
import { MachineSelector } from '../components/MachineSelector';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend 
} from 'recharts';

export function ManualAnalyticsPage() {
  const { selectedMachineId } = useMachine();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [hours, setHours] = useState<string>('8');
  const [units, setUnits] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ManualAnalyticsOut | null>(null);
  const [history, setHistory] = useState<DailySummary[]>([]);

  useEffect(() => {
    if (selectedMachineId) {
      getDailySummaries(selectedMachineId, 14)
        .then(data => setHistory(data))
        .catch(err => console.error("Failed to load historical data", err));
    }
  }, [selectedMachineId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineId) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const res = await generateManualAnalytics(selectedMachineId, {
        date,
        working_hours: parseFloat(hours),
        production_units: parseInt(units, 10),
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to generate analytics');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedMachineId) {
    return (
      <div className="page flex flex-col items-center justify-center gap-4" style={{ minHeight: '60vh' }}>
        <AlertTriangle size={48} color="var(--amber)" />
        <p style={{ color: 'var(--text-secondary)' }}>No machine selected for analytics.</p>
      </div>
    );
  }

  // Format data for charts
  const chartData = history.map(d => ({
    name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    Production: d.good_units,
    Rejects: d.reject_units,
    SEC: d.sec,
    Energy: d.total_kwh,
    Yield: d.yield_pct,
    Vibration: d.avg_vibration_mm_s,
    Temperature: d.avg_temp_c,
  }));

  const pieData = history.length > 0 ? [
    { name: 'Productive Energy', value: history.reduce((acc, d) => acc + d.productive_kwh, 0), color: 'var(--cyan)' },
    { name: 'Idle Energy', value: history.reduce((acc, d) => acc + d.idle_kwh, 0), color: 'var(--amber)' },
    { name: 'Loss/Reject Energy', value: history.reduce((acc, d) => acc + (d.reject_kwh + d.degradation_kwh), 0), color: 'var(--red)' }
  ] : [];

  const avgProd = history.length ? Math.round(history.reduce((acc, h) => acc + h.good_units, 0) / history.length) : 0;
  const avgYield = history.length ? (history.reduce((acc, h) => acc + h.yield_pct, 0) / history.length).toFixed(1) : "0";
  const totalEnergyHist = history.reduce((acc, h) => acc + h.total_kwh, 0);
  const idleEnergyHist = history.reduce((acc, h) => acc + h.idle_kwh, 0);
  const idlePct = totalEnergyHist ? ((idleEnergyHist / totalEnergyHist) * 100).toFixed(1) : "0";
  const avgSec = history.length ? (history.reduce((acc, h) => acc + (h.sec || 0), 0) / history.length).toFixed(3) : "0";

  return (
    <div className="page" style={{ maxWidth: '1200px' }}>
      <div className="flex items-center gap-3" style={{ marginBottom: 'var(--space-8)' }}>
        <ClipboardList size={28} color="var(--cyan)" />
        <h1 style={{ margin: 0 }}>Manual Production Analytics</h1>
        <div style={{ marginLeft: 'auto' }}>
          <MachineSelector />
        </div>
      </div>

      <div className="flex flex-col gap-8">
        
        {/* Form Section */}
        <div className="card" style={{ background: 'var(--bg-surface)' }}>
          <h3 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList size={18} color="var(--text-muted)" />
            Logbook Entry
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-4 items-end">
            <div>
              <label className="metric-label" style={{ display: 'block', marginBottom: '8px' }}>Date</label>
              <input 
                type="date" 
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  width: '100%', padding: '12px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)', borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)'
                }}
              />
            </div>
            
            <div>
              <label className="metric-label" style={{ display: 'block', marginBottom: '8px' }}>Working Hours</label>
              <input 
                type="number" 
                step="0.1"
                min="0.1"
                max="24"
                required
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g. 8"
                style={{
                  width: '100%', padding: '12px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)', borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)'
                }}
              />
            </div>

            <div>
              <label className="metric-label" style={{ display: 'block', marginBottom: '8px' }}>Production Units</label>
              <input 
                type="number" 
                min="0"
                required
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder="e.g. 150"
                style={{
                  width: '100%', padding: '12px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)', borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)'
                }}
              />
            </div>

            <div>
              <button 
                type="submit" 
                className="btn btn-primary justify-center"
                disabled={loading}
                style={{ padding: '12px', width: '100%', height: '45px' }}
              >
                {loading ? 'Processing...' : 'Generate Insights'}
                {!loading && <ArrowRight size={16} />}
              </button>
              {error && <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '4px', position: 'absolute' }}>{error}</div>}
            </div>
          </form>
        </div>

        {/* Results Section */}
        <div>
          {!result && !loading && (
            <div className="card flex flex-col items-center justify-center gap-3" style={{ borderStyle: 'dashed', borderColor: 'var(--border-strong)', background: 'var(--cyan-dim)', padding: 'var(--space-6) var(--space-4)', marginBottom: 'var(--space-6)' }}>
              <Activity size={24} color="var(--cyan)" />
              <p style={{ color: 'var(--cyan)', textAlign: 'center', fontSize: 'var(--text-sm)', fontWeight: 500, margin: 0 }}>
                Enter today's logbook parameters and click Generate Insights to see AI inference.
              </p>
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-6" style={{ animation: 'float 0.5s ease-out forwards', animationName: 'fade-in', marginBottom: '24px' }}>
              <div className="grid grid-cols-4 gap-4">
                <div className="card flex flex-col gap-2" style={{ background: 'var(--bg-surface)', padding: 'var(--space-4)' }}>
                  <div className="metric-label" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>TOTAL ENERGY</div>
                  <div className="metric-value" style={{ fontSize: 'var(--text-2xl)', color: 'var(--cyan)' }}>
                    {result.total_energy_kwh.toFixed(1)} <span className="metric-unit" style={{ fontSize: 'var(--text-sm)' }}>kWh</span>
                  </div>
                </div>

                <div className="card flex flex-col gap-2" style={{ background: 'var(--bg-surface)', padding: 'var(--space-4)' }}>
                  <div className="metric-label" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>SEC</div>
                  <div className="metric-value" style={{ fontSize: 'var(--text-2xl)', color: 'var(--green)' }}>
                    {result.sec ? result.sec.toFixed(3) : '--'} <span className="metric-unit" style={{ fontSize: 'var(--text-sm)' }}>kWh/u</span>
                  </div>
                </div>

                <div className="card flex flex-col gap-2" style={{ background: 'var(--bg-surface)', padding: 'var(--space-4)' }}>
                  <div className="metric-label" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>EST. COST</div>
                  <div className="metric-value" style={{ fontSize: 'var(--text-2xl)' }}>
                    ₹{result.cost_inr.toFixed(0)}
                  </div>
                </div>

                <div className="card flex flex-col gap-2" style={{ background: 'var(--bg-surface)', padding: 'var(--space-4)' }}>
                  <div className="metric-label" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>YIELD RATE</div>
                  <div className="metric-value" style={{ fontSize: 'var(--text-2xl)' }}>
                    {result.yield_rate_pct.toFixed(1)} <span className="metric-unit" style={{ fontSize: 'var(--text-sm)' }}>%</span>
                  </div>
                </div>
              </div>

              <div className="card flex flex-col gap-4" style={{ background: 'var(--bg-surface)' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', margin: 0 }}>
                  <Activity size={20} color="var(--cyan)" />
                  AI Production Inference
                </h3>
                
                <div className="flex flex-col gap-3">
                  {result.problems_detected.map((p, idx) => {
                    const color = p.severity === 'critical' ? 'var(--red)' : p.severity === 'warning' ? 'var(--amber)' : 'var(--green)';
                    const bg = p.severity === 'critical' ? 'var(--red-dim)' : p.severity === 'warning' ? 'var(--amber-dim)' : 'var(--green-dim)';
                    return (
                      <div key={idx} style={{ 
                        background: bg, 
                        padding: '12px 16px', 
                        borderRadius: 'var(--radius-md)', 
                        borderLeft: `4px solid ${color}`,
                      }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '4px' }}>
                          {p.problem}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                          <span style={{ fontWeight: 600, color }}>Remedy: </span>{p.remedy}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="divider" style={{ margin: 'var(--space-3) 0' }}></div>
                
                <div className="grid grid-cols-3 gap-4" style={{ textAlign: 'center' }}>
                  <div>
                    <div className="metric-label" style={{ fontSize: '10px' }}>Avg Power</div>
                    <div className="metric-value" style={{ fontSize: 'var(--text-xl)' }}>
                      {result.avg_power_w.toFixed(0)} <span className="metric-unit" style={{ fontSize: '12px' }}>W</span>
                    </div>
                  </div>
                  <div>
                    <div className="metric-label" style={{ fontSize: '10px' }}>Avg Temp</div>
                    <div className="metric-value" style={{ fontSize: 'var(--text-xl)' }}>
                      {result.avg_temp_c.toFixed(1)} <span className="metric-unit" style={{ fontSize: '12px' }}>°C</span>
                    </div>
                  </div>
                  <div>
                    <div className="metric-label" style={{ fontSize: '10px' }}>Avg Vibration</div>
                    <div className="metric-value" style={{ fontSize: 'var(--text-xl)' }}>
                      {result.avg_vibration_mm_s.toFixed(2)} <span className="metric-unit" style={{ fontSize: '12px' }}>mm/s</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Historical Charts */}
          {history.length > 0 && (
            <div className="flex flex-col gap-6 mt-8">
              <h2 style={{ fontSize: 'var(--text-xl)', marginTop: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-2)' }}>
                Historical Comparison (Last 14 Days)
              </h2>

              <div className="flex flex-col gap-12">
                
                {/* Chart 1: Production Units vs Rejects */}
                <div className="card" style={{ background: 'var(--bg-surface)' }}>
                  <h3 style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-md)' }}>
                    <BarChart3 size={18} color="var(--cyan)" />
                    Production Volume
                  </h3>
                  <div style={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={{ stroke: 'var(--border-default)' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: '8px' }}
                          itemStyle={{ fontSize: '13px' }}
                          labelStyle={{ color: 'var(--text-secondary)', marginBottom: '4px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>} />
                        <Bar dataKey="Production" stackId="a" fill="var(--cyan)" radius={[0, 0, 4, 4]} barSize={28} />
                        <Bar dataKey="Rejects" stackId="a" fill="var(--amber)" radius={[4, 4, 0, 0]} barSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div style={{ background: 'var(--bg-elevated)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--cyan)', marginTop: 'var(--space-6)' }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>Production Insight</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                      Over the last 14 days, the machine averaged {avgProd} good units per day with a yield rate of {avgYield}%. 
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}> Suggestion:</span> Standardize operator shift handoffs and compare tooling calibration against baseline to minimize reject spikes on high-volume days.
                    </p>
                  </div>
                </div>

                {/* Chart 2: Energy Breakdown Pie Chart */}
                <div className="card" style={{ background: 'var(--bg-surface)' }}>
                  <h3 style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-md)' }}>
                    <PieChartIcon size={18} color="var(--cyan)" />
                    Energy Distribution
                  </h3>
                  <div style={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="45%"
                          innerRadius={80}
                          outerRadius={120}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => [`${Number(value as number).toFixed(1)} kWh`, ''] as [string, string]}
                          contentStyle={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: '8px' }}
                          itemStyle={{ fontSize: '13px', color: 'var(--text-primary)' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div style={{ background: 'var(--bg-elevated)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--amber)', marginTop: 'var(--space-6)' }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>Energy Insight</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                      Idle energy consumed {idlePct}% of the total energy footprint. While some baseline power is required for the control systems, excessive idle time indicates machines are left running without load.
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}> Suggestion:</span> Implement an auto-shutdown or sleep protocol for prolonged idle periods exceeding 15 minutes to recover wasted energy.
                    </p>
                  </div>
                </div>

                {/* Chart 3: Specific Energy Consumption (SEC) Trend */}
                <div className="card" style={{ background: 'var(--bg-surface)' }}>
                  <h3 style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-md)' }}>
                    <TrendingUp size={18} color="var(--green)" />
                    SEC Trend (kWh / Unit)
                  </h3>
                  <div style={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={{ stroke: 'var(--border-default)' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: '8px' }}
                          itemStyle={{ fontSize: '13px', color: 'var(--text-primary)' }}
                          labelStyle={{ color: 'var(--text-secondary)', marginBottom: '4px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>} />
                        <Line type="monotone" name="Specific Energy (SEC)" dataKey="SEC" stroke="var(--green)" strokeWidth={4} dot={{ r: 5, fill: 'var(--bg-surface)', stroke: 'var(--green)', strokeWidth: 2 }} activeDot={{ r: 7 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div style={{ background: 'var(--bg-elevated)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--green)', marginTop: 'var(--space-6)' }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>Efficiency Insight</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                      The average Specific Energy Consumption (SEC) is {avgSec} kWh/unit. Upward spikes often correlate with mechanical friction or sub-optimal throughput.
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}> Suggestion:</span> Schedule periodic lubrication and inspect spindle bearings to maintain baseline efficiency. Check if raw material quality is causing slower cycles.
                    </p>
                  </div>
                </div>

                {/* Chart 4: Yield Performance */}
                <div className="card" style={{ background: 'var(--bg-surface)' }}>
                  <h3 style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-md)' }}>
                    <Activity size={18} color="var(--data-voltage)" />
                    Yield Performance (Good vs Total)
                  </h3>
                  <div style={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={{ stroke: 'var(--border-default)' }} />
                        <YAxis domain={[80, 100]} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: '8px' }}
                          itemStyle={{ fontSize: '13px', color: 'var(--text-primary)' }}
                          labelStyle={{ color: 'var(--text-secondary)', marginBottom: '4px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>} />
                        <Line type="monotone" name="Yield Rate (%)" dataKey="Yield" stroke="var(--data-voltage)" strokeWidth={4} dot={{ r: 5, fill: 'var(--bg-surface)', stroke: 'var(--data-voltage)', strokeWidth: 2 }} activeDot={{ r: 7 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div style={{ background: 'var(--bg-elevated)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--data-voltage)', marginTop: 'var(--space-6)' }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>Quality Insight</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                      The overall yield rate is trending at {avgYield}%. Drops in yield directly impact specific energy consumption (SEC) since energy is wasted on rejected units.
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}> Suggestion:</span> If yield dips below 95%, initiate an immediate QA audit on the raw material supply chain.
                    </p>
                  </div>
                </div>

                {/* Chart 5: Machine Health Signatures */}
                <div className="card" style={{ background: 'var(--bg-surface)' }}>
                  <h3 style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-md)' }}>
                    <Activity size={18} color="var(--red)" />
                    Machine Health Signatures
                  </h3>
                  <div style={{ height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={{ stroke: 'var(--border-default)' }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'var(--bg-raised)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderRadius: '8px' }}
                          itemStyle={{ fontSize: '13px', color: 'var(--text-primary)' }}
                          labelStyle={{ color: 'var(--text-secondary)', marginBottom: '4px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }} formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>} />
                        <Line yAxisId="left" type="monotone" name="Avg Temp (°C)" dataKey="Temperature" stroke="var(--red)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        <Line yAxisId="right" type="monotone" name="Avg Vibration (mm/s)" dataKey="Vibration" stroke="var(--amber)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div style={{ background: 'var(--bg-elevated)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--red)', marginTop: 'var(--space-6)' }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>Health Insight</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0', lineHeight: 1.5 }}>
                      Monitoring thermal and kinetic signatures provides early warning for catastrophic failures. Correlating these spikes with the SEC chart can identify structural friction points.
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}> Suggestion:</span> Check the cooling fins and spindle balance if both temperature and vibration trend upwards simultaneously over a 3-day window.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
