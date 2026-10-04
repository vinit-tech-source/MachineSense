import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export function EngineLoader({ children }: { children: React.ReactNode }) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // YieldWatt's bootstrapPlant takes ~1s and runs synchronously on import.
    // We defer the import so the browser can paint this loading screen first.
    const timer = setTimeout(() => {
      import('../lib/yieldwatt/store').then((mod) => {
        // Start the global tick loop
        setInterval(() => {
          mod.usePlant.getState().tick();
        }, 1600);
        setLoaded(true);
      }).catch(err => {
        console.error("Failed to load ML engine:", err);
      });
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  if (!loaded) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-base)', color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)', gap: '16px'
      }}>
        <Loader2 size={48} className="spin" style={{ color: 'var(--cyan)' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Training ML Models...</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Bootstrapping synthetic history for 5 machines. Please wait.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
