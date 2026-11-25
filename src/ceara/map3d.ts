import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CITIES, City, REGION_COLOR } from './content';
import { autoQuality, light, makeRenderer, mat, relief } from './models';

/** Mapa 3D do Ceará com os 184 municípios reais. */
const S = 0.12;
const OX = 225;
const OY = 285;
const wx = (x: number) => (x - OX) * S;
const wz = (y: number) => -(y - OY) * S;
export type Mark = 'home' | 'player' | 'mine' | '';

function ringPoints(enc: number[]): [number, number][] {
  const out: [number, number][] = [[enc[0], enc[1]]];
  for (let i = 2; i < enc.length; i += 2) {
    const p = out[out.length - 1];
    out.push([p[0] + enc[i], p[1] + enc[i + 1]]);
  }
  return out;
}
const heightOf = (c: City) => 0.35 + Math.max(0, Math.log10(c.pop) - 3.6) * 0.42;

export class Map3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.5, 400);
  private controls: MapControls;
  private tiles = new Map<number, THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>();
  private labels = new Map<number, { sprite: THREE.Sprite; text: string }>();
  private raf = 0;
  private sea!: THREE.Mesh;
  private picked = 0;
  private marks: Record<number, Mark> = {};
  private goal: THREE.Vector3 | null = null;
  onPick: (city: number) => void = () => {};

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = makeRenderer(canvas);
    this.scene.background = new THREE.Color('#9fd0ea');
    this.scene.fog = new THREE.Fog('#9fd0ea', 75, 190);
    light(this.scene, 42);
    this.camera.position.set(0, 44, 40);
    this.controls = new MapControls(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.12, minDistance: 7, maxDistance: 85, maxPolarAngle: 1.25, zoomToCursor: true });
    this.surroundings();
    for (const c of CITIES) this.addCity(c);
    this.towns();
    let start = { x: 0, y: 0 };
    canvas.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; this.goal = null; });
    canvas.addEventListener('pointerup', (e) => {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < 8) this.pick(e);
    });
    canvas.addEventListener('wheel', () => { this.goal = null; }, { passive: true });
    const quality = autoQuality(this.renderer);
    let last = performance.now();
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      const dt = (now - last) / 1000;
      last = now;
      quality(dt);
      this.resize();
      if (this.goal) {
        const d = this.goal.clone().sub(this.controls.target).multiplyScalar(Math.min(1, dt * 5));
        this.controls.target.add(d);
        this.camera.position.add(d);
        if (d.length() < 0.005) this.goal = null;
      }
      // Não deixa sair do estado
      const t = this.controls.target;
      t.set(THREE.MathUtils.clamp(t.x, -32, 32), 0, THREE.MathUtils.clamp(t.z, -36, 36));
      this.controls.update();
      this.sea.position.y = -0.12 + Math.sin(now / 1600) * 0.04;
      this.showLabels();
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(frame);
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    this.controls.dispose();
    this.scene.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
    this.labels.forEach((l) => l.sprite.material.map?.dispose());
    this.renderer.dispose();
  }
  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const s = this.renderer.getSize(new THREE.Vector2());
    if (!w || !h || (s.x === w && s.y === h)) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Tela em pé: abre o ângulo para caber o estado
    this.camera.fov = w < h ? 58 : 42;
    this.camera.updateProjectionMatrix();
  }

  private surroundings() {
    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#1777a8', roughness: 0.18, metalness: 0.15 }));
    this.sea.rotation.x = -Math.PI / 2;
    this.scene.add(this.sea);
    // Vizinhos (PI, PE, PB, RN), só como terreno de fundo
    const pts = ([[-41.3, -2.95], [-43, -2.6], [-50, -2.2], [-60, -2], [-60, -25], [-25, -25], [-34.8, -8.2], [-34.85, -7], [-35.3, -5.1], [-36.2, -5.1], [-37.25, -4.85], [-38.6, -5.6], [-40, -5]] as const)
      .map(([lon, lat]) => new THREE.Vector2(wx((lon + 42) * 100), -wz((lat + 8) * 100)));
    const land = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.25, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: '#b39b6a', roughness: 1, map: this.tex(0.06) }));
    land.rotation.x = -Math.PI / 2;
    land.position.y = -0.1;
    land.receiveShadow = true;
    this.scene.add(land);
  }
  private tex(repeat: number) {
    const t = relief().clone();
    t.repeat.set(repeat, repeat);
    t.needsUpdate = true;
    return t;
  }
  private reliefTex = this.tex(0.16);

  private addCity(c: City) {
    const shapes = c.rings.map((r) => new THREE.Shape(ringPoints(r).map(([x, y]) => new THREE.Vector2(wx(x), -wz(y)))));
    const geo = new THREE.ExtrudeGeometry(shapes, { depth: heightOf(c), bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.04, bevelSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: REGION_COLOR[c.region], roughness: 0.95, map: this.reliefTex }));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.city = c.id;
    this.scene.add(mesh);
    this.tiles.set(c.id, mesh);
    const line = new THREE.BufferGeometry();
    const v: number[] = [];
    for (const r of c.rings) {
      const pts = ringPoints(r);
      for (let i = 1; i < pts.length; i++) v.push(wx(pts[i - 1][0]), heightOf(c) + 0.05, wz(pts[i - 1][1]), wx(pts[i][0]), heightOf(c) + 0.05, wz(pts[i][1]));
    }
    line.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    this.scene.add(new THREE.LineSegments(line, new THREE.LineBasicMaterial({ color: '#2b2416', transparent: true, opacity: 0.45 })));
  }

  /** Casinhas e prédios proporcionais à população real */
  private towns() {
    const house = mergeGeometries([new THREE.BoxGeometry(1, 0.7, 1).translate(0, 0.35, 0).toNonIndexed(), new THREE.ConeGeometry(0.8, 0.5, 4).rotateY(Math.PI / 4).translate(0, 0.95, 0).toNonIndexed()])!;
    const tower = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const homes: THREE.Matrix4[] = [];
    const towers: THREE.Matrix4[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const c of CITIES) {
      const n = Math.min(70, 3 + Math.round(Math.sqrt(c.pop) / 22));
      const spread = Math.min(0.95, 0.16 + Math.sqrt(c.pop) / 1500);
      for (let i = 0; i < n; i++) {
        const a = rnd() * 6.283;
        const d = Math.sqrt(rnd()) * spread;
        const s = 0.055 + rnd() * 0.035;
        const big = c.pop > 120_000 && rnd() < 0.45;
        const m = new THREE.Matrix4().makeRotationY(rnd() * 3).setPosition(wx(c.x) + Math.cos(a) * d, heightOf(c) + 0.04, wz(c.y) + Math.sin(a) * d);
        m.scale(big ? new THREE.Vector3(s, s * (2 + rnd() * (c.pop > 1e6 ? 9 : 4)), s) : new THREE.Vector3(s, s, s));
        (big ? towers : homes).push(m);
      }
    }
    const add = (geo: THREE.BufferGeometry, color: string, list: THREE.Matrix4[]) => {
      const mesh = new THREE.InstancedMesh(geo, mat(color), list.length);
      list.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.castShadow = true;
      this.scene.add(mesh);
    };
    add(house, '#e9dcc4', homes);
    add(tower, '#dfe6ee', towers);
  }

  // ===== Nomes =====
  setMarks(marks: Record<number, Mark>, names: Record<number, string>) {
    this.marks = marks;
    for (const c of CITIES) {
      const m = marks[c.id] ?? '';
      const text = `${m === 'home' ? '🏠 ' : m === 'mine' ? '🚩 ' : m === 'player' ? '⚔️ ' : ''}${c.name}${names[c.id] ? ` (${names[c.id]})` : m ? '' : ` ${c.level}★`}`;
      const old = this.labels.get(c.id);
      if (old?.text !== text) {
        if (old) {
          this.scene.remove(old.sprite);
          old.sprite.material.map?.dispose();
          old.sprite.material.dispose();
        }
        const sprite = this.label(text, m);
        sprite.position.set(wx(c.x), heightOf(c) + 0.75, wz(c.y));
        this.scene.add(sprite);
        this.labels.set(c.id, { sprite, text });
      }
      this.paint(c);
    }
  }
  private label(text: string, mark: Mark) {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d')!;
    const font = '700 30px Inter, sans-serif';
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 28;
    c.width = w;
    c.height = 46;
    ctx.font = font;
    ctx.fillStyle = mark === 'home' ? 'rgba(180,83,9,.95)' : mark === 'player' ? 'rgba(185,28,28,.92)' : mark === 'mine' ? 'rgba(21,128,61,.92)' : 'rgba(10,14,22,.72)';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, 46, 20);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 14, 25);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false, fog: false }));
    s.scale.set((w / 46) * 0.03, 0.03, 1);
    s.renderOrder = 5;
    return s;
  }
  private showLabels() {
    const dist = this.camera.position.distanceTo(this.controls.target);
    // De longe só as maiores; de perto todas as 184
    const min = dist > 55 ? 150_000 : dist > 38 ? 70_000 : dist > 25 ? 30_000 : dist > 17 ? 15_000 : 0;
    for (const c of CITIES) {
      const l = this.labels.get(c.id);
      if (l) l.sprite.visible = c.pop >= min || c.id === this.picked || this.marks[c.id] === 'home' || this.marks[c.id] === 'player';
    }
  }
  private paint(c: City) {
    const m = this.marks[c.id] ?? '';
    const mesh = this.tiles.get(c.id)!;
    mesh.material.color.set(m === 'home' ? '#f2a51d' : m === 'player' ? '#c0392b' : m === 'mine' ? '#2f9e58' : REGION_COLOR[c.region]);
    mesh.material.emissive.set(c.id === this.picked ? '#ffd166' : '#000');
    mesh.material.emissiveIntensity = c.id === this.picked ? 0.45 : 0;
  }
  private pick(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const hit = ray.intersectObjects([...this.tiles.values()], false)[0];
    if (hit) this.onPick(hit.object.userData.city);
  }
  select(city: number, go = false) {
    const before = this.picked;
    this.picked = city;
    for (const c of CITIES) if (c.id === before || c.id === city) this.paint(c);
    const c = CITIES.find((x) => x.id === city);
    if (c && go) {
      this.goal = new THREE.Vector3(wx(c.x), 0, wz(c.y));
      const d = this.camera.position.clone().sub(this.controls.target);
      if (d.length() > 24) this.camera.position.copy(this.controls.target).add(d.setLength(24));
    }
  }
}
