import { useState } from 'react';
import { Save, AlertCircle, Plus, Trash2, Edit2 } from 'lucide-react';
import { useMachine } from '../contexts/MachineContext';
import { createMachine, updateMachine, deleteMachine } from '../api/client';
import type { MachineInfo } from '../types';

export function SettingsPage() {
  const { machines, refreshMachines } = useMachine();
  
  const [editingMachine, setEditingMachine] = useState<Partial<MachineInfo> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleEdit(machine: MachineInfo) {
    setEditingMachine(machine);
    setIsNew(false);
    setError(null);
  }

  function handleAddNew() {
    setEditingMachine({
      machine_id: `machine-00${machines.length + 1}`,
      name: 'New Machine',
      location: 'Factory Floor',
      rated_power_kw: 5.0,
      tariff_inr_per_kwh: 8.50,
    });
    setIsNew(true);
    setError(null);
  }

  async function handleDelete(machineId: string) {
    if (!confirm(`Are you sure you want to remove ${machineId}?`)) return;
    try {
      await deleteMachine(machineId);
      await refreshMachines();
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  }

  async function handleSave() {
    if (!editingMachine?.machine_id || !editingMachine.name) {
      setError('Machine ID and Name are required.');
      return;
    }
    
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        await createMachine(editingMachine);
      } else {
        await updateMachine(editingMachine.machine_id, editingMachine);
      }
      await refreshMachines();
      setEditingMachine(null);
    } catch (err: any) {
      setError(err.message || 'Failed to save machine.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page" id="main-content" tabIndex={-1}>
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-8)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '4px' }}>CONFIGURATION</div>
          <h1 style={{ marginBottom: 'var(--space-1)' }}>Settings</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            Manage monitored machines and configuration.
          </p>
        </div>
        {!editingMachine && (
          <button className="btn btn-primary" onClick={handleAddNew}>
            <Plus size={14} strokeWidth={1.5} />
            Add Machine
          </button>
        )}
      </div>

      {editingMachine ? (
        <div className="card" style={{ maxWidth: 640 }}>
          <h2 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--space-5)' }}>
            {isNew ? 'Register New Machine' : 'Edit Machine'}
          </h2>
          
          <div className="flex flex-col gap-4">
            <Field label="Machine ID" note="Must match the ID sent by the sensor node.">
              <input
                type="text"
                value={editingMachine.machine_id || ''}
                onChange={e => setEditingMachine({ ...editingMachine, machine_id: e.target.value })}
                style={inputStyle}
                disabled={!isNew}
              />
            </Field>
            <Field label="Display name">
              <input
                type="text"
                value={editingMachine.name || ''}
                onChange={e => setEditingMachine({ ...editingMachine, name: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="Location">
              <input
                type="text"
                value={editingMachine.location || ''}
                onChange={e => setEditingMachine({ ...editingMachine, location: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="Rated power (kW)" note="Nameplate power rating.">
              <input
                type="number"
                min="0"
                step="0.1"
                value={editingMachine.rated_power_kw || ''}
                onChange={e => setEditingMachine({ ...editingMachine, rated_power_kw: parseFloat(e.target.value) })}
                style={inputStyle}
              />
            </Field>
            <Field label="Electricity tariff (INR / kWh)" note="Used to compute session cost.">
              <input
                type="number"
                min="0"
                step="0.01"
                value={editingMachine.tariff_inr_per_kwh || ''}
                onChange={e => setEditingMachine({ ...editingMachine, tariff_inr_per_kwh: parseFloat(e.target.value) })}
                style={inputStyle}
              />
            </Field>
          </div>

          {error && (
            <div
              className="flex items-center gap-2"
              style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--red-dim)',
                border: '1px solid rgba(192,57,43,0.3)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--red)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <AlertCircle size={16} strokeWidth={1.5} />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3" style={{ marginTop: 'var(--space-6)' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              <Save size={14} strokeWidth={1.5} />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button className="btn btn-ghost" onClick={() => setEditingMachine(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Machine ID</th>
                <th>Name</th>
                <th>Location</th>
                <th>Power</th>
                <th>Tariff</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {machines.map(m => (
                <tr key={m.machine_id}>
                  <td><strong>{m.machine_id}</strong></td>
                  <td style={{ fontFamily: 'var(--font-sans)' }}>{m.name}</td>
                  <td style={{ fontFamily: 'var(--font-sans)' }}>{m.location || '—'}</td>
                  <td>{m.rated_power_kw} kW</td>
                  <td>₹{m.tariff_inr_per_kwh} / kWh</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex justify-end gap-2">
                      <button className="btn btn-secondary" onClick={() => handleEdit(m)}>
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-ghost" onClick={() => handleDelete(m.machine_id)} style={{ color: 'var(--red)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {machines.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 'var(--space-6)', fontFamily: 'var(--font-sans)', color: 'var(--text-muted)' }}>
                    No machines registered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-base)',
  border: '1px solid var(--border-strong)',
  borderRadius: '4px',
  padding: 'var(--space-3) var(--space-4)',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--text-sm)',
  outline: 'none',
};

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
