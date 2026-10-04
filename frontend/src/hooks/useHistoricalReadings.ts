import { useState, useEffect } from 'react';
import type { HistoricalPoint, SensorReading } from '../types';
import { getHistoricalReadings } from '../api/client';

/** Polls historical readings on an interval for the trend chart and appends live data */
export function useHistoricalReadings(machineId: string, hours: number = 1, liveReading?: SensorReading | null) {
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

  // Append live readings smoothly so the chart doesn't 'stop' for 15 seconds
  useEffect(() => {
    if (liveReading) {
      setReadings(prev => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (new Date(liveReading.timestamp).getTime() <= new Date(last.timestamp).getTime()) {
          return prev;
        }
        
        const newPoint: HistoricalPoint = {
          timestamp: liveReading.timestamp,
          current_a: liveReading.current_a,
          voltage_v: liveReading.voltage_v,
          vibration_mm_s: liveReading.vibration_mm_s,
          temp_c: liveReading.temp_c,
          rpm: liveReading.rpm,
          power_w: liveReading.current_a * liveReading.voltage_v,
          status: liveReading.status as any,
          operating_state: 'running' as any
        };
        
        // Remove the oldest point and add the new one
        return [...prev.slice(1), newPoint];
      });
    }
  }, [liveReading]);

  return { readings, loading };
}
