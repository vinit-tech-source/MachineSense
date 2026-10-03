import { useState, useEffect } from 'react';
import type { DailySummary } from '../types';
import { getDailySummaries } from '../api/client';

export function useDailySummaries(machineId: string, days: number = 14) {
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getDailySummaries(machineId, days)
      .then(data => { if (!cancelled) { setSummaries(data); setError(null); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false); } });

    return () => { cancelled = true; };
  }, [machineId, days]);

  return { summaries, loading, error };
}
