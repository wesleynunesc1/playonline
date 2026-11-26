import { create } from 'zustand';
import { sound } from '../utils/audio';
import {
  CASH_SECONDS, EVENTS, EventId, FLOORS, GUESTS, GuestId, OFFLINE_MAX, RIVALS, ROOM, ROOMS, RoomDef, SHOP, STAFF, STAFF_MAX, STARS, StaffId, cityMult, cityName,
} from './data';

/** Economia do Magnata do Cassino. Tudo roda no aparelho e continua rendendo com o app fechado. */
export interface Room { lv: number; cash: number; mgr: boolean }
export interface Casino {
  v: 1; money: number; gems: number; earned: number; city: number; floors: number;
  rooms: Record<string, Room>; staff: Record<StaffId, number>; deco: number; mkt: number; targets: GuestId[];
  dobro: number; event: { id: EventId; left: number; room?: string } | null; nextEvent: number;
  quest: number; beaten: number; collects: number; day: string; streak: number; t: number; played: number;
}
const KEY = 'PLAY_ONLINE_CASSINO';
const fresh = (city = 0, gems = 0, streak = 0, day = ''): Casino => ({
  v: 1, money: 30, gems, earned: 0, city, floors: 1,
  rooms: { recepcao: { lv: 1, cash: 0, mgr: true }, niqueis: { lv: 1, cash: 0, mgr: false } },
  staff: { crupie: 0, garcom: 0, seguranca: 0, limpeza: 0 }, deco: 0, mkt: 0, targets: [],
  dobro: 0, event: null, nextEvent: 60, quest: 0, beaten: 0, collects: 0, day, streak, t: Date.now(), played: 0,
});
export let C: Casino = fresh();
/** Trapaças do mod menu (não ficam salvas) */
export const mod = { income: 1, free: false };

// ===== Fórmulas =====
export const lv = (id: string) => C.rooms[id]?.lv ?? 0;
export const equip = (d: RoomDef, l: number) => (l > 0 ? Math.min(d.max, 1 + Math.floor(l / 5)) : 0);
export const ticket = (d: RoomDef) => Math.max(5, (d.cost / 100) * (d.svc / d.seats));
export const capacity = (d: RoomDef, l: number) => (equip(d, l) * d.seats) / d.svc;
export const roomCost = (d: RoomDef, l: number) => (d.kind === 'lobby' ? 40 * Math.pow(1.17, l) : l === 0 ? d.cost : Math.max(d.cost, 20) * Math.pow(1.15, l));
export const ROOM_MAX = 100;
export const costN = (d: RoomDef, l: number, n: number) => {
  let s = 0;
  for (let i = 0; i < n && l + i < ROOM_MAX; i++) s += roomCost(d, l + i);
  return s;
};
export const mgrCost = (d: RoomDef) => Math.max(400, d.cost * 12);
export const staffCost = (id: StaffId, l: number) => STAFF.find((s) => s.id === id)!.base * Math.pow(1.6, l);
export const decoCost = (l: number) => 800 * Math.pow(1.55, l);
export const mktCost = (l: number) => 600 * Math.pow(1.5, l);
export const UPG_MAX = 40;
export const targetSlots = () => (C.mkt >= 20 ? 3 : C.mkt >= 8 ? 2 : C.mkt >= 1 ? 1 : 0);
export const floorCost = (f: number) => FLOORS[f]?.cost ?? Infinity;
export const levelsSum = () => ROOMS.reduce((s, d) => s + (d.kind === 'lobby' ? 0 : lv(d.id)), 0);
export const stars = () => STARS.filter((t) => levelsSum() >= t).length;
export const rivalFame = (i: number) => RIVALS[i].fame * Math.pow(2, C.city);
export const guestsOpen = () => GUESTS.filter((g) => stars() >= g.stars + 1 || g.stars === 0);

export interface RoomStat { demand: number; cap: number; served: number; income: number; spend: number }
export interface Stats { arrivals: number; sat: number; income: number; rooms: Record<string, RoomStat>; mix: Record<string, number> }
export let S: Stats = { arrivals: 0, sat: 1, income: 0, rooms: {}, mix: {} };

/** Calcula hóspedes, ocupação e lucro de cada sala */
export function compute(): Stats {
  const open = guestsOpen();
  const mix: Record<string, number> = {};
  let tot = 0;
  for (const g of open) tot += mix[g.id] = C.targets.includes(g.id) ? 3 : 1;
  for (const g of open) mix[g.id] /= tot;
  const ev = C.event;
  const sat0 = 1 + 0.03 * (C.staff.seguranca + C.staff.limpeza) + 0.01 * C.deco + (ev?.id === 'festa' ? 0.3 : 0);
  const arrivals = 0.45 * (1 + 0.2 * (lv('recepcao') - 1)) * (1 + 0.05 * C.deco) * (1 + 0.06 * C.mkt) * (ev?.id === 'onibus' ? 2 : 1);
  const rooms: Record<string, RoomStat> = {};
  let want = 0, lost = 0;
  const pass: { d: RoomDef; demand: number; spend: number }[] = [];
  for (const d of ROOMS) {
    if (d.kind === 'lobby' || !lv(d.id)) continue;
    let demand = 0, spend = 0;
    for (const g of open) {
      const p = mix[g.id] * (g.likes.includes(d.id) ? 1 : 0.25);
      demand += p;
      spend += p * g.spend;
    }
    pass.push({ d, demand, spend: demand ? spend / demand : 1 });
  }
  for (const { d, demand } of pass) {
    const cap = capacity(d, lv(d.id));
    want += demand * arrivals;
    lost += Math.max(0, demand * arrivals - cap);
  }
  const sat = Math.min(1.8, Math.max(0.6, sat0 - (want ? (0.3 * lost) / want : 0)));
  let income = 0;
  for (const { d, demand, spend } of pass) {
    const l = lv(d.id);
    const cap = capacity(d, l);
    const dem = demand * arrivals * sat;
    const served = Math.min(dem, cap);
    const staff = 1 + 0.06 * (d.game ? C.staff.crupie : C.staff.garcom);
    const evm = (ev?.id === 'jackpot' && d.kind === 'slots' ? 3 : 1) * (ev?.id === 'torneio' && ev.room === d.id ? 2 : 1);
    const inc = served * ticket(d) * l * Math.pow(2, Math.floor(l / 25)) * spend * staff * cityMult(C.city) * (C.dobro > 0 ? 2 : 1) * evm * mod.income;
    rooms[d.id] = { demand: dem, cap, served, income: inc, spend };
    income += inc;
  }
  return (S = { arrivals: arrivals * sat, sat, income, rooms, mix });
}

// ===== Loja reativa da interface =====
export const useCasino = create<{ v: number; offline: number; toast: string; quest: boolean }>(() => ({ v: 0, offline: 0, toast: '', quest: false }));
const bump = () => useCasino.setState((s) => ({ v: s.v + 1 }));
let toastTimer: ReturnType<typeof setTimeout>;
export function say(text: string) {
  clearTimeout(toastTimer);
  useCasino.setState({ toast: text });
  toastTimer = setTimeout(() => useCasino.setState({ toast: '' }), 3200);
}
/** Ganchos para a cena 3D reagir (dinheiro voando, festa) */
export const fx = { collect: (_id: string, _amount: number) => {}, rebuild: () => {} };

// ===== Ações =====
const pay = (n: number) => {
  if (mod.free) return true;
  if (C.money < n) return false;
  C.money -= n;
  return true;
};
const payGems = (n: number) => {
  if (mod.free) return true;
  if (C.gems < n) return false;
  C.gems -= n;
  return true;
};
export function upgrade(id: string, n: number) {
  const d = ROOM[id];
  const l = lv(id);
  if (d.floor >= C.floors) return say('Abra este andar primeiro');
  const steps = Math.min(n, ROOM_MAX - l);
  if (steps <= 0) return;
  if (!pay(costN(d, l, steps))) return say('Falta dinheiro');
  C.rooms[id] = { lv: l + steps, cash: C.rooms[id]?.cash ?? 0, mgr: C.rooms[id]?.mgr ?? false };
  sound.playBuy();
  if (!l) say(`${d.icon} ${d.name} inaugurado!`);
  done();
}
/** Quantos níveis dá para comprar agora (botão MÁX) */
export function affordable(id: string) {
  const d = ROOM[id];
  let l = lv(id), s = 0, n = 0;
  while (l < ROOM_MAX && n < 100) {
    s += roomCost(d, l);
    if (s > C.money && !mod.free) break;
    l++; n++;
  }
  return n;
}
export function hire(id: string) {
  const d = ROOM[id];
  if (!lv(id) || C.rooms[id].mgr) return;
  if (!pay(mgrCost(d))) return say('Falta dinheiro');
  C.rooms[id].mgr = true;
  collect(id);
  sound.playRecruit();
  say(`🧑‍💼 Gerente cuidando do ${d.name}`);
  done();
}
export function collect(id: string) {
  const r = C.rooms[id];
  if (!r || r.cash < 0.5) return 0;
  const a = r.cash;
  C.money += a;
  C.earned += a;
  r.cash = 0;
  C.collects++;
  fx.collect(id, a);
  sound.playBuy();
  bump();
  return a;
}
export function collectAll() {
  let s = 0;
  for (const id in C.rooms) s += collect(id);
  return s;
}
export function train(id: StaffId) {
  const l = C.staff[id];
  if (l >= STAFF_MAX) return;
  if (!pay(staffCost(id, l))) return say('Falta dinheiro');
  C.staff[id] = l + 1;
  sound.playBuy();
  done();
}
export function decorate() {
  if (C.deco >= UPG_MAX) return;
  if (!pay(decoCost(C.deco))) return say('Falta dinheiro');
  C.deco++;
  sound.playBuy();
  done(true);
}
export function advertise() {
  if (C.mkt >= UPG_MAX) return;
  if (!pay(mktCost(C.mkt))) return say('Falta dinheiro');
  C.mkt++;
  sound.playBuy();
  done();
}
export function toggleTarget(g: GuestId) {
  if (C.targets.includes(g)) C.targets = C.targets.filter((x) => x !== g);
  else if (C.targets.length < targetSlots()) C.targets = [...C.targets, g];
  else return say(targetSlots() ? 'Todas as vagas de campanha estão usadas' : 'Melhore o marketing para fazer campanhas');
  sound.playClick();
  done();
}
export function openFloor() {
  const f = C.floors;
  if (f >= FLOORS.length) return;
  if (!pay(floorCost(f))) return say('Falta dinheiro');
  C.floors++;
  sound.playTechUnlocked();
  say(`🏗️ ${FLOORS[f].name} aberto!`);
  done(true);
}
export function buy(id: (typeof SHOP)[number]['id']) {
  const item = SHOP.find((s) => s.id === id)!;
  if (!payGems(item.gems)) return say('Faltam diamantes');
  if (id === 'dobro') C.dobro += 600;
  if (id === 'onibus') startEvent('onibus');
  if (id === 'festa') startEvent('festa');
  if (id === 'cofre') {
    const a = compute().income * 7200;
    C.money += a;
    C.earned += a;
  }
  sound.playVictory();
  done();
}
export function claimVip() {
  if (C.event?.id !== 'vip') return;
  const a = Math.max(50, compute().income * 60);
  C.money += a;
  C.earned += a;
  C.gems += 1;
  C.event = null;
  sound.playVictory();
  say(`🤩 Gorjeta de ${money(a)} e 1 💎`);
  done();
}
/** Abre um resort novo na próxima cidade: recomeça com lucro multiplicado */
export function moveCity() {
  if (C.beaten < RIVALS.length) return;
  const next = fresh(C.city + 1, C.gems + 25, C.streak, C.day);
  next.quest = C.quest;
  C = next;
  sound.playVictory();
  say(`✈️ Bem-vindo a ${cityName(C.city)}! Tudo rende ${cityMult(C.city)}x`);
  done(true);
}
export function startEvent(id: EventId) {
  const games = ROOMS.filter((d) => d.game && lv(d.id));
  const room = id === 'torneio' ? games[Math.floor(Math.random() * games.length)]?.id : undefined;
  C.event = { id, left: EVENTS[id].time, room };
  sound.playSonar();
  say(`${EVENTS[id].icon} ${EVENTS[id].name}${room ? ' de ' + ROOM[room].name : ''}!`);
  bump();
}

// ===== Missões =====
interface Quest { text: string; need: number; get: () => number; gems: number; cash: number }
const q = (text: string, need: number, get: () => number, gems: number, cash = 0): Quest => ({ text, need, get, gems, cash });
const mgrs = () => ROOMS.filter((d) => d.kind !== 'lobby' && C.rooms[d.id]?.mgr).length;
const QUESTS: Quest[] = [
  q('Melhore o Caça-níqueis ao nível 5', 5, () => lv('niqueis'), 2, 60),
  q('Melhore a Recepção ao nível 3', 3, () => lv('recepcao'), 2, 100),
  q('Construa a Cafeteria', 1, () => lv('cafe'), 3, 200),
  q('Recolha o dinheiro das salas 10 vezes', 10, () => C.collects, 2, 300),
  q('Contrate um gerente', 1, mgrs, 5, 500),
  q('Construa a Loja de Lembranças', 1, () => lv('loja'), 3, 800),
  q('Decore o resort (nível 2)', 2, () => C.deco, 3, 1_000),
  q('Faça marketing (nível 1)', 1, () => C.mkt, 3, 1_000),
  q('Caça-níqueis no nível 25', 25, () => lv('niqueis'), 5, 3_000),
  q('Abra o Salão das Cartas', 2, () => C.floors, 5, 5_000),
  q('Construa o Blackjack', 1, () => lv('blackjack'), 4, 8_000),
  q('Treine os crupiês (nível 3)', 3, () => C.staff.crupie, 4, 10_000),
  q('Construa a Roleta', 1, () => lv('roleta'), 4, 15_000),
  q('Ganhe 2 estrelas', 2, stars, 6, 20_000),
  q('Passe o Cassino Brisa no ranking', 1, () => C.beaten, 6, 30_000),
  q('Gerente em 4 salas', 4, mgrs, 6, 50_000),
  q('Abra a Arena das Corridas', 3, () => C.floors, 8, 100_000),
  q('Construa a Corrida de Cavalos', 1, () => lv('corrida'), 6, 200_000),
  q('Ganhe 3 estrelas', 3, stars, 8, 400_000),
  q('Passe o Palácio Sol no ranking', 3, () => C.beaten, 8, 800_000),
  q('Abra o Palácio dos Shows', 4, () => C.floors, 10, 2_000_000),
  q('Construa o Teatro de Shows', 1, () => lv('teatro'), 8, 5_000_000),
  q('Ganhe 4 estrelas', 4, stars, 10, 10_000_000),
  q('Abra a Cobertura VIP', 5, () => C.floors, 12, 40_000_000),
  q('Construa o Salão VIP', 1, () => lv('vip'), 10, 80_000_000),
  q('Ganhe 5 estrelas', 5, stars, 15, 200_000_000),
  q('Seja o número 1 da cidade', RIVALS.length, () => C.beaten, 20, 500_000_000),
];
export function quest() {
  if (C.quest < QUESTS.length) return QUESTS[C.quest];
  const n = C.quest - QUESTS.length + 1;
  const goal = 1e9 * Math.pow(10, n) * cityMult(C.city);
  return q(`Lucre ${money(goal)} no total`, goal, () => C.earned, 10);
}
export function claimQuest() {
  const k = quest();
  if (k.get() < k.need) return;
  C.gems += k.gems;
  C.money += k.cash * cityMult(C.city);
  C.quest++;
  sound.playTechUnlocked();
  say(`🎯 Missão cumprida: +${k.gems} 💎`);
  done();
}

// ===== Tempo =====
export const STEP = 0.25;
let acc = 0, saveAt = 0;
export function tick(dt: number) {
  acc += Math.min(dt, 1);
  while (acc >= STEP) {
    acc -= STEP;
    step(STEP);
  }
}
function step(dt: number) {
  const s = compute();
  C.played += dt;
  for (const id in s.rooms) {
    const r = C.rooms[id];
    const inc = s.rooms[id].income * dt;
    if (r.mgr) {
      C.money += inc;
      C.earned += inc;
    } else r.cash = Math.min(Math.max(r.cash, s.rooms[id].income * CASH_SECONDS), r.cash + inc);
  }
  if (C.dobro > 0) C.dobro = Math.max(0, C.dobro - dt);
  const ev = C.event;
  if (ev && (ev.left -= dt) <= 0) {
    if (ev.id === 'torneio' && ev.room) {
      const g = 2 + Math.floor(lv(ev.room) / 20);
      C.gems += g;
      say(`🏆 Torneio encerrado: +${g} 💎`);
    }
    C.event = null;
  }
  if (!C.event && (C.nextEvent -= dt) <= 0) {
    C.nextEvent = 70 + Math.random() * 80;
    const pool: EventId[] = ['onibus', 'vip', 'festa'];
    if (lv('niqueis')) pool.push('jackpot');
    if (C.floors > 1 && ROOMS.some((d) => d.game && d.floor > 0 && lv(d.id))) pool.push('torneio');
    startEvent(pool[Math.floor(Math.random() * pool.length)]);
  }
  while (C.beaten < RIVALS.length && s.income >= rivalFame(C.beaten)) {
    const g = 5 * (C.beaten + 1);
    C.gems += g;
    say(`🏆 Você passou o ${RIVALS[C.beaten].name}! +${g} 💎`);
    C.beaten++;
    sound.playVictory();
  }
  const k = quest();
  useCasino.setState((u) => ({ v: u.v + 1, quest: k.get() >= k.need }));
  if ((saveAt += dt) >= 5) {
    saveAt = 0;
    persist();
  }
}
const done = (scene = false) => {
  compute();
  if (scene) fx.rebuild();
  bump();
  persist();
};

// ===== Salvar =====
export function persist() {
  C.t = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(C));
  } catch { /* sem espaço */ }
}
const today = () => new Date().toISOString().slice(0, 10);
/** Carrega o resort, paga o que rendeu com o app fechado e dá o prêmio do dia */
export function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Casino | null;
    C = raw?.v === 1 ? { ...fresh(), ...raw } : fresh();
  } catch {
    C = fresh();
  }
  const away = Math.min(OFFLINE_MAX, Math.max(0, (Date.now() - C.t) / 1000));
  const s = compute();
  let gain = 0;
  if (away > 30) for (const id in s.rooms) {
    const r = C.rooms[id];
    const inc = s.rooms[id].income * away;
    if (r.mgr) gain += inc;
    else r.cash = Math.min(Math.max(r.cash, s.rooms[id].income * CASH_SECONDS), r.cash + inc);
  }
  const d = today();
  if (C.day !== d) {
    const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    C.streak = C.day === y ? C.streak + 1 : 1;
    C.day = d;
    const g = Math.min(15, 2 + C.streak);
    C.gems += g;
    setTimeout(() => say(`📅 Prêmio do dia ${C.streak}: +${g} 💎`), 1500);
  }
  useCasino.setState({ offline: gain > 1 ? gain : 0 });
  persist();
}
export function takeOffline(double: boolean) {
  let a = useCasino.getState().offline;
  if (double && payGems(6)) a *= 2;
  C.money += a;
  C.earned += a;
  useCasino.setState({ offline: 0 });
  sound.playVictory();
  bump();
}
export function wipe() {
  C = fresh();
  done(true);
}
/** Mod menu: mexe direto no resort */
export function cheat(f: (c: Casino) => void) {
  f(C);
  done(true);
}

export function money(n: number) {
  const a = Math.abs(n);
  const u = ['', 'mil', 'mi', 'bi', 'tri', 'qa', 'qi'];
  let i = 0, v = a;
  while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
  const t = i === 0 ? Math.floor(v).toString() : v.toFixed(v < 10 ? 2 : v < 100 ? 1 : 0).replace('.', ',');
  return `${n < 0 ? '-' : ''}$${t}${i ? ' ' + u[i] : ''}`;
}
