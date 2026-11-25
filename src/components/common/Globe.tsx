import React, { useEffect, useRef } from 'react';
import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { useWorldGeo } from '../../services/worldGeo';
import { COUNTRIES } from '../../data/countries';

const FRAME_MS = 33;
const STARS = Array.from({ length: 160 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r: 0.4 + Math.random() * 1.3,
  phase: Math.random() * Math.PI * 2,
}));
const CITIES = Object.values(COUNTRIES).filter((c) => c.income >= 20).map((c) => c.anchor);
const GRATICULE = geoGraticule10();

/** Planeta girando com estrelas, atmosfera e luzes de cidades (fundo do menu) */
export const Globe: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  const geo = useWorldGeo();

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const projection = geoOrthographic().clipAngle(90);
    const path = geoPath(projection, ctx);
    let raf = 0;
    let last = -FRAME_MS;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < FRAME_MS) return;
      last = now;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (!w || !h) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const time = still ? 0 : now;
      ctx.clearRect(0, 0, w, h);

      ctx.fillStyle = '#dbeafe';
      for (const s of STARS) {
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time / 700 + s.phase);
        ctx.fillRect(s.x * w, s.y * h, s.r * dpr, s.r * dpr);
      }
      ctx.globalAlpha = 1;

      const cx = w / 2;
      const cy = h * 0.5;
      const R = Math.min(w * 0.62, h * 0.46);
      const spin = 50 + time / 110;
      projection.translate([cx, cy]).scale(R).rotate([spin, -14, 12]);

      const disc = (r: number) => {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      };
      const halo = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.3);
      halo.addColorStop(0, 'rgba(56,189,248,0.5)');
      halo.addColorStop(0.3, 'rgba(37,99,235,0.2)');
      halo.addColorStop(1, 'rgba(37,99,235,0)');
      ctx.fillStyle = halo;
      disc(R * 1.3);
      ctx.fill();

      const sea = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.45, R * 0.1, cx, cy, R);
      sea.addColorStop(0, '#1d5fa8');
      sea.addColorStop(0.6, '#0c2c5c');
      sea.addColorStop(1, '#050f26');
      ctx.fillStyle = sea;
      disc(R);
      ctx.fill();

      ctx.lineWidth = dpr * 0.5;
      ctx.strokeStyle = 'rgba(125,211,252,0.13)';
      ctx.beginPath();
      path(GRATICULE);
      ctx.stroke();

      if (geo) {
        const land = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
        land.addColorStop(0, '#4ade80');
        land.addColorStop(0.5, '#15803d');
        land.addColorStop(1, '#14532d');
        ctx.fillStyle = land;
        ctx.strokeStyle = 'rgba(220,252,231,0.3)';
        ctx.beginPath();
        path(geo);
        ctx.fill();
        ctx.stroke();
      }

      // Sombra do lado noturno
      const night = ctx.createRadialGradient(cx - R * 0.5, cy - R * 0.5, R * 0.3, cx - R * 0.2, cy - R * 0.2, R * 1.35);
      night.addColorStop(0, 'rgba(2,6,23,0)');
      night.addColorStop(1, 'rgba(2,6,23,0.92)');
      ctx.fillStyle = night;
      disc(R);
      ctx.fill();

      const facing: [number, number] = [-spin, 14];
      CITIES.forEach((c, i) => {
        if (geoDistance(c, facing) > 1.45) return;
        const p = projection(c);
        if (!p) return;
        const glow = 0.6 + 0.4 * Math.sin(time / 400 + i);
        ctx.fillStyle = `rgba(253,224,71,${0.25 * glow})`;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 7 * dpr * glow, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef9c3';
        ctx.beginPath();
        ctx.arc(p[0], p[1], 1.6 * dpr, 0, Math.PI * 2);
        ctx.fill();
      });
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [geo]);

  return (
    <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
      <canvas ref={ref} className="w-full h-full" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(5,7,15,0.6),transparent_55%)]" />
    </div>
  );
};
