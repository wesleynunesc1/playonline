import { STRIKE_IMPACT, STRIKE_MS, StrikeKind } from '../engine/state';
import { sound } from '../utils/audio';
import { Particles } from './particles';

type Pt = [number, number];
interface Attack { kind: StrikeKind; from: Pt; to: Pt; start: number; done: boolean; seeds: number[]; label: string; color: string }
interface Wave { at: Pt; start: number; size: number; color: string }

const MAX_ATTACKS = 16;
const MAX_BURNS = 8;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Ataques animados sobre o mapa. Só desenha enquanto há algo acontecendo. */
export class MapFx {
  private particles = new Particles();
  private attacks: Attack[] = [];
  private waves: Wave[] = [];
  private burns: { at: Pt; until: number }[] = [];
  private hot: Pt[] = [];
  private nextHot = 0;
  private heard: Partial<Record<StrikeKind, number>> = {};
  private raf = 0;
  private last = 0;
  /** Converte unidades do mapa em pixels da tela */
  place: (x: number, y: number) => Pt = (x, y) => [x, y];
  /** Pixels por unidade do mapa */
  zoom = 1;
  onShake: (power: number) => void = () => {};
  onFlash: () => void = () => {};

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

  /** Combates contínuos: batalhas, cercos e frentes de guerra */
  setHot(list: Pt[]) {
    this.hot = list.slice(0, 10);
    if (list.length) this.wake();
  }

  attack(kind: StrikeKind, from: Pt, to: Pt, label = '', color = '#fff') {
    if (this.attacks.length >= MAX_ATTACKS) this.attacks.shift();
    const now = performance.now();
    this.attacks.push({ kind, from, to, start: now, done: false, label, color, seeds: Array.from({ length: 8 }, () => Math.random()) });
    this.wake();
    // Muitos ataques juntos não viram barulho
    if (now - (this.heard[kind] ?? -9999) < 700) return;
    this.heard[kind] = now;
    if (kind === 'ar' || kind === 'bomba') sound.playJet();
    else if (kind === 'nuclear') sound.playSiren();
    else if (kind === 'terra' || kind === 'sabotagem') sound.playGuns();
    else if (kind === 'ciber') sound.playSabotage();
    else sound.playLaunch();
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
    this.ambient(now);
    this.particles.step(dt);
    this.drawWaves(ctx, now);
    this.particles.draw(ctx, this.place);
    this.drawLabels(ctx, now);
    if (this.attacks.length || this.waves.length || this.hot.length || this.burns.length || this.particles.list.length) this.raf = requestAnimationFrame(this.frame);
    else {
      this.raf = 0;
      ctx.clearRect(0, 0, w, h);
    }
  };

  /** Incêndios depois do ataque e tiroteio nas frentes */
  private ambient(now: number) {
    const s = this.unit();
    this.burns = this.burns.filter((b) => b.until > now);
    for (const b of this.burns) {
      const at = { ax: b.at[0], ay: b.at[1] };
      if (Math.random() < 0.16) this.particles.add({ kind: 'smoke', ...at, x: rnd(-s, s) * 0.5, y: rnd(-s, s) * 0.3, vx: rnd(4, 12), vy: rnd(-22, -12), drag: 0.3, life: rnd(1.6, 3), size: s * 0.35, grow: s * 0.6, shade: 0 });
      if (Math.random() < 0.22) this.particles.add({ kind: 'fire', ...at, x: rnd(-s, s) * 0.6, y: rnd(-s, s) * 0.4, vy: rnd(-12, -4), life: rnd(0.25, 0.5), size: s * rnd(0.2, 0.4), grow: -s * 0.3, shade: 1 });
    }
    if (!this.hot.length || now < this.nextHot) return;
    this.nextHot = now + rnd(90, 260) / Math.min(3, this.hot.length);
    const p = this.hot[Math.floor(Math.random() * this.hot.length)];
    const at = { ax: p[0], ay: p[1] };
    const x = rnd(-s, s) * 1.8;
    const y = rnd(-s, s) * 1.2;
    if (Math.random() < 0.4) this.particles.explode(x, y, s * rnd(0.25, 0.5), at);
    else {
      this.particles.add({ kind: 'glow', ...at, x, y, life: 0.12, size: s * 0.6, spin: 0 });
      for (let i = 0; i < 4; i++) this.particles.add({ kind: 'spark', ...at, x, y, vx: rnd(-1, 1) * 170, vy: rnd(-1, 1) * 90, drag: 0.3, life: rnd(0.2, 0.4), size: 1.3 });
    }
  }
  private burn(at: Pt, seconds: number) {
    this.burns = [{ at, until: performance.now() + seconds * 1000 }, ...this.burns].slice(0, MAX_BURNS);
  }
  /** Nome de quem ataca acompanha as tropas */
  private drawLabels(ctx: CanvasRenderingContext2D, now: number) {
    ctx.font = '700 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    for (const a of this.attacks) {
      const t = (now - a.start) / (STRIKE_MS[a.kind] * STRIKE_IMPACT);
      if (!a.label || t < 0 || t > 1) continue;
      const [fx, fy] = this.place(...a.from);
      const [tx, ty] = this.place(...a.to);
      const p = Math.min(0.8, t);
      const x = lerp(fx, tx, p);
      const y = lerp(fy, ty, p) - this.unit() * 2.4;
      const w = ctx.measureText(a.label).width + 14;
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = a.color;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - 11, w, 17, 8);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.fillText(a.label, x, y + 1.5);
    }
  }

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
    if (a.kind === 'ciber') return;
    if (a.kind === 'carta') {
      this.particles.explode(0, 0, s * 0.8, at);
      this.onShake(0.25);
      sound.playImpact();
      return;
    }
    this.burn(a.to, a.kind === 'nuclear' ? 60 : 25);
    if (a.kind === 'nuclear') {
      this.onFlash();
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
    } else if (a.kind === 'sabotagem') boom(3, s, s * 0.7, 160);
    else if (a.kind === 'meteoro') boom(8, s * 1.5, s * 1.5, 50);
    else boom(a.kind === 'inimigo' ? 5 : 6, s * 1.8, s * 1.05, 90);
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
    if (a.kind === 'sabotagem') return;
    if (a.kind === 'ciber') return this.cyber(ctx, a, t);
    if (a.kind === 'carta') return this.lightning(ctx, a, t);
    if (a.kind === 'meteoro') return this.meteor(ctx, a, t);
    if (t > 0.5 && (a.kind === 'ar' || a.kind === 'bomba' || a.kind === 'inimigo')) this.antiAir(a);
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

  /** Defesa antiaérea do alvo: traçantes e estouros no céu */
  private antiAir(a: Attack) {
    const s = this.unit();
    const at = { ax: a.to[0], ay: a.to[1] };
    if (Math.random() < 0.5) this.particles.add({ kind: 'spark', ...at, x: rnd(-s, s) * 0.8, y: rnd(-s, s) * 0.4, vx: rnd(-90, 90), vy: rnd(-260, -150), drag: 0.6, life: rnd(0.35, 0.6), size: 1.6 });
    if (Math.random() < 0.09) this.particles.add({ kind: 'smoke', ...at, x: rnd(-s, s) * 3, y: rnd(-5, -1) * s, life: 0.9, size: s * 0.2, grow: s * 0.5, shade: 0 });
  }
  /** Invasão digital: pulsos e interferência */
  private cyber(ctx: CanvasRenderingContext2D, a: Attack, t: number) {
    const [x, y] = this.place(...a.to);
    const s = this.unit() * 3;
    ctx.strokeStyle = `rgba(34,211,238,${0.9 - t * 0.6})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const r = s * ((t * 2 + i / 3) % 1);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.283);
      ctx.stroke();
    }
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = Math.random() < 0.5 ? 'rgba(34,211,238,.8)' : 'rgba(217,70,239,.8)';
      ctx.fillRect(x + rnd(-s, s), y + rnd(-s, s) * 0.8, rnd(3, 22), 1.6);
    }
  }
  private lightning(ctx: CanvasRenderingContext2D, a: Attack, t: number) {
    if (t < 0.35) return;
    const [x, y] = this.place(...a.to);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [w, c] of [[7, 'rgba(120,150,255,.35)'], [2, 'rgba(240,245,255,.95)']] as const) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      let px = x + (a.seeds[0] - 0.5) * 160;
      let py = Math.min(0, y - 260);
      ctx.moveTo(px, py);
      for (let i = 1; i <= 8; i++) {
        px = lerp(px, x, i / 8) + (i < 8 ? rnd(-14, 14) : 0);
        py = lerp(Math.min(0, y - 260), y, i / 8);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  private meteor(ctx: CanvasRenderingContext2D, a: Attack, t: number) {
    const [tx, ty] = this.place(...a.to);
    const e = t * t;
    const x = tx + (1 - e) * 420;
    const y = ty - (1 - e) * 480;
    const s = this.unit();
    for (let i = 0; i < 3; i++) this.particles.add({ kind: i ? 'fire' : 'smoke', ...this.unplace(x + rnd(-s, s) * 0.3, y + rnd(-s, s) * 0.3, a), vx: 30, vy: -34, drag: 1, life: rnd(0.4, 1.1), size: s * 0.7, grow: s * 0.4, shade: i });
    const g = ctx.createRadialGradient(x, y, 0, x, y, s * 1.2);
    g.addColorStop(0, '#fff7e0');
    g.addColorStop(0.4, '#ff9d3c');
    g.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - s * 1.2, y - s * 1.2, s * 2.4, s * 2.4);
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
