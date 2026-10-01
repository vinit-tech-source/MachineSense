import { Link } from 'react-router-dom';
import { Cpu, Activity, Shield, Zap, AlertTriangle, CheckCircle, Server, Info, Moon, Sun, Smartphone, MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useTheme } from '../hooks/useTheme';

export function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="landing-page" style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'var(--bg-base)',
      fontFamily: 'var(--font-sans)',
      color: 'var(--text-primary)'
    }}>
      
      {/* 7. NAVIGATION */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--space-8)',
        justifyContent: 'space-between',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '72px',
        zIndex: 1000,
        background: scrolled ? 'var(--nav-scrolled)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border-subtle)' : '1px solid transparent',
        transition: 'all 0.3s ease'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Cpu size={24} color="var(--cyan)" strokeWidth={1.5} />
          <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-primary)' }}>
            VIGIL
          </span>
        </div>
        
        <div className="landing-nav-links" style={{ display: 'none', gap: 'var(--space-6)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-secondary)' }}>
          <a href="#product" className="hover:text-white transition-colors">Product</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          <a href="#intelligence" className="hover:text-white transition-colors">Intelligence</a>
          <a href="#energy" className="hover:text-white transition-colors">Energy</a>
          <a href="#platform" className="hover:text-white transition-colors">Platform</a>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
          <button 
            onClick={toggleTheme}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              borderRadius: '50%'
            }}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <Link to="/dashboard" className="btn btn-secondary" style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            View Demo
          </Link>
          <Link to="/dashboard" className="btn btn-primary" style={{ fontSize: 'var(--text-xs)', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '8px 20px' }}>
            Get Started
          </Link>
        </div>
      </nav>

      <div style={{ marginTop: '72px' }}>
        
        {/* 8 & 9. HERO SECTION */}
        <section className="container bg-pattern" style={{ padding: 'var(--space-12) var(--space-6)', minHeight: '90vh', display: 'flex', alignItems: 'center' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Hero Left */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, paddingRight: 'var(--space-8)' }}>
              <div style={{ 
                fontSize: 'var(--text-xs)', 
                fontWeight: 600, 
                letterSpacing: '0.1em', 
                color: 'var(--text-muted)', 
                marginBottom: 'var(--space-4)',
                textTransform: 'uppercase'
              }}>
                Machine Intelligence Platform
              </div>
              <h1 style={{ 
                fontSize: 'clamp(2.5rem, 4vw, 4.5rem)', 
                fontWeight: 700, 
                lineHeight: 1.1, 
                letterSpacing: '-0.02em',
                marginBottom: 'var(--space-6)',
                wordBreak: 'break-word'
              }}>
                Know Your Machines <br/>
                <span className="text-gradient">Before They Fail.</span>
              </h1>
              <p style={{
                fontSize: 'var(--text-lg)',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                marginBottom: 'var(--space-8)',
                maxWidth: '540px'
              }}>
                Vigil gives manufacturing teams real-time visibility into machine health, abnormal behavior, maintenance risk, and energy consumption — before small problems become expensive downtime.
              </p>
              
              <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
                <Link to="/dashboard" className="btn btn-primary" style={{ padding: '12px 28px', fontSize: 'var(--text-md)', fontWeight: 600, boxShadow: '0 4px 20px var(--cyan-glow)' }}>
                  Explore Vigil
                </Link>
                <Link to="/dashboard" className="btn btn-secondary" style={{ padding: '12px 28px', fontSize: 'var(--text-md)', fontWeight: 500, border: '1px solid var(--border-default)' }}>
                  View Live Console →
                </Link>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-6)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle size={14} color="var(--cyan)" /> REAL-TIME MONITORING</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Activity size={14} color="var(--amber)" /> PREDICTIVE INSIGHTS</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Zap size={14} color="var(--red)" /> ENERGY INTELLIGENCE</span>
              </div>
            </div>

            {/* Hero Right - Dashboard Preview */}
            <div className="hero-dashboard-preview animate-float glass-panel" style={{
              borderRadius: '16px',
              boxShadow: 'var(--hero-shadow)',
              position: 'relative',
              overflow: 'hidden',
              minWidth: 0
            }}>
              {/* Photo Header */}
              <div style={{ 
                height: '180px', 
                width: '100%', 
                backgroundImage: 'url(/hero_factory.jpg)', 
                backgroundSize: 'cover', 
                backgroundPosition: 'center',
                borderBottom: '1px solid var(--border-subtle)',
                position: 'relative'
              }}>
                <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.9)', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, color: 'var(--cyan)', backdropFilter: 'blur(4px)', boxShadow: 'var(--shadow-sm)' }}>
                  <span className="status-dot normal" style={{ width: 6, height: 6 }}></span> LIVE STREAM
                </div>
              </div>
              
              <div style={{ padding: 'var(--space-5)' }}>
                {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>FACTORY FLOOR</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--cyan)' }}>
                  <span className="status-dot normal" style={{ width: 6, height: 6 }}></span> LIVE
                </div>
              </div>

              {/* Grid of machines */}
              <div className="grid grid-cols-1 gap-3 mb-4">
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-raised)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-default)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '4px' }}>CNC-001</div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Temp <span style={{ color: 'var(--text-primary)' }}>42.8°C</span></span>
                      <span style={{ color: 'var(--text-secondary)' }}>Vib <span style={{ color: 'var(--text-primary)' }}>0.18 g</span></span>
                      <span style={{ color: 'var(--text-secondary)' }}>Pwr <span style={{ color: 'var(--text-primary)' }}>4.72 kW</span></span>
                    </div>
                  </div>
                  <div style={{ alignSelf: 'flex-start', background: 'var(--green-dim)', color: 'var(--green)', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em' }}>NORMAL</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-raised)', padding: '12px', borderRadius: '4px', border: '1px solid rgba(232, 160, 32, 0.3)', boxShadow: '0 0 12px rgba(232, 160, 32, 0.05)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--amber)', letterSpacing: '0.05em', marginBottom: '4px' }}>MOTOR-002</div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Temp <span style={{ color: 'var(--amber)' }}>61.4°C</span></span>
                      <span style={{ color: 'var(--text-secondary)' }}>Vib <span style={{ color: 'var(--amber)' }}>0.74 g</span></span>
                      <span style={{ color: 'var(--text-secondary)' }}>Pwr <span style={{ color: 'var(--text-primary)' }}>6.21 kW</span></span>
                    </div>
                  </div>
                  <div className="severity-pulse-orange" style={{ alignSelf: 'flex-start', background: 'var(--amber-dim)', color: 'var(--amber)', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em' }}>WARNING</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-raised)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-default)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '4px' }}>COMPRESSOR-003</div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Temp <span style={{ color: 'var(--text-primary)' }}>38.9°C</span></span>
                      <span style={{ color: 'var(--text-secondary)' }}>Vib <span style={{ color: 'var(--text-primary)' }}>0.12 g</span></span>
                      <span style={{ color: 'var(--text-secondary)' }}>Pwr <span style={{ color: 'var(--text-primary)' }}>5.14 kW</span></span>
                    </div>
                  </div>
                  <div style={{ alignSelf: 'flex-start', background: 'var(--green-dim)', color: 'var(--green)', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em' }}>NORMAL</div>
                </div>
              </div>

              {/* Bottom Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '4px' }}>MACHINE HEALTH</div>
                  <div style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--cyan)' }}>92%</div>
                </div>
                <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '4px' }}>SESSION COST</div>
                  <div style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>₹4,180</div>
                </div>
                <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: '4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '4px' }}>AVG RUL</div>
                  <div style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--green)' }}>124d</div>
                </div>
              </div>
              </div>
            </div>
          </div>
        </section>

        {/* 11. PROBLEM SECTION */}
        <section id="problem" style={{ padding: 'var(--space-12) 0', borderTop: '1px solid var(--border-subtle)' }}>
          <div className="container" style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto', marginBottom: 'var(--space-10)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 'var(--space-4)' }}>THE PROBLEM</div>
            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Machine failures rarely begin with the breakdown.</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-lg)', lineHeight: 1.6 }}>
              Small changes in vibration, temperature, electrical behavior, or power consumption can appear long before a machine actually stops working.
            </p>
          </div>

          <div className="container" style={{ maxWidth: '1000px' }}>
            <div className="timeline-horizontal" style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '24px', left: '10%', right: '10%', height: '2px', background: 'linear-gradient(90deg, var(--green) 0%, var(--amber) 50%, var(--red) 100%)', opacity: 0.3, zIndex: 0 }}></div>
              
              <div style={{ flex: 1, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <div style={{ width: '48px', height: '48px', margin: '0 auto var(--space-4)', background: 'var(--bg-elevated)', border: '2px solid var(--green)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)' }}>
                  <CheckCircle size={20} />
                </div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: '8px' }}>NORMAL</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Operating within bounds</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <div style={{ width: '48px', height: '48px', margin: '0 auto var(--space-4)', background: 'var(--bg-elevated)', border: '2px solid var(--cyan)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cyan)' }}>
                  <Activity size={20} />
                </div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: '8px' }}>DEVIATION</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Behavior begins changing</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <div className="severity-pulse-orange" style={{ width: '48px', height: '48px', margin: '0 auto var(--space-4)', background: 'var(--bg-elevated)', border: '2px solid var(--amber)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber)' }}>
                  <AlertTriangle size={20} />
                </div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: '8px' }}>WARNING</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Abnormal pattern detected</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <div className="severity-pulse-red" style={{ width: '48px', height: '48px', margin: '0 auto var(--space-4)', background: 'var(--bg-elevated)', border: '2px solid var(--red)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)' }}>
                  <Shield size={20} />
                </div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: '8px' }}>CRITICAL</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Risk continues to increase</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', position: 'relative', zIndex: 1, opacity: 0.5 }}>
                <div style={{ width: '48px', height: '48px', margin: '0 auto var(--space-4)', background: 'var(--bg-base)', border: '2px dashed var(--text-muted)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                  <Server size={20} />
                </div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-primary)', marginBottom: '8px' }}>FAILURE</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Unplanned downtime</div>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginTop: 'var(--space-8)' }}>
              <div style={{ display: 'inline-block', padding: '12px 24px', background: 'var(--cyan-dim)', color: 'var(--cyan)', borderRadius: '4px', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
                Vigil is designed to help teams act before the final step.
              </div>
            </div>
          </div>
        </section>

        {/* DIGITAL TWIN / 3D LAYOUT SECTION */}
        <section id="digital-twin" style={{ padding: 'var(--space-12) 0', background: 'var(--bg-base)', borderTop: '1px solid var(--border-subtle)' }}>
          <div className="container">
            <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto', marginBottom: 'var(--space-8)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--cyan)', letterSpacing: '0.1em', marginBottom: 'var(--space-4)' }}>DIGITAL TWIN</div>
              <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Your factory floor, mapped.</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-lg)', lineHeight: 1.6 }}>
                Vigil automatically visualizes the machines you add in a high-fidelity 3D spatial layout, giving your operators immediate context of where alerts are happening.
              </p>
            </div>
            
            <div style={{ 
              width: '100%', 
              height: '500px',
              borderRadius: '16px', 
              overflow: 'hidden', 
              position: 'relative',
              border: '1px solid var(--border-strong)', 
              boxShadow: 'var(--hero-shadow)' 
            }}>
              {/* Image Background */}
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundImage: 'url(/factory_3d.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}></div>

              {/* Inner Shadow / Vignette for blending */}
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                boxShadow: 'inset 0 0 100px rgba(0,0,0,0.1)',
                pointerEvents: 'none'
              }}></div>

              {/* Floating UI Hotspot 1 */}
              <div style={{ position: 'absolute', top: '40%', left: '30%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="status-dot normal" style={{ width: '16px', height: '16px', boxShadow: '0 0 0 6px rgba(39, 174, 96, 0.2)' }}></div>
                <div style={{ background: 'var(--bg-surface)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '12px', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-default)' }}>
                  CNC-001 <span style={{ color: 'var(--green)', marginLeft: '4px' }}>96%</span>
                </div>
              </div>

              {/* Floating UI Hotspot 2 (Alert) */}
              <div style={{ position: 'absolute', top: '65%', left: '55%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="severity-pulse-orange" style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--amber)' }}></div>
                <div style={{ background: 'var(--bg-surface)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--amber)', marginTop: '12px', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-default)' }}>
                  MOTOR-002 <span style={{ marginLeft: '4px' }}>72%</span>
                </div>
              </div>

              {/* Floating UI Hotspot 3 */}
              <div style={{ position: 'absolute', top: '35%', left: '75%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="status-dot normal" style={{ width: '16px', height: '16px', boxShadow: '0 0 0 6px rgba(39, 174, 96, 0.2)' }}></div>
                <div style={{ background: 'var(--bg-surface)', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '12px', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-default)' }}>
                  PRESS-003 <span style={{ color: 'var(--green)', marginLeft: '4px' }}>91%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 12. MACHINE HEALTH SECTION */}
        <section id="intelligence" style={{ padding: 'var(--space-12) 0', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)' }}>
          <div className="container grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 'var(--space-4)' }}>SEE THE MACHINE, NOT JUST THE ALARM</div>
              <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Understand what your machines are actually doing.</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-lg)', lineHeight: 1.6 }}>
                Vigil continuously observes machine telemetry and gives operators a clear picture of machine behavior. Stop guessing what went wrong and look at the actual operational data in real-time.
              </p>
            </div>
            
            <div className="glass-panel" style={{ 
              borderRadius: '16px', 
              position: 'relative',
              overflow: 'hidden',
              minHeight: '360px',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 24px 60px rgba(0,0,0,0.3)'
            }}>
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundImage: 'url(/sensor.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}></div>
              
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(to right, rgba(0,0,0,0.6), rgba(0,0,0,0.2))',
              }}></div>

              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '160px', height: '160px', borderRadius: '50%', border: '6px solid rgba(0, 180, 216, 0.2)', borderTopColor: 'var(--cyan)', borderRightColor: 'var(--cyan)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: 'rotate(-45deg)', boxShadow: '0 0 40px rgba(0, 180, 216, 0.2)', background: 'rgba(10, 12, 14, 0.6)', backdropFilter: 'blur(8px)' }}>
                  <div style={{ transform: 'rotate(45deg)', textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--cyan)', lineHeight: 1 }}>92%</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em', marginTop: '4px' }}>HEALTH</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: '#fff', marginTop: '4px', fontWeight: 500 }}>Stable</div>
                  </div>
                </div>
              </div>
              
              {/* Floating stats */}
              <div style={{ position: 'absolute', top: '10%', left: '5%', background: 'rgba(10,12,14,0.7)', backdropFilter: 'blur(12px)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>VIBRATION</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: '#fff', fontWeight: 600 }}>0.15 g</div>
              </div>
              <div style={{ position: 'absolute', bottom: '10%', right: '5%', background: 'rgba(10,12,14,0.7)', backdropFilter: 'blur(12px)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>TEMP</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', color: '#fff', fontWeight: 600 }}>43.2 °C</div>
              </div>
            </div>
          </div>
        </section>

        {/* 13. MULTI-MACHINE SECTION */}
        <section id="platform" style={{ padding: 'var(--space-12) 0', borderTop: '1px solid var(--border-subtle)' }}>
          <div className="container">
            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, marginBottom: 'var(--space-8)', textAlign: 'center' }}>One console. Every machine.</h2>
            
            <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', borderRadius: '8px', overflow: 'hidden' }}>
              <table className="data-table" style={{ width: '100%', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th>MACHINE</th>
                    <th>STATUS</th>
                    <th>HEALTH</th>
                    <th>POWER</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>CNC-001</td>
                    <td><span className="badge badge-normal"><span className="status-dot normal"></span> Normal</span></td>
                    <td style={{ color: 'var(--text-primary)' }}>96%</td>
                    <td style={{ color: 'var(--text-secondary)' }}>4.7 kW</td>
                  </tr>
                  <tr>
                    <td>MOTOR-002</td>
                    <td><span className="badge badge-warning"><span className="status-dot warning"></span> Warning</span></td>
                    <td style={{ color: 'var(--amber)' }}>72%</td>
                    <td style={{ color: 'var(--text-secondary)' }}>6.2 kW</td>
                  </tr>
                  <tr>
                    <td>PRESS-003</td>
                    <td><span className="badge badge-normal"><span className="status-dot normal"></span> Normal</span></td>
                    <td style={{ color: 'var(--text-primary)' }}>91%</td>
                    <td style={{ color: 'var(--text-secondary)' }}>3.8 kW</td>
                  </tr>
                  <tr style={{ background: 'var(--red-dim)' }}>
                    <td>PUMP-004</td>
                    <td><span className="badge badge-critical"><span className="status-dot critical"></span> Critical</span></td>
                    <td style={{ color: 'var(--red)' }}>38%</td>
                    <td style={{ color: 'var(--red)' }}>7.1 kW</td>
                  </tr>
                  <tr>
                    <td>CNC-005</td>
                    <td><span className="badge badge-normal"><span className="status-dot normal"></span> Normal</span></td>
                    <td style={{ color: 'var(--text-primary)' }}>94%</td>
                    <td style={{ color: 'var(--text-secondary)' }}>4.3 kW</td>
                  </tr>
                  <tr>
                    <td>COMP-006</td>
                    <td><span className="badge badge-normal"><span className="status-dot normal"></span> Normal</span></td>
                    <td style={{ color: 'var(--text-primary)' }}>89%</td>
                    <td style={{ color: 'var(--text-secondary)' }}>5.6 kW</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 14 & 15. ANOMALY DETECTION & FALSE ALARM */}
        <section style={{ padding: 'var(--space-12) 0', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)' }}>
          <div className="container">
            <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto', marginBottom: 'var(--space-10)' }}>
              <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Your machines define their own normal.</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-lg)', lineHeight: 1.6 }}>
                Every machine behaves differently. Vigil learns the normal operating pattern of each machine and looks for meaningful deviations rather than relying only on rigid alarm thresholds.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: 'var(--space-6)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 'var(--space-4)' }}>TRADITIONAL THRESHOLD APPROACH</div>
                <div style={{ height: '60px', borderBottom: '1px dashed var(--red)', position: 'relative', marginBottom: 'var(--space-2)' }}>
                  <svg width="100%" height="100%" preserveAspectRatio="none" style={{ stroke: 'var(--text-secondary)', strokeWidth: 1.5, fill: 'none' }}>
                    <path d="M0,40 Q20,35 40,40 T80,40 T120,38 T160,10 L165,5 L170,40 T210,40 T250,39 T290,40 T330,41" />
                  </svg>
                  <div style={{ position: 'absolute', top: 5, left: '165px', background: 'var(--red)', color: 'white', fontSize: '9px', padding: '2px 4px', borderRadius: '2px' }}>ALARM</div>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Transient spikes trigger immediate false alarms, causing operator fatigue.</p>
              </div>

              <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--cyan-dim)', borderRadius: '8px', padding: 'var(--space-6)' }}>
                <div style={{ fontSize: '10px', color: 'var(--cyan)', letterSpacing: '0.1em', marginBottom: 'var(--space-4)' }}>VIGIL APPROACH (MAD)</div>
                <div style={{ height: '60px', borderBottom: '1px solid rgba(0, 180, 216, 0.2)', position: 'relative', marginBottom: 'var(--space-2)' }}>
                  <svg width="100%" height="100%" preserveAspectRatio="none" style={{ stroke: 'var(--cyan)', strokeWidth: 1.5, fill: 'none' }}>
                    <path d="M0,40 Q20,35 40,40 T80,40 T120,38 T160,10 L165,5 L170,40 T210,15 T230,12 T250,18 T270,14 T290,16 T330,15" />
                  </svg>
                  <div style={{ position: 'absolute', top: '15px', right: '40px', background: 'var(--amber)', color: '#000', fontSize: '9px', padding: '2px 4px', borderRadius: '2px', fontWeight: 600 }}>ANOMALY</div>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Separate machine noise from meaningful, sustained behavioral change.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 16 & 17. PREDICTIVE MAINTENANCE & SEVERITY */}
        <section style={{ padding: 'var(--space-12) 0', borderTop: '1px solid var(--border-subtle)' }}>
          <div className="container grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>From anomaly to maintenance risk.</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-lg)', lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
                Once an abnormal condition persists, Vigil tracks its severity. The longer a machine operates outside its normal baseline, the higher the maintenance priority.
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                <div style={{ background: 'var(--bg-raised)', padding: '12px 16px', borderRadius: '4px', border: '1px solid var(--border-default)', flex: 1 }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>ESTIMATED MAINTENANCE HORIZON</div>
                  <div style={{ fontSize: 'var(--text-xl)', color: 'var(--amber)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>18 DAYS</div>
                </div>
              </div>
            </div>
            
            <div style={{ 
              borderRadius: '12px', 
              border: '1px solid var(--border-strong)', 
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '360px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-md)'
            }}>
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundImage: 'url(/operator.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}></div>
              
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(10, 12, 14, 0.4)',
              }}></div>

              <div style={{ position: 'relative', zIndex: 1, background: 'rgba(10, 12, 14, 0.7)', backdropFilter: 'blur(12px)', padding: '24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="severity-pulse-orange" style={{ width: '120px', height: '120px', margin: '0 auto var(--space-4)', borderRadius: '50%', border: '6px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--amber)', borderRightColor: 'var(--amber)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: '2rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#fff', lineHeight: 1 }}>67%</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.1em', marginTop: '4px' }}>SEVERITY</div>
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--amber)', fontWeight: 600, letterSpacing: '0.05em' }}>ELEVATED RISK</div>
                <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.9)' }}>
                  <div><Activity size={12} style={{ display: 'inline', marginRight: 6 }}/> Vibration increasing</div>
                  <div><Zap size={12} style={{ display: 'inline', marginRight: 6 }}/> Power behavior changing</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 17.5. MOBILE ALERTS SECTION */}
        <section id="mobile-alerts" style={{ padding: 'var(--space-16) 0', background: 'var(--bg-raised)', borderTop: '1px solid var(--border-subtle)' }}>
          <div className="container grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            
            {/* Left: Phone Mockup */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div className="animate-float glass-panel" style={{ 
                width: '320px', 
                height: '620px', 
                border: '12px solid var(--text-primary)', 
                borderRadius: '40px', 
                boxShadow: '0 30px 60px rgba(0,0,0,0.4), 0 0 0 1px var(--border-default)', 
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                {/* Phone Notch */}
                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '120px', height: '24px', background: 'var(--text-primary)', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px', zIndex: 10 }}></div>
                
                {/* App Header */}
                <div style={{ background: 'var(--bg-base)', padding: '40px 16px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '32px', height: '32px', background: 'var(--cyan-dim)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cyan)' }}><Cpu size={18} /></div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Vigil Alerts</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Factory Floor Bot</div>
                  </div>
                </div>

                {/* Chat Interface */}
                <div style={{ flex: 1, background: 'var(--bg-raised)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'hidden' }}>
                  
                  {/* Msg 1 */}
                  <div style={{ alignSelf: 'flex-start', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '12px', borderRadius: '12px', borderBottomLeftRadius: '4px', maxWidth: '85%', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>06:00 AM • SHIFT HANDOVER</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Morning Report: 12 machines active. <br/>Energy cost this shift: <strong>₹4,180</strong></div>
                  </div>

                  {/* Msg 2 */}
                  <div style={{ alignSelf: 'flex-start', background: 'var(--amber-dim)', border: '1px solid rgba(232, 160, 32, 0.3)', padding: '12px', borderRadius: '12px', borderBottomLeftRadius: '4px', maxWidth: '85%', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--amber)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12}/> WARNING • MOTOR-002</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Temperature anomaly detected. Severity: 42%</div>
                  </div>

                  {/* Msg 3 */}
                  <div style={{ alignSelf: 'flex-start', background: 'var(--red-dim)', border: '1px solid rgba(192, 57, 43, 0.3)', padding: '12px', borderRadius: '12px', borderBottomLeftRadius: '4px', maxWidth: '85%', boxShadow: '0 4px 12px rgba(192, 57, 43, 0.15)' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--red)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}><Shield size={12}/> CRITICAL • PRESS-003</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Vibration spike! Maintenance required immediately.</div>
                  </div>

                </div>
              </div>
            </div>

            {/* Right: Text */}
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--cyan)', letterSpacing: '0.1em', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smartphone size={16} /> STAY CONNECTED
              </div>
              <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Automated mobile alerts & shift reporting.</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-lg)', lineHeight: 1.6, marginBottom: 'var(--space-6)' }}>
                You don't need to be staring at a dashboard to know your factory is running smoothly. Vigil automatically pushes critical information directly to your pocket.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ color: 'var(--green)', marginTop: '2px' }}><MessageSquare size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '2px' }}>Machine State Notifications</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Get pinged the moment a critical machine goes offline.</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ color: 'var(--cyan)', marginTop: '2px' }}><MessageSquare size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '2px' }}>Shift Handover Reports</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Automated summaries of production efficiency and energy cost at 6 AM and 6 PM.</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ color: 'var(--red)', marginTop: '2px' }}><MessageSquare size={20} /></div>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '2px' }}>Predictive Anomaly Warnings</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>Receive an alert when machine behavior starts deviating, long before a breakdown.</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* 18 & 19. ENERGY INTELLIGENCE */}
        <section id="energy" style={{ padding: 'var(--space-12) 0', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)' }}>
          <div className="container">
            <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto', marginBottom: 'var(--space-10)' }}>
              <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>Know what every machine costs to run.</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-lg)', lineHeight: 1.6 }}>
                Track machine-level power consumption, session energy usage, and electricity cost in real time. Every production session has an energy cost. Vigil makes it visible.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card" style={{ gridColumn: '1 / -1', background: 'var(--bg-raised)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-8)' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: '8px' }}>CURRENT SESSION COST</div>
                  <div style={{ fontSize: '3.5rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>₹1,284.60</div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-6)', textAlign: 'right' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>ENERGY CONSUMED</div>
                    <div style={{ fontSize: 'var(--text-xl)', color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>18.42 kWh</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>AVERAGE POWER</div>
                    <div style={{ fontSize: 'var(--text-xl)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>4.7 kW</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>TARIFF</div>
                    <div style={{ fontSize: 'var(--text-xl)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>₹6.97/kWh</div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--bg-raised)', padding: '16px', border: '1px solid var(--border-default)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>CNC-001</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>₹284</span>
              </div>
              <div style={{ background: 'var(--bg-raised)', padding: '16px', border: '1px solid var(--border-default)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>MOTOR-002</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>₹412</span>
              </div>
              <div style={{ background: 'var(--bg-raised)', padding: '16px', border: '1px solid var(--border-default)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>PRESS-003</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-md)', color: 'var(--text-primary)' }}>₹196</span>
              </div>
            </div>
          </div>
        </section>

        {/* 20. ALERTS SECTION */}
        <section style={{ padding: 'var(--space-12) 0', borderTop: '1px solid var(--border-subtle)' }}>
          <div className="container">
            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, marginBottom: 'var(--space-8)', textAlign: 'center' }}>Know when something needs attention.</h2>
            
            <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              
              <div className="alert-item critical" style={{ border: '1px solid var(--border-default)' }}>
                <AlertTriangle size={18} color="var(--red)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--red)', letterSpacing: '0.1em', fontWeight: 600 }}>CRITICAL • MOTOR-002</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>2 min ago</span>
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginBottom: '4px' }}>Vibration anomaly persists.</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Severity: <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>87%</span></div>
                </div>
              </div>

              <div className="alert-item warning" style={{ border: '1px solid var(--border-default)' }}>
                <Activity size={18} color="var(--amber)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--amber)', letterSpacing: '0.1em', fontWeight: 600 }}>WARNING • COMPRESSOR-004</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>8 min ago</span>
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginBottom: '4px' }}>Temperature rising above normal baseline.</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Severity: <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>43%</span></div>
                </div>
              </div>

              <div className="alert-item" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-default)' }}>
                <Info size={18} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', fontWeight: 600 }}>INFO • CNC-001</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>12 min ago</span>
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>Energy consumption stable.</div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 21 & 22. HOW IT WORKS */}
        <section id="how-it-works" style={{ padding: 'var(--space-12) 0', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)' }}>
          <div className="container">
            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, marginBottom: 'var(--space-10)', textAlign: 'center' }}>How It Works</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
              <div style={{ position: 'absolute', top: '24px', left: '12%', right: '12%', height: '1px', background: 'var(--border-strong)', zIndex: 0 }} className="hidden md:block"></div>
              
              <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', margin: '0 auto var(--space-4)', background: 'var(--bg-base)', border: '1px solid var(--border-strong)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>01</div>
                <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--text-primary)', marginBottom: '8px' }}>CONNECT</div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Machine sensors provide telemetry via MQTT.</p>
              </div>
              <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', margin: '0 auto var(--space-4)', background: 'var(--bg-base)', border: '1px solid var(--border-strong)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>02</div>
                <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--text-primary)', marginBottom: '8px' }}>OBSERVE</div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Vigil continuously tracks behavior to build a baseline.</p>
              </div>
              <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', margin: '0 auto var(--space-4)', background: 'var(--bg-base)', border: '1px solid var(--border-strong)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>03</div>
                <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--text-primary)', marginBottom: '8px' }}>DETECT</div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Abnormal patterns are mathematically identified.</p>
              </div>
              <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', margin: '0 auto var(--space-4)', background: 'var(--bg-base)', border: '1px solid var(--border-strong)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>04</div>
                <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--text-primary)', marginBottom: '8px' }}>ACT</div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Operators receive actionable risk information.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 23. SME FOCUS SECTION */}
        <section style={{ padding: 'var(--space-12) 0', borderTop: '1px solid var(--border-subtle)' }}>
          <div className="container">
            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, marginBottom: 'var(--space-8)', textAlign: 'center' }}>Industrial intelligence without industrial complexity.</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div style={{ background: 'var(--bg-raised)', padding: 'var(--space-6)', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--cyan)', marginBottom: 'var(--space-3)' }}>SIMPLE</div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>A clear interface designed directly for floor operators and maintenance teams, without convoluted navigation.</p>
              </div>
              <div style={{ background: 'var(--bg-raised)', padding: 'var(--space-6)', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--cyan)', marginBottom: 'var(--space-3)' }}>PRACTICAL</div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>Focus exclusively on machine health, predictive alerts, and energy information that can actually support daily operations.</p>
              </div>
              <div style={{ background: 'var(--bg-raised)', padding: 'var(--space-6)', border: '1px solid var(--border-default)', borderRadius: '8px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', color: 'var(--cyan)', marginBottom: 'var(--space-3)' }}>SCALABLE</div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>Start monitoring a single critical machine and expand seamlessly across the entire factory as needs grow.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 26. PRODUCT PHILOSOPHY & FINAL CTA */}
        <section style={{ padding: 'var(--space-16) 0', background: 'var(--bg-base)', borderTop: '1px solid var(--border-subtle)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05, background: 'radial-gradient(circle at center, var(--cyan) 0%, transparent 70%)', pointerEvents: 'none' }}></div>
          
          <div className="container relative z-10">
            <h2 style={{ fontSize: 'clamp(2rem, 3vw, 3rem)', fontWeight: 600, marginBottom: 'var(--space-4)', letterSpacing: '-0.02em' }}>
              Don't wait for the machine to tell you it failed.
            </h2>
            <p style={{ fontSize: 'var(--text-lg)', color: 'var(--text-muted)', marginBottom: 'var(--space-12)' }}>
              Watch the behavior that comes before the failure.
            </p>
            
            <div style={{ maxWidth: '600px', margin: '0 auto', background: 'var(--bg-surface)', padding: 'var(--space-8)', border: '1px solid var(--border-strong)', borderRadius: '12px', boxShadow: 'var(--cta-shadow)' }}>
              <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>See what your machines are telling you.</h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>Monitor machine health. Understand anomalies. Track energy. Act before downtime.</p>
              <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center' }}>
                <Link to="/dashboard" className="btn btn-primary" style={{ padding: '12px 28px', fontSize: 'var(--text-md)', fontWeight: 600 }}>
                  Explore Vigil →
                </Link>
                <Link to="/dashboard" className="btn btn-secondary" style={{ padding: '12px 28px', fontSize: 'var(--text-md)', fontWeight: 500 }}>
                  View Live Console
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 29. FOOTER */}
        <footer style={{ padding: 'var(--space-8) 0', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
          <div className="container">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                  <Cpu size={20} color="var(--text-muted)" />
                  <span style={{ fontSize: 'var(--text-md)', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-primary)' }}>VIGIL</span>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', maxWidth: '300px' }}>
                  Real-time machine health and energy intelligence for modern manufacturing.
                </p>
              </div>
              
              <div style={{ display: 'flex', gap: 'var(--space-8)' }} className="md:justify-end justify-start">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                  <a href="#product" style={{ color: 'var(--text-muted)' }}>Product</a>
                  <a href="#how-it-works" style={{ color: 'var(--text-muted)' }}>How It Works</a>
                  <a href="#intelligence" style={{ color: 'var(--text-muted)' }}>Intelligence</a>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                  <a href="#energy" style={{ color: 'var(--text-muted)' }}>Energy</a>
                  <a href="#use-cases" style={{ color: 'var(--text-muted)' }}>Use Cases</a>
                  <a href="#contact" style={{ color: 'var(--text-muted)' }}>Contact</a>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-default)', paddingTop: 'var(--space-6)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              <div>© 2026 Vigil. All rights reserved.</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, letterSpacing: '0.05em' }}>
                <span className="status-dot normal" style={{ width: 6, height: 6 }}></span> SYSTEM ONLINE
              </div>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
