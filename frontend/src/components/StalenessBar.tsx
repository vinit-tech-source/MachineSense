import type { FeedState } from '../types';
import { WifiOff, Clock } from 'lucide-react';

interface Props {
  feedState: FeedState;
  lastReadingTime: string | null;
}

/**
 * Displayed when the data feed is stale or disconnected.
 * Per requirement: must never silently freeze. Always visible when feed drops.
 */
export function StalenessBar({ feedState, lastReadingTime }: Props) {
  const { state, seconds_stale } = feedState;

  if (state === 'connected') return null;

  const isDisconnected = state === 'disconnected';
  const lastTime = lastReadingTime
    ? new Date(lastReadingTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'unknown';

  return (
    <div
      className="staleness-bar"
      role="alert"
      aria-live="polite"
      aria-label={
        isDisconnected
          ? 'Data feed disconnected. Showing last known reading.'
          : `Data feed stale for ${seconds_stale} seconds. Showing last known reading.`
      }
    >
      {isDisconnected
        ? <WifiOff size={14} strokeWidth={1.5} />
        : <Clock size={14} strokeWidth={1.5} />
      }
      <span>
        {isDisconnected
          ? 'Feed disconnected.'
          : `Feed stale (${seconds_stale}s).`}
        {lastReadingTime
          ? ` Showing last known reading from ${lastTime}.`
          : ' Waiting for first reading.'}
        {state === 'connecting' || state === 'disconnected' ? ' Reconnecting...' : ''}
      </span>
    </div>
  );
}
