import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { BUILDS, BuildId, GRID, TROOPS } from './content';
import { autoQuality, fxTexture, light, makeBuilding, makeRenderer, makeTroop, mat, soil } from './models';
import type { Raid, SimTroop } from './sim';

/** Cena 3D da vila: construir, mover e atacar. */
interface Item { id: number; b: BuildId; level: number; x: number; y: number; busy?: boolean }
interface Fx { sprite: THREE.Sprite; life: number; max: number; grow: number; vx: number; vy: number; vz: number; fade: number }
interface Flying { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; arc: number; boom: boolean }

const C = GRID / 2;
const pos = (x: number, y: number) => new THREE.Vector3(x - C, 0, y - C);
const WALL = new THREE.BoxGeometry(0.92, 0.95, 0.92).translate(0, 0.47, 0);
const SHOT = new THREE.SphereGeometry(0.13, 8, 6);

export class Village3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.5, 220);
  private controls: MapControls;
  private items = new Map<number, { group: THREE.Group; key: string; item: Item; aim?: THREE.Object3D; bar?: THREE.Sprite }>();
  private walls: THREE.InstancedMesh | null = null;
  private wallIds: number[] = [];
  private wallKey = '';
  private troops = new Map<number, THREE.Group>();
  private fx: Fx[] = [];
  private flying: Flying[] = [];
  private ghost: THREE.Mesh;
  private ring: THREE.Mesh;
  private grid: THREE.GridHelper;
  private raf = 0;
  private time = 0;
  private hold: ReturnType<typeof setInterval> | undefined;
  onTap: (x: number, y: number, id: number, held: boolean) => void = () => {};

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = makeRenderer(canvas);
    this.scene.background = new THREE.Color('#bfe0ee');
    this.scene.fog = new THREE.Fog('#d8c9a6', 50, 120);
    light(this.scene, 26);
    this.camera.position.set(17, 23, 22);
    this.controls = new MapControls(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.14, minDistance: 9, maxDistance: 52, maxPolarAngle: 1.2, minPolarAngle: 0.35 });
    this.terrain();
    this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 0.12, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55 }));
    this.ghost.visible = false;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false }));
    this.ring.position.y = 0.06;
    this.ring.visible = false;
    this.grid = new THREE.GridHelper(GRID, GRID, '#ffffff', '#ffffff');
    this.grid.position.y = 0.03;
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.22;
    this.grid.visible = false;
    this.scene.add(this.ghost, this.ring, this.grid);
    this.input();
    const quality = autoQuality(this.renderer);
    let last = performance.now();
    const frame = (now: number) => {
      this.raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      quality(dt);
      this.resize();
      const t = this.controls.target;
      t.set(THREE.MathUtils.clamp(t.x, -14, 14), 0, THREE.MathUtils.clamp(t.z, -14, 14));
      this.controls.update();
      this.animate(dt);
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(frame);
  }
  destroy() {
    cancelAnimationFrame(this.raf);
    clearInterval(this.hold);
    this.controls.dispose();
    this.renderer.dispose();
  }
  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const s = this.renderer.getSize(new THREE.Vector2());
    if (!w || !h || (s.x === w && s.y === h)) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 56 : 38;
    this.camera.updateProjectionMatrix();
  }

  // ===== Toque =====
  private input() {
    const ray = new THREE.Raycaster();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const fire = (e: { clientX: number; clientY: number }, held: boolean) => {
      const r = this.canvas.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
      const p = ray.ray.intersectPlane(ground, new THREE.Vector3());
      if (!p) return;
      // Primeiro o modelo tocado (telhados altos cobrem o chão de trás)
      const hit = ray.intersectObjects([...this.items.values()].map((i) => i.group), true)[0];
      let o: THREE.Object3D | null = hit?.object ?? null;
      while (o && !o.userData.id) o = o.parent;
      const x = p.x + C;
      const y = p.z + C;
      const wall = [...this.wallCells()].find((w) => Math.floor(x) === w.x && Math.floor(y) === w.y);
      this.onTap(x, y, o?.userData.id ?? wall?.id ?? 0, held);
    };
    let down: { x: number; y: number; moved: boolean; held: boolean } | null = null;
    const stop = () => {
      clearInterval(this.hold);
      clearTimeout(this.wait);
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      stop();
      if (!e.isPrimary) {
        down = null;
        return;
      }
      down = { x: e.clientX, y: e.clientY, moved: false, held: false };
      const at = { clientX: e.clientX, clientY: e.clientY };
      // Segurar o dedo repete (soltar várias tropas)
      this.wait = setTimeout(() => {
        if (!down || down.moved) return;
        down.held = true;
        this.hold = setInterval(() => fire(at, true), 130);
      }, 320);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 9) {
        down.moved = true;
        stop();
      }
    });
    const up = (e: PointerEvent) => {
      stop();
      if (down && !down.moved && !down.held && e.type === 'pointerup') fire(e, false);
      down = null;
    };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
  }
  private wait: ReturnType<typeof setTimeout> | undefined;
  private wallItems: Item[] = [];
  private wallCells() {
    return this.wallItems;
  }

  // ===== Cenário =====
  private terrain() {
    const tex = soil().clone();
    tex.repeat.set(9, 9);
    tex.needsUpdate = true;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, color: '#cdbb8f' }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const inner = soil().clone();
    inner.repeat.set(1.4, 1.4);
    inner.needsUpdate = true;
    const yard = new THREE.Mesh(new THREE.PlaneGeometry(GRID, GRID), new THREE.MeshStandardMaterial({ map: inner, roughness: 1, color: '#f4e6c4' }));
    yard.rotation.x = -Math.PI / 2;
    yard.receiveShadow = true;
    this.scene.add(yard);

    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const around = (n: number, min: number, max: number) =>
      Array.from({ length: n }, () => {
        const a = rnd() * 6.283;
        const d = min + rnd() * (max - min);
        return { x: Math.cos(a) * d, z: Math.sin(a) * d, s: 0.7 + rnd() * 0.7, r: rnd() * 6 };
      });
    const scatter = (geo: THREE.BufferGeometry, color: string, list: { x: number; z: number; s: number; r: number }[], y = 0) => {
      const m = new THREE.InstancedMesh(geo, mat(color), list.length);
      list.forEach((p, i) => m.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(p.x, y * p.s, p.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.r, 0)), new THREE.Vector3(p.s, p.s, p.s))));
      m.castShadow = true;
      this.scene.add(m);
    };
    // Carnaúbas, mandacarus, pedras e serras
    const palms = around(46, 21, 60);
    scatter(new THREE.CylinderGeometry(0.12, 0.2, 5, 8).translate(0, 2.5, 0), '#8b6a45', palms);
    const leaf = new THREE.ConeGeometry(1.5, 0.7, 9, 1, true).translate(0, 0.1, 0);
    scatter(leaf, '#4f7a34', palms, 5);
    scatter(new THREE.SphereGeometry(0.9, 8, 6), '#5f8c3c', palms, 5.2);
    const cacti = around(60, 19.5, 50);
    scatter(new THREE.CylinderGeometry(0.18, 0.22, 2.2, 8).translate(0, 1.1, 0), '#4c7d45', cacti);
    scatter(new THREE.CylinderGeometry(0.13, 0.13, 1, 7).rotateZ(0.5).translate(0.4, 1.5, 0), '#4c7d45', cacti);
    scatter(new THREE.CylinderGeometry(0.13, 0.13, 0.9, 7).rotateZ(-0.5).translate(-0.38, 1.2, 0), '#4c7d45', cacti);
    scatter(new THREE.DodecahedronGeometry(0.5, 0), '#8f8575', around(70, 18.5, 60), 0.15);
    scatter(new THREE.ConeGeometry(12, 11, 7).translate(0, 4, 0), '#8c8a63', around(22, 82, 112));
  }

  // ===== Construções =====
  setItems(list: Item[]) {
    const seen = new Set<number>();
    const walls: Item[] = [];
    for (const it of list) {
      if (it.b === 'muro') {
        walls.push(it);
        continue;
      }
      seen.add(it.id);
      const key = `${it.b}${it.level}${it.busy ? 'b' : ''}`;
      let cur = this.items.get(it.id);
      if (cur && cur.key !== key) {
        this.scene.remove(cur.group);
        this.items.delete(it.id);
        this.puff(cur.group.position, 5);
        cur = undefined;
      }
      if (!cur) {
        const size = BUILDS[it.b].size;
        const group = makeBuilding(it.b, it.level, size);
        if (it.busy) {
          const wood = mat('#b98a4e');
          for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2, 0.12), wood);
            pole.position.set(a * size * 0.42, 1, b * size * 0.42);
            group.add(pole);
          }
          const beam = new THREE.Mesh(new THREE.BoxGeometry(size * 0.9, 0.1, 0.1), wood);
          beam.position.set(0, 1.5, size * 0.42);
          group.add(beam);
        }
        group.userData.id = it.id;
        cur = { group, key, item: it, aim: group.getObjectByName('aim') };
        this.items.set(it.id, cur);
        this.scene.add(group);
      }
      const half = BUILDS[it.b].size / 2;
      cur.group.position.copy(pos(it.x + half, it.y + half));
      cur.item = it;
    }
    for (const [id, i] of this.items) {
      if (seen.has(id)) continue;
      this.scene.remove(i.group);
      if (i.bar) this.scene.remove(i.bar);
      this.items.delete(id);
    }
    this.setWalls(walls);
  }
  private setWalls(list: Item[]) {
    this.wallItems = list;
    const key = list.map((w) => `${w.id}:${w.x},${w.y},${w.level}`).join(';');
    if (key === this.wallKey) return;
    this.wallKey = key;
    if (this.walls) {
      this.scene.remove(this.walls);
      this.walls.dispose();
    }
    this.wallIds = list.map((w) => w.id);
    this.walls = list.length ? new THREE.InstancedMesh(WALL, mat('#ffffff', { rough: 0.9 }), list.length) : null;
    if (!this.walls) return;
    const colors = ['#b08a5a', '#a39a8b', '#8d8f94', '#b9a06a', '#d4a937', '#4c8fc9'];
    list.forEach((w, i) => {
      this.walls!.setMatrixAt(i, new THREE.Matrix4().makeScale(1, 0.85 + w.level * 0.06, 1).setPosition(w.x + 0.5 - C, 0, w.y + 0.5 - C));
      this.walls!.setColorAt(i, new THREE.Color(colors[w.level - 1] ?? colors[0]));
    });
    this.walls.castShadow = this.walls.receiveShadow = true;
    this.scene.add(this.walls);
  }
  /** Marca onde a construção vai ficar e o alcance das defesas */
  setGhost(b: BuildId | null, x = 0, y = 0, ok = true) {
    this.ghost.visible = this.grid.visible = !!b;
    this.ring.visible = false;
    if (!b) return;
    const s = BUILDS[b].size;
    this.ghost.scale.set(s, 1, s);
    this.ghost.position.copy(pos(x + s / 2, y + s / 2)).setY(0.1);
    (this.ghost.material as THREE.MeshBasicMaterial).color.set(ok ? '#4ade80' : '#f43f5e');
    const def = BUILDS[b].defense;
    if (def) {
      this.ring.visible = true;
      this.ring.position.copy(this.ghost.position);
      this.ring.scale.set(def.range, 1, def.range);
    }
  }
  select(id: number) {
    const it = this.items.get(id)?.item ?? this.wallItems.find((w) => w.id === id);
    if (!it) return this.setGhost(null);
    this.setGhost(it.b, it.x, it.y, true);
    this.grid.visible = false;
  }

  // ===== Ataque =====
  syncRaid(r: Raid) {
    for (const s of r.shots) this.shoot(s.x1, s.y1, s.x2, s.y2, s.kind, s.air);
    for (const b of r.builds) {
      const cur = this.items.get(b.id);
      if (!cur) continue;
      if (cur.aim && b.hp > 0) cur.aim.rotation.y = -b.aim;
      if (b.hp < b.max && b.hp > 0) {
        cur.bar ??= this.bar();
        cur.bar.position.copy(cur.group.position).setY(2.6 + BUILDS[b.b].size * 0.35);
        cur.bar.scale.set(1.6 * (b.hp / b.max), 0.2, 1);
        cur.bar.material.color.set(b.hp / b.max > 0.5 ? '#4ade80' : b.hp / b.max > 0.25 ? '#facc15' : '#f43f5e');
        if (b.hp / b.max < 0.5 && Math.random() < 0.06) this.smoke(cur.group.position);
      }
    }
    for (const b of r.fallen) {
      if (b.b === 'muro') {
        const i = this.wallIds.indexOf(b.id);
        if (i >= 0 && this.walls) {
          this.walls.setMatrixAt(i, new THREE.Matrix4().makeScale(1, 0.12, 1).setPosition(b.cx - C, 0, b.cy - C));
          this.walls.instanceMatrix.needsUpdate = true;
        }
        this.puff(pos(b.cx, b.cy), 4);
        continue;
      }
      const cur = this.items.get(b.id);
      if (!cur) continue;
      this.explode(cur.group.position, BUILDS[b.b].size);
      cur.group.scale.set(1, 0.16, 1);
      cur.group.traverse((o) => { if (o instanceof THREE.Mesh) o.material = mat('#3a3129'); });
      if (cur.bar) this.scene.remove(cur.bar);
      cur.bar = undefined;
    }
    const live = new Set<number>();
    for (const u of r.troops) {
      live.add(u.id);
      let g = this.troops.get(u.id);
      if (!g) {
        g = this.troop(u);
        this.troops.set(u.id, g);
        this.scene.add(g);
        g.position.copy(pos(u.x, u.y)).setY(TROOPS[u.t].air ? 2.6 : 0);
        this.puff(g.position, 2);
      }
      g.userData.goal = pos(u.x, u.y).setY(TROOPS[u.t].air ? 2.6 : 0);
      g.userData.dir = -u.dir;
      g.userData.hit = u.hit > 0;
    }
    for (const [id, g] of this.troops) {
      if (live.has(id)) continue;
      this.puff(g.position, 3);
      this.scene.remove(g);
      this.troops.delete(id);
    }
  }
  private troop(u: SimTroop) {
    const g = makeTroop(u.t);
    g.userData.kind = u.t;
    g.userData.phase = Math.random() * 6;
    return g;
  }
  private bar() {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ color: '#4ade80', depthTest: false }));
    s.renderOrder = 4;
    this.scene.add(s);
    return s;
  }

  // ===== Efeitos =====
  private add(tex: 'fire' | 'smoke' | 'glow', at: THREE.Vector3, size: number, life: number, grow: number, v: [number, number, number], fade = 1) {
    if (this.fx.length > 220) return;
    const m = new THREE.SpriteMaterial({ map: fxTexture(tex), transparent: true, depthWrite: false, opacity: fade, blending: tex === 'smoke' ? THREE.NormalBlending : THREE.AdditiveBlending });
    const sprite = new THREE.Sprite(m);
    sprite.position.copy(at);
    sprite.scale.setScalar(size);
    m.rotation = Math.random() * 6;
    this.scene.add(sprite);
    this.fx.push({ sprite, life, max: life, grow, vx: v[0], vy: v[1], vz: v[2], fade });
  }
  private explode(p: THREE.Vector3, size: number) {
    const at = p.clone().setY(0.8);
    this.add('glow', at, size * 2.6, 0.25, 4, [0, 0, 0]);
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * 6.283;
      const v = Math.random() * 2.2;
      this.add('fire', at, size * (0.5 + Math.random() * 0.5), 0.5 + Math.random() * 0.4, 1.6, [Math.cos(a) * v, 1 + Math.random() * 2, Math.sin(a) * v]);
      this.add('smoke', at, size * 0.7, 1.3 + Math.random(), 1.8, [Math.cos(a) * v * 0.6, 1 + Math.random(), Math.sin(a) * v * 0.6], 0.8);
    }
  }
  private smoke(p: THREE.Vector3) {
    this.add('smoke', p.clone().setY(1.2), 0.8, 1.6, 1, [0.3, 1.2, 0], 0.6);
  }
  private puff(p: THREE.Vector3, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283;
      this.add('smoke', p.clone().setY(p.y + 0.3), 0.5, 0.6, 1.4, [Math.cos(a), 0.6, Math.sin(a)], 0.5);
    }
  }
  private shoot(x1: number, y1: number, x2: number, y2: number, kind: string, air: boolean) {
    const from = pos(x1, y1).setY(kind === 'flecha' || kind === 'bala' ? 1.2 : 0.7);
    const to = pos(x2, y2).setY(air ? 2.4 : 0.6);
    if (kind === 'golpe') return this.add('glow', to.lerp(from, 0.25), 0.6, 0.12, 0, [0, 0, 0], 0.7);
    if (kind === 'bomba') return this.explode(from, 2);
    if (kind === 'cura') return this.add('glow', to, 0.9, 0.5, 0.4, [0, 1, 0], 0.5);
    if (this.flying.length > 70) return;
    const color = { bala: '#1b1b1b', flecha: '#e9d6a8', coco: '#5b3a1e', fogo: '#ff8a1f' }[kind] ?? '#fff';
    const mesh = new THREE.Mesh(SHOT, mat(color, kind === 'fogo' ? { glow: 2 } : {}));
    mesh.scale.setScalar(kind === 'coco' ? 2.4 : kind === 'flecha' ? 0.7 : 1.2);
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.flying.push({ mesh, from, to, t: 0, arc: kind === 'coco' ? 5 : kind === 'flecha' ? 0.6 : 0.1, boom: kind === 'coco' || kind === 'fogo' });
    if (kind === 'bala') this.add('glow', from, 0.8, 0.1, 0, [0, 0, 0]);
  }

  private animate(dt: number) {
    this.time += dt;
    const t = this.time;
    for (const i of this.items.values()) {
      const flame = i.group.getObjectByName('flame');
      if (flame) flame.scale.y = 0.7 + Math.sin(t * 11 + i.item.id) * 0.18;
      const spin = i.group.getObjectByName('spin');
      if (spin && i.group.scale.y === 1) spin.rotation.x += dt * 0.8;
      const flag = i.group.getObjectByName('flag');
      if (flag) flag.rotation.y = Math.sin(t * 3) * 0.35;
    }
    for (const g of this.troops.values()) {
      const goal = g.userData.goal as THREE.Vector3;
      const moving = g.position.distanceToSquared(goal) > 0.0004;
      g.position.lerp(goal, Math.min(1, dt * 12));
      g.rotation.y = g.userData.dir;
      g.rotation.x = moving && g.userData.kind !== 'carcara' ? Math.sin(t * 12 + g.userData.phase) * 0.12 : 0;
      const w = t * 12 + g.userData.phase;
      if (g.userData.kind === 'carcara') g.position.y = 2.6 + Math.sin(w * 0.3) * 0.15;
      else g.position.y = moving ? Math.abs(Math.sin(w)) * 0.1 : 0;
      for (const o of g.children) {
        if (o.name === 'wingL') o.rotation.x = Math.sin(w) * 0.5;
        else if (o.name === 'wingR') o.rotation.x = -Math.sin(w) * 0.5;
      }
    }
    this.flying = this.flying.filter((f) => {
      f.t += dt * (f.arc > 2 ? 1.6 : 4.5);
      f.mesh.position.lerpVectors(f.from, f.to, Math.min(1, f.t));
      f.mesh.position.y += Math.sin(Math.min(1, f.t) * Math.PI) * f.arc;
      if (f.t < 1) return true;
      this.scene.remove(f.mesh);
      if (f.boom) this.explode(f.to, 0.9);
      return false;
    });
    this.fx = this.fx.filter((f) => {
      f.life -= dt;
      if (f.life <= 0) {
        this.scene.remove(f.sprite);
        f.sprite.material.dispose();
        return false;
      }
      f.sprite.position.x += f.vx * dt;
      f.sprite.position.y += f.vy * dt;
      f.sprite.position.z += f.vz * dt;
      f.sprite.scale.addScalar(f.grow * dt);
      f.sprite.material.opacity = (f.life / f.max) * f.fade;
      return true;
    });
  }
}
