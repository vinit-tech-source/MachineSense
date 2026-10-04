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
        let min = Math.min(...vals);
        let max = Math.max(...vals);
        
        // Add artificial padding to Y-axis so small noise doesn't look like huge spikes
        const dataRange = max - min || 1;
        min = Math.max(0, min - dataRange * 0.5); // Floor at 0 for physical values
        max = max + dataRange * 0.5;
        const range = max - min;
        
        return { sig, vals, min, max, range, color: signalColor(sig) };
      });

      const toX = (i: number) => PAD.left + (i / (readings.length - 1)) * plotW;
      
      // Grid lines
      if (showGrid) {
        ctx.strokeStyle = 'rgba(42, 51, 64, 0.4)';
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
            const val = 100 - (i / gridLines) * 100;
            ctx.fillText(`${val.toFixed(0)}%`, PAD.left - 6, y + 3);
          } else {
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
        const { vals, min, max, range, color } = data;
        
        const toY = (v: number) => {
          if (isMulti) {
            const norm = (v - min) / range;
            return PAD.top + plotH - norm * plotH;
          } else {
            return PAD.top + plotH - ((v - min) / range) * plotH;
          }
        };

        // Draw Warning Zone (top 20% of the chart) for single signals
        if (!isMulti && sIdx === 0) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.05)'; // Very faint red
          ctx.fillRect(PAD.left, PAD.top, plotW, plotH * 0.25);
          
          // Danger threshold line
          ctx.beginPath();
          ctx.setLineDash([4, 4]);
          ctx.moveTo(PAD.left, PAD.top + plotH * 0.25);
          ctx.lineTo(PAD.left + plotW, PAD.top + plotH * 0.25);
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.stroke();
          ctx.setLineDash([]);
          
          ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
          ctx.textAlign = 'left';
          ctx.fillText('CRITICAL THRESHOLD', PAD.left + 4, PAD.top + plotH * 0.25 - 4);
        }

        // Area fill
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

        // Latest value dot and text label
        const lastVal = vals[vals.length - 1];
        const lastX = toX(vals.length - 1);
        const lastY = toY(lastVal);
        
        ctx.beginPath();
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        
        // Draw the exact value for clarity
        if (!isMulti) {
          ctx.fillStyle = color;
          ctx.font = `bold 11px "Space Mono", monospace`;
          ctx.textAlign = 'right';
          // Draw a small background pill for the text
          const text = lastVal.toFixed(1);
          const tw = ctx.measureText(text).width;
          ctx.fillStyle = 'var(--bg-card)';
          ctx.fillRect(lastX - tw - 12, lastY - 14, tw + 8, 16);
          ctx.fillStyle = color;
          ctx.fillText(text, lastX - 8, lastY - 2);
        }
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
