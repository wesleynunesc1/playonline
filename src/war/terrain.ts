import { CITIES, City, NEIGHBORS, RINGS } from './data';

/** Relevo do Ceará: serras, vales, açudes e rios. A altura é calculada uma vez em uma grade. */
export const PHONE = Math.min(window.innerWidth, window.innerHeight) < 700;
export const BOUNDS = (() => {
  let [x0, x1, z0, z1] = [1e9, -1e9, 1e9, -1e9];
  RINGS.forEach((l) => l.forEach((r) => r.forEach(([x, z]) => {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  })));
  return { x0: x0 - 1, x1: x1 + 1, z0: z0 - 1, z1: z1 + 1, w: x1 - x0 + 2, h: z1 - z0 + 2 };
})();
const M = 14;
/** Área com relevo, um pouco maior que o estado */
export const EXT = { x0: BOUNDS.x0 - M, z0: BOUNDS.z0 - M, w: BOUNDS.w + 2 * M, h: BOUNDS.h + 2 * M };
/** Tamanho da mancha urbana; vizinhas coladas dividem o espaço sem se sobrepor */
const reach = (c: City) => Math.min(1.15, 0.28 + Math.sqrt(c.pop) / 1300);
const SPREAD = new Map(CITIES.map((c) => [c.id, CITIES.reduce((r, o) => (o === c ? r : Math.min(r, Math.max(0.24, (Math.hypot(o.x - c.x, o.z - c.z) * reach(c)) / (reach(c) + reach(o)) / 1.16))), reach(c))]));
export const spread = (c: City) => SPREAD.get(c.id)!;
const named = new Map(CITIES.map((c) => [c.name, c]));
export const cityNamed = (n: string) => named.get(n)!;

// ===== Ruído =====
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
export const noise = (x: number, y: number) => {
  const [i, j] = [Math.floor(x), Math.floor(y)];
  const [f, g] = [x - i, y - j];
  const [u, v] = [f * f * (3 - 2 * f), g * g * (3 - 2 * g)];
  return (hash(i, j) * (1 - u) + hash(i + 1, j) * u) * (1 - v) + (hash(i, j + 1) * (1 - u) + hash(i + 1, j + 1) * u) * v;
};
const fbm = (x: number, y: number) => noise(x, y) * 0.5 + noise(x * 2.1 + 5, y * 2.1) * 0.27 + noise(x * 4.3, y * 4.3 + 9) * 0.15 + noise(x * 8.7 + 2, y * 8.7) * 0.08;
const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const segDist = (x: number, z: number, a: { x: number; z: number }, b: { x: number; z: number }) => {
  const [dx, dz] = [b.x - a.x, b.z - a.z];
  const k = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a.x - dx * k, z - a.z - dz * k);
};

// ===== Serras: [cidades da crista, altura, largura] =====
const RIDGES: { pts: City[]; h: number; w: number }[] = ([
  [['Viçosa do Ceará', 'Tianguá', 'Ubajara', 'Ibiapina', 'São Benedito', 'Guaraciaba do Norte', 'Croatá'], 1.5, 1.5],
  [['Aratuba', 'Mulungu', 'Guaramiranga', 'Pacoti'], 1.7, 1.15],
  [['Salitre', 'Araripe', 'Santana do Cariri', 'Crato', 'Barbalha', 'Jardim'], 1.3, 1.3],
  [['Meruoca', 'Alcântaras'], 1.15, 0.85], [['Uruburetama', 'Itapajé'], 1.05, 0.85], [['Maranguape', 'Palmácia'], 0.95, 0.75],
  [['Monsenhor Tabosa', 'Catunda'], 1.05, 1.1], [['Pereiro', 'Ererê'], 0.95, 0.9], [['Parambu', 'Quiterianópolis', 'Novo Oriente'], 0.8, 1.1], [['Caririaçu', 'Granjeiro'], 0.7, 0.8],
] as [string[], number, number][]).map(([l, h, w]) => ({ pts: l.map(cityNamed).filter(Boolean), h, w }));
function ridge(x: number, z: number) {
  let out = 0;
  for (const r of RIDGES) {
    let d = 1e9;
    for (let i = 0; i < Math.max(1, r.pts.length - 1); i++) d = Math.min(d, segDist(x, z, r.pts[i], r.pts[i + 1] ?? r.pts[i]));
    if (d > r.w * 2.6) continue;
    const wob = d * (0.75 + fbm(x * 0.9, z * 0.9) * 0.6);
    out = Math.max(out, r.h * Math.exp(-((wob / r.w) ** 2)) * (0.72 + 0.56 * fbm(x * 1.7 + 4, z * 1.7)));
  }
  return out;
}

// ===== Açudes e rios =====
export const LAKES = ([
  ['Jaguaribara', 1.0, 0.75, 0.9], ['Orós', 0.75, -0.4, 0.62], ['Varjota', -0.75, 0.6, 0.55], ['Banabuiú', -0.85, 0.35, 0.6], ['Pentecoste', 0.7, 0.55, 0.45], ['Crateús', 0.9, 0.7, 0.42], ['Caucaia', -0.9, 0.7, 0.3],
] as [string, number, number, number][]).filter(([n]) => cityNamed(n)).map(([n, dx, dz, r]) => ({ x: cityNamed(n).x + dx, z: cityNamed(n).z + dz, r, level: 0 }));
export const lakeEdge = (l: { r: number }, a: number) => l.r * (1 + 0.24 * Math.sin(a * 3 + l.r * 9) + 0.14 * Math.sin(a * 5 + 1) + 0.07 * Math.sin(a * 11));
const RIVER_NAMES: [string[], [number, number] | null][] = [
  [['Tauá', 'Arneiroz', 'Saboeiro', 'Jucás', 'Iguatu', 'Orós', 'Jaguaribe', 'Jaguaribara', 'Tabuleiro do Norte', 'Limoeiro do Norte', 'Russas', 'Itaiçaba', 'Aracati'], [1.2, -0.9]],
  [['Quixeramobim', 'Banabuiú', 'Morada Nova', 'Limoeiro do Norte'], null],
  [['Tamboril', 'Varjota', 'Sobral', 'Santana do Acaraú', 'Morrinhos', 'Marco', 'Acaraú'], [0.2, -1.3]],
  [['Coreaú', 'Granja', 'Camocim'], [0, -1.2]],
  [['Juazeiro do Norte', 'Missão Velha', 'Aurora', 'Lavras da Mangabeira', 'Icó', 'Orós'], null],
  [['Canindé', 'Paramoti', 'Pentecoste', 'São Luís do Curu', 'Paraipaba', 'Paracuru'], [0.3, -1]],
];
/** Cada rio passa ao lado das cidades, nunca por cima */
export const RIVERS = RIVER_NAMES.map(([names, mouth]) => {
  const cs = names.map(cityNamed).filter(Boolean);
  const pts = cs.map((c, i) => {
    const p = cs[Math.max(0, i - 1)];
    const n = cs[Math.min(cs.length - 1, i + 1)];
    const a = Math.atan2(n.z - p.z, n.x - p.x) + Math.PI / 2;
    const off = spread(c) * 1.15 + 0.22;
    return { x: c.x + Math.cos(a) * off, z: c.z + Math.sin(a) * off };
  });
  if (mouth) {
    const last = cs[cs.length - 1];
    pts.push({ x: last.x + mouth[0], z: last.z + mouth[1] });
  }
  return pts;
});

// ===== Terra e mar =====
/** Desenha o contorno da terra em um quadro que cobre `box` */
export function silhouette(size: number, box: { x0: number; z0: number; w: number; h: number }, opt: { blur?: number; around?: boolean; fill?: string } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const m = c.getContext('2d', { willReadFrequently: true })!;
  m.fillStyle = opt.fill ?? '#7f9270';
  const X = (x: number) => ((x - box.x0) / box.w) * size;
  const Z = (z: number) => ((z - box.z0) / box.h) * size;
  m.beginPath();
  if (opt.around) NEIGHBORS.forEach(([x, z], i) => (i ? m.lineTo(X(x), Z(z)) : m.moveTo(X(x), Z(z))));
  m.fill();
  m.beginPath();
  RINGS.forEach((l) => l.forEach((r) => r.forEach(([x, z], i) => (i ? m.lineTo(X(x), Z(z)) : m.moveTo(X(x), Z(z))))));
  m.fill();
  if (!opt.blur) return c;
  // Desfoque por reamostragem (funciona em todos os navegadores)
  const b = document.createElement('canvas');
  b.width = b.height = size;
  const x = b.getContext('2d', { willReadFrequently: true })!;
  const N = 24;
  x.globalCompositeOperation = 'lighter';
  x.globalAlpha = 1 / N;
  for (let i = 0; i < N; i++) {
    const a = i * 2.4;
    const r = opt.blur * Math.sqrt((i + 0.5) / N);
    x.drawImage(c, Math.cos(a) * r, Math.sin(a) * r);
  }
  return b;
}

// ===== Grade de altura =====
export const STEP_M = PHONE ? 0.36 : 0.24;
export const NX = Math.ceil(EXT.w / STEP_M) + 1;
export const NZ = Math.ceil(EXT.h / STEP_M) + 1;
export const HEIGHT = new Float32Array(NX * NZ);
/** 1 em terra, 0 no mar, com praia no meio */
export const COAST_CANVAS = silhouette(640, EXT, { blur: 7, around: true });
(() => {
  const data = COAST_CANVAS.getContext('2d')!.getImageData(0, 0, 640, 640).data;
  const coast = (x: number, z: number) => {
    const u = Math.max(0, Math.min(638.999, ((x - EXT.x0) / EXT.w) * 640 - 0.5));
    const v = Math.max(0, Math.min(638.999, ((z - EXT.z0) / EXT.h) * 640 - 0.5));
    const [i, j] = [Math.floor(u), Math.floor(v)];
    const g = (a: number, b: number) => data[(b * 640 + a) * 4 + 3] / 255;
    return (g(i, j) * (1 - u + i) + g(i + 1, j) * (u - i)) * (1 - v + j) + (g(i, j + 1) * (1 - u + i) + g(i + 1, j + 1) * (u - i)) * (v - j);
  };
  const raw = (x: number, z: number) => {
    const e = smooth(0.3, 0.72, coast(x, z));
    const inland = smooth(0.8, 1, coast(x, z));
    return -0.4 + e * 0.66 + inland * ((fbm(x * 0.32, z * 0.32) - 0.42) * 0.75 + (fbm(x * 1.3 + 8, z * 1.3) - 0.45) * 0.22 + 0.12 + ridge(x, z));
  };
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) HEIGHT[j * NX + i] = raw(EXT.x0 + i * STEP_M, EXT.z0 + j * STEP_M);
  /** Aplica uma mistura em volta de um ponto */
  const around = (x: number, z: number, r: number, fn: (h: number, d: number, px: number, pz: number) => number) => {
    for (let j = Math.max(0, Math.floor((z - r - EXT.z0) / STEP_M)); j <= Math.min(NZ - 1, Math.ceil((z + r - EXT.z0) / STEP_M)); j++) {
      for (let i = Math.max(0, Math.floor((x - r - EXT.x0) / STEP_M)); i <= Math.min(NX - 1, Math.ceil((x + r - EXT.x0) / STEP_M)); i++) {
        const [px, pz] = [EXT.x0 + i * STEP_M, EXT.z0 + j * STEP_M];
        const d = Math.hypot(px - x, pz - z);
        if (d <= r) HEIGHT[j * NX + i] = fn(HEIGHT[j * NX + i], d, px, pz);
      }
    }
  };
  for (const l of LAKES) {
    l.level = Math.max(0.16, raw(l.x, l.z)) - 0.02;
    around(l.x, l.z, l.r * 2.6, (h, d, px, pz) => {
      const edge = lakeEdge(l, Math.atan2(pz - l.z, px - l.x));
      const t = smooth(edge + 0.55, edge + 0.02, d);
      return h * (1 - t) + (l.level + 0.05 - smooth(edge + 0.02, edge * 0.6, d) * 0.3) * t;
    });
  }
  // Cidades em terreno plano
  // Cidades coladas ficam no mesmo nível
  const level = new Map(CITIES.map((c) => [c.id, Math.max(0.2, raw(c.x, c.z))]));
  for (let i = 0; i < 12; i++) for (const a of CITIES) for (const b of CITIES) {
    if (a.id >= b.id || Math.hypot(a.x - b.x, a.z - b.z) > (spread(a) + spread(b)) * 1.2 + 0.9) continue;
    const mid = (level.get(a.id)! + level.get(b.id)!) / 2;
    level.set(a.id, mid);
    level.set(b.id, mid);
  }
  for (const c of CITIES) {
    const base = level.get(c.id)!;
    const r = spread(c) * 1.2 + 0.25;
    around(c.x, c.z, r + 0.7, (h, d) => {
      const t = smooth(r + 0.7, r, d);
      return h * (1 - t) + base * t;
    });
  }
})();
/** Altura do chão em qualquer ponto */
export function Y(x: number, z: number): number {
  const u = Math.max(0, Math.min(NX - 1.001, (x - EXT.x0) / STEP_M));
  const v = Math.max(0, Math.min(NZ - 1.001, (z - EXT.z0) / STEP_M));
  const [i, j] = [Math.floor(u), Math.floor(v)];
  const [f, g] = [u - i, v - j];
  const k = j * NX + i;
  const [a, b, c, d] = [HEIGHT[k], HEIGHT[k + 1], HEIGHT[k + NX], HEIGHT[k + NX + 1]];
  // Mesmos triângulos da malha
  return f + g <= 1 ? a + (b - a) * f + (c - a) * g : d + (c - d) * (1 - f) + (b - d) * (1 - g);
}
export const isWater = (x: number, z: number) => Y(x, z) < 0.06 || LAKES.some((l) => Math.hypot(x - l.x, z - l.z) < l.r * 1.45);
