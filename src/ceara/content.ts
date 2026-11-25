import raw from './cities.json';

/** Guerra no Ceará: catálogo. Cidades, fronteiras e população: IBGE (malha municipal e Censo 2022). */
export interface City { id: number; name: string; pop: number; region: string; x: number; y: number; rings: number[][]; level: number }
const ROWS = raw as unknown as [number, string, number, string, number, number, number[][]][];
const RANK = [...ROWS].sort((a, b) => a[2] - b[2]).map((r) => r[0]);
export const CITIES: City[] = ROWS.map(([id, name, pop, region, x, y, rings]) => ({
  id, name, pop, region, x, y, rings,
  // Quanto maior a cidade, mais forte a defesa (1 a 6)
  level: Math.min(6, 1 + Math.floor((RANK.indexOf(id) / ROWS.length) ** 1.35 * 6)),
}));
export const CITY = Object.fromEntries(CITIES.map((c) => [c.id, c])) as Record<number, City>;
export const REGION_COLOR: Record<string, string> = {
  'Metropolitana de Fortaleza': '#7cc492', Norte: '#9ccf7c', Noroeste: '#b9cd6f', Jaguaribe: '#dcc073', Sertões: '#e3ad72', 'Centro-Sul': '#d79d64', Sul: '#8fc07a',
};

export const GRID = 26;
export const MAX_LEVEL = 6;

// ===== Construções =====
export type BuildId = 'prefeitura' | 'feira' | 'casafarinha' | 'cofre' | 'celeiro' | 'rancho' | 'terreiro' | 'canhao' | 'mirante' | 'catapulta' | 'estilingao' | 'muro';
export interface BuildDef {
  name: string; icon: string; size: number; hp: number; cost: number; pay: 'moedas' | 'farinha'; time: number;
  /** Quantidade máxima por nível da prefeitura */
  max: number[]; text: string;
  defense?: { range: number; min?: number; dps: number; every: number; air: boolean; ground: boolean; splash?: number };
}
export const BUILDS: Record<BuildId, BuildDef> = {
  prefeitura: { name: 'Prefeitura', icon: '🏛️', size: 4, hp: 900, cost: 1500, pay: 'moedas', time: 30, max: [1, 1, 1, 1, 1, 1], text: 'O coração da cidade. Evoluir libera tudo.' },
  feira: { name: 'Feira', icon: '🛒', size: 3, hp: 250, cost: 150, pay: 'farinha', time: 8, max: [1, 2, 3, 4, 5, 6], text: 'Produz moedas.' },
  casafarinha: { name: 'Casa de Farinha', icon: '🌾', size: 3, hp: 250, cost: 150, pay: 'moedas', time: 8, max: [1, 2, 3, 4, 5, 6], text: 'Produz farinha.' },
  cofre: { name: 'Cofre', icon: '💰', size: 2, hp: 350, cost: 300, pay: 'farinha', time: 10, max: [1, 1, 2, 2, 3, 3], text: 'Guarda mais moedas.' },
  celeiro: { name: 'Celeiro', icon: '🛖', size: 2, hp: 350, cost: 300, pay: 'moedas', time: 10, max: [1, 1, 2, 2, 3, 3], text: 'Guarda mais farinha.' },
  rancho: { name: 'Rancho', icon: '🐎', size: 3, hp: 300, cost: 200, pay: 'farinha', time: 10, max: [1, 1, 2, 2, 3, 3], text: 'Treina tropas. Nível alto libera novas.' },
  terreiro: { name: 'Terreiro', icon: '🔥', size: 3, hp: 280, cost: 250, pay: 'farinha', time: 10, max: [1, 1, 2, 2, 3, 3], text: 'Abriga o exército.' },
  canhao: { name: 'Canhão do Forte', icon: '💣', size: 2, hp: 350, cost: 250, pay: 'moedas', time: 10, max: [1, 2, 2, 3, 4, 5], text: 'Atira em tropas no chão.', defense: { range: 7, dps: 27, every: 0.9, air: false, ground: true } },
  mirante: { name: 'Mirante', icon: '🏹', size: 2, hp: 320, cost: 400, pay: 'moedas', time: 14, max: [0, 1, 2, 3, 4, 5], text: 'Atira no chão e no ar.', defense: { range: 7.5, dps: 18, every: 0.6, air: true, ground: true } },
  catapulta: { name: 'Catapulta de Coco', icon: '🥥', size: 3, hp: 320, cost: 900, pay: 'moedas', time: 20, max: [0, 0, 1, 2, 2, 3], text: 'Acerta várias tropas de uma vez, de longe.', defense: { range: 9, min: 3, dps: 9, every: 3, air: false, ground: true, splash: 1.7 } },
  estilingao: { name: 'Estilingão', icon: '🎯', size: 2, hp: 300, cost: 800, pay: 'moedas', time: 18, max: [0, 0, 0, 1, 2, 3], text: 'Derruba o que voa.', defense: { range: 8.5, dps: 40, every: 1.1, air: true, ground: false } },
  muro: { name: 'Muro de Pedra', icon: '🧱', size: 1, hp: 450, cost: 40, pay: 'moedas', time: 0, max: [20, 45, 70, 100, 130, 160], text: 'Segura as tropas do inimigo.' },
};
export const BUILD_IDS = Object.keys(BUILDS) as BuildId[];
export const upCost = (b: BuildId, level: number) => Math.round(BUILDS[b].cost * (b === 'muro' ? 2 : 2.1) ** (level - 1));
export const upTime = (b: BuildId, level: number) => Math.round(BUILDS[b].time * 1.9 ** (level - 1));
export const hpAt = (b: BuildId, level: number) => Math.round(BUILDS[b].hp * 1.3 * 1.28 ** (level - 1));
export const dpsAt = (b: BuildId, level: number) => (BUILDS[b].defense?.dps ?? 0) * 1.25 ** (level - 1);
export const produces = (level: number) => 1.1 * 1.45 ** (level - 1); // por segundo
export const PROD_CAP_S = 3600 * 3;
export const storageAt = (level: number) => Math.round(2500 * 2 ** (level - 1));
export const campAt = (level: number) => 20 + level * 10;

// ===== Tropas =====
export type TroopId = 'vaqueiro' | 'rendeira' | 'cangaceiro' | 'jegue' | 'carcara' | 'boitata' | 'rezadeira';
export interface TroopDef {
  name: string; icon: string; space: number; hp: number; dps: number; every: number; range: number; speed: number; cost: number; time: number; rancho: number; text: string;
  air?: boolean; prefers?: 'defesa' | 'muro' | 'recurso'; splash?: number; bomb?: boolean; heal?: boolean;
}
export const TROOPS: Record<TroopId, TroopDef> = {
  vaqueiro: { name: 'Vaqueiro', icon: '🤠', space: 1, hp: 62, dps: 13, every: 0.8, range: 0.7, speed: 2.3, cost: 20, time: 3, rancho: 1, text: 'Barato e valente. Vai em tudo.' },
  rendeira: { name: 'Rendeira', icon: '🏹', space: 1, hp: 30, dps: 11, every: 0.9, range: 4, speed: 2.5, cost: 35, time: 4, rancho: 1, text: 'Atira de longe, no chão e no ar.' },
  cangaceiro: { name: 'Cangaceiro', icon: '⚔️', space: 5, hp: 420, dps: 16, every: 1.4, range: 0.9, speed: 1.6, cost: 180, time: 14, rancho: 2, text: 'Forte. Procura as defesas.', prefers: 'defesa' },
  jegue: { name: 'Jegue-Bomba', icon: '🫏', space: 2, hp: 34, dps: 110, every: 0.1, range: 0.8, speed: 3.2, cost: 120, time: 8, rancho: 2, text: 'Explode muros.', prefers: 'muro', splash: 1.6, bomb: true },
  carcara: { name: 'Carcará', icon: '🦅', space: 4, hp: 170, dps: 34, every: 1, range: 1.2, speed: 2.6, cost: 220, time: 12, rancho: 3, text: 'Voa por cima dos muros e rouba recursos.', air: true, prefers: 'recurso' },
  boitata: { name: 'Boitatá', icon: '🔥', space: 4, hp: 110, dps: 42, every: 1.3, range: 3.4, speed: 2, cost: 320, time: 16, rancho: 4, text: 'Serpente de fogo que queima em área.', splash: 1.3 },
  rezadeira: { name: 'Rezadeira', icon: '🙏', space: 6, hp: 190, dps: 34, every: 0.8, range: 4, speed: 2, cost: 450, time: 22, rancho: 5, text: 'Cura as tropas por perto.', heal: true },
};
export const TROOP_IDS = Object.keys(TROOPS) as TroopId[];
export const RAID_SECONDS = 150;

export const CLAN_PHRASES = ['Bora, cabra!', 'Valha me Deus!', 'Arretado!', 'Preciso de tropas', 'Mandei reforço', 'Ataquei, foi massa!', 'Égua, macho!', 'Vai lá tu', 'Oxente!', 'Tamo junto'];
export const LEAGUES = [
  { name: 'Sertanejo', icon: '🥉', min: 0 }, { name: 'Vaqueiro de Ouro', icon: '🥈', min: 200 }, { name: 'Coronel', icon: '🥇', min: 500 },
  { name: 'Rei do Cangaço', icon: '💎', min: 1000 }, { name: 'Lenda do Ceará', icon: '👑', min: 2000 },
];
export const leagueOf = (t: number) => [...LEAGUES].reverse().find((l) => t >= l.min)!;
