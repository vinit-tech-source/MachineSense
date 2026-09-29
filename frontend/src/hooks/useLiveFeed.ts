import { useState, useEffect, useRef, useCallback } from 'react';
import type { SensorReading, FeedState } from '../types';
import { createLiveFeed, getLatestReading } from '../api/client';

const STALE_THRESHOLD_S = 10; // seconds before "stale" indicator shows

/**
 * Manages the live WebSocket feed for a machine.
 * Falls back to HTTP polling if WS is unavailable.
 * Never silently freezes: exposes a staleness counter and visible state.
 */
export function useLiveFeed(machineId: string) {
  const [reading, setReading] = useState<SensorReading | null>(null);
  const [feedState, setFeedState] = useState<FeedState>({
    state: 'connecting',
    last_received_at: null,
    seconds_stale: 0,
  });

  const lastReceivedRef = useRef<Date | null>(null);
  const stalenessIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update staleness every second
  useEffect(() => {
    stalenessIntervalRef.current = setInterval(() => {
      if (!lastReceivedRef.current) return;
      const secs = Math.floor((Date.now() - lastReceivedRef.current.getTime()) / 1000);
      setFeedState(prev => ({
        ...prev,
        state: secs > STALE_THRESHOLD_S && prev.state === 'connected' ? 'stale' : prev.state,
        seconds_stale: secs,
      }));
    }, 1000);
    return () => { if (stalenessIntervalRef.current) clearInterval(stalenessIntervalRef.current); };
  }, []);

  const handleMessage = useCallback((data: SensorReading) => {
    lastReceivedRef.current = new Date();
    setReading(data);
    setFeedState(prev => ({
      ...prev,
      state: 'connected',
      last_received_at: new Date().toISOString(),
      seconds_stale: 0,
    }));
  }, []);

  const handleStateChange = useCallback(
    (state: 'connected' | 'connecting' | 'disconnected') => {
      setFeedState(prev => ({ ...prev, state }));
    },
    []
  );

  // Fetch initial reading via HTTP so the dashboard isn't blank on first load
  useEffect(() => {
    getLatestReading(machineId)
      .then(r => {
        setReading(r);
        lastReceivedRef.current = new Date(r.timestamp);
      })
      .catch(() => {
        // No reading yet — acceptable, dashboard shows "waiting for first reading"
      });
  }, [machineId]);

  useEffect(() => {
    const cleanup = createLiveFeed(machineId, handleMessage, handleStateChange);
    return cleanup;
  }, [machineId, handleMessage, handleStateChange]);

  return { reading, feedState };
}
