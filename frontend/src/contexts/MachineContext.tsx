import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { listMachines } from '../api/client';
import type { MachineInfo } from '../types';

interface MachineContextType {
  machines: MachineInfo[];
  selectedMachineId: string;
  setSelectedMachineId: (id: string) => void;
  loading: boolean;
  refreshMachines: () => Promise<void>;
}

const MachineContext = createContext<MachineContextType | undefined>(undefined);

export function MachineProvider({ children }: { children: ReactNode }) {
  const [machines, setMachines] = useState<MachineInfo[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<string>(import.meta.env.VITE_MACHINE_ID ?? 'machine-001');
  const [loading, setLoading] = useState(true);

  const refreshMachines = async () => {
    try {
      const data = await listMachines();
      setMachines(data);
      if (data.length > 0 && !data.find(m => m.machine_id === selectedMachineId)) {
        setSelectedMachineId(data[0].machine_id);
      }
    } catch (err) {
      console.error("Failed to fetch machines:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshMachines();
  }, []);

  return (
    <MachineContext.Provider value={{ machines, selectedMachineId, setSelectedMachineId, loading, refreshMachines }}>
      {children}
    </MachineContext.Provider>
  );
}

export function useMachine() {
  const context = useContext(MachineContext);
  if (context === undefined) {
    throw new Error('useMachine must be used within a MachineProvider');
  }
  return context;
}
