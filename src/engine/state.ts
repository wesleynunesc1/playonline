import { useSyncExternalStore } from 'react';
import { COUNTRIES, COUNTRY_IDS, Res } from '../data/countries';
import { Building, CAMPAIGN, ModKey, Power, RIVALS, RESOURCES, RivalDef, RES_INFO, SCENARIOS, Skill, Stat, TITLES, Unit } from '../data/content';

/**
 * Estado do jogo: `G` é a partida atual e `M` é o progresso permanente.
 * As regras alteram esses objetos diretamente e chamam `bump()` para redesenhar.
 */
export const PLAYER = 'P';
export const ZOMBIES = 'Z';
export type Army = Record<Unit, number>;
export type StrikeKind = 'terra' | 'mar' | 'ar' | 'bomba' | 'nuclear' | 'inimigo';
/** Duração de cada animação de ataque e o momento do impacto dentro dela */
export const STRIKE_MS: Record<StrikeKind, number> = { terra: 2500, mar: 2700, ar: 2400, bomba: 2600, nuclear: 3800, inimigo: 2500 };
export const STRIKE_IMPACT = 0.82;
export type Tactic = 'avancar' | 'flanquear' | 'atrair';

export interface CountryState {
  owner: string; // '' = neutro, 'P' = jogador, 'Z' = zumbis, 'r1'... = rival
  level: number;
  def: number; // defesa; nos seus países é a guarnição
  happy: number;
  b: Record<Building, number>;
  sab: number;
  cyber: number;
  siege: boolean;
  vassal: boolean;
  spy: boolean;
  route: boolean;
}
export interface Rival {
  id: string; alive: boolean; capital: string; power: number; rel: number;
  ally: boolean; trade: boolean; truce: number; war: string; warTime: number; grudge: number;
  nemesis: boolean; returnIn: number; spy: boolean; sanction: number; cyber: number; memory: string[]; next: number;
}
export interface Battle {
  target: string; army: Army; general: string; a0: number; d0: number; a: number; d: number; round: number;
  stance: Tactic; hint: Tactic; last?: Tactic; log: string[]; done: '' | 'won' | 'lost' | 'fled'; boss: boolean; summary: string[];
}
export interface News { id: number; text: string; kind: 'war' | 'market' | 'diplo' | 'fun' }
export interface Game {
  version: number; mode: string; origin: string; capital: string; time: number; speed: 1 | 2 | 5; paused: boolean; savedAt: number;
  money: number; science: number; res: Record<Res, number>; prices: Record<Res, number>; army: Army; morale: number; vet: number;
  era: number; techs: Record<string, number>; regime: string; tax: 0 | 1 | 2 | 3; debt: number; infamy: number; bonusIncome: number;
  wonders: Record<string, string>; powers: Record<Power, number>; shield: boolean; para: boolean; satellite: number; sanction: number;
  countries: Record<string, CountryState>; rivals: Record<string, Rival>; coalition: boolean; space: number;
  threat: { by: string; target: string; left: number; power: number } | null;
  strike: { from: string; to: string; kind: StrikeKind; key: number } | null;
  battle: Battle | null; news: News[]; crisis: string; vote: { rival: string; text: string; kind: 'sancao' | 'paz' | 'contra' } | null;
  timers: Record<'market' | 'event' | 'vote' | 'joke' | 'special' | 'revolt' | 'raid', number>;
  wave: number; defeated: number; achievements: string[]; victories: string[]; over: { won: boolean; title: string; text: string } | null;
  stats: Record<Stat, number>; report: string[]; storySeen: boolean; seq: number; buffs: { k: ModKey; v: number; left: number }[];
  /** Marcas de guerra no mapa */
  scars: { id: string; nuke: boolean; at: number }[];
}
export interface GeneralState { lvl: number; xp: number; pts: number; skills: Record<Skill, number>; item: string; captor: string }
export interface Mission { stat: Stat; text: string; n: number; have: number; done: boolean }
export interface Meta {
  legacy: number; prestige: number; perks: Record<string, number>; xp: number; generals: Record<string, GeneralState>; staff: string[];
  items: Record<string, number>; chests: number; day: string; daily: Mission[]; week: string; weekly: Mission[]; streak: number; lastDay: string;
  season: { id: string; pts: number; claimed: number }; bossWeek: string; campaign: number; waveRecord: number; music: boolean; voice: boolean; lan?: { played: number; wins: number };
}

export const emptyArmy = (): Army => ({ inf: 0, tank: 0, air: 0, navy: 0 });
export const noBuildings = (): Record<Building, number> => ({ fabrica: 0, banco: 0, quartel: 0, porto: 0, laboratorio: 0 });
const SAVE_KEY = 'WORLD_EMPIRE_V3';
const META_KEY = 'WORLD_EMPIRE_META';
const VERSION = 3;

const newMeta = (): Meta => ({
  legacy: 0, prestige: 0, perks: {}, xp: 0, staff: ['g1'], items: { i1: 1 }, chests: 1, day: '', daily: [], week: '', weekly: [],
  generals: { g1: { lvl: 1, xp: 0, pts: 0, skills: { ofensiva: 0, protecao: 0, estrategia: 0 }, item: '', captor: '' } },
  streak: 0, lastDay: '', season: { id: '', pts: 0, claimed: 0 }, bossWeek: '', campaign: 0, waveRecord: 0, music: true, voice: false,
});
const read = <T,>(key: string): T | null => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* armazenamento indisponível */ }
};

export let G: Game | null = null;
export const M: Meta = { ...newMeta(), ...read<Meta>(META_KEY) };
export const game = () => G!;
export const setGame = (g: Game | null) => { G = g; bump(); };

// ===== Assinatura React =====
let version = 0;
const listeners = new Set<() => void>();
export function bump() {
  version++;
  listeners.forEach((l) => l());
}
export const useGame = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => version);

// ===== Salvamento =====
export function save() {
  write(META_KEY, M);
  if (G && !G.over && G.mode !== 'lan') write(SAVE_KEY, { ...G, savedAt: Date.now(), strike: null, battle: null });
}
export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* armazenamento indisponível */ }
}
export function loadSave(): Game | null {
  const g = read<Game>(SAVE_KEY);
  if (!g || g.version !== VERSION || !COUNTRIES[g.capital]) return null;
  g.buffs ??= [];
  g.scars ??= [];
  return g;
}

// ===== Utilidades =====
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const owned = (owner = PLAYER) => COUNTRY_IDS.filter((id) => game().countries[id].owner === owner);
export const isMine = (id: string) => game().countries[id].owner === PLAYER;
/** Jogadores reais da partida no Wi-Fi entram como rivais */
export const extraRivals: RivalDef[] = [];
export const isHuman = (id: string) => /^h\d$/.test(id);
export const rivalDef = (id: string) => RIVALS.find((r) => r.id === id) ?? extraRivals.find((r) => r.id === id)!;
/** Chaves do administrador (menu protegido por senha) */
export const cheat = {
  god: false, win: false, rich: false, army: false, reach: false, free: false, power: false, calm: false, freeze: false, see: false,
  snake: false, snakeSlow: false, cards: false, speed: 1,
};
/** Ligação com a partida no Wi-Fi (preenchida por lan/match) */
export const net = {
  active: false, host: false,
  locked: (_id: string) => false,
  incoming: (_owner: string, _target: string) => {},
  cyber: (_owner: string) => {},
  war: (_owner: string, _betrayal: boolean) => {},
  lost: () => {},
  nuke: (_target: string) => {},
};
export function scar(id: string, nuke = false) {
  const g = game();
  g.scars = [{ id, nuke, at: g.time }, ...g.scars.filter((s) => s.id !== id || (s.nuke && !nuke))].slice(0, 30);
}
export const scenarioOf = (mode: string) => [...SCENARIOS, ...CAMPAIGN].find((s) => s.id === mode) ?? null;
export function ownerName(owner: string) {
  if (owner === PLAYER) return 'Você';
  if (owner === ZOMBIES) return 'Zumbis';
  return owner ? rivalDef(owner).title : 'Independente';
}
export function news(text: string, kind: News['kind'] = 'diplo') {
  const g = game();
  g.news = [{ id: ++g.seq, text, kind }, ...g.news].slice(0, 30);
  hooks.onNews(text, kind);
}
/** Ganchos de interface (som, avisos, voz), vazios nos testes */
export const hooks = {
  onNews: (_text: string, _kind: News['kind']) => {},
  toast: (_text: string, _type: 'success' | 'danger' | 'info') => {},
  nuke: (_target: string) => {},
  sound: (_name: 'buy' | 'recruit' | 'win' | 'lose' | 'alert' | 'launch' | 'impact' | 'tech' | 'spy') => {},
};
export const ok = (text: string) => {
  hooks.toast(text, 'success');
  return true;
};
export const fail = (text: string) => {
  hooks.toast(text, 'danger');
  return false;
};

export const levelOf = (xp: number) => Math.floor(Math.sqrt(xp / 60)) + 1;
export const xpFor = (level: number) => 60 * (level - 1) ** 2;
export const titleOf = (level: number) => TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 3))];

// ===== Nova partida =====
function makeRival(id: string, capital: string, hard: number): Rival {
  return {
    id, capital, alive: true, power: 160 * hard, rel: rivalDef(id).personality === 'pacifico' ? 20 : 0, ally: false, trade: false,
    truce: 60, war: '', warTime: 0, grudge: 0, nemesis: false, returnIn: 0, spy: false, sanction: 0, cyber: 0, memory: [], next: rand(15, 40),
  };
}

export function newGame(countryId: string, mode = 'livre', lan?: { humans: string[]; ais: string[] }) {
  const sc = scenarioOf(mode);
  const hard = lan ? 1 : 1 + M.prestige * 0.2;
  const countries: Record<string, CountryState> = {};
  for (const id of COUNTRY_IDS) {
    countries[id] = {
      owner: '', level: 1, def: Math.round(COUNTRIES[id].defense * 1.15 * hard), happy: 70, b: noBuildings(),
      sab: 0, cyber: 0, siege: false, vassal: false, spy: false, route: false,
    };
  }
  const rivals: Record<string, Rival> = {};
  for (const r of RIVALS) {
    if (r.capital === countryId) continue;
    // Na partida livre o sétimo rival só entra se o jogador ocupar a vaga de outro
    const enters = lan ? lan.ais.includes(r.id) : sc ? sc.rivals.includes(r.id) : r.id !== 'r7' || Object.keys(rivals).length < 6;
    if (!enters) continue;
    rivals[r.id] = makeRival(r.id, r.capital, hard);
    countries[r.capital].owner = r.id;
    countries[r.capital].def = Math.round(COUNTRIES[r.capital].defense * 1.5 * hard);
  }
  for (const id of lan?.humans ?? []) {
    const home = rivalDef(id).capital;
    rivals[id] = makeRival(id, home, 1);
    countries[home].owner = id;
    countries[home].def = 40;
  }
  countries[countryId].owner = PLAYER;
  countries[countryId].def = 40;
  if (sc?.special === 'zumbis') for (const id of ['HT', 'CD', 'MM', 'RO']) if (!countries[id].owner) countries[id].owner = ZOMBIES;
  G = {
    version: VERSION, mode, origin: countryId, capital: countryId, time: 0, speed: 1, paused: false, savedAt: Date.now(),
    money: sc?.money ?? 2500, science: 10, res: { oil: 20, iron: 30, food: 40, uranium: 0 },
    prices: Object.fromEntries(RESOURCES.map((r) => [r, RES_INFO[r].price])) as Record<Res, number>,
    army: { inf: sc?.troops ?? 90, tank: 8, air: 6, navy: 5 }, morale: 1, vet: 0, era: 0, techs: {}, regime: 'republica', tax: 1, debt: 0,
    infamy: 0, bonusIncome: 0, wonders: {}, powers: { bombardeio: 0, escudo: 0, paraquedas: 0, satelite: 0, nuclear: 0 }, shield: false,
    para: false, satellite: 0, sanction: 0, countries, rivals, coalition: false, space: 0, threat: null, strike: null, battle: null, news: [],
    crisis: '', vote: null, timers: { market: 12, event: 60, vote: 200, joke: 25, special: 45, revolt: 30, raid: 80 },
    wave: 0, defeated: 0, achievements: [], victories: [], over: null,
    stats: { conquests: 0, battles: 0, defended: 0, recruited: 0, upgrades: 0, techs: 0, spies: 0, trades: 0, gifts: 0, earned: 0, powers: 0, sieges: 0 },
    report: [], storySeen: !sc?.story, seq: 0, buffs: [], scars: [],
  };
  news(`${COUNTRIES[countryId].name} entra na disputa pelo mundo!`);
  save();
  bump();
}
