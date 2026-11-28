import * as THREE from 'three';

/** Peças básicas do 3D: geometrias, materiais e texturas compartilhadas */
export interface Ctx { g: THREE.Group; seats: import('./machines').Seat[]; spin: { m: THREE.Object3D; s: number; axis?: 'x' | 'y' | 'z' }[] }

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
  sph: new THREE.SphereGeometry(0.5, 16, 12),
  cone: new THREE.ConeGeometry(0.5, 1, 16),
  plane: new THREE.PlaneGeometry(1, 1),
  torus: new THREE.TorusGeometry(0.5, 0.08, 8, 24),
};
const mats = new Map<string, THREE.Material>();
export function mat(color: string, o: { r?: number; m?: number; glow?: number; op?: number } = {}) {
  const k = color + JSON.stringify(o);
  let m = mats.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.6, metalness: o.m ?? 0, emissive: o.glow ? color : '#000', emissiveIntensity: o.glow ?? 0, transparent: o.op !== undefined, opacity: o.op ?? 1 });
    mats.set(k, m);
  }
  return m;
}
export const tex = (c: HTMLCanvasElement, rx = 1, ry = 1) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  return t;
};
export const texMat = (t: THREE.Texture, glow = 0, rough = 0.7) => new THREE.MeshStandardMaterial({ map: t, roughness: rough, emissive: glow ? '#fff' : '#000', emissiveMap: glow ? t : null, emissiveIntensity: glow });

/** Coloca uma peça: posição, tamanho e giro em y */
export function part(c: Ctx, g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  o.rotation.y = ry;
  c.g.add(o);
  return o;
}
/** Tubo de aço entre dois pontos (quadros dos aparelhos) */
export function tube(c: Ctx, m: THREE.Material, a: [number, number, number], b: [number, number, number], w = 0.08) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const o = new THREE.Mesh(GEO.box, m);
  o.position.copy(va).add(vb).multiplyScalar(0.5);
  o.scale.set(w, va.distanceTo(vb), w);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  c.g.add(o);
  return o;
}
