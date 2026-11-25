import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sprites } from '../fx/particles';
import type { BuildId, TroopId } from './content';

/** Modelos 3D montados com formas simples; materiais e geometrias são compartilhados. */
const mats = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: string, opt: { rough?: number; metal?: number; glow?: number } = {}) {
  const key = color + JSON.stringify(opt);
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: opt.rough ?? 0.85, metalness: opt.metal ?? 0, emissive: opt.glow ? color : '#000', emissiveIntensity: opt.glow ?? 0 });
    mats.set(key, m);
  }
  return m;
}
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
const CONE = new THREE.ConeGeometry(0.5, 1, 14);
const PYR = new THREE.ConeGeometry(0.72, 1, 4).rotateY(Math.PI / 4);
const BALL = new THREE.SphereGeometry(0.5, 14, 10);
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
const TILE = '#b4552f';
const ADOBE = '#d9b48a';
const WOOD = '#7a4f2b';
const STONE = '#9a9284';
const THATCH = '#b99a55';
const GOLD = '#f2b632';
const trimOf = (level: number) => (level >= 5 ? mat(GOLD, { metal: 0.7, rough: 0.3 }) : level >= 3 ? mat('#2c6fb3') : mat('#5c4630'));

const BAKED = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82 });
const BAKED_SHINY = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.65 });
const MOVING = ['aim', 'flame', 'spin', 'flag', 'wingL', 'wingR'];
/** Funde as peças paradas em uma malha só: dezenas de desenhos viram um ou dois */
function bake(g: THREE.Group, single = false): THREE.Group {
  const groups: Record<'dull' | 'shiny', THREE.BufferGeometry[]> = { dull: [], shiny: [] };
  const inverse = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  inverse.copy(g.matrixWorld).invert();
  for (const o of [...g.children]) {
    if (o instanceof THREE.Group) {
      bake(o);
      continue;
    }
    if (!(o instanceof THREE.Mesh) || MOVING.includes(o.name) || o.material.emissiveIntensity > 0) continue;
    const geo = (o.geometry as THREE.BufferGeometry).index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geo.deleteAttribute('uv');
    geo.applyMatrix4(inverse.clone().multiply(o.matrixWorld));
    const c = o.material.color as THREE.Color;
    const n = geo.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    groups[!single && o.material.metalness > 0.3 ? 'shiny' : 'dull'].push(geo);
    g.remove(o);
  }
  for (const k of ['dull', 'shiny'] as const) {
    if (!groups[k].length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(groups[k])!, k === 'dull' ? BAKED : BAKED_SHINY);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}
const buildCache = new Map<string, THREE.Group>();
/** Cópia leve de um modelo já fundido */
export function makeBuilding(b: BuildId, level: number, size: number): THREE.Group {
  const key = `${b}${Math.max(1, level)}`;
  let g = buildCache.get(key);
  if (!g) {
    g = bake(modelBuilding(b, level, size));
    buildCache.set(key, g);
  }
  return g.clone(true);
}
const troopCache = new Map<TroopId, THREE.Group>();
export function makeTroop(t: TroopId): THREE.Group {
  let g = troopCache.get(t);
  if (!g) {
    const inner = modelTroop(t);
    const scale = inner.scale.x;
    inner.scale.setScalar(1);
    // Mancha de sombra já fundida na malha
    const blob = new THREE.Mesh(BLOB, mat('#86694a'));
    blob.position.y = t === 'carcara' ? -2.55 : 0.03;
    inner.add(blob);
    g = bake(inner, true);
    g.scale.setScalar(scale);
    // Sombra simples no chão: sombra projetada de dezenas de tropas sairia cara
    g.traverse((o) => { o.castShadow = false; });
    troopCache.set(t, g);
  }
  return g.clone(true);
}
const BLOB = new THREE.CircleGeometry(0.32, 14).rotateX(-Math.PI / 2);

/** Origem no centro da base; `size` em células */
function modelBuilding(b: BuildId, level: number, size: number): THREE.Group {
  const g = new THREE.Group();
  const lvl = Math.max(1, level);
  const trim = trimOf(lvl);
  const p = (geo: G, m: THREE.Material, pos: number[], scale: number[], rot?: number[], to: THREE.Object3D = g) => part(to, geo, m, pos, scale, rot);
  if (b !== 'muro') p(BOX, mat('#a8865a'), [0, 0.04, 0], [size * 0.94, 0.08, size * 0.94]);
  switch (b) {
    case 'prefeitura': {
      const h = 1.3 + lvl * 0.12;
      p(BOX, mat('#f3ead8'), [0, h / 2, 0], [3, h, 2.4]);
      p(BOX, trim, [0, h + 0.05, 0], [3.2, 0.12, 2.6]);
      p(PYR, mat(TILE), [0, h + 0.5, 0], [2.6, 0.9, 2.1]);
      for (let i = -1; i <= 1; i++) p(BOX, mat('#1f5f9e'), [i * 0.9, h * 0.45, 1.21], [0.42, h * 0.5, 0.06]);
      for (let i = -2; i <= 2; i++) p(CYL, mat('#fffaf0'), [i * 0.65, h * 0.42, 1.5], [0.14, h * 0.84, 0.14]);
      p(BOX, mat('#f3ead8'), [0, h + 1, 0], [0.9, 1.4, 0.9]);
      p(BALL, mat('#fff8e0', { glow: 0.25 }), [0, h + 1.3, 0.46], [0.5, 0.5, 0.06]);
      p(PYR, mat(TILE), [0, h + 2.05, 0], [0.95, 0.8, 0.95]);
      p(CYL, trim, [0, h + 2.7, 0], [0.05, 0.8, 0.05]);
      p(BOX, mat('#1e9e4a'), [0.3, h + 2.9, 0], [0.55, 0.32, 0.03]).name = 'flag';
      break;
    }
    case 'feira':
      for (const [i, c] of (['#d63b3b', '#2f7fd1', '#e8a522'] as const).entries()) {
        const x = (i - 1) * 0.85;
        const z = i % 2 ? 0.35 : -0.3;
        for (const [a, d] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) p(CYL, mat(WOOD), [x + a, 0.45, z + d], [0.06, 0.9, 0.06]);
        p(PYR, mat(c), [x, 1.05, z], [0.78, 0.42, 0.78]);
        p(BOX, mat(WOOD), [x, 0.4, z], [0.7, 0.1, 0.6]);
        for (let k = 0; k < 4; k++) p(BALL, mat(['#f97316', '#84cc16', '#eab308', '#dc2626'][k]), [x - 0.22 + k * 0.15, 0.5, z + (k % 2) * 0.12], [0.13, 0.13, 0.13]);
      }
      if (lvl >= 3) p(CYL, trim, [0, 0.9, 1.2], [0.06, 1.8, 0.06]);
      break;
    case 'casafarinha':
      p(BOX, mat(ADOBE), [-0.2, 0.55, 0], [1.7, 1.1, 1.7]);
      p(PYR, mat(TILE), [-0.2, 1.45, 0], [1.5, 0.8, 1.5]);
      p(BOX, mat(WOOD), [-0.2, 0.35, 0.86], [0.4, 0.7, 0.05]);
      { const w = p(CYL, mat(WOOD), [1, 0.75, 0.2], [1.2, 0.16, 1.2], [0, 0, Math.PI / 2]); w.name = 'spin'; }
      p(CONE, mat('#f5efdc'), [0.9, 0.28, -0.8], [0.7, 0.5, 0.7]);
      p(CYL, mat(STONE), [-0.8, 1.6, -0.5], [0.25, 0.9, 0.25]);
      if (lvl >= 3) p(BOX, trim, [-0.2, 1.1, 0], [1.8, 0.08, 1.8]);
      break;
    case 'cofre':
      p(BOX, mat(STONE), [0, 0.45, 0], [1.5, 0.9, 1.5]);
      p(BOX, trim, [0, 0.92, 0], [1.6, 0.1, 1.6]);
      p(BALL, mat(GOLD, { metal: 0.8, rough: 0.25 }), [0, 0.95, 0], [1.2, 0.5 + lvl * 0.12, 1.2]);
      for (let i = 0; i < 2 + lvl; i++) p(CYL, mat(GOLD, { metal: 0.8, rough: 0.3 }), [Math.cos(i * 2.1) * 0.8, 0.1, Math.sin(i * 2.1) * 0.8], [0.2, 0.06, 0.2]);
      break;
    case 'celeiro':
      p(CYL, mat(ADOBE), [0, 0.5, 0], [1.5, 1, 1.5]);
      p(CONE, mat(THATCH), [0, 1.4, 0], [2, 1, 2]);
      p(BOX, mat(WOOD), [0, 0.35, 0.74], [0.4, 0.7, 0.06]);
      for (let i = 0; i < lvl; i++) p(BALL, mat('#efe6cf'), [0.75 - (i % 3) * 0.26, 0.2 + Math.floor(i / 3) * 0.24, 0.75], [0.3, 0.26, 0.26]);
      break;
    case 'rancho':
      p(BOX, mat('#8a5a33'), [0, 0.55, -0.5], [2.4, 1.1, 1.2]);
      p(BOX, mat(THATCH), [0, 1.25, -0.2], [2.7, 0.14, 1.1], [0.5, 0, 0]);
      p(BOX, mat(THATCH), [0, 1.25, -0.85], [2.7, 0.14, 1.1], [-0.5, 0, 0]);
      for (let i = 0; i < 6; i++) p(CYL, mat(WOOD), [-1.25 + i * 0.5, 0.25, 1.2], [0.09, 0.5, 0.09]);
      p(BOX, mat(WOOD), [0, 0.38, 1.2], [2.6, 0.07, 0.05]);
      p(BOX, mat('#6b3f22'), [0.5, 0.5, 0.6], [0.7, 0.34, 0.3]);
      p(BOX, mat('#6b3f22'), [0.9, 0.75, 0.6], [0.22, 0.4, 0.22], [0, 0, -0.5]);
      p(BOX, trim, [0, 1.62, -0.52], [0.5, 0.3, 0.1]);
      break;
    case 'terreiro':
      p(CYL, mat('#c29a63'), [0, 0.07, 0], [2.7, 0.06, 2.7]);
      for (let i = 0; i < 4; i++) p(CYL, mat(WOOD), [0, 0.2, 0], [0.14, 0.9, 0.14], [Math.PI / 2, (i * Math.PI) / 4, 0]);
      { const f = p(CONE, mat('#ff8a1f', { glow: 1.6 }), [0, 0.55, 0], [0.5, 0.8, 0.5]); f.name = 'flame'; }
      for (let i = 0; i < 2 + Math.min(4, lvl); i++) {
        const a = (i / (2 + Math.min(4, lvl))) * Math.PI * 2;
        p(PYR, mat(['#c2410c', '#1d4ed8', '#15803d', '#a16207'][i % 4]), [Math.cos(a) * 1, 0.4, Math.sin(a) * 1], [0.55, 0.7, 0.55]);
      }
      break;
    case 'canhao': {
      p(CYL, mat(STONE), [0, 0.28, 0], [1.6, 0.56, 1.6]);
      p(CYL, trim, [0, 0.58, 0], [1.65, 0.08, 1.65]);
      const aim = new THREE.Group();
      aim.name = 'aim';
      aim.position.y = 0.85;
      g.add(aim);
      p(CYL, mat('#23262b', { metal: 0.7, rough: 0.35 }), [0.35, 0.05, 0], [0.42 + lvl * 0.02, 1.3, 0.42 + lvl * 0.02], [0, 0, Math.PI / 2 - 0.15], aim);
      p(BOX, mat(WOOD), [-0.1, -0.15, 0], [0.8, 0.3, 0.5], undefined, aim);
      for (const z of [-0.32, 0.32]) p(CYL, mat('#3b2614'), [0, -0.12, z], [0.5, 0.1, 0.5], [Math.PI / 2, 0, 0], aim);
      break;
    }
    case 'mirante': {
      const h = 1.7 + lvl * 0.15;
      for (const [a, d] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) p(CYL, mat(WOOD), [a, h / 2, d], [0.14, h, 0.14]);
      p(BOX, mat('#8a5a33'), [0, h, 0], [1.4, 0.14, 1.4]);
      p(BOX, trim, [0, h + 0.25, 0.65], [1.4, 0.36, 0.06]);
      p(BOX, trim, [0, h + 0.25, -0.65], [1.4, 0.36, 0.06]);
      p(PYR, mat(THATCH), [0, h + 1.15, 0], [1.3, 0.7, 1.3]);
      for (const [a, d] of [[-0.5, -0.5], [0.5, 0.5]]) p(CYL, mat(WOOD), [a, h + 0.5, d], [0.08, 0.9, 0.08]);
      const aim = new THREE.Group();
      aim.name = 'aim';
      aim.position.y = h + 0.4;
      g.add(aim);
      p(BALL, mat('#c68a5c'), [0, 0.22, 0], [0.26, 0.26, 0.26], undefined, aim);
      p(CYL, mat('#8c2f2f'), [0, 0, 0], [0.28, 0.4, 0.28], undefined, aim);
      break;
    }
    case 'catapulta': {
      p(BOX, mat(WOOD), [0, 0.25, 0], [2, 0.25, 1.3]);
      for (const z of [-0.5, 0.5]) p(BOX, mat(WOOD), [0, 0.8, z], [0.2, 1.1, 0.16]);
      const aim = new THREE.Group();
      aim.name = 'aim';
      aim.position.y = 0.9;
      g.add(aim);
      p(BOX, mat('#8a5a33'), [-0.2, 0.2, 0], [1.9, 0.14, 0.14], [0, 0, -0.5], aim);
      p(BALL, mat('#5b3a1e'), [-0.95, 0.68, 0], [0.42, 0.42, 0.42], undefined, aim);
      for (let i = 0; i < 4 + lvl; i++) p(BALL, mat('#5b3a1e'), [0.9 - (i % 3) * 0.3, 0.5, 0.9 - Math.floor(i / 3) * 0.28], [0.3, 0.3, 0.3]);
      break;
    }
    case 'estilingao': {
      p(CYL, mat(STONE), [0, 0.18, 0], [1.5, 0.36, 1.5]);
      const aim = new THREE.Group();
      aim.name = 'aim';
      aim.position.y = 0.4;
      g.add(aim);
      p(CYL, mat(WOOD), [0, 0.5, 0], [0.18, 1, 0.18], undefined, aim);
      for (const z of [-1, 1]) p(CYL, mat(WOOD), [0, 1.25, z * 0.3], [0.14, 0.8, 0.14], [z * 0.6, 0, 0], aim);
      p(BOX, mat('#b91c1c'), [-0.3, 1.4, 0], [0.6, 0.05, 0.9], undefined, aim);
      p(BALL, trim, [-0.55, 1.4, 0], [0.26, 0.26, 0.26], undefined, aim);
      break;
    }
    case 'muro':
      break;
  }
  return g;
}

function modelTroop(t: TroopId): THREE.Group {
  const g = new THREE.Group();
  const p = (geo: G, m: THREE.Material, pos: number[], scale: number[], rot?: number[]) => part(g, geo, m, pos, scale, rot);
  const person = (shirt: string, hat: string, skin = '#a8714a') => {
    for (const x of [-0.09, 0.09]) { const l = p(BOX, mat('#4a3421'), [0, 0.14, x], [0.12, 0.28, 0.12]); l.name = 'leg'; }
    p(CYL, mat(shirt), [0, 0.44, 0], [0.34, 0.36, 0.3]);
    p(BALL, mat(skin), [0, 0.73, 0], [0.27, 0.27, 0.27]);
    p(CYL, mat(hat), [0, 0.83, 0], [0.48, 0.05, 0.48]);
    p(CYL, mat(hat), [0, 0.89, 0], [0.26, 0.14, 0.26]);
  };
  switch (t) {
    case 'vaqueiro':
      person('#9a5b2c', '#6b3f1d');
      p(BOX, mat('#cbd5e1', { metal: 0.7, rough: 0.3 }), [0.26, 0.5, 0.18], [0.5, 0.05, 0.06]);
      break;
    case 'rendeira':
      person('#e8e2f4', '#d94f70');
      p(CONE, mat('#d94f70'), [0, 0.25, 0], [0.5, 0.46, 0.5]);
      p(CYL, mat(WOOD), [0.22, 0.5, 0.18], [0.04, 0.62, 0.04]);
      break;
    case 'cangaceiro':
      person('#3f5b7a', '#5a3517');
      g.scale.setScalar(1.55);
      p(BOX, mat('#5a3517'), [0, 0.92, 0], [0.1, 0.24, 0.62]);
      p(BALL, mat(GOLD, { metal: 0.8, rough: 0.3 }), [0.06, 0.96, 0], [0.1, 0.1, 0.1]);
      p(BOX, mat('#7c5a2e'), [0, 0.46, 0], [0.36, 0.08, 0.34]);
      p(BOX, mat('#e2e8f0', { metal: 0.8, rough: 0.2 }), [0.3, 0.48, 0.2], [0.6, 0.06, 0.08]);
      break;
    case 'jegue':
      p(BOX, mat('#8d7f70'), [0, 0.42, 0], [0.6, 0.28, 0.26]);
      p(BOX, mat('#8d7f70'), [0.36, 0.64, 0], [0.22, 0.24, 0.18], [0, 0, -0.5]);
      for (const z of [-0.06, 0.06]) p(CONE, mat('#6d6155'), [0.32, 0.86, z], [0.08, 0.26, 0.08]);
      for (const x of [-0.2, 0.2]) for (const z of [-0.09, 0.09]) { const l = p(BOX, mat('#6d6155'), [x, 0.14, z], [0.09, 0.28, 0.09]); l.name = 'leg'; }
      for (const z of [-0.2, 0.2]) p(CYL, mat('#b3261e'), [-0.05, 0.5, z], [0.2, 0.34, 0.2]);
      p(BALL, mat('#ffb020', { glow: 2 }), [-0.05, 0.75, 0], [0.1, 0.1, 0.1]);
      break;
    case 'carcara':
      p(BALL, mat('#3a2a1d'), [0, 0, 0], [0.62, 0.28, 0.28]);
      p(BALL, mat('#efe3c8'), [0.36, 0.06, 0], [0.24, 0.22, 0.22]);
      p(CONE, mat('#e2762b'), [0.52, 0.05, 0], [0.1, 0.18, 0.1], [0, 0, -Math.PI / 2]);
      for (const z of [-1, 1]) { const w = p(BOX, mat('#2a1d13'), [-0.05, 0.05, z * 0.5], [0.42, 0.04, 0.9]); w.name = z < 0 ? 'wingL' : 'wingR'; }
      p(BOX, mat('#2a1d13'), [-0.4, 0, 0], [0.3, 0.03, 0.3]);
      break;
    case 'boitata':
      for (let i = 0; i < 7; i++) p(BALL, mat(i ? '#ff7a1a' : '#ffd34d', { glow: 1.4 }), [0.45 - i * 0.2, 0.36 + Math.sin(i) * 0.1, Math.sin(i * 1.3) * 0.12], [0.42 - i * 0.04, 0.42 - i * 0.04, 0.42 - i * 0.04]).name = 'seg';
      for (const z of [-0.09, 0.09]) p(BALL, mat('#10202c'), [0.62, 0.44, z], [0.08, 0.08, 0.08]);
      break;
    case 'rezadeira':
      person('#ffffff', '#f3f4f6', '#8a5a3a');
      p(CONE, mat('#ffffff'), [0, 0.25, 0], [0.56, 0.5, 0.56]);
      p(BALL, mat('#86efac', { glow: 1.5 }), [0.26, 0.62, 0], [0.16, 0.16, 0.16]);
      break;
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
/** Mancha que continua do outro lado da textura, sem emenda */
function tiled(ctx: CanvasRenderingContext2D, size: number, x: number, y: number, r: number, color: string) {
  for (const dx of [-size, 0, size]) {
    for (const dy of [-size, 0, size]) {
      const cx = x + dx;
      const cy = y + dy;
      if (cx + r < 0 || cy + r < 0 || cx - r > size || cy - r > size) continue;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, color);
      g.addColorStop(1, color.startsWith('#') ? `${color}00` : 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  }
}
/** Solo do sertão: terra, capim e pedrinhas */
export const soil = () =>
  canvasTexture('soil', 1024, (ctx) => {
    ctx.fillStyle = '#d0aa78';
    ctx.fillRect(0, 0, 1024, 1024);
    const blob = (n: number, colors: string[], r0: number, r1: number, a: number) => {
      for (let i = 0; i < n; i++) {
        const x = Math.random() * 1024;
        const y = Math.random() * 1024;
        const r = r0 + Math.random() * (r1 - r0);
        ctx.globalAlpha = a;
        tiled(ctx, 1024, x, y, r, colors[i % colors.length]);
      }
    };
    blob(260, ['#a8b066', '#b88a58', '#e0c08c', '#98a458'], 30, 130, 0.3);
    blob(1800, ['#6f5a33', '#dcbb86'], 2, 9, 0.4);
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 2600; i++) {
      ctx.strokeStyle = i % 3 ? '#6f7a35' : '#8a6a3a';
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 5, y - 3 - Math.random() * 5);
      ctx.stroke();
    }
  });
/** Ruído claro para multiplicar a cor das regiões do mapa */
export const relief = () =>
  canvasTexture('relief', 512, (ctx) => {
    ctx.fillStyle = '#fbf8f0';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1500; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 4 + Math.random() * 34;
      tiled(ctx, 512, x, y, r, i % 2 ? 'rgba(90,80,60,.16)' : 'rgba(255,255,245,.25)');
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
  r.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.35;
  return r;
}
/** Sol do fim de tarde e céu */
export function light(scene: THREE.Scene, reach: number) {
  scene.add(new THREE.HemisphereLight('#cfe8ff', '#b09468', 1.7));
  const sun = new THREE.DirectionalLight('#ffe2b0', 2.6);
  sun.position.set(-reach * 0.7, reach * 1.1, reach * 0.45);
  sun.castShadow = true;
  const res = window.innerWidth < 700 ? 1024 : 2048;
  sun.shadow.mapSize.set(res, res);
  const c = sun.shadow.camera;
  c.left = c.bottom = -reach;
  c.right = c.top = reach;
  c.far = reach * 4;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
}
/** Baixa a resolução se o aparelho não acompanhar */
export function autoQuality(r: THREE.WebGLRenderer) {
  let slow = 0;
  // Começa contando depois de carregar, para não punir a primeira compilação
  const start = performance.now() + 2500;
  return (dt: number) => {
    if (performance.now() < start) return;
    slow = dt > 0.05 ? slow + 1 : Math.max(0, slow - 0.5);
    if (slow < 25) return;
    slow = 0;
    const p = r.getPixelRatio();
    if (p > 0.7) r.setPixelRatio(p * 0.8);
    else r.shadowMap.autoUpdate = false;
  };
}
