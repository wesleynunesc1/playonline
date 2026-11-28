import * as THREE from 'three';
import type { Act } from './machines';
import { GEO } from './kit';

/**
 * Alunos com corpo articulado (coxas, canelas e braços separados) desenhados em lote.
 * A pose diz a altura do quadril, a inclinação do tronco e o ângulo de cada junta.
 */
export interface Pose { h: number; lean: number; hip: [number, number]; knee: [number, number]; sh: [number, number]; spread: [number, number] }
const P = (h: number, lean = 0, hip: [number, number] = [0, 0], knee: [number, number] = [0, 0], sh: [number, number] = [0, 0], spread: [number, number] = [0.08, 0.08]): Pose => ({ h, lean, hip, knee, sh, spread });
const wave = (t: number, f: number) => 0.5 + 0.5 * Math.sin(t * f);
const STAND = 0.84;

/** Pose de cada exercício. t = tempo, h = altura do assento ou da esteira */
export function pose(act: Act | 'walk', t: number, h: number): Pose {
  const s = Math.sin(t * 7);
  switch (act) {
    case 'walk': return P(STAND + Math.abs(s) * 0.02, 0, [0.45 * s, -0.45 * s], [0.5 * Math.max(0, s), 0.5 * Math.max(0, -s)], [-0.4 * s, 0.4 * s]);
    case 'run': {
      const r = Math.sin(t * 11);
      return P(h + STAND + Math.abs(r) * 0.06, 0.15, [0.8 * r, -0.8 * r], [0.4 + 0.7 * Math.max(0, r), 0.4 + 0.7 * Math.max(0, -r)], [0.6 * r - 0.3, -0.6 * r - 0.3]);
    }
    case 'ellip': {
      const r = Math.sin(t * 6);
      return P(h + STAND, 0.1, [0.35 * r, -0.35 * r], [0.3 + 0.3 * Math.max(0, r), 0.3 + 0.3 * Math.max(0, -r)], [-0.9 - 0.4 * r, -0.9 + 0.4 * r]);
    }
    case 'sit': case 'bath': return P(h + 0.1, 0, [-1.5, -1.5], [1.5, 1.5], [-0.3, -0.3]);
    case 'extend': {
      const k = 1.5 - 1.3 * wave(t, 2.2);
      return P(h + 0.1, -0.15, [-1.5, -1.5], [k, k], [-0.2, -0.2], [0.35, 0.35]);
    }
    case 'push': {
      const w = wave(t, 1.8);
      return P(h + 0.1, -1, [-1.2 - 0.5 * w, -1.2 - 0.5 * w], [0.3 + 1.2 * w, 0.3 + 1.2 * w], [-0.2, -0.2], [0.3, 0.3]);
    }
    case 'pull': return P(h + 0.1, -0.1, [-1.5, -1.5], [1.5, 1.5], [-2.9 + 0.9 * wave(t, 2), -2.9 + 0.9 * wave(t, 2)], [0.4, 0.4]);
    case 'row': {
      const w = wave(t, 2);
      return P(h + 0.08, -0.25 + 0.4 * w, [-1.4, -1.4], [0.4 + 0.8 * w, 0.4 + 0.8 * w], [-1.5 + 0.7 * (1 - w), -1.5 + 0.7 * (1 - w)]);
    }
    case 'press': {
      const w = wave(t, 2);
      return P(h + 0.12, -Math.PI / 2, [0, 0], [Math.PI / 2, Math.PI / 2], [-1.25 - 0.32 * w, -1.25 - 0.32 * w], [0.35 - 0.2 * w, 0.35 - 0.2 * w]);
    }
    case 'squat': {
      const d = wave(t, 1.6);
      return P(h + STAND - 0.34 * d, 0.5 * d, [-1.3 * d, -1.3 * d], [2 * d, 2 * d], [-2.2, -2.2], [1.2, 1.2]);
    }
    case 'curl': {
      const w = wave(t, 2.5);
      return P(STAND, 0, [0, 0], [0, 0], [-0.15 - 1.1 * w, -0.15 - 1.1 * (1 - w)], [0.12, 0.12]);
    }
    case 'fly': case 'flysit': {
      const w = wave(t, 2);
      const base = act === 'fly' ? P(STAND, 0.1) : P(h + 0.1, 0, [-1.5, -1.5], [1.5, 1.5]);
      return { ...base, sh: [-1.45, -1.45], spread: [1.4 - 1.1 * w, 1.4 - 1.1 * w] };
    }
    case 'calf': return P(h + STAND + 0.07 * wave(t, 3), 0, [0, 0], [0, 0], [-0.3, -0.3], [0.5, 0.5]);
    case 'bike': {
      const r = Math.sin(t * 6);
      return P(h + 0.08, 0.45, [-1.1 + 0.45 * r, -1.1 - 0.45 * r], [1.1 - 0.5 * r, 1.1 + 0.5 * r], [-1.1, -1.1], [0.2, 0.2]);
    }
    case 'punch': {
      const r = Math.sin(t * 6) > 0;
      return P(STAND - 0.05, 0.15, [-0.2, 0.15], [0.3, 0.1], [r ? -1.55 : -0.6, r ? -0.6 : -1.55], [0.05, 0.05]);
    }
    case 'dance': {
      const r = Math.sin(t * 3);
      return P(STAND + 0.05 * Math.abs(Math.sin(t * 6)), 0, [0.3 * r, -0.3 * r], [0.2, 0.2], [-2.6 + 0.6 * r, -2.6 - 0.6 * r], [0.4, 0.4]);
    }
    case 'yoga': return P(0.2, 0.04 * Math.sin(t * 1.2), [-1.45, -1.45], [2.6, 2.6], [-0.35, -0.35], [0.55, 0.55]);
    case 'lie': return P(h + 0.12, -Math.PI / 2, [0, 0], [0, 0], [0, 0], [0.15, 0.15]);
    case 'swim': {
      const k = t * 3;
      return P(h, Math.PI / 2, [0.25 * Math.sin(t * 9), -0.25 * Math.sin(t * 9)], [0.15, 0.15], [-(k % (Math.PI * 2)), -((k + Math.PI) % (Math.PI * 2))], [0.15, 0.15]);
    }
    case 'rope': {
      const r = Math.sin(t * 9);
      return P(STAND - 0.15, 0.3, [-0.5, -0.5], [0.7, 0.7], [-0.9 + 0.35 * r, -0.9 - 0.35 * r], [0.25, 0.25]);
    }
    case 'hop': {
      const j = Math.max(0, Math.sin(t * 3));
      const d = Math.max(0, -Math.sin(t * 3));
      return P(STAND + 0.45 * j - 0.25 * d, 0.3 * d, [-0.9 * d, -0.9 * d], [1.4 * d, 1.4 * d], [-0.8 * j, -0.8 * j]);
    }
    case 'swing': {
      const w = wave(t, 2.5);
      return P(STAND - 0.12 * (1 - w), 0.9 * (1 - w), [-0.4 * (1 - w), -0.4 * (1 - w)], [0.5 * (1 - w), 0.5 * (1 - w)], [-1.3 * w, -1.3 * w], [0.1, 0.1]);
    }
    default: return P(h + STAND);
  }
}

const v = new THREE.Vector3(), q = new THREE.Quaternion(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), m = new THREE.Matrix4(), sc = new THREE.Vector3();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const PANTS = new THREE.Color('#1f2937');

export class People {
  group = new THREE.Group();
  private body: THREE.InstancedMesh;
  private head: THREE.InstancedMesh;
  private hair: THREE.InstancedMesh;
  private thigh: THREE.InstancedMesh;
  private shin: THREE.InstancedMesh;
  private arm: THREE.InstancedMesh;
  private all: THREE.InstancedMesh[];
  constructor(max: number) {
    const mk = (g: THREE.BufferGeometry, n: number, color = true) => {
      const im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.75, color: color ? '#fff' : '#1f2937' }), n);
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.castShadow = true;
      if (color) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      im.count = 0;
      this.group.add(im);
      return im;
    };
    this.body = mk(new THREE.CapsuleGeometry(0.19, 0.36, 4, 10), max);
    this.head = mk(GEO.sph, max);
    this.hair = mk(GEO.sph, max);
    this.thigh = mk(new THREE.CapsuleGeometry(0.075, 0.3, 3, 8), max * 2, false);
    this.shin = mk(new THREE.CapsuleGeometry(0.065, 0.3, 3, 8), max * 2);
    this.arm = mk(new THREE.CapsuleGeometry(0.055, 0.44, 3, 8), max * 2);
    this.all = [this.body, this.head, this.hair, this.thigh, this.shin, this.arm];
  }
  /** Posiciona o aluno i com a pose do exercício */
  set(i: number, at: THREE.Vector3, dir: number, p: Pose, shirt: THREE.Color, skin: THREE.Color, hair: THREE.Color) {
    const R = new THREE.Quaternion().setFromAxisAngle(Y, dir).multiply(qa.setFromAxisAngle(X, p.lean));
    const pelvis = at.clone().setY(at.y + p.h);
    const put = (im: THREE.InstancedMesh, k: number, local: THREE.Vector3, rot: THREE.Quaternion, s: THREE.Vector3, color?: THREE.Color) => {
      m.compose(local, rot, s);
      im.setMatrixAt(k, m);
      if (color) im.setColorAt(k, color);
    };
    put(this.body, i, v.set(0, 0.3, 0).applyQuaternion(R).add(pelvis), R, sc.set(1, 1, 0.75), shirt);
    put(this.head, i, v.set(0, 0.78, 0).applyQuaternion(R).add(pelvis), R, sc.set(0.3, 0.32, 0.3), skin);
    put(this.hair, i, v.set(0, 0.86, -0.03).applyQuaternion(R).add(pelvis), R, sc.set(0.32, 0.18, 0.32), hair);
    for (let k = 0; k < 2; k++) {
      const side = k ? 1 : -1;
      const hip = v.set(side * 0.1, 0, 0).applyQuaternion(R).add(pelvis).clone();
      const Rl = R.clone().multiply(qb.setFromAxisAngle(X, p.hip[k]));
      put(this.thigh, i * 2 + k, v.set(0, -0.21, 0).applyQuaternion(Rl).add(hip), Rl, sc.set(1, 1, 1));
      const knee = v.set(0, -0.42, 0).applyQuaternion(Rl).add(hip).clone();
      const Rs = Rl.clone().multiply(qb.setFromAxisAngle(X, p.knee[k]));
      put(this.shin, i * 2 + k, v.set(0, -0.21, 0).applyQuaternion(Rs).add(knee), Rs, sc.set(1, 1, 1), PANTS);
      const shoulder = v.set(side * 0.25, 0.58, 0).applyQuaternion(R).add(pelvis).clone();
      const Ra = R.clone().multiply(q.setFromAxisAngle(Z, side * p.spread[k])).multiply(qb.setFromAxisAngle(X, p.sh[k]));
      put(this.arm, i * 2 + k, v.set(0, -0.27, 0).applyQuaternion(Ra).add(shoulder), Ra, sc.set(1, 1, 1), skin);
    }
  }
  count(n: number) {
    this.body.count = this.head.count = this.hair.count = n;
    this.thigh.count = this.shin.count = this.arm.count = n * 2;
    for (const im of this.all) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }
}
