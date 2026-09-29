import { useState, useEffect } from 'react';
import type { EnergyMetrics } from '../types';
import { getEnergyMetrics } from '../api/client';

/** Polls energy metrics every 5 seconds (cost/energy accumulate slowly) */
export function useEnergyMetrics(machineId: string) {
  const [metrics, setMetrics] = useState<EnergyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const data = await getEnergyMetrics(machineId);
        if (!cancelled) { setMetrics(data); setError(null); setLoading(false); }
      } catch (e) {
        if (!cancelled) { setError(String(e)); setLoading(false); }
      }
    }

    fetch();
    const interval = setInterval(fetch, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [machineId]);

  return { metrics, loading, error };
}
