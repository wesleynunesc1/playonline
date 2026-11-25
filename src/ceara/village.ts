import { useSyncExternalStore } from 'react';
import { BUILDS, BUILD_IDS, BuildId, CITY, GRID, MAX_LEVEL, PROD_CAP_S, TROOPS, TROOP_IDS, TroopId, campAt, produces, storageAt, upCost, upTime } from './content';

/** A vila do jogador: construções, recursos, tropas e salvamento. */
export interface Placed { id: number; b: BuildId; level: number; x: number; y: number; done: number; since: number }
export type Squad = Record<TroopId, number>;
export interface Village {
  v: number; city: number; name: string; clan: string; secret: string; moedas: number; farinha: number; rapadura: number; trophies: number;
  builds: Placed[]; army: Squad; training: { t: TroopId; n: number; ready: number }[]; conquered: Record<number, number>; tribute: number;
  seq: number; wins: number; defenses: number; log: RaidLog[]; shield: number; quests: string[]; saved: number;
}
export interface RaidLog { at: number; by: string; stars: number; moedas: number; farinha: number; trophies: number; mine: boolean }

const KEY = 'PLAY_ONLINE_CEARA';
const read = (): Village | null => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Village | null;
    return v && v.v === 1 && CITY[v.city] ? v : null;
  } catch {
    return null;
  }
};
export let V: Village | null = read();
export const me = () => V!;

let version = 0;
const listeners = new Set<() => void>();
export function touch(store = true) {
  version++;
  if (store && V) {
    V.saved = Date.now();
    try {
      localStorage.setItem(KEY, JSON.stringify(V));
    } catch { /* armazenamento indisponível */ }
  }
  listeners.forEach((l) => l());
}
export const useVillage = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => version);
export const emptySquad = () => Object.fromEntries(TROOP_IDS.map((t) => [t, 0])) as Squad;

const token = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => (b % 36).toString(36)).join('');
export function found(city: number, name: string) {
  const now = Date.now();
  const b = (id: number, kind: BuildId, x: number, y: number): Placed => ({ id, b: kind, level: 1, x, y, done: 0, since: now });
  V = {
    v: 1, city, name, clan: '', secret: token(), moedas: 1200, farinha: 1200, rapadura: 60, trophies: 0,
    builds: [b(1, 'prefeitura', 11, 11), b(2, 'feira', 6, 8), b(3, 'casafarinha', 6, 14), b(4, 'rancho', 17, 8), b(5, 'terreiro', 17, 15), b(6, 'canhao', 12, 7), b(7, 'cofre', 8, 12), b(8, 'celeiro', 12, 17)],
    army: { ...emptySquad(), vaqueiro: 12, rendeira: 4 }, training: [], conquered: {}, tribute: now, seq: 20, wins: 0, defenses: 0, log: [], shield: 0, quests: [], saved: now,
  };
  touch();
}
export function abandon() {
  V = null;
  try {
    localStorage.removeItem(KEY);
  } catch { /* armazenamento indisponível */ }
  touch(false);
}

// ===== Consultas =====
export const hall = (v = me()) => v.builds.find((b) => b.b === 'prefeitura')!.level;
const working = (p: Placed) => p.done > 0;
export const BUILDERS = 2;
export const freeBuilders = () => BUILDERS - me().builds.filter(working).length;
export const countOf = (b: BuildId, v = me()) => v.builds.filter((p) => p.b === b).length;
export const maxOf = (b: BuildId, v = me()) => BUILDS[b].max[hall(v) - 1];
export const capOf = (kind: 'moedas' | 'farinha', v = me()) =>
  2000 + hall(v) * 1500 + v.builds.filter((p) => p.b === (kind === 'moedas' ? 'cofre' : 'celeiro')).reduce((s, p) => s + storageAt(p.level), 0);
export const campSize = (v = me()) => v.builds.filter((p) => p.b === 'terreiro').reduce((s, p) => s + campAt(p.level), 0);
export const spaceUsed = (v = me()) =>
  TROOP_IDS.reduce((s, t) => s + v.army[t] * TROOPS[t].space, 0) + v.training.reduce((s, q) => s + q.n * TROOPS[q.t].space, 0);
export const ranchoLevel = (v = me()) => Math.max(0, ...v.builds.filter((p) => p.b === 'rancho').map((p) => p.level));
export const canTrain = (t: TroopId) => ranchoLevel() >= TROOPS[t].rancho;
export const pending = (p: Placed, now = Date.now()) =>
  p.b === 'feira' || p.b === 'casafarinha' ? (working(p) ? 0 : Math.floor(produces(p.level) * Math.min(PROD_CAP_S, (now - p.since) / 1000))) : 0;
export const tributeRate = () => Object.values(me().conquered).reduce((s, lvl) => s + lvl * 0.12, 0);
export const pendingTribute = (now = Date.now()) => Math.floor(tributeRate() * Math.min(PROD_CAP_S * 2, (now - me().tribute) / 1000));

export function fits(b: BuildId, x: number, y: number, except = 0, builds = me().builds): boolean {
  const s = BUILDS[b].size;
  if (x < 1 || y < 1 || x + s > GRID - 1 || y + s > GRID - 1) return false;
  return builds.every((p) => p.id === except || x + s <= p.x || p.x + BUILDS[p.b].size <= x || y + s <= p.y || p.y + BUILDS[p.b].size <= y);
}
export function findSpot(b: BuildId): { x: number; y: number } | null {
  const mid = GRID / 2;
  let best: { x: number; y: number } | null = null;
  let d = 1e9;
  for (let x = 1; x < GRID; x++) {
    for (let y = 1; y < GRID; y++) {
      const k = Math.hypot(x - mid, y - mid);
      if (k < d && fits(b, x, y)) {
        best = { x, y };
        d = k;
      }
    }
  }
  return best;
}

// ===== Ações: devolvem '' se deu certo ou o motivo da recusa =====
function pay(kind: 'moedas' | 'farinha', n: number): string {
  const v = me();
  if (v[kind] < n) return kind === 'moedas' ? 'Faltam moedas.' : 'Falta farinha.';
  v[kind] -= n;
  return '';
}
export function build(b: BuildId, x: number, y: number): string {
  if (countOf(b) >= maxOf(b)) return 'Limite atingido. Evolua a Prefeitura.';
  if (!fits(b, x, y)) return 'Não cabe aqui.';
  if (b !== 'muro' && freeBuilders() < 1) return 'Todos os pedreiros estão ocupados.';
  const no = pay(BUILDS[b].pay, upCost(b, 1));
  if (no) return no;
  const now = Date.now();
  me().builds.push({ id: ++me().seq, b, level: b === 'muro' ? 1 : 0, x, y, done: b === 'muro' ? 0 : now + upTime(b, 1) * 1000, since: now });
  touch();
  return '';
}
export function move(id: number, x: number, y: number): string {
  const p = me().builds.find((q) => q.id === id);
  if (!p || !fits(p.b, x, y, id)) return 'Não cabe aqui.';
  Object.assign(p, { x, y });
  touch();
  return '';
}
export function upgrade(id: number): string {
  const p = me().builds.find((q) => q.id === id);
  if (!p || working(p)) return 'Já está em obras.';
  if (p.level >= MAX_LEVEL) return 'Nível máximo.';
  if (p.b !== 'prefeitura' && p.level >= hall() + 1) return 'Evolua a Prefeitura primeiro.';
  if (p.b !== 'muro' && freeBuilders() < 1) return 'Todos os pedreiros estão ocupados.';
  const no = pay(BUILDS[p.b].pay, upCost(p.b, p.level + 1));
  if (no) return no;
  if (p.b === 'muro') p.level++;
  else p.done = Date.now() + upTime(p.b, p.level + 1) * 1000;
  touch();
  return '';
}
export const rushCost = (seconds: number) => Math.max(1, Math.ceil(seconds / 20));
export function rush(id: number): string {
  const p = me().builds.find((q) => q.id === id);
  if (!p || !working(p)) return '';
  const cost = rushCost((p.done - Date.now()) / 1000);
  if (me().rapadura < cost) return 'Faltam rapaduras.';
  me().rapadura -= cost;
  p.done = Date.now();
  tick();
  return '';
}
export function collect(): number {
  const v = me();
  const now = Date.now();
  let total = 0;
  const add = (kind: 'moedas' | 'farinha', n: number) => {
    const room = Math.max(0, capOf(kind) - v[kind]);
    const got = Math.min(room, n);
    v[kind] += got;
    total += got;
    return got;
  };
  for (const p of v.builds) {
    const n = pending(p, now);
    if (n < 1) continue;
    const got = add(p.b === 'feira' ? 'moedas' : 'farinha', n);
    // O que não coube continua esperando na construção
    p.since = now - ((n - got) / produces(p.level)) * 1000;
  }
  const t = pendingTribute(now);
  if (t > 0) {
    add('moedas', t);
    v.tribute = now;
  }
  touch();
  return total;
}
export function train(t: TroopId, n = 1): string {
  const v = me();
  if (!canTrain(t)) return `Precisa de Rancho nível ${TROOPS[t].rancho}.`;
  if (spaceUsed() + TROOPS[t].space * n > campSize()) return 'Terreiro cheio.';
  const no = pay('farinha', TROOPS[t].cost * n);
  if (no) return no;
  const ranchos = Math.max(1, countOf('rancho'));
  const last = v.training.length ? v.training[v.training.length - 1].ready : Date.now();
  v.training.push({ t, n, ready: Math.max(last, Date.now()) + (TROOPS[t].time * n * 1000) / ranchos });
  touch();
  return '';
}

/** Conclui obras e treinos vencidos */
export function tick() {
  const v = V;
  if (!v) return;
  const now = Date.now();
  let changed = false;
  for (const p of v.builds) {
    if (!working(p) || p.done > now) continue;
    p.level++;
    p.done = 0;
    p.since = now;
    v.rapadura += 2;
    changed = true;
  }
  while (v.training.length && v.training[0].ready <= now) {
    const q = v.training.shift()!;
    v.army[q.t] += q.n;
    changed = true;
  }
  for (const q of QUESTS) {
    if (v.quests.includes(q.id) || !q.done(v)) continue;
    v.quests.push(q.id);
    v.rapadura += q.prize;
    changed = true;
    events.quest(q.text, q.prize);
  }
  touch(changed);
}
export const events = { quest: (_text: string, _prize: number) => {} };
export const QUESTS: { id: string; text: string; prize: number; done: (v: Village) => boolean }[] = [
  { id: 'q1', text: 'Vença seu primeiro ataque', prize: 10, done: (v) => v.wins >= 1 },
  { id: 'q2', text: 'Construa 10 muros', prize: 10, done: (v) => countOf('muro', v) >= 10 },
  { id: 'q3', text: 'Prefeitura nível 2', prize: 15, done: (v) => hall(v) >= 2 },
  { id: 'q4', text: 'Conquiste 5 cidades', prize: 20, done: (v) => Object.keys(v.conquered).length >= 5 },
  { id: 'q5', text: 'Entre em um clã', prize: 10, done: (v) => !!v.clan },
  { id: 'q6', text: 'Prefeitura nível 4', prize: 40, done: (v) => hall(v) >= 4 },
  { id: 'q7', text: 'Conquiste 25 cidades', prize: 60, done: (v) => Object.keys(v.conquered).length >= 25 },
  { id: 'q8', text: 'Chegue a 500 troféus', prize: 50, done: (v) => v.trophies >= 500 },
  { id: 'q9', text: 'Conquiste 100 cidades', prize: 150, done: (v) => Object.keys(v.conquered).length >= 100 },
  { id: 'q10', text: 'Conquiste as 183 outras cidades', prize: 500, done: (v) => Object.keys(v.conquered).length >= 183 },
];

// ===== Base de qualquer cidade =====
export interface Base { city: number; name: string; builds: Pick<Placed, 'id' | 'b' | 'level' | 'x' | 'y'>[]; moedas: number; farinha: number; level: number; player: boolean; trophies: number }
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Cidade sem jogador: vila gerada pelo tamanho real da população, sempre a mesma */
export function cityBase(city: number): Base {
  const c = CITY[city];
  const r = rng(city);
  const lvl = c.level;
  const builds: Base['builds'] = [];
  let id = 0;
  const mid = GRID / 2 - 2;
  const put = (b: BuildId, x: number, y: number) => {
    if (!fits(b, x, y, 0, builds as Placed[])) return false;
    builds.push({ id: ++id, b, level: Math.max(1, Math.min(6, b === 'muro' ? lvl : lvl - (r() < 0.35 ? 1 : 0))), x, y });
    return true;
  };
  put('prefeitura', mid, mid);
  const ring = 4 + Math.min(3, Math.ceil(lvl / 2));
  const near = (b: BuildId, min: number, max: number) => {
    for (let i = 0; i < 60; i++) {
      const a = r() * Math.PI * 2;
      const d = min + r() * (max - min);
      const s = BUILDS[b].size / 2;
      if (put(b, Math.round(GRID / 2 + Math.cos(a) * d - s), Math.round(GRID / 2 + Math.sin(a) * d - s))) return;
    }
  };
  // Muralha em volta do centro, com falhas nas cidades pequenas
  const lo = GRID / 2 - ring - 1;
  const hi = GRID / 2 + ring;
  const walls: [number, number][] = [];
  for (let i = lo; i <= hi; i++) walls.push([i, lo], [i, hi], [lo, i], [hi, i]);
  let left = BUILDS.muro.max[lvl - 1];
  for (const [x, y] of walls) if (left > 0 && r() > 0.28 - lvl * 0.05 && put('muro', x, y)) left--;
  for (const b of BUILD_IDS) {
    if (b === 'prefeitura' || b === 'muro') continue;
    const n = BUILDS[b].max[lvl - 1];
    const inside = !!BUILDS[b].defense || b === 'cofre' || b === 'celeiro';
    for (let i = 0; i < n; i++) near(b, inside ? 3 : ring + 2, inside ? ring + (i % 2 ? 0 : 3) : 11);
  }
  const loot = Math.round(260 * 1.9 ** (lvl - 1) * (0.8 + r() * 0.5));
  return { city, name: c.name, builds, moedas: loot, farinha: Math.round(loot * (0.7 + r() * 0.5)), level: lvl, player: false, trophies: 0 };
}
/** O que outros jogadores podem ver e saquear desta vila */
export function snapshot(): Base & { clan: string; shield: number; conquered: number } {
  const v = me();
  return {
    city: v.city, name: v.name, clan: v.clan, level: hall(), player: true, trophies: v.trophies, shield: v.shield, conquered: Object.keys(v.conquered).length,
    builds: v.builds.filter((p) => p.level > 0).map(({ id, b, level, x, y }) => ({ id, b, level, x, y })),
    moedas: Math.floor(v.moedas * 0.18), farinha: Math.floor(v.farinha * 0.18),
  };
}

/** Resultado de um ataque feito por este jogador */
export function applyRaid(base: Base, stars: number, loot: { moedas: number; farinha: number }, left: Squad): { moedas: number; farinha: number; trophies: number } {
  const v = me();
  v.army = { ...left };
  const before = { moedas: v.moedas, farinha: v.farinha };
  v.moedas = Math.max(v.moedas, Math.min(capOf('moedas'), v.moedas + loot.moedas));
  v.farinha = Math.max(v.farinha, Math.min(capOf('farinha'), v.farinha + loot.farinha));
  const trophies = base.player ? (stars ? 8 + stars * 8 : -10) : stars ? 2 + stars * 2 : -3;
  v.trophies = Math.max(0, v.trophies + trophies);
  if (stars) v.wins++;
  if (stars === 3 && !base.player && !v.conquered[base.city]) {
    if (!Object.keys(v.conquered).length) v.tribute = Date.now();
    v.conquered[base.city] = base.level;
    v.rapadura += 3;
  }
  v.log = [{ at: Date.now(), by: base.player ? base.name : CITY[base.city].name, stars, ...loot, trophies, mine: true }, ...v.log].slice(0, 30);
  v.shield = 0;
  touch();
  return { moedas: v.moedas - before.moedas, farinha: v.farinha - before.farinha, trophies };
}
/** Ataque sofrido enquanto estava fora (veio da caixa de entrada) */
export function sufferRaid(by: string, stars: number, moedas: number, farinha: number) {
  const v = me();
  const m = Math.min(v.moedas, Math.max(0, moedas));
  const f = Math.min(v.farinha, Math.max(0, farinha));
  v.moedas -= m;
  v.farinha -= f;
  const trophies = stars ? -(4 + stars * 5) : 10;
  v.trophies = Math.max(0, v.trophies + trophies);
  if (!stars) v.defenses++;
  v.shield = Date.now() + (stars ? 30 : 5) * 60_000;
  v.log = [{ at: Date.now(), by, stars, moedas: m, farinha: f, trophies, mine: false }, ...v.log].slice(0, 30);
  touch();
}
export function receiveTroops(t: TroopId, n: number) {
  if (!TROOPS[t]) return;
  me().army[t] += Math.min(5, Math.max(0, Math.floor(n)));
  touch();
}
