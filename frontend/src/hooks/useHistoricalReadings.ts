import { useState, useEffect } from 'react';
import type { HistoricalPoint } from '../types';
import { getHistoricalReadings } from '../api/client';

/** Polls historical readings on an interval for the trend chart */
export function useHistoricalReadings(machineId: string, hours: number = 1) {
  const [readings, setReadings] = useState<HistoricalPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const data = await getHistoricalReadings(machineId, hours, 300);
        if (!cancelled) { setReadings(data); setLoading(false); }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    const interval = setInterval(fetch, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [machineId, hours]);

  return { readings, loading };
}
