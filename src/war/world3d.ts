import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { sound } from '../utils/audio';
import { CAPTURE_S, CITIES, CITY, City, NUKES, POWERS, PowerId, UNITS, UNIT_IDS, UnitId, WORKS_IDS, WorksId } from './data';
import { W, fxQueue } from './match';
import { Fx, Unit, World, allied, eyes, hasRule, mods } from './sim';
import { BAKED, autoQuality, fxTexture, light, makeRenderer, mat, unitGeometry, worksParts } from './models';
import { BOUNDS, H, PHONE, Scenery, spread } from './scenery';

/** Mundo aberto em 3D: terreno, cidades, tropas, efeitos e visão. Lê o estado da partida a cada quadro. */
export interface Tap { x: number; z: number; unit: Unit | null; city: City | null }
interface Shown { x: number; z: number; dir: number; seen: boolean }
interface Shell { k: 'bala' | 'canhao' | 'missil'; x1: number; y1: number; z1: number; x2: number; y2: number; z2: number; t: number; dur: number }
interface Part { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; s0: number; s1: number; r: number; g: number; b: number; a: number }
interface Later { at: number; run: () => void }

const BY_POP = CITIES.map((_, i) => i).sort((a, b) => CITIES[b].pop - CITIES[a].pop);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const altitude = (k: UnitId) => (k === 'caca' ? 1.3 : k === 'heli' ? 0.85 : k === 'recon' ? 1 : k === 'fpv' ? 0.45 : 0);
/** Infantaria aparece como um grupo de três */
const SQUAD = (k: UnitId) => (UNITS[k].cls === 'inf' && k !== 'moto' ? 3 : 1);
const PER_KIND = 130;

/** Partículas em um único desenho */
class Particles {
  list: Part[] = [];
  points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  constructor(private cap: number, tex: THREE.Texture, additive: boolean) {
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 4);
    this.size = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('tint', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, scale: { value: 600 } }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: 'attribute vec4 tint; attribute float size; uniform float scale; varying vec4 c; void main(){ c=tint; vec4 m=modelViewMatrix*vec4(position,1.); gl_PointSize=min(700.,size*scale/-m.z); gl_Position=projectionMatrix*m; }',
      // A fumaça usa só o desenho da textura; a cor vem da partícula
      fragmentShader: `uniform sampler2D map; varying vec4 c; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(${additive ? 't.rgb*c.rgb' : 'c.rgb*(.75+.7*t.r)'},t.a*c.a); if(gl_FragColor.a<.01) discard; }`,
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }
  add(x: number, y: number, z: number, o: Partial<Part>) {
    if (this.list.length >= this.cap) this.list.shift();
    const life = o.life ?? 1;
    this.list.push({ x, y, z, vx: 0, vy: 0, vz: 0, s0: 0.3, s1: 0.6, r: 1, g: 1, b: 1, a: 1, ...o, life, max: life });
  }
  update(dt: number, scale: number) {
    this.list = this.list.filter((p) => (p.life -= dt) > 0);
    this.list.forEach((p, i) => {
      const k = 1 - p.life / p.max;
      p.x += p.vx * dt;
      p.y = Math.max(H, p.y + p.vy * dt);
      p.z += p.vz * dt;
      p.vx *= 1 - dt * 1.5;
      p.vz *= 1 - dt * 1.5;
      this.pos.set([p.x, p.y, p.z], i * 3);
      this.col.set([p.r, p.g, p.b, p.a * Math.min(1, (1 - k) * 2.2) * Math.min(1, k * 12)], i * 4);
      this.size[i] = p.s0 + (p.s1 - p.s0) * Math.sqrt(k);
    });
    const g = this.points.geometry;
    g.setDrawRange(0, this.list.length);
    for (const n of ['position', 'tint', 'size']) g.attributes[n].needsUpdate = true;
    (this.points.material as THREE.ShaderMaterial).uniforms.scale.value = scale;
  }
}

export class World3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
  private controls: MapControls;
  private sun: THREE.DirectionalLight;
  private raf = 0;
  private labels = new Map<number, { sprite: THREE.Sprite; text: string; h: number }>();
  private units = new Map<UnitId, THREE.InstancedMesh>();
  private works = new Map<WorksId, THREE.InstancedMesh[]>();
  private worksSig = '';
  private discs!: THREE.InstancedMesh;
  private barBack!: THREE.InstancedMesh;
  private barFill!: THREE.InstancedMesh;
  private marks: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = [];
  private aimRing: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private shown = new Map<number, Shown>();
  private fire = new Particles(PHONE ? 420 : 800, fxTexture('fire'), true);
  private smoke = new Particles(PHONE ? 420 : 800, fxTexture('smoke'), false);
  private shells: Shell[] = [];
  private tracers!: THREE.LineSegments;
  private rockets!: THREE.InstancedMesh;
  private scorch!: THREE.InstancedMesh;
  private scorchN = 0;
  private later: Later[] = [];
  private actors: { o: THREE.Object3D; t: number; dur: number; move: (k: number) => void }[] = [];
  private rings: { m: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>; t: number; dur: number; r: number }[] = [];
  private fogCtx!: CanvasRenderingContext2D;
  private fogTex!: THREE.CanvasTexture;
  private fogMesh!: THREE.Mesh;
  private seeing: [number, number, number][] = [];
  private fogAt = 0;
  private goal: THREE.Vector3 | null = null;
  private shake = 0;
  private heard = 0;
  private scenery: Scenery;
  private flashes: THREE.PointLight[] = [];
  private rotors!: THREE.InstancedMesh;
  private hot = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>();
  selected = new Set<number>();
  focus = 0;
  /** Apoio sendo mirado */
  aim: PowerId | null = null;
  boxing = false;
  onTap: (t: Tap) => void = () => {};
  onDouble: (u: Unit, near: Unit[]) => void = () => {};
  onBox: (ids: number[]) => void = () => {};
  /** Retângulo de seleção na tela */
  onRect: (r: { x: number; y: number; w: number; h: number } | null) => void = () => {};
  onFlash: () => void = () => {};

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = makeRenderer(canvas);
    this.renderer.toneMappingExposure = 1.15;
    const sky = new THREE.Color('#cfd3cc');
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, 60, 175);
    this.sun = light(this.scene, 42, '#ffe2b8', 2.9);
    this.scene.add(this.sun.target);
    this.camera.position.set(0, 74, 42);
    this.controls = new MapControls(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.14, minDistance: 2.6, maxDistance: 90, maxPolarAngle: 1.22, zoomToCursor: true });
    this.scenery = new Scenery(this.scene);
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight('#ffb45a', 0, 9, 1.6);
      this.flashes.push(l);
      this.scene.add(l);
    }
    this.pools();
    this.fogLayer();
    this.aimRing = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f87171', transparent: true, opacity: 0.9, depthTest: false }));
    this.aimRing.visible = false;
    this.scene.add(this.aimRing, this.fire.points, this.smoke.points);
    this.input();
    const quality = autoQuality(this.renderer);
    let last = performance.now();
    let n = 0;
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      quality((now - last) / 1000);
      last = now;
      this.resize();
      this.move(dt);
      this.draw(dt, now);
      if (++n % 3 === 0) this.renderer.shadowMap.needsUpdate = true;
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(frame);
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    this.controls.dispose();
    this.labels.forEach((l) => l.sprite.material.map?.dispose());
    this.scene.traverse((o) => { if (o instanceof THREE.Mesh || o instanceof THREE.Points) o.geometry.dispose(); });
    this.renderer.dispose();
  }
  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const s = this.renderer.getSize(new THREE.Vector2());
    if (!w || !h || (s.x === w && s.y === h)) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 56 : 42;
    this.camera.updateProjectionMatrix();
  }
  private get dist() {
    return this.camera.position.distanceTo(this.controls.target);
  }
  private move(dt: number) {
    if (this.goal) {
      const d = this.goal.clone().sub(this.controls.target).multiplyScalar(Math.min(1, dt * 6));
      this.controls.target.add(d);
      this.camera.position.add(d);
      if (d.length() < 0.004) this.goal = null;
    }
    const t = this.controls.target;
    const before = t.clone();
    t.set(THREE.MathUtils.clamp(t.x, BOUNDS.x0, BOUNDS.x1), H, THREE.MathUtils.clamp(t.z, BOUNDS.z0, BOUNDS.z1));
    this.camera.position.add(t.clone().sub(before).setY(0));
    this.controls.update();
    const reach = THREE.MathUtils.clamp(this.dist * 1.1, 6, 44);
    const c = this.sun.shadow.camera;
    if (Math.abs(c.right - reach) > reach * 0.08) {
      c.left = c.bottom = -reach;
      c.right = c.top = reach;
      c.updateProjectionMatrix();
    }
    this.sun.target.position.copy(t);
    this.sun.position.set(t.x - 32, 46, t.z + 20);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 0.8);
      this.camera.position.x += rand(-1, 1) * this.shake * 0.12;
      this.camera.position.y += rand(-1, 1) * this.shake * 0.12;
    }
  }
  /** Leva a câmera até um ponto */
  go(x: number, z: number, distance?: number) {
    this.goal = new THREE.Vector3(x, H, z);
    const off = this.camera.position.clone().sub(this.controls.target);
    if (distance && off.length() > distance) this.camera.position.copy(this.controls.target).add(off.setLength(distance));
  }
  get mask() {
    return this.scenery.mask;
  }
  center() {
    return { x: this.controls.target.x, z: this.controls.target.z };
  }

  private pools() {
    const add = <T extends THREE.Object3D>(o: T) => {
      o.frustumCulled = false;
      this.scene.add(o);
      return o;
    };
    const inst = (geo: THREE.BufferGeometry, m: THREE.Material, n: number, order = 0) => {
      const x = new THREE.InstancedMesh(geo, m, n);
      x.count = 0;
      x.renderOrder = order;
      return add(x);
    };
    for (const k of UNIT_IDS) {
      const m = inst(unitGeometry(k), BAKED, PER_KIND * SQUAD(k));
      m.setColorAt(0, new THREE.Color());
      m.castShadow = true;
      this.units.set(k, m);
    }
    for (const k of ['comando', ...WORKS_IDS] as WorksId[]) {
      this.works.set(k, worksParts(k).map((p) => {
        const m = inst(p.geo, p.mat, 140);
        m.castShadow = p.mat !== undefined;
        return m;
      }));
    }
    const flat = (g: THREE.BufferGeometry) => g.rotateX(-Math.PI / 2);
    this.discs = inst(flat(new THREE.RingGeometry(0.8, 1, 24)), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -30 }), 400, 3);
    this.discs.setColorAt(0, new THREE.Color());
    const quad = new THREE.PlaneGeometry(1, 1);
    this.rotors = inst(flat(new THREE.CircleGeometry(1, 20)), new THREE.MeshBasicMaterial({ color: '#1f2937', transparent: true, opacity: 0.28, depthWrite: false }), 260, 3);
    this.barBack = inst(quad, new THREE.MeshBasicMaterial({ color: '#0a0d12', depthTest: false, transparent: true, opacity: 0.8 }), 600, 6);
    this.barFill = inst(quad, new THREE.MeshBasicMaterial({ depthTest: false, transparent: true }), 600, 7);
    this.barFill.setColorAt(0, new THREE.Color());
    this.rockets = inst(new THREE.ConeGeometry(0.022, 0.13, 6).rotateZ(-Math.PI / 2), mat('#e5e7eb'), 120);
    this.scorch = inst(flat(new THREE.PlaneGeometry(2.6, 2.6)), new THREE.MeshBasicMaterial({ color: '#15110c', map: fxTexture('smoke'), transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -20 }), 90, 2);
    const line = new THREE.BufferGeometry();
    line.setAttribute('position', new THREE.BufferAttribute(new Float32Array(160 * 6), 3));
    this.tracers = add(new THREE.LineSegments(line, new THREE.LineBasicMaterial({ color: '#ffd98a', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending })));
    this.tracers.renderOrder = 4;
  }

  // ===== Visão =====
  private fogLayer() {
    const c = document.createElement('canvas');
    c.width = 192;
    c.height = Math.round((192 * BOUNDS.h) / BOUNDS.w);
    this.fogCtx = c.getContext('2d')!;
    this.fogTex = new THREE.CanvasTexture(c);
    this.fogTex.colorSpace = THREE.SRGBColorSpace;
    this.fogMesh = new THREE.Mesh(new THREE.PlaneGeometry(BOUNDS.w, BOUNDS.h).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.fogTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -16 }));
    this.fogMesh.position.set((BOUNDS.x0 + BOUNDS.x1) / 2, H + 0.01, (BOUNDS.z0 + BOUNDS.z1) / 2);
    this.fogMesh.renderOrder = 2;
    this.fogMesh.visible = false;
    this.scene.add(this.fogMesh);
  }
  private open(w: World) {
    return hasRule(w, 'aberto') || !w.players[W.me].alive || !!w.over || !!(mods.get(W.me)?.vision && mods.get(W.me)!.vision! > 5);
  }
  private updateFog(w: World, now: number) {
    if (now < this.fogAt) return;
    this.fogAt = now + 220;
    this.fogMesh.visible = !this.open(w);
    this.seeing = eyes(w, W.me);
    if (!this.fogMesh.visible) return;
    const x = this.fogCtx;
    const { width, height } = x.canvas;
    const s = width / BOUNDS.w;
    x.globalCompositeOperation = 'source-over';
    x.clearRect(0, 0, width, height);
    x.fillStyle = 'rgba(8,12,20,.46)';
    x.fillRect(0, 0, width, height);
    x.globalCompositeOperation = 'destination-out';
    for (const [px, pz, r] of this.seeing) {
      const [cx, cy, cr] = [(px - BOUNDS.x0) * s, (pz - BOUNDS.z0) * s, r * s];
      const g = x.createRadialGradient(cx, cy, cr * 0.65, cx, cy, cr);
      g.addColorStop(0, '#000');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
    }
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(this.scenery.mask, 0, 0, width, height);
    this.fogTex.needsUpdate = true;
  }
  private sees(w: World, x: number, z: number) {
    return this.open(w) || this.seeing.some(([a, b, r]) => (a - x) ** 2 + (b - z) ** 2 < r * r);
  }

  // ===== Quadro =====
  private draw(dt: number, now: number) {
    this.scenery.update(dt, this.dist < 26);
    for (const l of this.flashes) l.intensity *= Math.max(0, 1 - dt * 5);
    const w = W.world;
    if (w) {
      this.updateFog(w, now);
      for (const f of fxQueue.splice(0)) this.effect(f, now);
      this.drawWorks(w);
      this.drawUnits(w, dt, now);
      this.ambience(w, dt);
    } else {
      fxQueue.length = 0;
      this.fogMesh.visible = false;
      for (const m of this.units.values()) m.count = 0;
      this.works.forEach((l) => l.forEach((m) => { m.count = 0; }));
      this.worksSig = '';
      this.rotors.count = this.discs.count = this.barBack.count = this.barFill.count = 0;
    }
    this.drawLabels(w);
    this.drawMarks(now);
    this.drawShells(dt);
    this.later = this.later.filter((l) => now < l.at || (l.run(), false));
    this.actors = this.actors.filter((a) => {
      a.t += dt;
      a.move(Math.min(1, a.t / a.dur));
      if (a.t < a.dur) return true;
      this.scene.remove(a.o);
      return false;
    });
    this.rings = this.rings.filter((r) => {
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      r.m.scale.setScalar(0.05 + r.r * Math.sqrt(k));
      r.m.material.opacity = (1 - k) * 0.6;
      if (k < 1) return true;
      this.scene.remove(r.m);
      r.m.geometry.dispose();
      r.m.material.dispose();
      return false;
    });
    const scale = (this.renderer.domElement.height / 2) / Math.tan((this.camera.fov * Math.PI) / 360);
    this.fire.update(dt, scale);
    this.smoke.update(dt, scale);
    this.aimRing.visible = !!this.aim;
    if (this.aim) {
      const t = this.controls.target;
      this.aimRing.position.set(t.x, H + 0.05, t.z);
      this.aimRing.scale.setScalar(POWERS[this.aim].radius * (1 + Math.sin(now / 180) * 0.04));
      this.aimRing.material.color.set(POWERS[this.aim].color);
    }
  }
  /** Aumenta um pouco as peças quando a câmera se afasta */
  private get zoom() {
    return THREE.MathUtils.clamp(this.dist / 9, 1, 2.6);
  }
  private drawUnits(w: World, dt: number, now: number) {
    const count = Object.fromEntries(UNIT_IDS.map((k) => [k, 0])) as Record<UnitId, number>;
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const size = new THREE.Vector3();
    const white = new THREE.Color('#ffffff');
    const tint = new THREE.Color();
    const zoom = this.zoom;
    const s = 0.125 * zoom;
    let discs = 0;
    let rotors = 0;
    let bars = 0;
    const alive = new Set<number>();
    const far = this.dist * 1.6 + 4;
    for (const u of w.units) {
      alive.add(u.i);
      let v = this.shown.get(u.i);
      if (!v) this.shown.set(u.i, (v = { x: u.x, z: u.z, dir: u.dir, seen: false }));
      const jump = Math.hypot(u.x - v.x, u.z - v.z) > 3;
      const k = jump ? 1 : Math.min(1, dt * 7);
      const moving = Math.hypot(u.x - v.x, u.z - v.z) > 0.012;
      v.x += (u.x - v.x) * k;
      v.z += (u.z - v.z) * k;
      let turn = u.dir - v.dir;
      turn = Math.atan2(Math.sin(turn), Math.cos(turn));
      v.dir += turn * Math.min(1, dt * 8);
      const friend = allied(w, u.o, W.me);
      v.seen = friend || this.sees(w, u.x, u.z);
      if (!v.seen || Math.hypot(v.x - this.controls.target.x, v.z - this.controls.target.z) > far) continue;
      const mesh = this.units.get(u.k)!;
      const squad = SQUAD(u.k);
      const color = w.players[u.o].color;
      tint.set(color).lerp(white, 0.55);
      if (u.off > 0) tint.multiplyScalar(0.45);
      const alt = altitude(u.k) * (u.off > 0 ? 0.4 : 1);
      const men = squad === 1 ? 1 : Math.max(1, Math.ceil((u.hp / u.max) * squad));
      for (let n = 0; n < men; n++) {
        if (count[u.k] >= mesh.instanceMatrix.count) break;
        const a = v.dir + n * 2.1 + 0.6;
        const off = squad > 1 ? 0.075 * zoom : 0;
        const bob = squad > 1 && moving ? Math.abs(Math.sin(now / 90 + n + u.i)) * 0.015 * zoom : alt ? Math.sin(now / 420 + u.i) * 0.03 : 0;
        q.setFromAxisAngle(up, -v.dir);
        pos.set(v.x + Math.cos(a) * off, H + alt + bob, v.z + Math.sin(a) * off);
        mesh.setMatrixAt(count[u.k], m.compose(pos, q, size.setScalar(s)));
        mesh.setColorAt(count[u.k]++, tint);
      }
      if ((u.k === 'heli' || u.k === 'recon' || u.k === 'fpv') && u.off <= 0 && rotors < 260) {
        pos.set(v.x, H + alt + (u.k === 'heli' ? 0.085 : 0.02) * zoom, v.z);
        this.rotors.setMatrixAt(rotors++, m.compose(pos, q.identity(), size.setScalar((u.k === 'heli' ? 0.15 : 0.06) * zoom * (0.94 + Math.random() * 0.08))));
      }
      // Estrelas de veterano
      if (u.star && this.dist < 14 && Math.random() < dt * u.star * 2) this.fire.add(v.x, H + alt + 0.16, v.z, { life: 0.7, s0: 0.05, s1: 0.02, vy: 0.2, g: 0.85, b: 0.3 });
      // Poeira dos veículos
      if (moving && UNITS[u.k].cls === 'vei' && this.dist < 22 && Math.random() < dt * 5) this.smoke.add(v.x - Math.cos(v.dir) * 0.1, H + 0.02, v.z - Math.sin(v.dir) * 0.1, { life: 0.9, s0: 0.06, s1: 0.28, vy: 0.08, r: 0.72, g: 0.62, b: 0.48, a: 0.4 });
      const picked = this.selected.has(u.i);
      if (discs < 400) {
        pos.set(v.x, H + 0.015, v.z);
        this.discs.setMatrixAt(discs, m.compose(pos, q.identity(), size.setScalar((picked ? 0.17 : 0.11) * zoom)));
        this.discs.setColorAt(discs++, tint.set(picked ? '#ffffff' : color));
      }
      if ((u.hp < u.max * 0.98 || picked) && bars < 590 && this.dist < 40) this.bar(bars++, v.x, H + alt + 0.2 * zoom, v.z, 0.22 * zoom, u.hp / u.max, color);
    }
    for (const id of this.shown.keys()) if (!alive.has(id)) this.shown.delete(id);
    for (const id of this.selected) if (!alive.has(id)) this.selected.delete(id);
    for (const c of w.cities) {
      const on = c.cap > 0 || c.hp < c.max * 0.98;
      if (!on || bars > 590 || this.dist > 45) continue;
      this.bar(bars++, c.x, H + 0.62, c.z, 0.7, c.hp / c.max, c.owner >= 0 ? w.players[c.owner].color : '#e5e7eb');
      if (c.cap > 0 && c.capBy >= 0) this.bar(bars++, c.x, H + 0.72, c.z, 0.7, c.cap / CAPTURE_S, '#ffffff');
    }
    for (const k of UNIT_IDS) {
      const mesh = this.units.get(k)!;
      mesh.count = count[k];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    for (const [x, n] of [[this.discs, discs], [this.rotors, rotors], [this.barBack, bars], [this.barFill, bars]] as const) {
      x.count = n;
      x.instanceMatrix.needsUpdate = true;
      if (x.instanceColor) x.instanceColor.needsUpdate = true;
    }
  }
  private bar(n: number, x: number, y: number, z: number, w: number, k: number, color: string) {
    const m = new THREE.Matrix4();
    const q = this.camera.quaternion;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const f = THREE.MathUtils.clamp(k, 0.02, 1);
    const p = new THREE.Vector3(x, y, z);
    this.barBack.setMatrixAt(n, m.compose(p, q, new THREE.Vector3(w * 1.06, w * 0.2, 1)));
    this.barFill.setMatrixAt(n, m.compose(p.addScaledVector(right, -(w * (1 - f)) / 2), q, new THREE.Vector3(w * f, w * 0.13, 1)));
    this.barFill.setColorAt(n, new THREE.Color(k < 0.3 ? '#ef4444' : color));
  }
  private drawWorks(w: World) {
    const sig = w.cities.map((c) => (c.works.length ? c.works.map((k) => k.k + (k.left > 0 ? '~' : '')).join() : '')).join('|');
    if (sig === this.worksSig) return;
    this.worksSig = sig;
    const n = {} as Record<WorksId, number>;
    for (const c of w.cities) {
      c.works.forEach((k, i) => {
        const { x, z } = this.slot(c.id, i, k.k);
        const list = this.works.get(k.k)!;
        const at = n[k.k] ?? 0;
        if (at >= 140) return;
        n[k.k] = at + 1;
        const s = k.k === 'comando' ? 0.1 : 0.085;
        // Em obras: ainda saindo do chão
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, H, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.9), new THREE.Vector3(s, k.left > 0 ? s * 0.35 : s, s));
        list.forEach((mesh) => mesh.setMatrixAt(at, m));
      });
    }
    this.works.forEach((l, k) => l.forEach((m) => {
      m.count = n[k] ?? 0;
      m.instanceMatrix.needsUpdate = true;
    }));
  }
  private slot(city: number, i: number, k: WorksId) {
    const c = CITY[city];
    if (k === 'comando') return { x: c.x, z: c.z };
    const r = spread(c) * 0.75 + 0.28;
    let a = i * 2.4 + (city % 10);
    // Nunca dentro do mar
    for (let k = 0; k < 8 && !this.scenery.land(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r); k++) a += 0.75;
    return { x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r };
  }
  /** Fumaça de zonas e cidades atingidas */
  private ambience(w: World, dt: number) {
    for (const z of w.zones) {
      if (z.k === 'fumaca' && Math.random() < dt * 22) this.smoke.add(z.x + rand(-1, 1), H + 0.1, z.z + rand(-1, 1), { life: 2.6, s0: 0.5, s1: 1.5, vy: 0.12, r: 0.85, g: 0.87, b: 0.9, a: 0.7 });
    }
    const live = new Set<string>();
    const disc = (key: string, x: number, z: number, radius: number, color: string, opacity: number) => {
      live.add(key);
      let m = this.hot.get(key);
      if (!m) {
        m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: fxTexture('glow'), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
        m.renderOrder = 3;
        this.scene.add(m);
        this.hot.set(key, m);
      }
      m.position.set(x, H + 0.03, z);
      m.scale.setScalar(radius);
      m.material.color.set(color);
      m.material.opacity = opacity;
    };
    const beat = 0.55 + Math.sin(performance.now() / 110) * 0.35;
    for (const z of w.zones) if (NUKES[z.k] && z.tick < 90) disc(`n${z.x},${z.z}`, z.x, z.z, POWERS[z.k].radius * 1.25, '#ff2a1a', beat);
    for (const a of w.rads) {
      disc(`r${a.x},${a.z}`, a.x, a.z, a.r * 1.35, '#7dff3a', Math.min(0.5, a.left / 20) * (0.75 + beat * 0.3));
      if (Math.random() < dt * 9) this.smoke.add(a.x + rand(-a.r, a.r), H + 0.1, a.z + rand(-a.r, a.r), { life: 3, s0: 0.2, s1: 0.9, vy: 0.16, r: 0.45, g: 0.6, b: 0.25, a: 0.35 });
    }
    for (const [k, m] of this.hot) {
      if (live.has(k)) continue;
      this.scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
      this.hot.delete(k);
    }
    for (const c of w.cities) {
      if (c.hp > c.max * 0.6 || Math.random() > dt * 5) continue;
      const r = spread(CITY[c.id]) * 0.8;
      const [x, z] = [c.x + rand(-r, r), c.z + rand(-r, r)];
      if (Math.random() < 0.5) this.fire.add(x, H + 0.06, z, { life: 0.6, s0: 0.12, s1: 0.3, vy: 0.3 });
      this.smoke.add(x, H + 0.15, z, { life: 2.4, s0: 0.14, s1: 0.75, vy: 0.42, vx: 0.12, r: 0.16, g: 0.16, b: 0.17, a: 0.65 });
    }
  }

  // ===== Nomes e cores =====
  private drawLabels(w: World | null) {
    const d = this.dist;
    const min = d > 55 ? 150_000 : d > 38 ? 70_000 : d > 25 ? 45_000 : d > 15 ? 25_000 : d > 10 ? 14_000 : 0;
    const t = this.controls.target;
    const taken: [number, number][] = [];
    const at = new THREE.Vector3();
    const gap = this.canvas.clientWidth || 400;
    for (const i of BY_POP) {
      const c = CITIES[i];
      const s = w?.cities[i];
      const seat = w ? null : W.seats.find((x) => x.start === c.id);
      const owner = s && s.owner >= 0 ? w!.players[s.owner] : null;
      const color = owner?.color ?? (seat ? (seat.id === W.seat ? '#f5b301' : '#ff3b3b') : '');
      this.scenery.paint(c.id, color);
      const key = !!color || c.id === this.focus;
      let show = (c.pop >= min || key) && Math.hypot(c.x - t.x, c.z - t.z) < d * 1.5 + 4;
      if (show) {
        // Nomes não se sobrepõem: o da maior cidade fica
        at.set(c.x, H + 0.95, c.z).project(this.camera);
        const [x, y] = [(at.x * gap) / 2, (at.y * this.canvas.clientHeight) / 2];
        show = key || !taken.some(([a, b]) => Math.abs(a - x) < 110 && Math.abs(b - y) < 24);
        if (show) taken.push([x, y]);
      }
      const old = this.labels.get(c.id);
      if (!show) {
        if (old) old.sprite.visible = false;
        continue;
      }
      const text = `${owner ? `${owner.emblem} ` : seat ? `${seat.emblem} ` : ''}${c.name}${seat ? ` (${seat.name})` : ` ${c.level}★`}${s?.cap ? ' ⚑' : ''}`;
      let l = old;
      if (old?.text !== text + color) {
        if (old) {
          this.scene.remove(old.sprite);
          old.sprite.material.map?.dispose();
          old.sprite.material.dispose();
        }
        const sprite = this.label(text, color);
        sprite.position.set(c.x, H + 0.95, c.z);
        this.scene.add(sprite);
        this.labels.set(c.id, (l = { sprite, text: text + color, h: 0 }));
      }
      l!.sprite.visible = true;
    }
  }
  private label(text: string, color: string) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    const font = '700 30px Inter, sans-serif';
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 28;
    c.width = w;
    c.height = 46;
    ctx.font = font;
    ctx.fillStyle = 'rgba(8,11,17,.8)';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, 46, 14);
    ctx.fill();
    if (color) {
      ctx.fillStyle = color;
      ctx.fillRect(12, 39, w - 24, 5);
    }
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 14, 22);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false, fog: false }));
    const k = PHONE ? 0.026 : 0.023;
    s.scale.set((w / 46) * k, k, 1);
    s.renderOrder = 8;
    return s;
  }
  /** Sinais dos jogadores no mapa */
  private drawMarks(now: number) {
    const list = W.pings.filter((p) => Date.now() - p.at < 5000);
    while (this.marks.length < list.length) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ depthTest: false, transparent: true }));
      m.renderOrder = 9;
      this.scene.add(m);
      this.marks.push(m);
    }
    this.marks.forEach((m, i) => {
      const p = list[i];
      m.visible = !!p;
      if (!p) return;
      m.position.set(p.x, H + 0.5 + Math.abs(Math.sin(now / 200)) * 0.35, p.z);
      m.scale.setScalar(this.zoom);
      m.material.color.set(W.world?.players[p.i]?.color ?? '#fff');
    });
  }

  // ===== Efeitos =====
  private play(x: number, z: number, gap: number, run: () => void) {
    const t = performance.now();
    if (t < this.heard || Math.hypot(x - this.controls.target.x, z - this.controls.target.z) > this.dist * 1.1) return;
    this.heard = t + gap;
    run();
  }
  private effect([k, x1, z1, x2, z2, air = 0]: Fx, now: number) {
    const near = Math.hypot(x2 - this.controls.target.x, z2 - this.controls.target.z) < this.dist * 1.7 + 5;
    if (k === 'bala' || k === 'canhao' || k === 'missil') {
      if (!near || this.shells.length > 150) return;
      const d = Math.hypot(x2 - x1, z2 - z1);
      const y1 = H + (air & 2 ? 0.8 : 0.12);
      const y2 = H + (air & 1 ? 0.8 : 0.08);
      this.shells.push({ k, x1, y1, z1, x2, y2, z2, t: 0, dur: k === 'bala' ? 0.07 + d * 0.06 : k === 'canhao' ? 0.18 + d * 0.16 : 0.3 + d * 0.2 });
      this.fire.add(x1, y1, z1, { life: 0.12, s0: k === 'bala' ? 0.09 : 0.3, s1: k === 'bala' ? 0.05 : 0.15 });
      if (k !== 'bala') this.smoke.add(x1, y1, z1, { life: 0.8, s0: 0.08, s1: 0.35, vy: 0.1, r: 0.6, g: 0.6, b: 0.6, a: 0.5 });
      this.play(x1, z1, k === 'bala' ? 130 : 220, () => (k === 'bala' ? sound.playGuns(0.4) : k === 'canhao' ? sound.playImpact() : sound.playLaunch()));
    } else if (k === 'bum') {
      if (near) this.boom(x2, H + 0.1, z2, 1);
    } else if (k === 'destroco' || k === 'queda') {
      if (!near) return;
      this.boom(x2, H + (k === 'queda' ? 0.8 : 0.12), z2, 0.9);
      for (let i = 0; i < 6; i++) this.later.push({ at: now + i * 350, run: () => this.smoke.add(x2, H + 0.1, z2, { life: 2.2, s0: 0.12, s1: 0.6, vy: 0.4, r: 0.12, g: 0.12, b: 0.12, a: 0.7 }) });
      if (k === 'queda') for (let i = 0; i < 10; i++) this.fire.add(x2 + rand(-0.1, 0.1), H + 0.8, z2 + rand(-0.1, 0.1), { life: 0.9, s0: 0.12, s1: 0.04, vy: -0.9, vx: rand(-0.3, 0.3), vz: rand(-0.3, 0.3) });
    } else if (k === 'baixa') {
      if (near) this.smoke.add(x2, H + 0.08, z2, { life: 0.6, s0: 0.08, s1: 0.25, vy: 0.15, r: 0.4, g: 0.33, b: 0.28, a: 0.6 });
    } else if (k === 'tomada') {
      this.ring(x2, z2, 2, '#ffffff', 1);
      for (let i = 0; i < 16; i++) this.fire.add(x2, H + 0.4, z2, { life: 1.2, s0: 0.1, s1: 0.03, vy: rand(0.4, 1.2), vx: rand(-0.8, 0.8), vz: rand(-0.8, 0.8) });
      this.play(x2, z2, 400, () => sound.playRecruit());
    } else if (k === 'estrela') {
      if (near) this.ring(x2, z2, 0.4, '#facc15', 0.8);
    } else if (k === 'interceptado') {
      // Antimíssil sobe e encontra a ogiva no céu
      const g = this.body(new THREE.ConeGeometry(0.04, 0.3, 8), '#7dd3fc');
      this.actors.push({ o: g, t: 0, dur: 0.7, move: (t) => {
        g.position.set(x1 + (x2 - x1) * t, H + 4 * t, z1 + (z2 - z1) * t);
        this.smoke.add(g.position.x, g.position.y, g.position.z, { life: 1, s0: 0.1, s1: 0.4, a: 0.6 });
      } });
      this.later.push({ at: now + 700, run: () => {
        for (let i = 0; i < 3; i++) this.boom(x2 + rand(-0.3, 0.3), H + 4 + rand(-0.3, 0.3), z2 + rand(-0.3, 0.3), 1.6);
        this.ring(x2, z2, 2.5, '#7dd3fc', 1);
      } });
    } else if (k === 'nuclear') this.nuke(x2, z2, now, x1);
    else if (POWERS[k as PowerId]) this.power(k as PowerId, x1, z1, x2, z2, now);
  }
  private body(geo: THREE.BufferGeometry, color: string) {
    const m = new THREE.Mesh(geo, mat(color, { metal: 0.4, rough: 0.4 }));
    m.castShadow = true;
    this.scene.add(m);
    return m;
  }
  private power(k: PowerId, x1: number, z1: number, x: number, z: number, now: number) {
    this.ring(x, z, POWERS[k].radius, POWERS[k].color, 1.2);
    if (k === 'emp') {
      for (let i = 0; i < 4; i++) this.later.push({ at: now + i * 130, run: () => this.ring(x, z, POWERS.emp.radius, '#7dd3fc', 0.6) });
      this.play(x, z, 300, () => sound.playSabotage());
    } else if (k === 'reparo') {
      for (let i = 0; i < 26; i++) this.fire.add(x + rand(-1.3, 1.3), H + 0.1, z + rand(-1.3, 1.3), { life: 1.2, s0: 0.14, s1: 0.04, vy: 0.6, r: 0.3, g: 1, b: 0.45 });
    } else if (k === 'aereo') {
      const a = rand(0, 6.28);
      for (const off of [-0.5, 0, 0.5]) this.flyby(x, z, a, off);
      sound.playJet();
    } else if (k === 'paraquedas') {
      for (let i = 0; i < 5; i++) this.chute(x + rand(-0.5, 0.5), z + rand(-0.5, 0.5));
      this.flyby(x, z, rand(0, 6.28), 0);
    } else if (NUKES[k]) {
      // Sirene, lançamento do silo e voo até o alvo, para todos
      sound.playSiren();
      sound.playLaunch();
      const big = NUKES[k]!.size;
      const g = this.body(new THREE.CylinderGeometry(0.02, 0.06, 0.55, 10).scale(big + 0.4, big + 0.4, big + 0.4), '#e5e7eb');
      const top = 7 + Math.hypot(x - x1, z - z1) * 0.35;
      const at = (t: number) => new THREE.Vector3(x1 + (x - x1) * t, H + Math.sin(t * Math.PI) * top, z1 + (z - z1) * t);
      for (let i = 0; i < 14; i++) this.smoke.add(x1 + rand(-0.2, 0.2), H + 0.1, z1 + rand(-0.2, 0.2), { life: 2.6, s0: 0.2, s1: 1, vx: rand(-0.5, 0.5), vz: rand(-0.5, 0.5), vy: 0.1, a: 0.7 });
      this.actors.push({ o: g, t: 0, dur: NUKES[k]!.flight, move: (t) => {
        const p = at(t);
        g.position.copy(p);
        g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), at(Math.min(1, t + 0.01)).sub(at(Math.max(0, t - 0.01))).normalize());
        this.fire.add(p.x, p.y, p.z, { life: 0.35, s0: 0.35 * (big + 0.4), s1: 0.1 });
        this.smoke.add(p.x, p.y, p.z, { life: 2.8, s0: 0.12, s1: 0.5, a: 0.5 });
      } });
    } else if (k === 'satelite') sound.playSonar();
    else this.play(x, z, 300, () => sound.playLaunch());
  }
  private flyby(x: number, z: number, a: number, off: number) {
    const m = new THREE.Mesh(unitGeometry('caca'), BAKED);
    m.scale.setScalar(0.34);
    m.rotation.y = -a;
    m.castShadow = true;
    this.scene.add(m);
    this.actors.push({ o: m, t: 0, dur: 3, move: (k) => {
      const d = (k - 0.5) * 34;
      m.position.set(x + Math.cos(a) * d - Math.sin(a) * off, H + 2, z + Math.sin(a) * d + Math.cos(a) * off);
      this.smoke.add(m.position.x - Math.cos(a) * 0.4, m.position.y, m.position.z - Math.sin(a) * 0.4, { life: 0.8, s0: 0.08, s1: 0.2, a: 0.25 });
    } });
  }
  private chute(x: number, z: number) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e7e5d8'));
    this.scene.add(m);
    this.actors.push({ o: m, t: 0, dur: 1.6, move: (k) => m.position.set(x + Math.sin(k * 5) * 0.06, H + 2.2 * (1 - k) + 0.1, z) });
  }
  private ring(x: number, z: number, r: number, color: string, dur: number) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, depthTest: false }));
    m.position.set(x, H + 0.04, z);
    m.renderOrder = 4;
    this.scene.add(m);
    this.rings.push({ m, t: 0, dur, r });
  }
  private boom(x: number, y: number, z: number, s: number) {
    for (let i = 0; i < 6; i++) this.fire.add(x + rand(-0.1, 0.1) * s, y, z + rand(-0.1, 0.1) * s, { life: rand(0.25, 0.5), s0: 0.2 * s, s1: rand(0.5, 0.85) * s, vy: rand(0.1, 0.6) });
    for (let i = 0; i < 5; i++) this.smoke.add(x + rand(-0.12, 0.12) * s, y, z + rand(-0.12, 0.12) * s, { life: rand(1, 2), s0: 0.2 * s, s1: 0.9 * s, vy: rand(0.25, 0.6), r: 0.22, g: 0.2, b: 0.18, a: 0.7 });
    for (let i = 0; i < 5; i++) this.fire.add(x, y, z, { life: 0.6, s0: 0.06, s1: 0.02, vy: rand(0.5, 1.4), vx: rand(-1, 1), vz: rand(-1, 1) });
    this.mark(x, z, 0.22 * s);
    const l = this.flashes[1];
    if (l.intensity < 6) {
      l.position.set(x, y + 0.5, z);
      l.intensity = 14 * s;
    }
    this.play(x, z, 160, () => sound.playImpact());
    if (Math.hypot(x - this.controls.target.x, z - this.controls.target.z) < 4 && this.dist < 14) this.shake = Math.max(this.shake, 0.25 * s);
  }
  private mark(x: number, z: number, r: number) {
    this.scorch.setMatrixAt(this.scorchN % 90, new THREE.Matrix4().makeTranslation(x, H + 0.012, z).scale(new THREE.Vector3(r, 1, r)));
    this.scorchN++;
    this.scorch.count = Math.min(90, this.scorchN);
    this.scorch.instanceMatrix.needsUpdate = true;
  }
  /** Clarão, onda de choque, bola de fogo e cogumelo */
  private nuke(x: number, z: number, now: number, s: number) {
    this.onFlash();
    sound.playNuke();
    this.shake = 1 + s * 0.6;
    this.mark(x, z, 1.7 * s);
    const l = this.flashes[0];
    l.position.set(x, H + 3 * s, z);
    l.distance = 30 * s;
    l.intensity = 900 * s;
    for (let i = 0; i < 4; i++) this.later.push({ at: now + i * 200, run: () => this.ring(x, z, (3.5 + i) * s, '#ffe3b5', 1.8) });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff1cf', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
    dome.position.set(x, H, z);
    this.scene.add(dome);
    this.actors.push({ o: dome, t: 0, dur: 1.5, move: (t) => {
      dome.scale.setScalar(0.2 + 3 * s * Math.sqrt(t));
      (dome.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - t) ** 2;
    } });
    for (let i = 0; i < 40; i++) this.fire.add(x + rand(-0.5, 0.5) * s, H + 0.2, z + rand(-0.5, 0.5) * s, { life: rand(0.9, 2), s0: 0.8 * s, s1: 2.2 * s, vy: rand(0.2, 1.6) * s, vx: rand(-0.8, 0.8) * s, vz: rand(-0.8, 0.8) * s });
    for (let i = 0; i < 46; i++) {
      this.later.push({ at: now + i * 60, run: () => {
        const a = rand(0, 6.28);
        const up = Math.min(1, i / 14);
        // Saia de poeira, tronco e chapéu
        this.smoke.add(x + Math.cos(a) * s, H + 0.1, z + Math.sin(a) * s, { life: 3.4, s0: 0.4 * s, s1: 1.3 * s, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 0.08, r: 0.55, g: 0.46, b: 0.36, a: 0.55 });
        this.smoke.add(x + rand(-0.18, 0.18) * s, H + 0.2 + up * 1.6 * s, z + rand(-0.18, 0.18) * s, { life: 4, s0: 0.5 * s, s1: 0.95 * s, vy: 0.7 * s, r: 0.46, g: 0.36, b: 0.29, a: 0.85 });
        if (i < 7) return;
        this.smoke.add(x + Math.cos(a) * 0.5 * s, H + (2.7 + rand(0, 0.5)) * s, z + Math.sin(a) * 0.5 * s, { life: 5, s0: 0.8 * s, s1: 2.1 * s, vy: 0.2 * s, vx: Math.cos(a) * 0.85 * s, vz: Math.sin(a) * 0.85 * s, r: 0.54, g: 0.41, b: 0.32, a: 0.8 });
        if (i < 28) this.fire.add(x + Math.cos(a) * 0.45 * s, H + 2.6 * s, z + Math.sin(a) * 0.45 * s, { life: 1.5, s0: 0.5 * s, s1: 1.2 * s, vy: 0.2 * s, vx: Math.cos(a) * 0.6 * s, vz: Math.sin(a) * 0.6 * s });
      } });
    }
  }
  private drawShells(dt: number) {
    const line = this.tracers.geometry.attributes.position as THREE.BufferAttribute;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const side = new THREE.Vector3(1, 0, 0);
    let lines = 0;
    let rockets = 0;
    this.shells = this.shells.filter((s) => {
      s.t += dt;
      const k = Math.min(1, s.t / s.dur);
      const arc = s.k === 'bala' ? 0 : Math.hypot(s.x2 - s.x1, s.z2 - s.z1) * (s.k === 'canhao' ? 0.28 : 0.22);
      const at = (n: number) => new THREE.Vector3(s.x1 + (s.x2 - s.x1) * n, s.y1 + (s.y2 - s.y1) * n + Math.sin(n * Math.PI) * arc, s.z1 + (s.z2 - s.z1) * n);
      const p = at(k);
      if (s.k === 'missil' && rockets < 120) {
        q.setFromUnitVectors(side, at(Math.min(1, k + 0.03)).sub(at(Math.max(0, k - 0.02))).normalize());
        this.rockets.setMatrixAt(rockets++, m.compose(p, q, new THREE.Vector3(1, 1, 1)));
        this.smoke.add(p.x, p.y, p.z, { life: 0.7, s0: 0.05, s1: 0.18, r: 0.85, g: 0.85, b: 0.85, a: 0.45 });
        this.fire.add(p.x, p.y, p.z, { life: 0.1, s0: 0.12, s1: 0.05 });
      } else if (lines < 160) {
        const b = at(Math.max(0, k - (s.k === 'bala' ? 0.35 : 0.08)));
        line.setXYZ(lines * 2, b.x, b.y, b.z);
        line.setXYZ(lines * 2 + 1, p.x, p.y, p.z);
        lines++;
      }
      if (k < 1) return true;
      if (s.k === 'bala') this.smoke.add(s.x2, s.y2, s.z2, { life: 0.35, s0: 0.04, s1: 0.12, vy: 0.2, r: 0.6, g: 0.52, b: 0.4, a: 0.5 });
      else this.boom(s.x2, s.y2, s.z2, s.k === 'canhao' ? 0.5 : 0.6);
      return false;
    });
    line.needsUpdate = true;
    this.tracers.geometry.setDrawRange(0, lines * 2);
    this.rockets.count = rockets;
    this.rockets.instanceMatrix.needsUpdate = true;
  }

  // ===== Toque =====
  private point(cx: number, cy: number): THREE.Vector3 | null {
    const r = this.canvas.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), this.camera);
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -H), new THREE.Vector3());
  }
  private onScreen(x: number, y: number, z: number) {
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return { x: ((v.x + 1) / 2) * r.width + r.left, y: ((1 - v.y) / 2) * r.height + r.top, ok: v.z < 1 };
  }
  private input() {
    let start = { x: 0, y: 0, n: 0 };
    let touches = 0;
    let last = { i: 0, at: 0 };
    this.canvas.addEventListener('pointerdown', (e) => {
      touches++;
      start = { x: e.clientX, y: e.clientY, n: touches };
      this.goal = null;
      if (this.boxing) this.controls.enabled = false;
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.boxing && touches) this.onRect({ x: Math.min(start.x, e.clientX), y: Math.min(start.y, e.clientY), w: Math.abs(e.clientX - start.x), h: Math.abs(e.clientY - start.y) });
    });
    const up = (e: PointerEvent) => {
      const multi = touches > 1 || start.n > 1;
      touches = Math.max(0, touches - 1);
      if (e.type === 'pointercancel') {
        this.onRect(null);
        this.controls.enabled = true;
        return;
      }
      if (this.boxing) {
        this.controls.enabled = true;
        this.onRect(null);
        const [x0, x1, y0, y1] = [Math.min(start.x, e.clientX), Math.max(start.x, e.clientX), Math.min(start.y, e.clientY), Math.max(start.y, e.clientY)];
        this.onBox((W.world?.units ?? []).filter((u) => {
          if (u.o !== W.me) return false;
          const p = this.onScreen(u.x, H + altitude(u.k), u.z);
          return p.ok && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1;
        }).map((u) => u.i));
        return;
      }
      if (multi || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 9) return;
      const p = this.point(e.clientX, e.clientY);
      if (!p) return;
      let unit: Unit | null = null;
      let best = 26;
      for (const u of W.world?.units ?? []) {
        if (!this.shown.get(u.i)?.seen) continue;
        const s = this.onScreen(u.x, H + altitude(u.k) + 0.05, u.z);
        const d = Math.hypot(s.x - e.clientX, s.y - e.clientY);
        if (s.ok && d < best) {
          best = d;
          unit = u;
        }
      }
      let city: City | null = null;
      let cd = Math.max(0.75, this.dist * 0.045);
      for (const c of CITIES) {
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < cd) {
          cd = d;
          city = c;
        }
      }
      if (unit && unit.o === W.me && last.i === unit.i && performance.now() - last.at < 450) {
        const k = unit;
        this.onDouble(k, W.world!.units.filter((u) => u.o === W.me && u.k === k.k && Math.hypot(u.x - k.x, u.z - k.z) < Math.max(5, this.dist * 0.7)));
        return;
      }
      last = { i: unit?.i ?? 0, at: performance.now() };
      this.onTap({ x: p.x, z: p.z, unit, city });
    };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
    this.canvas.addEventListener('wheel', () => { this.goal = null; }, { passive: true });
  }
}
