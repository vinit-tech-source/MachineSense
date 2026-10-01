import { useState, useEffect } from 'react';
import { getBaseline } from '../api/client';
import type { BaselineStats } from '../types';

export function useBaselineStats(machineId: string) {
  const [stats, setStats] = useState<BaselineStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchStats() {
      if (!machineId) return;
      try {
        const data = await getBaseline(machineId);
        if (mounted) {
          setStats(data);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setStats(null);
          setLoading(false);
        }
      }
    }

    fetchStats();
    
    // Poll every 10 seconds
    const interval = setInterval(fetchStats, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [machineId]);

  return { stats, loading };
}
