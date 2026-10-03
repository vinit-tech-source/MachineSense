import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { useEffect, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { AlertsPage } from './pages/AlertsPage';
import { SettingsPage } from './pages/SettingsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { AllMachinesPage } from './pages/AllMachinesPage';
import { ComparePage } from './pages/ComparePage';
import { LandingPage } from './pages/LandingPage';
import { ManualAnalyticsPage } from './pages/ManualAnalyticsPage';
import { useLiveFeed } from './hooks/useLiveFeed';
import { MachineProvider, useMachine } from './contexts/MachineContext';
import { Outlet } from 'react-router-dom';
import { ChatbotWidget } from './components/ChatbotWidget';

/**
 * Reads the `?machine=<id>` search param from the current URL and syncs it
 * into MachineContext so direct links like `/dashboard?machine=machine-002`
 * correctly switch the active machine.
 */
function MachineParamSync() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { machines, selectedMachineId, setSelectedMachineId } = useMachine();

  useEffect(() => {
    const machineParam = searchParams.get('machine');
    if (!machineParam) return;
    // Only switch if the machine actually exists in the registry
    const exists = machines.find(m => m.machine_id === machineParam);
    if (exists && machineParam !== selectedMachineId) {
      setSelectedMachineId(machineParam);
    }
    // Remove the param from the URL (clean it up) once applied
    if (exists) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('machine');
        return next;
      }, { replace: true });
    }
  }, [searchParams, machines, selectedMachineId, setSelectedMachineId, setSearchParams]);

  return null;
}

function AppLayout() {
  const { selectedMachineId } = useMachine();
  const { feedState } = useLiveFeed(selectedMachineId);

  return (
    <>
      <MachineParamSync />
      <Navbar feedState={feedState} />
      <Outlet />
      <ChatbotWidget />
    </>
  );
}

function MainLayout() {
  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        
        {/* Protected / Console Routes */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/all"       element={<AllMachinesPage />} />
          <Route path="/compare"   element={<ComparePage />} />
          <Route path="/history"   element={<HistoryPage />} />
          <Route path="/analytics" element={<ManualAnalyticsPage />} />
          <Route path="/alerts"    element={<AlertsPage />} />
          <Route path="/settings"  element={<SettingsPage />} />
          <Route path="/privacy"   element={<PrivacyPage />} />
          <Route path="/terms"     element={<TermsPage />} />
          {/* Catch-all: redirect to dashboard */}
          <Route path="*"          element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </>
  );
}

// ── Error Boundary ─────────────────────────────────────────────────────────────
interface ErrorBoundaryState { hasError: boolean; message: string }
class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(err: Error): ErrorBoundaryState {
    return { hasError: true, message: err.message };
  }
  componentDidCatch(_err: Error, info: ErrorInfo) {
    console.error('[MachineSense ErrorBoundary]', info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-base)', color: 'var(--text-primary)',
          fontFamily: 'var(--font-sans)', gap: '16px', padding: '32px',
        }}>
          <div style={{ fontSize: '2rem' }}>⚠️</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: 480, textAlign: 'center' }}>
            {this.state.message || 'An unexpected error occurred. Please reload the page.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px', background: 'var(--cyan)', color: '#000',
              border: 'none', borderRadius: '6px', fontWeight: 600,
              cursor: 'pointer', fontSize: '0.875rem'
            }}
          >
            Reload Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppShell() {
  return (
    <ErrorBoundary>
      <MachineProvider>
        <BrowserRouter>
          <MainLayout />
          <Footer />
        </BrowserRouter>
      </MachineProvider>
    </ErrorBoundary>
  );
}

export default AppShell;
