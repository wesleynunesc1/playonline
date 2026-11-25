/** Partículas com textura: fumaça, fogo, faíscas e detritos. Usadas no mapa e no campo de batalha. */
export type Kind = 'smoke' | 'fire' | 'glow' | 'spark' | 'debris' | 'dust';
export interface Particle {
  kind: Kind; x: number; y: number; vx: number; vy: number; g: number; drag: number;
  life: number; max: number; size: number; grow: number; rot: number; spin: number; shade: number;
  /** Ponto do mapa ao qual a partícula está presa */
  ax?: number; ay?: number;
}

const SPRITE = 128;
function sprite(paint: (ctx: CanvasRenderingContext2D, r: number) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = SPRITE;
  const ctx = c.getContext('2d')!;
  ctx.translate(SPRITE / 2, SPRITE / 2);
  paint(ctx, SPRITE / 2);
  return c;
}
function radial(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stops: [number, string][]) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
/** Nuvem irregular feita de muitos borrões */
const puff = (rgb: string, alpha: number, n = 26) =>
  sprite((ctx, r) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283;
      const d = Math.sqrt(Math.random()) * r * 0.55;
      const s = r * (0.18 + Math.random() * 0.27);
      const x = Math.cos(a) * d;
      const y = Math.sin(a) * d;
      radial(ctx, x, y, s, [[0, `rgba(${rgb},${alpha})`], [1, `rgba(${rgb},0)`]]);
      radial(ctx, x - s * 0.2, y - s * 0.25, s * 0.6, [[0, `rgba(255,245,230,${alpha * 0.3})`], [1, 'rgba(255,245,230,0)']]);
    }
  });

let atlas: { smoke: HTMLCanvasElement[]; dust: HTMLCanvasElement; fire: HTMLCanvasElement[]; glow: HTMLCanvasElement } | null = null;
export function sprites() {
  atlas ??= {
    smoke: [puff('30,28,27', 0.3), puff('82,76,70', 0.2), puff('132,126,118', 0.12)],
    dust: puff('176,150,112', 0.14),
    fire: [
      sprite((ctx, r) => radial(ctx, 0, 0, r, [[0, 'rgba(255,252,220,1)'], [0.25, 'rgba(255,214,96,.95)'], [0.55, 'rgba(255,120,24,.55)'], [1, 'rgba(160,20,0,0)']])),
      puff('255,150,40', 0.28),
      puff('220,70,14', 0.26),
    ],
    glow: sprite((ctx, r) => radial(ctx, 0, 0, r, [[0, 'rgba(255,240,205,1)'], [0.2, 'rgba(255,190,90,.55)'], [1, 'rgba(255,120,20,0)']])),
  };
  return atlas;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const MAX = 900;

export class Particles {
  list: Particle[] = [];

  add(p: Partial<Particle> & { kind: Kind; x: number; y: number }) {
    if (this.list.length >= MAX) return;
    const life = p.life ?? 1;
    this.list.push({ vx: 0, vy: 0, g: 0, drag: 1, max: life, size: 10, grow: 0, rot: Math.random() * 6.28, spin: rnd(-1, 1), shade: Math.floor(Math.random() * 3), ...p, life });
  }

  /** Explosão completa: clarão, bola de fogo, fumaça, faíscas e detritos */
  explode(x: number, y: number, s: number, extra: Partial<Particle> = {}) {
    this.add({ kind: 'glow', x, y, life: 0.2, size: s * 4, grow: s * 5, spin: 0, ...extra });
    const n = Math.min(16, 6 + Math.round(s / 3));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283;
      const v = rnd(0.5, 3) * s;
      this.add({ kind: 'fire', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - s * 0.8, drag: 4, life: rnd(0.35, 0.85), size: s * rnd(0.7, 1.5), grow: s * 1.5, shade: i < 2 ? 0 : 1 + (i % 2), ...extra });
      this.add({ kind: 'smoke', x, y, vx: Math.cos(a) * v * 0.6, vy: Math.sin(a) * v * 0.5 - s * rnd(0.4, 1.3), drag: 1.6, life: rnd(1.1, 2.6), size: s * rnd(0.9, 1.6), grow: s * rnd(1, 2), spin: rnd(-0.6, 0.6), shade: i % 3 === 2 ? 1 : 0, ...extra });
    }
    for (let i = 0; i < n * 1.5; i++) {
      const a = Math.random() * 6.283;
      const v = rnd(3, 9) * s;
      this.add({ kind: i % 3 ? 'spark' : 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - s * 2, g: s * 9, drag: 1.4, life: rnd(0.35, 0.9), size: Math.max(1, s * rnd(0.05, 0.12)), ...extra });
    }
  }

  step(dt: number) {
    const keep: Particle[] = [];
    for (const p of this.list) {
      p.life -= dt;
      if (p.life <= 0) continue;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy = p.vy * d + p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += p.grow * dt;
      p.rot += p.spin * dt;
      keep.push(p);
    }
    this.list = keep;
  }

  /** `place` converte a âncora do mapa em pixels */
  draw(ctx: CanvasRenderingContext2D, place?: (x: number, y: number) => [number, number]) {
    const S = sprites();
    const at = (p: Particle): [number, number] => {
      if (p.ax === undefined || !place) return [p.x, p.y];
      const [x, y] = place(p.ax, p.ay!);
      return [x + p.x, y + p.y];
    };
    const stamp = (img: HTMLCanvasElement, p: Particle, alpha: number) => {
      const [x, y] = at(p);
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.translate(x, y);
      ctx.rotate(p.rot);
      ctx.drawImage(img, -p.size, -p.size, p.size * 2, p.size * 2);
      ctx.rotate(-p.rot);
      ctx.translate(-x, -y);
    };
    for (const p of this.list) {
      const t = p.life / p.max;
      if (p.kind === 'smoke') stamp(S.smoke[p.shade], p, Math.min(1, t * 1.6) * Math.min(1, (1 - t) * 8));
      else if (p.kind === 'dust') stamp(S.dust, p, t * Math.min(1, (1 - t) * 8));
      else if (p.kind === 'debris') {
        const [x, y] = at(p);
        ctx.globalAlpha = t;
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(x, y, p.size * 2, p.size * 2);
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.list) {
      const t = p.life / p.max;
      if (p.kind === 'fire') stamp(S.fire[p.shade], p, t * (p.shade ? 1 : 0.6));
      else if (p.kind === 'glow') stamp(S.glow, p, t);
      else if (p.kind === 'spark') {
        const [x, y] = at(p);
        ctx.globalAlpha = t;
        ctx.strokeStyle = t > 0.5 ? '#fff3c4' : '#fb923c';
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - p.vx * 0.03, y - p.vy * 0.03);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}
