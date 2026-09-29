import { useState, useEffect, useCallback } from 'react';
import type { AlertRecord } from '../types';
import { getAlerts } from '../api/client';

/** Polls alert log every 5 seconds */
export function useAlerts(machineId: string) {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getAlerts(machineId, 50);
      setAlerts(data);
    } catch {
      // Retain last known list on failure
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { alerts, loading, refresh };
}
