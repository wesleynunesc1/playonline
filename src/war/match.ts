import { useSyncExternalStore } from 'react';
import { hooks } from '../engine/state';
import { myEmblem, myName } from '../lan/match';
import { Link, deviceId, hostRoom, joinRoom } from '../lan/net';
import { think } from './bot';
import { CITIES, CITY, MAX_PLAYERS, ModeId, PHRASES, RULES, SAFE_COLORS } from './data';
import { Cmd, Custom, Fx, Pack, STEP, Setup, World, allied, cityAt, command, createWorld, mods, popOf, pack, step, unpack } from './sim';

/** Sala e partida. O criador simula o mundo; os outros mandam ordens e recebem o estado. */
export interface Seat { id: string; name: string; emblem: string; start: number; ready: boolean }
export interface Bubble { i: number; text: string; at: number }
interface Options { mode: ModeId; minutes: number; rules: string[]; bots: number; skill: number; custom: Custom | null }
/** Trecho gravado da maior batalha */
interface Tape { packs: Pack[]; score: number; x: number; z: number }
interface State extends Options {
  phase: 'menu' | 'joining' | 'lobby' | 'play'; host: boolean; solo: boolean; code: string; seats: Seat[]; seat: string; me: number; world: World | null;
  error: string; paused: boolean; frozen: boolean; speed: number; lost: boolean; replay: boolean; best: Tape | null; spec: boolean; slot: number; hist: { t: number; pop: number[] }[]; pauseVotes: number; mission: string; news: boolean; pings: { i: number; x: number; z: number; at: number }[]; chat: Bubble[];
}
const FORTALEZA = 2304400;
export const W: State = {
  phase: 'menu', host: false, solo: false, code: '', seats: [], seat: '', me: 0, world: null, error: '', paused: false, frozen: false, speed: 1, lost: false, replay: false, best: null, spec: false, slot: 0, hist: [], pauseVotes: 0, mission: '', news: false, pings: [], chat: [],
  mode: 'dominio', minutes: 40, rules: [], bots: 3, skill: 1, custom: null,
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
export interface Career { played: number; wins: number; kills: number; caps: number; built: number; wonders: number; nukes: number; annex: number; spies: number; crates: number; dev: number; best: number; wave: number; camp: number; daily: string; streak: number; season: string; seasonXp: number; cards: number[]; log: { d: string; title: string; win: boolean; cities: number; min: number }[] }
/** Data local, com deslocamento em dias */
export const today = (d = 0) => {
  const x = new Date(Date.now() + d * 864e5);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const slotKey = (n: number) => (n ? `${SAVE}${n}` : SAVE);
const ZERO: Career = { played: 0, wins: 0, kills: 0, caps: 0, built: 0, wonders: 0, nukes: 0, annex: 0, spies: 0, crates: 0, dev: 0, best: 0, wave: 0, camp: 0, daily: '', streak: 0, season: '', seasonXp: 0, cards: [], log: [] };
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
  const win = w.players[w.over!.rank[0]].team === p.team && !(w.goal && w.over!.rank[0] !== W.me);
  if (win) c.wins++;
  c.wave = Math.max(c.wave, w.mode === 'ondas' ? w.x.wave : 0);
  const month = today().slice(0, 7);
  if (c.season !== month) Object.assign(c, { season: month, seasonXp: 0 });
  c.seasonXp += 40 + (win ? 120 : 0) + Math.round(p.stats.caps ?? 0) * 10 + Math.round(p.stats.annex ?? 0) * 10;
  c.cards = [...new Set([...c.cards, ...w.cities.filter((x) => x.owner === W.me).map((x) => x.id)])];
  c.log = [{ d: today(), title: w.over!.title, win, cities: w.cities.filter((x) => x.owner === W.me).length, min: Math.round(w.t / 60) }, ...c.log].slice(0, 12);
  if (win && W.mission.startsWith('c')) c.camp = Math.max(c.camp, Number(W.mission.slice(1)) + 1);
  if (win && W.mission === 'dia' && c.daily !== today()) Object.assign(c, { streak: c.daily === today(-1) ? c.streak + 1 : 1, daily: today() });
  c.best = Math.max(c.best, w.cities.filter((x) => x.owner === W.me).length);
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
    if (W.solo) localStorage.removeItem(slotKey(W.slot));
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
    localStorage.setItem(slotKey(W.slot), JSON.stringify({ v: 2, mission: W.mission, world: { ...W.world, fx: [] }, seats: W.seats, o: options() }));
  } catch { /* sem espaço: segue sem salvar */ }
}
export function savedSolo(slot = 0): { t: number; cities: number; mission: string } | null {
  try {
    const s = JSON.parse(localStorage.getItem(slotKey(slot)) ?? 'null');
    return s?.v === 2 ? { t: s.world.t, cities: s.world.cities.filter((c: { owner: number }) => c.owner === 0).length, mission: s.mission } : null;
  } catch {
    return null;
  }
}
/** Espaço livre para uma partida nova (ou o primeiro) */
const freeSlot = () => [0, 1, 2].find((n) => !savedSolo(n)) ?? 0;
export function deleteSave(n: number) {
  try {
    localStorage.removeItem(slotKey(n));
  } catch { /* armazenamento indisponível */ }
  touch();
}
export function resumeSolo(slot = 0) {
  try {
    const s = JSON.parse(localStorage.getItem(slotKey(slot))!);
    quitWar();
    Object.assign(W, s.o, { phase: 'play', host: true, solo: true, seat: s.seats[0].id, seats: s.seats, me: 0, slot, mission: s.mission ?? '', news: true, hist: [], spec: false, world: s.world, paused: false, frozen: false, speed: 1 });
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
const banned = new Set<string>();
const specs = new Set<string>();
const wantPause = new Set<number>();
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
  Object.assign(W, { phase: 'lobby', host: true, solo: false, seat: deviceId(), error: '', bots: 0, mission: '' });
  banned.clear();
  W.seats = [{ ...newSeat(W.seat, myName(), myEmblem()), ready: true }];
  room = hostRoom(() => ({ name: `Guerra de ${myName()}`, players: W.seats.length, started: W.phase === 'play' }), {
    onOpen: (link, id) => {
      guests.get(id)?.close();
      guests.set(id, link);
    },
    onMessage: fromGuest,
    onClose: (id) => {
      guests.delete(id);
      specs.delete(id);
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
  Object.assign(W, { phase: 'lobby', host: true, solo: true, seat: deviceId(), error: '', bots: 3, mission: '', slot: freeSlot() });
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
const options = (): Options => ({ mode: W.mode, minutes: W.minutes, rules: W.rules, bots: W.bots, skill: W.skill, custom: W.custom });

function fromGuest(id: string, raw: unknown) {
  const m = raw as Record<string, unknown>;
  if (!m || typeof m !== 'object') return;
  const seat = W.seats.find((s) => s.id === id);
  if (m.t === 'hi') {
    if (banned.has(id)) return guests.get(id)?.send({ t: 'no', text: 'Você foi removido desta sala.' });
    if (W.phase === 'play') {
      // Quem chega depois assiste
      if (!seat) {
        specs.add(id);
        guests.get(id)?.send({ ...startMessage(), spec: true });
        guests.get(id)?.send({ t: 's', p: pack(W.world!, true) });
        return;
      }
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
  } else if (m.t === 'pause') pauseVote(n);
  else if (m.t === 'say') bubble(n, Number(m.n), !!m.team);
  else if (m.t === 'ping') ping(n, Number(m.x), Number(m.z));
}
/** Pausa na sala quando mais da metade das pessoas pede */
function pauseVote(i: number) {
  if (wantPause.has(i)) wantPause.delete(i);
  else wantPause.add(i);
  const people = W.world?.players.filter((p) => !p.bot && !p.npc && p.online && p.alive).length ?? 1;
  W.pauseVotes = wantPause.size;
  W.paused = wantPause.size > people / 2;
  broadcast({ t: 'pause', n: W.pauseVotes, on: W.paused });
  touch();
}
export function askPause() {
  if (W.solo) W.paused = !W.paused;
  else if (W.host) pauseVote(W.me);
  else server?.send({ t: 'pause' });
  touch();
}
function bubble(i: number, n: number, team = false) {
  if (!PHRASES[n]) return;
  if (W.host) {
    // Conversa de time só chega aos aliados
    if (team && W.world) {
      W.seats.forEach((s, k) => k !== i && allied(W.world!, i, k) && guests.get(s.id)?.send({ t: 'say', i, n, team }));
      const author = W.seats[i] && guests.get(W.seats[i].id);
      author?.send({ t: 'say', i, n, team });
      if (!allied(W.world, i, W.me)) return;
    } else broadcast({ t: 'say', i, n });
  }
  W.chat = [...W.chat.filter((b) => b.i !== i), { i, text: `${team ? '[time] ' : ''}${PHRASES[n]}`, at: Date.now() }];
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
    W.spec = !!m.spec;
    if (W.spec) W.me = 0;
    if (W.me < 0) return leave('Você não está nesta partida.');
    W.world = createWorld(setups, W.mode, W.minutes, W.rules, W.custom);
    recolor(W.world);
    W.hist = [];
    W.phase = 'play';
    film = [];
    W.best = null;
    fxQueue.length = 0;
    touch();
  } else if (m.t === 's' && W.world) {
    const over = !!W.world.over;
    unpack(W.world, m.p as Pack);
    recolor(W.world);
    queue(W.world.fx);
    tape(m.p as Pack);
    if (W.world.over && !over && !W.spec) record(W.world);
    touch();
  } else if (m.t === 'err') hooks.toast(clip(m.text, 80), 'danger');
  else if (m.t === 'pause') {
    W.pauseVotes = Number(m.n);
    W.paused = !!m.on;
    touch();
  } else if (m.t === 'say') bubble(Number(m.i), Number(m.n), !!m.team);
  else if (m.t === 'ping') ping(Number(m.i), Number(m.x), Number(m.z));
  else if (m.t === 'no') leave(clip(m.text, 80));
}
const pickOptions = (m: Record<string, unknown>) => ({ mode: m.mode, minutes: m.minutes, rules: m.rules, bots: m.bots, skill: m.skill, custom: m.custom ?? null }) as Options;

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
/** Tira da sala e não deixa voltar */
export function kickSeat(id: string) {
  banned.add(id);
  W.seats = W.seats.filter((s) => s.id !== id);
  syncLobby();
  guests.get(id)?.close();
  guests.delete(id);
}
const FAV = 'PLAY_ONLINE_WAR_FAV';
export function saveFavorite() {
  try {
    localStorage.setItem(FAV, JSON.stringify(options()));
    hooks.toast('Regras favoritas salvas.', 'success');
  } catch { /* armazenamento indisponível */ }
}
export function loadFavorite() {
  try {
    const f = JSON.parse(localStorage.getItem(FAV) ?? 'null');
    if (f) setOptions(f);
    else hooks.toast('Você ainda não salvou regras favoritas.', 'info');
  } catch { /* armazenamento indisponível */ }
}
export function shuffleRules() {
  const l = RULES.filter((r) => !['semnuke', 'semapoio'].includes(r.id)).sort(() => Math.random() - 0.5);
  setOptions({ rules: l.slice(0, 2).map((r) => r.id) });
}
export function shuffleSeats() {
  for (const s of W.seats) s.start = 0;
  for (const s of W.seats) s.start = randomCity();
  syncLobby();
}
export const total = () => Math.min(MAX_PLAYERS, W.seats.length + W.bots);
export const ready = () => W.seats.every((s) => s.ready) && (total() >= 2 || W.mode === 'ondas');

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
  W.world = createWorld(setups, W.mode, W.minutes, W.rules, W.custom, missionGoal());
  recolor(W.world);
  wantPause.clear();
  specs.clear();
  Object.assign(W, { hist: [], spec: false, pauseVotes: 0, news: false, me: W.seats.findIndex((s) => s.id === W.seat), phase: 'play', paused: false, frozen: false, speed: 1, chat: [], pings: [] });
  mods.clear();
  fxQueue.length = 0;
  film = [];
  W.best = null;
  broadcast(startMessage());
  runLoop();
  touch();
}
// ===== Campanha e desafio do dia =====
type Goal = NonNullable<World['goal']>;
export const CAMPAIGN: { name: string; text: string; city: string; goal: Goal; rules: string[]; bots: number; skill: number; minutes: number }[] = [
  { name: 'O povoado', text: 'Faça sua cidade crescer em paz.', city: 'Quixadá', goal: { kind: 'cities', n: 4, text: 'Governe 4 cidades', level: 0 }, rules: [], bots: 1, skill: 1, minutes: 20 },
  { name: 'Luz no sertão', text: 'Leve o progresso ao interior.', city: 'Iguatu', goal: { kind: 'era', n: 3, text: 'Chegue à Era 3', level: 1 }, rules: ['perigos'], bots: 2, skill: 1, minutes: 25 },
  { name: 'A muralha', text: 'Bandidos por toda parte.', city: 'Tauá', goal: { kind: 'kill', n: 25, text: 'Derrote 25 inimigos', level: 2 }, rules: ['perigos', 'exercito'], bots: 1, skill: 1, minutes: 20 },
  { name: 'Porto rico', text: 'Comércio é poder.', city: 'Caucaia', goal: { kind: 'money', n: 25000, text: 'Junte 25 mil', level: 3 }, rules: [], bots: 3, skill: 2, minutes: 30 },
  { name: 'Obra eterna', text: 'Deixe sua marca na história.', city: 'Sobral', goal: { kind: 'wonders', n: 2, text: 'Erga 2 maravilhas', level: 4 }, rules: [], bots: 3, skill: 2, minutes: 40 },
  { name: 'Todo o Ceará', text: 'O desafio final.', city: 'Juazeiro do Norte', goal: { kind: 'cities', n: 60, text: 'Governe 60 cidades', level: 5 }, rules: ['perigos'], bots: 5, skill: 3, minutes: 60 },
];
/** Desafio igual para todo mundo no mesmo dia */
export function dailyChallenge() {
  const n = [...today()].reduce((s, x) => (s * 31 + x.charCodeAt(0)) >>> 0, 7);
  const goals: Goal[] = [
    { kind: 'cities', n: 10 + (n % 6), text: `Governe ${10 + (n % 6)} cidades`, level: 0 }, { kind: 'era', n: 4, text: 'Chegue à Era 4', level: 0 }, { kind: 'money', n: 12000, text: 'Junte 12 mil', level: 0 },
    { kind: 'wonders', n: 1, text: 'Erga 1 maravilha', level: 0 }, { kind: 'kill', n: 20, text: 'Derrote 20 inimigos', level: 0 }, { kind: 'peace', n: 480, text: 'Fique 8 minutos em paz', level: 0 },
  ];
  const l = ['perigos', 'caos', 'renda', 'forte', 'fraco', 'drones', 'exercito', 'veloz'];
  const goal = goals[n % goals.length];
  return { goal, rules: [...new Set([l[n % l.length], l[(n >> 4) % l.length], ...(goal.kind === 'kill' ? ['perigos'] : [])])], city: CITIES.filter((c) => c.level >= 3)[n % CITIES.filter((c) => c.level >= 3).length], minutes: 25 };
}
const missionGoal = (): World['goal'] => (W.mission === 'dia' ? dailyChallenge().goal : W.mission.startsWith('c') ? CAMPAIGN[Number(W.mission.slice(1))]?.goal ?? null : null);
export function startMission(id: string) {
  createSolo();
  W.mission = id;
  const d = id === 'dia' ? { ...dailyChallenge(), bots: 3, skill: 2 } : CAMPAIGN[Number(id.slice(1))];
  const city = typeof d.city === 'string' ? CITIES.find((c) => c.name === d.city)! : d.city;
  Object.assign(W, { mode: 'dominio', minutes: d.minutes, rules: d.rules, bots: d.bots, skill: d.skill, custom: null });
  W.seats[0].start = city.id;
  startWar();
}
export function startSurvival() {
  createSolo();
  Object.assign(W, { mode: 'ondas', minutes: 0, rules: [], bots: 0, custom: null });
  startWar();
}
// ===== Preferências =====
const PREFS = 'PLAY_ONLINE_WAR_PREFS';
export interface Prefs { voice: boolean; music: boolean; vibe: boolean; safe: boolean; tutorial: number; intro: boolean }
export const prefs: Prefs = (() => {
  const d = { voice: false, music: true, vibe: true, safe: false, tutorial: 0, intro: true };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(PREFS) ?? '{}') };
  } catch {
    return d;
  }
})();
export function setPref(p: Partial<Prefs>) {
  Object.assign(prefs, p);
  try {
    localStorage.setItem(PREFS, JSON.stringify(prefs));
  } catch { /* armazenamento indisponível */ }
  if (W.world) recolor(W.world);
  touch();
}
function recolor(w: World) {
  if (prefs.safe) for (const p of w.players) if (!p.npc) p.color = SAFE_COLORS[p.i % SAFE_COLORS.length];
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
  Object.assign(W, { phase: 'menu', world: null, seats: [], code: '', error: '', chat: [], pings: [], paused: false, lost: false, spec: false, mission: '', custom: null });
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
  // Histórico de população para o gráfico do fim
  const w0 = W.world;
  if (w0 && t - (W.hist[W.hist.length - 1]?.t ?? -99) >= 12) W.hist.push({ t, pop: w0.players.map((p) => popOf(w0, p.i)) });
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
    if (W.paused || (W.solo && document.hidden)) acc = 0;
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
  if (!W.world || W.spec) return;
  if (!W.host) return server?.send({ t: 'cmd', cmd });
  const err = command(W.world, W.me, cmd);
  if (err) hooks.toast(err, 'danger');
  touch();
}
export function sayPhrase(n: number, team = false) {
  if (W.spec) return;
  if (W.host) bubble(W.me, n, team);
  else server?.send({ t: 'say', n, team });
}
export function sendPing(x: number, z: number) {
  if (W.host) ping(W.me, x, z);
  else server?.send({ t: 'ping', x, z });
}
export const myPlayer = () => W.world!.players[W.me];
export const myHome = () => cityAt(W.world!, myPlayer().start);
