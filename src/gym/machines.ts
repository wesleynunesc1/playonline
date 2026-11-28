import * as THREE from 'three';
import { Ctx, GEO, mat, part, tex, texMat, tube } from './kit';

/**
 * Aparelhos de verdade, peça por peça, e o lugar onde o aluno fica em cada um.
 * Coordenadas do salão: x de -5 a 5, z de -4 (fundo) a 4 (frente). O aluno olha para +z, salvo indicação.
 */
export type Act = 'stand' | 'sit' | 'bath' | 'run' | 'ellip' | 'bike' | 'row' | 'extend' | 'push' | 'pull' | 'press' | 'squat' | 'curl' | 'fly' | 'flysit' | 'calf' | 'punch' | 'dance' | 'yoga' | 'lie' | 'swim' | 'rope' | 'hop' | 'swing';
/** h = altura do assento (ou da esteira, da maca, da água) onde o aluno se apoia */
export interface Seat { p: THREE.Vector3; rot: number; act: Act; h: number }

const FRAME = () => mat('#2b2f36', { m: 0.6, r: 0.35 });
const ACCENT = () => mat('#facc15', { r: 0.45, m: 0.2 });
const PAD = () => mat('#141414', { r: 0.85 });
const CHROME = () => mat('#c7cdd6', { m: 0.95, r: 0.2 });
const IRON = () => mat('#18181b', { r: 0.6, m: 0.3 });
const seat = (c: Ctx, x: number, z: number, act: Act, h = 0, rot = 0) => c.seats.push({ p: new THREE.Vector3(x, 0, z), rot, act, h });

// ===== Telas e água animadas =====
const tvC = Object.assign(document.createElement('canvas'), { width: 256, height: 144 });
const tvT = tex(tvC);
const tvM = texMat(tvT, 1.1, 0.4);
const waterC = Object.assign(document.createElement('canvas'), { width: 128, height: 128 });
{
  const g = waterC.getContext('2d')!;
  g.fillStyle = '#1aa7d6';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(220,250,255,.55)';
  g.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    g.ellipse((i * 47) % 128, (i * 23) % 128, 18, 6, (i % 3) * 0.6, 0, 5);
    g.stroke();
  }
}
const waterT = tex(waterC, 3, 2);
const waterM = texMat(waterT, 0.35, 0.05);
export const MACHINES = {
  screens(t: number) {
    waterT.offset.set((t * 0.03) % 1, (t * 0.02) % 1);
    const g = tvC.getContext('2d')!;
    g.fillStyle = '#04121a';
    g.fillRect(0, 0, 256, 144);
    g.strokeStyle = '#22d3ee';
    g.lineWidth = 3;
    g.beginPath();
    for (let x = 0; x <= 256; x += 4) {
      const k = (t * 1.6 + x / 60) % 1;
      const y = 90 - (k > 0.45 && k < 0.5 ? 55 : k > 0.5 && k < 0.55 ? -25 : Math.sin(t * 6 + x) * 2);
      if (x) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
    g.fillStyle = '#facc15';
    g.font = 'bold 26px sans-serif';
    g.fillText(`${118 + Math.round(Math.sin(t) * 12)} BPM`, 12, 32);
    tvT.needsUpdate = true;
  },
};

/** Posições em grade dentro do salão, deixando corredor na frente e nas laterais */
function slots(n: number, max: number, cols: number, z0 = -3.7, z1 = 3.1) {
  const rows = Math.ceil(max / cols);
  return Array.from({ length: n }, (_, i): [number, number] => [-4.4 + ((i % cols) + 0.5) * (8.8 / cols), z0 + (Math.floor(i / cols) + 0.5) * ((z1 - z0) / rows)]);
}
/** Torre de pesos: trilhos, placas, polia e a carenagem amarela */
function stack(c: Ctx, x: number, z: number, h = 2) {
  for (const s of [-0.13, 0.13]) tube(c, CHROME(), [x + s, 0.05, z], [x + s, h, z], 0.035);
  part(c, GEO.box, IRON(), x, 0.42, z, 0.36, 0.7, 0.2);
  part(c, GEO.box, ACCENT(), x, h * 0.55, z - 0.14, 0.5, h * 0.85, 0.05);
  part(c, GEO.box, FRAME(), x, h + 0.05, z, 0.5, 0.1, 0.25);
  part(c, GEO.cyl, CHROME(), x, h - 0.05, z + 0.12, 0.14, 0.05, 0.14).rotation.x = Math.PI / 2;
}
const pad = (c: Ctx, x: number, y: number, z: number, w: number, d: number, tilt = 0) => {
  const o = part(c, GEO.box, PAD(), x, y, z, w, 0.12, d);
  o.rotation.x = tilt;
  return o;
};
const plate = (c: Ctx, x: number, y: number, z: number, r = 0.45) => (part(c, GEO.cyl, IRON(), x, y, z, r, 0.06, r).rotation.z = Math.PI / 2);
const barbell = (c: Ctx, x: number, y: number, z: number, len = 1.8) => {
  part(c, GEO.cyl, CHROME(), x, y, z, 0.05, len, 0.05).rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) {
    plate(c, x + s * (len / 2 - 0.25), y, z);
    plate(c, x + s * (len / 2 - 0.33), y, z, 0.36);
  }
};
const mirror = (c: Ctx, w = 9.2) => {
  part(c, GEO.box, mat('#a9d6ec', { m: 0.3, r: 0.08, glow: 0.3 }), 0, 1.4, -3.88, w, 2.2, 0.05);
  part(c, GEO.box, CHROME(), 0, 2.53, -3.88, w + 0.1, 0.05, 0.08);
};
const tv = (c: Ctx, x: number, y: number, z: number, w = 2.4) => {
  part(c, GEO.box, mat('#0b0b0f', { r: 0.3 }), x, y, z, w + 0.15, w * 0.6, 0.1);
  part(c, GEO.plane, tvM, x, y, z + 0.06, w, w * 0.56, 1);
};
/** Pessoa da equipe, parada no posto */
function staff(c: Ctx, x: number, z: number, rot: number, shirt: string, y = 0) {
  const s = Math.sin(rot), co = Math.cos(rot);
  for (const side of [-1, 1]) part(c, GEO.box, mat('#1f2937'), x + side * 0.1 * co, y + 0.42, z - side * 0.1 * s, 0.14, 0.84, 0.16, rot);
  part(c, GEO.box, mat(shirt), x, y + 1.12, z, 0.44, 0.56, 0.26, rot);
  for (const side of [-1, 1]) part(c, GEO.box, mat('#e0ac69'), x + side * 0.28 * co, y + 1.05, z - side * 0.28 * s, 0.1, 0.52, 0.1, rot);
  part(c, GEO.sph, mat('#e0ac69', { r: 0.8 }), x, y + 1.62, z, 0.3, 0.32, 0.3);
  part(c, GEO.sph, mat('#2b1b12'), x, y + 1.7, z, 0.32, 0.18, 0.32);
}
const plant = (c: Ctx, x: number, z: number) => {
  part(c, GEO.cyl, mat('#3f3f46', { r: 0.5 }), x, 0.3, z, 0.5, 0.6, 0.5);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    part(c, GEO.sph, mat(i % 2 ? '#2d6a4f' : '#40916c'), x + Math.cos(a) * 0.25, 1, z + Math.sin(a) * 0.25, 0.3, 0.7, 0.3, -a).rotation.z = 0.25;
  }
};

// ===== Máquinas de musculação (cada uma com o seu movimento) =====
const STATION: ((c: Ctx, x: number, z: number) => void)[] = [
  // Leg press 45°: trilhos subindo para a frente, plataforma e anilhas
  (c, x, z) => {
    part(c, GEO.box, FRAME(), x, 0.1, z + 0.2, 0.9, 0.2, 2.1);
    for (const s of [-0.38, 0.38]) tube(c, CHROME(), [x + s, 0.25, z], [x + s, 1.45, z + 1.15], 0.07);
    const foot = part(c, GEO.box, ACCENT(), x, 1.05, z + 0.85, 0.75, 0.65, 0.08);
    foot.rotation.x = -0.75;
    for (const s of [-1, 1]) plate(c, x + s * 0.55, 1.05, z + 0.85);
    pad(c, x, 0.42, z - 0.2, 0.55, 0.5);
    pad(c, x, 0.78, z - 0.62, 0.55, 0.8, 1);
    seat(c, x, z - 0.2, 'push', 0.45);
  },
  // Cadeira extensora: banco, encosto, rolo na canela e torre de pesos ao lado
  (c, x, z) => {
    part(c, GEO.box, FRAME(), x, 0.22, z, 0.5, 0.44, 0.6);
    pad(c, x, 0.5, z, 0.55, 0.5);
    pad(c, x, 0.92, z - 0.3, 0.55, 0.7, Math.PI / 2 - 0.15);
    part(c, GEO.cyl, PAD(), x, 0.32, z + 0.42, 0.13, 0.5, 0.13).rotation.z = Math.PI / 2;
    tube(c, FRAME(), [x + 0.33, 0.55, z + 0.05], [x + 0.33, 0.3, z + 0.42], 0.06);
    stack(c, x + 0.7, z - 0.2, 1.7);
    seat(c, x, z - 0.02, 'extend', 0.52);
  },
  // Puxador frente: torre alta, barra larga lá em cima, banco e apoio de joelho
  (c, x, z) => {
    stack(c, x, z - 0.55, 2.3);
    tube(c, FRAME(), [x, 2.3, z - 0.55], [x, 2.3, z + 0.1], 0.1);
    tube(c, mat('#111'), [x, 2.25, z + 0.1], [x, 2.05, z + 0.1], 0.02);
    part(c, GEO.cyl, CHROME(), x, 2.03, z + 0.1, 0.05, 1.2, 0.05).rotation.z = Math.PI / 2;
    pad(c, x, 0.5, z + 0.05, 0.5, 0.45);
    part(c, GEO.cyl, PAD(), x, 0.78, z + 0.32, 0.13, 0.5, 0.13).rotation.z = Math.PI / 2;
    tube(c, FRAME(), [x, 0.05, z - 0.4], [x, 0.45, z + 0.05], 0.08);
    seat(c, x, z + 0.02, 'pull', 0.52);
  },
  // Crossover: duas torres, travessa e o aluno no meio
  (c, x, z) => {
    for (const s of [-0.85, 0.85]) stack(c, x + s, z - 0.3, 2.3);
    tube(c, FRAME(), [x - 0.85, 2.35, z - 0.3], [x + 0.85, 2.35, z - 0.3], 0.1);
    for (const s of [-0.75, 0.75]) part(c, GEO.box, mat('#111'), x + s, 1.4, z - 0.15, 0.04, 0.04, 0.04);
    seat(c, x, z + 0.2, 'fly', 0);
  },
  // Peck deck: banco alto, encosto e braços acolchoados
  (c, x, z) => {
    stack(c, x, z - 0.55, 2);
    pad(c, x, 0.5, z, 0.5, 0.45);
    pad(c, x, 1.05, z - 0.28, 0.5, 0.75, Math.PI / 2);
    for (const s of [-1, 1]) part(c, GEO.box, PAD(), x + s * 0.42, 1.1, z + 0.05, 0.1, 0.5, 0.12);
    tube(c, FRAME(), [x, 0.05, z - 0.3], [x, 0.45, z], 0.08);
    seat(c, x, z, 'flysit', 0.52);
  },
  // Remada baixa: trilho no chão, apoio para os pés e torre na frente
  (c, x, z) => {
    part(c, GEO.box, FRAME(), x, 0.15, z, 0.35, 0.3, 1.9);
    pad(c, x, 0.36, z - 0.35, 0.45, 0.5);
    part(c, GEO.box, ACCENT(), x, 0.35, z + 0.6, 0.6, 0.35, 0.08).rotation.x = -0.4;
    stack(c, x, z + 1, 1.2);
    seat(c, x, z - 0.35, 'row', 0.38);
  },
  // Panturrilha em pé: ombreiras, degrau e torre
  (c, x, z) => {
    stack(c, x, z - 0.55, 2.2);
    part(c, GEO.box, FRAME(), x, 0.08, z, 0.7, 0.16, 0.5);
    for (const s of [-0.18, 0.18]) part(c, GEO.box, PAD(), x + s, 1.62, z - 0.05, 0.2, 0.12, 0.3);
    tube(c, FRAME(), [x, 1.6, z - 0.55], [x, 1.6, z - 0.1], 0.08);
    seat(c, x, z, 'calf', 0.16);
  },
  // Hack (agachamento guiado): trilhos inclinados e encosto
  (c, x, z) => {
    for (const s of [-0.35, 0.35]) tube(c, CHROME(), [x + s, 0.1, z - 0.2], [x + s, 2, z - 0.75], 0.07);
    part(c, GEO.box, FRAME(), x, 0.08, z, 0.9, 0.16, 1.2);
    pad(c, x, 1.2, z - 0.48, 0.5, 0.8, Math.PI / 2 - 0.3);
    for (const s of [-1, 1]) plate(c, x + s * 0.55, 1.3, z - 0.55);
    seat(c, x, z, 'squat', 0.12);
  },
];

// ===== Peso livre =====
const FREE: ((c: Ctx, x: number, z: number) => void)[] = [
  // Gaiola (power rack) com barra e plataforma de madeira
  (c, x, z) => {
    part(c, GEO.box, mat('#7c5a3a', { r: 0.7 }), x, 0.03, z, 1.8, 0.06, 1.6);
    for (const sx of [-0.6, 0.6]) for (const sz of [-0.5, 0.5]) tube(c, FRAME(), [x + sx, 0, z + sz], [x + sx, 2.3, z + sz], 0.09);
    for (const sz of [-0.5, 0.5]) tube(c, FRAME(), [x - 0.6, 2.3, z + sz], [x + 0.6, 2.3, z + sz], 0.09);
    barbell(c, x, 1.45, z - 0.35, 2.1);
    seat(c, x, z + 0.05, 'squat', 0.06);
  },
  // Supino reto: banco, suportes e barra
  (c, x, z) => {
    pad(c, x, 0.45, z, 0.32, 1.25);
    part(c, GEO.box, FRAME(), x, 0.2, z, 0.16, 0.4, 1);
    for (const s of [-0.48, 0.48]) tube(c, FRAME(), [x + s, 0, z - 0.6], [x + s, 1.15, z - 0.6], 0.07);
    barbell(c, x, 1.12, z - 0.6);
    seat(c, x, z + 0.1, 'press', 0.45);
  },
  // Smith: barra guiada em dois trilhos
  (c, x, z) => {
    for (const s of [-0.7, 0.7]) {
      tube(c, FRAME(), [x + s, 0, z - 0.35], [x + s, 2.3, z - 0.35], 0.1);
      tube(c, CHROME(), [x + s * 0.85, 0, z - 0.25], [x + s * 0.85, 2.2, z - 0.25], 0.04);
    }
    tube(c, FRAME(), [x - 0.7, 2.3, z - 0.35], [x + 0.7, 2.3, z - 0.35], 0.1);
    barbell(c, x, 1.4, z - 0.25, 1.9);
    seat(c, x, z, 'squat', 0);
  },
  // Rack de halteres de dois andares
  (c, x, z) => {
    for (const y of [0.45, 0.85]) {
      part(c, GEO.box, FRAME(), x, y, z - 0.3 + (y > 0.5 ? -0.12 : 0.12), 1.8, 0.05, 0.25);
      for (let k = 0; k < 6; k++) for (const s of [-0.06, 0.06]) part(c, GEO.cyl, IRON(), x - 0.75 + k * 0.3, y + 0.09, z - 0.3 + (y > 0.5 ? -0.12 : 0.12) + s, 0.13 + k * 0.012, 0.2, 0.13 + k * 0.012).rotation.z = Math.PI / 2;
    }
    for (const s of [-0.85, 0.85]) tube(c, FRAME(), [x + s, 0, z - 0.3], [x + s, 0.9, z - 0.3], 0.06);
    seat(c, x, z + 0.55, 'curl', 0);
  },
  // Banco inclinado com halteres no chão
  (c, x, z) => {
    pad(c, x, 0.45, z + 0.1, 0.35, 0.45);
    pad(c, x, 0.8, z - 0.3, 0.35, 0.8, Math.PI / 2 - 0.5);
    part(c, GEO.box, FRAME(), x, 0.22, z, 0.2, 0.44, 0.8);
    for (const s of [-0.4, 0.4]) part(c, GEO.cyl, IRON(), x + s, 0.1, z + 0.4, 0.14, 0.25, 0.14).rotation.z = Math.PI / 2;
    seat(c, x, z + 0.15, 'sit', 0.47);
  },
];

// ===== Cardio =====
/** Bicicleta: s = 1 olha para a frente, s = -1 olha para o fundo (aula de spinning) */
const bike = (c: Ctx, x: number, z: number, s: number) => {
  part(c, GEO.box, FRAME(), x, 0.05, z, 0.55, 0.1, 1.1);
  part(c, GEO.cyl, ACCENT(), x, 0.42, z + s * 0.35, 0.5, 0.12, 0.5).rotation.z = Math.PI / 2;
  tube(c, FRAME(), [x, 0.1, z - s * 0.25], [x, 0.9, z - s * 0.35], 0.08);
  pad(c, x, 0.95, z - s * 0.35, 0.26, 0.3);
  tube(c, FRAME(), [x, 0.4, z + s * 0.35], [x, 1.15, z + s * 0.4], 0.07);
  part(c, GEO.box, mat('#111'), x, 1.18, z + s * 0.42, 0.5, 0.05, 0.08);
  seat(c, x, z - s * 0.35, 'bike', 0.95, s > 0 ? 0 : Math.PI);
};
const treadmill = (c: Ctx, x: number, z: number) => {
  part(c, GEO.box, FRAME(), x, 0.12, z, 0.85, 0.22, 1.9);
  part(c, GEO.box, mat('#0a0a0a', { r: 0.95 }), x, 0.24, z - 0.05, 0.62, 0.03, 1.6);
  for (const s of [-0.4, 0.4]) tube(c, CHROME(), [x + s, 0.2, z + 0.75], [x + s, 1.3, z + 0.88], 0.06);
  part(c, GEO.box, FRAME(), x, 1.35, z + 0.9, 0.85, 0.32, 0.14).rotation.x = -0.5;
  part(c, GEO.plane, tvM, x, 1.4, z + 0.84, 0.42, 0.22, 1).rotation.x = Math.PI - 0.5;
  seat(c, x, z - 0.15, 'run', 0.26);
};
const CARDIO: ((c: Ctx, x: number, z: number) => void)[] = [
  treadmill,
  treadmill,
  // Elíptico
  (c, x, z) => {
    part(c, GEO.box, FRAME(), x, 0.1, z, 0.5, 0.2, 1.8);
    part(c, GEO.cyl, ACCENT(), x, 0.45, z + 0.75, 0.6, 0.25, 0.6).rotation.z = Math.PI / 2;
    for (const s of [-0.2, 0.2]) part(c, GEO.box, PAD(), x + s, 0.3, z - 0.15, 0.16, 0.05, 0.42);
    for (const s of [-0.3, 0.3]) tube(c, CHROME(), [x + s, 0.3, z + 0.3], [x + s, 1.55, z + 0.1], 0.05);
    part(c, GEO.box, FRAME(), x, 1.3, z + 0.75, 0.45, 0.3, 0.12).rotation.x = -0.4;
    seat(c, x, z - 0.15, 'ellip', 0.3);
  },
  (c, x, z) => bike(c, x, z, 1),
  // Remo
  (c, x, z) => {
    part(c, GEO.box, CHROME(), x, 0.2, z - 0.2, 0.12, 0.08, 2);
    part(c, GEO.cyl, IRON(), x, 0.35, z + 0.85, 0.6, 0.22, 0.6).rotation.z = Math.PI / 2;
    pad(c, x, 0.3, z - 0.35, 0.34, 0.34);
    for (const s of [-0.15, 0.15]) part(c, GEO.box, PAD(), x + s, 0.32, z + 0.4, 0.14, 0.05, 0.3).rotation.x = -0.6;
    seat(c, x, z - 0.35, 'row', 0.32);
  },
];

/** Monta os aparelhos de um salão. n = quantos foram comprados */
export function furnish(c: Ctx, zone: string, n: number, deco: number) {
  if (deco > 4 && zone !== 'natacao') {
    plant(c, -4.6, -3.6);
    plant(c, 4.6, -3.6);
  }
  switch (zone) {
    case 'recepcao': {
      part(c, GEO.box, mat('#18181b', { r: 0.4 }), -1.5, 0.55, -1.2, 4, 1.1, 0.8);
      part(c, GEO.box, ACCENT(), -1.5, 0.6, -0.79, 4, 0.9, 0.02);
      part(c, GEO.box, mat('#e7e5e4', { r: 0.3 }), -1.5, 1.12, -1.2, 4.1, 0.05, 0.9);
      staff(c, -2.5, -1.9, 0, '#facc15');
      staff(c, -0.6, -1.9, 0, '#facc15');
      part(c, GEO.box, mat('#27272a'), 0, 1.8, -3.85, 6, 2.6, 0.1);
      tv(c, 0, 2, -3.78, 3);
      // Catracas na passagem para dentro
      for (let k = 0; k < Math.min(4, 1 + Math.floor(n / 3)); k++) {
        const x = 1.6 + k * 0.9;
        part(c, GEO.box, CHROME(), x, 0.5, 0.8, 0.22, 1, 0.8);
        part(c, GEO.box, mat(k % 2 ? '#22c55e' : '#facc15', { glow: 1.5 }), x, 1.02, 0.8, 0.23, 0.04, 0.3);
      }
      part(c, GEO.box, mat('#3f3f46', { r: 0.9 }), -3, 0.3, 2.2, 2.2, 0.6, 0.8);
      part(c, GEO.box, mat('#3f3f46', { r: 0.9 }), -3, 0.65, 2.55, 2.2, 0.5, 0.15);
      for (let k = 0; k < Math.min(4, n); k++) plant(c, 4.4, -3.2 + k * 1.6);
      break;
    }
    case 'musculacao':
      slots(n, 12, 4).forEach(([x, z], i) => STATION[i % STATION.length](c, x, z));
      break;
    case 'pesolivre':
      mirror(c);
      slots(n, 10, 5, -3.5).forEach(([x, z], i) => FREE[i % FREE.length](c, x, z));
      break;
    case 'cardio':
      tv(c, -2.4, 2.2, -3.85, 3);
      tv(c, 2.4, 2.2, -3.85, 3);
      slots(n, 12, 6, -3.5).forEach(([x, z], i) => CARDIO[i % 6 === 5 ? 4 : i % 4](c, x, z));
      break;
    case 'spinning': {
      part(c, GEO.box, mat('#27272a', { r: 0.5 }), 0, 0.15, -3.3, 3, 0.3, 1.2);
      bike(c, 0, -3.3, 1);
      c.seats.pop();
      staff(c, 0, -3.65, 0, '#fb923c', 0.3);
      for (let k = 0; k < 6; k++) part(c, GEO.box, mat(['#fb923c', '#e879f9', '#22d3ee'][k % 3], { glow: 2.4 }), -4.4 + k * 1.76, 0.03, -2.4, 1.2, 0.04, 0.1);
      // As bikes da turma olham para a professora, no fundo
      slots(n, 16, 4, -2.2, 3.3).forEach(([x, z]) => bike(c, x, z, -1));
      break;
    }
    case 'funcional': {
      part(c, GEO.box, mat('#166534', { r: 0.95 }), 0, 0.015, 2.8, 8.8, 0.02, 1);
      for (const s of [-4.2, 4.2]) tube(c, FRAME(), [s, 0, -3.7], [s, 2.6, -3.7], 0.12);
      tube(c, FRAME(), [-4.2, 2.6, -3.7], [4.2, 2.6, -3.7], 0.12);
      slots(n, 8, 4, -3.2, 2.2).forEach(([x, z], i) => {
        const k = i % 3;
        if (k === 0) {
          for (let j = 0; j < 3; j++) part(c, GEO.box, mat('#a16207', { r: 0.7 }), x - 0.5 + j * 0.5, 0.25 + j * 0.12, z - 0.4, 0.45, 0.5 + j * 0.24, 0.45);
          seat(c, x, z + 0.4, 'hop');
        } else if (k === 1) {
          tube(c, FRAME(), [x, 0, z - 0.9], [x, 0.4, z - 0.9], 0.15);
          for (const s of [-0.15, 0.15]) part(c, GEO.box, mat('#0a0a0a', { r: 0.9 }), x + s, 0.04, z - 0.2, 0.06, 0.06, 1.4);
          seat(c, x, z + 0.55, 'rope');
        } else {
          for (let j = 0; j < 3; j++) part(c, GEO.sph, mat(['#ef4444', '#3b82f6', '#22c55e'][j], { r: 0.4 }), x - 0.4 + j * 0.4, 0.16, z - 0.5, 0.28, 0.32, 0.28);
          seat(c, x, z + 0.3, 'swing');
        }
      });
      break;
    }
    case 'ringue': {
      const rx = -2, rz = -1.4;
      part(c, GEO.box, mat('#1e40af', { r: 0.85 }), rx, 0.35, rz, 4.2, 0.7, 4.2);
      for (const [sx, sz, col] of [[-1, -1, '#ef4444'], [1, 1, '#3b82f6'], [1, -1, '#f8fafc'], [-1, 1, '#f8fafc']] as const) part(c, GEO.cyl, mat(col, { r: 0.4 }), rx + sx * 1.95, 1.2, rz + sz * 1.95, 0.16, 1.1, 0.16);
      for (let k = 0; k < 3; k++) {
        const rope = mat(k === 1 ? '#f8fafc' : '#ef4444', { r: 0.5 });
        for (const s of [-1, 1]) {
          part(c, GEO.box, rope, rx, 1 + k * 0.28, rz + s * 1.95, 3.9, 0.04, 0.04);
          part(c, GEO.box, rope, rx + s * 1.95, 1 + k * 0.28, rz, 0.04, 0.04, 3.9);
        }
      }
      staff(c, rx - 0.5, rz, Math.PI / 2, '#ef4444', 0.7);
      staff(c, rx + 0.5, rz, -Math.PI / 2, '#3b82f6', 0.7);
      for (let k = 0; k < n; k++) {
        const x = 1.6 + (k % 2) * 2, z = -3.2 + Math.floor(k / 2) * 1.7;
        tube(c, IRON(), [x, 2.6, z], [x, 2.05, z], 0.03);
        part(c, GEO.cyl, mat(k % 2 ? '#7f1d1d' : '#111827', { r: 0.6 }), x, 1.35, z, 0.46, 1.3, 0.46);
        seat(c, x - 0.6, z, 'punch', 0, Math.PI / 2);
      }
      break;
    }
    case 'danca': case 'yoga': case 'pilates': {
      mirror(c);
      part(c, GEO.box, mat(zone === 'danca' ? '#a16207' : '#d6b370', { r: 0.6 }), 0, 0.012, 0, 9.6, 0.02, 7.6);
      staff(c, 0, -3.3, 0, zone === 'danca' ? '#e879f9' : zone === 'yoga' ? '#fcd34d' : '#22d3ee');
      if (zone === 'danca') {
        const ball = new THREE.Mesh(GEO.sph, mat('#e9d5ff', { m: 1, r: 0.1, glow: 0.5 }));
        ball.position.set(0, 3.6, 0);
        ball.scale.setScalar(0.5);
        ball.userData.keep = 1;
        c.g.add(ball);
        c.spin.push({ m: ball, s: 2 });
        for (const s of [-4.3, 4.3]) part(c, GEO.box, mat('#111', { r: 0.4 }), s, 0.7, -3.4, 0.6, 1.4, 0.5);
        slots(n * 2, 16, 4, -2.4, 3.2).forEach(([x, z]) => seat(c, x, z, 'dance', 0, Math.PI));
      } else if (zone === 'yoga') {
        slots(n, 12, 4, -2.4, 3.2).forEach(([x, z], i) => {
          part(c, GEO.box, mat(['#a78bfa', '#f472b6', '#34d399', '#fbbf24'][i % 4], { r: 0.9 }), x, 0.03, z, 0.7, 0.03, 1.7);
          seat(c, x, z, 'yoga', 0, Math.PI);
        });
      } else {
        slots(n, 6, 3, -2.4, 3.2).forEach(([x, z]) => {
          part(c, GEO.box, mat('#e2e8f0', { m: 0.6, r: 0.3 }), x, 0.25, z, 0.75, 0.12, 2.2);
          for (const s of [-1, 1]) tube(c, CHROME(), [x - 0.35, 0.15, z + s], [x + 0.35, 0.15, z + s], 0.06);
          part(c, GEO.box, mat('#0f172a', { r: 0.7 }), x, 0.38, z + 0.2, 0.65, 0.1, 0.9);
          tube(c, CHROME(), [x, 0.3, z + 1.05], [x, 0.9, z + 1.1], 0.05);
          seat(c, x, z + 0.25, 'lie', 0.42);
        });
      }
      break;
    }
    case 'natacao': {
      part(c, GEO.box, mat('#f1f5f9', { r: 0.4 }), 0, 0.12, -0.3, 9.2, 0.24, 6.6);
      part(c, GEO.plane, waterM, 0, 0.25, -0.3, 8.6, 6, 1).rotation.x = -Math.PI / 2;
      for (let k = 1; k < 4; k++) part(c, GEO.cyl, mat(k % 2 ? '#ef4444' : '#2563eb', { r: 0.5 }), -4.3 + k * 2.15, 0.27, -0.3, 0.06, 6, 0.06).rotation.x = Math.PI / 2;
      for (let k = 0; k < 4; k++) part(c, GEO.box, mat('#e2e8f0'), -3.2 + k * 2.15, 0.45, 2.75, 0.5, 0.25, 0.5);
      tube(c, FRAME(), [4.6, 0, 3.3], [4.6, 1.6, 3.3], 0.08);
      part(c, GEO.box, mat('#ef4444'), 4.6, 1.7, 3.3, 0.5, 0.1, 0.5);
      for (let k = 0; k < n; k++) seat(c, -3.2 + k * 2.15, -0.3, 'swim', 0.12);
      break;
    }
    case 'vestiario': {
      for (let k = 0; k < 11; k++) {
        const x = -4.4 + k * 0.8;
        part(c, GEO.box, mat(k % 2 ? '#3f3f46' : '#52525b', { r: 0.4, m: 0.3 }), x, 1.1, -3.55, 0.74, 2.2, 0.6);
        part(c, GEO.box, ACCENT(), x + 0.25, 1.1, -3.24, 0.04, 0.2, 0.04);
      }
      for (let k = 0; k < n; k++) {
        const z = -2.4 + k * 0.75;
        part(c, GEO.box, mat('#bae6fd', { op: 0.3, r: 0.05 }), 3.4, 1.1, z + 0.36, 2, 2.2, 0.04);
        part(c, GEO.cyl, CHROME(), 4.2, 2.1, z, 0.2, 0.05, 0.2);
      }
      for (const z of [-1.6, 0.6]) {
        part(c, GEO.box, mat('#a16207', { r: 0.6 }), -1.5, 0.45, z, 4, 0.08, 0.4);
        part(c, GEO.box, FRAME(), -1.5, 0.22, z, 3.8, 0.44, 0.1);
        for (let k = 0; k < 2; k++) seat(c, -2.8 + k * 2.4, z, 'sit', 0.48, k ? Math.PI : 0);
      }
      break;
    }
    case 'lanchonete': {
      part(c, GEO.box, mat('#14532d', { r: 0.4 }), 0, 0.55, -2.4, 7, 1.1, 0.8);
      part(c, GEO.box, mat('#e7e5e4', { r: 0.3 }), 0, 1.12, -2.4, 7.1, 0.05, 0.9);
      part(c, GEO.box, mat('#1c1917'), 0, 1.7, -3.85, 8, 2, 0.15);
      for (let k = 0; k < 14; k++) part(c, GEO.sph, mat(['#f97316', '#a3e635', '#facc15', '#7c3aed', '#ef4444'][k % 5], { r: 0.5 }), -3.2 + k * 0.5, 1.25, -2.5, 0.2, 0.2, 0.2);
      staff(c, -1.5, -3.2, 0, '#86efac');
      for (let k = 0; k < n; k++) {
        const x = -3.2 + k * 0.92;
        part(c, GEO.cyl, CHROME(), x, 0.32, -1.6, 0.07, 0.64, 0.07);
        part(c, GEO.cyl, mat('#86efac', { r: 0.5 }), x, 0.66, -1.6, 0.4, 0.08, 0.4);
        seat(c, x, -1.55, 'sit', 0.7, Math.PI);
      }
      for (let k = 0; k < 3; k++) {
        part(c, GEO.cyl, mat('#e7e5e4'), -2.5 + k * 2.5, 0.72, 1.6, 0.9, 0.05, 0.9);
        part(c, GEO.cyl, FRAME(), -2.5 + k * 2.5, 0.36, 1.6, 0.08, 0.72, 0.08);
      }
      break;
    }
    case 'suplementos': {
      part(c, GEO.box, mat('#1e3a8a', { r: 0.4 }), 3.2, 0.55, 2.2, 2, 1.1, 0.8);
      staff(c, 3.2, 1.6, Math.PI, '#93c5fd');
      slots(n, 6, 3, -3.6, 1.4).forEach(([x, z]) => {
        part(c, GEO.box, mat('#f4f4f5', { r: 0.5 }), x, 0.9, z - 0.3, 2.2, 1.8, 0.45);
        for (let k = 0; k < 12; k++) part(c, GEO.cyl, mat(['#111', '#e11d48', '#2563eb', '#facc15'][k % 4], { r: 0.4 }), x - 0.85 + (k % 4) * 0.56, 0.45 + Math.floor(k / 4) * 0.5, z - 0.1, 0.22, 0.32, 0.22);
        seat(c, x, z + 0.55, 'stand', 0, Math.PI);
      });
      break;
    }
    case 'fisio': case 'crio': {
      staff(c, -4.2, -3.4, Math.PI / 4, '#f8fafc');
      slots(n, zone === 'crio' ? 6 : 8, zone === 'crio' ? 3 : 4, -3.4, 3).forEach(([x, z]) => {
        if (zone === 'crio') {
          part(c, GEO.cyl, mat('#e0f2fe', { r: 0.2, m: 0.3 }), x, 0.4, z, 1.2, 0.8, 1.2);
          part(c, GEO.cyl, mat('#7dd3fc', { glow: 0.5, op: 0.85 }), x, 0.72, z, 1.05, 0.04, 1.05);
          seat(c, x, z, 'bath', 0.3);
        } else {
          part(c, GEO.box, mat('#38bdf8', { r: 0.6 }), x, 0.72, z, 0.7, 0.12, 1.9);
          for (const s of [-1, 1]) part(c, GEO.box, CHROME(), x, 0.33, z + s * 0.75, 0.6, 0.66, 0.06);
          seat(c, x, z + 0.2, 'lie', 0.72);
        }
      });
      break;
    }
    case 'nutri': {
      slots(n, 6, 3, -3.4, 3).forEach(([x, z]) => {
        part(c, GEO.box, mat('#e7e5e4', { r: 0.4 }), x, 0.74, z, 1.4, 0.06, 0.8);
        part(c, GEO.box, FRAME(), x, 0.37, z - 0.3, 1.3, 0.74, 0.06);
        staff(c, x, z - 0.75, 0, '#bef264');
        part(c, GEO.box, mat('#111'), x - 0.4, 0.92, z - 0.1, 0.4, 0.3, 0.04);
        pad(c, x, 0.46, z + 0.7, 0.45, 0.45);
        seat(c, x, z + 0.7, 'sit', 0.48, Math.PI);
      });
      break;
    }
    case 'sauna': {
      part(c, GEO.box, mat('#92400e', { r: 0.8 }), -2.6, 1.2, -1.8, 4.2, 2.4, 3.6);
      part(c, GEO.box, mat('#fed7aa', { op: 0.35, r: 0.1 }), -2.6, 1, 0.02, 1, 2, 0.05);
      slots(n, 6, 2, -3.4, 3).forEach(([x, z]) => {
        x = 1.5 + (x > 0 ? 1.6 : 0);
        part(c, GEO.box, mat('#f5f5f4', { r: 0.8 }), x, 0.7, z, 0.7, 0.12, 1.8);
        part(c, GEO.box, mat('#a16207'), x, 0.33, z, 0.6, 0.66, 1.6);
        seat(c, x, z + 0.2, 'lie', 0.76);
      });
      break;
    }
  }
}
