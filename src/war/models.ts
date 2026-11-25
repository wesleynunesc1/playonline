import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sprites } from '../fx/particles';
import type { WorksId } from './data';

/** Modelos 3D modernos montados com formas simples; materiais e geometrias são compartilhados. */
const mats = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: string, opt: { rough?: number; metal?: number; glow?: number } = {}) {
  const key = color + JSON.stringify(opt);
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: opt.rough ?? 0.75, metalness: opt.metal ?? 0, emissive: opt.glow ? color : '#000', emissiveIntensity: opt.glow ?? 0 });
    mats.set(key, m);
  }
  return m;
}
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
const CONE = new THREE.ConeGeometry(0.5, 1, 14);
const BALL = new THREE.SphereGeometry(0.5, 14, 10);
const DOME = new THREE.SphereGeometry(0.5, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2);
type G = THREE.BufferGeometry;
function part(parent: THREE.Object3D, geo: G, m: THREE.Material, [x, y, z]: number[], [sx, sy, sz]: number[], rot?: number[]) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
const WHITE = '#eef2f6';
const CONCRETE = '#b8bec6';
const DARK = '#2b313a';
const STEEL = '#7d8794';
const GLASS = '#3f7fae';
const LIT = '#ffe3a1';
const CYAN = '#22d3ee';
const glass = () => mat(GLASS, { rough: 0.12, metal: 0.75 });
const steel = () => mat(STEEL, { metal: 0.7, rough: 0.35 });
const trimOf = (level: number) => (level >= 5 ? mat('#f2b632', { metal: 0.8, rough: 0.25 }) : level >= 3 ? mat('#2563eb') : mat('#f97316'));
const lamp = (c: string) => mat(c, { glow: 1.6 });

// ===== Fusão de malhas =====
export const BAKED = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
const BAKED_SHINY = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.6 });
const BAKED_LIGHT = new THREE.MeshBasicMaterial({ vertexColors: true });
const MOVING = ['aim', 'spin', 'rotor', 'flag', 'lift'];
/** Funde as peças paradas em poucas malhas: dezenas de desenhos viram dois ou três */
function bake(g: THREE.Group, single = false): THREE.Group {
  const groups: Record<'dull' | 'shiny' | 'light', THREE.BufferGeometry[]> = { dull: [], shiny: [], light: [] };
  g.updateMatrixWorld(true);
  const inverse = g.matrixWorld.clone().invert();
  if (single) {
    // Peça única: junta tudo, inclusive o que se moveria
    const all: THREE.Mesh[] = [];
    g.traverse((o) => { if (o instanceof THREE.Mesh) all.push(o); });
    for (const o of all) {
      g.attach(o);
      o.name = '';
    }
    for (const o of [...g.children]) if (!(o instanceof THREE.Mesh)) g.remove(o);
    g.updateMatrixWorld(true);
  }
  for (const o of [...g.children]) {
    if (o instanceof THREE.Group) {
      bake(o);
      continue;
    }
    if (!(o instanceof THREE.Mesh) || MOVING.includes(o.name)) continue;
    const geo = (o.geometry as THREE.BufferGeometry).index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geo.deleteAttribute('uv');
    geo.applyMatrix4(inverse.clone().multiply(o.matrixWorld));
    const c = o.material.color as THREE.Color;
    const n = geo.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    groups[o.material.emissiveIntensity > 0 && !single ? 'light' : !single && o.material.metalness > 0.3 ? 'shiny' : 'dull'].push(geo);
    g.remove(o);
  }
  for (const k of ['dull', 'shiny', 'light'] as const) {
    if (!groups[k].length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(groups[k])!, k === 'dull' ? BAKED : k === 'shiny' ? BAKED_SHINY : BAKED_LIGHT);
    mesh.castShadow = k !== 'light';
    mesh.receiveShadow = k !== 'light';
    g.add(mesh);
  }
  return g;
}
/** Malhas (fosca, brilhante e luzes) de uma construção, prontas para instanciar */
export function worksParts(b: WorksId): { geo: THREE.BufferGeometry; mat: THREE.Material }[] {
  const out: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
  const g = bake(modelBuilding(b, 3, WORKS_SIZE[b] ?? 3));
  g.updateMatrixWorld(true);
  g.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    let geo = o.geometry as THREE.BufferGeometry;
    if (!geo.attributes.color) {
      const c = (o.material as THREE.MeshStandardMaterial).color;
      geo = geo.clone();
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3).map((_, i) => [c.r, c.g, c.b][i % 3]), 3));
    }
    out.push({ geo: geo.clone().applyMatrix4(o.matrixWorld), mat: (o.material as THREE.MeshStandardMaterial).vertexColors ? o.material as THREE.Material : BAKED });
  });
  return out;
}
const WORKS_SIZE: Partial<Record<WorksId, number>> = { comando: 4, shopping: 4, banco: 2, torre: 2, vigia: 2, antiaerea: 2, eolica: 2, gerador: 2, radar: 2, domo: 2 };

type P = (geo: G, m: THREE.Material, pos: number[], scale: number[], rot?: number[], to?: THREE.Object3D) => THREE.Mesh;
/** Prédio envidraçado com lajes e janelas acesas */
function tower(p: P, x: number, z: number, w: number, d: number, h: number, y = 0.08) {
  p(BOX, glass(), [x, y + h / 2, z], [w, h, d]);
  for (let k = 0.34; k < h; k += 0.36) p(BOX, mat(WHITE), [x, y + k, z], [w * 1.04, 0.05, d * 1.04]);
  for (let k = 0.2, i = 0; k < h - 0.1; k += 0.36, i++) {
    const off = ((i * 7 + Math.round(w * 10)) % 5) / 5 - 0.4;
    p(BOX, lamp(LIT), [x + off * w * 0.8, y + k, z + d / 2], [w * 0.14, 0.14, 0.03]);
    p(BOX, lamp(LIT), [x + w / 2, y + k, z - off * d * 0.8], [0.03, 0.14, d * 0.14]);
  }
}

/** Origem no centro da base; `size` em células */
function modelBuilding(b: WorksId, level: number, size: number): THREE.Group {
  const g = new THREE.Group();
  const lvl = Math.max(1, level);
  const trim = trimOf(lvl);
  const p: P = (geo, m, pos, scale, rot, to = g) => part(to, geo, m, pos, scale, rot);
  const aimAt = (y: number) => {
    const a = new THREE.Group();
    a.name = 'aim';
    a.position.y = y;
    g.add(a);
    return a;
  };
  {
    p(BOX, mat('#8f969f'), [0, 0.04, 0], [size * 0.96, 0.08, size * 0.96]);
    p(BOX, mat('#a9b0b8'), [0, 0.06, 0], [size * 0.86, 0.08, size * 0.86]);
  }
  switch (b) {
    case 'comando': {
      const h = 2 + lvl * 0.4;
      tower(p, 0, 0, 1.7, 1.7, h);
      tower(p, -1.15, 0.5, 0.9, 1.6, h * 0.55);
      tower(p, 1.15, -0.4, 0.9, 1.8, h * 0.7);
      p(BOX, trim, [0, h + 0.14, 0], [1.85, 0.12, 1.85]);
      p(CYL, mat(DARK), [0, h + 0.24, 0], [1.2, 0.1, 1.2]);
      p(CYL, steel(), [0, h + 0.9, 0], [0.06, 1.3, 0.06]);
      p(BALL, lamp('#ef4444'), [0, h + 1.58, 0], [0.14, 0.14, 0.14]);
      p(BOX, lamp(CYAN), [0, 0.5, 1.62], [1.4, 0.1, 0.04]);
      p(BOX, mat(WHITE), [0, 0.3, 1.2], [1.9, 0.5, 0.9]);
      const f = p(BOX, mat('#16a34a'), [0.45, h + 1.2, 0], [0.8, 0.42, 0.03]);
      f.name = 'flag';
      break;
    }
    case 'mercado':
      p(BOX, mat(WHITE), [0, 0.5, -0.2], [2.3, 0.9, 1.7]);
      p(BOX, glass(), [0, 0.42, 0.67], [2, 0.6, 0.06]);
      p(BOX, trim, [0, 1, 0.2], [2.4, 0.16, 2.5]);
      p(BOX, lamp('#f43f5e'), [0, 1.32, 0.9], [1.5, 0.42, 0.06]);
      p(BOX, lamp(LIT), [0, 1.32, 0.94], [1, 0.14, 0.04]);
      for (const x of [-0.8, 0.8]) p(BOX, mat(x < 0 ? '#2563eb' : '#e11d48'), [x, 0.2, 1.1], [0.5, 0.2, 0.28]);
      break;
    case 'refinaria':
      for (const x of [-0.75, 0.75]) {
        p(BOX, mat('#5b6b7c'), [x, 0.55, -0.3], [0.7, 0.9, 0.8]);
        for (let i = -1; i <= 1; i++) p(CYL, mat('#d97706'), [x + i * 0.2, 1.2, -0.3], [0.1, 0.4, 0.1]);
        p(BOX, lamp('#4ade80'), [x, 0.75, 0.12], [0.3, 0.08, 0.03]);
      }
      for (const x of [-1.1, 1.1]) p(CYL, steel(), [x, 1.2, 0.7], [0.08, 2.3, 0.08]);
      p(BOX, steel(), [0, 2.2, 0.7], [2.4, 0.07, 0.07]);
      for (let i = -2; i <= 2; i++) p(CYL, mat('#93c5fd'), [i * 0.45, 2.05, 0.7], [0.1, 0.26, 0.1]);
      break;
    case 'banco':
      p(BOX, mat(CONCRETE), [0, 0.6, 0], [1.6, 1.1, 1.5]);
      for (let i = -1; i <= 1; i++) p(CYL, mat(WHITE), [i * 0.5, 0.6, 0.8], [0.16, 1.1, 0.16]);
      p(BOX, trim, [0, 1.2, 0.05], [1.8, 0.14, 1.8]);
      p(BOX, lamp('#facc15'), [0, 1.48, 0.3], [0.5, 0.4, 0.06]);
      for (let i = 0; i < lvl; i++) p(BOX, mat('#facc15', { metal: 0.8, rough: 0.25 }), [-0.5 + (i % 3) * 0.5, 1.32 + Math.floor(i / 3) * 0.12, -0.4], [0.36, 0.12, 0.2]);
      break;
    case 'quartel':
      p(BOX, mat('#55624a'), [0, 0.55, -0.2], [2.5, 1, 1.6]);
      p(BOX, mat('#434d3a'), [0, 1.1, -0.2], [2.6, 0.12, 1.7]);
      p(BOX, mat(DARK), [0, 0.45, 0.62], [0.9, 0.8, 0.05]);
      p(BOX, trim, [0, 1.35, 0.4], [1, 0.36, 0.08]);
      p(BALL, lamp('#ffffff'), [0, 1.35, 0.46], [0.2, 0.2, 0.05]);
      for (const x of [-1.05, 1.05]) p(BOX, lamp(LIT), [x, 0.75, 0.62], [0.22, 0.16, 0.04]);
      p(CYL, steel(), [-1.2, 1.3, 1], [0.05, 2.5, 0.05]);
      p(BOX, mat('#16a34a'), [-0.9, 2.3, 1], [0.6, 0.36, 0.03]).name = 'flag';
      break;
    case 'torre': {
      p(CYL, mat(CONCRETE), [0, 0.25, 0], [1.6, 0.4, 1.6]);
      p(CYL, trim, [0, 0.46, 0], [1.62, 0.06, 1.62]);
      const a = aimAt(0.75);
      p(BOX, mat('#4b5563'), [0, 0.05, 0], [0.8, 0.5, 0.7], undefined, a);
      for (const z of [-0.14, 0.14]) p(CYL, steel(), [0.75, 0.05, z], [0.14 + lvl * 0.012, 0.95, 0.14 + lvl * 0.012], [0, 0, Math.PI / 2], a);
      p(BOX, lamp('#ef4444'), [0.42, 0.22, 0], [0.04, 0.08, 0.3], undefined, a);
      break;
    }
    case 'vigia': {
      const h = 1.6 + lvl * 0.14;
      for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) p(CYL, steel(), [x * 0.8, h / 2, z * 0.8], [0.1, h, 0.1]);
      for (let k = 0.5; k < h; k += 0.6) p(BOX, steel(), [0, k, 0], [0.85, 0.06, 0.85]);
      p(BOX, mat(DARK), [0, h + 0.05, 0], [1.3, 0.12, 1.3]);
      p(BOX, glass(), [0, h + 0.4, 0], [1.05, 0.5, 1.05]);
      p(BOX, trim, [0, h + 0.72, 0], [1.25, 0.14, 1.25]);
      const a = aimAt(h + 0.95);
      p(BOX, mat(DARK), [0, 0, 0], [0.4, 0.24, 0.34], undefined, a);
      p(CYL, steel(), [0.5, 0, 0], [0.1, 0.7, 0.1], [0, 0, Math.PI / 2], a);
      p(BALL, lamp('#facc15'), [0.1, 0.16, 0.18], [0.14, 0.14, 0.14], undefined, a);
      break;
    }
    case 'obuseiro': {
      p(CYL, mat(CONCRETE), [0, 0.2, 0], [2.5, 0.3, 2.5]);
      const a = aimAt(0.6);
      p(BOX, mat('#56634a'), [-0.2, 0, 0], [1.1, 0.5, 0.9], undefined, a);
      p(CYL, steel(), [0.75, 0.5, 0], [0.26, 1.9, 0.26], [0, 0, Math.PI / 2 - 0.55], a);
      p(CYL, mat(DARK), [1.5, 0.96, 0], [0.34, 0.24, 0.34], [0, 0, Math.PI / 2 - 0.55], a);
      for (let i = 0; i < 3 + lvl; i++) p(CYL, mat('#b45309'), [-1 + (i % 3) * 0.22, 0.5, 0.9 - Math.floor(i / 3) * 0.2], [0.16, 0.4, 0.16]);
      break;
    }
    case 'antiaerea': {
      p(CYL, mat(CONCRETE), [0, 0.2, 0], [1.5, 0.3, 1.5]);
      const a = aimAt(0.7);
      p(BOX, mat('#4b5563'), [0, 0, 0], [0.6, 0.5, 0.6], undefined, a);
      for (const z of [-0.42, 0.42]) for (const y of [0.15, 0.42]) p(CYL, mat(WHITE), [0.2, y, z], [0.2, 1.1, 0.2], [0, 0, Math.PI / 2 - 0.6], a);
      p(DOME, trim, [-0.1, 0.25, 0], [0.4, 0.4, 0.4], undefined, a);
      break;
    }
    case 'shopping':
      p(BOX, mat(WHITE), [0, 0.7, 0], [3.4, 1.2, 3]);
      p(BOX, glass(), [0, 0.6, 1.52], [2.6, 0.8, 0.06]);
      p(DOME, glass(), [0, 1.3, 0], [2, 1.3, 2]);
      p(BOX, trim, [0, 1.34, 0], [3.5, 0.1, 3.1]);
      p(BOX, lamp('#e879f9'), [0, 1.15, 1.58], [1.9, 0.2, 0.04]);
      for (let i = -1; i <= 1; i++) p(BOX, mat(['#2563eb', '#f8fafc', '#dc2626'][i + 1]), [i * 0.9, 0.2, 1.85], [0.5, 0.2, 0.26]);
      break;
    case 'solar':
      for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) {
        p(BOX, mat('#12306b', { metal: 0.6, rough: 0.2 }), [-0.85 + i * 0.85, 0.5, -0.6 + k * 1.2], [0.76, 0.06, 1], [0.45, 0, 0]);
        p(CYL, steel(), [-0.85 + i * 0.85, 0.28, -0.6 + k * 1.2], [0.06, 0.45, 0.06]);
      }
      p(BOX, lamp('#4ade80'), [1.2, 0.3, 1.2], [0.14, 0.3, 0.14]);
      break;
    case 'eolica': {
      const h = 3.6 + lvl * 0.2;
      p(CYL, mat(WHITE), [0, h / 2, 0], [0.22, h, 0.22]);
      p(BOX, mat(WHITE), [-0.12, h, 0], [0.5, 0.24, 0.24]);
      const r = new THREE.Group();
      r.name = 'rotor';
      r.position.set(0.18, h, 0);
      g.add(r);
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI * 2) / 3;
        p(BOX, mat(WHITE), [0, Math.cos(a) * 0.95, Math.sin(a) * 0.95], [0.05, 1.8, 0.16], [a, 0, 0], r);
      }
      p(BALL, lamp('#ef4444'), [-0.3, h + 0.16, 0], [0.1, 0.1, 0.1]);
      break;
    }
    case 'drones':
      p(BOX, mat('#e2e8f0'), [0, 0.75, 0], [2.4, 1.3, 2.2]);
      for (let i = -2; i <= 2; i++) {
        p(BOX, mat(DARK), [i * 0.45, 0.7, 1.12], [0.32, 1, 0.05]);
        for (let k = 0; k < 4; k++) p(BOX, lamp((i + k) % 3 ? CYAN : '#4ade80'), [i * 0.45, 0.38 + k * 0.22, 1.16], [0.2, 0.05, 0.02]);
      }
      for (const x of [-0.6, 0.6]) p(CYL, steel(), [x, 1.5, -0.3], [0.7, 0.25, 0.7]);
      p(BOX, trim, [0, 1.42, 0.9], [2.5, 0.08, 0.5]);
      break;
    case 'hospital':
      tower(p, -0.3, 0, 1.5, 1.6, 1.6 + lvl * 0.14);
      p(BOX, mat(WHITE), [0.8, 0.5, 0.2], [0.9, 0.85, 1.9]);
      p(BOX, lamp('#ef4444'), [0.8, 1.12, 0.6], [0.5, 0.16, 0.16]);
      p(BOX, lamp('#ef4444'), [0.8, 1.12, 0.6], [0.16, 0.16, 0.5]);
      p(BOX, mat(WHITE), [0.8, 0.28, 1.25], [0.4, 0.26, 0.26]);
      break;
    case 'aeroporto':
      p(CYL, mat('#3a414b'), [0, 0.3, 0], [2.7, 0.4, 2.7]);
      p(CYL, lamp('#facc15'), [0, 0.51, 0], [2.2, 0.02, 2.2]);
      p(CYL, mat('#3a414b'), [0, 0.52, 0], [2, 0.03, 2]);
      for (const x of [-0.3, 0.3]) p(BOX, lamp('#ffffff'), [x, 0.55, 0], [0.14, 0.02, 0.9]);
      p(BOX, lamp('#ffffff'), [0, 0.55, 0], [0.6, 0.02, 0.14]);
      for (let i = 0; i < 6; i++) p(BALL, lamp(CYAN), [Math.cos(i) * 1.25, 0.54, Math.sin(i) * 1.25], [0.1, 0.1, 0.1]);
      break;
    case 'silo': {
      p(BOX, mat('#56634a'), [0, 0.35, 0], [2.2, 0.5, 1.6]);
      const a = aimAt(0.75);
      p(BOX, mat('#434d3a'), [0, 0.3, 0], [1.5, 0.7, 1.1], [0, 0, 0.5], a);
      for (let i = 0; i < 2; i++) for (let k = 0; k < 3; k++) p(CONE, mat('#dc2626'), [0.72, 0.5 + i * 0.3, -0.34 + k * 0.34], [0.2, 0.4, 0.2], [0, 0, -Math.PI / 2 + 0.5], a);
      p(BOX, lamp('#facc15'), [-0.9, 0.65, 0.6], [0.14, 0.1, 0.14]);
      break;
    }
    case 'domo':
      p(CYL, mat(CONCRETE), [0, 0.3, 0], [1.3, 0.5, 1.3]);
      for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) p(CYL, mat(WHITE), [x, 0.85, z], [0.22, 0.9, 0.22], [0.25, 0, 0.25]);
      p(BALL, lamp(CYAN), [0, 0.8, 0], [0.35, 0.35, 0.35]);
      break;
    case 'gerador':
      p(CYL, mat(DARK), [0, 0.3, 0], [1.4, 0.5, 1.4]);
      for (let i = 0; i < 4; i++) p(BOX, steel(), [Math.cos(i * 1.57) * 0.55, 0.9, Math.sin(i * 1.57) * 0.55], [0.14, 1.1, 0.14], [0, 0, 0]);
      p(BALL, lamp(CYAN), [0, 1.15, 0], [0.75, 0.75, 0.75]).name = 'lift';
      break;
    case 'radar': {
      p(BOX, mat(CONCRETE), [0, 0.4, 0], [1.2, 0.7, 1.2]);
      const r = new THREE.Group();
      r.name = 'spin';
      r.position.y = 1.1;
      g.add(r);
      p(CYL, steel(), [0, -0.15, 0], [0.16, 0.6, 0.16], undefined, r);
      p(DOME, mat(WHITE), [0.15, 0.35, 0], [1.3, 0.5, 1.3], [0, 0, -1.2], r);
      p(BALL, lamp('#ef4444'), [0.55, 0.5, 0], [0.12, 0.12, 0.12], undefined, r);
      break;
    }
  }
  return g;
}

// ===== Texturas =====
const texCache = new Map<string, THREE.Texture>();
function canvasTexture(key: string, size: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  let t = texCache.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    paint(c.getContext('2d')!);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    texCache.set(key, t);
  }
  return t;
}
/** Fachada com janelas; a mesma textura acende à noite */
export const facade = () =>
  canvasTexture('facade', 128, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 4; y < 128; y += 16) for (let x = 4; x < 128; x += 16) {
      ctx.fillStyle = Math.random() < 0.45 ? ['#ffdf9a', '#fff3d2', '#9ad8ff'][Math.floor(Math.random() * 3)] : '#05070a';
      ctx.fillRect(x, y, 9, 10);
    }
  });
export const fxTexture = (k: 'fire' | 'smoke' | 'glow') => {
  let t = texCache.get(k);
  if (!t) {
    const s = sprites();
    t = new THREE.CanvasTexture(k === 'fire' ? s.fire[1] : k === 'smoke' ? s.smoke[1] : s.glow);
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(k, t);
  }
  return t;
};

export function makeRenderer(canvas: HTMLCanvasElement) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFShadowMap;
  // Sombras só são refeitas de vez em quando
  r.shadowMap.autoUpdate = false;
  r.shadowMap.needsUpdate = true;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  return r;
}
