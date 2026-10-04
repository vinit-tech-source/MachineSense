import React, { useState, useRef, useEffect } from 'react';
import { Zap, Eye, BatteryCharging, Factory, Package, X, Send, Camera, FileText } from 'lucide-react';
import { useMachine } from '../contexts/MachineContext';

type ModalType = 'copilot' | 'ar' | 'nilm' | 'po' | null;

function CopilotDemo({ selectedMachineId: _selectedMachineId, machineName }: { selectedMachineId: string, machineName: string }) {
  const [messages, setMessages] = useState<{role: 'ai' | 'user', text: React.ReactNode}[]>([
    { role: 'ai', text: `Hello! I'm your AI factory assistant. What would you like to know about ${machineName}?` }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const predefinedAnswers: Record<string, React.ReactNode> = {
    "Why did energy cost spike?": (
      <>
        <p style={{ margin: '0 0 12px 0' }}>I analyzed the historical data and tariff rates for the past 48 hours.</p>
        <p style={{ margin: '0 0 12px 0' }}>The machine ran with a high non-productive idle rate (34%) during the <strong>2:00 PM peak tariff window</strong>, consuming 45 kWh of idle energy at peak rates (Γé╣12/kWh).</p>
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', fontSize: '13px' }}>
          <strong>Recommendation:</strong> Schedule operator breaks outside of peak tariff windows to save approx. Γé╣540 daily.
        </div>
      </>
    ),
    "Predict next maintenance": (
      <>
        <p style={{ margin: '0 0 12px 0' }}>Based on current vibration trends (4.2 mm/s RMS) and temperature logs, the spindle bearing is showing early signs of degradation.</p>
        <div style={{ padding: '12px', background: 'var(--amber-dim)', color: 'var(--amber)', borderRadius: '6px', fontSize: '13px', borderLeft: '4px solid var(--amber)' }}>
          <strong>Warning:</strong> Estimated Remaining Useful Life (RUL) is 14 days. Suggest ordering a replacement SKF 6205 bearing now.
        </div>
      </>
    ),
    "Show peak load analysis": (
      <>
        <p style={{ margin: '0 0 12px 0' }}>Peak load analysis for this week:</p>
        <ul style={{ paddingLeft: '20px', margin: '0 0 12px 0' }}>
          <li><strong>Max Demand:</strong> 18.4 kW (Tuesday 2:15 PM)</li>
          <li><strong>Avg Demand:</strong> 11.2 kW</li>
          <li><strong>Power Factor:</strong> 0.82 (Sub-optimal)</li>
        </ul>
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', fontSize: '13px' }}>
          <strong>Insight:</strong> Installing a capacitor bank could improve power factor to 0.95 and reduce demand penalties.
        </div>
      </>
    )
  };

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      // Find matching predefined answer or use default
      let response: React.ReactNode = "I'm still learning about that specific topic. Try asking about energy costs, maintenance, or peak loads!";
      
      for (const [key, val] of Object.entries(predefinedAnswers)) {
        if (text.toLowerCase().includes(key.toLowerCase().replace('?', ''))) {
          response = val;
          break;
        }
      }

      setMessages(prev => [...prev, { role: 'ai', text: response }]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <div style={{ flex: 1, display: 'flex', background: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <div style={{ width: '280px', borderRight: '1px solid var(--border-default)', padding: '20px', background: 'var(--bg-overlay)' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 'bold', marginBottom: '12px' }}>SUGGESTED QUERIES</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {["Why did energy cost spike?", "Predict next maintenance", "Show peak load analysis"].map(q => (
            <div key={q} 
                 onClick={() => handleSend(q)}
                 style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', border: '1px solid transparent' }} 
                 onMouseOver={e => e.currentTarget.style.borderColor = 'var(--cyan)'}
                 onMouseOut={e => e.currentTarget.style.borderColor = 'transparent'}>
              {q}
            </div>
          ))}
        </div>
      </div>
      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {messages.map((msg, i) => (
            <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
              {msg.role === 'ai' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap size={14} color="#000" /></div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Copilot</span>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: '0 12px 12px 12px', borderLeft: '2px solid var(--cyan)', whiteSpace: 'pre-wrap' }}>
                    {msg.text}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>You</span>
                  </div>
                  <div style={{ background: 'var(--cyan-dim)', color: 'var(--cyan)', padding: '16px', borderRadius: '12px 0 12px 12px' }}>
                    {msg.text}
                  </div>
                </>
              )}
            </div>
          ))}
          
          {isTyping && (
            <div style={{ alignSelf: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Zap size={14} color="#000" /></div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Thinking...</span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        <div style={{ padding: '24px', borderTop: '1px solid var(--border-default)', background: 'var(--bg-overlay)' }}>
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }} 
            style={{ maxWidth: '800px', margin: '0 auto', position: 'relative' }}
          >
            <input type="text" placeholder="Ask follow-up question..." 
                   value={input}
                   onChange={e => setInput(e.target.value)}
                   style={{ width: '100%', padding: '16px 48px 16px 16px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '15px' }} />
            <button type="submit" style={{ position: 'absolute', right: '8px', top: '8px', padding: '8px', background: 'var(--cyan)', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AdvancedFeaturesPage() {
  const { selectedMachineId, machines } = useMachine();
  const machine = machines.find(m => m.machine_id === selectedMachineId);
  const machineName = machine ? machine.name : selectedMachineId;
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [gridStatus, setGridStatus] = useState<'Off-Peak' | 'Peak Demand'>('Off-Peak');

  const closeModal = () => setActiveModal(null);

  return (
    <div className="page" style={{ position: 'relative' }}>
      <div style={{ marginBottom: 'var(--space-10)', maxWidth: '800px' }}>
        <h1 className="text-gradient" style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-2)' }}>
          Advanced Integrations
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-lg)', lineHeight: 1.6 }}>
          Next-generation MachineSense capabilities tailored for the Schneider Electric ecosystem. 
          These modules demonstrate our future roadmap for SME smart manufacturing.
        </p>
      </div>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', 
        gap: 'var(--space-6)',
        alignItems: 'stretch'
      }}>
        
        {/* EcoStruxure Copilot */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{ padding: '12px', background: 'var(--cyan-dim)', borderRadius: 'var(--radius-md)', color: 'var(--cyan)' }}>
              <Zap size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>EcoStruxure Copilot</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)', flex: 1 }}>
            Generative AI assistant. Ask natural language questions like "Why did the electricity bill spike?" and get plain-language answers based on deep sensor data analysis.
          </p>
          <button className="btn btn-primary w-full justify-center" style={{ padding: '10px' }} onClick={() => setActiveModal('copilot')}>
            Try Copilot Demo
          </button>
        </div>

        {/* AR Maintenance */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{ padding: '12px', background: 'var(--amber-dim)', borderRadius: 'var(--radius-md)', color: 'var(--amber)' }}>
              <Eye size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>AR Maintenance</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)', flex: 1 }}>
            Overlay live sensor telemetry and Remaining Useful Life (RUL) directly onto physical machines using a tablet or AR headset for field technicians.
          </p>
          <button className="btn btn-secondary w-full justify-center" style={{ padding: '10px' }} onClick={() => setActiveModal('ar')}>
            Launch AR View
          </button>
        </div>

        {/* Smart Grid */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{ padding: '12px', background: 'var(--green-dim)', borderRadius: 'var(--radius-md)', color: 'var(--green)' }}>
              <BatteryCharging size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Smart Grid Response</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)', flex: 1 }}>
            Dynamic tariff integration. Automatically scales down non-critical loads (like compressors) during peak grid electricity pricing to save costs.
          </p>
          <div style={{ 
            padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', 
            fontSize: 'var(--text-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            border: '1px solid var(--border-default)', marginBottom: 'var(--space-4)'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>Grid Status:</span>
            <span className={`badge ${gridStatus === 'Off-Peak' ? 'badge-normal' : 'badge-critical'}`}>
              {gridStatus}
            </span>
          </div>
          <button 
            className="btn btn-ghost w-full justify-center" 
            style={{ padding: '10px', fontSize: 'var(--text-xs)' }}
            onClick={() => setGridStatus(prev => prev === 'Off-Peak' ? 'Peak Demand' : 'Off-Peak')}
          >
            Simulate Grid Event
          </button>
        </div>

        {/* NILM */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{ padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: 'var(--radius-md)', color: '#8B5CF6' }}>
              <Factory size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>NILM Disaggregation</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)', flex: 1 }}>
            Use a single Schneider PM8000 meter at the main breaker to identify individual machine usage remotely through AI electrical signatures.
          </p>
          <button className="btn btn-secondary w-full justify-center" style={{ padding: '10px' }} onClick={() => setActiveModal('nilm')}>
            View Load Profile
          </button>
        </div>

        {/* Spare Parts */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{ padding: '12px', background: 'var(--red-dim)', borderRadius: 'var(--radius-md)', color: 'var(--red)' }}>
              <Package size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Auto Spare Parts</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)', flex: 1 }}>
            Direct integration with suppliers. Auto-drafts purchase orders for bearings exactly 10 days before predicted failure to ensure zero downtime.
          </p>
          <button className="btn w-full justify-center" style={{ padding: '10px', background: 'var(--bg-overlay)', color: 'var(--bg-base)', border: 'none' }} onClick={() => setActiveModal('po')}>
            Review Pending POs (1)
          </button>
        </div>
      </div>

      {/* FULL-SCREEN IMMERSIVE DEMOS */}
      {activeModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'var(--bg-base)',
          zIndex: 9999, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          animation: 'fadeIn 0.3s ease-out'
        }}>
          {/* Header Bar */}
          <div style={{ 
            height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
            padding: '0 24px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-default)' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {activeModal === 'copilot' && <><Zap color="var(--cyan)" /> <span style={{ fontSize: '18px', fontWeight: 'bold' }}>EcoStruxure Copilot</span></>}
              {activeModal === 'ar' && <><Eye color="var(--amber)" /> <span style={{ fontSize: '18px', fontWeight: 'bold' }}>AR Maintenance Vision</span></>}
              {activeModal === 'nilm' && <><Factory color="#8B5CF6" /> <span style={{ fontSize: '18px', fontWeight: 'bold' }}>NILM Disaggregation</span></>}
              {activeModal === 'po' && <><Package color="var(--red)" /> <span style={{ fontSize: '18px', fontWeight: 'bold' }}>Auto Spare Parts ERP</span></>}
              <span className="badge badge-normal" style={{ marginLeft: '12px' }}>Interactive Demo</span>
            </div>
            <button 
              onClick={closeModal} 
              className="btn btn-ghost"
              style={{ padding: '8px', borderRadius: '50%' }}
            >
              <X size={24} />
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex' }}>
            
            {/* COPILOT - Immersive Chat */}
            {activeModal === 'copilot' && <CopilotDemo selectedMachineId={selectedMachineId} machineName={machineName} />}

            {/* AR MODAL - Immersive Camera HUD */}
            {activeModal === 'ar' && (
              <div style={{ flex: 1, position: 'relative', background: '#0a0a0a', backgroundImage: 'radial-gradient(circle at center, #1a1a1a 0%, #000 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.1, backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
                
                {/* HUD Corners */}
                <div style={{ position: 'absolute', top: '40px', left: '40px', width: '40px', height: '40px', borderTop: '4px solid var(--amber)', borderLeft: '4px solid var(--amber)' }} />
                <div style={{ position: 'absolute', top: '40px', right: '40px', width: '40px', height: '40px', borderTop: '4px solid var(--amber)', borderRight: '4px solid var(--amber)' }} />
                <div style={{ position: 'absolute', bottom: '40px', left: '40px', width: '40px', height: '40px', borderBottom: '4px solid var(--amber)', borderLeft: '4px solid var(--amber)' }} />
                <div style={{ position: 'absolute', bottom: '40px', right: '40px', width: '40px', height: '40px', borderBottom: '4px solid var(--amber)', borderRight: '4px solid var(--amber)' }} />

                <Camera size={120} color="rgba(255, 255, 255, 0.05)" />

                {/* Target Overlay */}
                <div style={{ position: 'absolute', top: '30%', left: '35%', width: '30%', height: '40%', border: '2px dashed rgba(245, 158, 11, 0.6)', borderRadius: '12px', boxShadow: '0 0 20px rgba(245, 158, 11, 0.1)' }}>
                  <div style={{ position: 'absolute', top: '-10px', right: '-150px', background: 'rgba(0,0,0,0.8)', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--amber)', backdropFilter: 'blur(10px)', width: '220px', transform: 'translateY(-50%)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ color: 'var(--amber)', fontSize: '12px', letterSpacing: '1px' }}>TARGET LOCKED</span>
                      <span className="badge badge-normal" style={{ fontSize: '10px' }}>LIVE</span>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', marginBottom: '12px' }}>{machineName}</div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Vibration</span>
                        <span style={{ color: 'var(--red)' }}>4.2 mm/s ΓÜá</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Temperature</span>
                        <span style={{ color: 'var(--green)' }}>65.4 ┬░C</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Load</span>
                        <span style={{ color: 'var(--green)' }}>82%</span>
                      </div>
                    </div>

                    <div style={{ marginTop: '16px', padding: '10px', background: 'var(--red-dim)', color: 'var(--red)', borderRadius: '4px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                      Bearing RUL: 14 Days
                    </div>
                  </div>
                  
                  {/* Connecting line */}
                  <svg style={{ position: 'absolute', top: '-10px', right: '-150px', width: '150px', height: '2px', overflow: 'visible' }}>
                    <line x1="0" y1="0" x2="-150" y2="200" stroke="rgba(245, 158, 11, 0.5)" strokeWidth="2" strokeDasharray="4 4" />
                  </svg>
                </div>
              </div>
            )}

            {/* NILM MODAL - Dashboard */}
            {activeModal === 'nilm' && (
              <div style={{ flex: 1, padding: '40px', overflowY: 'auto', background: 'var(--bg-base)' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                  <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Virtual Sub-metering Analysis</h2>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>AI-driven load disaggregation from a single PM8000 master meter.</p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '32px' }}>
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
                      <div style={{ position: 'relative', width: '240px', height: '240px', borderRadius: '50%', background: 'conic-gradient(var(--cyan) 0% 45%, var(--amber) 45% 75%, var(--green) 75% 90%, var(--red) 90% 100%)', boxShadow: '0 0 40px rgba(0,0,0,0.5)', marginBottom: '24px' }}>
                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '140px', height: '140px', background: 'var(--bg-elevated)', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Total Load</span>
                          <span style={{ fontSize: '28px', fontWeight: 'bold' }}>186 kWh</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="card">
                      <h3 style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-default)', paddingBottom: '12px' }}>Signature Breakdown</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {[
                          { name: 'Compressors', pct: 45, val: '84 kWh', color: 'var(--cyan)' },
                          { name: 'HVAC System', pct: 30, val: '56 kWh', color: 'var(--amber)' },
                          { name: 'CNC Lathes', pct: 15, val: '28 kWh', color: 'var(--green)' },
                          { name: 'Lighting & Other', pct: 10, val: '18 kWh', color: 'var(--red)' }
                        ].map(item => (
                          <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '160px', fontWeight: 'bold' }}>{item.name}</div>
                            <div style={{ flex: 1, height: '12px', background: 'var(--bg-overlay)', borderRadius: '6px', overflow: 'hidden' }}>
                              <div style={{ width: `${item.pct}%`, height: '100%', background: item.color }} />
                            </div>
                            <div style={{ width: '80px', textAlign: 'right', color: 'var(--text-muted)' }}>{item.val}</div>
                            <div style={{ width: '50px', textAlign: 'right', fontWeight: 'bold', color: item.color }}>{item.pct}%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PO MODAL - ERP Screen */}
            {activeModal === 'po' && (
              <div style={{ flex: 1, padding: '40px', overflowY: 'auto', background: 'var(--bg-base)' }}>
                <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto', background: 'white', color: 'black', borderRadius: '8px', padding: '48px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #eee', paddingBottom: '24px', marginBottom: '32px' }}>
                    <div>
                      <h1 style={{ margin: '0 0 8px 0', fontSize: '32px', color: '#1a1a1a' }}>PURCHASE ORDER</h1>
                      <div style={{ color: '#666', fontSize: '14px' }}>Generated by MachineSense AI</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>PO NUMBER</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#1a1a1a' }}>#MS-2026-8891</div>
                      <div style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>DATE: {new Date().toLocaleDateString()}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '48px' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#888', marginBottom: '8px' }}>VENDOR</div>
                      <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#1a1a1a' }}>SKF Industrial Distributors</div>
                      <div style={{ color: '#555', marginTop: '4px', lineHeight: 1.5 }}>
                        123 Industrial Park Phase 2<br />
                        Pune, Maharashtra 411057<br />
                        vendor@skf-dist.example.com
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#888', marginBottom: '8px' }}>SHIP TO</div>
                      <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#1a1a1a' }}>Yuva Yodha Factory</div>
                      <div style={{ color: '#555', marginTop: '4px', lineHeight: 1.5 }}>
                        Shop Floor A, Line 3<br />
                        Machine: {machineName}
                      </div>
                    </div>
                  </div>

                  <div style={{ background: '#fff3f3', borderLeft: '4px solid #ef4444', padding: '16px', marginBottom: '32px', color: '#b91c1c', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileText size={20} />
                    <strong>URGENT AUTOMATION:</strong> Bearing Remaining Useful Life (RUL) dropped below 14-day safety threshold. Lead time is 5 days.
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '32px' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', borderTop: '1px solid #ddd', borderBottom: '2px solid #ddd' }}>
                        <th style={{ padding: '12px', textAlign: 'left', color: '#444' }}>ITEM DESCRIPTION</th>
                        <th style={{ padding: '12px', textAlign: 'center', color: '#444' }}>QTY</th>
                        <th style={{ padding: '12px', textAlign: 'right', color: '#444' }}>UNIT PRICE</th>
                        <th style={{ padding: '12px', textAlign: 'right', color: '#444' }}>TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '16px 12px', color: '#1a1a1a' }}>
                          <strong>SKF 6205 Deep Groove Ball Bearing</strong><br/>
                          <span style={{ fontSize: '12px', color: '#666' }}>Part #SKF-6205-2RS1</span>
                        </td>
                        <td style={{ padding: '16px 12px', textAlign: 'center', color: '#1a1a1a' }}>2</td>
                        <td style={{ padding: '16px 12px', textAlign: 'right', color: '#1a1a1a' }}>Γé╣725.00</td>
                        <td style={{ padding: '16px 12px', textAlign: 'right', fontWeight: 'bold', color: '#1a1a1a' }}>Γé╣1,450.00</td>
                      </tr>
                    </tbody>
                  </table>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '48px' }}>
                    <div style={{ width: '300px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', color: '#666' }}>
                        <span>Subtotal</span>
                        <span>Γé╣1,450.00</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', color: '#666', borderBottom: '1px solid #ddd' }}>
                        <span>Tax (18%)</span>
                        <span>Γé╣261.00</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', fontSize: '20px', fontWeight: 'bold', color: '#1a1a1a' }}>
                        <span>TOTAL</span>
                        <span>Γé╣1,711.00</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', borderTop: '1px solid #eee', paddingTop: '24px' }}>
                    <button className="btn" onClick={closeModal} style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '12px 24px' }}>Reject & Edit</button>
                    <button className="btn" onClick={closeModal} style={{ background: '#0f172a', color: 'white', border: 'none', padding: '12px 24px', fontWeight: 'bold' }}>Authorize PO (Γé╣1,711.00)</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  );
}
