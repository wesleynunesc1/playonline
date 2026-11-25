import { WORLD_TABLE } from './worldTable';

export type Res = 'oil' | 'iron' | 'food' | 'uranium';
export const RES_LIST: Res[] = ['oil', 'iron', 'food', 'uranium'];
export type Terrain = 'planicie' | 'montanha' | 'deserto' | 'selva' | 'frio';

export interface Country {
  id: string;
  numericId: string;
  name: string;
  flag: string;
  region: string;
  income: number;
  defense: number;
  anchor: [number, number];
  res: Res;
  terrain: Terrain;
  coastal: boolean;
  neighbors: string[];
}

const flagOf = (id: string) => String.fromCodePoint(...[...id].map((c) => 127397 + c.charCodeAt(0)));

const LIST: Country[] = WORLD_TABLE.trim().split('\n').map((row) => {
  const [id, numericId, name, region, income, defense, lon, lat, res, terrain, coastal, nb] = row.split('|');
  return {
    id, numericId, name, region,
    flag: flagOf(id),
    income: Number(income),
    defense: Number(defense),
    anchor: [Number(lon), Number(lat)],
    res: res as Res,
    terrain: terrain as Terrain,
    coastal: coastal === '1',
    neighbors: nb.trim() ? nb.trim().split(' ') : [],
  };
});

export const COUNTRIES: Record<string, Country> = Object.fromEntries(LIST.map((c) => [c.id, c]));
export const COUNTRY_IDS = LIST.map((c) => c.id);
export const TOTAL_COUNTRIES = LIST.length;
export const NUMERIC_TO_COUNTRY: Record<string, string> = Object.fromEntries(LIST.map((c) => [c.numericId, c.id]));
export const REGIONS = [...new Set(LIST.map((c) => c.region))];
export const BY_REGION: Record<string, string[]> = Object.fromEntries(REGIONS.map((r) => [r, LIST.filter((c) => c.region === r).map((c) => c.id)]));
export const BY_RES = (res: Res) => LIST.filter((c) => c.res === res).map((c) => c.id);

const RAD = Math.PI / 180;
/** Distância em graus de arco entre dois países */
export function distance(a: string, b: string): number {
  const [lo1, la1] = COUNTRIES[a].anchor;
  const [lo2, la2] = COUNTRIES[b].anchor;
  const cos = Math.sin(la1 * RAD) * Math.sin(la2 * RAD) + Math.cos(la1 * RAD) * Math.cos(la2 * RAD) * Math.cos((lo1 - lo2) * RAD);
  return Math.acos(Math.min(1, Math.max(-1, cos))) / RAD;
}

/** Habilidade única: nações famosas têm a sua; as demais herdam a do seu recurso principal */
export interface Ability { name: string; text: string; income?: number; attack?: number; defense?: number; science?: number; recruit?: number; diplomacy?: number; food?: number; spy?: number }
const ABILITIES: Record<string, Ability> = {
  BR: { name: 'Celeiro do Mundo', text: '+50% comida e +10% renda', food: 0.5, income: 0.1 },
  US: { name: 'Superpotência', text: '+15% ataque', attack: 0.15 },
  CN: { name: 'Fábrica do Mundo', text: 'Recrutar custa 20% menos', recruit: 0.2 },
  RU: { name: 'General Inverno', text: '+25% defesa', defense: 0.25 },
  DE: { name: 'Engenharia', text: '+20% renda', income: 0.2 },
  JP: { name: 'Alta Tecnologia', text: '+30% ciência', science: 0.3 },
  GB: { name: 'Serviço Secreto', text: '+20% espionagem', spy: 20 },
  FR: { name: 'Arte da Diplomacia', text: 'Relações crescem 50% mais', diplomacy: 0.5 },
  IN: { name: 'Multidão', text: 'Recrutar custa 15% menos', recruit: 0.15 },
  AR: { name: 'Raça', text: '+10% ataque', attack: 0.1 },
  CH: { name: 'Banco Neutro', text: '+30% renda', income: 0.3 },
  KR: { name: 'Semicondutores', text: '+25% ciência', science: 0.25 },
  IL: { name: 'Inteligência', text: '+15% espionagem', spy: 15 },
  UY: { name: 'Pequeno Gigante', text: '+20% defesa', defense: 0.2 },
  CU: { name: 'Guerrilha', text: '+20% defesa', defense: 0.2 },
};
const BY_RESOURCE: Record<Res, Ability> = {
  oil: { name: 'Ouro Negro', text: '+10% renda', income: 0.1 },
  iron: { name: 'Forjas', text: 'Recrutar custa 10% menos', recruit: 0.1 },
  food: { name: 'Terras Férteis', text: '+25% comida', food: 0.25 },
  uranium: { name: 'Pesquisa Atômica', text: '+15% ciência', science: 0.15 },
};
export const abilityOf = (id: string): Ability => ABILITIES[id] ?? BY_RESOURCE[COUNTRIES[id].res];

export function getDifficulty(id: string): { label: string; color: string } {
  const i = COUNTRIES[id].income;
  if (i < 12) return { label: 'Extrema', color: 'text-rose-300' };
  if (i < 20) return { label: 'Difícil', color: 'text-orange-300' };
  if (i < 35) return { label: 'Média', color: 'text-amber-300' };
  return { label: 'Fácil', color: 'text-emerald-300' };
}
