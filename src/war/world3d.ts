import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sound } from '../utils/audio';
import { CAPTURE_S, CITIES, CITY, City, POWERS, PowerId, REGION_COLOR, ROADS, UNITS, UNIT_IDS, UnitId, WORKS_IDS, WorksId, wx, wz } from './data';
import { W, fxQueue } from './match';
import { Fx, Unit, World, allied, eyes, hasRule, mods } from './sim';
import { BAKED, autoQuality, facade, fxTexture, light, makeRenderer, mat, relief, unitGeometry, worksParts } from './models';

/** Mundo aberto em 3D: terreno, cidades, tropas, efeitos e visão. Lê o estado da partida a cada quadro. */
const H = 0.3;
const PHONE = Math.min(window.innerWidth, window.innerHeight) < 700;
export interface Tap { x: number; z: number; unit: Unit | null; city: City | null }
interface Shown { x: number; z: number; dir: number; seen: boolean }
interface Shell { k: 'bala' | 'canhao' | 'missil'; x1: number; y1: number; z1: number; x2: number; y2: number; z2: number; t: number; dur: number }
interface Part { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; s0: number; s1: number; r: number; g: number; b: number; a: number }
interface Later { at: number; run: () => void }

const ringPoints = (enc: number[]) => {
  const out: [number, number][] = [[enc[0], enc[1]]];
  for (let i = 2; i < enc.length; i += 2) out.push([out[out.length - 1][0] + enc[i], out[out.length - 1][1] + enc[i + 1]]);
  return out;
};
const RINGS = new Map(CITIES.map((c) => [c.id, c.rings.map((r) => ringPoints(r).map(([x, y]) => [wx(x), wz(y)] as const))]));
const BOUNDS = (() => {
  let [x0, x1, z0, z1] = [1e9, -1e9, 1e9, -1e9];
  RINGS.forEach((l) => l.forEach((r) => r.forEach(([x, z]) => {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  })));
  return { x0: x0 - 1, x1: x1 + 1, z0: z0 - 1, z1: z1 + 1, w: x1 - x0 + 2, h: z1 - z0 + 2 };
})();
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
      fragmentShader: 'uniform sampler2D map; varying vec4 c; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(t.rgb*c.rgb,t.a*c.a); if(gl_FragColor.a<.01) discard; }',
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
  private ground!: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private ranges = new Map<number, [number, number]>();
  private painted = new Map<number, string>();
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
  private sea!: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private mask!: HTMLCanvasElement;
  private land!: (x: number, z: number) => boolean;
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
    const sky = new THREE.Color('#b9cbd6');
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, 55, 170);
    this.sun = light(this.scene, 42, '#ffe2b8', 2.9);
    this.scene.add(this.sun.target);
    this.camera.position.set(0, 74, 42);
    this.controls = new MapControls(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.14, minDistance: 2.6, maxDistance: 90, maxPolarAngle: 1.22, zoomToCursor: true });
    this.terrain();
    this.towns();
    this.nature();
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
  center() {
    return { x: this.controls.target.x, z: this.controls.target.z };
  }

  // ===== Cenário =====
  private terrain() {
    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshStandardMaterial({ color: '#2d6f92', roughness: 0.22, metalness: 0.2 }));
    this.sea.rotation.x = -Math.PI / 2;
    this.scene.add(this.sea);
    const tile = (r: number) => {
      const t = relief().clone();
      t.repeat.set(r, r);
      t.needsUpdate = true;
      return t;
    };
    // Estados vizinhos, só como fundo
    const pts = ([[-41.3, -2.95], [-43, -2.6], [-50, -2.2], [-60, -2], [-60, -25], [-25, -25], [-34.8, -8.2], [-34.85, -7], [-35.3, -5.1], [-36.2, -5.1], [-37.25, -4.85], [-38.6, -5.6], [-40, -5]] as const)
      .map(([lon, lat]) => new THREE.Vector2(wx((lon + 42) * 100), -wz((lat + 8) * 100)));
    const around = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.22, bevelEnabled: false }).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#8d8467', roughness: 1, map: tile(0.06) }));
    around.position.y = -0.08;
    this.scene.add(around);

    const geos: THREE.BufferGeometry[] = [];
    let at = 0;
    for (const c of CITIES) {
      const shapes = RINGS.get(c.id)!.map((r) => new THREE.Shape(r.map(([x, z]) => new THREE.Vector2(x, -z))));
      const g = new THREE.ExtrudeGeometry(shapes, { depth: H, bevelEnabled: false }).rotateX(-Math.PI / 2);
      const n = g.attributes.position.count;
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
      this.ranges.set(c.id, [at, n]);
      at += n;
      geos.push(g);
    }
    this.ground = new THREE.Mesh(mergeGeometries(geos)!, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: tile(0.22) }));
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    for (const c of CITIES) this.paint(c.id, '');

    // Estradas, lavouras e limites em uma textura por cima
    const px = PHONE ? 24 : 34;
    const cv = document.createElement('canvas');
    cv.width = Math.round(BOUNDS.w * px);
    cv.height = Math.round(BOUNDS.h * px);
    const ctx = cv.getContext('2d')!;
    const X = (x: number) => (x - BOUNDS.x0) * px;
    const Z = (z: number) => (z - BOUNDS.z0) * px;
    const path = (r: readonly (readonly [number, number])[]) => r.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))));
    ctx.beginPath();
    RINGS.forEach((l) => l.forEach(path));
    ctx.save();
    ctx.clip();
    for (let i = 0; i < 2600; i++) {
      const s = rand(3, 13);
      ctx.save();
      ctx.translate(Math.random() * cv.width, Math.random() * cv.height);
      ctx.rotate(Math.floor(rand(0, 4)) * 0.4);
      ctx.fillStyle = ['rgba(70,90,40,.22)', 'rgba(150,125,60,.2)', 'rgba(95,75,45,.2)', 'rgba(185,165,95,.18)'][i % 4];
      ctx.fillRect(0, 0, s * rand(1, 2.4), s);
      ctx.restore();
    }
    for (let i = 0; i < 420; i++) {
      const [x, y, r] = [Math.random() * cv.width, Math.random() * cv.height, rand(20, 90)];
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, i % 2 ? 'rgba(45,62,32,.22)' : 'rgba(120,98,66,.22)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const roads = (w: number, color: string, dash: number[] = []) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.setLineDash(dash);
      ctx.beginPath();
      for (const [a, b] of ROADS) {
        const bend = ((a.id + b.id) % 7 - 3) * 0.12;
        ctx.moveTo(X(a.x), Z(a.z));
        ctx.quadraticCurveTo(X((a.x + b.x) / 2 + (b.z - a.z) * bend), Z((a.z + b.z) / 2 - (b.x - a.x) * bend), X(b.x), Z(b.z));
      }
      ctx.stroke();
    };
    roads(px * 0.13, 'rgba(120,105,80,.55)');
    roads(px * 0.08, '#3c4047');
    roads(Math.max(1, px * 0.012), 'rgba(250,225,140,.4)', [px * 0.1, px * 0.1]);
    ctx.setLineDash([]);
    for (const c of CITIES) {
      const r = this.spread(c) * px * 1.15;
      const g = ctx.createRadialGradient(X(c.x), Z(c.z), 0, X(c.x), Z(c.z), r);
      g.addColorStop(0, 'rgba(128,130,134,.95)');
      g.addColorStop(0.7, 'rgba(128,126,122,.75)');
      g.addColorStop(1, 'rgba(128,120,105,0)');
      ctx.fillStyle = g;
      ctx.fillRect(X(c.x) - r, Z(c.z) - r, r * 2, r * 2);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(30,26,18,.35)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    RINGS.forEach((l) => l.forEach(path));
    ctx.stroke();
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    this.scene.add(this.overlay(tex, 0.006, 1));

    // Máscara de terra firme, para as árvores não caírem no mar
    const mk = document.createElement('canvas');
    mk.width = mk.height = 256;
    const m = mk.getContext('2d', { willReadFrequently: true })!;
    m.setTransform(256 / cv.width, 0, 0, 256 / cv.height, 0, 0);
    m.beginPath();
    RINGS.forEach((l) => l.forEach((r) => r.forEach(([x, z], i) => (i ? m.lineTo(X(x), Z(z)) : m.moveTo(X(x), Z(z))))));
    m.fill();
    this.mask = mk;
    const data = m.getImageData(0, 0, 256, 256).data;
    this.land = (x, z) => data[(Math.floor(((z - BOUNDS.z0) / BOUNDS.h) * 256) * 256 + Math.floor(((x - BOUNDS.x0) / BOUNDS.w) * 256)) * 4 + 3] > 200;
  }
  private overlay(map: THREE.Texture, y: number, order: number) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(BOUNDS.w, BOUNDS.h).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -order * 2, polygonOffsetUnits: -order * 8 }));
    m.position.set((BOUNDS.x0 + BOUNDS.x1) / 2, H + y, (BOUNDS.z0 + BOUNDS.z1) / 2);
    m.receiveShadow = true;
    m.renderOrder = order;
    return m;
  }
  private spread = (c: City) => Math.min(1.15, 0.26 + Math.sqrt(c.pop) / 1300);

  private towns() {
    const roof = new THREE.ConeGeometry(0.8, 0.45, 4).rotateY(Math.PI / 4).translate(0, 0.9, 0).toNonIndexed();
    const house = mergeGeometries([new THREE.BoxGeometry(1, 0.7, 1).translate(0, 0.35, 0).toNonIndexed(), roof])!;
    const tower = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const lists = { house: [] as THREE.Matrix4[], tower: [] as THREE.Matrix4[] };
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const c of CITIES) {
      const n = Math.min(PHONE ? 60 : 90, 7 + Math.round(Math.sqrt(c.pop) / 16));
      const spread = this.spread(c);
      for (let i = 0; i < n; i++) {
        // Quadras alinhadas, com ruas entre elas
        const a = rnd() * 6.283;
        const d = Math.sqrt(0.06 + rnd() * 0.94) * spread;
        const x = Math.round((Math.cos(a) * d) / 0.085) * 0.085;
        const z = Math.round((Math.sin(a) * d) / 0.085) * 0.085;
        if (Math.hypot(x, z) < 0.14) continue;
        const s = 0.046 + rnd() * 0.02;
        const big = c.pop > 70_000 && rnd() < (d < spread * 0.6 ? 0.7 : 0.25);
        const m = new THREE.Matrix4().setPosition(c.x + x, H, c.z + z);
        m.scale(big ? new THREE.Vector3(s, s * (1.6 + rnd() * (c.pop > 1e6 ? 8 : 3.5)), s) : new THREE.Vector3(s, s, s));
        lists[big ? 'tower' : 'house'].push(m);
      }
    }
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, list: THREE.Matrix4[], tints: string[]) => {
      const mesh = new THREE.InstancedMesh(geo, m, list.length);
      list.forEach((x, i) => {
        mesh.setMatrixAt(i, x);
        mesh.setColorAt(i, new THREE.Color(tints[i % tints.length]));
      });
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.scene.add(mesh);
    };
    add(house, new THREE.MeshStandardMaterial({ roughness: 0.9 }), lists.house, ['#c9b79c', '#d8cdb8', '#b39a80', '#a5674c', '#cfc8bd']);
    add(tower, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.25, emissiveMap: facade(), emissive: '#ffdf9a', emissiveIntensity: 0.35 }), lists.tower, ['#c8d2da', '#93a4b3', '#dfe3e6', '#b5a894', '#7f95a8']);
  }
  private nature() {
    const geo = mergeGeometries([new THREE.CylinderGeometry(0.012, 0.018, 0.08, 4).translate(0, 0.04, 0).toNonIndexed(), new THREE.IcosahedronGeometry(0.06, 0).translate(0, 0.11, 0)].map((g) => {
      const n = g.toNonIndexed ? (g.index ? g.toNonIndexed() : g) : g;
      n.deleteAttribute('uv');
      return n;
    }))!;
    const list: THREE.Matrix4[] = [];
    const want = PHONE ? 1100 : 2400;
    for (let i = 0; i < want * 4 && list.length < want; i++) {
      const x = rand(BOUNDS.x0, BOUNDS.x1);
      const z = rand(BOUNDS.z0, BOUNDS.z1);
      if (!this.land(x, z) || CITIES.some((c) => Math.hypot(c.x - x, c.z - z) < 1.1)) continue;
      const s = rand(0.7, 1.5);
      list.push(new THREE.Matrix4().makeRotationY(rand(0, 6)).setPosition(x, H, z).scale(new THREE.Vector3(s, s, s)));
    }
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 1 }), list.length);
    list.forEach((m, i) => {
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, new THREE.Color(['#4f6333', '#5f6f3a', '#3f5530', '#75743f'][i % 4]));
    });
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
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
    x.fillStyle = 'rgba(8,11,18,.58)';
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
    x.drawImage(this.mask, 0, 0, width, height);
    this.fogTex.needsUpdate = true;
  }
  private sees(w: World, x: number, z: number) {
    return this.open(w) || this.seeing.some(([a, b, r]) => (a - x) ** 2 + (b - z) ** 2 < r * r);
  }

  // ===== Quadro =====
  private draw(dt: number, now: number) {
    this.sea.position.y = -0.1 + Math.sin(now / 1500) * 0.03;
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
      this.discs.count = this.barBack.count = this.barFill.count = 0;
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
      r.m.material.opacity = (1 - k) * 0.9;
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
    for (const [x, n] of [[this.discs, discs], [this.barBack, bars], [this.barFill, bars]] as const) {
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
    const a = i * 2.4 + (city % 10);
    const r = this.spread(c) * 0.75 + 0.28;
    return { x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r };
  }
  /** Fumaça de zonas e cidades atingidas */
  private ambience(w: World, dt: number) {
    for (const z of w.zones) {
      if (z.k === 'fumaca' && Math.random() < dt * 22) this.smoke.add(z.x + rand(-1, 1), H + 0.1, z.z + rand(-1, 1), { life: 2.6, s0: 0.5, s1: 1.5, vy: 0.12, r: 0.85, g: 0.87, b: 0.9, a: 0.7 });
    }
    for (const c of w.cities) {
      if (c.hp > c.max * 0.6 || Math.random() > dt * 5) continue;
      const r = this.spread(CITY[c.id]) * 0.8;
      const [x, z] = [c.x + rand(-r, r), c.z + rand(-r, r)];
      if (Math.random() < 0.5) this.fire.add(x, H + 0.06, z, { life: 0.6, s0: 0.12, s1: 0.3, vy: 0.3 });
      this.smoke.add(x, H + 0.15, z, { life: 2.4, s0: 0.14, s1: 0.75, vy: 0.42, vx: 0.12, r: 0.16, g: 0.16, b: 0.17, a: 0.65 });
    }
  }

  // ===== Nomes e cores =====
  private paint(id: number, color: string) {
    if (this.painted.get(id) === color) return;
    this.painted.set(id, color);
    const [at, n] = this.ranges.get(id)!;
    const base = new THREE.Color(REGION_COLOR[CITY[id].region]);
    const k = 0.94 + ((id * 13) % 13) / 100;
    base.multiplyScalar(k).lerp(new THREE.Color('#8a8674'), 0.35);
    if (color) base.lerp(new THREE.Color(color), 0.3);
    const attr = this.ground.geometry.attributes.color as THREE.BufferAttribute;
    for (let i = at; i < at + n; i++) attr.setXYZ(i, base.r, base.g, base.b);
    attr.needsUpdate = true;
  }
  private drawLabels(w: World | null) {
    const d = this.dist;
    const min = d > 55 ? 150_000 : d > 38 ? 70_000 : d > 25 ? 30_000 : d > 17 ? 15_000 : 0;
    const t = this.controls.target;
    for (let i = 0; i < CITIES.length; i++) {
      const c = CITIES[i];
      const s = w?.cities[i];
      const seat = w ? null : W.seats.find((x) => x.start === c.id);
      const owner = s && s.owner >= 0 ? w!.players[s.owner] : null;
      const color = owner?.color ?? (seat ? (seat.id === W.seat ? '#f5b301' : '#ff3b3b') : '');
      this.paint(c.id, color);
      const key = !!color || c.id === this.focus;
      const show = (c.pop >= min || key) && Math.hypot(c.x - t.x, c.z - t.z) < d * 1.5 + 4;
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
    const k = PHONE ? 0.034 : 0.026;
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
    } else this.power(k as PowerId | 'nuclear', x2, z2, now);
  }
  private power(k: PowerId | 'nuclear', x: number, z: number, now: number) {
    if (k === 'nuclear') return this.nuke(x, z, now);
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
    } else if (k === 'balistico') {
      sound.playSiren();
      const g = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.6, 8).rotateX(Math.PI), mat('#d1d5db'));
      this.scene.add(g);
      this.actors.push({ o: g, t: 0, dur: 3.4, move: (t) => {
        const y = t < 0.55 ? 60 : 60 - ((t - 0.55) / 0.45) * 60;
        g.position.set(x, H + y, z);
        if (t > 0.55) this.fire.add(x, H + y + 0.4, z, { life: 0.5, s0: 0.3, s1: 0.1 });
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
    const m = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, depthTest: false }));
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
    this.play(x, z, 160, () => sound.playImpact());
    if (Math.hypot(x - this.controls.target.x, z - this.controls.target.z) < 4 && this.dist < 14) this.shake = Math.max(this.shake, 0.25 * s);
  }
  private mark(x: number, z: number, r: number) {
    this.scorch.setMatrixAt(this.scorchN % 90, new THREE.Matrix4().makeTranslation(x, H + 0.012, z).scale(new THREE.Vector3(r, 1, r)));
    this.scorchN++;
    this.scorch.count = Math.min(90, this.scorchN);
    this.scorch.instanceMatrix.needsUpdate = true;
  }
  private nuke(x: number, z: number, now: number) {
    this.onFlash();
    sound.playNuke();
    this.shake = 1.4;
    this.mark(x, z, 1.9);
    for (let i = 0; i < 3; i++) this.later.push({ at: now + i * 220, run: () => this.ring(x, z, 4.5 + i, '#ffd9a0', 1.6) });
    for (let i = 0; i < 36; i++) this.fire.add(x + rand(-0.5, 0.5), H + 0.2, z + rand(-0.5, 0.5), { life: rand(0.8, 1.8), s0: 0.8, s1: 2.4, vy: rand(0.2, 1.4), vx: rand(-0.8, 0.8), vz: rand(-0.8, 0.8) });
    // Tronco e chapéu do cogumelo
    for (let i = 0; i < 40; i++) {
      this.later.push({ at: now + i * 60, run: () => {
        const a = rand(0, 6.28);
        this.smoke.add(x + rand(-0.2, 0.2), H + 0.2, z + rand(-0.2, 0.2), { life: 4, s0: 0.5, s1: 1.1, vy: 0.95, r: 0.42, g: 0.34, b: 0.28, a: 0.8 });
        if (i > 8) {
          this.smoke.add(x + Math.cos(a) * 0.5, H + 2.6 + rand(0, 0.4), z + Math.sin(a) * 0.5, { life: 4.5, s0: 0.8, s1: 2.2, vy: 0.22, vx: Math.cos(a) * 0.9, vz: Math.sin(a) * 0.9, r: 0.5, g: 0.38, b: 0.3, a: 0.75 });
          if (i < 26) this.fire.add(x + Math.cos(a) * 0.5, H + 2.5, z + Math.sin(a) * 0.5, { life: 1.4, s0: 0.5, s1: 1.2, vy: 0.2, vx: Math.cos(a) * 0.6, vz: Math.sin(a) * 0.6 });
        }
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
