import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { AlertsPage } from './pages/AlertsPage';
import { SettingsPage } from './pages/SettingsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { useLiveFeed } from './hooks/useLiveFeed';

const MACHINE_ID = import.meta.env.VITE_MACHINE_ID ?? 'machine-001';

/**
 * Root application component.
 * useLiveFeed is hoisted here so the Navbar connection indicator
 * stays in sync with the actual feed state without prop drilling everywhere.
 */
function AppShell() {
  const { feedState } = useLiveFeed(MACHINE_ID);

  return (
    <BrowserRouter>
      <Navbar feedState={feedState} />
      <Routes>
        <Route path="/"        element={<DashboardPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/alerts"  element={<AlertsPage />} />
        <Route path="/settings"element={<SettingsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms"   element={<TermsPage />} />
        {/* Catch-all: redirect to dashboard */}
        <Route path="*"        element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}

export default AppShell;
