import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Post } from './post';
import { FLOORS, FLOOR_H, GUESTS, ROOMS, RoomDef, SLOTS } from './data';
import { C, S, collect, equip, floorCost, fx, lv, money, roomCost } from './sim';

/** Academia 3D em andares flutuantes, visto de cima na diagonal. Nada aqui muda a economia. */
type Act = 'sit' | 'stand' | 'run' | 'lift' | 'bike' | 'dance';
type Seat = { p: THREE.Vector3; rot: number; act: Act };
interface Ctx { g: THREE.Group; seats: Seat[]; spin: { m: THREE.Object3D; s: number }[] }
interface Agent { floor: number; path: THREE.Vector3[]; seg: number; wait: number; seat: Seat | null; leave: boolean; visits: number; speed: number; phase: number; dir: number; color: THREE.Color; skin: THREE.Color; hair: THREE.Color; pos: THREE.Vector3 }

// ===== Texturas desenhadas no aparelho =====
const canvas = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  return c;
};
const tex = (c: HTMLCanvasElement, rx = 1, ry = 1) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  return t;
};
const carpet = (a: string, b: string) => canvas(128, 128, (g) => {
  g.fillStyle = a;
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = b;
  g.globalAlpha = 0.55;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(64, 4); g.lineTo(124, 64); g.lineTo(64, 124); g.lineTo(4, 64); g.closePath();
  g.stroke();
  g.globalAlpha = 0.35;
  g.fillStyle = b;
  for (const [x, y] of [[0, 0], [128, 0], [0, 128], [128, 128], [64, 64]]) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
  g.globalAlpha = 0.08;
  g.fillStyle = '#000';
  for (let i = 0; i < 400; i++) g.fillRect((i * 37) % 128, (i * 61) % 128, 2, 2);
});
const marble = canvas(128, 128, (g) => {
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
    g.fillStyle = (x + y) % 2 ? '#3a2a22' : '#d9c7a7';
    g.fillRect(x * 64, y * 64, 64, 64);
  }
  g.strokeStyle = 'rgba(0,0,0,.25)';
  g.strokeRect(0, 0, 128, 128);
});
const bill = canvas(64, 32, (g) => {
  g.fillStyle = '#2d9c4a';
  g.fillRect(0, 0, 64, 32);
  g.strokeStyle = '#b7f5c4';
  g.lineWidth = 3;
  g.strokeRect(3, 3, 58, 26);
  g.fillStyle = '#e8ffe9';
  g.font = 'bold 22px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('$', 32, 17);
});
const waterC = canvas(128, 128, (g) => {
  g.fillStyle = '#1aa7d6';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(220,250,255,.55)';
  g.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    const y = (i * 23) % 128, x = (i * 47) % 128;
    g.ellipse(x, y, 18, 6, (i % 3) * 0.6, 0, 5);
    g.stroke();
  }
});
const sign = (text: string, color: string) => canvas(512, 96, (g) => {
  g.font = '900 64px sans-serif';
  const fit = Math.min(1, 480 / g.measureText(text.toUpperCase()).width);
  g.font = `900 ${Math.floor(64 * fit)}px sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.fillStyle = color;
  g.fillText(text.toUpperCase(), 256, 50);
  g.shadowBlur = 0;
  g.fillStyle = '#fff';
  g.globalAlpha = 0.85;
  g.fillText(text.toUpperCase(), 256, 50);
});

// ===== Materiais e peças =====
const mats = new Map<string, THREE.Material>();
function mat(color: string, o: { r?: number; m?: number; glow?: number; op?: number } = {}) {
  const k = color + JSON.stringify(o);
  let m = mats.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.6, metalness: o.m ?? 0, emissive: o.glow ? color : '#000', emissiveIntensity: o.glow ?? 0, transparent: o.op !== undefined, opacity: o.op ?? 1 });
    mats.set(k, m);
  }
  return m;
}
const texMat = (t: THREE.Texture, glow = 0, rough = 0.7) => new THREE.MeshStandardMaterial({ map: t, roughness: rough, emissive: glow ? '#fff' : '#000', emissiveMap: glow ? t : null, emissiveIntensity: glow });
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 28),
  half: new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 1, false, -Math.PI / 2, Math.PI),
  sph: new THREE.SphereGeometry(0.5, 18, 12),
  cone: new THREE.ConeGeometry(0.5, 1, 18),
  plane: new THREE.PlaneGeometry(1, 1),
};
const tvC = document.createElement('canvas');
tvC.width = 256;
tvC.height = 144;
const tvT = tex(tvC);
const tvM = texMat(tvT, 1.1, 0.4);
const waterT = tex(waterC, 2, 2);
const billM = new THREE.SpriteMaterial({ map: tex(bill), depthWrite: false });

function part(c: Ctx, g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  o.rotation.y = ry;
  c.g.add(o);
  return o;
}
const SKIN = ['#f1c27d', '#c68642', '#8d5524', '#e0ac69', '#ffdbac'].map((s) => new THREE.Color(s));
const HAIR = ['#1b1b1b', '#5a3825', '#c9a227', '#7b3f00', '#ddd'].map((s) => new THREE.Color(s));
/** Pessoa parada (crupiê, garçom, artista), virada para rot */
function person(c: Ctx, x: number, z: number, rot: number, shirt: string, pants = '#1b1b2f', y = 0) {
  const s = Math.sin(rot), co = Math.cos(rot);
  const at = (dx: number, dz: number) => [x + dx * co + dz * s, z - dx * s + dz * co] as const;
  for (const side of [-1, 1]) {
    const [lx, lz] = at(side * 0.1, 0);
    part(c, GEO.box, mat(pants), lx, y + 0.38, lz, 0.14, 0.76, 0.16, rot);
  }
  part(c, GEO.box, mat(shirt), x, y + 1.0, z, 0.44, 0.52, 0.26, rot);
  part(c, GEO.sph, mat('#e0ac69', { r: 0.8 }), x, y + 1.46, z, 0.32, 0.34, 0.32);
  part(c, GEO.sph, mat('#2b1b12'), x, y + 1.55, z, 0.34, 0.2, 0.34);
}
const stool = (c: Ctx, x: number, z: number, color: string) => {
  part(c, GEO.cyl, mat('#9a9a9a', { m: 0.8, r: 0.3 }), x, 0.3, z, 0.08, 0.6, 0.08);
  part(c, GEO.cyl, mat(color, { r: 0.5 }), x, 0.62, z, 0.42, 0.1, 0.42);
};
const chair = (c: Ctx, x: number, z: number, rot: number, color: string) => {
  part(c, GEO.box, mat(color), x, 0.45, z, 0.46, 0.1, 0.46, rot);
  part(c, GEO.box, mat(color), x - Math.sin(rot) * 0.22, 0.75, z - Math.cos(rot) * 0.22, 0.46, 0.6, 0.08, rot);
  part(c, GEO.box, mat('#2b2b2b'), x, 0.2, z, 0.36, 0.4, 0.36, rot);
};
const seat = (c: Ctx, x: number, z: number, rot: number, act: Act = 'sit') => c.seats.push({ p: new THREE.Vector3(x, 0, z), rot, act });
const plant = (c: Ctx, x: number, z: number, s = 1) => {
  part(c, GEO.cyl, mat('#b08d57', { r: 0.4, m: 0.3 }), x, 0.3 * s, z, 0.5 * s, 0.6 * s, 0.5 * s);
  part(c, GEO.cyl, mat('#6b4423'), x, 1.1 * s, z, 0.08 * s, 1.4 * s, 0.08 * s);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const leaf = part(c, GEO.sph, mat(i % 2 ? '#2d6a4f' : '#40916c'), x + Math.cos(a) * 0.35 * s, 1.8 * s, z + Math.sin(a) * 0.35 * s, 0.9 * s, 0.12 * s, 0.3 * s, -a);
    leaf.rotation.z = 0.3;
  }
};
/** Posições em grade dentro da sala, com espaço fixo para o máximo de peças */
function grid(n: number, max: number, cols: number, w: number, d: number, mx = 1.2, mz = 1.2, z0 = 0) {
  const rows = Math.ceil(max / cols);
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    out.push([-w / 2 + mx + ((col + 0.5) * (w - 2 * mx)) / cols, -d / 2 + mz + z0 + ((row + 0.5) * (d - 2 * mz - z0)) / rows]);
  }
  return out;
}

// ===== Aparelhos de cada tipo de sala =====
const IRON = () => mat('#2b2f36', { m: 0.7, r: 0.35 });
const CHROME = () => mat('#c0c6cf', { m: 0.95, r: 0.18 });
/** Barra com anilhas */
const barbell = (c: Ctx, x: number, y: number, z: number, len = 1.8) => {
  part(c, GEO.cyl, CHROME(), x, y, z, 0.05, len, 0.05).rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) part(c, GEO.cyl, mat('#111', { r: 0.5 }), x + s * (len / 2 - 0.2), y, z, 0.42, 0.08, 0.42).rotation.z = Math.PI / 2;
};
/** Espelho da parede do fundo */
const mirror = (c: Ctx, w: number, dd: number) => {
  part(c, GEO.box, mat('#a9d6ec', { m: 0.3, r: 0.08, glow: 0.35 }), 0, 1.5, -dd / 2 + 0.12, w - 1, 2.2, 0.05);
  part(c, GEO.box, CHROME(), 0, 2.63, -dd / 2 + 0.12, w - 0.9, 0.06, 0.08);
};
const tv = (c: Ctx, x: number, y: number, z: number, w = 2.4) => {
  part(c, GEO.box, mat('#0b0b0f', { r: 0.3 }), x, y, z, w + 0.15, w * 0.6, 0.12);
  part(c, GEO.plane, tvM, x, y, z + 0.07, w, w * 0.56, 1);
};

function furnish(c: Ctx, d: RoomDef, n: number, w: number, dd: number, neon: string) {
  const st = d.style ?? 0;
  switch (d.kind) {
    case 'lobby': {
      for (let i = 0; i < 5; i++) {
        const a = -0.9 + i * 0.45;
        part(c, GEO.box, mat(i % 2 ? '#1f2937' : '#334155', { r: 0.4 }), -2.2 + Math.sin(a) * 2.2, 0.55, -2.8 + Math.cos(a) * 1.4, 1.2, 1.1, 0.6, a);
      }
      part(c, GEO.box, mat(neon, { glow: 2 }), -2.2, 1.12, -1.6, 4.2, 0.06, 0.4);
      person(c, -3, -3.4, 0, neon);
      person(c, -1.4, -3.4, 0, neon);
      // Catracas
      for (let k = 0; k < 3; k++) {
        const x = 1 + k * 1.3;
        part(c, GEO.box, CHROME(), x, 0.5, 0.6, 0.25, 1, 0.9);
        part(c, GEO.box, mat(k === 1 ? '#22c55e' : neon, { glow: 2 }), x, 1.02, 0.6, 0.26, 0.05, 0.3);
        c.seats.push({ p: new THREE.Vector3(x + 0.6, 0, 1.3), rot: Math.PI, act: 'stand' });
      }
      tv(c, 2.5, 2.2, -dd / 2 + 0.3, 3);
      for (let i = 0; i < Math.min(6, Math.floor(lv('recepcao') / 5) + 2); i++) plant(c, (i % 2 ? 1 : -1) * (w / 2 - 0.8), -dd / 2 + 1 + i * 1.6, 0.8);
      break;
    }
    case 'pesos': {
      const accent = st ? '#facc15' : '#f97316';
      mirror(c, w, dd);
      grid(n, d.max, 5, w, dd, 0.8, 1.4).forEach(([x, z], i) => {
        const kind = i % 3;
        if (kind === 0) {
          // Supino: banco, suportes e barra
          part(c, GEO.box, mat(accent, { r: 0.5 }), x, 0.45, z, 0.4, 0.12, 1.3);
          part(c, GEO.box, IRON(), x, 0.22, z, 0.2, 0.44, 1.1);
          for (const s of [-1, 1]) part(c, GEO.box, IRON(), x + s * 0.45, 0.65, z - 0.5, 0.08, 1.3, 0.08);
          barbell(c, x, 1.2, z - 0.5);
          c.seats.push({ p: new THREE.Vector3(x, 0, z), rot: 0, act: 'sit' });
        } else if (kind === 1) {
          // Gaiola de agachamento
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(c, GEO.box, IRON(), x + sx * 0.6, 1.1, z + sz * 0.5, 0.09, 2.2, 0.09);
          for (const sz of [-1, 1]) part(c, GEO.box, IRON(), x, 2.2, z + sz * 0.5, 1.3, 0.09, 0.09);
          part(c, GEO.box, mat(accent, { glow: 0.6 }), x, 0.02, z, 1.3, 0.03, 1.1);
          barbell(c, x, 1.45, z, 2);
          c.seats.push({ p: new THREE.Vector3(x, 0, z + 0.1), rot: Math.PI, act: 'lift' });
        } else {
          // Prateleira de halteres
          part(c, GEO.box, IRON(), x, 0.35, z, 1.6, 0.08, 0.55);
          part(c, GEO.box, IRON(), x, 0.18, z, 1.5, 0.36, 0.1);
          for (let k = 0; k < 5; k++) for (const s of [-0.12, 0.12]) part(c, GEO.cyl, mat(st ? '#facc15' : '#111', { m: st ? 0.9 : 0.2, r: 0.4 }), x - 0.6 + k * 0.3, 0.47, z + s, 0.12 + k * 0.015, 0.2, 0.12 + k * 0.015).rotation.z = Math.PI / 2;
          c.seats.push({ p: new THREE.Vector3(x, 0, z + 0.8), rot: Math.PI, act: 'lift' });
        }
      });
      break;
    }
    case 'cardio': {
      if (!st) tv(c, 0, 2.3, -dd / 2 + 0.25, 3.2);
      else for (let k = 0; k < 6; k++) part(c, GEO.box, mat(['#fb923c', '#e879f9', '#22d3ee'][k % 3], { glow: 2.4 }), -w / 2 + 1 + k * ((w - 2) / 5), 0.03, -dd / 2 + 0.4, 1.2, 0.04, 0.1);
      grid(n, d.max, st ? 6 : 4, w, dd, 0.7, 0.5, st ? 0 : 0.6).forEach(([x, z]) => {
        if (!st) {
          // Esteira virada para a parede
          part(c, GEO.box, IRON(), x, 0.15, z, 0.85, 0.22, 1.9);
          part(c, GEO.box, mat('#111', { r: 0.9 }), x, 0.27, z + 0.05, 0.62, 0.03, 1.6);
          for (const s of [-1, 1]) part(c, GEO.box, CHROME(), x + s * 0.38, 0.8, z - 0.75, 0.06, 1.2, 0.06);
          part(c, GEO.box, IRON(), x, 1.38, z - 0.78, 0.8, 0.3, 0.12);
          part(c, GEO.plane, mat(neon, { glow: 1.6 }), x, 1.4, z - 0.71, 0.5, 0.18, 1);
          c.seats.push({ p: new THREE.Vector3(x, 0.28, z + 0.1), rot: Math.PI, act: 'run' });
        } else {
          // Bicicleta de spinning
          part(c, GEO.box, IRON(), x, 0.05, z, 0.5, 0.1, 1.1);
          part(c, GEO.cyl, mat('#94a3b8', { m: 0.9, r: 0.2 }), x, 0.5, z - 0.4, 0.55, 0.1, 0.55).rotation.z = Math.PI / 2;
          part(c, GEO.box, IRON(), x, 0.6, z + 0.15, 0.1, 1.1, 0.1).rotation.x = -0.25;
          part(c, GEO.box, mat('#111'), x, 1.12, z + 0.25, 0.26, 0.08, 0.4);
          part(c, GEO.box, mat(neon, { glow: 1.5 }), x, 1.15, z - 0.5, 0.5, 0.06, 0.08);
          c.seats.push({ p: new THREE.Vector3(x, 0.35, z + 0.25), rot: Math.PI, act: 'bike' });
        }
      });
      if (st) person(c, 0, -dd / 2 + 0.9, 0, neon);
      break;
    }
    case 'vestiario': {
      for (let k = 0; k < 9; k++) {
        const x = -w / 2 + 0.9 + k * 0.78;
        part(c, GEO.box, mat(k % 2 ? '#3b82f6' : '#2563eb', { r: 0.4, m: 0.3 }), x, 1.1, -dd / 2 + 0.45, 0.72, 2.2, 0.6);
        part(c, GEO.box, CHROME(), x + 0.25, 1.1, -dd / 2 + 0.76, 0.04, 0.2, 0.04);
      }
      for (let k = 0; k < 3; k++) {
        const x = w / 2 - 1 - k * 1.2;
        part(c, GEO.box, mat('#bae6fd', { op: 0.35, r: 0.05 }), x - 0.55, 1.1, -dd / 2 + 1, 0.05, 2.2, 1.6);
        part(c, GEO.cyl, CHROME(), x, 2.1, -dd / 2 + 0.4, 0.2, 0.06, 0.2);
      }
      grid(n, d.max, 3, w - 4, dd, 0.4, 0.3, 1.5).forEach(([x, z]) => {
        x -= 2;
        part(c, GEO.box, mat('#a16207', { r: 0.6 }), x, 0.45, z, 1.6, 0.08, 0.4);
        part(c, GEO.box, IRON(), x, 0.22, z, 1.4, 0.44, 0.1);
        c.seats.push({ p: new THREE.Vector3(x, 0, z), rot: Math.PI, act: 'sit' });
      });
      break;
    }
    case 'funcional': {
      if (st) {
        // Quadra de areia com rede
        for (const s of [-1, 1]) part(c, GEO.cyl, CHROME(), s * (w / 2 - 1), 1.2, 0, 0.1, 2.4, 0.1);
        part(c, GEO.box, mat('#f8fafc', { op: 0.55 }), 0, 1.9, 0, w - 2, 0.9, 0.04);
        part(c, GEO.sph, mat('#fde047', { r: 0.6 }), 1.5, 2.6, -1, 0.3, 0.3, 0.3);
        grid(n * 2, d.max * 2, 4, w, dd, 1, 0.8).forEach(([x, z], i) => c.seats.push({ p: new THREE.Vector3(x, 0, z + (i < 4 ? -0.6 : 0.6)), rot: z < 0 ? 0 : Math.PI, act: 'run' }));
        break;
      }
      for (const [x, y] of [[-w / 2 + 1, 0], [w / 2 - 1, 0]]) {
        part(c, GEO.box, IRON(), x, 1.3, -dd / 2 + 0.6 + y, 0.12, 2.6, 0.12);
      }
      part(c, GEO.box, IRON(), 0, 2.55, -dd / 2 + 0.6, w - 2, 0.1, 0.1);
      grid(n, d.max, 3, w, dd, 0.8, 0.6, 1).forEach(([x, z], i) => {
        if (i % 2) {
          for (let k = 0; k < 3; k++) part(c, GEO.box, mat('#b45309', { r: 0.7 }), x - 0.5 + k * 0.5, 0.25 + k * 0.12, z - 0.3, 0.45, 0.5 + k * 0.24, 0.45);
          for (let k = 0; k < 3; k++) part(c, GEO.sph, mat(['#ef4444', '#3b82f6', '#22c55e'][k], { r: 0.4 }), x - 0.4 + k * 0.4, 0.18, z + 0.4, 0.3, 0.34, 0.3);
        } else {
          for (const s of [-0.15, 0.15]) part(c, GEO.box, mat('#1c1917', { r: 0.9 }), x + s, 0.04, z, 0.07, 0.07, 2);
          part(c, GEO.box, IRON(), x, 0.3, z - 1, 0.3, 0.6, 0.3);
        }
        c.seats.push({ p: new THREE.Vector3(x, 0, z + 0.9), rot: Math.PI, act: i % 2 ? 'run' : 'lift' });
      });
      break;
    }
    case 'ringue': {
      const rx = -w / 2 + 3.3, rz = -dd / 2 + 3.3;
      part(c, GEO.box, mat('#1e40af', { r: 0.8 }), rx, 0.35, rz, 5.6, 0.7, 5.6);
      for (const [sx, sz, col] of [[-1, -1, '#ef4444'], [1, 1, '#3b82f6'], [1, -1, '#f8fafc'], [-1, 1, '#f8fafc']] as const) part(c, GEO.cyl, mat(col, { r: 0.4 }), rx + sx * 2.6, 1.3, rz + sz * 2.6, 0.18, 1.3, 0.18);
      for (let k = 0; k < 3; k++) {
        const y = 1 + k * 0.32, rope = mat(k === 1 ? '#f8fafc' : '#ef4444', { r: 0.5 });
        for (const s of [-1, 1]) {
          part(c, GEO.box, rope, rx, y, rz + s * 2.6, 5.2, 0.05, 0.05);
          part(c, GEO.box, rope, rx + s * 2.6, y, rz, 0.05, 0.05, 5.2);
        }
      }
      person(c, rx - 0.6, rz, Math.PI / 2, '#ef4444', '#111', 0.7);
      person(c, rx + 0.6, rz, -Math.PI / 2, '#3b82f6', '#111', 0.7);
      for (let k = 0; k < n; k++) {
        const x = w / 2 - 1.2 - (k % 2) * 1.6, z = -dd / 2 + 1.2 + Math.floor(k / 2) * 2.6;
        part(c, GEO.cyl, IRON(), x, 2.6, z, 0.04, 0.6, 0.04);
        part(c, GEO.cyl, mat(k % 2 ? '#7f1d1d' : '#111827', { r: 0.6 }), x, 1.6, z, 0.55, 1.4, 0.55);
        c.seats.push({ p: new THREE.Vector3(x - 0.75, 0, z + 0.2), rot: Math.PI / 2, act: 'lift' });
      }
      break;
    }
    case 'estudio': {
      mirror(c, w, dd);
      const teacher = st === 0 ? '#e879f9' : st === 1 ? '#fcd34d' : '#22d3ee';
      person(c, 0, -dd / 2 + 1, 0, teacher);
      if (st === 0) {
        for (let k = 0; k < 3; k++) {
          const ball = new THREE.Mesh(GEO.sph, mat('#e9d5ff', { m: 1, r: 0.1, glow: 0.4 }));
          ball.position.set(-3 + k * 3, 3.2, 0);
          ball.scale.setScalar(0.45);
          ball.userData.keep = 1;
          c.g.add(ball);
          c.spin.push({ m: ball, s: 2 });
        }
        for (const s of [-1, 1]) part(c, GEO.box, mat('#111', { r: 0.4 }), s * (w / 2 - 0.6), 0.7, -dd / 2 + 0.6, 0.6, 1.4, 0.5);
      }
      grid(n * (st === 2 ? 1 : 2), d.max * (st === 2 ? 1 : 2), st === 2 ? 3 : 4, w, dd, 0.8, 0.6, 1.4).forEach(([x, z]) => {
        if (st === 1) part(c, GEO.box, mat(['#a78bfa', '#f472b6', '#34d399', '#fbbf24'][Math.abs(Math.round(x * 3)) % 4], { r: 0.9 }), x, 0.02, z, 0.7, 0.03, 1.7);
        if (st === 2) {
          part(c, GEO.box, mat('#e2e8f0', { m: 0.6, r: 0.3 }), x, 0.3, z, 0.75, 0.12, 2.2);
          part(c, GEO.box, mat('#0f172a', { r: 0.7 }), x, 0.42, z + 0.2, 0.65, 0.1, 0.9);
          for (const s of [-1, 1]) part(c, GEO.box, CHROME(), x, 0.55, z + s * 1, 0.7, 0.5, 0.06);
        }
        c.seats.push({ p: new THREE.Vector3(x, st === 2 ? 0.25 : 0, z), rot: Math.PI, act: st === 0 ? 'dance' : 'sit' });
      });
      break;
    }
    case 'macas': {
      if (st) for (let k = 0; k < 2; k++) {
        part(c, GEO.cyl, mat('#e0f2fe', { r: 0.2, m: 0.3 }), w / 2 - 1.3, 0.45, -dd / 2 + 1 + k * 1.8, 1.4, 0.9, 1.4);
        part(c, GEO.cyl, mat('#7dd3fc', { glow: 0.5, op: 0.85 }), w / 2 - 1.3, 0.85, -dd / 2 + 1 + k * 1.8, 1.2, 0.05, 1.2);
      }
      grid(n, d.max, 4, st ? w - 2.5 : w, dd, 0.5, 0.5).forEach(([x, z]) => {
        x -= st ? 1.25 : 0;
        part(c, GEO.box, mat(st ? '#e0f2fe' : '#38bdf8', { r: 0.6 }), x, 0.7, z, 0.75, 0.12, 1.9);
        for (const s of [-1, 1]) part(c, GEO.box, CHROME(), x, 0.32, z + s * 0.75, 0.6, 0.64, 0.06);
        part(c, GEO.box, mat('#f8fafc', { r: 0.9 }), x, 0.8, z - 0.75, 0.5, 0.08, 0.3);
        c.seats.push({ p: new THREE.Vector3(x + 0.6, 0, z), rot: -Math.PI / 2, act: 'stand' });
      });
      person(c, -w / 2 + 1, -dd / 2 + 0.7, Math.PI / 4, '#f8fafc', '#38bdf8');
      break;
    }
    case 'mesas': {
      const counter = ['#6b4226', '#8a5a44', '#2b2d42'][st];
      part(c, GEO.box, mat(counter, { r: 0.4 }), -w / 2 + 2.6, 0.55, -dd / 2 + 0.7, 4.2, 1.1, 0.8);
      part(c, GEO.box, mat('#d9d9d9', { r: 0.3, m: 0.4 }), -w / 2 + 2.6, 1.12, -dd / 2 + 0.7, 4.3, 0.06, 0.9);
      if (st === 0) for (let k = 0; k < 2; k++) part(c, GEO.box, mat('#9a9a9a', { m: 0.8, r: 0.3 }), -w / 2 + 1.4 + k * 2.4, 1.4, -dd / 2 + 0.6, 0.5, 0.5, 0.4);
      if (st === 1) for (let k = 0; k < 6; k++) part(c, GEO.box, mat(['#f4a261', '#e76f51', '#2a9d8f', '#e9c46a'][k % 4], { r: 0.7 }), -w / 2 + 0.9 + k * 0.7, 1.2, -dd / 2 + 0.7, 0.45, 0.12, 0.45);
      if (st === 2) {
        part(c, GEO.box, mat('#111', { r: 0.15, m: 0.3 }), w / 2 - 1.6, 0.6, -dd / 2 + 1, 1.8, 1, 1.2);
        part(c, GEO.box, mat('#111', { r: 0.15 }), w / 2 - 1.6, 0.35, -dd / 2 + 2, 1, 0.5, 0.4);
      }
      person(c, -w / 2 + 2.6, -dd / 2 + 0.2, 0, st === 1 ? '#f5f5f5' : '#8b1e2d');
      grid(n, d.max, 4, w, dd, 0.5, 0.4, 1.4).forEach(([x, z]) => {
        if (st === 2) {
          part(c, GEO.box, mat('#6d597a', { r: 0.9 }), x, 0.3, z - 0.45, 1.6, 0.6, 0.6);
          part(c, GEO.box, mat('#6d597a', { r: 0.9 }), x, 0.65, z - 0.72, 1.6, 0.5, 0.15);
          part(c, GEO.cyl, mat('#c9ada7', { r: 0.3 }), x, 0.35, z + 0.35, 0.8, 0.08, 0.8);
          seat(c, x - 0.4, z - 0.45, 0);
          seat(c, x + 0.4, z - 0.45, 0);
          return;
        }
        part(c, st ? GEO.box : GEO.cyl, mat('#f5ebe0', { r: 0.5 }), x, 0.75, z, st ? 1 : 0.9, 0.06, st ? 1 : 0.9);
        part(c, GEO.cyl, mat('#3a2412'), x, 0.37, z, 0.12, 0.74, 0.12);
        part(c, GEO.sph, mat('#ffd6a5', { glow: 1.2 }), x, 0.85, z, 0.12, 0.12, 0.12);
        for (const s of st ? [-1, 1] : [-1, 1]) {
          chair(c, x + s * 0.7, z, (s * Math.PI) / 2 + Math.PI, st ? '#8a5a44' : '#bc6c25');
          seat(c, x + s * 0.7, z, (-s * Math.PI) / 2);
        }
      });
      break;
    }
    case 'bar': {
      const glow = st ? '#a7c957' : '#39d0ff';
      part(c, GEO.box, mat('#1b1b2f', { r: 0.3, m: 0.3 }), 0, 0.55, -dd / 2 + 1.6, w - 2, 1.1, 0.8);
      part(c, GEO.box, mat(glow, { glow: 2.2 }), 0, 1.05, -dd / 2 + 2.02, w - 2, 0.06, 0.04);
      part(c, GEO.box, mat('#2b2d42'), 0, 1.6, -dd / 2 + 0.25, w - 1.5, 2.2, 0.3);
      for (let k = 0; k < 18; k++) part(c, GEO.cyl, mat(['#ff4fd8', '#ffd60a', '#39d0ff', '#4dffa6', '#ff6b35'][k % 5], { glow: 1.3, op: 0.85 }), -w / 2 + 1.2 + k * ((w - 2.4) / 17), 1.45 + (k % 2) * 0.55, -dd / 2 + 0.42, 0.12, 0.38, 0.12);
      person(c, -1.5, -dd / 2 + 0.95, 0, '#111');
      person(c, 2, -dd / 2 + 0.95, 0, '#111');
      for (let k = 0; k < n; k++) {
        const x = -w / 2 + 1.6 + k * ((w - 3.2) / Math.max(1, d.max - 1));
        stool(c, x, -dd / 2 + 2.5, glow);
        seat(c, x, -dd / 2 + 2.5, Math.PI);
      }
      break;
    }
    case 'loja': {
      part(c, GEO.box, mat('#1f4e5f', { r: 0.4 }), w / 2 - 1.5, 0.55, -dd / 2 + 1, 2, 1.1, 0.8);
      person(c, w / 2 - 1.5, -dd / 2 + 0.4, 0, '#8ecae6');
      grid(n, d.max, 3, w - 3, dd, 0.6, 0.5).forEach(([x, z]) => {
        x -= 1.5;
        part(c, GEO.box, mat('#e9ecef', { r: 0.5 }), x, 0.9, z, 2.2, 1.8, 0.5);
        for (let k = 0; k < 9; k++) part(c, GEO.box, mat(['#e63946', '#ffb703', '#219ebc', '#8338ec', '#06d6a0'][k % 5]), x - 0.8 + (k % 3) * 0.8, 0.5 + Math.floor(k / 3) * 0.55, z + 0.2, 0.4, 0.3, 0.2);
        seat(c, x, z + 0.75, Math.PI, 'stand');
      });
      break;
    }
    case 'agua': {
      const pw = st ? 3.4 : w - 3, pd = st ? 3 : dd - 4.2;
      const px = st ? -w / 2 + 2.4 : 0, pz = st ? 0 : -dd / 2 + 0.6 + pd / 2;
      part(c, GEO.box, mat('#f1faee', { r: 0.4 }), px, 0.15, pz, pw + 0.5, 0.3, pd + 0.5);
      part(c, GEO.plane, texMat(waterT, 0.45, 0.05), px, 0.31, pz, pw, pd, 1).rotation.x = -Math.PI / 2;
      grid(n, d.max, st ? 3 : 6, st ? w - 5 : w, st ? dd : 2.6, 0.5, 0.3).forEach(([x, z]) => {
        x += st ? 2.4 : 0;
        z += st ? 0 : dd / 2 - 1.5;
        part(c, GEO.box, mat(st ? '#f5ebe0' : '#ffffff', { r: 0.6 }), x, 0.35, z, 0.7, 0.18, 1.6);
        part(c, GEO.box, mat(st ? '#f5ebe0' : '#ffffff', { r: 0.6 }), x, 0.55, z - 0.65, 0.7, 0.35, 0.3);
        if (!st) {
          part(c, GEO.cyl, mat('#ddd'), x + 0.6, 1, z, 0.05, 2, 0.05);
          part(c, GEO.cone, mat(['#e63946', '#ffb703', '#219ebc'][Math.round(x) & 1 ? 0 : 2]), x + 0.6, 2.05, z, 1.5, 0.4, 1.5);
        }
        seat(c, x, z, Math.PI);
      });
      if (!st) {
        plant(c, -w / 2 + 0.7, -dd / 2 + 0.7);
        plant(c, w / 2 - 0.7, -dd / 2 + 0.7);
      }
      break;
    }
  }
}

/** Junta todas as peças paradas por material: poucos desenhos por quadro */
function bake(g: THREE.Group) {
  g.updateMatrixWorld(true);
  const inv = g.matrixWorld.clone().invert();
  const by = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const drop: THREE.Mesh[] = [];
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.userData.keep || Array.isArray(m.material)) return;
    if (by.has(m.material)) by.get(m.material)!.push(m.geometry.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld)));
    else by.set(m.material, [m.geometry.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld))]);
    drop.push(m);
  });
  for (const m of drop) m.removeFromParent();
  for (const [m, list] of by) {
    const merged = new THREE.Mesh(mergeGeometries(list), m);
    merged.castShadow = merged.receiveShadow = true;
    merged.userData.merged = 1;
    g.add(merged);
    list.forEach((x) => x.dispose());
  }
}

// ===== Cena =====
const MAX_AGENTS = 150;
export class GymScene {
  private r: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  private post: Post | null = null;
  private world = new THREE.Group();
  private rooms = new Map<string, { g: THREE.Group; key: string; seats: Seat[]; spin: Ctx['spin']; floor: number; carpet: THREE.Mesh }>();
  private floors: THREE.Group[] = [];
  private pick: THREE.Object3D[] = [];
  private target = new THREE.Vector3(0, 1, 0);
  private goal = new THREE.Vector3(0, 1, 0);
  private zoom = 1;
  private sun = new THREE.DirectionalLight('#fff3e0', 2.2);
  private agents: Agent[] = [];
  private inst: THREE.InstancedMesh[];
  private bills: { s: THREE.Sprite; v: THREE.Vector3; life: number }[] = [];
  private billAcc = new Map<string, number>();
  private tags = new Map<string, HTMLElement>();
  private cab = new THREE.Mesh(GEO.box, mat('#ffd60a', { glow: 0.6, m: 0.6, r: 0.3 }));
  private sparks: THREE.Points;
  private raf = 0;
  private last = performance.now();
  private t = 0;
  private spawnAcc = 0;
  private texAcc = 0;
  private ptrs = new Map<number, { x: number; y: number }>();
  private moved = 0;
  private builtKey = '';
  onFrame: (dt: number) => void = () => {};

  constructor(private canvas: HTMLCanvasElement, private overlay: HTMLElement, private onPick: (id: string | null, floor?: number) => void, quality: boolean) {
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.r.shadowMap.enabled = true;
    this.r.shadowMap.type = THREE.PCFShadowMap;
    this.r.shadowMap.autoUpdate = false;
    this.r.toneMapping = THREE.ACESFilmicToneMapping;
    this.r.toneMappingExposure = 1.05;
    const bg = canvas2bg();
    this.scene.background = bg;
    this.scene.add(new THREE.HemisphereLight('#eef8ff', '#12303a', 1.4));
    this.sun.position.set(14, 30, 18);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 90 });
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun, this.sun.target, this.world);
    // Hóspedes: pernas, corpo, cabeça e cabelo em poucas chamadas de desenho
    const legs = new THREE.InstancedMesh(GEO.box, mat('#22223b'), MAX_AGENTS * 2);
    const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.34, 4, 10), new THREE.MeshStandardMaterial({ roughness: 0.7 }), MAX_AGENTS);
    const head = new THREE.InstancedMesh(GEO.sph, new THREE.MeshStandardMaterial({ roughness: 0.8 }), MAX_AGENTS);
    const hair = new THREE.InstancedMesh(GEO.sph, new THREE.MeshStandardMaterial({ roughness: 0.9 }), MAX_AGENTS);
    this.inst = [legs, body, head, hair];
    for (const m of this.inst) {
      m.count = 0;
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(m);
    }
    body.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_AGENTS * 3), 3);
    head.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_AGENTS * 3), 3);
    hair.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_AGENTS * 3), 3);
    // Elevador de vidro e brilhos no ar
    this.cab.scale.set(1.6, 2.2, 1.6);
    this.scene.add(this.cab);
    const pts = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) pts.set([(Math.random() - 0.5) * 110, -15 + Math.random() * 120, (Math.random() - 0.5) * 110], i * 3);
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    this.sparks = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#bdf4ff', size: 2, sizeAttenuation: false, transparent: true, opacity: 0.7 }));
    this.scene.add(this.sparks);
    this.setQuality(quality);
    this.resize();
    this.build();
    fx.collect = (id, a) => this.burst(id, a);
    fx.rebuild = () => this.build();
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up);
    canvas.addEventListener('pointercancel', this.up);
    canvas.addEventListener('wheel', this.wheel, { passive: false });
    window.addEventListener('resize', this.resize);
    this.raf = requestAnimationFrame(this.loop);
  }

  setQuality(high: boolean) {
    this.r.setPixelRatio(Math.min(devicePixelRatio, high ? 2 : 1.25));
    this.post?.dispose();
    this.post = high ? new Post(this.r, this.scene, this.cam as unknown as THREE.PerspectiveCamera) : null;
    this.r.shadowMap.enabled = high;
    this.r.shadowMap.needsUpdate = true;
    this.resize();
  }
  focus(f: number) {
    this.goal.set(0, f * FLOOR_H + 1, 0);
  }
  get topFloor() {
    return Math.min(C.floors, FLOORS.length - 1);
  }

  /** Monta os andares. Só refaz o que mudou (nível que troca a quantidade de peças, andar aberto) */
  build() {
    const fk = `${C.floors}:${C.deco}:${C.city}`;
    if (fk !== this.builtKey) {
      this.builtKey = fk;
      for (const f of this.floors) this.world.remove(f);
      for (const [, r] of this.rooms) r.g.parent?.remove(r.g);
      this.rooms.clear();
      this.floors = [];
      this.pick = [];
      for (let f = 0; f <= this.topFloor; f++) this.floors.push(this.floor(f, f >= C.floors));
    }
    for (const d of ROOMS) {
      if (d.floor >= C.floors) continue;
      const l = lv(d.id);
      const key = `${l > 0}:${equip(d, l)}:${d.kind === 'lobby' ? Math.floor(l / 5) : 0}`;
      const old = this.rooms.get(d.id);
      if (old?.key === key) continue;
      if (old) {
        old.g.parent?.remove(old.g);
        this.pick = this.pick.filter((p) => p !== old.carpet);
      }
      this.rooms.set(d.id, this.room(d, key));
    }
    this.r.shadowMap.needsUpdate = true;
    this.syncTags();
  }

  private floor(f: number, locked: boolean) {
    const def = FLOORS[f];
    const g = new THREE.Group();
    g.position.y = f * FLOOR_H;
    const c: Ctx = { g, seats: [], spin: [] };
    if (locked) {
      // Só o contorno do andar que ainda vai ser aberto
      const edge = mat(def.neon, { glow: 1.6, op: 0.5 });
      for (const [x, z, w, d] of [[0, 10.5, 28, 0.1], [0, -10.5, 28, 0.1], [14, 0, 0.1, 21], [-14, 0, 0.1, 21]]) part(c, GEO.box, edge, x, 0, z, w, 0.1, d);
      this.world.add(g);
      return g;
    }
    const plat = part(c, GEO.box, mat('#1a1026', { r: 0.5 }), 0, -0.4, 0, 28, 0.8, 21);
    plat.receiveShadow = true;
    const fl = part(c, GEO.plane, texMat(tex(marble, 14, 10.5), 0, 0.35), 0, 0.005, 0, 28, 21, 1);
    fl.rotation.x = -Math.PI / 2;
    fl.receiveShadow = true;
    for (const [x, z, w, d] of [[0, 10.5, 28.2, 0.14], [14, 0, 0.14, 21.2]]) part(c, GEO.box, mat(def.neon, { glow: 2.4 }), x, -0.05, z, w, 0.12, d);
    part(c, GEO.box, mat('#c9a227', { m: 0.9, r: 0.3 }), 0, -0.82, 0, 27.4, 0.08, 20.4);
    // Paredes do fundo e da esquerda, com faixa de neon e letreiro do andar
    part(c, GEO.box, mat(def.wall, { r: 0.8 }), 0, 1.8, -10.4, 28, 3.6, 0.3);
    part(c, GEO.box, mat(def.wall, { r: 0.8 }), -13.9, 1.8, 0, 0.3, 3.6, 21);
    part(c, GEO.box, mat(def.neon, { glow: 2.6 }), 0, 3.55, -10.22, 28, 0.08, 0.08);
    part(c, GEO.box, mat(def.neon, { glow: 2.6 }), -13.72, 3.55, 0, 0.08, 0.08, 21);
    for (const x of [-13.9, -7, 7, 13.9]) part(c, GEO.box, mat('#c9a227', { m: 0.8, r: 0.3 }), x, 1.8, -10.25, 0.35, 3.7, 0.35);
    const s = new THREE.Mesh(GEO.plane, new THREE.MeshBasicMaterial({ map: tex(sign(f ? def.name : 'Magnata Fitness', def.neon)), transparent: true, toneMapped: false, depthWrite: false }));
    s.position.set(-6.5, 2.6, -10.2);
    s.scale.set(8, 1.5, 1);
    s.userData.keep = 1;
    g.add(s);
    // Vidro na beira
    part(c, GEO.box, mat('#bde0fe', { op: 0.18, r: 0.05 }), 0, 0.5, 10.45, 28, 1, 0.06);
    part(c, GEO.box, mat('#bde0fe', { op: 0.18, r: 0.05 }), 13.95, 0.5, 0, 0.06, 1, 21);
    // Poço do elevador
    part(c, GEO.box, mat('#9ad1ff', { op: 0.22, r: 0.05 }), 0, 1.8, -9.2, 2, 3.6, 2);
    part(c, GEO.box, mat('#c9a227', { m: 0.8, r: 0.3 }), 0, 3.6, -9.2, 2.2, 0.15, 2.2);
    // Tubo de vidro até o andar de baixo
    if (f) part(c, GEO.cyl, mat('#9ad1ff', { op: 0.16, r: 0.05 }), 0, -FLOOR_H / 2, -9.2, 1.9, FLOOR_H - 0.8, 1.9);
    // Decoração comprada
    const spots: [number, number][] = [[-0.9, 2], [0.9, 2], [-0.9, -6.5], [0.9, -6.5], [13, 9.6], [-13, 9.6], [13, -9.4], [-0.9, 9.6], [0.9, 9.6], [-13, -9.4]];
    for (let i = 0; i < Math.min(spots.length, Math.ceil(C.deco / 2)); i++) plant(c, spots[i][0], spots[i][1], 0.6);
    for (let i = 0; i < Math.min(6, Math.floor(C.deco / 6)); i++) {
      const x = -10 + i * 4;
      part(c, GEO.cyl, mat('#e9e3d5', { r: 0.3 }), x, 0.4, 9.8, 0.6, 0.8, 0.6);
      part(c, GEO.sph, mat('#c9a227', { m: 0.95, r: 0.2 }), x, 1.1, 9.8, 0.55, 0.7, 0.55);
    }
    if (!f) {
      // Entrada com arco de luz
      for (const x of [-3, 3]) part(c, GEO.box, mat('#c9a227', { m: 0.8, r: 0.3 }), x, 1.6, 10.6, 0.4, 3.2, 0.4);
      part(c, GEO.box, mat('#fb923c', { glow: 2.5 }), 0, 3.3, 10.6, 6.4, 0.35, 0.4);
    }
    bake(g);
    this.world.add(g);
    return g;
  }

  private room(d: RoomDef, key: string) {
    const [cx, cz, w, dd] = SLOTS[d.slot];
    const g = new THREE.Group();
    g.position.set(cx, d.floor * FLOOR_H, cz);
    const c: Ctx = { g, seats: [], spin: [] };
    const l = lv(d.id);
    const neon = FLOORS[d.floor].neon;
    const cm = l ? texMat(tex(carpet(d.carpet[0], d.carpet[1]), w / 2.5, dd / 2.5), 0, 0.95) : mat('#241a2e', { r: 0.9, op: 0.85 });
    const carpetMesh = part(c, GEO.plane, cm, 0, 0.02, 0, w, dd, 1);
    carpetMesh.rotation.x = -Math.PI / 2;
    carpetMesh.receiveShadow = true;
    carpetMesh.userData = { room: d.id, keep: 1 };
    this.pick.push(carpetMesh);
    // Grade baixa nos lados do corredor, com porta
    const side = cx < 0 ? 1 : -1;
    const rail = mat('#c9a227', { m: 0.85, r: 0.3 });
    const half = (dd - 2.6) / 2;
    for (const s of [-1, 1]) part(c, GEO.box, rail, (side * w) / 2, 0.35, s * (dd / 2 - half / 2), 0.1, 0.7, half);
    part(c, GEO.box, rail, 0, 0.35, (cz < 0 ? 1 : -1) * (dd / 2), w, 0.7, 0.1);
    if (l) furnish(c, d, equip(d, l), w, dd, neon);
    else {
      const holo = part(c, GEO.box, mat(neon, { glow: 2, op: 0.55 }), 0, 1.2, 0, 1.6, 0.35, 0.35);
      const holo2 = part(c, GEO.box, mat(neon, { glow: 2, op: 0.55 }), 0, 1.2, 0, 0.35, 0.35, 1.6);
      holo.userData.keep = holo2.userData.keep = 1;
      c.spin.push({ m: holo, s: 1 }, { m: holo2, s: 1 });
    }
    for (const sp of c.spin) sp.m.userData.keep = 1;
    bake(g);
    this.world.add(g);
    for (const s of c.seats) s.p.add(g.position);
    return { g, key, seats: c.seats, spin: c.spin, floor: d.floor, carpet: carpetMesh };
  }

  // ===== Etiquetas em HTML por cima da cena =====
  private syncTags() {
    const want = new Set<string>();
    for (const d of ROOMS) if (d.floor < C.floors) want.add(d.id);
    if (C.floors < FLOORS.length) want.add('floor');
    for (const [k, el] of this.tags) if (!want.has(k)) { el.remove(); this.tags.delete(k); }
    for (const k of want) {
      if (this.tags.has(k)) continue;
      const el = document.createElement('div');
      el.className = 'cz-tag';
      el.onclick = (e) => {
        e.stopPropagation();
        if (k === 'floor') return this.onPick(null, C.floors);
        if ((e.target as HTMLElement).closest('.cz-cash')) collect(k);
        else this.onPick(k);
      };
      this.overlay.appendChild(el);
      this.tags.set(k, el);
    }
    this.texts();
  }
  /** Atualiza os textos (4 vezes por segundo) */
  texts() {
    for (const [k, el] of this.tags) {
      let html: string;
      if (k === 'floor') html = `<b>🔒 ${FLOORS[C.floors].name}</b><span class="cz-build">Abrir ${money(floorCost(C.floors))}</span>`;
      else {
        const d = ROOMS.find((x) => x.id === k)!;
        const l = lv(k), r = C.rooms[k];
        html = l
          ? `<b>${d.icon} ${d.name}</b><span>Nv ${l}${r?.mgr && d.kind !== 'lobby' ? ' · 🧑‍💼' : ''}</span>${r && !r.mgr && r.cash >= 1 ? `<button class="cz-cash${S.rooms[k] && r.cash >= S.rooms[k].income * 60 ? ' full' : ''}">💵 ${money(r.cash)}</button>` : ''}`
          : `<b>${d.icon} ${d.name}</b><span class="cz-build${C.money >= roomCost(d, 0) ? ' ok' : ''}">🔨 ${money(roomCost(d, 0))}</span>`;
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
    const at = this.floorAt;
    for (const [k, el] of this.tags) {
      if (k === 'floor') {
        if (at !== C.floors - 1) {
          el.style.display = 'none';
          continue;
        }
        v.set(0, C.floors * FLOOR_H + 1.5, 0);
      } else {
        const d = ROOMS.find((x) => x.id === k)!;
        // Só as etiquetas do andar em foco, para não embolar
        if (d.floor !== at) {
          el.style.display = 'none';
          continue;
        }
        v.set(SLOTS[d.slot][0], d.floor * FLOOR_H + 3.3, SLOTS[d.slot][1]);
      }
      v.project(this.cam);
      const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
      const off = x < -80 || x > W + 80 || y < -40 || y > H + 40;
      el.style.display = off ? 'none' : '';
      if (!off) el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
    }
  }

  // ===== Dinheiro voando =====
  private bill(p: THREE.Vector3, up = 1) {
    if (this.bills.length > 120) return;
    const s = new THREE.Sprite(billM);
    s.scale.set(0.7, 0.35, 1);
    s.position.copy(p);
    this.scene.add(s);
    this.bills.push({ s, v: new THREE.Vector3((Math.random() - 0.5) * 2 * up, 2.5 + Math.random() * 2 * up, (Math.random() - 0.5) * 2 * up), life: 1.6 });
  }
  private burst(id: string, _a: number) {
    const d = ROOMS.find((x) => x.id === id);
    if (!d) return;
    const p = new THREE.Vector3(SLOTS[d.slot][0], d.floor * FLOOR_H + 1.5, SLOTS[d.slot][1]);
    for (let i = 0; i < 14; i++) this.bill(p, 2);
  }

  // ===== Hóspedes andando =====
  private spawn() {
    const built = [...this.rooms.entries()].filter(([id, r]) => r.seats.length && lv(id) && id !== 'recepcao');
    if (!built.length && !this.rooms.get('recepcao')) return;
    const all = [...this.rooms.entries()].filter(([, r]) => r.seats.length);
    if (!all.length) return;
    const [id, room] = all[Math.floor(Math.random() * all.length)];
    const f = room.floor, y = f * FLOOR_H;
    const start = f ? new THREE.Vector3(0, y, -8.4) : new THREE.Vector3((Math.random() - 0.5) * 4, y, 11.5);
    const mixIds = Object.keys(S.mix);
    let pick = Math.random(), type = GUESTS[0];
    for (const g of mixIds) if ((pick -= S.mix[g]) <= 0) { type = GUESTS.find((x) => x.id === g)!; break; }
    const a: Agent = {
      floor: f, path: [start], seg: 0, wait: 0, seat: null, leave: false, visits: 0, speed: 1.8 + Math.random() * 0.8, phase: Math.random() * 6, dir: 0,
      color: new THREE.Color(type.color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.2), skin: SKIN[Math.floor(Math.random() * SKIN.length)], hair: HAIR[Math.floor(Math.random() * HAIR.length)], pos: start.clone(),
    };
    this.route(a, id, start);
    this.agents.push(a);
  }
  private route(a: Agent, id: string, from: THREE.Vector3) {
    const room = this.rooms.get(id)!;
    const d = ROOMS.find((x) => x.id === id)!;
    const [cx, cz] = SLOTS[d.slot];
    const y = a.floor * FLOOR_H;
    const seat = room.seats[Math.floor(Math.random() * room.seats.length)];
    a.seat = seat;
    a.path = [from.clone(), new THREE.Vector3(0, y, from.z > 10 ? 9 : from.z), new THREE.Vector3(0, y, cz), new THREE.Vector3(cx < 0 ? -1 : 1, y, cz).multiplyScalar(1).setY(y), new THREE.Vector3(seat.p.x, y, seat.p.z)];
    a.path[3].x = (cx < 0 ? -1 : 1) * 1.1;
    a.seg = 0;
  }
  private walk(dt: number) {
    const rate = Math.min(4, S.arrivals) * 0.9;
    const cap = Math.min(MAX_AGENTS, 30 + C.floors * 24);
    this.spawnAcc += dt * rate;
    while (this.spawnAcc > 1) {
      this.spawnAcc--;
      if (this.agents.length < cap) this.spawn();
    }
    const [legs, body, head, hair] = this.inst;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let n = 0;
    this.agents = this.agents.filter((a) => {
      let act: Act | 'walk' = 'walk';
      if (a.wait > 0) {
        a.wait -= dt;
        act = a.seat?.act ?? 'stand';
        a.phase += dt * (act === 'lift' ? 3 : 8);
        if (a.wait <= 0) {
          a.visits++;
          const here = a.pos.clone();
          if (a.visits >= 2 || Math.random() < 0.4) {
            a.leave = true;
            const exit = a.floor ? new THREE.Vector3(0, a.floor * FLOOR_H, -8.4) : new THREE.Vector3((Math.random() - 0.5) * 4, 0, 11.5);
            const door = new THREE.Vector3(here.x < 0 ? -1.1 : 1.1, here.y, here.z);
            a.path = [here, door, new THREE.Vector3(0, here.y, here.z), new THREE.Vector3(0, here.y, exit.z > 10 ? 9 : exit.z), exit];
            a.seg = 0;
          } else {
            const ids = [...this.rooms.keys()].filter((k) => this.rooms.get(k)!.floor === a.floor && this.rooms.get(k)!.seats.length);
            const door = new THREE.Vector3(here.x < 0 ? -1.1 : 1.1, here.y, here.z);
            this.route(a, ids[Math.floor(Math.random() * ids.length)], door);
            a.path.unshift(here);
          }
        }
      } else {
        const to = a.path[a.seg + 1];
        if (!to) {
          if (a.leave) return false;
          a.wait = 4 + Math.random() * 6;
          if (a.seat) a.dir = a.seat.rot;
        } else {
          p.subVectors(to, a.pos);
          const dist = p.length();
          const stepLen = a.speed * dt;
          if (dist <= stepLen) {
            a.pos.copy(to);
            a.seg++;
          } else {
            a.pos.addScaledVector(p, stepLen / dist);
            a.dir = Math.atan2(p.x, p.z);
          }
          a.phase += dt * a.speed * 4.5;
        }
      }
      if (n >= MAX_AGENTS) return true;
      const walking = act === 'walk';
      const sitting = act === 'sit' || act === 'bike';
      const sn = Math.sin(a.phase);
      const bob = walking ? Math.abs(sn) * 0.06 : act === 'run' ? Math.abs(sn) * 0.1 : act === 'dance' ? Math.abs(sn) * 0.14 : act === 'lift' ? (sn + 1) * 0.07 : 0;
      const lift = walking || !a.seat ? 0 : a.seat.p.y - a.floor * FLOOR_H;
      const base = a.pos.y + lift + (sitting ? 0.25 : 0);
      if (act === 'dance' && a.seat) a.dir = a.seat.rot + Math.sin(a.phase * 0.4) * 0.8;
      e.set(0, a.dir, 0);
      q.setFromEuler(e);
      for (const side of [-1, 1]) {
        const swing = walking ? sn * 0.6 * side : act === 'run' ? sn * 0.95 * side : act === 'bike' ? -1.3 + sn * 0.45 * side : sitting ? -1.3 : act === 'dance' ? sn * 0.3 * side : 0;
        e.set(swing, a.dir, 0, 'YXZ');
        const lq = new THREE.Quaternion().setFromEuler(e);
        const off = new THREE.Vector3(side * 0.1, 0, 0).applyQuaternion(q);
        const hip = new THREE.Vector3(a.pos.x + off.x, base + 0.72, a.pos.z + off.z);
        const down = new THREE.Vector3(0, -0.36, 0).applyQuaternion(lq);
        m.compose(hip.add(down), lq, s.set(0.14, 0.72, 0.16));
        legs.setMatrixAt(n * 2 + (side > 0 ? 1 : 0), m);
      }
      m.compose(p.set(a.pos.x, base + 1.02 + bob, a.pos.z), q, s.set(1, 1, 0.75));
      body.setMatrixAt(n, m);
      body.setColorAt(n, a.color);
      m.compose(p.set(a.pos.x, base + 1.5 + bob, a.pos.z), q, s.set(0.32, 0.34, 0.32));
      head.setMatrixAt(n, m);
      head.setColorAt(n, a.skin);
      m.compose(p.set(a.pos.x, base + 1.6 + bob, a.pos.z), q, s.set(0.35, 0.2, 0.35));
      hair.setMatrixAt(n, m);
      hair.setColorAt(n, a.hair);
      n++;
      return true;
    });
    legs.count = n * 2;
    body.count = head.count = hair.count = n;
    for (const im of this.inst) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  // ===== TVs com batimentos e água mexendo =====
  private screens(dt: number) {
    waterT.offset.x = (waterT.offset.x + dt * 0.03) % 1;
    waterT.offset.y = (waterT.offset.y + dt * 0.02) % 1;
    if ((this.texAcc += dt) < 0.1) return;
    this.texAcc = 0;
    const g = tvC.getContext('2d')!;
    g.fillStyle = '#04121a';
    g.fillRect(0, 0, 256, 144);
    g.strokeStyle = 'rgba(34,211,238,.15)';
    for (let x = 0; x < 256; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 144); g.stroke(); }
    g.strokeStyle = '#22d3ee';
    g.lineWidth = 3;
    g.beginPath();
    for (let x = 0; x <= 256; x += 4) {
      const t = this.t * 1.6 + x / 60;
      const k = t % 1;
      const y = 90 - (k > 0.45 && k < 0.5 ? 55 : k > 0.5 && k < 0.55 ? -25 : Math.sin(t * 6) * 3);
      if (x) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
    g.fillStyle = '#f97316';
    g.font = 'bold 26px sans-serif';
    g.fillText(`${118 + Math.round(Math.sin(this.t) * 12)} BPM`, 12, 32);
    g.fillStyle = '#e2e8f0';
    g.font = 'bold 14px sans-serif';
    g.fillText(C.event ? 'EVENTO AO VIVO' : 'TREINO DO DIA', 150, 28);
    tvT.needsUpdate = true;
  }

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    this.onFrame(dt);
    // Câmera desliza até o alvo
    this.target.lerp(this.goal, 1 - Math.exp(-dt * 6));
    const off = new THREE.Vector3(18, 17, 22);
    this.cam.position.copy(this.target).add(off);
    this.cam.lookAt(this.target);
    this.sun.position.copy(this.target).add(new THREE.Vector3(12, 26, 16));
    this.sun.target.position.copy(this.target);
    if (Math.abs((this.sun.userData.y ?? -99) - this.target.y) > 2) {
      this.sun.userData.y = this.target.y;
      this.r.shadowMap.needsUpdate = true;
    }
    for (const [, r] of this.rooms) for (const sp of r.spin) sp.m.rotation.y += dt * sp.s;
    // Elevador sobe e desce
    const top = Math.max(0, C.floors - 1) * FLOOR_H;
    const cyc = top ? (Math.sin(this.t * 0.35) * 0.5 + 0.5) * top : 0;
    this.cab.position.set(0, cyc + 1.2, -9.2);
    this.cab.visible = C.floors > 1;
    this.sparks.rotation.y += dt * 0.01;
    this.screens(dt);
    this.walk(dt);
    // Notas saindo das salas que dão lucro
    for (const id in S.rooms) {
      const k = (this.billAcc.get(id) ?? 0) + dt * (S.rooms[id].income > 0 ? 0.5 : 0);
      if (k >= 1) {
        const d = ROOMS.find((x) => x.id === id)!;
        this.bill(new THREE.Vector3(SLOTS[d.slot][0] + (Math.random() - 0.5) * 6, d.floor * FLOOR_H + 1.5, SLOTS[d.slot][1] + (Math.random() - 0.5) * 4));
        this.billAcc.set(id, 0);
      } else this.billAcc.set(id, k);
    }
    this.bills = this.bills.filter((b) => {
      b.life -= dt;
      b.v.y -= dt * 3;
      b.s.position.addScaledVector(b.v, dt);
      b.s.material.rotation += dt;
      if (b.life <= 0) {
        this.scene.remove(b.s);
        return false;
      }
      return true;
    });
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
    this.goal.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
    this.goal.x = Math.max(-14, Math.min(14, this.goal.x));
    this.goal.z = Math.max(-12, Math.min(12, this.goal.z));
    this.goal.y = Math.max(-3, Math.min(this.topFloor * FLOOR_H + 4, this.goal.y));
    this.target.copy(this.goal);
  };
  private up = (e: PointerEvent) => {
    const had = this.ptrs.delete(e.pointerId);
    if (!had || this.moved > 8 || this.ptrs.size) return;
    const rect = this.canvas.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), this.cam);
    const hit = ray.intersectObjects(this.pick, false)[0];
    if (!hit) return this.onPick(null);
    if (hit.object.userData.floor !== undefined) this.onPick(null, hit.object.userData.floor);
    else this.onPick(hit.object.userData.room);
  };
  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    this.setZoom(this.zoom * (e.deltaY > 0 ? 1.1 : 0.9));
  };
  private setZoom(z: number) {
    this.zoom = Math.max(0.45, Math.min(1.7, z));
    this.resize();
  }
  /** Floor atual visto pela câmera, para os botões de andar */
  get floorAt() {
    return Math.max(0, Math.round((this.goal.y - 1) / FLOOR_H));
  }
  resize = () => {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.r.setSize(w, h, false);
    const a = w / h;
    // O andar inteiro sempre cabe na largura, em pé ou deitado
    const half = Math.max(13, 15.5 / a) * this.zoom;
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
    fx.collect = () => {};
    fx.rebuild = () => {};
  }
}

function canvas2bg() {
  const t = new THREE.CanvasTexture(canvas(4, 256, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#07202b');
    gr.addColorStop(0.55, '#0f4252');
    gr.addColorStop(1, '#041016');
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 256);
  }));
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
