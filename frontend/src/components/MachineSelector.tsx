import { useMachine } from '../contexts/MachineContext';

export function MachineSelector() {
  const { machines, selectedMachineId, setSelectedMachineId } = useMachine();

  return (
    <div className="flex items-center">
      <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', marginRight: '12px', fontWeight: 600 }}>MONITORING:</div>
      <select
        value={selectedMachineId}
        onChange={(e) => setSelectedMachineId(e.target.value)}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--cyan-dim)',
          color: 'var(--cyan)',
          padding: '6px 12px',
          borderRadius: '4px',
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          outline: 'none',
          cursor: 'pointer',
          boxShadow: '0 0 10px rgba(0, 180, 216, 0.05)'
        }}
      >
        {machines.map(m => (
          <option key={m.machine_id} value={m.machine_id} style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
            {m.name}
          </option>
        ))}
        {machines.length === 0 && <option disabled>No machines</option>}
      </select>
    </div>
  );
}
