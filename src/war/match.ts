import { useSyncExternalStore } from 'react';
import { hooks } from '../engine/state';
import { myEmblem, myName } from '../lan/match';
import { Link, deviceId, hostRoom, joinRoom } from '../lan/net';
import { think } from './bot';
import { CITIES, CITY, MAX_PLAYERS, ModeId, PHRASES } from './data';
import { Cmd, Fx, Pack, STEP, Setup, World, cityAt, command, createWorld, mods, pack, step, unpack } from './sim';

/** Sala e partida. O criador simula o mundo; os outros mandam ordens e recebem o estado. */
export interface Seat { id: string; name: string; emblem: string; start: number; ready: boolean }
export interface Bubble { i: number; text: string; at: number }
interface Options { mode: ModeId; minutes: number; rules: string[]; bots: number; skill: number }
/** Trecho gravado da maior batalha */
interface Tape { packs: Pack[]; score: number; x: number; z: number }
interface State extends Options {
  phase: 'menu' | 'joining' | 'lobby' | 'play'; host: boolean; solo: boolean; code: string; seats: Seat[]; seat: string; me: number; world: World | null;
  error: string; paused: boolean; frozen: boolean; speed: number; lost: boolean; replay: boolean; best: Tape | null; pings: { i: number; x: number; z: number; at: number }[]; chat: Bubble[];
}
const FORTALEZA = 2304400;
export const W: State = {
  phase: 'menu', host: false, solo: false, code: '', seats: [], seat: '', me: 0, world: null, error: '', paused: false, frozen: false, speed: 1, lost: false, replay: false, best: null, pings: [], chat: [],
  mode: 'dominio', minutes: 40, rules: [], bots: 3, skill: 1,
};
/** Efeitos à espera da cena 3D */
export const fxQueue: Fx[] = [];

let ver = 0;
const subs = new Set<() => void>();
export const touch = () => {
  ver++;
  subs.forEach((f) => f());
};
export const useWar = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => ver);

// ===== Histórico =====
const KEY = 'PLAY_ONLINE_WAR';
const SAVE = 'PLAY_ONLINE_WAR_SAVE';
export interface Career { played: number; wins: number; kills: number; caps: number; built: number; wonders: number; nukes: number; annex: number; spies: number; crates: number; dev: number; best: number }
const ZERO: Career = { played: 0, wins: 0, kills: 0, caps: 0, built: 0, wonders: 0, nukes: 0, annex: 0, spies: 0, crates: 0, dev: 0, best: 0 };
export function career(): Career {
  try {
    return { ...ZERO, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...ZERO };
  }
}
function record(w: World) {
  const p = w.players[W.me];
  const c = career();
  for (const k of ['kills', 'caps', 'built', 'wonders', 'nukes', 'annex', 'spies', 'crates', 'dev'] as const) c[k] += Math.round(p.stats[k] ?? 0);
  c.played++;
  if (w.players[w.over!.rank[0]].team === p.team) c.wins++;
  c.best = Math.max(c.best, w.cities.filter((x) => x.owner === W.me).length);
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
    if (W.solo) localStorage.removeItem(SAVE);
  } catch { /* armazenamento indisponível */ }
}
/** Experiência da carreira: vira nível e título */
export const careerXp = (c: Career) => c.played * 40 + c.wins * 120 + c.kills * 2 + c.caps * 15 + c.annex * 12 + c.wonders * 60 + c.dev * 8 + c.spies * 10;
const TITLES = ['Vereador', 'Prefeito', 'Deputado', 'Senador', 'Governador', 'Ministro', 'Presidente', 'Lenda do Ceará'];
export function careerLevel(c: Career) {
  const xp = careerXp(c);
  const level = Math.floor(Math.sqrt(xp / 60)) + 1;
  return { level, title: TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 3))], part: (xp - (level - 1) ** 2 * 60) / ((level ** 2 - (level - 1) ** 2) * 60) };
}
export const FEATS: { name: string; icon: string; text: string; ok: (c: Career) => boolean }[] = [
  { name: 'Primeiros passos', icon: '🏡', text: 'Termine uma partida', ok: (c) => c.played >= 1 }, { name: 'Vitória!', icon: '🏆', text: 'Vença uma partida', ok: (c) => c.wins >= 1 },
  { name: 'Veterano', icon: '🎖️', text: 'Termine 10 partidas', ok: (c) => c.played >= 10 }, { name: 'Invencível', icon: '👑', text: 'Vença 10 partidas', ok: (c) => c.wins >= 10 },
  { name: 'Diplomata', icon: '🤝', text: 'Traga 20 cidades por acordo', ok: (c) => c.annex >= 20 }, { name: 'Pacificador', icon: '🕊️', text: 'Traga 100 cidades por acordo', ok: (c) => c.annex >= 100 },
  { name: 'Conquistador', icon: '🚩', text: 'Tome 25 cidades', ok: (c) => c.caps >= 25 }, { name: 'Senhor da guerra', icon: '⚔️', text: 'Tome 100 cidades', ok: (c) => c.caps >= 100 },
  { name: 'Atirador', icon: '🎯', text: '100 abates', ok: (c) => c.kills >= 100 }, { name: 'Exterminador', icon: '💀', text: '1000 abates', ok: (c) => c.kills >= 1000 },
  { name: 'Urbanista', icon: '🌆', text: 'Evolua 30 cidades', ok: (c) => c.dev >= 30 }, { name: 'Metrópole', icon: '🌃', text: 'Evolua 150 cidades', ok: (c) => c.dev >= 150 },
  { name: 'Mestre de obras', icon: '🏗️', text: '100 construções', ok: (c) => c.built >= 100 }, { name: 'Maravilhoso', icon: '✨', text: 'Erga 3 maravilhas', ok: (c) => c.wonders >= 3 },
  { name: 'Patrimônio', icon: '🌐', text: 'Erga 15 maravilhas', ok: (c) => c.wonders >= 15 }, { name: 'Agente secreto', icon: '👁️', text: '10 missões de espionagem', ok: (c) => c.spies >= 10 },
  { name: 'Garimpeiro', icon: '📦', text: 'Pegue 25 caixas', ok: (c) => c.crates >= 25 }, { name: 'Era atômica', icon: '☢️', text: 'Lance uma arma nuclear', ok: (c) => c.nukes >= 1 },
  { name: 'Meio Ceará', icon: '🗺️', text: 'Termine com 92 cidades', ok: (c) => c.best >= 92 }, { name: 'Dono do Ceará', icon: '🌎', text: 'Termine com 150 cidades', ok: (c) => c.best >= 150 },
];
// ===== Partida solo salva =====
function saveSolo() {
  if (!W.solo || !W.world || W.world.over || W.replay) return;
  try {
    localStorage.setItem(SAVE, JSON.stringify({ v: 1, world: { ...W.world, fx: [] }, seats: W.seats, o: options() }));
  } catch { /* sem espaço: segue sem salvar */ }
}
export function savedSolo(): { t: number; cities: number } | null {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE) ?? 'null');
    return s?.v === 1 ? { t: s.world.t, cities: s.world.cities.filter((c: { owner: number }) => c.owner === 0).length } : null;
  } catch {
    return null;
  }
}
export function resumeSolo() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE)!);
    quitWar();
    Object.assign(W, s.o, { phase: 'play', host: true, solo: true, seat: s.seats[0].id, seats: s.seats, me: 0, world: s.world, paused: false, frozen: false, speed: 1 });
    film = [];
    W.best = null;
    fxQueue.length = 0;
    runLoop();
    touch();
  } catch {
    hooks.toast('Não foi possível abrir a partida salva.', 'danger');
  }
}

// ===== Sala =====
let room: ReturnType<typeof hostRoom> | null = null;
let server: Link | null = null;
let timer = 0;
const guests = new Map<string, Link>();
const broadcast = (msg: unknown) => guests.forEach((l) => l.send(msg));
const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const allowed = (id: number) => !(W.mode === 'capital' && id === FORTALEZA);
const free = () => CITIES.filter((c) => c.level >= 3 && allowed(c.id) && W.seats.every((s) => s.start !== c.id && far(s.start, c.id)));
const far = (a: number, b: number) => !CITY[a] || Math.hypot(CITY[a].x - CITY[b].x, CITY[a].z - CITY[b].z) > 7;
const randomCity = () => {
  const l = free();
  return (l.length ? l : CITIES.filter((c) => W.seats.every((s) => s.start !== c.id)))[Math.floor(Math.random() * (l.length || 100))].id;
};
const newSeat = (id: string, name: string, emblem: string): Seat => ({ id, name: name || 'General', emblem: emblem || '🦅', start: randomCity(), ready: false });

export function createWar() {
  quitWar();
  Object.assign(W, { phase: 'lobby', host: true, solo: false, seat: deviceId(), error: '', bots: 0 });
  W.seats = [{ ...newSeat(W.seat, myName(), myEmblem()), ready: true }];
  room = hostRoom(() => ({ name: `Guerra de ${myName()}`, players: W.seats.length, started: W.phase === 'play' }), {
    onOpen: (link, id) => {
      guests.get(id)?.close();
      guests.set(id, link);
    },
    onMessage: fromGuest,
    onClose: (id) => {
      guests.delete(id);
      if (W.phase === 'lobby') W.seats = W.seats.filter((s) => s.id !== id);
      else online(id, false);
      syncLobby();
    },
  }, 'ce');
  W.code = room.code;
  touch();
}
/** Partida livre contra robôs, sem sala */
export function createSolo() {
  quitWar();
  Object.assign(W, { phase: 'lobby', host: true, solo: true, seat: deviceId(), error: '', bots: 3 });
  W.seats = [{ ...newSeat(W.seat, myName(), myEmblem()), ready: true }];
  touch();
}
function online(id: string, on: boolean) {
  const n = W.seats.findIndex((s) => s.id === id);
  const p = W.world?.players[n];
  if (!p || p.online === on) return;
  p.online = on;
  hooks.toast(on ? `${p.name} voltou.` : `${p.name} caiu. Um robô assumiu.`, 'info');
}
function syncLobby() {
  if (W.phase === 'lobby') broadcast({ t: 'lobby', seats: W.seats, ...options() });
  touch();
}
const options = (): Options => ({ mode: W.mode, minutes: W.minutes, rules: W.rules, bots: W.bots, skill: W.skill });

function fromGuest(id: string, raw: unknown) {
  const m = raw as Record<string, unknown>;
  if (!m || typeof m !== 'object') return;
  const seat = W.seats.find((s) => s.id === id);
  if (m.t === 'hi') {
    if (W.phase === 'play') {
      if (!seat) return guests.get(id)?.send({ t: 'no', text: 'A partida já começou.' });
      online(id, true);
      guests.get(id)?.send(startMessage());
      guests.get(id)?.send({ t: 's', p: pack(W.world!, true) });
      return;
    }
    if (!seat && W.seats.length >= MAX_PLAYERS) return guests.get(id)?.send({ t: 'no', text: 'Sala cheia.' });
    if (!seat) W.seats.push(newSeat(id, clip(m.name, 14), clip(m.emblem, 8)));
    syncLobby();
    return;
  }
  if (!seat) return;
  const n = W.seats.indexOf(seat);
  if (m.t === 'me' && W.phase === 'lobby') {
    const start = Number(m.start);
    if (CITY[start] && allowed(start) && W.seats.every((s) => s === seat || s.start !== start)) seat.start = start;
    seat.ready = !!m.ready;
    syncLobby();
  } else if (m.t === 'cmd' && W.world) {
    const err = command(W.world, n, m.cmd as Cmd);
    if (err) guests.get(id)?.send({ t: 'err', text: err });
  } else if (m.t === 'say') bubble(n, Number(m.n));
  else if (m.t === 'ping') ping(n, Number(m.x), Number(m.z));
}
function bubble(i: number, n: number) {
  if (!PHRASES[n]) return;
  if (W.host) broadcast({ t: 'say', i, n });
  W.chat = [...W.chat.filter((b) => b.i !== i), { i, text: PHRASES[n], at: Date.now() }];
  touch();
}
function ping(i: number, x: number, z: number) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return;
  if (W.host) broadcast({ t: 'ping', i, x, z });
  W.pings = [...W.pings.filter((p) => Date.now() - p.at < 5000), { i, x, z, at: Date.now() }].slice(-8);
}

export async function enterWar(code: string) {
  quitWar();
  Object.assign(W, { phase: 'joining', host: false, solo: false, code, seat: deviceId(), error: '', lost: false });
  touch();
  try {
    await connect();
  } catch (e) {
    Object.assign(W, { phase: 'menu', error: (e as Error).message || 'Não foi possível entrar.' });
    touch();
  }
}
const connect = () =>
  joinRoom(W.code, {
    onOpen: (link) => {
      server = link;
      link.send({ t: 'hi', name: myName(), emblem: myEmblem() });
    },
    onMessage: (_, raw) => fromHost(raw as Record<string, unknown>),
    onClose: () => {
      server = null;
      if (W.phase === 'play' && !W.world?.over) reconnect();
      else if (W.phase !== 'menu' && !W.world?.over) leave('A sala foi fechada.');
    },
  });
async function reconnect() {
  W.lost = true;
  touch();
  for (let n = 0; n < 4 && W.phase === 'play' && !server; n++) {
    try {
      await connect();
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  if (W.phase !== 'play') return;
  if (!server) return leave('A conexão com a sala caiu.');
  W.lost = false;
  touch();
}
function leave(error: string) {
  quitWar();
  W.error = error;
  touch();
}
function fromHost(m: Record<string, unknown>) {
  if (!m || typeof m !== 'object') return;
  if (m.t === 'lobby') {
    Object.assign(W, pickOptions(m), { seats: m.seats as Seat[], phase: 'lobby', world: null });
    if (!W.seats.some((s) => s.id === W.seat)) return leave('Você foi removido da sala.');
    touch();
  } else if (m.t === 'start') {
    const setups = m.setups as Setup[];
    Object.assign(W, pickOptions(m), { seats: m.seats as Seat[] });
    W.me = W.seats.findIndex((s) => s.id === W.seat);
    if (W.me < 0) return leave('Você não está nesta partida.');
    W.world = createWorld(setups, W.mode, W.minutes, W.rules);
    W.phase = 'play';
    film = [];
    W.best = null;
    fxQueue.length = 0;
    touch();
  } else if (m.t === 's' && W.world) {
    const over = !!W.world.over;
    unpack(W.world, m.p as Pack);
    queue(W.world.fx);
    tape(m.p as Pack);
    if (W.world.over && !over) record(W.world);
    touch();
  } else if (m.t === 'err') hooks.toast(clip(m.text, 80), 'danger');
  else if (m.t === 'say') bubble(Number(m.i), Number(m.n));
  else if (m.t === 'ping') ping(Number(m.i), Number(m.x), Number(m.z));
  else if (m.t === 'no') leave(clip(m.text, 80));
}
const pickOptions = (m: Record<string, unknown>) => ({ mode: m.mode, minutes: m.minutes, rules: m.rules, bots: m.bots, skill: m.skill }) as Options;

// ===== Ações da sala =====
export const mySeat = () => W.seats.find((s) => s.id === W.seat);
export function setSeat(patch: Partial<Seat>) {
  const s = mySeat();
  if (!s) return;
  if (patch.start && W.seats.some((x) => x !== s && x.start === patch.start)) return hooks.toast('Essa cidade já é de outro jogador.', 'danger');
  if (patch.start && !allowed(patch.start)) return hooks.toast('Neste modo ninguém começa em Fortaleza.', 'danger');
  Object.assign(s, patch);
  if (W.host) syncLobby();
  else {
    server?.send({ t: 'me', start: s.start, ready: s.ready });
    touch();
  }
}
export function setOptions(patch: Partial<Options>) {
  if (!W.host) return;
  Object.assign(W, patch);
  for (const s of W.seats) if (!allowed(s.start)) s.start = randomCity();
  syncLobby();
}
export const toggleRule = (id: string) => setOptions({ rules: W.rules.includes(id) ? W.rules.filter((r) => r !== id) : [...W.rules, id] });
export function kickSeat(id: string) {
  W.seats = W.seats.filter((s) => s.id !== id);
  syncLobby();
  guests.get(id)?.close();
  guests.delete(id);
}
export const total = () => Math.min(MAX_PLAYERS, W.seats.length + W.bots);
export const ready = () => W.seats.every((s) => s.ready) && total() >= 2;

const BOT_NAMES = ['General Faísca', 'Coronel Trovão', 'Major Relâmpago', 'Capitã Aurora', 'Comandante Aço', 'Marechal Ventania'];
let setups: Setup[] = [];
const startMessage = () => ({ t: 'start', setups, seats: W.seats, ...options() });
export function startWar() {
  if (!W.host || !ready()) return;
  setups = W.seats.map((s) => ({ name: s.name, emblem: s.emblem, start: s.start, bot: 0 }));
  const seats = W.seats;
  for (let n = 0; setups.length < total(); n++) {
    const start = randomCity();
    setups.push({ name: BOT_NAMES[n], emblem: '🤖', start, bot: W.skill });
    // Reserva a cidade enquanto escolhe as próximas
    W.seats = [...W.seats, { id: `bot${n}`, name: '', emblem: '', start, ready: true }];
  }
  W.seats = seats;
  W.world = createWorld(setups, W.mode, W.minutes, W.rules);
  Object.assign(W, { me: W.seats.findIndex((s) => s.id === W.seat), phase: 'play', paused: false, frozen: false, speed: 1, chat: [], pings: [] });
  mods.clear();
  fxQueue.length = 0;
  film = [];
  W.best = null;
  broadcast(startMessage());
  runLoop();
  touch();
}
export function backToLobby() {
  stopReplay();
  if (!W.host) return quitWar();
  clearInterval(timer);
  Object.assign(W, { phase: 'lobby', world: null });
  W.seats = W.seats.filter((s) => s.id === W.seat || guests.has(s.id));
  for (const s of W.seats) s.ready = s.id === W.seat;
  mods.clear();
  syncLobby();
}
export function quitWar() {
  saveSolo();
  stopReplay();
  clearInterval(timer);
  room?.close();
  room = null;
  guests.forEach((l) => l.close());
  guests.clear();
  const s = server;
  server = null;
  mods.clear();
  Object.assign(W, { phase: 'menu', world: null, seats: [], code: '', error: '', chat: [], pings: [], paused: false, lost: false });
  s?.close();
  touch();
}

// ===== Replay =====
let film: Pack[] = [];
let film0: World | null = null;
const BIG: Record<string, number> = { bum: 1, destroco: 2, queda: 2, tomada: 3, aereo: 6, barragem: 4, nuclear: 40 };
const heat = (p: Pack) => p.fx.reduce((s, f) => s + (BIG[f[0]] ?? 0), 0);
/** Guarda os últimos 12 segundos e separa o trecho mais intenso */
function tape({ t, l, u, fx, z, r }: Pack) {
  film.push({ t, l, u, fx, z, r });
  if (film.length > 60) film.shift();
  const score = film.reduce((s, p) => s + heat(p), 0);
  if (film.length < 30 || score < 8 || score <= (W.best?.score ?? 0)) return;
  const all = film.flatMap((p) => p.fx).filter((f) => BIG[f[0]]);
  const top = all.reduce((b, f) => (BIG[f[0]] > BIG[b[0]] ? f : b));
  W.best = { packs: [...film], score, x: top[3], z: top[4] };
}
let reel = 0;
export function playReplay() {
  if (!W.best || !W.world || W.replay) return;
  film0 = W.world;
  W.world = { ...structuredClone(film0), over: null, units: [] };
  W.replay = true;
  fxQueue.length = 0;
  let i = 0;
  clearInterval(reel);
  reel = window.setInterval(() => {
    const p = W.best?.packs[i++];
    if (!p || !W.world) return stopReplay();
    unpack(W.world, p);
    queue(p.fx);
    touch();
  }, 200);
  touch();
}
export function stopReplay() {
  clearInterval(reel);
  if (film0) W.world = film0;
  film0 = null;
  W.replay = false;
  touch();
}

// ===== Partida =====
const queue = (fx: Fx[]) => {
  fxQueue.push(...fx);
  if (fxQueue.length > 400) fxQueue.splice(0, fxQueue.length - 400);
};
function runLoop() {
  clearInterval(timer);
  let last = performance.now();
  let acc = 0;
  let ticks = 0;
  let net: Fx[] = [];
  timer = window.setInterval(() => {
    const w = W.world;
    if (!w) return;
    const now = performance.now();
    // Aba em segundo plano roda a cada segundo: recupera o atraso
    acc = Math.min(acc + ((now - last) / 1000) * W.speed, 2.5 * W.speed);
    last = now;
    if (W.solo && (W.paused || document.hidden)) acc = 0;
    let moved = false;
    while (acc >= STEP) {
      acc -= STEP;
      w.fx = [];
      step(w);
      moved = true;
      ticks++;
      for (const p of w.players) if ((p.bot || !p.online) && !W.frozen && (ticks + p.i * 3) % 15 === 0) think(w, p.i);
      queue(w.fx);
      net.push(...w.fx);
    }
    if (!moved) return;
    if (ticks % 2 === 0) {
      w.fx = net;
      const p = pack(w, guests.size > 0 && (ticks % 10 === 0 || !!w.over));
      if (guests.size) broadcast({ t: 's', p });
      tape(p);
      net = [];
    }
    if (ticks % 2 === 0) touch();
    if (ticks % 100 === 0) saveSolo();
    if (w.over) {
      clearInterval(timer);
      broadcast({ t: 's', p: pack(w, true) });
      record(w);
      touch();
    }
  }, 100);
}
/** Dá uma ordem; o criador resolve na hora */
export function order(cmd: Cmd) {
  if (!W.world) return;
  if (!W.host) return server?.send({ t: 'cmd', cmd });
  const err = command(W.world, W.me, cmd);
  if (err) hooks.toast(err, 'danger');
  touch();
}
export function sayPhrase(n: number) {
  if (W.host) bubble(W.me, n);
  else server?.send({ t: 'say', n });
}
export function sendPing(x: number, z: number) {
  if (W.host) ping(W.me, x, z);
  else server?.send({ t: 'ping', x, z });
}
export const myPlayer = () => W.world!.players[W.me];
export const myHome = () => cityAt(W.world!, myPlayer().start);
