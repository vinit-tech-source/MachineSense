export function TermsPage() {
  return (
    <main className="page" id="main-content" tabIndex={-1} style={{ maxWidth: 720 }}>
      <h1 style={{ marginBottom: 'var(--space-6)' }}>Terms and Conditions</h1>

      <div className="card" style={{ lineHeight: 1.8, color: 'var(--text-secondary)' }}>
        <p style={{ marginBottom: 'var(--space-4)', color: 'var(--text-primary)', fontWeight: 500 }}>
          Effective date: 1 October 2024
        </p>

        <Section title="Scope of this software">
          <p>
            MachineSense is a machine health and energy monitoring tool for single industrial machines in
            small and medium manufacturing environments. It is not a safety-rated system and is not
            designed or certified for use in hazardous or explosive environments. Do not rely on
            MachineSense as the sole safety mechanism for any machine or process.
          </p>
        </Section>

        <Section title="No warranty">
          <p>
            This software is provided as-is. MachineSense makes no warranty, express or implied,
            regarding accuracy of anomaly detection, energy estimates, or remaining-useful-life estimates.
            These outputs are statistical approximations, not certified measurements or certified maintenance schedules.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            MachineSense is not liable for machine damage, downtime, energy costs, or any other direct
            or indirect loss arising from use of or reliance on MachineSense outputs. All operational decisions
            remain the sole responsibility of the machine operator and facility manager.
          </p>
        </Section>

        <Section title="Acceptable use">
          <p>
            MachineSense must be deployed only in environments where its capabilities and limitations are clearly
            understood by the responsible operators. The software must not be modified or redeployed in
            a way that misrepresents its data as certified measurements.
          </p>
        </Section>

        <Section title="Data responsibility">
          <p>
            The customer is responsible for the security and integrity of the database, network, and
            infrastructure on which MachineSense runs. MachineSense has no access to customer data.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            MachineSense may update these terms. The effective date at the top of this page reflects the
            date of the most recent revision.
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
