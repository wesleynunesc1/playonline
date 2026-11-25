import * as THREE from 'three';
import type { WorksId } from './data';
import { Kit } from './units';

/** Construções: mesma linguagem visual para todas, com detalhes na cor do dono. Vidros e luzes brilham à noite. */
const HALF = Math.PI / 2;
const WALL = '#d9d4c8';
const WALL2 = '#b7b2a6';
const ROOF = '#6d6f72';
const DARK = '#2a2e33';
const STEEL = '#7c848c';
const GLASS = '#2f5873';
const OLIVE = '#59624a';
const CONCRETE = '#9a9a94';
const ASPHALT = '#3b3e42';
const cache = new Map<WorksId, THREE.BufferGeometry>();

const base = (k: Kit, w: number, d: number, color = CONCRETE) => k.box(w, 0.06, d, '#82837e', [0, 0.03, 0]).box(w * 0.95, 0.04, d * 0.95, color, [0, 0.07, 0]);
/** Prédio com faixas de janelas */
function block(k: Kit, w: number, h: number, d: number, at: [number, number, number], wall = WALL) {
  const [x, y, z] = at;
  k.box(w, h, d, wall, [x, y + h / 2, z]);
  const n = Math.max(1, Math.round(h / 0.34));
  for (let i = 0; i < n; i++) {
    const yy = y + ((i + 0.55) / n) * h;
    k.glow(() => k.box(w * 1.012, (h / n) * 0.42, d * 0.86, GLASS, [x, yy, z]).box(w * 0.86, (h / n) * 0.42, d * 1.012, GLASS, [x, yy, z]));
  }
  for (const s of [-1, 1]) for (const t of [-1, 1]) k.box(0.06, h, 0.06, wall, [x + (w / 2) * s, y + h / 2, z + (d / 2) * t]);
  k.box(w * 1.06, 0.06, d * 1.06, ROOF, [x, y + h + 0.03, z]).box(w * 0.3, 0.1, d * 0.26, WALL2, [x - w * 0.16, y + h + 0.1, z + d * 0.12]).cyl(0.06, 0.08, STEEL, [x + w * 0.22, y + h + 0.09, z - d * 0.2], [0, 0, 0], 8);
}
const trees = (k: Kit, list: [number, number][]) => list.forEach(([x, z]) => k.cyl(0.025, 0.16, '#5a4632', [x, 0.16, z], [0, 0, 0], 5).ball(0.12, '#3f5f2b', [x, 0.32, z], [1, 0.9, 1]));
const truck = (k: Kit, x: number, z: number, c: string) => k.box(0.34, 0.13, 0.16, c, [x, 0.2, z]).box(0.12, 0.15, 0.15, DARK, [x + 0.22, 0.2, z]).box(0.46, 0.05, 0.14, '#16181b', [x + 0.04, 0.11, z]);
const fence = (k: Kit, w: number, d: number) => {
  for (const s of [-1, 1]) k.box(w, 0.14, 0.03, WALL2, [0, 0.16, (d / 2) * s]).box(0.03, 0.14, d, WALL2, [(w / 2) * s, 0.16, 0]);
};
const mast = (k: Kit, x: number, z: number, h: number) => {
  k.cyl(0.018, h, STEEL, [x, h / 2, z], [0, 0, 0], 6);
  k.mine(() => k.box(0.32, 0.18, 0.015, '#ffffff', [x + 0.17, h - 0.12, z]));
};

function model(b: WorksId): THREE.BufferGeometry {
  const k = new Kit();
  switch (b) {
    case 'comando':
      base(k, 3.4, 3.4, '#a7a399');
      block(k, 1.9, 0.9, 1.1, [0, 0.08, -0.5], '#e4dfd3');
      block(k, 0.8, 1.7, 0.8, [0, 0.08, -0.5], '#ded8ca');
      for (let i = -3; i <= 3; i++) k.cyl(0.05, 0.75, '#f0ece2', [i * 0.26, 0.46, 0.18], [0, 0, 0], 10);
      k.box(2, 0.1, 0.42, '#f0ece2', [0, 0.88, 0.1]).box(1.5, 0.06, 0.5, '#c9c4b7', [0, 0.11, 0.42]).box(1.7, 0.03, 0.8, '#c9c4b7', [0, 0.09, 0.5]);
      k.mine(() => k.box(0.82, 0.06, 0.82, '#ffffff', [0, 1.84, -0.5]).box(0.5, 0.02, 0.5, '#ffffff', [0, 0.1, 1.2]));
      mast(k, 0.9, 1, 1.4);
      trees(k, [[-1.4, 1.2], [-1.4, 0.7], [1.4, 1.2], [1.4, 0.2], [-1.4, -1.2], [1.4, -1.2]]);
      k.box(0.7, 0.015, 1.4, '#5d7a45', [-1, 0.095, 0.9]);
      break;
    case 'mercado':
      base(k, 2.5, 2.4);
      for (let i = 0; i < 4; i++) {
        const c = ['#c9794a', '#d8c9a4', '#7f9aa6', '#b9b3a4'][i];
        k.box(0.52, 0.5 + (i % 2) * 0.16, 0.8, c, [-0.82 + i * 0.55, 0.34 + (i % 2) * 0.08, -0.4]).box(0.5, 0.04, 0.3, ['#8c3b2e', '#e8e2d2', '#2f5f7d', '#b98b2f'][i], [-0.82 + i * 0.55, 0.42, 0.14], [0.35, 0, 0]);
        k.glow(() => k.box(0.4, 0.2, 0.02, '#f2d9a0', [-0.82 + i * 0.55, 0.24, 0.005]));
      }
      for (let i = 0; i < 3; i++) k.put(new THREE.ConeGeometry(0.22, 0.12, 4), ['#b5483a', '#e6e0d0', '#3a6b86'][i], [-0.7 + i * 0.7, 0.46, 0.75], [0, 0.78, 0]).cyl(0.012, 0.34, STEEL, [-0.7 + i * 0.7, 0.24, 0.75], [0, 0, 0], 5);
      k.mine(() => k.box(0.6, 0.14, 0.04, '#ffffff', [0, 0.92, -0.2]));
      break;
    case 'shopping':
      base(k, 3.4, 3.2, ASPHALT);
      k.box(2.7, 0.9, 1.7, '#e0dcd2', [0, 0.53, -0.55]).box(2.78, 0.08, 1.78, ROOF, [0, 1.02, -0.55]);
      k.glow(() => k.box(1.5, 0.62, 0.04, GLASS, [0, 0.44, 0.31]).box(1.2, 0.3, 0.7, GLASS, [0, 1.18, -0.55]));
      k.mine(() => k.box(0.9, 0.2, 0.05, '#ffffff', [0, 0.88, 0.33]));
      for (let i = 0; i < 9; i++) k.box(0.2, 0.08, 0.1, ['#b91c1c', '#e5e7eb', '#1d4ed8', '#374151'][i % 4], [-1.3 + i * 0.33, 0.14, 0.85 + (i % 2) * 0.35]);
      trees(k, [[-1.5, 1.4], [0, 1.4], [1.5, 1.4]]);
      break;
    case 'banco':
      base(k, 1.9, 1.9);
      block(k, 1.1, 1.8, 1.1, [0, 0.08, -0.1], '#c8cdd0');
      for (let i = -1; i <= 1; i++) k.cyl(0.05, 0.6, '#f0ece2', [i * 0.35, 0.38, 0.62], [0, 0, 0], 10);
      k.box(1.2, 0.08, 0.4, '#f0ece2', [0, 0.72, 0.56]);
      k.mine(() => k.box(0.5, 0.16, 0.03, '#ffffff', [0, 1.75, 0.47]));
      break;
    case 'refinaria':
      base(k, 2.6, 2.4, '#77756e');
      for (const [x, z] of [[-0.8, -0.65], [-0.15, -0.65], [-0.8, 0.05]] as const) k.cyl(0.28, 0.5, '#e6e4dd', [x, 0.33, z], [0, 0, 0], 20).cyl(0.29, 0.03, STEEL, [x, 0.6, z], [0, 0, 0], 20);
      for (let i = 0; i < 4; i++) k.cyl(0.07 - i * 0.006, 1.3 + i * 0.22, i % 2 ? '#c7c9c9' : STEEL, [0.4 + i * 0.2, 0.75 + i * 0.1, -0.5], [0, 0, 0], 10);
      k.box(1, 0.5, 0.5, WALL2, [0.6, 0.33, 0.3]).box(1.8, 0.04, 0.04, '#b9772a', [0, 0.5, -0.3]).box(0.04, 0.04, 1, '#b9772a', [-0.4, 0.36, 0]);
      k.glow(() => k.cyl(0.04, 0.12, '#ffb13d', [1, 1.72, -0.5], [0, 0, 0], 8));
      fence(k, 2.5, 2.3);
      truck(k, 0.2, 0.9, '#d7d3c7');
      k.mine(() => k.cyl(0.285, 0.08, '#ffffff', [-0.8, 0.42, -0.65], [0, 0, 0], 20));
      break;
    case 'solar':
      base(k, 2.6, 2.4, '#8b8668');
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) k.box(0.54, 0.025, 0.52, '#17305a', [-0.9 + i * 0.6, 0.3, -0.75 + j * 0.75], [0.5, 0, 0]).box(0.56, 0.015, 0.54, '#c3c8cc', [-0.9 + i * 0.6, 0.285, -0.755 + j * 0.75], [0.5, 0, 0]).cyl(0.02, 0.2, STEEL, [-0.9 + i * 0.6, 0.18, -0.75 + j * 0.75], [0, 0, 0], 5);
      fence(k, 2.55, 2.35);
      k.mine(() => k.box(0.26, 0.2, 0.26, '#ffffff', [1.1, 0.18, 1]));
      break;
    case 'eolica':
      base(k, 1.2, 1.2, '#8b8668');
      k.cyl(0.11, 3.4, '#f2f4f5', [0, 1.75, 0], [0, 0, 0], 14, 0.07).box(0.46, 0.18, 0.18, '#e7eaec', [0, 3.46, 0]);
      k.on('rotor', [0.26, 3.46, 0], () => {
        k.ball(0.09, '#e7eaec', [0.27, 3.46, 0]);
        for (let i = 0; i < 3; i++) {
          const a = (i * Math.PI * 2) / 3;
          k.box(0.03, 1.5, 0.14, '#f4f6f7', [0.28, 3.46 + Math.cos(a) * 0.78, Math.sin(a) * 0.78], [a, 0, 0]);
        }
      });
      k.box(0.3, 0.24, 0.3, WALL2, [-0.4, 0.2, 0.35]);
      k.mine(() => k.cyl(0.1, 0.16, '#ffffff', [0, 2.6, 0], [0, 0, 0], 14));
      break;
    case 'quartel':
      base(k, 2.8, 2.6, '#8a8670');
      for (const z of [-0.75, 0]) k.box(1.9, 0.42, 0.5, '#7a7d64', [-0.2, 0.29, z]).wedge(2, 0.24, 0.6, 0.02, '#5c5f4c', [-0.2, 0.62, z]);
      k.glow(() => { for (const z of [-0.75, 0]) for (let i = 0; i < 6; i++) k.box(0.14, 0.12, 0.52, '#d8c48c', [-0.95 + i * 0.3, 0.34, z]); });
      fence(k, 2.7, 2.5);
      truck(k, -0.6, 0.8, OLIVE);
      truck(k, 0.1, 0.8, OLIVE);
      mast(k, 1.1, 0.9, 1.2);
      k.box(0.4, 0.7, 0.4, '#7a7d64', [1.1, 0.4, -0.8]).box(0.5, 0.06, 0.5, '#4e5140', [1.1, 0.78, -0.8]);
      break;
    case 'fabrica':
      base(k, 3, 2.8, ASPHALT);
      for (let i = 0; i < 3; i++) k.box(0.8, 0.8, 1.5, '#a39c8d', [-0.9 + i * 0.82, 0.48, -0.35]).put(new THREE.CylinderGeometry(0.46, 0.46, 1.5, 3, 1), '#6a6e72', [-0.9 + i * 0.82, 0.98, -0.35], [HALF, 0.5, 0], [0.9, 1, 0.5]);
      k.glow(() => { for (let i = 0; i < 3; i++) k.box(0.5, 0.4, 0.03, '#e8c887', [-0.9 + i * 0.82, 0.34, 0.41]); });
      for (const x of [0.95, 1.25]) k.cyl(0.1, 1.7, '#9a5a44', [x, 0.9, -0.85], [0, 0, 0], 12, 0.075).cyl(0.08, 0.12, '#e6e1d6', [x, 1.55, -0.85], [0, 0, 0], 12);
      truck(k, -0.8, 0.9, '#c9c4b7');
      truck(k, 0.3, 1.05, OLIVE);
      k.mine(() => k.box(0.7, 0.14, 0.04, '#ffffff', [-0.08, 0.78, 0.42]));
      break;
    case 'drones':
      base(k, 2.6, 2.4, ASPHALT);
      k.put(new THREE.CylinderGeometry(0.62, 0.62, 1.5, 20, 1, false, 0, Math.PI), '#c4c8ca', [-0.5, 0.08, -0.3], [0, 0, 0], [1, 1, 1]);
      k.put(new THREE.CylinderGeometry(0.6, 0.6, 1.3, 20, 1, false, 0, Math.PI), '#aeb4b8', [0, 0.08, -0.5], [HALF, 0, HALF]);
      k.glow(() => k.box(0.02, 0.55, 0.8, '#bfe3f2', [0.66, 0.36, -0.5]));
      block(k, 0.6, 0.9, 0.7, [-0.9, 0.08, 0.6], '#b9bec2');
      for (const [x, z] of [[0.3, 0.7], [0.9, 0.7]] as const) k.cyl(0.24, 0.015, '#d9dcdd', [x, 0.1, z], [0, 0, 0], 20).cyl(0.2, 0.018, ASPHALT, [x, 0.1, z], [0, 0, 0], 20).box(0.2, 0.04, 0.2, DARK, [x, 0.16, z]);
      k.cyl(0.014, 0.9, STEEL, [-0.9, 1.45, 0.6], [0, 0, 0], 6);
      k.mine(() => k.box(0.62, 0.08, 0.72, '#ffffff', [-0.9, 0.98, 0.6]));
      break;
    case 'aeroporto':
      base(k, 3.6, 3, '#6f7a55');
      k.box(3.4, 0.02, 0.7, ASPHALT, [0, 0.1, 0.8]).box(0.4, 0.02, 1.2, ASPHALT, [0.9, 0.1, 0.1]);
      for (let i = 0; i < 9; i++) k.box(0.18, 0.005, 0.03, '#e8e6df', [-1.5 + i * 0.37, 0.113, 0.8]);
      for (const x of [-1.1, -0.25]) k.put(new THREE.CylinderGeometry(0.4, 0.4, 0.9, 18, 1, false, 0, Math.PI), '#9aa1a5', [x, 0.08, -0.75], [HALF, 0, HALF]);
      k.cyl(0.14, 0.9, WALL, [0.7, 0.53, -0.9], [0, 0, 0], 10).cyl(0.26, 0.06, WALL2, [0.7, 1.2, -0.9], [0, 0, 0], 12);
      k.glow(() => k.cyl(0.22, 0.2, GLASS, [0.7, 1.08, -0.9], [0, 0, 0], 12, 0.26).box(1.1, 0.26, 0.02, GLASS, [1.1, 0.26, -0.44]));
      k.box(1.2, 0.4, 0.5, WALL, [1.1, 0.28, -0.7]);
      for (const x of [-0.9, 0]) k.box(0.4, 0.06, 0.08, '#8f989f', [x, 0.16, 0.1]).box(0.1, 0.03, 0.42, '#8f989f', [x, 0.16, 0.1]).box(0.06, 0.14, 0.02, '#6f787f', [x - 0.18, 0.22, 0.1]);
      k.mine(() => k.box(1.22, 0.05, 0.52, '#ffffff', [1.1, 0.5, -0.7]));
      break;
    case 'hospital':
      base(k, 2.4, 2.2);
      block(k, 1, 1.5, 1.2, [-0.4, 0.08, -0.2], '#eeece6');
      block(k, 0.9, 0.7, 1, [0.6, 0.08, -0.1], '#eeece6');
      k.cyl(0.36, 0.02, '#4a4d50', [-0.4, 1.67, -0.2], [0, 0, 0], 20).box(0.3, 0.012, 0.07, '#ffffff', [-0.4, 1.685, -0.2]).box(0.07, 0.012, 0.3, '#ffffff', [-0.4, 1.685, -0.2]);
      k.glow(() => k.box(0.3, 0.08, 0.02, '#e0322f', [0.6, 0.6, 0.42]).box(0.08, 0.3, 0.02, '#e0322f', [0.6, 0.6, 0.42]));
      truck(k, 0.4, 0.85, '#f2f2f0');
      trees(k, [[-0.95, 0.8], [1, 0.85]]);
      k.mine(() => k.box(1.02, 0.07, 1.22, '#ffffff', [-0.4, 1.46, -0.2]));
      break;
    case 'torre':
      k.cyl(0.8, 0.14, CONCRETE, [0, 0.07, 0], [0, 0, 0], 8, 0.74);
      for (let i = 0; i < 8; i++) k.box(0.36, 0.2, 0.16, '#a5966f', [Math.cos(i * 0.785) * 0.62, 0.22, Math.sin(i * 0.785) * 0.62], [0, -i * 0.785 + HALF, 0]);
      k.cyl(0.22, 0.4, STEEL, [0, 0.34, 0], [0, 0, 0], 10).box(0.46, 0.34, 0.42, OLIVE, [0, 0.66, 0]);
      for (const z of [-0.1, 0.1]) k.cyl(0.035, 0.8, DARK, [0.55, 0.68, z], [0, 0, HALF], 8);
      k.mine(() => k.box(0.3, 0.02, 0.3, '#ffffff', [0, 0.84, 0]));
      break;
    case 'vigia':
      for (const x of [-0.3, 0.3]) for (const z of [-0.3, 0.3]) k.cyl(0.035, 1.5, '#6b5a43', [x, 0.75, z], [z * 0.2, 0, -x * 0.2], 6);
      for (const y of [0.45, 0.95]) k.box(0.62, 0.04, 0.04, '#6b5a43', [0, y, 0.3]).box(0.62, 0.04, 0.04, '#6b5a43', [0, y, -0.3]);
      k.box(0.9, 0.06, 0.9, '#7d6a50', [0, 1.5, 0]).wedge(1.05, 0.3, 1.05, 0.05, '#5a5140', [0, 2.15, 0]);
      for (const s of [-1, 1]) k.box(0.86, 0.22, 0.04, '#8a7a5c', [0, 1.65, 0.42 * s]).box(0.04, 0.22, 0.86, '#8a7a5c', [0.42 * s, 1.65, 0]);
      for (const x of [-0.4, 0.4]) for (const z of [-0.4, 0.4]) k.cyl(0.025, 0.5, '#6b5a43', [x, 1.78, z], [0, 0, 0], 5);
      mast(k, 0.5, 0.5, 1.4);
      break;
    case 'antiaerea':
      k.cyl(0.8, 0.12, CONCRETE, [0, 0.06, 0], [0, 0, 0], 16);
      k.cyl(0.3, 0.2, OLIVE, [0, 0.22, 0], [0, 0, 0], 12).box(0.4, 0.4, 0.4, OLIVE, [0, 0.5, 0]);
      for (const z of [-0.38, -0.2, 0.2, 0.38]) k.cyl(0.075, 0.95, '#d5d8d8', [0.1, 0.8, z], [0, 0, 0.85 - HALF], 12).put(new THREE.ConeGeometry(0.075, 0.16, 12), '#a93a2c', [0.52, 1.16, z], [0, 0, 0.85 - HALF]);
      k.mine(() => k.box(0.3, 0.02, 0.3, '#ffffff', [0, 0.71, 0]));
      break;
    case 'obuseiro':
      k.cyl(1.05, 0.14, '#8a8670', [0, 0.07, 0], [0, 0, 0], 20);
      for (let i = 0; i < 14; i++) if (i > 1 && i < 13) k.box(0.4, 0.24, 0.2, '#a5966f', [Math.cos(i * 0.449) * 0.95, 0.24, Math.sin(i * 0.449) * 0.95], [0, -i * 0.449 + HALF, 0]);
      k.box(0.9, 0.2, 0.4, OLIVE, [-0.25, 0.3, 0]).cyl(0.09, 1.5, '#4c5440', [0.5, 0.75, 0], [0, 0, HALF - 0.55], 12, 0.07).box(0.06, 0.5, 0.7, OLIVE, [0.1, 0.5, 0]);
      for (const z of [-0.36, 0.36]) k.cyl(0.22, 0.12, '#16181b', [-0.05, 0.3, z], [HALF, 0, 0], 14);
      for (let i = 0; i < 5; i++) k.cyl(0.04, 0.24, '#a8743a', [-0.7, 0.25, -0.3 + i * 0.13], [0, 0, 0], 8);
      k.mine(() => k.box(0.04, 0.2, 0.72, '#ffffff', [0.14, 0.66, 0]));
      break;
    case 'radar':
      base(k, 1.7, 1.7);
      k.box(0.9, 0.5, 0.8, WALL, [0, 0.33, 0]).box(0.96, 0.05, 0.86, ROOF, [0, 0.6, 0]);
      k.on('giro', [0, 1, 0], () => { k.cyl(0.06, 0.4, STEEL, [0, 0.8, 0], [0, 0, 0], 8).box(0.06, 0.5, 1.3, '#c7cccf', [0.05, 1.15, 0], [0, 0, -0.25]).box(0.04, 0.4, 1.1, STEEL, [-0.04, 1.12, 0], [0, 0, -0.25]); });
      fence(k, 1.6, 1.6);
      k.mine(() => k.box(0.92, 0.08, 0.82, '#ffffff', [0, 0.5, 0]));
      break;
    case 'gerador':
      base(k, 1.8, 1.8, '#77756e');
      for (let i = 0; i < 4; i++) k.box(0.7, 0.36, 0.14, CONCRETE, [Math.cos(i * HALF) * 0.75, 0.24, Math.sin(i * HALF) * 0.75], [0, -i * HALF + HALF, 0]);
      k.box(0.8, 0.5, 0.8, '#6f725f', [0, 0.33, 0]).wedge(0.9, 0.2, 0.9, 0.7, '#5a5d4d', [0, 0.68, 0]);
      k.glow(() => k.box(0.82, 0.06, 0.4, '#e7cf8f', [0, 0.42, 0]));
      k.mine(() => k.box(0.4, 0.03, 0.4, '#ffffff', [0, 0.79, 0]));
      break;
    case 'domo':
      base(k, 1.8, 1.8, '#77756e');
      k.box(0.7, 0.16, 0.9, OLIVE, [0, 0.2, 0]);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 4; j++) k.box(0.7, 0.16, 0.16, '#c9ccc4', [0.02, 0.62 + i * 0.18, -0.3 + j * 0.2], [0, 0, 0.9]);
      k.box(0.3, 0.3, 0.3, WALL2, [-0.6, 0.23, 0.5]);
      k.on('giro', [-0.6, 0.6, 0.5], () => { k.box(0.04, 0.2, 0.4, '#d5d9db', [-0.6, 0.55, 0.5], [0, 0, -0.3]); });
      k.mine(() => k.box(0.72, 0.03, 0.92, '#ffffff', [0, 0.29, 0]));
      break;
    case 'silo':
      base(k, 2.6, 2.4, '#8a8670');
      for (const [x, z] of [[-0.55, -0.3], [0.45, -0.3], [-0.05, 0.6]] as const) {
        k.cyl(0.36, 0.1, CONCRETE, [x, 0.13, z], [0, 0, 0], 20).cyl(0.27, 0.12, DARK, [x, 0.13, z], [0, 0, 0], 20).cyl(0.13, 0.5, '#e8e9e6', [x, 0.36, z], [0, 0, 0], 14).put(new THREE.ConeGeometry(0.13, 0.26, 14), '#a93a2c', [x, 0.74, z]);
        for (let i = 0; i < 8; i++) k.box(0.1, 0.02, 0.05, i % 2 ? '#d8b23c' : DARK, [x + Math.cos(i * 0.785) * 0.32, 0.19, z + Math.sin(i * 0.785) * 0.32], [0, -i * 0.785, 0]);
      }
      fence(k, 2.55, 2.35);
      k.box(0.5, 0.36, 0.5, WALL2, [0.95, 0.26, 0.8]);
      k.mine(() => k.box(0.52, 0.05, 0.52, '#ffffff', [0.95, 0.46, 0.8]));
      break;
  }
  return k.build();
}
export function worksGeometry(b: WorksId): THREE.BufferGeometry {
  let g = cache.get(b);
  if (!g) cache.set(b, (g = model(b)));
  return g;
}
