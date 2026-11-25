import { STRIKE_IMPACT, STRIKE_MS, StrikeKind } from '../engine/state';
import { sound } from '../utils/audio';
import { Particles } from './particles';

type Pt = [number, number];
interface Attack { kind: StrikeKind; from: Pt; to: Pt; start: number; done: boolean; seeds: number[] }
interface Wave { at: Pt; start: number; size: number; color: string }

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Ataques animados sobre o mapa. Só desenha enquanto há algo acontecendo. */
export class MapFx {
  private particles = new Particles();
  private attacks: Attack[] = [];
  private waves: Wave[] = [];
  private raf = 0;
  private last = 0;
  /** Converte unidades do mapa em pixels da tela */
  place: (x: number, y: number) => Pt = (x, y) => [x, y];
  /** Pixels por unidade do mapa */
  zoom = 1;
  onShake: (power: number) => void = () => {};

  constructor(private canvas: HTMLCanvasElement) {}

  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
  private wake() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  attack(kind: StrikeKind, from: Pt, to: Pt) {
    this.attacks.push({ kind, from, to, start: performance.now(), done: false, seeds: Array.from({ length: 8 }, () => Math.random()) });
    if (kind === 'ar' || kind === 'bomba') sound.playJet();
    else if (kind === 'nuclear') sound.playSiren();
    else if (kind === 'terra') sound.playGuns();
    else sound.playLaunch();
    this.wake();
  }
  /** Combate distante entre outros países */
  skirmish(at: Pt) {
    const s = this.unit() * 0.55;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.particles.explode(rnd(-12, 12), rnd(-8, 8), s, { ax: at[0], ay: at[1] });
        this.wake();
      }, i * 220);
    }
  }
  /** Tamanho base dos efeitos: cresce com o zoom, dentro de limites */
  private unit() {
    return Math.max(7, Math.min(20, 5 + this.zoom * 3));
  }

  private frame = (now: number) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const dpr = Math.min(1.75, window.devicePixelRatio || 1);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    const ctx = this.canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const a of this.attacks) this.drawAttack(ctx, a, now);
    this.attacks = this.attacks.filter((a) => now - a.start < STRIKE_MS[a.kind] + 200);
    this.particles.step(dt);
    this.drawWaves(ctx, now);
    this.particles.draw(ctx, this.place);
    if (this.attacks.length || this.waves.length || this.particles.list.length) this.raf = requestAnimationFrame(this.frame);
    else {
      this.raf = 0;
      ctx.clearRect(0, 0, w, h);
    }
  };

  private drawWaves(ctx: CanvasRenderingContext2D, now: number) {
    this.waves = this.waves.filter((w) => now - w.start < 1400);
    for (const w of this.waves) {
      const t = Math.max(0, now - w.start) / 1400;
      const [x, y] = this.place(...w.at);
      const r = 1 + w.size * Math.sqrt(t);
      const g = ctx.createRadialGradient(x, y, r * 0.75, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.85, `rgba(${w.color},${0.55 * (1 - t)})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.82, 0, 0, 6.283);
      ctx.fill();
    }
  }

  private impact(a: Attack) {
    a.done = true;
    const s = this.unit();
    const at = { ax: a.to[0], ay: a.to[1] };
    const boom = (n: number, spread: number, size: number, gap: number) => {
      for (let i = 0; i < n; i++) {
        setTimeout(() => {
          this.particles.explode(rnd(-spread, spread), rnd(-spread, spread) * 0.7, size * rnd(0.7, 1.2), at);
          this.wake();
        }, i * gap);
      }
    };
    if (a.kind === 'nuclear') {
      this.particles.explode(0, 0, s * 4.5, at);
      boom(10, s * 4, s * 2.2, 60);
      this.waves.push({ at: a.to, start: performance.now(), size: s * 34, color: '255,236,200' });
      sound.playNuke();
      this.onShake(1);
      return;
    }
    if (a.kind === 'bomba') {
      // Tapete de bombas ao longo da rota
      const [fx, fy] = this.place(...a.from);
      const [tx, ty] = this.place(...a.to);
      const ang = Math.atan2(ty - fy, tx - fx);
      for (let i = 0; i < 9; i++) {
        setTimeout(() => {
          const d = (i - 4) * s * 1.1;
          this.particles.explode(Math.cos(ang) * d + rnd(-4, 4), Math.sin(ang) * d + rnd(-4, 4), s * 1.1, at);
          this.wake();
        }, i * 70);
      }
    } else boom(a.kind === 'inimigo' ? 5 : 6, s * 1.8, s * 1.05, 90);
    this.waves.push({ at: a.to, start: performance.now(), size: s * 9, color: '255,220,170' });
    sound.playImpact();
    this.onShake(0.5);
  }

  private drawAttack(ctx: CanvasRenderingContext2D, a: Attack, now: number) {
    const t = Math.min(1, Math.max(0, now - a.start) / (STRIKE_MS[a.kind] * STRIKE_IMPACT));
    if (t >= 1) {
      if (!a.done) this.impact(a);
      if (a.kind === 'ar' || a.kind === 'bomba') this.flyBy(ctx, a, 1 + (now - a.start - STRIKE_MS[a.kind] * STRIKE_IMPACT) / 1200);
      return;
    }
    if (a.kind === 'terra' || a.kind === 'mar') this.convoy(ctx, a, t);
    else if (a.kind === 'ar' || a.kind === 'bomba') this.flyBy(ctx, a, t);
    else this.missiles(ctx, a, t);
  }

  /** Coluna de blindados com poeira, ou esquadra com esteira */
  private convoy(ctx: CanvasRenderingContext2D, a: Attack, t: number) {
    const [fx, fy] = this.place(...a.from);
    const [tx, ty] = this.place(...a.to);
    const ang = Math.atan2(ty - fy, tx - fx);
    const nx = -Math.sin(ang);
    const ny = Math.cos(ang);
    const s = this.unit();
    const sea = a.kind === 'mar';
    for (let i = 0; i < 6; i++) {
      const lag = (i >> 1) * 0.09;
      const p = Math.max(0, Math.min(1, t * 1.15 - lag)) * 0.82;
      const side = (i % 2 ? 1 : -1) * s * (sea ? 1.1 : 0.75);
      const x = lerp(fx, tx, p) + nx * side;
      const y = lerp(fy, ty, p) + ny * side;
      const anchor = this.unplace(x, y, a);
      if (Math.random() < 0.7) this.particles.add({ kind: sea ? 'smoke' : 'dust', ...anchor, vx: -Math.cos(ang) * 14, vy: -Math.sin(ang) * 14 - 3, drag: 2, life: rnd(0.5, 1.1), size: s * 0.3, grow: s * 0.6, shade: 2 });
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      if (sea) ship(ctx, s * 1.1);
      else tank(ctx, s * 0.8);
      ctx.restore();
      // Disparos na aproximação
      if (t > 0.55 && Math.random() < 0.22) {
        this.particles.add({ kind: 'glow', ...anchor, life: 0.1, size: s * 0.9, spin: 0 });
        this.tracer(ctx, x, y, tx + rnd(-s, s) * 2, ty + rnd(-s, s) * 1.5);
        if (Math.random() < 0.6) this.particles.explode(rnd(-s, s) * 1.6, rnd(-s, s) * 1.2, s * 0.45, { ax: a.to[0], ay: a.to[1] });
      }
    }
  }
  private tracer(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
    const p = Math.random() * 0.8;
    ctx.strokeStyle = 'rgba(255,225,140,.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(lerp(x1, x2, p), lerp(y1, y2, p));
    ctx.lineTo(lerp(x1, x2, p + 0.2), lerp(y1, y2, p + 0.2));
    ctx.stroke();
  }
  /** Âncora no mapa para um ponto da tela, para a fumaça acompanhar o arrasto */
  private unplace(x: number, y: number, a: Attack) {
    const [bx, by] = this.place(...a.to);
    return { ax: a.to[0], ay: a.to[1], x: x - bx, y: y - by };
  }

  /** Esquadrilha com rastro, sombra e queda de bombas ou paraquedas */
  private flyBy(ctx: CanvasRenderingContext2D, a: Attack, t: number) {
    const [fx, fy] = this.place(...a.from);
    const [tx, ty] = this.place(...a.to);
    const ang = Math.atan2(ty - fy, tx - fx);
    const s = this.unit() * (a.kind === 'bomba' ? 1.25 : 1);
    const form: Pt[] = [[0, 0], [-1.5, 1.4], [-1.5, -1.4], [-3, 2.8], [-3, -2.8]];
    for (const [k, [bx, by]] of form.entries()) {
      if (a.kind === 'bomba' && k > 2) break;
      const ox = (Math.cos(ang) * bx - Math.sin(ang) * by) * s;
      const oy = (Math.sin(ang) * bx + Math.cos(ang) * by) * s;
      const x = fx + (tx - fx) * t + ox;
      const y = fy + (ty - fy) * t + oy;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.translate(x + s * 0.9, y + s * 1.6);
      ctx.rotate(ang);
      plane(ctx, s * 0.95, '#000', a.kind === 'bomba');
      ctx.restore();
      const anchor = this.unplace(x - Math.cos(ang) * s, y - Math.sin(ang) * s, a);
      this.particles.add({ kind: 'smoke', ...anchor, life: 0.9, size: s * 0.16, grow: s * 0.35, shade: 2, drag: 3 });
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      plane(ctx, s, '', a.kind === 'bomba');
      ctx.restore();
      if (a.kind === 'ar' && t > 0.85 && t < 1.25) this.parachutes(ctx, a, t, k, s);
    }
  }
  private parachutes(ctx: CanvasRenderingContext2D, a: Attack, t: number, k: number, s: number) {
    const [tx, ty] = this.place(...a.to);
    const fall = (t - 0.85) / 0.4;
    for (let i = 0; i < 2; i++) {
      const x = tx + (a.seeds[(k + i * 3) % 8] - 0.5) * s * 8;
      const y = ty - s * 2.4 * (1 - fall) + (a.seeds[(k * 2 + i) % 8] - 0.5) * s * 5;
      const r = s * 0.42;
      ctx.fillStyle = 'rgba(226,232,240,.95)';
      ctx.beginPath();
      ctx.arc(x, y, r, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = 'rgba(148,163,184,.9)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x - r, y);
      ctx.lineTo(x, y + r * 1.3);
      ctx.lineTo(x + r, y);
      ctx.stroke();
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x - 1, y + r * 1.2, 2, 3);
    }
  }

  /** Mísseis em arco com rastro de fumaça */
  private missiles(ctx: CanvasRenderingContext2D, a: Attack, t: number) {
    const nuke = a.kind === 'nuclear';
    const [fx, fy] = this.place(...a.from);
    const [tx, ty] = this.place(...a.to);
    const dist = Math.hypot(tx - fx, ty - fy);
    const s = this.unit();
    const n = nuke ? 1 : 4;
    if (nuke && t < 0.16) {
      // Coluna de lançamento
      for (let i = 0; i < 3; i++) this.particles.add({ kind: i ? 'smoke' : 'fire', ax: a.from[0], ay: a.from[1], x: rnd(-4, 4), y: rnd(-2, 3), vx: rnd(-40, 40), vy: rnd(-4, 8), drag: 2.5, life: rnd(0.6, 1.6), size: s * 0.5, grow: s * 1.3, shade: 2 });
    }
    for (let i = 0; i < n; i++) {
      const p = Math.max(0, Math.min(1, t * (1 + (n - 1) * 0.06) - i * 0.06));
      // A ogiva acelera na descida
      const e = nuke ? p * p * (3 - 2 * p) : Math.pow(p, 1.25);
      const height = Math.min(nuke ? 230 : 150, dist * (nuke ? 0.6 : 0.42)) * (1 + (i % 2) * 0.25);
      const at = (q: number): Pt => [lerp(fx, tx, q) + (i - (n - 1) / 2) * s * 0.8 * Math.sin(q * Math.PI), lerp(fy, ty, q) - Math.sin(q * Math.PI) * height];
      const [x, y] = at(e);
      const [px, py] = at(Math.max(0, e - 0.02));
      const ang = Math.atan2(y - py, x - px);
      const size = s * (nuke ? 1 + Math.sin(e * Math.PI) * 0.9 : 0.7);
      for (let k = 0; k < 2; k++) {
        this.particles.add({ kind: 'smoke', ...this.unplace(lerp(px, x, Math.random()), lerp(py, y, Math.random()), a), vx: rnd(-5, 5), vy: rnd(-5, 5), drag: 1, life: nuke ? rnd(1.4, 2.4) : rnd(0.7, 1.2), size: size * 0.28, grow: size * 0.45, shade: 2 });
      }
      this.particles.add({ kind: 'fire', ...this.unplace(x - Math.cos(ang) * size * 0.8, y - Math.sin(ang) * size * 0.8, a), life: 0.18, size: size * 0.5, grow: -size, shade: 0 });
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(lerp(fx, tx, e), lerp(fy, ty, e), size * 0.5, size * 0.2, 0, 0, 6.283);
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      missile(ctx, size, nuke);
      ctx.restore();
    }
  }
}

// ===== Veículos vistos de cima =====
function metal(ctx: CanvasRenderingContext2D, r: number, light: string, dark: string) {
  const g = ctx.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  return g;
}
function tank(ctx: CanvasRenderingContext2D, s: number) {
  ctx.fillStyle = 'rgba(0,0,0,.45)';
  ctx.fillRect(-s * 0.75 + 2, -s * 0.5 + 3, s * 1.5, s);
  ctx.fillStyle = '#1c1a15';
  ctx.fillRect(-s * 0.8, -s * 0.52, s * 1.6, s * 0.26);
  ctx.fillRect(-s * 0.8, s * 0.26, s * 1.6, s * 0.26);
  ctx.fillStyle = metal(ctx, s * 0.4, '#8b8560', '#4a4730');
  ctx.fillRect(-s * 0.72, -s * 0.36, s * 1.44, s * 0.72);
  ctx.fillStyle = '#2f2d1f';
  ctx.fillRect(s * 0.1, -s * 0.06, s * 1.05, s * 0.12);
  ctx.fillStyle = metal(ctx, s * 0.3, '#a39c70', '#57533a');
  ctx.beginPath();
  ctx.ellipse(-s * 0.05, 0, s * 0.38, s * 0.28, 0, 0, 6.283);
  ctx.fill();
}
function ship(ctx: CanvasRenderingContext2D, s: number) {
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath();
  ctx.moveTo(s * 1.1, 0);
  ctx.lineTo(-s * 2.4, s * 0.7);
  ctx.lineTo(-s * 1.2, 0);
  ctx.lineTo(-s * 2.4, -s * 0.7);
  ctx.fill();
  ctx.fillStyle = metal(ctx, s * 0.32, '#aab4bf', '#4b5563');
  ctx.beginPath();
  ctx.moveTo(s * 1.25, 0);
  ctx.quadraticCurveTo(s * 0.5, s * 0.36, -s * 1.1, s * 0.28);
  ctx.lineTo(-s * 1.1, -s * 0.28);
  ctx.quadraticCurveTo(s * 0.5, -s * 0.36, s * 1.25, 0);
  ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(-s * 0.45, -s * 0.15, s * 0.6, s * 0.3);
  ctx.fillStyle = '#1f2937';
  ctx.fillRect(s * 0.35, -s * 0.07, s * 0.4, s * 0.14);
  ctx.fillRect(-s * 0.9, -s * 0.07, s * 0.28, s * 0.14);
}
function plane(ctx: CanvasRenderingContext2D, s: number, flat: string, wing: boolean) {
  ctx.fillStyle = flat || metal(ctx, s, '#cbd5e1', '#475569');
  ctx.beginPath();
  if (wing) {
    // Bombardeiro em asa
    ctx.moveTo(s * 0.75, 0);
    ctx.lineTo(-s * 0.55, s * 1.5);
    ctx.lineTo(-s * 0.75, s * 1.4);
    ctx.lineTo(-s * 0.35, s * 0.7);
    ctx.lineTo(-s * 0.6, s * 0.35);
    ctx.lineTo(-s * 0.4, 0);
    ctx.lineTo(-s * 0.6, -s * 0.35);
    ctx.lineTo(-s * 0.35, -s * 0.7);
    ctx.lineTo(-s * 0.75, -s * 1.4);
    ctx.lineTo(-s * 0.55, -s * 1.5);
  } else {
    ctx.moveTo(s * 1.15, 0);
    ctx.lineTo(s * 0.35, s * 0.13);
    ctx.lineTo(-s * 0.35, s * 0.82);
    ctx.lineTo(-s * 0.55, s * 0.8);
    ctx.lineTo(-s * 0.35, s * 0.18);
    ctx.lineTo(-s * 0.75, s * 0.4);
    ctx.lineTo(-s * 0.9, s * 0.38);
    ctx.lineTo(-s * 0.78, 0);
    ctx.lineTo(-s * 0.9, -s * 0.38);
    ctx.lineTo(-s * 0.75, -s * 0.4);
    ctx.lineTo(-s * 0.35, -s * 0.18);
    ctx.lineTo(-s * 0.55, -s * 0.8);
    ctx.lineTo(-s * 0.35, -s * 0.82);
    ctx.lineTo(s * 0.35, -s * 0.13);
  }
  ctx.closePath();
  ctx.fill();
  if (flat) return;
  ctx.fillStyle = wing ? '#1e293b' : '#0c4a6e';
  ctx.beginPath();
  ctx.ellipse(s * (wing ? 0.3 : 0.55), 0, s * 0.18, s * 0.08, 0, 0, 6.283);
  ctx.fill();
}
function missile(ctx: CanvasRenderingContext2D, s: number, nuke: boolean) {
  const r = s * (nuke ? 0.2 : 0.14);
  ctx.fillStyle = metal(ctx, r, '#f8fafc', '#64748b');
  ctx.beginPath();
  ctx.moveTo(s * 1.05, 0);
  ctx.quadraticCurveTo(s * 0.8, r, s * 0.5, r);
  ctx.lineTo(-s * 0.7, r);
  ctx.lineTo(-s * 0.7, -r);
  ctx.lineTo(s * 0.5, -r);
  ctx.quadraticCurveTo(s * 0.8, -r, s * 1.05, 0);
  ctx.fill();
  ctx.fillStyle = nuke ? '#b91c1c' : '#334155';
  ctx.fillRect(s * 0.25, -r, s * 0.16, r * 2);
  ctx.beginPath();
  ctx.moveTo(-s * 0.4, 0);
  ctx.lineTo(-s * 0.85, r * 2.6);
  ctx.lineTo(-s * 0.7, 0);
  ctx.lineTo(-s * 0.85, -r * 2.6);
  ctx.fill();
}
