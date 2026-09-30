import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { AlertsPage } from './pages/AlertsPage';
import { SettingsPage } from './pages/SettingsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { AllMachinesPage } from './pages/AllMachinesPage';
import { LandingPage } from './pages/LandingPage';
import { useLiveFeed } from './hooks/useLiveFeed';
import { MachineProvider, useMachine } from './contexts/MachineContext';
import { Outlet } from 'react-router-dom';

function AppLayout() {
  const { selectedMachineId } = useMachine();
  const { feedState } = useLiveFeed(selectedMachineId);

  return (
    <>
      <Navbar feedState={feedState} />
      <Outlet />
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
          <Route path="/history"   element={<HistoryPage />} />
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

function AppShell() {
  return (
    <MachineProvider>
      <BrowserRouter>
        <MainLayout />
        <Footer />
      </BrowserRouter>
    </MachineProvider>
  );
}

export default AppShell;
