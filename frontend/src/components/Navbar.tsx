import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, BarChart2, Bell, Settings, Cpu, Moon, Sun, ClipboardList, Sparkles } from 'lucide-react';
import type { FeedState } from '../types';
import { useAlerts } from '../hooks/useAlerts';

function NotificationDropdown({ machineId }: { machineId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { alerts, loading } = useAlerts(machineId);

  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);
    
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('#nav-alerts-btn') && !(e.target as HTMLElement).closest('.notif-dropdown')) {
        setIsOpen(false);
      }
    };

    window.addEventListener('toggle-notifications', handleToggle);
    window.addEventListener('click', handleClickOutside);

    return () => {
      window.removeEventListener('toggle-notifications', handleToggle);
      window.removeEventListener('click', handleClickOutside);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="notif-dropdown" style={{
      position: 'absolute', top: 'calc(100% + 12px)', right: '-10px', 
      width: '320px', 
      background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{ 
        padding: '16px', borderBottom: '1px solid var(--border-default)', 
        fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--bg-surface)'
      }}>
        Recent Alerts
        {alerts.length > 0 && <span style={{ fontSize: '11px', background: 'var(--cyan-dim)', color: 'var(--cyan)', padding: '2px 6px', borderRadius: '4px' }}>{alerts.length} New</span>}
      </div>
      
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {loading ? <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div> : 
          alerts.length === 0 ? <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>You're all caught up! No new notifications.</div> :
          alerts.slice(0, 5).map(alert => (
            <div key={alert.id} style={{ 
              padding: '16px', borderBottom: '1px solid var(--border-subtle)', 
              display: 'flex', flexDirection: 'column', gap: '6px',
              background: alert.status === 'critical' ? 'var(--red-dim)' : 'transparent',
              transition: 'background var(--transition-fast)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', color: alert.status === 'critical' ? 'var(--red)' : 'var(--amber)', fontWeight: 700, letterSpacing: '0.5px' }}>
                  {alert.status.toUpperCase()}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div style={{ 
                fontSize: '13px', 
                lineHeight: '1.5', 
                color: 'var(--text-primary)',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {alert.alert_reason}
              </div>
            </div>
          ))
        }
      </div>
      <NavLink to="/alerts" onClick={() => setIsOpen(false)} style={{ 
        padding: '12px', textAlign: 'center', fontSize: '13px', 
        color: 'var(--cyan)', textDecoration: 'none', fontWeight: 600,
        background: 'var(--bg-elevated)',
        borderTop: '1px solid var(--border-default)'
      }}>
        View all alerts →
      </NavLink>
    </div>
  );
}

interface Props {
  feedState?: FeedState;
}

function ConnectionIndicator({ feedState }: { feedState?: FeedState }) {
  if (!feedState) return null;

  const { state, seconds_stale } = feedState;

  const configs = {
    connected:    { label: 'Live',         color: 'var(--green)', dotClass: 'normal' },
    connecting:   { label: 'Connecting',   color: 'var(--amber)', dotClass: 'warning' },
    stale:        { label: `Stale ${seconds_stale}s`, color: 'var(--amber)', dotClass: 'warning' },
    disconnected: { label: 'Offline',      color: 'var(--red)',   dotClass: 'critical' },
  } as const;

  const cfg = configs[state];

  return (
    <div
      className="flex items-center gap-2"
      style={{ fontSize: 'var(--text-xs)', color: cfg.color, fontWeight: 500 }}
    >
      <div className={`status-dot ${cfg.dotClass}`} />
      {cfg.label}
    </div>
  );
}

import { useMachine } from '../contexts/MachineContext';
import { useTheme } from '../hooks/useTheme';

export function Navbar({ feedState }: Props) {
  const { machines, selectedMachineId } = useMachine();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <NavLink to="/" className="navbar-logo" aria-label="MachineSense home" style={{ marginRight: 'var(--space-2)' }}>
        <Cpu size={20} color="var(--cyan)" strokeWidth={1.5} />
        <span className="navbar-wordmark">MachineSense</span>
      </NavLink>
      


      <div className="navbar-nav" style={{ marginLeft: 'auto' }}>
        <NavLink
          to="/all"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          id="nav-all"
        >
          <Activity size={15} strokeWidth={1.5} />
          Overview
        </NavLink>
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          id="nav-dashboard"
        >
          <Cpu size={15} strokeWidth={1.5} />
          Dashboard
        </NavLink>
        <NavLink
          to="/history"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          id="nav-history"
        >
          <BarChart2 size={15} strokeWidth={1.5} />
          History
        </NavLink>
        <NavLink
          to="/analytics"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          id="nav-analytics"
        >
          <ClipboardList size={15} strokeWidth={1.5} />
          Analytics
        </NavLink>
        
        {/* Notification Bell Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              // Instead of navigating, toggle dropdown
              const evt = new CustomEvent('toggle-notifications');
              window.dispatchEvent(evt);
            }}
            className="nav-link"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', outline: 'none' }}
            id="nav-alerts-btn"
          >
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={16} strokeWidth={1.5} />
              <span style={{
                position: 'absolute',
                top: '-2px',
                right: '1px',
                background: 'var(--red)',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                display: 'block',
                border: '2px solid var(--bg-base)'
              }} />
            </div>
            Alerts
          </button>
          
          <NotificationDropdown machineId={selectedMachineId || (machines[0]?.machine_id ?? 'machine-001')} />
        </div>

        <NavLink
          to="/advanced"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          id="nav-advanced"
        >
          <Sparkles size={15} strokeWidth={1.5} color="var(--cyan)" />
          Advanced
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          id="nav-settings"
        >
          <Settings size={15} strokeWidth={1.5} />
          Settings
        </NavLink>
      </div>

      <div style={{ marginLeft: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
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
        <ConnectionIndicator feedState={feedState} />
      </div>
    </nav>
  );
}
