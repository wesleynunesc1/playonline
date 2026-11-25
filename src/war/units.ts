import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { UnitId } from './data';

/** Modelos das tropas. Cada peça tem um "osso" e o sombreador anima pernas, torres, canos e hélices. */
const BONE = { corpo: 0, pernaE: 1, pernaD: 2, torre: 3, helice: 4, cano: 5, rotor: 6, giro: 7 } as const;
type Bone = keyof typeof BONE;
type V = [number, number, number];
const cache = new Map<UnitId, THREE.BufferGeometry>();

export class Kit {
  parts: THREE.BufferGeometry[] = [];
  bone: Bone = 'corpo';
  pivot: V = [0, 0, 0];
  team = 0;
  light = 0;
  put(geo: THREE.BufferGeometry, color: string, at: V = [0, 0, 0], rot: V = [0, 0, 0], scale: V = [1, 1, 1]) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale)));
    const n = g.attributes.position.count;
    const c = new THREE.Color(color);
    const fill = (size: number, v: number[]) => new THREE.BufferAttribute(new Float32Array(n * size).map((_, i) => v[i % size]), size);
    g.setAttribute('color', fill(3, [c.r, c.g, c.b]));
    g.setAttribute('bone', fill(1, [BONE[this.bone]]));
    g.setAttribute('pivot', fill(3, this.pivot));
    g.setAttribute('team', fill(1, [this.team]));
    g.setAttribute('light', fill(1, [this.light]));
    this.parts.push(g);
    return this;
  }
  box(w: number, h: number, d: number, color: string, at: V, rot?: V) {
    return this.put(new THREE.BoxGeometry(w, h, d), color, at, rot);
  }
  /** Bloco com topo mais estreito, para blindagens inclinadas */
  wedge(w: number, h: number, d: number, top: number, color: string, at: V, rot?: V) {
    const g = new THREE.CylinderGeometry(Math.SQRT1_2 * top, Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4);
    return this.put(g, color, at, rot, [w, h, d]);
  }
  cyl(r: number, len: number, color: string, at: V, rot: V = [0, 0, 0], n = 12, r2 = r) {
    return this.put(new THREE.CylinderGeometry(r2, r, len, n), color, at, rot);
  }
  ball(r: number, color: string, at: V, scale: V = [1, 1, 1]) {
    return this.put(new THREE.SphereGeometry(r, 14, 10), color, at, [0, 0, 0], scale);
  }
  on(bone: Bone, pivot: V, fn: () => void) {
    const [b, p] = [this.bone, this.pivot];
    this.bone = bone;
    this.pivot = pivot;
    fn();
    this.bone = b;
    this.pivot = p;
    return this;
  }
  /** Peças na cor do exército */
  mine(fn: () => void) {
    this.team = 1;
    fn();
    this.team = 0;
    return this;
  }
  /** Vidros e lâmpadas que acendem à noite */
  glow(fn: () => void) {
    this.light = 1;
    fn();
    this.light = 0;
    return this;
  }
  build() {
    const g = mergeGeometries(this.parts)!;
    g.computeBoundingSphere();
    return g;
  }
}
const HALF = Math.PI / 2;
const OLIVE = '#59643f';
const OLIVE2 = '#464f32';
const SAND = '#8a7c57';
const DARK = '#23272c';
const RUBBER = '#16181b';
const STEEL = '#4b525a';
const GLASS = '#2c4a63';

function soldier(k: Kit, cloth: string, vest: string, helmet: string, gun: 'fuzil' | 'sniper' | 'lanca' | '' = 'fuzil') {
  for (const [z, bone] of [[-0.085, 'pernaE'], [0.085, 'pernaD']] as const) {
    k.on(bone, [0, 0.36, z], () => {
      k.box(0.12, 0.2, 0.12, cloth, [0, 0.27, z]).box(0.11, 0.18, 0.11, cloth, [0.01, 0.12, z]).box(0.2, 0.06, 0.12, RUBBER, [0.04, 0.03, z]).box(0.06, 0.06, 0.12, vest, [0.06, 0.2, z]);
    });
  }
  k.box(0.2, 0.1, 0.28, vest, [0, 0.4, 0]).box(0.2, 0.24, 0.32, cloth, [0, 0.55, 0]).box(0.25, 0.22, 0.3, vest, [0.01, 0.54, 0]);
  for (const z of [-0.08, 0.02, 0.1]) k.box(0.05, 0.08, 0.07, vest, [0.14, 0.48, z]);
  k.box(0.14, 0.28, 0.24, vest, [-0.17, 0.55, 0]);
  k.ball(0.085, '#b98a68', [0.02, 0.75, 0]).ball(0.12, helmet, [0, 0.79, 0], [1.05, 0.82, 1]).box(0.05, 0.035, 0.16, DARK, [0.1, 0.76, 0]);
  k.mine(() => k.box(0.06, 0.07, 0.02, '#ffffff', [-0.02, 0.6, 0.2]).box(0.02, 0.04, 0.12, '#ffffff', [-0.12, 0.82, 0]));
  for (const s of [-1, 1]) k.cyl(0.05, 0.22, cloth, [0.06, 0.58, 0.19 * s], [0, 0, 0.5]).cyl(0.042, 0.24, cloth, [0.2, 0.52, 0.13 * s], [0, 0.4 * s, 1.45]);
  if (gun === 'fuzil') k.box(0.46, 0.06, 0.04, DARK, [0.32, 0.54, 0.06]).box(0.05, 0.12, 0.035, DARK, [0.28, 0.47, 0.06]).cyl(0.014, 0.24, DARK, [0.62, 0.55, 0.06], [0, 0, HALF], 6).box(0.1, 0.04, 0.03, DARK, [0.28, 0.6, 0.06]);
  if (gun === 'sniper') k.box(0.5, 0.05, 0.04, '#3c3a2a', [0.3, 0.54, 0.06]).cyl(0.014, 0.6, DARK, [0.82, 0.55, 0.06], [0, 0, HALF], 6).cyl(0.026, 0.22, DARK, [0.3, 0.62, 0.06], [0, 0, HALF], 8);
  if (gun === 'lanca') k.cyl(0.065, 0.95, '#4a4f3a', [0.14, 0.68, 0.16], [0, 0, HALF], 10).put(new THREE.ConeGeometry(0.08, 0.2, 10), '#3a3f2d', [0.7, 0.68, 0.16], [0, 0, -HALF]).box(0.12, 0.1, 0.06, DARK, [0.16, 0.58, 0.16]);
}
function wheels(k: Kit, xs: number[], z: number, r: number, w = 0.15) {
  for (const x of xs) for (const s of [-1, 1]) k.cyl(r, w, RUBBER, [x, r, z * s], [HALF, 0, 0], 14).cyl(r * 0.5, w + 0.02, STEEL, [x, r, z * s], [HALF, 0, 0], 8);
}
function tracks(k: Kit, len: number, z: number, r: number, hull: string) {
  for (const s of [-1, 1]) {
    k.box(len - r, r * 2, 0.2, RUBBER, [0, r, z * s]);
    for (const e of [-1, 1]) k.cyl(r, 0.2, RUBBER, [(e * (len - r)) / 2, r, z * s], [HALF, 0, 0], 14);
    const n = 6;
    for (let i = 0; i < n; i++) k.cyl(r * 0.62, 0.23, STEEL, [(i / (n - 1) - 0.5) * (len - r * 1.2), r * 0.85, z * s], [HALF, 0, 0], 10);
    k.box(len * 0.98, 0.14, 0.05, hull, [-0.02, r * 2.05, (z + 0.12) * s]);
  }
}

function model(t: UnitId): THREE.BufferGeometry {
  const k = new Kit();
  switch (t) {
    case 'soldado': soldier(k, '#57603f', '#3b402c', '#4a5136'); break;
    case 'sniper': soldier(k, '#6c6544', '#4c4730', '#5a5438', 'sniper'); break;
    case 'antitanque': soldier(k, '#5f5d42', '#413f2c', '#504e36', 'lanca'); break;
    case 'medico':
      soldier(k, '#6a7062', '#e9ecee', '#e9ecee', '');
      k.box(0.02, 0.04, 0.16, '#d92d2d', [0.15, 0.56, 0]).box(0.02, 0.16, 0.04, '#d92d2d', [0.15, 0.56, 0]).box(0.16, 0.32, 0.28, '#b91c1c', [-0.18, 0.55, 0]).box(0.02, 0.05, 0.16, '#fff', [-0.27, 0.57, 0]).box(0.02, 0.16, 0.05, '#fff', [-0.27, 0.57, 0]);
      break;
    case 'moto':
      for (const x of [-0.36, 0.4]) k.put(new THREE.TorusGeometry(0.15, 0.05, 8, 18), RUBBER, [x, 0.2, 0]).cyl(0.09, 0.05, STEEL, [x, 0.2, 0], [HALF, 0, 0], 10);
      k.box(0.5, 0.12, 0.14, DARK, [0, 0.3, 0]).box(0.26, 0.14, 0.17, OLIVE, [0.12, 0.43, 0]).box(0.4, 0.07, 0.15, RUBBER, [-0.2, 0.42, 0]).cyl(0.02, 0.4, STEEL, [0.33, 0.38, 0], [0, 0, 0.35], 6).cyl(0.016, 0.36, STEEL, [0.26, 0.58, 0], [HALF, 0, 0], 6);
      k.box(0.22, 0.32, 0.26, '#57603f', [-0.1, 0.64, 0], [0, 0, -0.25]).ball(0.12, '#4a5136', [0.02, 0.88, 0]).box(0.05, 0.05, 0.16, DARK, [0.12, 0.87, 0]);
      for (const s of [-1, 1]) k.cyl(0.042, 0.34, '#57603f', [0.1, 0.64, 0.14 * s], [0, 0, 1.15], 8).cyl(0.06, 0.3, '#57603f', [-0.02, 0.42, 0.12 * s], [0, 0, 1], 8);
      k.mine(() => k.box(0.18, 0.1, 0.18, '#ffffff', [0.14, 0.45, 0]));
      break;
    case 'blindado':
      wheels(k, [-0.42, 0, 0.42], 0.36, 0.17);
      k.wedge(1.4, 0.26, 0.74, 0.86, OLIVE, [0, 0.34, 0]).wedge(1.15, 0.2, 0.68, 0.76, OLIVE2, [-0.05, 0.56, 0]).box(0.03, 0.09, 0.42, GLASS, [0.5, 0.56, 0], [0, 0, 0.5]);
      for (const z of [-0.3, 0.3]) k.box(0.06, 0.06, 0.08, '#f5efcf', [0.66, 0.36, z]).box(0.4, 0.1, 0.05, OLIVE2, [-0.1, 0.42, z * 1.3]);
      k.on('torre', [0, 0.7, 0], () => { k.cyl(0.18, 0.12, OLIVE2, [0, 0.7, 0], [0, 0, 0], 10).box(0.24, 0.12, 0.16, OLIVE, [0.08, 0.79, 0]); });
      k.on('cano', [0, 0.7, 0], () => { k.cyl(0.022, 0.55, DARK, [0.42, 0.8, 0.02], [0, 0, HALF], 8); });
      k.mine(() => k.box(0.3, 0.012, 0.3, '#ffffff', [-0.36, 0.665, 0]));
      break;
    case 'tanque':
      tracks(k, 1.5, 0.38, 0.17, OLIVE2);
      k.wedge(1.5, 0.2, 0.62, 0.9, OLIVE, [0, 0.4, 0]).wedge(1.24, 0.1, 0.84, 0.9, OLIVE, [-0.05, 0.5, 0]).box(0.4, 0.02, 0.6, OLIVE2, [-0.5, 0.56, 0]);
      for (let i = 0; i < 5; i++) k.box(0.03, 0.03, 0.5, DARK, [-0.38 - i * 0.06, 0.57, 0]);
      for (const z of [-0.26, 0.26]) k.box(0.05, 0.06, 0.08, '#f5efcf', [0.68, 0.44, z]);
      k.on('torre', [-0.05, 0.6, 0], () => {
        k.wedge(0.84, 0.22, 0.66, 0.74, OLIVE, [-0.05, 0.66, 0]).wedge(0.4, 0.16, 0.5, 0.7, OLIVE2, [0.3, 0.65, 0]).cyl(0.1, 0.07, OLIVE2, [-0.12, 0.8, 0.14], [0, 0, 0], 10).cyl(0.08, 0.06, DARK, [-0.12, 0.8, -0.14], [0, 0, 0], 10).box(0.3, 0.12, 0.5, OLIVE2, [-0.5, 0.66, 0]).cyl(0.006, 0.5, DARK, [-0.4, 1, 0.2], [0, 0, 0.1], 4).box(0.2, 0.03, 0.03, DARK, [0, 0.87, 0.14]);
        for (const z of [-0.3, 0.3]) for (let i = 0; i < 3; i++) k.cyl(0.025, 0.1, DARK, [0.16 - i * 0.07, 0.72, z], [0.4 * Math.sign(z), 0, -0.6], 6);
        k.mine(() => k.box(0.22, 0.012, 0.42, '#ffffff', [-0.34, 0.775, 0]));
      });
      k.on('cano', [-0.05, 0.6, 0], () => { k.cyl(0.045, 1, OLIVE2, [0.92, 0.66, 0], [0, 0, HALF], 12, 0.04).cyl(0.06, 0.2, OLIVE2, [0.95, 0.66, 0], [0, 0, HALF], 12).cyl(0.055, 0.1, DARK, [1.42, 0.66, 0], [0, 0, HALF], 12); });
      break;
    case 'artilharia':
      tracks(k, 1.4, 0.36, 0.16, OLIVE2);
      k.wedge(1.4, 0.22, 0.62, 0.9, OLIVE, [0, 0.42, 0]);
      k.on('torre', [-0.2, 0.55, 0], () => {
        k.wedge(0.85, 0.36, 0.72, 0.8, OLIVE, [-0.24, 0.7, 0]).box(0.1, 0.16, 0.2, OLIVE2, [0.18, 0.74, 0]);
        k.mine(() => k.box(0.26, 0.012, 0.4, '#ffffff', [-0.3, 0.885, 0]));
      });
      k.on('cano', [-0.2, 0.55, 0], () => { k.cyl(0.055, 1.35, OLIVE2, [0.72, 1, 0], [0, 0, HALF - 0.5], 12, 0.045).cyl(0.075, 0.16, DARK, [1.32, 1.33, 0], [0, 0, HALF - 0.5], 10); });
      break;
    case 'foguete':
      wheels(k, [-0.55, -0.15, 0.5], 0.34, 0.18);
      k.box(1.6, 0.14, 0.5, DARK, [0, 0.36, 0]).wedge(0.44, 0.42, 0.66, 0.82, SAND, [0.55, 0.62, 0]).box(0.03, 0.16, 0.5, GLASS, [0.74, 0.7, 0], [0, 0, 0.2]);
      k.on('torre', [-0.3, 0.5, 0], () => {
        k.box(0.9, 0.36, 0.62, SAND, [-0.28, 0.82, 0], [0, 0, 0.42]);
        for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) k.cyl(0.062, 0.94, DARK, [-0.27 - i * 0.07, 0.78 + i * 0.15, -0.23 + j * 0.153], [0, 0, 0.42 - HALF], 10);
        k.mine(() => k.box(0.5, 0.012, 0.3, '#ffffff', [-0.36, 1.015, 0], [0, 0, 0.42]));
      });
      break;
    case 'antiaerea':
      wheels(k, [-0.44, 0, 0.46], 0.34, 0.18);
      k.box(1.4, 0.16, 0.56, OLIVE2, [0, 0.38, 0]).wedge(0.36, 0.34, 0.6, 0.82, OLIVE, [0.5, 0.6, 0]).box(0.03, 0.13, 0.44, GLASS, [0.67, 0.66, 0], [0, 0, 0.2]);
      k.on('torre', [-0.2, 0.5, 0], () => {
        k.cyl(0.24, 0.1, OLIVE, [-0.2, 0.52, 0], [0, 0, 0], 12).box(0.2, 0.3, 0.2, OLIVE2, [-0.2, 0.7, 0]).put(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 16, 1, false, 0, Math.PI), STEEL, [-0.4, 0.95, 0], [0, 0, HALF]);
        for (const z of [-0.28, -0.16, 0.16, 0.28]) k.cyl(0.055, 0.8, '#d7dade', [-0.1, 0.86, z], [0, 0, 0.75 - HALF], 10).put(new THREE.ConeGeometry(0.055, 0.14, 10), '#b91c1c', [0.24, 1.18, z], [0, 0, 0.75 - HALF]);
        k.mine(() => k.box(0.22, 0.02, 0.22, '#ffffff', [-0.2, 0.86, 0]));
      });
      break;
    case 'hacker':
      wheels(k, [-0.4, 0.42], 0.34, 0.19);
      k.wedge(1.35, 0.3, 0.68, 0.92, '#4c565f', [0, 0.42, 0]).box(0.72, 0.34, 0.6, '#3c454d', [-0.2, 0.72, 0]).box(0.03, 0.14, 0.5, GLASS, [0.38, 0.66, 0], [0, 0, 0.5]).cyl(0.015, 0.75, STEEL, [-0.45, 1.25, 0.18], [0, 0, 0], 6).cyl(0.015, 0.55, STEEL, [-0.45, 1.15, -0.18], [0, 0, 0], 6);
      k.on('helice', [-0.1, 1, 0], () => { k.put(new THREE.SphereGeometry(0.24, 14, 8, 0, 6.3, 0, 1), '#cfd6dc', [0.02, 1.2, 0], [0, 0, 1.2 + HALF]); });
      k.mine(() => k.box(0.4, 0.012, 0.4, '#ffffff', [-0.2, 0.895, 0]));
      break;
    case 'fpv':
      k.box(0.3, 0.06, 0.12, DARK, [0, 0, 0]).cyl(0.05, 0.36, '#7b2a22', [0.06, -0.08, 0], [0, 0, HALF], 10).put(new THREE.ConeGeometry(0.05, 0.12, 10), '#4b5563', [0.3, -0.08, 0], [0, 0, -HALF]).box(0.05, 0.05, 0.06, '#1d4ed8', [0.16, 0.02, 0]);
      for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
        k.box(0.3, 0.025, 0.03, DARK, [x * 0.5, 0.01, z * 0.5], [0, Math.atan2(-z, x), 0]);
        k.on('helice', [x, 0.06, z], () => { k.box(0.24, 0.008, 0.025, '#9aa3ad', [x, 0.06, z]); });
      }
      k.mine(() => k.box(0.14, 0.02, 0.1, '#ffffff', [-0.04, 0.04, 0]));
      break;
    case 'recon':
      k.put(new THREE.CapsuleGeometry(0.09, 0.7, 6, 12), '#8a9299', [0, 0, 0], [0, 0, HALF]).box(0.2, 0.025, 1.7, '#7b838b', [0.02, 0.05, 0]).box(0.12, 0.02, 0.5, '#7b838b', [-0.44, 0.06, 0]);
      for (const z of [-0.16, 0.16]) k.box(0.1, 0.16, 0.02, '#7b838b', [-0.44, 0.13, z]);
      k.ball(0.06, DARK, [0.32, -0.09, 0]);
      k.on('helice', [-0.52, 0, 0], () => { k.box(0.02, 0.05, 0.3, DARK, [-0.52, 0, 0]); });
      k.mine(() => k.box(0.16, 0.012, 0.36, '#ffffff', [0.02, 0.07, 0.5]).box(0.16, 0.012, 0.36, '#ffffff', [0.02, 0.07, -0.5]));
      break;
    case 'heli':
      k.put(new THREE.CapsuleGeometry(0.24, 0.6, 8, 14), '#3c4632', [0.1, 0, 0], [0, 0, HALF]).ball(0.2, GLASS, [0.46, 0.06, 0], [1.15, 0.95, 0.9]).ball(0.17, GLASS, [0.22, 0.17, 0], [1.2, 0.8, 0.9]).cyl(0.11, 1.1, '#3c4632', [-0.72, 0.06, 0], [0, 0, HALF], 10, 0.05).box(0.18, 0.4, 0.04, '#333c2b', [-1.2, 0.24, 0], [0, 0, 0.3]).box(0.12, 0.03, 0.5, '#333c2b', [-1.05, 0.08, 0]).box(0.4, 0.16, 0.3, '#333c2b', [0, 0.26, 0]);
      k.box(0.2, 0.05, 1, '#333c2b', [0.05, -0.04, 0], [0, 0, 0.08]);
      for (const z of [-0.44, 0.44]) k.cyl(0.075, 0.44, DARK, [0.08, -0.12, z], [0, 0, HALF], 10).cyl(0.03, 0.4, '#d7dade', [0.08, -0.12, z * 0.72], [0, 0, HALF], 6);
      for (const z of [-0.16, 0.16]) k.box(0.7, 0.025, 0.03, DARK, [0.08, -0.36, z]).cyl(0.015, 0.16, DARK, [0.28, -0.28, z], [0, 0, 0], 5).cyl(0.015, 0.16, DARK, [-0.12, -0.28, z], [0, 0, 0], 5);
      k.cyl(0.03, 0.16, DARK, [0.02, 0.4, 0]).cyl(0.02, 0.3, DARK, [0.55, -0.16, 0], [0, 0, HALF], 6);
      k.on('helice', [0.02, 0.48, 0], () => { for (const a of [0, HALF]) k.box(2.4, 0.018, 0.1, '#1b1f22', [0.02, 0.48, 0], [0, a, 0]); });
      k.mine(() => k.box(0.12, 0.2, 0.52, '#ffffff', [-0.28, 0, 0]));
      break;
    case 'caca':
      k.put(new THREE.CapsuleGeometry(0.13, 1.1, 6, 12), '#6b7682', [0, 0, 0], [0, 0, HALF], [1, 1, 1.15]).put(new THREE.ConeGeometry(0.13, 0.6, 12), '#58626d', [0.96, 0, 0], [0, 0, -HALF]).ball(0.12, '#c08a2e', [0.42, 0.13, 0], [1.9, 0.85, 0.8]);
      {
        const wing = new THREE.Shape([[0.3, 0], [-0.25, 0.85], [-0.5, 0.85], [-0.5, 0]].map(([x, y]) => new THREE.Vector2(x, y)));
        const tail = new THREE.Shape([[0, 0], [-0.22, 0.36], [-0.4, 0.36], [-0.36, 0]].map(([x, y]) => new THREE.Vector2(x, y)));
        for (const s of [-1, 1]) {
          const ex = (sh: THREE.Shape) => new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false }).rotateX(HALF * s);
          k.put(ex(wing), '#616c77', [0.1, s > 0 ? 0.02 : -0.01, 0]).put(ex(tail), '#616c77', [-0.5, 0.02, 0.1 * s]).put(new THREE.ExtrudeGeometry(tail, { depth: 0.025, bevelEnabled: false }), '#58626d', [-0.42, 0.08, 0.13 * s], [0.25 * s, 0, 0]);
          k.cyl(0.085, 0.3, '#2f343a', [-0.74, 0, 0.1 * s], [0, 0, HALF], 12).cyl(0.06, 0.02, '#ff9d3d', [-0.9, 0, 0.1 * s], [0, 0, HALF], 12).cyl(0.03, 0.5, '#e3e6ea', [-0.12, -0.06, 0.46 * s], [0, 0, HALF], 6);
        }
      }
      k.mine(() => { for (const s of [-1, 1]) k.box(0.16, 0.012, 0.2, '#ffffff', [-0.24, 0.045, 0.5 * s]); });
      break;
  }
  return k.build();
}
/** Pequenos crescem um pouco para se lerem melhor de longe */
const SIZE: Partial<Record<UnitId, number>> = { tanque: 1.15, artilharia: 1.1, foguete: 1.1, heli: 1.15, caca: 1.15, recon: 1.1, fpv: 1.3 };
export function unitGeometry(t: UnitId): THREE.BufferGeometry {
  let g = cache.get(t);
  if (!g) {
    g = model(t);
    const s = SIZE[t] ?? 1;
    g.scale(s, s, s);
    const p = g.attributes.pivot as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s);
    cache.set(t, g);
  }
  return g;
}
export const UNIT_TIME = { value: 0 };
export const UNIT_NIGHT = { value: 0 };
/** anim por tropa: passada, giro da torre, recuo do cano, inclinação */
export function unitMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.18 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uT = UNIT_TIME;
    s.uniforms.uN = UNIT_NIGHT;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float bone,team,light; varying float vLight; attribute vec3 pivot; attribute vec4 anim; uniform float uT;\nvec2 rot2(vec2 v,float a){ float c=cos(a),n=sin(a); return vec2(c*v.x-n*v.y,n*v.x+c*v.y); }')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvLight=light;\n#ifdef USE_INSTANCING_COLOR\nvColor.rgb=color*mix(mix(vec3(1.),instanceColor,.14),instanceColor,team);\n#endif')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float ang=bone<.5?0.:bone<1.5?sin(anim.x)*.7:bone<2.5?-sin(anim.x)*.7:0.; if(anim.x==0.) ang=0.;
        float yaw=(bone>2.5&&bone<3.5)||(bone>4.5&&bone<5.5)?anim.y:bone>3.5&&bone<4.5?uT*26.:0.; float roll=bone>5.5&&bone<6.5?uT*1.5:0.; if(bone>6.5) yaw=uT*1.1;
        objectNormal.xy=rot2(objectNormal.xy,ang); objectNormal.xz=rot2(objectNormal.xz,yaw);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 q=transformed-pivot; q.xy=rot2(q.xy,ang); if(bone>4.5&&bone<5.5) q.x-=anim.z*.22; q.yz=rot2(q.yz,roll); q.xz=rot2(q.xz,yaw); transformed=q+pivot;
        transformed.yz=rot2(transformed.yz,anim.w);`);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLight; uniform float uN;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vLight*uN*vec3(1.,.82,.5)*.9;');
  };
  return m;
}
