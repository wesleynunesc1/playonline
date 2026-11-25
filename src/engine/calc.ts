import { BY_REGION, BY_RES, COUNTRIES, REGIONS, Res, abilityOf, distance } from '../data/countries';
import {
  BRANCHES, BUILDINGS, Building, COMBOS, ERAS, GENERALS, ITEMS, ModKey, Mods, PERKS, RARITY, REGIMES, RESOURCES, SPACE,
  TERRAIN_INFO, UNITS, UNIT_INFO, Unit, WONDERS,
} from '../data/content';
import { Army, CountryState, M, PLAYER, clamp, game, isMine, owned } from './state';

/** Soma todos os bônus ativos (tecnologia, maravilhas, regime, prestígio, dupla de generais, país) */
export function mods(): Record<ModKey, number> {
  const g = game();
  const out: Record<ModKey, number> = {
    income: 0, attack: 0, defense: 0, science: 0, recruit: 0, upgrade: 0, happy: 0, spy: 0, trade: 0, casualty: 0, food: 0,
    diplomacy: 0, siege: 0, power: 0, resource: 0, garrison: 0, navy: 0,
  };
  const add = (m: Mods, times = 1) => {
    for (const k in out) out[k as ModKey] += (m[k as ModKey] ?? 0) * times;
  };
  for (const b of BRANCHES) add(b.mods, g.techs[b.id] ?? 0);
  for (const w of WONDERS) if (g.wonders[w.id] && isMine(g.wonders[w.id])) add(w.mods);
  add(REGIMES.find((r) => r.id === g.regime)!.mods);
  for (const p of PERKS) add(p.mods, M.perks[p.id] ?? 0);
  for (const c of COMBOS) if (c.ids.every((id) => M.staff.includes(id) && !M.generals[id]?.captor)) add(c.mods);
  add(abilityOf(g.origin) as Mods);
  const count = (b: Building) => owned().reduce((s, id) => s + g.countries[id].b[b], 0);
  out.income += Math.min(0.5, count('banco') * 0.02);
  out.recruit += Math.min(0.2, count('quartel') * 0.02);
  const ports = count('porto');
  out.navy += Math.min(1, ports * 0.1);
  out.trade += Math.min(0.5, ports * 0.05);
  out.attack += ERAS[g.era].bonus;
  out.defense += ERAS[g.era].bonus;
  out.recruit = Math.min(0.6, out.recruit);
  out.upgrade = Math.min(0.6, out.upgrade);
  out.casualty = Math.min(0.6, out.casualty);
  return out;
}

export const continentsOwned = () => REGIONS.filter((r) => BY_REGION[r].every((id) => isMine(id) || game().countries[id].vassal));
/** Monopólio: controlar 60% dos países produtores */
export function monopolyShare(res: Res) {
  const all = BY_RES(res);
  return all.filter(isMine).length / all.length;
}
export const hasMonopoly = (res: Res) => monopolyShare(res) >= 0.6;

export const TAX_INFO = [
  { name: 'Baixo', income: 0.7, happy: 12 },
  { name: 'Normal', income: 1, happy: 0 },
  { name: 'Alto', income: 1.3, happy: -14 },
  { name: 'Abusivo', income: 1.7, happy: -32 },
];

export function countryIncome(id: string, c: CountryState = game().countries[id]): number {
  const base = COUNTRIES[id].income * (1 + (c.level - 1) * 0.4) * (1 + c.b.fabrica * 0.3);
  return base * (c.siege ? 0.3 : 1) * (c.cyber > 0 ? 0.5 : 1);
}

export interface Budget {
  taxes: number; routes: number; vassals: number; space: number; bonus: number; interest: number; upkeep: number; siege: number; total: number;
}
export function budget(m = mods()): Budget {
  const g = game();
  const full = new Set(continentsOwned());
  let taxes = 0;
  for (const id of owned()) {
    taxes += countryIncome(id) * (full.has(COUNTRIES[id].region) ? 1.25 : 1) * (0.5 + g.countries[id].happy / 140);
  }
  for (const r of RESOURCES) if (hasMonopoly(r)) taxes *= 1.1;
  taxes *= TAX_INFO[g.tax].income * (1 + m.income);
  let routes = 0;
  let vassals = 0;
  let siege = 0;
  for (const id in g.countries) {
    const c = g.countries[id];
    if (c.route) routes += (4 + COUNTRIES[id].income * 0.25) * (1 + m.trade);
    if (c.vassal) vassals += countryIncome(id, c) * 0.5;
    if (c.siege && c.owner !== PLAYER) siege += 12;
  }
  for (const r of Object.values(g.rivals)) if (r.trade && r.alive) routes += 15 * (1 + m.trade);
  if (g.sanction > 0) routes *= 0.3;
  const space = SPACE.slice(0, g.space).reduce((s, x) => s + x.income, 0);
  const upkeep = UNITS.reduce((s, u) => s + g.army[u] * UNIT_INFO[u].power, 0) * 0.015;
  const interest = g.debt * 0.0015;
  return { taxes, routes, vassals, space, bonus: g.bonusIncome, interest, upkeep, siege, total: taxes + routes + vassals + space + g.bonusIncome - interest - upkeep - siege };
}

export function scienceRate(m = mods()) {
  const labs = owned().reduce((s, id) => s + game().countries[id].b.laboratorio, 0);
  return (0.25 + owned().length * 0.04 + labs * 0.5) * (1 + m.science);
}
export function production(m = mods()): Record<Res, number> {
  const out = { oil: 0, iron: 0, food: 0, uranium: 0 };
  for (const id of owned()) {
    const c = COUNTRIES[id];
    const s = game().countries[id];
    out[c.res] += (c.res === 'uranium' ? 0.02 : 0.08) * (1 + c.income / 30) * (1 + s.b.fabrica * 0.3) * (s.siege ? 0.2 : 1);
  }
  for (const r of RESOURCES) out[r] *= (1 + m.resource + (r === 'food' ? m.food : 0)) * (hasMonopoly(r) ? 2 : 1);
  return out;
}

export const recruitCost = (u: Unit, n: number, m = mods()) => Math.round(UNIT_INFO[u].money * n * (1 - m.recruit) * (1 + game().era * 0.35));
export const buildCost = (id: string, b: Building, m = mods()) =>
  Math.round(BUILDINGS[b].cost * (1 + game().countries[id].b[b] * 1.2) * (1 + owned().length * 0.02) * (1 - m.upgrade));
export const upgradeCost = (id: string, m = mods()) =>
  Math.round(Math.max(300, COUNTRIES[id].income * 18) * 1.6 ** (game().countries[id].level - 1) * (1 - m.upgrade));

// ===== Estação do ano e terreno =====
export const SEASON_NAMES = ['Primavera', 'Verão', 'Outono', 'Inverno'];
export const seasonNow = () => Math.floor(game().time / 60) % 4;
export function terrainDefense(id: string) {
  const t = COUNTRIES[id].terrain;
  return 1 + TERRAIN_INFO[t].defense + (t === 'frio' && seasonNow() === 3 ? 0.25 : 0);
}

// ===== Força =====
/** Composição do inimigo, fixa por país */
export function enemyMix(id: string): Record<Unit, number> {
  const seed = id.charCodeAt(0) * 7 + id.charCodeAt(1) * 13;
  const raw = { inf: 3 + (seed % 4), tank: 1 + (seed % 3), air: 1 + (Math.floor(seed / 3) % 3), navy: COUNTRIES[id].coastal ? 1 : 0 };
  const sum = raw.inf + raw.tank + raw.air + raw.navy;
  return { inf: raw.inf / sum, tank: raw.tank / sum, air: raw.air / sum, navy: raw.navy / sum };
}
const COUNTER: Record<Unit, Unit> = { inf: 'air', tank: 'inf', air: 'tank', navy: 'navy' };

export function generalStats(id: string): { attack: number; casualty: number; read: number } {
  const s = M.generals[id];
  const def = GENERALS.find((g) => g.id === id);
  if (!s || !def || s.captor) return { attack: 0, casualty: 0, read: 0 };
  const item = ITEMS.find((i) => i.id === s.item);
  return {
    attack: 0.04 * RARITY[def.rarity].power + s.lvl * 0.01 + s.skills.ofensiva * 0.04 + (item?.attack ?? 0),
    casualty: s.skills.protecao * 0.05 + (item?.casualty ?? 0),
    read: s.skills.estrategia * 0.06,
  };
}
export function attackPower(army: Army, target: string, general: string, m = mods()): number {
  const g = game();
  const terrain = TERRAIN_INFO[COUNTRIES[target].terrain].mult;
  const mix = enemyMix(target);
  const def = GENERALS.find((x) => x.id === general);
  let sum = 0;
  for (const u of UNITS) {
    if (u === 'navy' && !COUNTRIES[target].coastal) continue;
    let p = army[u] * UNIT_INFO[u].power * (terrain[u] ?? 1) * (1 + mix[COUNTER[u]] * 0.6);
    if (u === def?.unit) p *= 1.1;
    sum += p;
  }
  return sum * (1 + m.attack + generalStats(general).attack) * g.morale * (1 + g.vet / 400);
}
export const armyPower = (a: Army) => UNITS.reduce((s, u) => s + a[u] * UNIT_INFO[u].power, 0);
export function defensePower(id: string, m = mods()): number {
  const g = game();
  const c = g.countries[id];
  if (c.owner === PLAYER) {
    return Math.max(5, (c.def * (1 + m.garrison) + armyPower(g.army) * 0.12) * terrainDefense(id) * (1 + m.defense) * g.morale);
  }
  let d = c.def * terrainDefense(id) * (c.sab > 0 ? 0.75 : 1);
  const r = g.rivals[c.owner];
  if (r) d += r.power * (r.capital === id ? 0.5 : 0.15) * (r.war ? 0.6 : 1);
  return Math.max(5, d);
}
/** Chance aproximada de vitória para uma relação de forças */
export const winChance = (a: number, d: number) => (a <= 0 ? 0 : clamp(1 / (1 + (d / a) ** 5), 0.01, 0.99));

// ===== Alcance =====
export const navalRange = (m = mods()) => 18 * (1 + m.navy);
export type Reach = 'terra' | 'mar' | 'ar' | null;
export function reach(target: string, from = PLAYER, range = from === PLAYER ? navalRange() : 18): Reach {
  const g = game();
  const t = COUNTRIES[target];
  if (t.neighbors.some((n) => g.countries[n].owner === from)) return 'terra';
  if (from === PLAYER && g.para) return 'ar';
  if (t.coastal && owned(from).some((id) => COUNTRIES[id].coastal && distance(id, target) <= range)) return 'mar';
  return null;
}
export const SHIP_CAPACITY = 20;
export const landTroops = (a: Army) => a.inf + a.tank + a.air;

export const spyChance = (bonus = 0, m = mods()) => clamp(55 + m.spy + bonus, 5, 95);
export const revealed = (owner: string) => game().satellite > 0 || !!game().rivals[owner]?.spy;
