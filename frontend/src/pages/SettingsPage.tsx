import { useState } from 'react';
import { Save, AlertCircle } from 'lucide-react';

interface Config {
  machineId: string;
  machineName: string;
  location: string;
  ratedPowerKw: string;
  tariffInrPerKwh: string;
  apiUrl: string;
}

const STORAGE_KEY = 'vigil_config';

function loadConfig(): Config {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    machineId:       import.meta.env.VITE_MACHINE_ID     ?? 'machine-001',
    machineName:     'Main Production Motor',
    location:        'Production Line A',
    ratedPowerKw:    '7.5',
    tariffInrPerKwh: '8.50',
    apiUrl:          import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  };
}

export function SettingsPage() {
  const [config, setConfig] = useState<Config>(loadConfig);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(field: keyof Config, value: string) {
    setConfig(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function handleSave() {
    const tariff = parseFloat(config.tariffInrPerKwh);
    const rated = parseFloat(config.ratedPowerKw);
    if (isNaN(tariff) || tariff <= 0) {
      setError('Tariff must be a positive number (INR per kWh).');
      return;
    }
    if (isNaN(rated) || rated <= 0) {
      setError('Rated power must be a positive number (kW).');
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    setError(null);
    setSaved(true);
  }

  return (
    <main className="page" id="main-content" tabIndex={-1}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ marginBottom: 'var(--space-1)' }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
          Machine configuration and display preferences. Saved to browser storage.
        </p>
      </div>

      <div style={{ maxWidth: 640 }}>
        <Section title="Machine Identity">
          <Field label="Machine ID" note="Must match the ID sent by the sensor node.">
            <input
              id="settings-machine-id"
              type="text"
              value={config.machineId}
              onChange={e => handleChange('machineId', e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Display name">
            <input
              id="settings-machine-name"
              type="text"
              value={config.machineName}
              onChange={e => handleChange('machineName', e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Location">
            <input
              id="settings-location"
              type="text"
              value={config.location}
              onChange={e => handleChange('location', e.target.value)}
              style={inputStyle}
            />
          </Field>
        </Section>

        <Section title="Energy Configuration">
          <Field label="Rated power (kW)" note="Nameplate power rating of the machine.">
            <input
              id="settings-rated-power"
              type="number"
              min="0"
              step="0.1"
              value={config.ratedPowerKw}
              onChange={e => handleChange('ratedPowerKw', e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Electricity tariff (INR / kWh)" note="Used to compute session cost.">
            <input
              id="settings-tariff"
              type="number"
              min="0"
              step="0.01"
              value={config.tariffInrPerKwh}
              onChange={e => handleChange('tariffInrPerKwh', e.target.value)}
              style={inputStyle}
            />
          </Field>
        </Section>

        <Section title="Backend Connection">
          <Field label="API URL" note="Backend base URL for REST and WebSocket connections.">
            <input
              id="settings-api-url"
              type="url"
              value={config.apiUrl}
              onChange={e => handleChange('apiUrl', e.target.value)}
              style={inputStyle}
            />
          </Field>
        </Section>

        {error && (
          <div
            className="flex items-center gap-2"
            style={{
              padding: 'var(--space-3) var(--space-4)',
              background: 'var(--red-dim)',
              border: '1px solid rgba(192,57,43,0.3)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-4)',
              color: 'var(--red)',
              fontSize: 'var(--text-sm)',
            }}
            role="alert"
          >
            <AlertCircle size={16} strokeWidth={1.5} />
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button className="btn btn-primary" onClick={handleSave} id="settings-save">
            <Save size={14} strokeWidth={1.5} />
            Save settings
          </button>
          {saved && (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--green)' }}>
              Saved. Reload the page to apply changes.
            </span>
          )}
        </div>
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-md)',
  padding: 'var(--space-3) var(--space-4)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-sans)',
  fontSize: 'var(--text-base)',
  outline: 'none',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
      <h2 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-5)', color: 'var(--text-secondary)' }}>
        {title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          color: 'var(--text-secondary)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {label}
        {note && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
            {note}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
