import * as THREE from 'three';
import { UNIT_IDS, UnitId, WORKS_IDS, WorksId } from './data';
import { worksParts } from './models';
import { unitGeometry } from './units';

/** Ícones das tropas e construções: fotos dos próprios modelos 3D, feitas uma vez */
let pics: Record<string, string> | null = null;
export function thumbs(): Record<string, string> {
  if (pics) return pics;
  pics = {};
  try {
    const size = 128;
    const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setSize(size, size, false);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.15;
    const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 100);
    const shoot = (key: string, o: THREE.Object3D) => {
      const scene = new THREE.Scene();
      const sun = new THREE.DirectionalLight('#fff1dc', 3.2);
      sun.position.set(2, 4, 3);
      scene.add(new THREE.HemisphereLight('#dcecff', '#8f7d5c', 1.6), sun, o);
      const b = new THREE.Box3().setFromObject(o);
      const c = b.getCenter(new THREE.Vector3());
      const d = b.getSize(new THREE.Vector3()).length() * 1.75;
      camera.position.set(c.x + d * 0.62, c.y + d * 0.42, c.z + d * 0.66);
      camera.lookAt(c);
      r.render(scene, camera);
      pics![key] = r.domElement.toDataURL('image/webp', 0.9);
    };
    const body = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15 });
    for (const k of UNIT_IDS) shoot(k, new THREE.Mesh(unitGeometry(k as UnitId), body));
    for (const k of ['comando', ...WORKS_IDS] as WorksId[]) {
      const g = new THREE.Group();
      for (const p of worksParts(k)) g.add(new THREE.Mesh(p.geo, p.mat));
      shoot(`w-${k}`, g);
    }
    r.dispose();
    r.forceContextLoss();
  } catch { /* sem fotos: os emojis continuam valendo */ }
  return pics;
}
