import { useRef, useEffect } from 'react';
import type { HistoricalPoint } from '../types';
import { signalColor } from './SensorReadoutGrid';

type SignalKey = 'current_a' | 'voltage_v' | 'vibration_mm_s' | 'temp_c' | 'rpm' | 'power_w';

interface Props {
  readings: HistoricalPoint[];
  signals: SignalKey[];
  height?: number;
  showGrid?: boolean;
}

/**
 * Pure canvas-based sparkline/trend chart.
 * Renders multiple signals over time. If multiple signals are selected,
 * normalizes them to 0-100% scale for correlation visualization.
 */
export function TrendChart({ readings, signals = [], height = 160, showGrid = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !readings || readings.length < 2 || signals.length === 0) return;

    // Handle window resize dynamically
    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const W = container.clientWidth;
      const H = height;

      canvas.width  = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width  = `${W}px`;
      canvas.style.height = `${H}px`;

      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, W, H);

      const PAD = { top: 12, right: 8, bottom: 28, left: 48 };
      const plotW = W - PAD.left - PAD.right;
      const plotH = H - PAD.top - PAD.bottom;

      const isMulti = signals.length > 1;

      // Extract values and min/max for each signal
      const signalData = signals.map(sig => {
        const vals = readings.map(r => sig === 'power_w' ? r.power_w : (r as unknown as Record<string, number>)[sig]);
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const range = max - min || 1;
        return { sig, vals, min, max, range, color: signalColor(sig) };
      });

      const toX = (i: number) => PAD.left + (i / (readings.length - 1)) * plotW;
      
      // Grid lines
      if (showGrid) {
        ctx.strokeStyle = 'rgba(42, 51, 64, 0.8)';
        ctx.lineWidth = 1;
        const gridLines = 4;
        for (let i = 0; i <= gridLines; i++) {
          const y = PAD.top + (i / gridLines) * plotH;
          ctx.beginPath();
          ctx.moveTo(PAD.left, y);
          ctx.lineTo(PAD.left + plotW, y);
          ctx.stroke();

          // Y-axis labels
          ctx.fillStyle = 'rgba(85, 98, 111, 0.9)';
          ctx.font = `9px "Space Mono", monospace`;
          ctx.textAlign = 'right';
          
          if (isMulti) {
            // Show percentage 0-100 for normalized chart
            const val = 100 - (i / gridLines) * 100;
            ctx.fillText(`${val.toFixed(0)}%`, PAD.left - 6, y + 3);
          } else {
            // Show real values for single signal
            const { max, range } = signalData[0];
            const val = max - (i / gridLines) * range;
            ctx.fillText(val.toFixed(1), PAD.left - 6, y + 3);
          }
        }
      }

      // X-axis time labels
      if (readings.length > 0) {
        ctx.fillStyle = 'rgba(85, 98, 111, 0.9)';
        ctx.font = `9px "Outfit", sans-serif`;
        ctx.textAlign = 'center';
        [0, Math.floor(readings.length / 2), readings.length - 1].forEach(i => {
          if (!readings[i]) return;
          const label = new Date(readings[i].timestamp).toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit',
          });
          ctx.fillText(label, toX(i), H - 8);
        });
      }

      // Draw each signal
      signalData.forEach((data, sIdx) => {
        const { vals, min, range, color } = data;
        // If multi, normalize to 0-1, else use real min/max
        const toY = (v: number) => {
          if (isMulti) {
            const norm = (v - min) / range;
            return PAD.top + plotH - norm * plotH;
          } else {
            return PAD.top + plotH - ((v - min) / range) * plotH;
          }
        };

        // Area fill (only if single signal or first signal in multi)
        if (sIdx === 0) {
          const gradient = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + plotH);
          gradient.addColorStop(0, `${color}30`);
          gradient.addColorStop(1, `${color}00`);

          ctx.beginPath();
          ctx.moveTo(toX(0), toY(vals[0]));
          for (let i = 1; i < vals.length; i++) {
            ctx.lineTo(toX(i), toY(vals[i]));
          }
          ctx.lineTo(toX(vals.length - 1), PAD.top + plotH);
          ctx.lineTo(toX(0), PAD.top + plotH);
          ctx.closePath();
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        // Line
        ctx.beginPath();
        ctx.moveTo(toX(0), toY(vals[0]));
        for (let i = 1; i < vals.length; i++) {
          ctx.lineTo(toX(i), toY(vals[i]));
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = isMulti ? 2 : 1.5;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Latest value dot
        const lastX = toX(vals.length - 1);
        const lastY = toY(vals[vals.length - 1]);
        ctx.beginPath();
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [readings, signals, height, showGrid]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {!readings || readings.length < 2 ? (
        <div
          style={{
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)',
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          Waiting for data...
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          aria-label="Trend chart"
          role="img"
          style={{ display: 'block', width: '100%', height }}
        />
      )}
    </div>
  );
}
