export function PrivacyPage() {
  return (
    <main className="page" id="main-content" tabIndex={-1} style={{ maxWidth: 720 }}>
      <h1 style={{ marginBottom: 'var(--space-6)' }}>Privacy Policy</h1>

      <div className="card" style={{ lineHeight: 1.8, color: 'var(--text-secondary)' }}>
        <p style={{ marginBottom: 'var(--space-4)', color: 'var(--text-primary)', fontWeight: 500 }}>
          Effective date: 1 October 2024
        </p>

        <Section title="What data MachineSense collects">
          <p>
            MachineSense collects sensor readings from the physical machine it is attached to:
            electrical current (A), voltage (V), vibration (mm/s), temperature (°C), and rotational speed (RPM).
            These readings are stored in a database on infrastructure you control.
          </p>
        </Section>

        <Section title="Where data is stored">
          <p>
            All sensor data is stored in the PostgreSQL database you configured at setup time, on
            infrastructure within your own premises or hosting environment. MachineSense does not
            receive, forward, or have access to any raw sensor data from your machines.
          </p>
        </Section>

        <Section title="Who can access the data">
          <p>
            Access to the dashboard and data is controlled by your network and authentication
            configuration. MachineSense has no remote access to your installation.
          </p>
        </Section>

        <Section title="Cookies and browser storage">
          <p>
            MachineSense uses browser localStorage to persist your settings (machine ID, tariff, display name).
            No tracking cookies or third-party analytics scripts are included.
          </p>
        </Section>

        <Section title="Data retention">
          <p>
            Sensor readings and alert records are retained indefinitely in your database until
            you choose to delete them. No automatic purge policy is applied by default.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            For questions about this policy, contact the system administrator for your MachineSense installation.
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <h2 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}
