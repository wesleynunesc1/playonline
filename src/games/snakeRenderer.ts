import { BONUS_STEPS, Cell, GRID, SnakeGame, VECTORS } from './snake';

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string }
interface Popup { x: number; y: number; life: number; text: string; color: string }

const FIREFLIES = Array.from({ length: 22 }, () => ({
  x: Math.random() * GRID,
  y: Math.random() * GRID,
  speed: 0.3 + Math.random() * 0.7,
  phase: Math.random() * 6.28,
}));

/** Diferença entre células vizinhas, considerando a travessia da borda */
const delta = (from: number, to: number) => {
  const d = to - from;
  return Math.abs(d) > 1 ? -Math.sign(d) : d;
};

/** Desenho em canvas: cobra suave, partículas, brilho e tremor */
export class SnakeRenderer {
  private particles: Particle[] = [];
  private popups: Popup[] = [];
  private shake = 0;
  private gulp = 0;

  reset() {
    this.particles = [];
    this.popups = [];
    this.shake = this.gulp = 0;
  }

  eat(at: Cell, points: number, bonus: boolean) {
    const color = bonus ? '#fde047' : '#fb7185';
    this.burst(at, bonus ? 40 : 20, color, bonus ? 9 : 6);
    this.popups.push({ x: at.x, y: at.y, life: 1, text: `+${points}`, color });
    this.gulp = 1;
    if (bonus) this.shake = 0.12;
  }

  die(game: SnakeGame) {
    this.shake = 0.5;
    this.burst(game.body[0], 45, '#f87171', 10);
    game.body.slice(1).forEach((c) => this.burst(c, 4, '#34d399', 4));
  }

  private burst(at: Cell, count: number, color: string, speed: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.25 + Math.random() * 0.75);
      const max = 0.4 + Math.random() * 0.5;
      this.particles.push({
        x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: max, max, size: 0.05 + Math.random() * 0.1, color: i % 4 ? color : '#ffffff',
      });
    }
  }

  /** `t` (0..1): fração do passo atual; `dt` em segundos */
  draw(canvas: HTMLCanvasElement, game: SnakeGame, t: number, now: number, dt: number, dead: boolean) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = Math.round(canvas.clientWidth * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx || !size) return;
    if (canvas.width !== size) canvas.width = canvas.height = size;

    const u = size / GRID;
    const px = (n: number) => (n + 0.5) * u;
    const time = now / 1000;

    const bg = ctx.createRadialGradient(size * 0.5, size * 0.4, 0, size * 0.5, size * 0.5, size * 0.8);
    bg.addColorStop(0, '#123c3a');
    bg.addColorStop(1, '#061417');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    if (this.shake > 0.01) {
      ctx.translate((Math.random() - 0.5) * this.shake * u, (Math.random() - 0.5) * this.shake * u);
      this.shake *= Math.exp(-7 * dt);
    }
    this.gulp *= Math.exp(-6 * dt);

    ctx.fillStyle = 'rgba(94,234,212,0.045)';
    for (let y = 0; y < GRID; y++) for (let x = y % 2; x < GRID; x += 2) ctx.fillRect(x * u, y * u, u, u);

    const dot = (x: number, y: number, r: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px(x), px(y), Math.max(0, r) * u, 0, Math.PI * 2);
      ctx.fill();
    };
    const halo = (x: number, y: number, r: number, rgb: string, alpha: number) => {
      const g = ctx.createRadialGradient(px(x), px(y), 0, px(x), px(y), r * u);
      g.addColorStop(0, `rgba(${rgb},${alpha})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(px(x) - r * u, px(y) - r * u, 2 * r * u, 2 * r * u);
    };

    for (const f of FIREFLIES) {
      const x = (f.x + Math.sin(time * f.speed + f.phase) * 1.4 + GRID) % GRID;
      const y = (f.y + Math.cos(time * f.speed * 0.8 + f.phase) * 1.4 + GRID) % GRID;
      dot(x, y, 0.045, `rgba(190,242,100,${0.2 + 0.2 * Math.sin(time * 2 + f.phase)})`);
    }

    // Comida
    const beat = Math.sin(time * 5) * 0.035;
    const { food, bonus } = game;
    halo(food.x, food.y, 1.5, '251,113,133', 0.45);
    dot(food.x, food.y, 0.35 + beat, '#e11d48');
    dot(food.x - 0.06, food.y - 0.06, 0.25 + beat, '#fb7185');
    dot(food.x - 0.12, food.y - 0.13, 0.08, 'rgba(255,255,255,0.85)');
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.ellipse(px(food.x + 0.13), px(food.y - 0.4), u * 0.16, u * 0.08, -0.5, 0, Math.PI * 2);
    ctx.fill();

    if (bonus) {
      halo(bonus.x, bonus.y, 2, '250,204,21', 0.55);
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = time * 2 + (i * Math.PI) / 5;
        const r = u * (i % 2 ? 0.2 : 0.44 + beat);
        ctx.lineTo(px(bonus.x) + Math.cos(a) * r, px(bonus.y) + Math.sin(a) * r);
      }
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = u * 0.07;
      ctx.beginPath();
      ctx.arc(px(bonus.x), px(bonus.y), u * 0.6, -Math.PI / 2, -Math.PI / 2 + (bonus.steps / BONUS_STEPS) * Math.PI * 2);
      ctx.stroke();
    }

    this.drawSnake(ctx, game, t, time, u, px, dot, halo, dead);

    // Partículas e pontos flutuantes
    this.particles = this.particles.filter((p) => (p.life -= dt) > 0);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.5 * dt;
      p.vy *= 1 - 2.5 * dt;
      ctx.globalAlpha = p.life / p.max;
      dot(p.x, p.y, p.size, p.color);
    }
    this.popups = this.popups.filter((p) => (p.life -= dt * 1.2) > 0);
    ctx.font = `800 ${u * 0.8}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    for (const p of this.popups) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, px(p.x), px(Math.max(0.4, p.y) - (1 - p.life) * 1.6));
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawSnake(
    ctx: CanvasRenderingContext2D,
    game: SnakeGame,
    t: number,
    time: number,
    u: number,
    px: (n: number) => number,
    dot: (x: number, y: number, r: number, color: string) => void,
    halo: (x: number, y: number, r: number, rgb: string, alpha: number) => void,
    dead: boolean
  ) {
    const { body, lastTail } = game;
    const n = body.length;
    const v = VECTORS[game.dir];
    const hx = body[0].x - v.x * (1 - t);
    const hy = body[0].y - v.y * (1 - t);
    if (!dead) halo(hx, hy, 3, '52,211,153', 0.22);

    const seg = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.beginPath();
      ctx.moveTo(px(x1), px(y1));
      ctx.lineTo(px(x2), px(y2));
      ctx.stroke();
    };
    /** Trecho de b até a; `from`/`to` (0..1) animam cabeça e cauda */
    const link = (b: Cell, a: Cell, from: number, to: number) => {
      const dx = delta(b.x, a.x);
      const dy = delta(b.y, a.y);
      seg(b.x + dx * from, b.y + dy * from, b.x + dx * to, b.y + dy * to);
      if (b.x + dx !== a.x || b.y + dy !== a.y) {
        seg(a.x - dx * (1 - from), a.y - dy * (1 - from), a.x - dx * (1 - to), a.y - dy * (1 - to));
      }
    };
    const pass = (width: (k: number) => number, color: (k: number, i: number) => string) => {
      for (let i = n - 1; i >= 0; i--) {
        const k = i / n;
        ctx.lineWidth = u * width(k);
        ctx.strokeStyle = color(k, i);
        if (i < n - 1) link(body[i + 1], body[i], 0, i === 0 ? t : 1);
        else if (lastTail.x !== body[i].x || lastTail.y !== body[i].y) link(lastTail, body[i], t, 1);
      }
    };

    ctx.lineCap = 'round';
    const thick = (k: number) => 0.8 - k * 0.22 + this.gulp * 0.16 * Math.max(0, 1 - k * 3);
    ctx.save();
    ctx.translate(0, u * 0.13);
    pass(thick, () => 'rgba(0,0,0,0.5)');
    ctx.restore();
    pass(thick, (k) => (dead ? '#334155' : `hsl(${165 + k * 45} 80% ${30 - k * 8}%)`));
    pass(
      (k) => thick(k) * 0.76,
      (k, i) => (dead ? '#64748b' : `hsl(${150 + k * 50} 78% ${54 - k * 14 + Math.sin(time * 6 - i * 0.7) * 6}%)`)
    );
    pass((k) => 0.12 - k * 0.06, () => 'rgba(255,255,255,0.28)');

    // Língua
    if (!dead && Math.sin(time * 4) > 0.5) {
      ctx.strokeStyle = '#fb7185';
      ctx.lineWidth = u * 0.07;
      seg(hx + v.x * 0.35, hy + v.y * 0.35, hx + v.x * 0.72, hy + v.y * 0.72);
      for (const s of [-1, 1]) {
        seg(hx + v.x * 0.72, hy + v.y * 0.72, hx + v.x * 0.88 - v.y * 0.12 * s, hy + v.y * 0.88 + v.x * 0.12 * s);
      }
    }
    // Cabeça e olhos
    dot(hx, hy, 0.43 + this.gulp * 0.1, dead ? '#64748b' : '#34d399');
    const blink = !dead && time % 3.2 < 0.12;
    for (const side of [-1, 1]) {
      const ex = hx + v.x * 0.12 - v.y * 0.2 * side;
      const ey = hy + v.y * 0.12 + v.x * 0.2 * side;
      dot(ex, ey, blink ? 0.04 : 0.145, '#fff');
      if (!blink) dot(ex + v.x * 0.05, ey + v.y * 0.05, 0.08, dead ? '#b91c1c' : '#052e2b');
    }
  }
}
