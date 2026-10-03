import { NavLink } from 'react-router-dom';
import { Activity, BarChart2, Bell, Settings, Cpu, Moon, Sun, ClipboardList } from 'lucide-react';
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
