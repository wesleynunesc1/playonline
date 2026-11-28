import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Post } from './post';
import { GUESTS, PLOTS, PLOT_D, PLOT_W, ZONE } from './data';
import { C, S, U, canRent, fx, guide, money, plotCost, zoneCost } from './sim';
import { Act, MACHINES, Seat, furnish } from './machines';
import { People, Pose, pose } from './people';
import { GEO, mat, part, tex, texMat, Ctx } from './kit';

/** O galpão da academia em 3D: salões alugados, aparelhos e alunos treinando. Só desenha; quem decide é a simulação */
interface Agent { path: THREE.Vector3[]; seg: number; wait: number; seat: Seat | null; leave: boolean; speed: number; phase: number; dir: number; color: THREE.Color; skin: THREE.Color; hair: THREE.Color; pos: THREE.Vector3; lane: number }

const rubber = tex(((c) => {
  const g = c.getContext('2d')!;
  g.fillStyle = '#1d1f23';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = ['#2a2d33', '#16181b', '#33363d'][i % 3];
    g.fillRect((i * 53) % 128, (i * 97) % 128, 2, 2);
  }
  g.strokeStyle = 'rgba(0,0,0,.5)';
  g.lineWidth = 2;
  g.strokeRect(0, 0, 128, 128);
  return c;
})(Object.assign(document.createElement('canvas'), { width: 128, height: 128 })), PLOT_W / 2, PLOT_D / 2);
const tiles = tex(((c) => {
  const g = c.getContext('2d')!;
  g.fillStyle = '#d6d3d1';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#a8a29e';
  g.strokeRect(0, 0, 64, 64);
  return c;
})(Object.assign(document.createElement('canvas'), { width: 64, height: 64 })), PLOT_W, PLOT_D);
const sign = (text: string, color: string) => {
  const c = Object.assign(document.createElement('canvas'), { width: 1024, height: 160 });
  const g = c.getContext('2d')!;
  g.font = '900 88px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 24;
  g.fillStyle = color;
  g.fillText(text, 512, 84);
  return tex(c);
};
const bg = () => {
  const c = Object.assign(document.createElement('canvas'), { width: 4, height: 256 });
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#0b1220');
  gr.addColorStop(1, '#1f2937');
  g.fillStyle = gr;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** Junta as peças paradas por material: poucos desenhos por quadro */
function bake(g: THREE.Group) {
  g.updateMatrixWorld(true);
  const inv = g.matrixWorld.clone().invert();
  const by = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const drop: THREE.Mesh[] = [];
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.keep || Array.isArray(m.material)) return;
    const geo = m.geometry.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld));
    by.set(m.material, [...(by.get(m.material) ?? []), geo]);
    drop.push(m);
  });
  for (const m of drop) m.removeFromParent();
  for (const [m, list] of by) {
    const merged = new THREE.Mesh(mergeGeometries(list), m);
    merged.castShadow = merged.receiveShadow = true;
    g.add(merged);
    list.forEach((x) => x.dispose());
  }
}

const SKIN = ['#f1c27d', '#c68642', '#8d5524', '#e0ac69', '#ffdbac'].map((s) => new THREE.Color(s));
const HAIR = ['#1b1b1b', '#5a3825', '#c9a227', '#7b3f00', '#ddd'].map((s) => new THREE.Color(s));
const MAX_AGENTS = 160;

export class GymScene {
  private r: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
  private post: Post | null = null;
  private world = new THREE.Group();
  private plots: { g: THREE.Group; key: string; seats: Seat[]; spin: Ctx['spin'] }[] = [];
  private shell = new THREE.Group();
  private pick: THREE.Mesh[] = [];
  private target = new THREE.Vector3();
  private goal = new THREE.Vector3();
  private zoom = 1;
  private fit = 1;
  private sun = new THREE.DirectionalLight('#fff7ed', 2.6);
  private agents: Agent[] = [];
  private people = new People(MAX_AGENTS);
  private tags = new Map<number, HTMLElement>();
  private frame = new THREE.Group();
  private raf = 0;
  private last = performance.now();
  private t = 0;
  private spawnAcc = 0;
  private texAcc = 0;
  private ptrs = new Map<number, { x: number; y: number }>();
  private moved = 0;
  private shellKey = '';
  onFrame: (dt: number) => void = () => {};

  constructor(private canvas: HTMLCanvasElement, private overlay: HTMLElement, private onPick: (plot: number | null) => void, quality: boolean) {
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.r.shadowMap.type = THREE.PCFShadowMap;
    this.r.shadowMap.autoUpdate = false;
    this.r.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.background = bg();
    this.scene.add(new THREE.HemisphereLight('#f8fafc', '#64748b', 2.3));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 120 });
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target, this.world, this.shell, this.frame, this.people.group);
    this.street();
    this.setQuality(quality);
    this.build();
    this.target.copy(this.goal);
    fx.rebuild = () => this.build();
    fx.level = (i, n, full) => this.float(i, full ? `Completo! ${n}` : `+1 · ${n}`, full ? 'big' : 'lv');
    fx.join = (n) => this.float(this.recep(), `+${n} aluno${n > 1 ? 's' : ''}`);
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up);
    canvas.addEventListener('pointercancel', this.up);
    canvas.addEventListener('wheel', this.wheel, { passive: false });
    window.addEventListener('resize', this.resize);
    this.raf = requestAnimationFrame(this.loop);
    if (import.meta.env.DEV) Object.assign(window, { gymView: this }); // para testar no navegador
  }

  setQuality(high: boolean) {
    this.r.setPixelRatio(Math.min(devicePixelRatio, high ? 2 : 1.25));
    this.post?.dispose();
    this.post = high ? new Post(this.r, this.scene, this.cam as unknown as THREE.PerspectiveCamera) : null;
    this.r.shadowMap.enabled = high;
    this.r.shadowMap.needsUpdate = true;
    this.resize();
  }
  private recep() {
    return U().spaces.findIndex((x) => x?.zone === 'recepcao');
  }

  /** Rua, calçada e árvores na frente do galpão */
  private street() {
    const c: Ctx = { g: new THREE.Group(), seats: [], spin: [] };
    const front = PLOTS[15].z + PLOT_D / 2;
    part(c, GEO.box, mat('#9ca3af', { r: 0.9 }), 0, -0.05, front + 2, 70, 0.1, 4);
    part(c, GEO.box, mat('#27272a', { r: 0.95 }), 0, -0.08, front + 8, 80, 0.1, 8);
    for (let x = -36; x <= 36; x += 6) part(c, GEO.box, mat('#f5f5f4', { glow: 0.2 }), x, -0.02, front + 8, 2.4, 0.02, 0.18);
    part(c, GEO.box, mat('#0f172a', { r: 1 }), 0, -0.2, 0, 140, 0.1, 140);
    for (let x = -30; x <= 30; x += 12) {
      part(c, GEO.cyl, mat('#57534e'), x, 1.2, front + 3.4, 0.25, 2.4, 0.25);
      part(c, GEO.sph, mat('#3f6212', { r: 0.9 }), x, 3, front + 3.4, 2.4, 2, 2.4);
    }
    bake(c.g);
    this.scene.add(c.g);
  }

  /** Monta o galpão. Só refaz o salão que mudou */
  build() {
    const u = U();
    const key = `${u.city}|${u.spaces.map((x) => (x ? x.zone : '-')).join(',')}|${u.deco}`;
    if (key !== this.shellKey) {
      this.shellKey = key;
      this.walls();
      this.fitView();
    }
    PLOTS.forEach((p, i) => {
      const sp = u.spaces[i];
      const k = sp ? `${sp.zone}:${sp.zone === 'recepcao' ? Math.min(u.recep, 6) : sp.n}:${u.deco > 4}` : canRent(i) ? 'rent' : 'off';
      if (this.plots[i]?.key === k) return;
      this.plots[i]?.g.removeFromParent();
      const c: Ctx = { g: new THREE.Group(), seats: [], spin: [] };
      c.g.position.set(p.x, 0, p.z);
      const floor = part(c, GEO.plane, sp ? (sp.zone === 'recepcao' || sp.zone === 'lanchonete' || sp.zone === 'nutri' ? texMat(tiles, 0, 0.5) : texMat(rubber, 0, 0.95)) : mat(canRent(i) ? '#3f3f46' : '#1e293b', { r: 1 }), 0, 0.01, 0, PLOT_W - 0.04, PLOT_D - 0.04, 1);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      floor.userData = { keep: 1 };
      this.pick[i] = floor;
      if (sp?.zone) {
        const d = ZONE[sp.zone];
        // Faixa de piso da zona, como nas academias grandes
        const edge = mat(d.carpet[1], { glow: 0.5 });
        for (const [x, z, w, dd] of [[0, -PLOT_D / 2 + 0.08, PLOT_W - 0.3, 0.08], [0, PLOT_D / 2 - 0.08, PLOT_W - 0.3, 0.08], [-PLOT_W / 2 + 0.08, 0, 0.08, PLOT_D - 0.3], [PLOT_W / 2 - 0.08, 0, 0.08, PLOT_D - 0.3]]) part(c, GEO.box, edge, x, 0.02, z, w, 0.02, dd);
        furnish(c, sp.zone, sp.zone === 'recepcao' ? u.recep : sp.n, u.deco);
      } else if (!sp && canRent(i)) {
        // Salão vizinho para alugar: cerca e placa
        part(c, GEO.box, mat('#facc15', { glow: 0.4 }), 0, 1.2, PLOT_D / 2 - 0.4, 2.6, 0.9, 0.08);
        for (const s of [-1, 1]) part(c, GEO.box, mat('#78716c'), s * 1.1, 0.4, PLOT_D / 2 - 0.4, 0.08, 0.8, 0.08);
      }
      c.g.traverse((o) => { if ((o as THREE.Mesh).isMesh && c.spin.some((s) => s.m === o)) o.userData.keep = 1; });
      bake(c.g);
      for (const s of c.seats) s.p.add(c.g.position);
      this.world.add(c.g);
      this.plots[i] = { g: c.g, key: k, seats: c.seats, spin: c.spin };
    });
    this.r.shadowMap.needsUpdate = true;
    this.syncTags();
  }

  /** Paredes só onde o galpão termina; as da frente e da direita são de vidro baixo para ver dentro */
  private walls() {
    this.shell.clear();
    const u = U();
    const c: Ctx = { g: this.shell, seats: [], spin: [] };
    const own = (i: number) => i >= 0 && !!u.spaces[i];
    const wall = mat('#3f3f46', { r: 0.8 });
    const glass = mat('#bae6fd', { op: 0.22, r: 0.05 });
    const stripe = mat('#facc15', { glow: 0.3 });
    PLOTS.forEach((p, i) => {
      if (!own(i)) return;
      const col = i % 5, row = Math.floor(i / 5);
      const sides: [boolean, number, number, number, number, boolean][] = [
        [row === 0 || !own(i - 5), p.x, p.z - PLOT_D / 2, PLOT_W, 0.25, true],
        [row === 3 || !own(i + 5), p.x, p.z + PLOT_D / 2, PLOT_W, 0.25, false],
        [col === 0 || !own(i - 1), p.x - PLOT_W / 2, p.z, 0.25, PLOT_D, true],
        [col === 4 || !own(i + 1), p.x + PLOT_W / 2, p.z, 0.25, PLOT_D, false],
      ];
      for (const [open, x, z, w, d, tall] of sides) {
        if (!open) continue;
        if (tall) {
          part(c, GEO.box, wall, x, 2, z, w, 4, d);
          part(c, GEO.box, stripe, x, 0.35, z, w + 0.02, 0.5, d + 0.02);
        } else part(c, GEO.box, glass, x, 0.6, z, w, 1.2, d);
      }
      // Pilares de aço e linhas de LED do teto
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(c, GEO.box, mat('#27272a', { m: 0.6, r: 0.4 }), p.x + (sx * PLOT_W) / 2, sz < 0 ? 2 : 0.6, p.z + (sz * PLOT_D) / 2, 0.3, sz < 0 ? 4 : 1.2, 0.3);
    });
    // Fachada com letreiro em cima da recepção
    const ri = this.recep();
    if (ri >= 0) {
      const p = PLOTS[ri];
      // Totem na calçada, para não tapar a recepção
      part(c, GEO.box, mat('#18181b', { r: 0.5 }), p.x - 3.4, 0.9, p.z + PLOT_D / 2 + 1.6, 3.2, 1.8, 0.3);
      const s = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({ map: sign('MAGNATA FITNESS', '#facc15'), transparent: true, toneMapped: false }));
      s.position.set(p.x - 3.4, 1.25, p.z + PLOT_D / 2 + 1.76);
      s.scale.set(3.1, 0.5, 1);
      s.userData.keep = 1;
      this.shell.add(s);
    }
    this.shell.children.forEach((m) => { (m as THREE.Mesh).castShadow = true; });
  }

  /** Enquadra o galpão inteiro quando ele cresce */
  private fitView() {
    const u = U();
    const own = PLOTS.filter((_, i) => u.spaces[i]);
    const xs = own.map((p) => p.x), zs = own.map((p) => p.z);
    this.goal.set((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2 + 2);
    this.fit = Math.max(0.6, Math.max(Math.max(...xs) - Math.min(...xs) + PLOT_W * 1.6, (Math.max(...zs) - Math.min(...zs) + PLOT_D * 1.8) * 1.3) / 34);
    this.resize();
  }

  // ===== Etiquetas em HTML por cima da cena =====
  private syncTags() {
    const u = U();
    PLOTS.forEach((_, i) => {
      const show = !!u.spaces[i] || canRent(i);
      let el = this.tags.get(i);
      if (!show) {
        el?.remove();
        this.tags.delete(i);
        return;
      }
      if (!el) {
        el = document.createElement('div');
        el.className = 'cz-tag';
        el.onclick = (e) => {
          e.stopPropagation();
          this.onPick(i);
        };
        this.overlay.appendChild(el);
        this.tags.set(i, el);
      }
    });
    this.texts();
  }
  /** Textos das etiquetas (4 vezes por segundo) */
  texts() {
    const u = U();
    const g = guide();
    for (const [i, el] of this.tags) {
      const sp = u.spaces[i];
      el.classList.toggle('guide', g === String(i));
      let html: string;
      if (!sp) html = `<span class="cz-build${C.money >= plotCost(i) ? ' ok' : ''}">🔑 Alugar ${money(plotCost(i))}</span>`;
      else if (!sp.zone) html = `<span class="cz-build ok">➕ Escolher o que montar</span>`;
      else {
        const d = ZONE[sp.zone];
        const full = sp.zone === 'recepcao' ? u.recep >= 10 : sp.n >= d.max;
        const up = !full && C.money >= (sp.zone === 'recepcao' ? 0 : zoneCost(d, 1)) && sp.zone !== 'recepcao' ? '<i class="cz-up">⬆</i>' : '';
        html = `<b>${d.icon} ${d.name}${up}</b><span>${sp.zone === 'recepcao' ? `Fachada nv ${u.recep}` : `${sp.n}/${d.max} ${d.unitName}${sp.n > 1 ? 's' : ''}`}</span>`;
      }
      if (el.dataset.h !== html) {
        el.dataset.h = html;
        el.innerHTML = html;
      }
    }
  }
  private placeTags() {
    const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    const v = new THREE.Vector3();
    for (const [i, el] of this.tags) {
      v.set(PLOTS[i].x, 2.4, PLOTS[i].z).project(this.cam);
      const x = ((v.x + 1) / 2) * W, y = ((1 - v.y) / 2) * H;
      const off = x < -80 || x > W + 80 || y < -40 || y > H + 40;
      el.style.display = off ? 'none' : '';
      if (!off) el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
    }
  }
  private float(i: number, text: string, cls = '') {
    if (i < 0) return;
    const v = new THREE.Vector3(PLOTS[i].x, 2.6, PLOTS[i].z).project(this.cam);
    const el = document.createElement('div');
    el.className = `cz-float ${cls}`;
    el.textContent = text;
    el.style.left = `${((v.x + 1) / 2) * this.canvas.clientWidth}px`;
    el.style.top = `${((1 - v.y) / 2) * this.canvas.clientHeight}px`;
    this.overlay.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }
  /** Contorno de luz no salão escolhido */
  select(i: number | null) {
    this.frame.clear();
    if (i === null) return;
    const m = mat('#ffffff', { glow: 2.2, op: 0.9 });
    for (const [x, z, sx, sz] of [[0, -PLOT_D / 2, PLOT_W, 0.12], [0, PLOT_D / 2, PLOT_W, 0.12], [-PLOT_W / 2, 0, 0.12, PLOT_D], [PLOT_W / 2, 0, 0.12, PLOT_D]]) {
      const b = new THREE.Mesh(GEO.box, m);
      b.position.set(x, 0.06, z);
      b.scale.set(sx, 0.08, sz);
      this.frame.add(b);
    }
    this.frame.position.set(PLOTS[i].x, 0, PLOTS[i].z);
  }

  // ===== Alunos andando e treinando =====
  /** Caminho pelos corredores: entra pela porta, passa a catraca e segue pelas divisas dos salões */
  private route(from: THREE.Vector3, seat: Seat) {
    const ri = Math.max(0, this.recep());
    const rp = PLOTS[ri];
    const target = PLOTS.reduce((b, p) => (Math.hypot(p.x - seat.p.x, p.z - seat.p.z) < Math.hypot(b.x - seat.p.x, b.z - seat.p.z) ? p : b));
    const aisle = (z: number) => z + PLOT_D / 2 - 0.45;
    const side = seat.p.x < target.x ? -1 : 1;
    const xb = target.x + side * (PLOT_W / 2 - 0.35);
    return [from.clone(), new THREE.Vector3(rp.x, 0, aisle(rp.z)), new THREE.Vector3(xb, 0, aisle(rp.z)), new THREE.Vector3(xb, 0, aisle(target.z)), new THREE.Vector3(seat.p.x, 0, aisle(target.z)), new THREE.Vector3(seat.p.x, 0, seat.p.z)];
  }
  private seats() {
    return this.plots.flatMap((p, i) => (U().spaces[i]?.zone && U().spaces[i]!.zone !== 'recepcao' ? p.seats : []));
  }
  private spawn() {
    const all = this.seats();
    if (!all.length) return;
    const free = all.filter((s) => !this.agents.some((a) => a.seat === s));
    const seat = free[Math.floor(Math.random() * free.length)];
    if (!seat) return;
    const rp = PLOTS[Math.max(0, this.recep())];
    const start = new THREE.Vector3(rp.x + (Math.random() - 0.5) * 3, 0, rp.z + PLOT_D / 2 + 2.5);
    const mix = S.flows[C.active]?.mix ?? {};
    let pick = Math.random(), type = GUESTS[0];
    for (const g of GUESTS) if ((pick -= mix[g.id] ?? 0) <= 0) { type = g; break; }
    this.agents.push({
      path: this.route(start, seat), seg: 0, wait: 0, seat, leave: false, speed: 1.6 + Math.random() * 0.6, phase: Math.random() * 6, dir: 0, lane: Math.random(),
      color: new THREE.Color(type.color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.2), skin: SKIN[Math.floor(Math.random() * SKIN.length)], hair: HAIR[Math.floor(Math.random() * HAIR.length)], pos: start.clone(),
    });
  }
  private walk(dt: number) {
    const u = U();
    // Quem está na academia agora: uns 4% dos alunos, como num horário comum
    const want = Math.min(MAX_AGENTS, Math.round(u.members * 0.04) + 2);
    this.spawnAcc += dt * 1.5;
    while (this.spawnAcc > 1) {
      this.spawnAcc--;
      if (this.agents.filter((a) => !a.leave).length < want) this.spawn();
    }
    let n = 0;
    this.agents = this.agents.filter((a) => {
      let act: Act | 'walk' = 'walk';
      if (a.wait > 0) {
        a.wait -= dt;
        act = a.seat!.act;
        a.phase += dt;
        if (a.wait <= 0) {
          a.leave = true;
          const rp = PLOTS[Math.max(0, this.recep())];
          a.path = this.route(new THREE.Vector3(rp.x + (Math.random() - 0.5) * 3, 0, rp.z + PLOT_D / 2 + 2.5), a.seat!).reverse();
          a.seg = 0;
        }
      } else {
        const to = a.path[a.seg + 1];
        if (!to) {
          if (a.leave) return false;
          a.wait = 10 + Math.random() * 14;
          a.pos.copy(a.seat!.p);
          a.dir = a.seat!.rot;
        } else {
          const d = to.clone().sub(a.pos);
          const len = d.length(), step = a.speed * dt;
          if (len <= step) {
            a.pos.copy(to);
            a.seg++;
          } else {
            a.pos.addScaledVector(d, step / len);
            a.dir = Math.atan2(d.x, d.z);
          }
          a.phase += dt * a.speed * 0.7;
        }
      }
      if (n >= MAX_AGENTS) return true;
      const p: Pose = pose(act, a.phase, a.seat?.h ?? 0);
      const at = a.pos.clone();
      // Na piscina, nada de um lado para o outro da raia
      if (act === 'swim' && a.seat) at.z += Math.sin(a.phase * 0.5 + a.lane * 6) * 2.4;
      const dir = act === 'swim' && a.seat ? a.seat.rot + (Math.cos(a.phase * 0.5 + a.lane * 6) > 0 ? 0 : Math.PI) : a.dir;
      this.people.set(n++, at, dir, p, a.color, a.skin, a.hair);
      return true;
    });
    this.people.count(n);
  }

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    this.onFrame(dt);
    this.target.lerp(this.goal, 1 - Math.exp(-dt * 6));
    this.cam.position.copy(this.target).add(new THREE.Vector3(26, 34, 40));
    this.cam.lookAt(this.target);
    this.sun.position.copy(this.target).add(new THREE.Vector3(18, 40, 24));
    this.sun.target.position.copy(this.target);
    for (const p of this.plots) for (const s of p.spin ?? []) s.m.rotation[s.axis ?? 'y'] += dt * s.s;
    if ((this.texAcc += dt) > 0.1) {
      this.texAcc = 0;
      MACHINES.screens(this.t);
    }
    this.walk(dt);
    this.placeTags();
    if (this.post) this.post.render(dt);
    else this.r.render(this.scene, this.cam);
  };

  // ===== Toque, arrastar e pinça =====
  private down = (e: PointerEvent) => {
    this.canvas.setPointerCapture(e.pointerId);
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.moved = 0;
  };
  private move = (e: PointerEvent) => {
    const prev = this.ptrs.get(e.pointerId);
    if (!prev) return;
    if (this.ptrs.size === 2) {
      const [a, b] = [...this.ptrs.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [c, d] = [...this.ptrs.values()];
      this.setZoom(this.zoom * (before / Math.max(1, Math.hypot(c.x - d.x, c.y - d.y))));
      this.moved += 10;
      return;
    }
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.moved += Math.abs(dx) + Math.abs(dy);
    const k = (this.cam.top - this.cam.bottom) / this.canvas.clientHeight;
    const right = new THREE.Vector3().setFromMatrixColumn(this.cam.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(this.cam.matrixWorld, 1);
    const fwd = new THREE.Vector3(up.x, 0, up.z).normalize().multiplyScalar(up.length() / Math.max(0.2, Math.hypot(up.x, up.z)));
    this.goal.addScaledVector(right.setY(0), -dx * k).addScaledVector(fwd, dy * k);
    this.goal.x = Math.max(-28, Math.min(28, this.goal.x));
    this.goal.z = Math.max(-20, Math.min(26, this.goal.z));
    this.goal.y = 0;
    this.target.copy(this.goal);
  };
  private up = (e: PointerEvent) => {
    const had = this.ptrs.delete(e.pointerId);
    if (!had || this.moved > 8 || this.ptrs.size) return;
    const rect = this.canvas.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), this.cam);
    const hit = ray.intersectObjects(this.pick.filter(Boolean), false)[0];
    const i = hit ? this.pick.indexOf(hit.object as THREE.Mesh) : -1;
    this.onPick(i >= 0 && (U().spaces[i] || canRent(i)) ? i : null);
  };
  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    this.setZoom(this.zoom * (e.deltaY > 0 ? 1.1 : 0.9));
  };
  setZoom(z: number) {
    this.zoom = Math.max(0.35, Math.min(2.2, z));
    this.resize();
  }
  /** Leva a câmera até um salão */
  focus(i: number) {
    this.goal.set(PLOTS[i].x, 0, PLOTS[i].z + 1);
  }
  resize = () => {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.r.setSize(w, h, false);
    const a = w / h;
    // Em pé o galpão largo não cabe inteiro: mostra uns dois salões e a pessoa arrasta para os lados
    const half = Math.min(Math.max(11, 13 / a) * this.fit, a < 1 ? 17 : 99) * this.zoom;
    Object.assign(this.cam, { left: -half * a, right: half * a, top: half, bottom: -half });
    this.cam.updateProjectionMatrix();
    this.post?.resize(w, h);
  };
  dispose() {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    for (const el of this.tags.values()) el.remove();
    this.post?.dispose();
    this.r.dispose();
    fx.rebuild = () => {};
    fx.level = () => {};
    fx.join = () => {};
  }
}
