import React, { useEffect, useRef } from 'react';
import { Terrain } from '../../data/countries';
import { Unit } from '../../data/content';
import { Battle, Tactic } from '../../engine/state';
import { Particles } from '../../fx/particles';
import { sound } from '../../utils/audio';

interface Look { sky: [string, string, string]; far: string; near: string; ground: [string, string]; weather: '' | 'snow' | 'sand' | 'rain' }
const LOOK: Record<Terrain, Look> = {
  planicie: { sky: ['#31506f', '#c98f5f', '#f3c98b'], far: '#5d5a4c', near: '#4b4a2d', ground: ['#6b6336', '#2d2a17'], weather: '' },
  montanha: { sky: ['#2c3c50', '#7f8fa0', '#cfd6dc'], far: '#5a6672', near: '#434b52', ground: ['#5c5a52', '#26241f'], weather: 'rain' },
  deserto: { sky: ['#5f7fa1', '#e3b577', '#f8deb0'], far: '#b18b5c', near: '#9c7442', ground: ['#c19a5c', '#6b4a23'], weather: 'sand' },
  selva: { sky: ['#2a4450', '#64826f', '#b7c39b'], far: '#2f4a3a', near: '#213a24', ground: ['#3d4a22', '#141c0c'], weather: 'rain' },
  frio: { sky: ['#5b7288', '#a9bccb', '#e8eef2'], far: '#8ba0af', near: '#74858f', ground: ['#dfe6ea', '#7f929f'], weather: 'snow' },
};
const W = 900;
const H = 380;
const HORIZON = 0.46;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

interface Fighter { kind: Unit; side: 1 | -1; x: number; depth: number; phase: number; fire: number; dead: number }

/** Campo de batalha: tropas, tiros, explosões, clima e destroços. */
export const BattleScene: React.FC<{ battle: Battle; terrain: Terrain; boss: boolean }> = ({ battle, terrain, boss }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ a: 1, d: 1, round: 1, done: '' as Battle['done'], tactic: '' as Tactic | '' });
  live.current = { a: battle.a / battle.a0, d: battle.d / battle.d0, round: battle.round, done: battle.done, tactic: battle.last ?? '' };

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const look = LOOK[terrain];
    const bg = backdrop(look);
    const fx = new Particles();
    const mine = (Object.keys(battle.army) as Unit[]).filter((u) => battle.army[u] > 0);
    const army = [...squad(mine.length ? mine : ['inf'], 1), ...(boss ? [] : squad(['inf', 'inf', 'tank', 'air'], -1))];
    const flakes = Array.from({ length: look.weather ? 90 : 0 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: rnd(0.5, 1.4) }));
    const wrecks: { x: number; y: number; s: number }[] = [];
    let raf = 0;
    let last = performance.now();
    let shake = 0;
    let round = live.current.round;
    let surge = 0;
    let roar = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const st = live.current;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const cw = Math.round(canvas.clientWidth * dpr);
      const ch = Math.round(canvas.clientHeight * dpr);
      if (!cw || !ch) return;
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      const k = Math.max(cw / W, ch / H);
      if (st.round !== round || (st.done && surge >= 0 && round >= 0)) {
        round = st.done ? -1 : st.round;
        surge = 1;
        shake = 1;
        sound.playGuns();
        for (let i = 0; i < (st.tactic === 'flanquear' ? 9 : 6); i++) setTimeout(() => fx.explode(rnd(W * 0.45, W * 0.92), rnd(H * 0.55, H * 0.88), rnd(14, 26)), i * 110);
        for (let i = 0; i < 4; i++) setTimeout(() => fx.explode(rnd(W * 0.08, W * 0.5), rnd(H * 0.58, H * 0.9), rnd(10, 20)), 80 + i * 140);
      }
      surge = Math.max(0, surge - dt * 0.8);
      shake *= Math.exp(-5 * dt);
      ctx.setTransform(k, 0, 0, k, (cw - W * k) / 2 + rnd(-1, 1) * shake * 8 * k, (ch - H * k) / 2 + rnd(-1, 1) * shake * 6 * k);
      ctx.drawImage(bg, -20, -10, W + 40, H + 20);

      // Baixas acompanham a força restante
      for (const side of [1, -1] as const) {
        const team = army.filter((f) => f.side === side);
        const alive = Math.ceil(team.length * (side === 1 ? st.a : st.d));
        let standing = team.filter((f) => !f.dead).length;
        for (const f of team) {
          if (f.dead || standing <= alive) continue;
          standing--;
          f.dead = 1;
          const p = spot(f, t, surge, st.tactic);
          fx.explode(p.x, p.y, f.kind === 'inf' ? 7 : 20);
          if (f.kind === 'tank' || f.kind === 'navy') wrecks.push({ x: p.x, y: p.y, s: p.s });
        }
      }
      for (const w of wrecks) {
        ctx.fillStyle = 'rgba(12,10,9,.9)';
        ctx.beginPath();
        ctx.ellipse(w.x, w.y, 24 * w.s, 8 * w.s, 0, 0, 6.28);
        ctx.fill();
        if (Math.random() < 0.35) fx.add({ kind: 'smoke', x: w.x + rnd(-6, 6), y: w.y - 6, vx: rnd(2, 12), vy: rnd(-34, -20), drag: 0.3, life: rnd(1.4, 2.6), size: 7, grow: 12, shade: 0 });
        if (Math.random() < 0.4) fx.add({ kind: 'fire', x: w.x + rnd(-8, 8), y: w.y - 4, vy: rnd(-26, -12), life: rnd(0.25, 0.5), size: rnd(5, 10), grow: -6 });
      }

      army.sort((p, q) => p.depth - q.depth);
      for (const f of army) {
        if (f.dead) continue;
        const p = spot(f, t, surge, st.tactic);
        f.fire -= dt;
        const shoot = f.fire <= 0;
        if (shoot) f.fire = rnd(0.25, f.kind === 'inf' ? 1.4 : 2.4) * (surge > 0.2 ? 0.45 : 1) * (st.done ? 3 : 1);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(p.s * f.side, p.s);
        if (f.kind === 'inf') soldier(ctx, t * 7 + f.phase, surge > 0.1, f.side === 1);
        else if (f.kind === 'tank') tankSide(ctx, f.side === 1, shoot);
        else if (f.kind === 'navy') shipSide(ctx);
        else jetSide(ctx, f.side === 1);
        ctx.restore();
        if (f.kind === 'tank' && Math.random() < 0.3) fx.add({ kind: 'dust', x: p.x - 26 * p.s * f.side, y: p.y, vx: -f.side * 18, vy: -6, drag: 1, life: 0.9, size: 6 * p.s, grow: 14 });
        if (f.kind === 'air') fx.add({ kind: 'smoke', x: p.x - 34 * p.s * f.side, y: p.y, life: 0.7, size: 2, grow: 5, shade: 2 });
        if (!shoot || st.done) continue;
        const mx = p.x + f.side * (f.kind === 'tank' ? 50 : 13) * p.s;
        const my = p.y - (f.kind === 'tank' ? 20 : f.kind === 'inf' ? 13 : 0) * p.s;
        fx.add({ kind: 'glow', x: mx, y: my, life: 0.09, size: (f.kind === 'inf' ? 7 : 24) * p.s, spin: 0 });
        fx.add({ kind: 'spark', x: mx, y: my, vx: f.side * rnd(700, 1000), vy: rnd(-50, 40), drag: 0, life: rnd(0.25, 0.45), size: f.kind === 'inf' ? 1.2 : 2.4 });
        if (f.kind !== 'inf' && Math.random() < 0.6) {
          const ex = f.side === 1 ? rnd(W * 0.6, W * 0.95) : rnd(W * 0.05, W * 0.4);
          setTimeout(() => fx.explode(ex, rnd(H * 0.6, H * 0.9), rnd(8, 15)), 260);
          shake = Math.max(shake, 0.18);
        }
      }
      if (boss) drawBoss(ctx, t, st.d, surge, fx);

      fx.step(dt);
      fx.draw(ctx);
      weather(ctx, look, flakes, dt);
      // Névoa e vinheta de cinema
      const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,.6)');
      ctx.fillStyle = v;
      ctx.fillRect(-20, -20, W + 40, H + 40);
      roar -= dt;
      if (!st.done && roar <= 0) {
        roar = rnd(1.5, 3);
        sound.playGuns(0.35);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // A cena é montada uma vez por batalha; o estado vivo chega por `live`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terrain, boss]);

  return <canvas ref={ref} className="battlefield block w-full" aria-label="Campo de batalha" />;
};

function squad(kinds: Unit[], side: 1 | -1): Fighter[] {
  const list: Fighter[] = [];
  const put = (kind: Unit, n: number) => {
    for (let i = 0; i < n; i++) list.push({ kind, side, x: Math.random(), depth: kind === 'air' ? Math.random() * 0.3 : kind === 'navy' ? 0.05 : 0.1 + Math.random() * 0.9, phase: Math.random() * 9, fire: Math.random() * 2, dead: 0 });
  };
  if (kinds.includes('inf')) put('inf', 16);
  if (kinds.includes('tank')) put('tank', 4);
  if (kinds.includes('air')) put('air', 3);
  if (kinds.includes('navy')) put('navy', 2);
  return list;
}
/** Posição na tela, com perspectiva e movimento da tática */
function spot(f: Fighter, t: number, surge: number, tactic: string) {
  const s = 0.6 + f.depth * 0.75;
  const push = f.side === 1 ? (tactic === 'atrair' ? -60 : tactic === 'avancar' ? 130 : 70) : 60;
  const edge = f.x * 300 + Math.sin(surge * Math.PI) * push;
  if (f.kind === 'air') {
    const p = ((t * 0.16 + f.phase * 0.21) % 1) * (W + 300) - 150;
    return { x: f.side === 1 ? p : W - p, y: 40 + f.depth * 190 + Math.sin(t + f.phase) * 8, s };
  }
  const y = H * (HORIZON + 0.06) + f.depth * H * 0.44;
  return { x: f.side === 1 ? 20 + edge : W - 20 - edge, y, s };
}

// ===== Cenário =====
function backdrop(look: Look) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const hy = H * HORIZON;
  const sky = ctx.createLinearGradient(0, 0, 0, hy);
  look.sky.forEach((s, i) => sky.addColorStop(i / 2, s));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, hy + 4);
  const sun = ctx.createRadialGradient(W * 0.68, hy * 0.75, 0, W * 0.68, hy * 0.75, 260);
  sun.addColorStop(0, 'rgba(255,238,200,.9)');
  sun.addColorStop(0.15, 'rgba(255,214,150,.45)');
  sun.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, hy);
  // Nuvens de fumaça no horizonte
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * W;
    const y = rnd(10, hy * 0.9);
    const r = rnd(20, 90);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${Math.random() < 0.5 ? '50,46,44' : '235,222,205'},.07)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const ridge = (color: string, base: number, amp: number, seed: number) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) {
      const n = Math.sin(x * 0.008 + seed) + Math.sin(x * 0.021 + seed * 2) * 0.5 + Math.sin(x * 0.063 + seed * 5) * 0.2 + Math.random() * 0.06;
      ctx.lineTo(x, base - (n + 1) * amp);
    }
    ctx.lineTo(W, H);
    ctx.fill();
  };
  ctx.globalAlpha = 0.55;
  ridge(look.far, hy, 22, 1.3);
  ctx.globalAlpha = 0.9;
  ridge(look.near, hy + 6, 11, 4.2);
  ctx.globalAlpha = 1;
  // Ruínas ao longe
  ctx.fillStyle = 'rgba(25,22,20,.75)';
  for (let i = 0; i < 26; i++) {
    const x = rnd(0, W);
    const w = rnd(8, 22);
    const h = rnd(4, 20);
    ctx.beginPath();
    ctx.moveTo(x, hy + 8);
    ctx.lineTo(x, hy + 8 - h);
    ctx.lineTo(x + w * 0.4, hy + 8 - h * rnd(0.6, 1));
    ctx.lineTo(x + w * 0.6, hy + 8 - h * rnd(0.3, 0.8));
    ctx.lineTo(x + w, hy + 8 - h * rnd(0.5, 1));
    ctx.lineTo(x + w, hy + 8);
    ctx.fill();
  }
  const ground = ctx.createLinearGradient(0, hy, 0, H);
  ground.addColorStop(0, look.ground[0]);
  ground.addColorStop(1, look.ground[1]);
  ctx.fillStyle = ground;
  ctx.fillRect(0, hy + 6, W, H);
  // Textura do solo em perspectiva
  for (let i = 0; i < 5200; i++) {
    const d = Math.random() ** 1.6;
    const y = hy + 8 + d * (H - hy);
    ctx.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${0.04 + d * 0.12})` : `rgba(255,240,210,${0.02 + d * 0.06})`;
    ctx.fillRect(Math.random() * W, y, 1 + d * 7, 0.6 + d * 1.6);
  }
  // Manchas de lama e vegetação
  for (let i = 0; i < 260; i++) {
    const d = Math.random();
    const x = Math.random() * W;
    const y = hy + 10 + d * (H - hy);
    const r = 12 + d * 60;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.2);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, i % 3 ? 'rgba(18,13,8,.2)' : 'rgba(255,236,196,.09)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }
  ctx.lineWidth = 1;
  for (let i = 0; i < 900; i++) {
    const d = Math.random() ** 0.7;
    const x = Math.random() * W;
    const y = hy + 14 + d * (H - hy);
    ctx.strokeStyle = Math.random() < 0.6 ? 'rgba(10,9,5,.35)' : 'rgba(235,220,170,.16)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + rnd(-3, 3) * d, y - rnd(2, 10) * d);
    ctx.stroke();
  }
  // Névoa no horizonte
  const haze = ctx.createLinearGradient(0, hy - 40, 0, hy + 60);
  haze.addColorStop(0, 'rgba(225,205,175,0)');
  haze.addColorStop(0.45, 'rgba(225,205,175,.5)');
  haze.addColorStop(1, 'rgba(225,205,175,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, hy - 40, W, 100);
  // Crateras
  for (let i = 0; i < 13; i++) {
    const d = Math.random();
    const x = Math.random() * W;
    const y = hy + 22 + d * (H - hy - 30);
    const r = 6 + d * 30;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(10,8,6,.75)');
    g.addColorStop(0.7, 'rgba(20,16,12,.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(0, y * 0.68);
    ctx.scale(1, 0.32);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
  return c;
}
function weather(ctx: CanvasRenderingContext2D, look: Look, list: { x: number; y: number; v: number }[], dt: number) {
  if (!look.weather) return;
  const [vx, vy] = look.weather === 'snow' ? [-40, 60] : look.weather === 'rain' ? [-90, 620] : [-420, 25];
  ctx.strokeStyle = look.weather === 'snow' ? 'rgba(255,255,255,.75)' : look.weather === 'rain' ? 'rgba(200,220,240,.3)' : 'rgba(240,205,150,.3)';
  ctx.lineWidth = look.weather === 'snow' ? 2.2 : 1;
  ctx.beginPath();
  for (const f of list) {
    f.x = (f.x + vx * f.v * dt + W) % W;
    f.y = (f.y + vy * f.v * dt) % H;
    ctx.moveTo(f.x, f.y);
    ctx.lineTo(f.x - vx * 0.02 - 0.8, f.y - vy * 0.02 - 0.8);
  }
  ctx.stroke();
}

// ===== Tropas de perfil =====
const shade = (ctx: CanvasRenderingContext2D, top: number, bottom: number, a: string, b: string) => {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
};
function shadow(ctx: CanvasRenderingContext2D, r: number) {
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath();
  ctx.ellipse(0, 1, r, r * 0.22, 0, 0, 6.283);
  ctx.fill();
}
function soldier(ctx: CanvasRenderingContext2D, step: number, run: boolean, mine: boolean) {
  shadow(ctx, 8);
  const swing = Math.sin(step) * (run ? 6 : 2.5);
  const coat = mine ? '#5b6b3f' : '#6b5a45';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#26241c';
  ctx.lineWidth = 3;
  for (const s of [1, -1]) {
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(swing * s * 0.6 + 1, -4.5);
    ctx.lineTo(swing * s, 0);
    ctx.stroke();
  }
  ctx.strokeStyle = coat;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(1.5, -17);
  ctx.stroke();
  ctx.fillStyle = '#2d2b20';
  ctx.fillRect(-4.5, -18, 3.5, 7);
  ctx.strokeStyle = coat;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(1, -16);
  ctx.lineTo(6, -13);
  ctx.stroke();
  ctx.strokeStyle = '#151515';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(2, -13.5);
  ctx.lineTo(13, -14.5);
  ctx.stroke();
  ctx.fillStyle = '#b98b66';
  ctx.beginPath();
  ctx.arc(2, -20.5, 2.5, 0, 6.283);
  ctx.fill();
  ctx.fillStyle = mine ? '#46512f' : '#51432f';
  ctx.beginPath();
  ctx.arc(1.8, -21.4, 3.3, Math.PI * 0.95, 0.15);
  ctx.fill();
}
function tankSide(ctx: CanvasRenderingContext2D, mine: boolean, recoil: boolean) {
  shadow(ctx, 36);
  const a = mine ? '#8a8b5c' : '#96815c';
  const b = mine ? '#3b3d24' : '#443723';
  ctx.fillStyle = '#17150f';
  ctx.beginPath();
  ctx.roundRect(-33, -12, 66, 13, 6);
  ctx.fill();
  for (let i = -26; i <= 26; i += 10.4) {
    ctx.fillStyle = '#3f3c30';
    ctx.beginPath();
    ctx.arc(i, -5, 4.4, 0, 6.283);
    ctx.fill();
    ctx.fillStyle = '#14120d';
    ctx.beginPath();
    ctx.arc(i, -5, 1.6, 0, 6.283);
    ctx.fill();
  }
  ctx.fillStyle = shade(ctx, -20, -9, a, b);
  ctx.beginPath();
  ctx.moveTo(-35, -11);
  ctx.lineTo(-31, -19);
  ctx.lineTo(24, -19);
  ctx.lineTo(37, -11);
  ctx.fill();
  ctx.fillStyle = shade(ctx, -23, -19, '#6f6c4d', '#24221a');
  ctx.fillRect(recoil ? 6 : 10, -24, 44, 3.2);
  ctx.fillRect(recoil ? 38 : 42, -24.8, 7, 4.8);
  ctx.fillStyle = shade(ctx, -30, -18, a, b);
  ctx.beginPath();
  ctx.moveTo(-20, -19);
  ctx.lineTo(-15, -29);
  ctx.lineTo(8, -29);
  ctx.lineTo(18, -19);
  ctx.fill();
  ctx.fillStyle = '#25231a';
  ctx.fillRect(-9, -32, 10, 3);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-14, -29);
  ctx.lineTo(-17, -46);
  ctx.stroke();
}
function shipSide(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = shade(ctx, -26, 0, '#9aa7b3', '#374151');
  ctx.beginPath();
  ctx.moveTo(-60, -10);
  ctx.lineTo(66, -13);
  ctx.lineTo(54, 2);
  ctx.lineTo(-54, 2);
  ctx.fill();
  ctx.fillRect(-26, -22, 40, 12);
  ctx.fillRect(-14, -31, 18, 10);
  ctx.fillRect(22, -17, 26, 3);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(-6, -46, 2, 16);
}
function jetSide(ctx: CanvasRenderingContext2D, mine: boolean) {
  ctx.fillStyle = shade(ctx, -8, 8, mine ? '#dbe3ea' : '#b9ab97', mine ? '#4b5563' : '#463b2c');
  ctx.beginPath();
  ctx.moveTo(42, 1);
  ctx.quadraticCurveTo(22, -6, 0, -6);
  ctx.lineTo(-18, -5);
  ctx.lineTo(-30, -17);
  ctx.lineTo(-36, -17);
  ctx.lineTo(-31, 0);
  ctx.lineTo(-34, 5);
  ctx.lineTo(0, 6);
  ctx.quadraticCurveTo(24, 6, 42, 1);
  ctx.fill();
  ctx.fillStyle = '#1b2530';
  ctx.beginPath();
  ctx.ellipse(16, -4.5, 8, 3, 0.1, 0, 6.283);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(6, 2);
  ctx.lineTo(-18, 12);
  ctx.lineTo(-24, 11);
  ctx.lineTo(-10, 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(-38, 1, 0, -38, 1, 14);
  g.addColorStop(0, 'rgba(255,220,150,.95)');
  g.addColorStop(1, 'rgba(255,90,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-54, -13, 30, 28);
  ctx.globalCompositeOperation = 'source-over';
}
/** Titã semanal: dragossauro blindado que cospe fogo */
function drawBoss(ctx: CanvasRenderingContext2D, t: number, hp: number, surge: number, fx: Particles) {
  const x = W * 0.74 - Math.sin(surge * Math.PI) * 60;
  const y = H * 0.86 + (1 - hp) * 20;
  const b = Math.sin(t * 2.2) * 3;
  ctx.save();
  ctx.translate(x, y + b);
  ctx.scale(-1.5, 1.5);
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 92, 12, 0, 0, 6.283);
  ctx.fill();
  ctx.fillStyle = shade(ctx, -150, 0, '#4d5a44', '#12160f');
  ctx.beginPath();
  ctx.moveTo(-120, -20);
  ctx.quadraticCurveTo(-70, -40, -48, -78);
  ctx.quadraticCurveTo(-20, -124, 34, -118);
  ctx.quadraticCurveTo(58, -142, 88, -132);
  ctx.lineTo(112, -116);
  ctx.lineTo(90, -110);
  ctx.lineTo(108, -102);
  ctx.quadraticCurveTo(76, -94, 62, -96);
  ctx.quadraticCurveTo(52, -60, 42, -40);
  ctx.lineTo(50, 2);
  ctx.lineTo(16, 2);
  ctx.lineTo(8, -32);
  ctx.lineTo(-26, -32);
  ctx.lineTo(-24, 2);
  ctx.lineTo(-58, 2);
  ctx.quadraticCurveTo(-60, -30, -120, -20);
  ctx.fill();
  ctx.fillStyle = '#20281b';
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    const px = -62 + i * 13;
    const py = -72 - Math.sin((i / 8) * Math.PI) * 46;
    ctx.moveTo(px, py + 8);
    ctx.lineTo(px + 2, py - 16);
    ctx.lineTo(px + 12, py + 4);
    ctx.fill();
  }
  ctx.fillStyle = '#ffb020';
  ctx.shadowColor = '#ff6a00';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(80, -122, 3, 0, 6.283);
  ctx.fill();
  ctx.restore();
  if (surge > 0.15) for (let i = 0; i < 5; i++) fx.add({ kind: 'fire', x: x - 160, y: y - 158 + b, vx: rnd(-520, -320), vy: rnd(80, 220), drag: 0.8, life: rnd(0.4, 0.8), size: rnd(8, 16), grow: 34 });
}
