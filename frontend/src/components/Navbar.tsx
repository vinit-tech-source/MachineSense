import { NavLink } from 'react-router-dom';
import { Activity, BarChart2, Bell, Settings, Cpu, Moon, Sun } from 'lucide-react';
import type { FeedState } from '../types';

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
  const { machines, selectedMachineId, setSelectedMachineId } = useMachine();
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <NavLink to="/" className="navbar-logo" aria-label="Vigil home" style={{ marginRight: 'var(--space-2)' }}>
        <Cpu size={20} color="var(--cyan)" strokeWidth={1.5} />
        <span className="navbar-wordmark">Vigil</span>
      </NavLink>
      
      <div className="flex items-center" style={{ marginRight: 'auto', marginLeft: 'var(--space-6)' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginRight: '12px', fontWeight: 600 }}>MONITORING:</div>
        <select
          value={selectedMachineId}
          onChange={(e) => setSelectedMachineId(e.target.value)}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--cyan-dim)',
            color: 'var(--cyan)',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            outline: 'none',
            cursor: 'pointer',
            boxShadow: '0 0 10px rgba(0, 180, 216, 0.05)'
          }}
        >
          {machines.map(m => (
            <option key={m.machine_id} value={m.machine_id} style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
              {m.name} ({m.machine_id})
            </option>
          ))}
          {machines.length === 0 && <option disabled>No machines</option>}
        </select>
      </div>

      <div className="navbar-nav">
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
          to="/alerts"
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          id="nav-alerts"
        >
          <Bell size={15} strokeWidth={1.5} />
          Alerts
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
