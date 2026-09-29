import { NavLink } from 'react-router-dom';
import { Activity, BarChart2, Bell, Settings, Cpu } from 'lucide-react';
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

export function Navbar({ feedState }: Props) {
  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <NavLink to="/" className="navbar-logo" aria-label="Vigil home">
        <Cpu size={20} color="var(--cyan)" strokeWidth={1.5} />
        <span className="navbar-wordmark">Vigil</span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 400, letterSpacing: '0.04em', marginLeft: '2px' }}>
          Machine Health Console
        </span>
      </NavLink>

      <div className="navbar-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          id="nav-dashboard"
        >
          <Activity size={15} strokeWidth={1.5} />
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

      <div style={{ marginLeft: 'var(--space-4)' }}>
        <ConnectionIndicator feedState={feedState} />
      </div>
    </nav>
  );
}
