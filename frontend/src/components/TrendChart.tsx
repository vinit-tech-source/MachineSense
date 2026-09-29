import { useRef, useEffect, useMemo } from 'react';
import type { HistoricalPoint } from '../types';
import { signalColor } from './SensorReadoutGrid';
import { formatSignalLabel } from '../utils/format';

type SignalKey = 'current_a' | 'voltage_v' | 'vibration_mm_s' | 'temp_c' | 'rpm' | 'power_w';

interface Props {
  readings: HistoricalPoint[];
  signal: SignalKey;
  height?: number;
  showGrid?: boolean;
}

/**
 * Pure canvas-based sparkline/trend chart.
 * No external charting library required.
 * Renders the selected signal over time.
 */
export function TrendChart({ readings, signal, height = 160, showGrid = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const color = signalColor(signal);

  const values = useMemo(() =>
    (readings || []).map(r => signal === 'power_w' ? r.power_w : (r as unknown as Record<string, number>)[signal])
  , [readings, signal]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || values.length < 2) return;

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

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const toX = (i: number) => PAD.left + (i / (values.length - 1)) * plotW;
    const toY = (v: number) => PAD.top + plotH - ((v - min) / range) * plotH;

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
        const val = max - (i / gridLines) * range;
        ctx.fillStyle = 'rgba(85, 98, 111, 0.9)';
        ctx.font = `9px "JetBrains Mono", monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(val.toFixed(1), PAD.left - 6, y + 3);
      }
    }

    // X-axis time labels
    if (readings && readings.length > 0) {
      ctx.fillStyle = 'rgba(85, 98, 111, 0.9)';
      ctx.font = `9px Inter, sans-serif`;
      ctx.textAlign = 'center';
      [0, Math.floor(readings.length / 2), readings.length - 1].forEach(i => {
        if (!readings[i]) return;
        const label = new Date(readings[i].timestamp).toLocaleTimeString('en-IN', {
          hour: '2-digit', minute: '2-digit',
        });
        ctx.fillText(label, toX(i), H - 8);
      });
    }

    // Area fill
    const gradient = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + plotH);
    gradient.addColorStop(0, `${color}30`);
    gradient.addColorStop(1, `${color}00`);

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(values[0]));
    for (let i = 1; i < values.length; i++) {
      ctx.lineTo(toX(i), toY(values[i]));
    }
    ctx.lineTo(toX(values.length - 1), PAD.top + plotH);
    ctx.lineTo(toX(0), PAD.top + plotH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(values[0]));
    for (let i = 1; i < values.length; i++) {
      ctx.lineTo(toX(i), toY(values[i]));
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Latest value dot
    const lastX = toX(values.length - 1);
    const lastY = toY(values[values.length - 1]);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

  }, [values, readings, signal, height, showGrid, color]);

  const label = formatSignalLabel(signal);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {values.length < 2 ? (
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
          aria-label={`${label} trend chart`}
          role="img"
          style={{ display: 'block', width: '100%', height }}
        />
      )}
    </div>
  );
}
