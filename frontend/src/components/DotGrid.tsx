'use client';

import { useEffect, useRef, useCallback } from 'react';

const DOT_SPACING = 24;
const DOT_RADIUS = 1.5;
const BASE_OPACITY = 0.18;
const GLOW_RADIUS = 200;
const GLOW_OPACITY = 0.7;

export default function DotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef<number>(0);
  const dprRef = useRef(1);
  const needsRedraw = useRef(true);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (needsRedraw.current) {
      needsRedraw.current = false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = dprRef.current;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // White base
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const cols = Math.ceil(w / DOT_SPACING) + 1;
      const rows = Math.ceil(h / DOT_SPACING) + 1;

      const offsetX = (w % DOT_SPACING) / 2;
      const offsetY = (h % DOT_SPACING) / 2;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = offsetX + c * DOT_SPACING;
          const y = offsetY + r * DOT_SPACING;

          const dx = x - mx;
          const dy = y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let opacity = BASE_OPACITY;
          if (dist < GLOW_RADIUS) {
            const t = 1 - dist / GLOW_RADIUS;
            const easedT = t * t * (3 - 2 * t);
            opacity = BASE_OPACITY + (GLOW_OPACITY - BASE_OPACITY) * easedT;
          }

          ctx.beginPath();
          ctx.arc(x * dpr, y * dpr, DOT_RADIUS * dpr, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(15, 23, 42, ${opacity})`;
          ctx.fill();
        }
      }
    }

    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      needsRedraw.current = true;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      needsRedraw.current = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
      needsRedraw.current = true;
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
