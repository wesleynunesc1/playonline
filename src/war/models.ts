import * as THREE from 'three';
import { sprites } from '../fx/particles';

/** Materiais, texturas de efeito e renderizador compartilhados. */
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
// ===== Texturas =====
const texCache = new Map<string, THREE.Texture>();
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
