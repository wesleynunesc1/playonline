import {
  ANNEX_REACH, Bonus, BonusKey, DEV_S, ERAS, MAX_DEV, POWER_ERA, REL, ULTIMATUM_S, UNIT_ERA, WORKS_ERA, annexCost, annexTime, devCost, CAPTURE_RADIUS, CAPTURE_S, CITIES, CITY, CITY_INDEX, COLORS, DOME_COOL, DOME_RADIUS, EVENTS, LANDMARKS, ModeId, NUKES, POWERS, QUESTS, STARS, STAR_BONUS, PowerId, REGION_BONUS, RESEARCH, Shot, Stat, UNITS, UNIT_IDS,
  UnitId, WORKS, WorksDef, WorksId, cityFuel, cityGun, cityHp, cityIncome, researchCost, slotsOf, unitCap,
} from './data';

/** Simulação da guerra. Roda só no aparelho do criador da sala, em passos de 0,1 s. */
export const STEP = 0.1;
export interface Player {
  i: number; name: string; emblem: string; color: string; team: number; bot: number; online: boolean; start: number; alive: boolean;
  money: number; fuel: number; res: Record<string, number>; cool: Partial<Record<PowerId, number>>; stats: Partial<Record<Stat, number>>; hold: number; quests: string[]; era: number;
}
export interface Works { k: WorksId; left: number; cool: number }
export interface CityState { id: number; x: number; z: number; owner: number; hp: number; max: number; cap: number; capBy: number; works: Works[]; q: { u: UnitId; left: number }[]; rx: number; rz: number; off: number; cool: number; hit: number; loop: UnitId | ''; dev: number; devLeft: number; deal: { by: number; left: number } | null; ruin: number }
export interface Unit { i: number; k: UnitId; o: number; x: number; z: number; hp: number; max: number; tx: number; tz: number; go: 0 | 1 | 2; cool: number; off: number; dir: number; hit: number; kills: number; star: number; aim: number }
/** Efeito visual: tipo, origem, destino */
export type Fx = [kind: string, x1: number, z1: number, x2: number, z2: number, air?: number];
export interface Zone { k: PowerId; o: number; x: number; z: number; left: number; tick: number }
/** Área contaminada */
export interface Rad { x: number; z: number; r: number; left: number }
export interface World {
  rads: Rad[];
  /** Relação entre cada par de jogadores (REL), em matriz simétrica */
  rel: number[];
  offers: { a: number; b: number; k: number; left: number }[];
  ult: { a: number; b: number; left: number }[];
  t: number; left: number; mode: ModeId; rules: string[]; players: Player[]; cities: CityState[]; units: Unit[]; zones: Zone[]; fx: Fx[]; log: { t: string; k: string }[]; seq: number;
  event: { i: number; left: number } | null; nextEvent: number; over: { rank: number[]; title: string } | null;
}
export interface Setup { name: string; emblem: string; start: number; bot: number }
export type Cmd =
  | { c: 'move'; u: number[]; x: number; z: number; hold?: boolean; hit?: boolean }
  | { c: 'stop'; u: number[] }
  | { c: 'build'; city: number; k: WorksId }
  | { c: 'sell'; city: number; n: number }
  | { c: 'train'; city: number; k: UnitId; n?: number }
  | { c: 'cancel'; city: number }
  | { c: 'rally'; city: number; x: number; z: number }
  | { c: 'power'; k: PowerId; x: number; z: number }
  | { c: 'dev'; city: number }
  | { c: 'annex'; city: number }
  | { c: 'era' }
  | { c: 'dip'; to: number; k: 'guerra' | 'paz' | 'comercio' | 'alianca' | 'romper' }
  | { c: 'answer'; from: number; yes: boolean }
  | { c: 'loop'; city: number; k: UnitId }
  | { c: 'research'; id: string };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
export const hasRule = (w: World, r: string) => w.rules.includes(r);
export const relOf = (w: World, a: number, b: number) => w.rel[a * w.players.length + b] ?? REL.paz;
const setRel = (w: World, a: number, b: number, k: number) => {
  w.rel[a * w.players.length + b] = w.rel[b * w.players.length + a] = k;
};
const sameTeam = (w: World, a: number, b: number) => a === b || w.players[a].team === w.players[b].team;
export const allied = (w: World, a: number, b: number) => a === b || (a >= 0 && b >= 0 && (sameTeam(w, a, b) || relOf(w, a, b) === REL.alianca));
/** Só há combate entre quem está em guerra (cidades neutras podem ser atacadas) */
export const hostile = (w: World, a: number, b: number) => a !== b && (a < 0 || b < 0 || (!sameTeam(w, a, b) && relOf(w, a, b) === REL.guerra));
export const atWar = (w: World, i: number) => w.players.some((p) => p.alive && p.i !== i && hostile(w, i, p.i));
export const cityAt = (w: World, id: number) => w.cities[CITY_INDEX[id]];
export const citiesOf = (w: World, i: number) => w.cities.filter((c) => c.owner === i);
export const popOf = (w: World, i: number) => citiesOf(w, i).reduce((s, c) => s + CITY[c.id].pop, 0);

export function createWorld(list: Setup[], mode: ModeId, minutes: number, rules: string[]): World {
  const humans = list.filter((p) => !p.bot).length;
  const w: World = {
    rads: [], rel: [], offers: [], ult: [], t: 0, left: minutes ? minutes * 60 : 1e7, mode, rules, units: [], zones: [], fx: [], log: [], seq: 0, event: null, nextEvent: 70, over: null,
    players: list.map((p, i) => ({
      i, name: p.name, emblem: p.emblem, color: COLORS[i % COLORS.length], bot: p.bot, online: true, start: p.start, alive: true, hold: 0, quests: [], era: rules.includes('avancado') ? 3 : 1,
      team: mode === 'equipes' ? i % 2 : mode === 'coop' ? (p.bot ? 100 : 0) : i + 10,
      money: rules.includes('rico') ? 6000 : 1200, fuel: rules.includes('rico') ? 2000 : 400, res: {}, cool: {}, stats: {},
    })),
    cities: CITIES.map((c) => {
      const max = Math.round(cityHp(c.level) * (rules.includes('fraco') ? 0.5 : rules.includes('forte') ? 2 : 1));
      return { id: c.id, x: c.x, z: c.z, owner: -1, hp: max, max, cap: 0, capBy: -1, works: [], q: [], rx: c.x, rz: c.z, off: 0, cool: 0, hit: 0, loop: '' as const, dev: 0, devLeft: 0, deal: null, ruin: 0 };
    }),
  };
  w.rel = w.players.flatMap((a) => w.players.map((b) => (a.i === b.i ? REL.alianca : rules.includes('guerra') && a.team !== b.team ? REL.guerra : a.team === b.team ? REL.alianca : REL.paz)));
  if (mode === 'coop' && humans === list.length) w.mode = 'dominio';
  for (const p of w.players) {
    if (!cityAt(w, p.start) || (w.mode === 'capital' && p.start === FORTALEZA)) p.start = CITIES.find((c) => c.level === 4 && w.players.every((o) => o.start !== c.id))!.id;
    const c = cityAt(w, p.start);
    Object.assign(c, { owner: p.i, max: Math.max(c.max, 700) });
    c.hp = c.max;
    c.works = ((rules.includes('guerra') ? ['comando', 'quartel', 'mercado', 'refinaria'] : ['comando', 'mercado']) as WorksId[]).map((k) => ({ k, left: 0, cool: 0 }));
    c.rz = c.z + 0.9;
    const army: UnitId[] = [...((rules.includes('guerra') ? ['soldado', 'soldado', 'soldado', 'soldado', 'moto', 'blindado'] : ['soldado', 'soldado', 'moto']) as UnitId[]), ...(rules.includes('exercito') ? (['tanque', 'tanque', 'soldado', 'soldado', 'antitanque', 'artilharia'] as UnitId[]) : [])];
    army.forEach((k, n) => spawn(w, k, p.i, c.x + Math.cos(n * 1.1) * 0.95, c.z + Math.sin(n * 1.1) * 0.95));
  }
  return w;
}
export function spawn(w: World, k: UnitId, o: number, x: number, z: number): Unit {
  const hp = Math.round(UNITS[k].hp * (1 + bonusOf(w, o).armor));
  const u: Unit = { i: ++w.seq, k, o, x, z, hp, max: hp, tx: x, tz: z, go: 0, cool: rand(0, 0.5), off: 0, dir: 0, hit: 0, kills: 0, star: 0, aim: 0 };
  w.units.push(u);
  return u;
}

// ===== Bônus =====
let bonusMemo = new Map<number, { t: number; b: Record<BonusKey, number> }>();
let memoWorld: World | null = null;
export function bonusOf(w: World, i: number): Record<BonusKey, number> {
  if (memoWorld !== w) {
    memoWorld = w;
    bonusMemo = new Map();
  }
  const memo = bonusMemo.get(i);
  if (memo && w.t - memo.t < 1 && w.t >= memo.t) return memo.b;
  const out: Record<BonusKey, number> = { income: 0, fuel: 0, dmg: 0, armor: 0, speed: 0, range: 0, vision: 0, train: 0, cost: 0, city: 0, power: 0, heal: 0 };
  const add = (b: Bonus | undefined, n = 1) => {
    for (const k in b) out[k as BonusKey] += (b[k as BonusKey] ?? 0) * n;
  };
  const p = w.players[i];
  if (p) {
    for (const r of RESEARCH) add(r.per, p.res[r.id] ?? 0);
    const mine = citiesOf(w, i);
    for (const c of mine) add(LANDMARKS[c.id]?.bonus);
    for (const r in REGION_BONUS) if (w.cities.every((c) => CITY[c.id].region !== r || c.owner === i)) add(REGION_BONUS[r]);
    if (w.event) add(EVENTS[w.event.i].bonus);
    if (hasRule(w, 'renda')) out.income += 0.6;
    if (hasRule(w, 'veloz')) out.speed += 0.5;
    if (hasRule(w, 'turbo')) out.train += 1;
    out.cost = Math.min(0.5, out.cost);
    const mod = mods.get(i);
    if (mod) add(mod);
  }
  bonusMemo.set(i, { t: w.t, b: out });
  return out;
}
/** Trapaças do mod menu, por jogador do aparelho que comanda a partida */
export const mods = new Map<number, Bonus & { god?: 1; free?: 1; instant?: 1; nocap?: 1 }>();

export const unitPrice = (w: World, i: number, k: UnitId): [number, number] => {
  const d = UNITS[k];
  if (mods.get(i)?.free) return [0, 0];
  const f = (1 - bonusOf(w, i).cost) * (hasRule(w, 'drones') && d.from === 'drones' ? 0.5 : 1);
  return [Math.round(d.money * f), Math.round(d.fuel * f)];
};
export const worksPrice = (w: World, i: number, k: WorksId): [number, number] => {
  if (mods.get(i)?.free) return [0, 0];
  const f = 1 - bonusOf(w, i).cost;
  return [Math.round(WORKS[k].money * f), Math.round(WORKS[k].fuel * f)];
};
export function incomeOf(w: World, i: number): [number, number] {
  const b = bonusOf(w, i);
  let m = 0;
  let f = 0;
  for (const c of w.cities) {
    // Cidade contaminada não produz
    if (c.owner !== i || irradiated(w, c.x, c.z)) continue;
    const lvl = CITY[c.id].level;
    m += cityIncome(lvl) * (1 + c.dev * 0.5);
    f += cityFuel(lvl) * (1 + c.dev * 0.4);
    for (const k of c.works) {
      if (k.left > 0) continue;
      m += WORKS[k.k].income ?? 0;
      f += WORKS[k.k].fuelOut ?? 0;
    }
  }
  // Cada acordo de comércio ou aliança rende um pouco aos dois
  const trade = 1 + tradesOf(w, i) * 0.08;
  return [Math.max(0, m * (1 + b.income) * trade), Math.max(0, f * (1 + b.fuel) * trade)];
}
export const tradesOf = (w: World, i: number) => w.players.filter((p) => p.i !== i && p.alive && p.team !== w.players[i].team && relOf(w, i, p.i) >= REL.comercio).length;
export const slotsIn = (w: World, c: CityState) => slotsOf(CITY[c.id].level) + c.dev + (w.players[c.owner]?.start === c.id ? 1 : 0);
export const armySize = (w: World, i: number) => w.units.reduce((n, u) => n + (u.o === i ? 1 : 0), 0);
export const armyCap = (w: World, i: number) => (mods.get(i)?.nocap ? 200 : unitCap(citiesOf(w, i).length));
const stat = (p: Player | undefined, s: Stat, n = 1) => {
  if (p) p.stats[s] = (p.stats[s] ?? 0) + n;
};
const say = (w: World, t: string, k = 'info') => {
  w.log = [{ t, k }, ...w.log].slice(0, 12);
};

// ===== Comandos: '' se aceito, ou o motivo =====
export function command(w: World, i: number, cmd: Cmd): string {
  const p = w.players[i];
  if (!p || !p.alive || w.over) return 'Você está fora da partida.';
  const ok = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
  const pay = ([m, f]: [number, number]) => {
    if (p.money < m) return 'Falta dinheiro.';
    if (p.fuel < f) return 'Falta combustível.';
    p.money -= m;
    p.fuel -= f;
    stat(p, 'spent', m);
    return '';
  };
  const own = (id: number) => {
    const c = CITY_INDEX[id] === undefined ? null : cityAt(w, id);
    return c && c.owner === i ? c : null;
  };
  switch (cmd.c) {
    case 'move': {
      if (!ok(cmd.x) || !ok(cmd.z) || !Array.isArray(cmd.u)) return 'Ordem inválida.';
      const ids = new Set(cmd.u.slice(0, 200));
      const list = w.units.filter((u) => u.o === i && ids.has(u.i));
      // Cidade neutra só é atacada por ordem expressa
      const aim = cmd.hit ? w.cities.find((c) => Math.hypot(c.x - cmd.x, c.z - cmd.z) < 0.5)?.id ?? 0 : 0;
      // Formação: lado a lado em volta do ponto
      list.forEach((u, n) => {
        const ring = Math.ceil(Math.sqrt(n));
        const a = n * 2.4;
        const r = n ? 0.22 * ring + 0.05 : 0;
        Object.assign(u, { tx: Math.max(-40, Math.min(40, cmd.x + Math.cos(a) * r)), tz: Math.max(-44, Math.min(44, cmd.z + Math.sin(a) * r)), go: cmd.hold ? 2 : 1, aim });
      });
      return '';
    }
    case 'stop':
      for (const u of w.units) if (u.o === i && Array.isArray(cmd.u) && cmd.u.includes(u.i)) Object.assign(u, { go: 0, tx: u.x, tz: u.z });
      return '';
    case 'build': {
      const c = own(cmd.city);
      const d = WORKS[cmd.k];
      if (!c || !d || cmd.k === 'comando') return 'Cidade inválida.';
      if (CITY[c.id].level < d.level) return `Precisa de cidade tamanho ${d.level}.`;
      if (p.era < WORKS_ERA[cmd.k] && !mods.get(i)?.free) return `Precisa da Era ${WORKS_ERA[cmd.k]}.`;
      if (c.works.length >= slotsIn(w, c)) return 'Cidade cheia. Evolua a cidade para ganhar espaço.';
      if (cmd.k === 'aeroporto' && hasRule(w, 'semar')) return 'Sem aviação nesta partida.';
      const no = pay(worksPrice(w, i, cmd.k));
      if (no) return no;
      c.works.push({ k: cmd.k, left: mods.get(i)?.instant ? 0.1 : d.time / (1 + (hasRule(w, 'turbo') ? 1 : 0)), cool: 0 });
      if (cmd.k === 'gerador') c.max = Math.round(c.max * 2);
      stat(p, 'built');
      return '';
    }
    case 'sell': {
      const c = own(cmd.city);
      const k = c?.works[cmd.n];
      if (!c || !k || k.k === 'comando') return 'Não dá para vender.';
      c.works.splice(cmd.n, 1);
      if (k.k === 'gerador') {
        c.max = Math.round(c.max / 2);
        c.hp = Math.min(c.hp, c.max);
      }
      p.money += Math.round(WORKS[k.k].money * 0.5);
      return '';
    }
    case 'train': {
      const c = own(cmd.city);
      const d = UNITS[cmd.k];
      if (!c || !d) return 'Cidade inválida.';
      if (!c.works.some((k) => k.k === d.from && k.left <= 0)) return `Precisa de ${WORKS[d.from].name}.`;
      if (p.era < UNIT_ERA[cmd.k] && !mods.get(i)?.free) return `Precisa da Era ${UNIT_ERA[cmd.k]}.`;
      const n = Math.max(1, Math.min(10, Math.floor(cmd.n ?? 1)));
      for (let x = 0; x < n; x++) {
        if (armySize(w, i) + w.cities.reduce((s, k) => s + (k.owner === i ? k.q.length : 0), 0) >= armyCap(w, i)) return x ? '' : 'Limite de tropas. Conquiste mais cidades.';
        if (c.q.length >= 12) return x ? '' : 'Fila cheia.';
        const no = pay(unitPrice(w, i, cmd.k));
        if (no) return x ? '' : no;
        c.q.push({ u: cmd.k, left: mods.get(i)?.instant ? 0.1 : d.time });
        stat(p, 'trained');
      }
      return '';
    }
    case 'cancel': {
      const c = own(cmd.city);
      const q = c?.q.pop();
      if (!q) return 'Fila vazia.';
      const [m, f] = unitPrice(w, i, q.u);
      p.money += m;
      p.fuel += f;
      return '';
    }
    case 'rally': {
      const c = own(cmd.city);
      if (!c || !ok(cmd.x) || !ok(cmd.z)) return 'Cidade inválida.';
      c.rx = cmd.x;
      c.rz = cmd.z;
      return '';
    }
    case 'dev': {
      const c = own(cmd.city);
      if (!c) return 'Cidade inválida.';
      if (c.dev >= MAX_DEV) return 'Cidade no máximo.';
      if (c.devLeft > 0) return 'Já está evoluindo.';
      if (p.era < c.dev + 1) return `Precisa da Era ${c.dev + 1}.`;
      const no = pay(mods.get(i)?.free ? [0, 0] : devCost(CITY[c.id].level, c.dev));
      if (no) return no;
      c.devLeft = mods.get(i)?.instant ? 0.1 : DEV_S / (hasRule(w, 'turbo') ? 2 : 1);
      return '';
    }
    case 'annex': {
      const c = CITY_INDEX[cmd.city] === undefined ? null : cityAt(w, cmd.city);
      const no = !c ? 'Cidade inválida.' : annexBlock(w, i, c);
      if (no || !c) return no;
      const cost = pay(mods.get(i)?.free ? [0, 0] : annexCost(CITY[c.id].level, citiesOf(w, i).length));
      if (cost) return cost;
      c.deal = { by: i, left: mods.get(i)?.instant ? 0.1 : annexTime(CITY[c.id].level) };
      return '';
    }
    case 'era': {
      const e = ERAS[p.era];
      if (!e) return 'Você já está na última era.';
      if (citiesOf(w, i).length < e.cities && !mods.get(i)?.free) return `Precisa governar ${e.cities} cidades.`;
      const no = pay(mods.get(i)?.free ? [0, 0] : [e.money, e.fuel]);
      if (no) return no;
      p.era++;
      say(w, `${e.icon} ${p.name} chegou à ${e.name}`, 'event');
      w.fx.push(['era', cityAt(w, p.start).x, cityAt(w, p.start).z, cityAt(w, p.start).x, cityAt(w, p.start).z]);
      return '';
    }
    case 'dip': return diplomacy(w, i, cmd.to, cmd.k);
    case 'answer': {
      const o = w.offers.find((x) => x.a === cmd.from && x.b === i);
      if (!o) return 'A proposta expirou.';
      w.offers = w.offers.filter((x) => x !== o);
      if (cmd.yes) seal(w, o.a, o.b, o.k);
      else say(w, `${p.name} recusou a proposta de ${w.players[o.a].name}`);
      return '';
    }
    case 'loop': {
      const c = own(cmd.city);
      if (!c || !UNITS[cmd.k]) return 'Cidade inválida.';
      c.loop = c.loop === cmd.k ? '' : cmd.k;
      return '';
    }
    case 'research': {
      const r = RESEARCH.find((x) => x.id === cmd.id);
      const lvl = p.res[cmd.id] ?? 0;
      if (!r || lvl >= 3) return 'Pesquisa completa.';
      const no = pay([mods.get(i)?.free ? 0 : researchCost(lvl), 0]);
      if (no) return no;
      p.res[cmd.id] = lvl + 1;
      stat(p, 'research');
      return '';
    }
    case 'power': {
      const d = POWERS[cmd.k];
      if (!d || !ok(cmd.x) || !ok(cmd.z)) return 'Apoio inválido.';
      if (hasRule(w, 'semapoio')) return 'Sem apoios nesta partida.';
      if ((p.cool[cmd.k] ?? 0) > 0) return 'Recarregando.';
      if (HARM.includes(cmd.k)) {
        const r = d.radius + 0.5;
        const at = (o: { x: number; z: number }) => Math.hypot(o.x - cmd.x, o.z - cmd.z) < r;
        const calm = [...w.cities.filter((c) => c.owner >= 0 && at(c)).map((c) => c.owner), ...w.units.filter(at).map((u) => u.o)].find((o) => o !== i && !hostile(w, i, o));
        if (calm !== undefined) return `Você está em paz com ${w.players[calm].name}. Declare guerra antes.`;
      }
      const need = needOf(w, i, cmd.k);
      if (need) return need;
      const no = pay([mods.get(i)?.free ? 0 : d.money, 0]);
      if (no) return no;
      p.cool[cmd.k] = mods.get(i)?.instant ? 1 : d.cool / (1 + Math.max(-0.5, bonusOf(w, i).power));
      stat(p, 'powers');
      firePower(w, i, cmd.k, cmd.x, cmd.z);
      return '';
    }
  }
  return 'Ordem desconhecida.';
}

/** O que falta para usar um apoio; '' quando liberado */
export function needOf(w: World, i: number, k: PowerId): string {
  if (w.players[i].era < POWER_ERA[k] && !mods.get(i)?.free) return `Precisa da Era ${POWER_ERA[k]}.`;
  const n = NUKES[k];
  if (!n) return '';
  if (hasRule(w, 'semnuke')) return 'Armas nucleares proibidas nesta partida.';
  if (mods.get(i)?.free) return '';
  if ((w.players[i].res.nuclear ?? 0) < n.need) return `Pesquise Programa Nuclear nível ${n.need}.`;
  return silosOf(w, i).length ? '' : 'Construa um Silo de Mísseis.';
}
const HARM: PowerId[] = ['barragem', 'aereo', 'emp', 'tatica', 'balistico', 'hidrogenio'];
/** Por que não dá para trazer esta cidade por acordo; '' se dá */
export function annexBlock(w: World, i: number, c: CityState): string {
  if (c.owner >= 0) return 'Essa cidade já tem governo.';
  if (c.deal) return c.deal.by === i ? 'Negociação em andamento.' : `${w.players[c.deal.by].name} já está negociando.`;
  if (c.hp < c.max * 0.9) return 'A cidade está sob ataque.';
  if (!citiesOf(w, i).some((o) => dist(o, c) < ANNEX_REACH)) return 'Longe demais das suas cidades.';
  if (w.cities.filter((o) => o.deal?.by === i).length >= w.players[i].era) return 'Muitas negociações ao mesmo tempo.';
  return '';
}
function diplomacy(w: World, a: number, b: number, k: 'guerra' | 'paz' | 'comercio' | 'alianca' | 'romper'): string {
  const [p, q] = [w.players[a], w.players[b]];
  if (!q || !q.alive || sameTeam(w, a, b)) return 'Jogador inválido.';
  const now = relOf(w, a, b);
  if (k === 'romper') {
    if (now < REL.comercio) return 'Não há acordo.';
    setRel(w, a, b, REL.paz);
    say(w, `${p.name} rompeu o acordo com ${q.name}`, 'alert');
    return '';
  }
  if (k === 'guerra') {
    if (now === REL.guerra) return 'Vocês já estão em guerra.';
    if (now === REL.alianca) return 'Rompa a aliança antes.';
    if (w.ult.some((u) => (u.a === a && u.b === b) || (u.a === b && u.b === a))) return 'Já há um ultimato.';
    w.ult.push({ a, b, left: ULTIMATUM_S });
    say(w, `⚔️ ${p.name} deu um ultimato a ${q.name}: guerra em ${ULTIMATUM_S}s`, 'alert');
    return '';
  }
  const kind = REL[k];
  if ((k === 'paz') !== (now === REL.guerra)) return k === 'paz' ? 'Vocês já estão em paz.' : 'Façam as pazes primeiro.';
  if (now === kind) return 'Esse acordo já existe.';
  if (k === 'alianca' && now !== REL.comercio) return 'Comecem por um acordo de comércio.';
  const back = w.offers.find((o) => o.a === b && o.b === a && o.k === kind);
  if (back) {
    w.offers = w.offers.filter((o) => o !== back);
    seal(w, a, b, kind);
    return '';
  }
  if (w.offers.some((o) => o.a === a && o.b === b)) return 'Espere a resposta.';
  w.offers.push({ a, b, k: kind, left: 45 });
  return '';
}
function seal(w: World, a: number, b: number, k: number) {
  setRel(w, a, b, k);
  w.ult = w.ult.filter((u) => !((u.a === a && u.b === b) || (u.a === b && u.b === a)));
  say(w, `${['🕊️', '', '📦', '🤝'][k]} ${w.players[a].name} e ${w.players[b].name}: ${['paz', '', 'acordo de comércio', 'aliança'][k]}`, 'event');
}
function stepDiplomacy(w: World) {
  for (const o of w.offers) o.left -= STEP;
  w.offers = w.offers.filter((o) => o.left > 0 && w.players[o.a].alive && w.players[o.b].alive);
  for (const u of w.ult) {
    u.left -= STEP;
    if (u.left > 0 || !w.players[u.a].alive || !w.players[u.b].alive) continue;
    setRel(w, u.a, u.b, REL.guerra);
    say(w, `⚔️ Começou a guerra entre ${w.players[u.a].name} e ${w.players[u.b].name}!`, 'alert');
  }
  w.ult = w.ult.filter((u) => u.left > 0);
}
const silosOf = (w: World, i: number) => citiesOf(w, i).filter((c) => c.works.some((k) => k.k === 'silo' && k.left <= 0));

const POWER_SECONDS: Record<PowerId, number> = { barragem: 4.5, aereo: 3.2, fumaca: 9, emp: 0.6, paraquedas: 2, satelite: 15, reparo: 1, tatica: 0, balistico: 0, hidrogenio: 0 };
function firePower(w: World, i: number, k: PowerId, x: number, z: number) {
  const r = POWERS[k].radius;
  const nuke = NUKES[k];
  w.zones.push({ k, o: i, x, z, left: nuke ? nuke.flight + 0.5 : POWER_SECONDS[k], tick: nuke ? nuke.flight : k === 'aereo' ? 1.6 : 0.4 });
  // O míssil sai do silo mais próximo do alvo
  const from = (nuke ? silosOf(w, i) : []).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0] ?? cityAt(w, w.players[i].start);
  w.fx.push([k, from.x, from.z, x, z]);
  if (k === 'emp') {
    for (const u of w.units) if (!allied(w, u.o, i) && UNITS[u.k].cls !== 'inf' && Math.hypot(u.x - x, u.z - z) < r) u.off = 6;
    for (const c of w.cities) if (!allied(w, c.owner, i) && Math.hypot(c.x - x, c.z - z) < r) c.off = 6;
  } else if (k === 'reparo') {
    for (const u of w.units) if (allied(w, u.o, i) && Math.hypot(u.x - x, u.z - z) < r) u.hp = Math.min(u.max, u.hp + u.max * 0.45);
  } else if (nuke) {
    stat(w.players[i], 'nukes');
    say(w, `${POWERS[k].icon} ${w.players[i].name} lançou: ${POWERS[k].name}!`, 'alert');
  }
}

// ===== Dano =====
function hurtUnit(w: World, u: Unit, n: number, by: number, killer?: Unit) {
  if (u.hp <= 0 || mods.get(u.o)?.god) return;
  u.hp -= n;
  u.hit = 1.2;
  stat(w.players[by], 'damage', n);
  if (u.hp > 0) return;
  w.fx.push([UNITS[u.k].cls === 'inf' ? 'baixa' : UNITS[u.k].cls === 'ar' ? 'queda' : 'destroco', UNIT_IDS.indexOf(u.k), u.dir, u.x, u.z]);
  stat(w.players[u.o], 'lost');
  if (killer && ++killer.kills >= (STARS[killer.star] ?? 1e9)) {
    killer.star++;
    const up = Math.round(UNITS[killer.k].hp * STAR_BONUS);
    killer.max += up;
    killer.hp += up;
    w.fx.push(['estrela', killer.x, killer.z, killer.x, killer.z]);
  }
  const p = w.players[by];
  stat(p, 'kills');
  if (UNITS[u.k].cls === 'ar') stat(p, 'air');
  if (u.k === 'tanque') stat(p, 'tanks');
}
function hurtCity(w: World, c: CityState, n: number, by: number) {
  if (c.owner >= 0 && mods.get(c.owner)?.god) return;
  const armor = c.owner >= 0 ? 1 + Math.max(-0.5, bonusOf(w, c.owner).city) : 1;
  c.hp = Math.max(0, c.hp - n / armor);
  c.ruin = Math.min(1, c.ruin + (n / c.max) * 0.45);
  c.deal = null;
  c.hit = 4;
  stat(w.players[by], 'damage', n);
}
function blast(w: World, by: number, x: number, z: number, r: number, dmg: [number, number, number], city: number, friendly = false, killer?: Unit) {
  for (const u of w.units) {
    if (u.hp <= 0 || (!friendly && allied(w, u.o, by))) continue;
    const d = Math.hypot(u.x - x, u.z - z);
    if (d < r) hurtUnit(w, u, dmg[UNITS[u.k].cls === 'inf' ? 0 : UNITS[u.k].cls === 'vei' ? 1 : 2] * (1 - (d / r) * 0.5), by, killer);
  }
  if (city > 0) for (const c of w.cities) if (!allied(w, c.owner, by) && Math.hypot(c.x - x, c.z - z) < r + 0.5) hurtCity(w, c, city, by);
}

// ===== Passo =====
const CELL = 4;
export function step(w: World) {
  if (w.over) return;
  w.t += STEP;
  w.left = Math.max(0, w.left - STEP);
  const grid = new Map<number, Unit[]>();
  const key = (x: number, z: number) => Math.floor((x + 60) / CELL) * 1000 + Math.floor((z + 60) / CELL);
  for (const u of w.units) {
    const k = key(u.x, u.z);
    const cell = grid.get(k);
    if (cell) cell.push(u);
    else grid.set(k, [u]);
  }
  const near = (x: number, z: number, r: number, fn: (u: Unit, d: number) => void) => {
    for (let gx = Math.floor((x - r + 60) / CELL); gx <= Math.floor((x + r + 60) / CELL); gx++) {
      for (let gz = Math.floor((z - r + 60) / CELL); gz <= Math.floor((z + r + 60) / CELL); gz++) {
        for (const u of grid.get(gx * 1000 + gz) ?? []) {
          if (u.hp <= 0) continue;
          const d = Math.hypot(u.x - x, u.z - z);
          if (d <= r) fn(u, d);
        }
      }
    }
  };
  const smoked = (x: number, z: number) => w.zones.some((s) => s.k === 'fumaca' && Math.hypot(s.x - x, s.z - z) < POWERS.fumaca.radius);

  for (const p of w.players) {
    if (!p.alive) continue;
    const [m, f] = incomeOf(w, p.i);
    p.money += m * STEP;
    p.fuel += f * STEP;
    stat(p, 'earned', m * STEP);
    for (const k in p.cool) p.cool[k as PowerId] = Math.max(0, (p.cool[k as PowerId] ?? 0) - STEP);
  }
  stepZones(w);
  stepDiplomacy(w);
  if (w.rads.length) stepRads(w, near);
  if (Math.round(w.t / STEP) % 10 === 0) stepQuests(w);
  for (const u of w.units) stepUnit(w, u, near, smoked);
  for (const c of w.cities) stepCity(w, c, near, smoked);
  w.units = w.units.filter((u) => u.hp > 0);
  stepEvents(w);
  checkEnd(w);
}
type Near = (x: number, z: number, r: number, fn: (u: Unit, d: number) => void) => void;

function stepUnit(w: World, u: Unit, near: Near, smoked: (x: number, z: number) => boolean) {
  if (u.hp <= 0) return;
  u.cool -= STEP;
  u.hit = Math.max(0, u.hit - STEP);
  if (u.off > 0) {
    u.off -= STEP;
    return;
  }
  const d = UNITS[u.k];
  const b = bonusOf(w, u.o);
  const range = d.range * (1 + (d.range > 0.5 ? Math.max(-0.3, b.range) : 0));
  if (d.heal && u.cool <= 0) {
    u.cool = d.every;
    near(u.x, u.z, range, (o) => {
      if (o !== u && allied(w, o.o, u.o) && UNITS[o.k].cls === 'inf') o.hp = Math.min(o.max, o.hp + d.heal! * (1 + b.heal));
    });
  }
  if (d.jam) near(u.x, u.z, range, (o) => { if (hostile(w, o.o, u.o) && (o.k === 'fpv' || o.k === 'recon')) hurtUnit(w, o, 26 * STEP, u.o); });

  // Alvo: o mais vantajoso ao alcance
  let foe: Unit | null = null;
  let town: CityState | null = null;
  let best = 0;
  const armed = d.dmg[0] + d.dmg[1] + d.dmg[2] > 0;
  const look = d.suicide ? 1.6 : range;
  if (armed) {
    near(u.x, u.z, look, (o, k) => {
      if (!hostile(w, o.o, u.o) || (d.min && k < d.min) || smoked(o.x, o.z)) return;
      const cls = UNITS[o.k].cls;
      const dmg = d.dmg[cls === 'inf' ? 0 : cls === 'vei' ? 1 : 2];
      if (dmg <= 0) return;
      const score = (Math.min(dmg, o.hp + 1) / (k + 0.4)) * (UNITS[o.k].dmg[0] + UNITS[o.k].dmg[1] > 0 ? 1.4 : 1);
      if (score > best) {
        best = score;
        foe = o;
      }
    });
    if (!foe) {
      for (const c of w.cities) {
        if (!hostile(w, c.owner, u.o) || c.hp <= 0) continue;
        const k = dist(u, c);
        if (k <= look + 0.35 && !(d.min && k < d.min) && (!town || k < dist(u, town))) town = c;
      }
      const t = town as CityState | null;
      if (t && t.owner < 0 && u.aim !== t.id) town = u.aim && cityAt(w, u.aim).owner < 0 && cityAt(w, u.aim).hp > 0 && dist(u, cityAt(w, u.aim)) <= look + 0.35 ? cityAt(w, u.aim) : null;
    }
  }
  const target = (foe ?? town) as { x: number; z: number } | null;
  if (target && u.go !== 2) {
    u.dir = Math.atan2(target.z - u.z, target.x - u.x);
    if (d.suicide) {
      const k = dist(u, target);
      if (k > range) {
        advance(u, target.x, target.z, d.speed * 1.3 * (1 + b.speed));
        return;
      }
      w.fx.push(['bum', u.x, u.z, target.x, target.z]);
      const dmg = d.dmg.map((x) => x * (1 + b.dmg)) as [number, number, number];
      blast(w, u.o, target.x, target.z, d.splash!, dmg, town ? 70 : 0);
      stat(w.players[u.o], 'drones');
      u.hp = 0;
      w.fx.push(['bum', u.x, u.z, u.x, u.z]);
      return;
    }
    if (u.cool <= 0) {
      u.cool = d.every * rand(0.9, 1.1);
      const mult = (1 + b.dmg) * (1 + u.star * STAR_BONUS);
      const air = foe && UNITS[(foe as Unit).k].cls === 'ar' ? 1 : 0;
      w.fx.push([d.shot, u.x, u.z, target.x + rand(-0.1, 0.1), target.z + rand(-0.1, 0.1), (d.cls === 'ar' ? 2 : 0) + air]);
      if (foe) {
        const f = foe as Unit;
        const cls = UNITS[f.k].cls;
        if (d.splash) blast(w, u.o, f.x, f.z, d.splash, d.dmg.map((x) => x * mult) as [number, number, number], 0, false, u);
        else hurtUnit(w, f, d.dmg[cls === 'inf' ? 0 : cls === 'vei' ? 1 : 2] * mult, u.o, u);
      } else hurtCity(w, town!, Math.max(d.dmg[0] * 0.5, d.dmg[1]) * mult, u.o);
    }
    // Aviões não param; o resto luta parado (ordem de avanço)
    if (u.k !== 'caca') return;
  }
  if (u.go) {
    const k = Math.hypot(u.tx - u.x, u.tz - u.z);
    if (k < 0.12) {
      u.go = 0;
      return;
    }
    u.dir = Math.atan2(u.tz - u.z, u.tx - u.x);
    advance(u, u.tx, u.tz, d.speed * Math.max(0.3, 1 + b.speed));
  }
  // Afasta quem está grudado
  near(u.x, u.z, 0.2, (o, k) => {
    if (o === u || (UNITS[o.k].cls === 'ar') !== (d.cls === 'ar')) return;
    const push = (0.2 - k) * 0.25;
    const a = k > 0.001 ? Math.atan2(u.z - o.z, u.x - o.x) : u.i;
    u.x += Math.cos(a) * push;
    u.z += Math.sin(a) * push;
  });
}
function advance(u: Unit, x: number, z: number, speed: number) {
  const a = Math.atan2(z - u.z, x - u.x);
  const s = Math.min(speed * STEP, Math.hypot(x - u.x, z - u.z));
  u.x += Math.cos(a) * s;
  u.z += Math.sin(a) * s;
  u.dir = a;
}

function shootFrom(w: World, c: CityState, gun: NonNullable<WorksDef['gun']>, near: Near, smoked: (x: number, z: number) => boolean): boolean {
  let foe: Unit | null = null;
  let best = 1e9;
  // Cidade neutra só reage a quem a ataca
  if (c.owner < 0 && !c.hit) return false;
  near(c.x, c.z, gun.range, (o, k) => {
    if (!hostile(w, o.o, c.owner) || smoked(o.x, o.z)) return;
    const cls = UNITS[o.k].cls;
    if (gun.dmg[cls === 'inf' ? 0 : cls === 'vei' ? 1 : 2] <= 0 || o.k === 'recon' || k >= best) return;
    best = k;
    foe = o;
  });
  if (!foe) return false;
  const f = foe as Unit;
  const cls = UNITS[f.k].cls;
  const mult = c.owner >= 0 ? 1 + bonusOf(w, c.owner).dmg : 1;
  w.fx.push([gun.shot, c.x + rand(-0.4, 0.4), c.z + rand(-0.4, 0.4), f.x, f.z, cls === 'ar' ? 1 : 0]);
  if (gun.splash) blast(w, c.owner, f.x, f.z, gun.splash, gun.dmg.map((x) => x * mult) as [number, number, number], 0);
  else hurtUnit(w, f, gun.dmg[cls === 'inf' ? 0 : cls === 'vei' ? 1 : 2] * mult, c.owner);
  return true;
}
function stepCity(w: World, c: CityState, near: Near, smoked: (x: number, z: number) => boolean) {
  c.hit = Math.max(0, c.hit - STEP);
  c.off = Math.max(0, c.off - STEP);
  if (!c.hit && c.hp < c.max && !irradiated(w, c.x, c.z)) c.hp = Math.min(c.max, c.hp + c.max * 0.012 * STEP);
  const lvl = CITY[c.id].level;
  const owner = w.players[c.owner];
  if (c.off <= 0 && c.hp > 0) {
    c.cool -= STEP;
    if (c.cool <= 0 && shootFrom(w, c, cityGun(lvl)!, near, smoked)) c.cool = 0.9;
    for (const k of c.works) {
      const gun = WORKS[k.k].gun;
      if (!gun || k.left > 0) continue;
      if (k.cool <= 0 && shootFrom(w, c, gun, near, smoked)) k.cool = gun.every;
    }
  }
  if (!c.hit) c.ruin = Math.max(0, c.ruin - 0.006 * STEP * (c.owner >= 0 ? 2 : 1));
  if (c.devLeft > 0 && (c.devLeft -= STEP) <= 0) {
    c.devLeft = 0;
    c.dev++;
    c.hp = Math.round(c.hp * 1.15);
    c.max = Math.round(c.max * 1.15);
    stat(w.players[c.owner], 'dev');
    w.fx.push(['evolui', c.x, c.z, c.x, c.z]);
  }
  if (c.deal && (!w.players[c.deal.by].alive || c.owner >= 0)) c.deal = null;
  if (c.deal && (c.deal.left -= STEP) <= 0) {
    const by = c.deal.by;
    Object.assign(c, { owner: by, deal: null, rx: c.x, rz: c.z + 0.9 });
    stat(w.players[by], 'annex');
    w.fx.push(['tomada', c.x, c.z, c.x, c.z]);
    say(w, `🤝 ${CITY[c.id].name} entrou para o governo de ${w.players[by].name}`);
  }
  for (const k of c.works) k.cool = Math.max(0, k.cool - STEP);
  for (const k of c.works) if (k.left > 0) k.left = Math.max(0, k.left - STEP);
  if (owner) {
    const b = bonusOf(w, c.owner);
    if (c.loop && !c.q.length) {
      // Produção contínua: só treina de novo quando dá para pagar
      const [m, f] = unitPrice(w, c.owner, c.loop);
      if (owner.money >= m && owner.fuel >= f) command(w, c.owner, { c: 'train', city: c.id, k: c.loop });
    }
    if (c.q.length && c.off <= 0) {
      const q = c.q[0];
      q.left -= STEP * (1 + Math.max(-0.5, b.train));
      if (q.left <= 0) {
        c.q.shift();
        const a = rand(0, 6.28);
        const u = spawn(w, q.u, c.owner, c.x + Math.cos(a) * 0.75, c.z + Math.sin(a) * 0.75);
        if (Math.hypot(c.rx - c.x, c.rz - c.z) > 1.2) Object.assign(u, { tx: c.rx + rand(-0.4, 0.4), tz: c.rz + rand(-0.4, 0.4), go: 1 });
      }
    }
    if (c.works.some((k) => k.k === 'hospital' && k.left <= 0)) near(c.x, c.z, 1.6, (u) => { if (allied(w, u.o, c.owner)) u.hp = Math.min(u.max, u.hp + u.max * 0.04 * (1 + b.heal) * STEP); });
  }
  // Tomada: defesa zerada e tropa terrestre no centro
  if (c.hp > 0) {
    c.cap = Math.max(0, c.cap - STEP);
    return;
  }
  let taker = -1;
  let contested = false;
  near(c.x, c.z, CAPTURE_RADIUS, (u) => {
    if (!UNITS[u.k].captures) return;
    if (c.owner >= 0 && !hostile(w, u.o, c.owner)) contested ||= allied(w, u.o, c.owner);
    else if (taker < 0) taker = u.o;
    else if (hostile(w, taker, u.o)) contested = true;
  });
  if (taker < 0 || contested) {
    c.cap = Math.max(0, c.cap - STEP);
    if (!c.hit && taker < 0) c.hp = 1;
    return;
  }
  if (c.capBy !== taker) c.cap = 0;
  c.capBy = taker;
  c.cap += STEP;
  if (c.cap < CAPTURE_S) return;
  const before = c.owner;
  if (before >= 0) stat(w.players[before], 'lostCities');
  stat(w.players[taker], 'caps');
  Object.assign(c, { owner: taker, cap: 0, capBy: -1, q: [], loop: '', devLeft: 0, hp: c.max * 0.35, rx: c.x, rz: c.z + 0.9 });
  c.works = c.works.filter((k) => k.k !== 'comando').slice(0, Math.max(0, c.works.length - 1));
  w.players[taker].money += 80 * lvl;
  w.fx.push(['tomada', c.x, c.z, c.x, c.z]);
  say(w, `${w.players[taker].emblem} ${w.players[taker].name} tomou ${CITY[c.id].name}${before >= 0 ? ` de ${w.players[before].name}` : ''}`, before >= 0 ? 'alert' : 'info');
  if (before >= 0 && !citiesOf(w, before).length) eliminate(w, before, taker);
}
function eliminate(w: World, i: number, by: number) {
  const p = w.players[i];
  p.alive = false;
  for (const u of w.units) if (u.o === i) u.hp = 0;
  say(w, `💀 ${p.name} foi eliminado${by >= 0 ? ` por ${w.players[by].name}` : ''}!`, 'alert');
}

function stepZones(w: World) {
  for (const z of w.zones) {
    z.left -= STEP;
    z.tick -= STEP;
    if (z.tick > 0) continue;
    const r = POWERS[z.k].radius;
    const mult = 1 + bonusOf(w, z.o).dmg;
    if (z.k === 'barragem') {
      z.tick = 0.3;
      const x = z.x + rand(-r, r) * 0.8;
      const y = z.z + rand(-r, r) * 0.8;
      w.fx.push(['bum', x, y, x, y]);
      blast(w, z.o, x, y, 0.75, [46 * mult, 42 * mult, 0], 38, true);
    } else if (z.k === 'aereo') {
      z.tick = 0.16;
      const x = z.x + rand(-r, r) * 0.9;
      const y = z.z + rand(-r, r) * 0.5;
      w.fx.push(['bum', x, y, x, y]);
      blast(w, z.o, x, y, 0.85, [70 * mult, 64 * mult, 0], 42, true);
    } else if (z.k === 'paraquedas') {
      z.tick = 99;
      for (let i = 0; i < 5; i++) spawn(w, 'soldado', z.o, z.x + rand(-0.5, 0.5), z.z + rand(-0.5, 0.5));
    } else if (NUKES[z.k]) {
      z.tick = 99;
      detonate(w, z);
    } else z.tick = 99;
  }
  w.zones = w.zones.filter((z) => z.left > 0);
}
function detonate(w: World, z: Zone) {
  const n = NUKES[z.k]!;
  const r = POWERS[z.k].radius;
  const dome = w.cities.find((c) => c.owner >= 0 && hostile(w, c.owner, z.o) && c.off <= 0 && Math.hypot(c.x - z.x, c.z - z.z) < DOME_RADIUS && c.works.some((k) => k.k === 'domo' && k.left <= 0 && k.cool <= 0));
  if (dome) {
    dome.works.find((k) => k.k === 'domo' && k.left <= 0 && k.cool <= 0)!.cool = DOME_COOL;
    w.fx.push(['interceptado', dome.x, dome.z, z.x, z.z]);
    return say(w, `🔰 O domo de ${CITY[dome.id].name} derrubou o míssil!`, 'alert');
  }
  w.fx.push(['nuclear', n.size, 0, z.x, z.z]);
  blast(w, z.o, z.x, z.z, r, [n.dmg, n.dmg * 0.9, n.dmg * 0.4], n.dmg, true);
  // Construções perto do centro são destruídas
  for (const c of w.cities) {
    if (Math.hypot(c.x - z.x, c.z - z.z) > r * 0.6 || (c.owner >= 0 && mods.get(c.owner)?.god)) continue;
    c.works = c.works.filter((k) => k.k === 'comando' || Math.random() > 0.6);
    c.q = [];
    c.ruin = 1;
  }
  w.rads.push({ x: z.x, z: z.z, r: r * 0.9, left: n.rad });
}
/** Radiação fere quem fica dentro */
function stepRads(w: World, near: Near) {
  for (const a of w.rads) {
    a.left -= STEP;
    near(a.x, a.z, a.r, (u) => hurtUnit(w, u, u.max * (UNITS[u.k].cls === 'inf' ? 0.03 : 0.012) * STEP, -1));
  }
  w.rads = w.rads.filter((a) => a.left > 0);
}
export const irradiated = (w: World, x: number, z: number) => w.rads.some((a) => Math.hypot(a.x - x, a.z - z) < a.r);
export function questValue(w: World, i: number, s: (typeof QUESTS)[number]['stat']): number {
  return s === 'cities' ? citiesOf(w, i).length : s === 'era' ? w.players[i].era : s === 'trades' ? tradesOf(w, i) : s === 'army' ? armySize(w, i) : w.players[i].stats[s] ?? 0;
}
function stepQuests(w: World) {
  for (const p of w.players) {
    if (!p.alive) continue;
    for (const q of QUESTS) {
      if (p.quests.includes(q.id) || questValue(w, p.i, q.stat) < q.n) continue;
      p.quests = [...p.quests, q.id];
      p.money += q.money;
      p.fuel += q.fuel;
    }
  }
}
function stepEvents(w: World) {
  if (w.event && (w.event.left -= STEP) <= 0) w.event = null;
  w.nextEvent -= STEP;
  if (w.nextEvent > 0) return;
  w.nextEvent = hasRule(w, 'caos') ? 60 : 120;
  const i = Math.floor(Math.random() * EVENTS.length);
  const e = EVENTS[i];
  if (e.gift) for (const p of w.players) if (p.alive) {
    p.money += e.gift[0];
    p.fuel += e.gift[1];
  }
  if (e.seconds) w.event = { i, left: e.seconds };
  say(w, `${e.icon} ${e.name}: ${e.text}`, 'event');
}

export function scoreOf(w: World, i: number): number {
  if (w.mode === 'capital') return Math.floor(w.players[i].hold);
  const team = w.mode === 'equipes' || w.mode === 'coop';
  return w.players.filter((p) => (team ? p.team === w.players[i].team : p.i === i)).reduce((s, p) => s + popOf(w, p.i), 0);
}
const FORTALEZA = 2304400;
function checkEnd(w: World) {
  const king = cityAt(w, FORTALEZA).owner;
  if (w.mode === 'capital' && king >= 0) w.players[king].hold += STEP;
  const alive = w.players.filter((p) => p.alive);
  const teams = new Set(alive.map((p) => p.team));
  const held = w.mode === 'capital' && w.players.some((p) => p.hold >= 180);
  if (w.left > 0 && teams.size > 1 && !held) return;
  const rank = [...w.players].sort((a, b) => Number(b.alive) - Number(a.alive) || scoreOf(w, b.i) - scoreOf(w, a.i) || popOf(w, b.i) - popOf(w, a.i)).map((p) => p.i);
  const first = w.players[rank[0]];
  w.over = {
    rank,
    title: w.mode === 'coop' ? (first.bot ? 'A máquina venceu!' : 'Os humanos venceram!') : w.mode === 'equipes' ? `Time ${first.team ? 'B' : 'A'} venceu!` : `${first.name} venceu!`,
  };
}

// ===== Visão =====
/** Círculos que o jogador (e seu time) enxerga */
export function eyes(w: World, i: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  const v = 1 + Math.max(-0.6, bonusOf(w, i).vision);
  for (const u of w.units) if (allied(w, u.o, i)) out.push([u.x, u.z, UNITS[u.k].vision * v]);
  for (const c of w.cities) {
    if (c.owner < 0 || !allied(w, c.owner, i)) continue;
    const extra = c.works.some((k) => k.k === 'radar' && k.left <= 0) ? 5 : c.works.some((k) => k.k === 'vigia' && k.left <= 0) ? 1.5 : 0;
    out.push([c.x, c.z, (2.6 + extra) * v]);
  }
  for (const z of w.zones) if (z.k === 'satelite' && allied(w, z.o, i)) out.push([z.x, z.z, POWERS.satelite.radius]);
  return out;
}

// ===== Pacotes para a rede =====
const SMALL = { bala: 1, canhao: 1, missil: 1, baixa: 1 };
const r2 = (n: number) => Math.round(n * 100) / 100;
export type Pack = { t: number; l: number; u: number[]; fx: Fx[]; z: Zone[]; r: Rad[]; full?: Full };
export interface Full { rel: number[]; offers: World['offers']; ult: World['ult']; cities: unknown[]; players: Player[]; log: World['log']; event: World['event']; over: World['over'] }
export function pack(w: World, full: boolean): Pack {
  const u: number[] = [];
  for (const x of w.units) u.push(x.i, UNIT_IDS.indexOf(x.k), x.o, Math.round(x.x * 100), Math.round(x.z * 100), Math.max(1, Math.round((x.hp / x.max) * 100)), Math.round(x.dir * 50), x.go, (x.off > 0 ? 1 : 0) + x.star * 2);
  return {
    t: r2(w.t), l: Math.round(w.left), u, z: w.zones.map((z) => ({ ...z, x: r2(z.x), z: r2(z.z), left: r2(z.left), tick: r2(z.tick) })),
    r: w.rads.map((a) => ({ x: r2(a.x), z: r2(a.z), r: r2(a.r), left: Math.ceil(a.left) })),
    // Tiros podem ser cortados se houver demais; explosões e apoios vão sempre
    fx: [...w.fx.filter((f) => f[0] in SMALL).slice(-70), ...w.fx.filter((f) => !(f[0] in SMALL)).slice(-120)].map((f) => [f[0], r2(f[1]), r2(f[2]), r2(f[3]), r2(f[4]), f[5] ?? 0] as Fx),
    ...(full ? {
      full: {
        cities: w.cities.map((c) => [c.owner, Math.round((c.hp / c.max) * 100), c.max, r2(c.cap), c.capBy, c.works.map((k) => [k.k, Math.ceil(k.left), Math.ceil(k.cool)]), c.q.map((q) => [q.u, Math.ceil(q.left)]), r2(c.rx), r2(c.rz), c.off > 0 ? 1 : 0, c.hit > 0 ? 1 : 0, c.loop, c.dev, Math.ceil(c.devLeft), c.deal ? [c.deal.by, Math.ceil(c.deal.left)] : 0, r2(c.ruin)]),
        rel: w.rel, offers: w.offers, ult: w.ult,
        players: w.players.map((p) => ({ ...p, money: Math.floor(p.money), fuel: Math.floor(p.fuel) })), log: w.log, event: w.event, over: w.over,
      },
    } : {}),
  };
}
export function unpack(w: World, p: Pack) {
  w.t = p.t;
  w.left = p.l;
  w.zones = p.z;
  w.rads = p.r;
  w.fx = p.fx;
  const old = new Map(w.units.map((u) => [u.i, u]));
  const units: Unit[] = [];
  for (let n = 0; n + 8 < p.u.length; n += 9) {
    const [i, k, o, x, z, hp, dir, go, off] = p.u.slice(n, n + 9);
    const kind = UNIT_IDS[k];
    if (!kind || !w.players[o]) continue;
    const u = old.get(i) ?? ({ i, k: kind, o, tx: 0, tz: 0, cool: 0, hit: 0, max: 100 } as Unit);
    Object.assign(u, { k: kind, o, x: x / 100, z: z / 100, hp, max: 100, dir: dir / 50, go: go as 0, off: off & 1, star: off >> 1 });
    units.push(u);
  }
  w.units = units;
  const f = p.full;
  if (!f) return;
  w.players = f.players;
  w.log = f.log;
  w.event = f.event;
  w.over = f.over;
  w.rel = f.rel;
  w.offers = f.offers;
  w.ult = f.ult;
  (f.cities as [number, number, number, number, number, [WorksId, number, number][], [UnitId, number][], number, number, number, number, UnitId | '', number, number, 0 | [number, number], number][]).forEach((c, n) => {
    const s = w.cities[n];
    if (!s) return;
    Object.assign(s, {
      owner: c[0], hp: (c[1] / 100) * c[2], max: c[2], cap: c[3], capBy: c[4], works: c[5].filter((k) => WORKS[k[0]]).map((k) => ({ k: k[0], left: k[1], cool: k[2] })),
      q: c[6].filter((q) => UNITS[q[0]]).map((q) => ({ u: q[0], left: q[1] })), rx: c[7], rz: c[8], off: c[9], hit: c[10], loop: c[11], dev: c[12], devLeft: c[13], deal: c[14] ? { by: c[14][0], left: c[14][1] } : null, ruin: c[15],
    });
  });
}
export { type Shot };
