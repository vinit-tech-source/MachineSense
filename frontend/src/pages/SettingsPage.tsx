import { useState } from 'react';
import { Save, AlertCircle, Plus, Trash2, Edit2, Tag, FileText, MapPin, Zap, Coins, ChevronLeft } from 'lucide-react';
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
        <div style={{ width: '85%', maxWidth: '1400px', margin: '0 auto', animation: 'fadeIn 0.3s ease-out' }}>
          <button 
            className="btn btn-ghost" 
            onClick={() => setEditingMachine(null)}
            style={{ marginBottom: 'var(--space-6)', paddingLeft: 0, color: 'var(--text-muted)' }}
          >
            <ChevronLeft size={16} /> Back to Machine List
          </button>

          <div className="card" style={{ padding: 'var(--space-8)', borderTop: '4px solid var(--cyan)' }}>
            <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isNew ? 'Register New Machine' : 'Edit Machine Details'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-8)' }}>
              {isNew ? 'Configure a new sensor node and map it to your factory floor.' : 'Update physical parameters and location data for this node.'}
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-8)' }}>
              
              {/* Identity Section */}
              <div style={{ background: 'var(--bg-base)', padding: 'var(--space-6)', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Tag size={14} /> Identity & Location
                </h3>
                <div className="flex flex-col gap-5">
                  <Field label="Node / Machine ID" note="Must match sensor hardware ID." icon={<Tag size={16} />}>
                    <input
                      type="text"
                      value={editingMachine.machine_id || ''}
                      onChange={e => setEditingMachine({ ...editingMachine, machine_id: e.target.value })}
                      style={inputStyle}
                      disabled={!isNew}
                      placeholder="e.g. machine-004"
                    />
                  </Field>
                  <Field label="Display Name" icon={<FileText size={16} />}>
                    <input
                      type="text"
                      value={editingMachine.name || ''}
                      onChange={e => setEditingMachine({ ...editingMachine, name: e.target.value })}
                      style={inputStyle}
                      placeholder="e.g. CNC Turning Lathe"
                    />
                  </Field>
                  <Field label="Factory Location" icon={<MapPin size={16} />}>
                    <input
                      type="text"
                      value={editingMachine.location || ''}
                      onChange={e => setEditingMachine({ ...editingMachine, location: e.target.value })}
                      style={inputStyle}
                      placeholder="e.g. Zone B, Assembly Line 2"
                    />
                  </Field>
                </div>
              </div>

              {/* Specs Section */}
              <div style={{ background: 'var(--bg-base)', padding: 'var(--space-6)', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={14} /> Operating Parameters
                </h3>
                <div className="flex flex-col gap-5">
                  <Field label="Rated Power (kW)" note="Nameplate power rating." icon={<Zap size={16} />}>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={editingMachine.rated_power_kw || ''}
                      onChange={e => setEditingMachine({ ...editingMachine, rated_power_kw: parseFloat(e.target.value) })}
                      style={inputStyle}
                      placeholder="5.0"
                    />
                  </Field>
                  <Field label="Electricity Tariff (₹/kWh)" note="Used to compute session cost." icon={<Coins size={16} />}>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editingMachine.tariff_inr_per_kwh || ''}
                      onChange={e => setEditingMachine({ ...editingMachine, tariff_inr_per_kwh: parseFloat(e.target.value) })}
                      style={inputStyle}
                      placeholder="8.50"
                    />
                  </Field>
                </div>
              </div>
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

          <div className="flex justify-end gap-3" style={{ marginTop: 'var(--space-8)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--border-default)' }}>
            <button 
              className="btn btn-ghost" 
              onClick={() => setEditingMachine(null)}
              style={{ padding: '10px 24px' }}
            >
              Cancel
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleSave} 
              disabled={saving}
              style={{ padding: '10px 32px', boxShadow: '0 4px 12px rgba(8, 145, 178, 0.4)' }}
            >
              <Save size={16} strokeWidth={2} />
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
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
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-strong)',
  borderRadius: '8px',
  padding: '12px 16px 12px 42px', /* extra left padding for the absolute icon */
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  fontSize: '14px',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s'
};

function Field({ label, note, icon, children }: { label: string; note?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <label
        style={{
          display: 'block',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '8px',
          letterSpacing: '0.02em'
        }}
      >
        {label}
        {note && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
            — {note}
          </span>
        )}
      </label>
      <div style={{ position: 'relative' }}>
        {icon && (
          <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--cyan)', pointerEvents: 'none' }}>
            {icon}
          </div>
        )}
        {children}
      </div>
      <style>{`
        input:focus {
          border-color: var(--cyan) !important;
          box-shadow: 0 0 0 2px rgba(8, 145, 178, 0.2) !important;
        }
        input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
