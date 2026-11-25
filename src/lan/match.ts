import { BY_REGION, COUNTRIES, COUNTRY_IDS, REGIONS } from '../data/countries';
import { RIVALS, RivalDef } from '../data/content';
import { armyPower, budget, mods } from '../engine/calc';
import { addXp } from '../engine/meta';
import { G, M, PLAYER, bump, cheat, clamp, extraRivals, fail, game, hooks, isHuman, net, newGame, news, ok, owned, pick, rivalDef, save, setGame } from '../engine/state';
import { autoPick, battleRound, cancelAttack, changeMorale, loseCountry } from '../engine/war';
import { CARDS, CHALLENGES, CHALLENGE_PRIZE, COLORS, EMBLEMS, Effect, MAX_PLAYERS, MEDALS, MODES, ModeId, PHRASES, RULES, Tally, WORLD_EVENTS } from './content';
import { Link, deviceId, hostRoom, joinRoom } from './net';

/**
 * Partida no Wi-Fi. Cada aparelho simula a própria nação; o criador da sala é o juiz
 * de quem é dono de cada país e comanda os impérios da máquina, eventos e o relógio.
 */
export interface Player {
  id: string; name: string; emblem: string; country: string; ready: boolean; online: boolean;
  n: number; power: number; money: number; score: number; tally: Partial<Record<Tally, number>>;
}
export interface Feed { id: number; from: string; text: string; big?: boolean }
export interface Proposal { from: string; kind: 'truce' | 'ally' | 'trade' }
interface End { rank: string[]; medals: { player: string; id: string }[]; title: string }
type Msg = Record<string, unknown> & { t: string };

const HAND = 4;
const CARD_S = 45;
const EVENT_S = 75;
const CHALLENGE_S = 100;
const BATTLE_S = 10;
const RESPAWN_S = 15;

export const L = {
  phase: 'off' as 'off' | 'joining' | 'lobby' | 'play' | 'end',
  host: false, me: '', code: '', error: '', connected: true,
  players: [] as Player[], mode: 'classica' as ModeId, rules: [] as string[],
  left: 0, hill: '', hand: [] as string[], nextCard: CARD_S, challenge: null as { id: string; base: number; left: number } | null,
  bounty: {} as Record<string, number>, feed: [] as Feed[], float: [] as Feed[], proposals: [] as Proposal[],
  battleLeft: BATTLE_S, respawn: 0, end: null as End | null, unread: 0,
};
export const myself = () => L.players.find((p) => p.id === L.me);
export const playerOf = (id: string) => L.players.find((p) => p.id === id);
export const hasRule = (r: string) => L.rules.includes(r);
export const modeOf = () => MODES.find((m) => m.id === L.mode)!;
export const teamOf = (id: string) => Number(id.slice(1)) % 2;
const colorOf = (id: string) => COLORS[Number(id.slice(1)) % COLORS.length];
/** Aliança obrigatória do modo */
const locked = (id: string) => isHuman(id) && (L.mode === 'coop' || (L.mode === 'equipes' && teamOf(id) === teamOf(L.me)));

// ===== Transporte =====
let room: ReturnType<typeof hostRoom> | null = null;
let hostLink: Link | null = null;
const links = new Map<string, Link>(); // aparelho -> conexão
const seatOf = new Map<string, string>(); // aparelho -> jogador
let timers = { event: EVENT_S, challenge: 40, sync: 0 };
let score: Record<string, { hill: number; kills: number }> = {};
let base: Record<string, { o: string; d: number }> = {};
let pending: Record<string, number> = {};
let acks: Record<string, number> = {};
let seq = 0;
let talk = 0;
let cards = 0;
let lost = 0;
let sent = 0;
let betrayals = 0;
let peak = 0;
let feedSeq = 0;
let leaving = false;

/** Injetável nos testes */
export const wires = { toHost: (m: Msg) => hostLink?.send(m), toSeat: (seat: string, m: Msg) => deviceOf(seat)?.send(m) };
const deviceOf = (seat: string) => [...seatOf].filter(([, s]) => s === seat).map(([d]) => links.get(d))[0];
function broadcast(m: Msg, except = '') {
  for (const p of L.players) if (p.id !== L.me && p.id !== except) wires.toSeat(p.id, m);
}
/** Mensagem de jogador para jogador (o criador repassa) */
function toPlayer(to: string, m: Msg) {
  if (L.host) wires.toSeat(to, { t: 'm', from: L.me, m });
  else wires.toHost({ t: 'to', to, m });
}

const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
const num = (v: unknown, a: number, b: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, a, b) : 0);

// ===== Sala =====
function resetMatch() {
  Object.assign(L, { feed: [], float: [], proposals: [], hand: [], nextCard: 12, challenge: null, bounty: {}, end: null, respawn: 0, unread: 0, error: '', connected: true });
  base = {};
  pending = {};
  acks = {};
  score = {};
  timers = { event: EVENT_S, challenge: 40, sync: 0 };
  seq = talk = cards = lost = sent = betrayals = peak = 0;
}
const profile = () => {
  try {
    return JSON.parse(localStorage.getItem('PLAY_ONLINE_LAN') ?? '{}') as { name?: string; emblem?: string };
  } catch {
    return {};
  }
};
export const myName = () => profile().name ?? '';
export function saveProfile(name: string, emblem: string) {
  try {
    localStorage.setItem('PLAY_ONLINE_LAN', JSON.stringify({ name: name.slice(0, 14), emblem }));
  } catch { /* armazenamento indisponível */ }
}
export const myEmblem = () => profile().emblem ?? EMBLEMS[0];

function freeCountry(): string {
  const used = L.players.map((p) => p.country);
  return pick(['BR', 'AR', 'MX', 'EG', 'DE', 'JP', 'AU', 'NG', 'TR', 'ES', 'ID', 'CA'].filter((c) => !used.includes(c)));
}
function addPlayer(name: string, emblem: string): Player {
  const id = ['h0', 'h1', 'h2', 'h3', 'h4', 'h5'].find((x) => !playerOf(x))!;
  const p: Player = { id, name: name || `Jogador ${Number(id[1]) + 1}`, emblem: EMBLEMS.includes(emblem) ? emblem : pick(EMBLEMS), country: freeCountry(), ready: false, online: true, n: 1, power: 0, money: 0, score: 0, tally: {} };
  L.players = [...L.players, p];
  return p;
}

export function createRoom() {
  leaveRoom();
  resetMatch();
  Object.assign(L, { phase: 'lobby', host: true, me: 'h0', players: [] });
  addPlayer(myName(), myEmblem()).ready = true;
  room = hostRoom(
    () => ({ name: `Sala de ${myself()?.name ?? '?'}`, players: L.players.length, started: L.phase === 'play' }),
    {
      onOpen: (link, device) => {
        links.get(device)?.close();
        links.set(device, link);
      },
      onMessage: (device, m) => hostReceive(device, m as Msg),
      onClose: (device) => {
        links.delete(device);
        dropSeat(seatOf.get(device) ?? '');
      },
    }
  );
  L.code = room.code;
  bump();
}
function dropSeat(seat: string) {
  const p = playerOf(seat);
  if (!p) return;
  if (L.phase === 'lobby') {
    L.players = L.players.filter((x) => x !== p);
    for (const [d, s] of seatOf) if (s === seat) seatOf.delete(d);
  } else {
    p.online = false;
    say('', `${p.name} perdeu a conexão.`);
  }
  sendLobby();
  bump();
}
export async function enterRoom(code: string) {
  leaveRoom();
  resetMatch();
  Object.assign(L, { phase: 'joining', host: false, code, players: [], error: '' });
  bump();
  await connect();
}
async function connect() {
  const code = L.code;
  try {
    hostLink = await joinRoom(code, {
      onOpen: (link) => link.send({ t: 'hello', name: myName(), emblem: myEmblem() }),
      onMessage: (_id, m) => guestReceive(m as Msg),
      onClose: () => {
        hostLink = null;
        if (leaving || L.phase === 'end' || L.phase === 'off') return;
        L.connected = false;
        bump();
        reconnect();
      },
    });
    L.connected = true;
  } catch (e) {
    if (L.phase === 'joining') Object.assign(L, { phase: 'off', error: (e as Error).message });
    else throw e;
  }
  bump();
}
async function reconnect() {
  for (let i = 0; i < 12 && !L.connected && L.phase !== 'off'; i++) {
    try {
      await connect();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  if (!L.connected && L.phase !== 'off') {
    L.error = 'A conexão com a sala caiu.';
    quit();
  }
}
/** Sai da sala e limpa a partida */
export function leaveRoom() {
  leaving = true;
  if (L.host && L.phase !== 'off') broadcast({ t: 'bye' });
  room?.close();
  hostLink?.close();
  links.forEach((l) => l.close());
  room = null;
  hostLink = null;
  links.clear();
  seatOf.clear();
  net.active = false;
  extraRivals.length = 0;
  Object.assign(L, { phase: 'off', host: false, me: '', players: [], end: null });
  leaving = false;
}
export function quit() {
  leaveRoom();
  if (G?.mode === 'lan') setGame(null);
  bump();
}

export function setMine(patch: Partial<Pick<Player, 'country' | 'ready'>>) {
  if (L.host) applySet(L.me, patch);
  else wires.toHost({ t: 'set', ...patch });
}
function applySet(seat: string, patch: Record<string, unknown>) {
  const p = playerOf(seat);
  if (!p || L.phase !== 'lobby') return;
  const c = str(patch.country, 2);
  if (COUNTRIES[c] && !L.players.some((x) => x !== p && x.country === c)) p.country = c;
  if (typeof patch.ready === 'boolean') p.ready = patch.ready || seat === 'h0';
  sendLobby();
  bump();
}
export function setOptions(mode: ModeId, rules: string[]) {
  L.mode = mode;
  L.rules = rules;
  sendLobby();
  bump();
}
export function kick(id: string) {
  wires.toSeat(id, { t: 'bye' });
  dropSeat(id);
}
function sendLobby() {
  if (!L.host) return;
  for (const p of L.players) wires.toSeat(p.id, { t: 'lobby', you: p.id, players: L.players, mode: L.mode, rules: L.rules });
}
export const canStart = () => L.players.length > 1 && L.players.every((p) => p.ready);

// ===== Início =====
export function startMatch() {
  if (!L.host || !canStart()) return;
  const taken = L.players.map((p) => p.country);
  const ais = hasRule('semia') && L.mode !== 'coop' ? [] : RIVALS.filter((r) => !taken.includes(r.capital)).slice(0, Math.max(2, 6 - L.players.length)).map((r) => r.id);
  const hill = pick(['TR', 'EG', 'IT', 'GR', 'SA', 'PA'].filter((c) => !taken.includes(c)));
  const left = modeOf().minutes * 60;
  broadcast({ t: 'start', players: L.players, mode: L.mode, rules: L.rules, ais, hill, left });
  begin(ais, hill, left);
  startInfo = { ais, hill };
}
let startInfo = { ais: [] as string[], hill: '' };

export function begin(ais: string[], hill: string, left: number) {
  const me = myself()!;
  resetMatch();
  Object.assign(L, { phase: 'play', hill, left });
  extraRivals.length = 0;
  for (const p of L.players) {
    if (p.id === L.me) continue;
    const def: RivalDef = { id: p.id, capital: p.country, leader: p.name, title: p.name, icon: p.emblem, personality: 'comerciante', color: colorOf(p.id), war: 'Agora é guerra!', peace: 'Valeu!', revenge: 'Eu não esqueço.' };
    extraRivals.push(def);
  }
  Object.assign(net, {
    active: true, host: L.host, locked,
    incoming: (owner: string, target: string) => toPlayer(owner, { t: 'incoming', target }),
    cyber: (owner: string) => toPlayer(owner, { t: 'cyber' }),
    war: (owner: string, betrayal: boolean) => {
      if (betrayal) betrayals++;
      toPlayer(owner, { t: 'war', betrayal });
    },
    lost: () => { lost++; },
  });
  newGame(me.country, 'lan', { humans: L.players.filter((p) => p !== me).map((p) => p.id), ais });
  const g = game();
  g.speed = hasRule('turbo') ? 2 : 1;
  if (hasRule('brutal')) for (const r of Object.values(g.rivals)) if (!isHuman(r.id)) r.power *= 2;
  for (const r of Object.values(g.rivals)) {
    if (locked(r.id)) r.ally = true;
    else if (isHuman(r.id)) r.truce = hasRule('guerra') ? 0 : 60;
  }
  for (const id of L.rules) {
    const rule = RULES.find((r) => r.id === id);
    if (rule?.start) applyEffect(rule.start);
    for (const [k, v] of rule?.forever ?? []) g.buffs.push({ k, v, left: 1e9 });
  }
  for (const p of L.players) score[p.id] = { hill: 0, kills: 0 };
  for (const id of COUNTRY_IDS) base[id] = { o: canon(g.countries[id].owner), d: Math.round(g.countries[id].def) };
  say('', `${modeOf().icon} ${modeOf().name}: ${modeOf().text}`);
  hooks.sound('tech');
  bump();
}

// ===== Efeitos e cartas =====
export function applyEffect(e: Effect) {
  const g = game();
  if (e.money) g.money += e.money * Math.max(40, budget().total);
  if (e.moneyPct) g.money = Math.max(0, g.money * (1 + e.moneyPct));
  if (e.army) for (const u of ['inf', 'tank', 'air', 'navy'] as const) g.army[u] = Math.max(0, Math.round(g.army[u] * (1 + e.army)));
  if (e.inf) g.army.inf = Math.max(0, g.army.inf + e.inf);
  if (e.science) g.science = Math.max(0, g.science + e.science);
  for (const r in e.res) g.res[r as 'oil'] += e.res[r as 'oil'] ?? 0;
  if (e.morale) changeMorale(e.morale);
  if (e.infamy) g.infamy = clamp(g.infamy + e.infamy, 0, 100);
  if (e.guard || e.happy) {
    for (const id of owned()) {
      const c = g.countries[id];
      c.def = Math.max(3, c.def + (e.guard ?? 0));
      c.happy = clamp(c.happy + (e.happy ?? 0), 0, 100);
    }
  }
  if (e.shield) g.shield = true;
  if (e.para) g.para = true;
  if (e.satellite) g.satellite = Math.max(g.satellite, e.satellite);
  if (e.reset) for (const p in g.powers) g.powers[p as 'escudo'] = 0;
  if (e.era) g.era = Math.max(g.era, e.era);
  for (const [k, v, left] of e.buff ?? []) g.buffs.push({ k, v, left });
}
export function playCard(index: number, target = '') {
  const card = CARDS.find((c) => c.id === L.hand[index]);
  if (!card || L.phase !== 'play') return false;
  if (card.target === 'foe') {
    if (!playerOf(target) || target === L.me) return fail('Escolha um jogador.');
    if (locked(target)) return fail('É do seu time.');
    toPlayer(target, { t: 'card', id: card.id });
  } else if (card.target === 'all') for (const p of L.players) if (p.id !== L.me && !(card.fx && locked(p.id) && (card.fx.moneyPct ?? card.fx.guard ?? 0) < 0)) toPlayer(p.id, { t: 'card', id: card.id });
  if (card.target === 'self' && card.fx) applyEffect(card.fx);
  if (card.target !== 'foe' && card.id === 'eclipse') applyEffect(card.fx!);
  if (card.self) applyEffect(card.self);
  L.hand = L.hand.filter((_, i) => i !== index);
  cards++;
  shout(`${card.icon} usou ${card.name}${card.target === 'foe' ? ` em ${playerOf(target)!.name}` : ''}!`);
  hooks.sound('tech');
  bump();
  return true;
}

// ===== Conversa =====
function say(from: string, text: string, big = false) {
  const item = { id: ++feedSeq, from, text, big };
  L.feed = [item, ...L.feed].slice(0, 40);
  L.float = [...L.float, item].slice(-4);
  L.unread++;
  setTimeout(() => {
    L.float = L.float.filter((f) => f !== item);
    bump();
  }, big ? 2500 : 5500);
  bump();
}
/** Fala para todos */
export function shout(text: string, big = false) {
  const clean = text.trim().slice(0, 80);
  if (!clean) return;
  if (PHRASES.includes(clean) || big) talk++;
  say(L.me, clean, big);
  if (L.host) broadcast({ t: 'say', from: L.me, text: clean, big });
  else wires.toHost({ t: 'say', text: clean, big });
}
export const ping = (id: string) => shout(`📍 ${COUNTRIES[id].flag} ${COUNTRIES[id].name}`);

// ===== Diplomacia entre jogadores =====
export function propose(to: string, kind: Proposal['kind']) {
  if (hasRule('guerra') && kind !== 'trade') return fail('Guerra total: sem trégua nem aliança.');
  toPlayer(to, { t: 'prop', kind });
  return ok(`Proposta enviada a ${playerOf(to)?.name}.`);
}
export function answer(p: Proposal, yes: boolean) {
  L.proposals = L.proposals.filter((x) => x !== p);
  toPlayer(p.from, { t: yes ? 'acc' : 'rej', kind: p.kind });
  if (yes) seal(p.from, p.kind);
  bump();
}
function seal(id: string, kind: string) {
  const r = game().rivals[id];
  if (!r) return;
  if (kind === 'truce') r.truce = 120;
  else if (kind === 'ally') r.ally = true;
  else r.trade = true;
  hooks.sound('tech');
}
export function sendGift(to: string, what: 'money' | 'inf' | 'food') {
  const g = game();
  const n = what === 'money' ? Math.floor(g.money * 0.15) : what === 'inf' ? Math.min(20, Math.floor(g.army.inf)) : Math.min(20, Math.floor(g.res.food));
  if (n < 1) return fail('Nada para enviar.');
  if (what === 'money') g.money -= n;
  else if (what === 'inf') g.army.inf -= n;
  else g.res.food -= n;
  sent += what === 'money' ? n / 100 : n;
  toPlayer(to, { t: 'gift', what, n });
  return ok('Enviado!');
}
/** Recompensa por tomar um país do alvo */
export function setBounty(to: string) {
  const g = game();
  const n = Math.max(500, Math.round(g.money * 0.2));
  if (g.money < n) return fail('Dinheiro insuficiente.');
  g.money -= n;
  if (L.host) addBounty(to, n);
  else wires.toHost({ t: 'bounty', to, n });
  shout(`💰 ofereceu recompensa de $ ${n} por um país de ${playerOf(to)?.name}!`);
  return true;
}
const addBounty = (to: string, n: number) => { L.bounty[to] = (L.bounty[to] ?? 0) + n; };

// ===== Recepção =====
export function hostReceive(device: string, m: Msg) {
  if (!m || typeof m.t !== 'string') return;
  const seat = seatOf.get(device);
  if (m.t === 'hello') {
    const known = seat && playerOf(seat);
    if (known) {
      known.online = true;
      say('', `${known.name} voltou!`);
      wires.toSeat(seat, { t: 'start', you: seat, players: L.players, mode: L.mode, rules: L.rules, ...startInfo, left: L.left, resume: true });
      return;
    }
    if (L.phase !== 'lobby' || L.players.length >= MAX_PLAYERS) return links.get(device)?.send({ t: 'full' });
    seatOf.set(device, addPlayer(str(m.name, 14), str(m.emblem, 4)).id);
    hooks.sound('recruit');
    sendLobby();
    return bump();
  }
  if (!seat || !playerOf(seat)) return;
  if (m.t === 'set') applySet(seat, m);
  else if (m.t === 'say') {
    const text = str(m.text, 80);
    say(seat, text, !!m.big);
    broadcast({ t: 'say', from: seat, text, big: !!m.big }, seat);
  } else if (L.phase !== 'play') return;
  else if (m.t === 'up') hostUpdate(seat, m);
  else if (m.t === 'to') {
    const to = str(m.to, 2);
    const inner = m.m as Msg;
    if (!inner || typeof inner.t !== 'string') return;
    if (to === L.me) peerReceive(seat, inner);
    else if (playerOf(to)) wires.toSeat(to, { t: 'm', from: seat, m: inner });
  } else if (m.t === 'bounty' && playerOf(str(m.to, 2))) addBounty(str(m.to, 2), num(m.n, 0, 1e7));
  else if (m.t === 'done') challengeWon(seat, str(m.id, 4));
}

export function guestReceive(m: Msg) {
  if (!m || typeof m.t !== 'string') return;
  if (m.t === 'lobby') {
    Object.assign(L, { phase: L.phase === 'play' ? 'play' : 'lobby', me: str(m.you, 2), players: m.players, mode: m.mode, rules: m.rules, end: null });
    if (G?.mode === 'lan' && L.phase === 'lobby') setGame(null);
  } else if (m.t === 'start') {
    Object.assign(L, { players: m.players, mode: m.mode, rules: m.rules });
    if (m.you) L.me = str(m.you, 2);
    // Ao reconectar, quem manteve a partida aberta só segue em frente
    if (m.resume && G?.mode === 'lan') L.phase = 'play';
    else begin(m.ais as string[], str(m.hill, 2), num(m.left, 0, 1e5));
  } else if (m.t === 'say') say(str(m.from, 2), str(m.text, 80), !!m.big);
  else if (m.t === 'full') {
    quit();
    L.error = 'Sala cheia ou partida em andamento.';
  } else if (m.t === 'bye') {
    quit();
    L.error = 'A sala foi encerrada.';
  } else if (L.phase !== 'play') return;
  else if (m.t === 'w') applyWorld(m);
  else if (m.t === 'm') peerReceive(str(m.from, 2), m.m as Msg);
  else if (m.t === 'event') worldEvent(str(m.id, 4), str(m.who, 2));
  else if (m.t === 'chal') newChallenge(str(m.id, 4));
  else if (m.t === 'won') challengeEnd(str(m.who, 2));
  else if (m.t === 'cash') {
    game().money += num(m.n, 0, 1e7);
    ok('Recompensa recebida!');
  } else if (m.t === 'end') finish(m.end as End, m.players as Player[]);
  bump();
}

function peerReceive(from: string, m: Msg) {
  const g = G;
  const who = playerOf(from);
  if (!g || !who || !m) return;
  const r = g.rivals[from];
  if (m.t === 'card') {
    const card = CARDS.find((c) => c.id === m.id);
    if (!card?.fx || card.target === 'self') return;
    applyEffect(card.fx);
    hooks.sound('alert');
    hooks.toast(`${card.icon} ${who.name} usou ${card.name} em você!`, 'danger');
  } else if (m.t === 'gift') {
    const n = num(m.n, 0, 1e7);
    if (m.what === 'money') g.money += n;
    else if (m.what === 'inf') g.army.inf += Math.min(n, 20);
    else g.res.food += Math.min(n, 20);
    hooks.sound('buy');
    ok(`🎁 ${who.name} enviou ${m.what === 'money' ? `$ ${n}` : m.what === 'inf' ? `${n} tropas` : `${n} comida`}!`);
  } else if (m.t === 'prop' && ['truce', 'ally', 'trade'].includes(String(m.kind))) {
    if (L.proposals.some((p) => p.from === from && p.kind === m.kind)) return;
    L.proposals = [...L.proposals, { from, kind: m.kind as Proposal['kind'] }].slice(-3);
    hooks.sound('tech');
  } else if (m.t === 'acc') {
    seal(from, String(m.kind));
    ok(`${who.name} aceitou!`);
  } else if (m.t === 'rej') fail(`${who.name} recusou.`);
  else if (m.t === 'war' && r) {
    Object.assign(r, { ally: locked(from), trade: false, truce: 0 });
    hooks.sound('alert');
    fail(m.betrayal ? `🗡️ ${who.name} TRAIU você!` : `⚔️ ${who.name} declarou guerra!`);
  } else if (m.t === 'incoming' && COUNTRIES[str(m.target, 2)]) {
    const target = str(m.target, 2);
    if (g.shield) {
      g.shield = false;
      toPlayer(from, { t: 'blocked', target });
      ok('🛡️ Seu escudo anulou a invasão!');
    } else {
      hooks.sound('alert');
      hooks.toast(`🚨 ${who.name} está atacando ${COUNTRIES[target].name}!`, 'danger');
      news(`${who.name} ataca ${COUNTRIES[target].name}!`, 'war');
    }
  } else if (m.t === 'blocked') {
    if (cancelAttack(str(m.target, 2))) fail(`🛡️ O escudo de ${who.name} anulou seu ataque!`);
  } else if (m.t === 'cyber') {
    for (const id of owned()) g.countries[id].cyber = 90;
    fail(`💻 ${who.name} atacou sua economia!`);
  } else if (m.t === 'hit') hit(str(m.id, 2), num(m.d, -1e5, 1e5));
  bump();
}
function hit(id: string, d: number) {
  const c = game().countries[id];
  if (c?.owner === PLAYER) c.def = Math.max(3, c.def + d);
}

// ===== Sincronização =====
const canon = (o: string) => (o === PLAYER ? L.me : o);
const local = (o: string) => (o === L.me ? PLAYER : o);
const validOwner = (o: string) => o === '' || !!playerOf(o) || !!game().rivals[o];

function tally(): Player['tally'] {
  const g = game();
  return { ...g.stats, lost, cards, talk, betrayals, peak, sent: Math.round(sent), money: Math.round(g.money), science: Math.round(g.science), power: Math.round(armyPower(g.army)), n: owned().length };
}
const myPower = () => Math.round(armyPower(game().army) * (1 + mods().defense) * game().morale);

/** Troca de dono vinda de fora, com as consequências locais */
function applyOwner(id: string, owner: string, def: number, quiet = false) {
  const g = game();
  const c = g.countries[id];
  const before = c.owner;
  const now = local(owner);
  if (before === now) return;
  if (before === PLAYER && !quiet) {
    loseCountry(id, now);
    fail(`${COUNTRIES[id].name} foi tomado${isHuman(now) ? ` por ${playerOf(now)?.name}` : ''}!`);
    news(`${COUNTRIES[id].name} foi perdido.`, 'war');
    hooks.sound('lose');
  }
  Object.assign(c, { owner: now, def, siege: false, vassal: false, route: false });
}

function hostUpdate(seat: string, m: Msg) {
  const g = game();
  const p = playerOf(seat)!;
  for (const cl of (Array.isArray(m.claims) ? m.claims.slice(0, 200) : []) as { id: string; from: string; to: string; def: number }[]) {
    const c = g.countries[cl?.id];
    if (!c || canon(c.owner) !== cl.from) continue;
    // Só pode tomar para si, perder para a máquina ou desfazer impérios da máquina
    const legal = cl.to === seat || (cl.from === seat && !isHuman(cl.to)) || (cl.to === '' && !isHuman(cl.from));
    if (!legal || !validOwner(cl.to)) continue;
    captured(cl.id, cl.from, cl.to);
    applyOwner(cl.id, cl.to, num(cl.def, 1, 1e5));
  }
  const defs = (m.defs ?? {}) as Record<string, number>;
  for (const id in defs) if (g.countries[id]?.owner === seat) g.countries[id].def = num(defs[id], 1, 1e6);
  const hits = (m.hits ?? {}) as Record<string, number>;
  for (const id in hits) {
    const c = g.countries[id];
    const d = num(hits[id], -1e5, 1e5);
    if (!c) continue;
    if (c.owner === PLAYER) hit(id, d);
    else if (isHuman(c.owner)) wires.toSeat(c.owner, { t: 'm', from: seat, m: { t: 'hit', id, d } });
    else c.def = Math.max(3, c.def + d);
  }
  acks[seat] = num(m.seq, 0, 1e9);
  p.power = num(m.power, 0, 1e8);
  p.money = num(m.money, 0, 1e12);
  p.tally = Object.fromEntries(Object.entries((m.tally ?? {}) as object).slice(0, 40).map(([k, v]) => [k, num(v, 0, 1e12)]));
  if (g.rivals[seat]) g.rivals[seat].power = p.power;
}

/** Só no criador: pontos de capital e recompensa quando um país de jogador muda de mão */
function captured(id: string, from: string, to: string) {
  if (!playerOf(from) || !playerOf(to)) return;
  const victim = playerOf(from)!;
  if (victim.country === id) {
    score[to].kills++;
    announce(`👑 ${playerOf(to)!.name} tomou a capital de ${victim.name}!`);
  }
  const cash = L.bounty[from];
  if (!cash) return;
  delete L.bounty[from];
  if (to === L.me) game().money += cash;
  else wires.toSeat(to, { t: 'cash', n: cash });
  announce(`💰 ${playerOf(to)!.name} levou a recompensa de $ ${cash}!`);
}
function announce(text: string) {
  say('', text);
  broadcast({ t: 'say', from: '', text });
}

/** Convidado: envia o que mudou aqui desde o último estado oficial */
export function sendUpdate() {
  const g = game();
  const claims: { id: string; from: string; to: string; def: number }[] = [];
  const defs: Record<string, number> = {};
  const hits: Record<string, number> = {};
  seq++;
  for (const id of COUNTRY_IDS) {
    const c = g.countries[id];
    const o = canon(c.owner);
    const b = base[id];
    const d = Math.round(c.def);
    if (o !== b.o) {
      if (!pending[id]) {
        claims.push({ id, from: b.o, to: o, def: d });
        pending[id] = seq;
      }
    } else if (o === L.me) defs[id] = d;
    else if (Math.abs(d - b.d) >= 1) {
      hits[id] = d - b.d;
      b.d = d;
    }
  }
  wires.toHost({ t: 'up', seq, claims, defs, hits, power: myPower(), money: Math.round(g.money), tally: tally() });
}
function applyWorld(m: Msg) {
  const g = game();
  const owners = str(m.o, 4000).split(',');
  const defs = m.d as number[];
  if (owners.length !== COUNTRY_IDS.length || !Array.isArray(defs)) return;
  const ack = num(m.ack, 0, 1e9);
  COUNTRY_IDS.forEach((id, i) => {
    const b = base[id];
    const o = owners[i];
    const d = num(defs[i], 1, 1e6);
    const c = g.countries[id];
    if (pending[id]) {
      if (ack < pending[id]) return;
      delete pending[id];
      if (canon(c.owner) !== o) {
        // O juiz não aceitou: alguém chegou antes
        if (c.owner === PLAYER) fail(`Outro jogador chegou antes em ${COUNTRIES[id].name}.`);
        applyOwner(id, o, d, true);
      }
    } else if (o !== b.o) applyOwner(id, o, d);
    else if (canon(c.owner) !== o) return; // mudança local ainda não enviada
    if (c.owner !== PLAYER) c.def = d + (Math.round(c.def) - b.d || 0) * (o === b.o ? 1 : 0);
    base[id] = { o, d: o === L.me ? Math.round(c.def) : d };
  });
  for (const [id, power, capital, alive] of (Array.isArray(m.rv) ? m.rv : []) as [string, number, string, boolean][]) {
    const r = g.rivals[id];
    if (!r) continue;
    if (r.alive && !alive) hooks.sound('win');
    Object.assign(r, { power: num(power, 0, 1e8), capital: COUNTRIES[capital] ? capital : r.capital, alive: !!alive });
  }
  L.left = num(m.left, 0, 1e5);
  L.bounty = (m.bounty ?? {}) as Record<string, number>;
  L.players = m.players as Player[];
  refreshHumans();
}
function refreshHumans() {
  const g = game();
  for (const p of L.players) {
    const r = g.rivals[p.id];
    if (!r) continue;
    r.alive = p.n > 0;
    r.power = p.power;
    const lands = owned(p.id);
    if (lands.length && g.countries[r.capital].owner !== p.id) r.capital = lands.reduce((b, x) => (COUNTRIES[x].income > COUNTRIES[b].income ? x : b));
  }
}
function pointsOf(p: Player): number {
  const g = game();
  const lands = owned(local(p.id));
  switch (L.mode) {
    case 'colina': return Math.floor(score[p.id].hill);
    case 'riqueza': return Math.floor(p.money / 1000);
    case 'continente': return Math.max(...REGIONS.map((r) => BY_REGION[r].filter((id) => g.countries[id].owner === local(p.id)).length));
    case 'cacada': return score[p.id].kills * 10 + lands.length;
    case 'equipes': return L.players.filter((x) => teamOf(x.id) === teamOf(p.id)).reduce((s, x) => s + owned(local(x.id)).length, 0);
    default: return lands.length;
  }
}
/** Criador: monta e envia o estado oficial */
export function sendWorld() {
  const g = game();
  const me = myself()!;
  Object.assign(me, { power: myPower(), money: Math.round(g.money), tally: tally() });
  for (const r of Object.values(g.rivals)) {
    if (isHuman(r.id)) continue;
    const lands = owned(r.id);
    if (!lands.length) r.alive = false;
    else if (g.countries[r.capital].owner !== r.id) r.capital = lands.reduce((b, x) => (COUNTRIES[x].income > COUNTRIES[b].income ? x : b));
  }
  for (const p of L.players) {
    p.n = owned(local(p.id)).length;
    p.tally.kills = score[p.id].kills;
    p.score = pointsOf(p);
  }
  refreshHumans();
  const o = COUNTRY_IDS.map((id) => canon(g.countries[id].owner)).join(',');
  const d = COUNTRY_IDS.map((id) => Math.max(1, Math.round(g.countries[id].def)));
  const rv = Object.values(g.rivals).filter((r) => !isHuman(r.id)).map((r) => [r.id, Math.round(r.power), r.capital, r.alive]);
  for (const p of L.players) if (p.id !== L.me) wires.toSeat(p.id, { t: 'w', o, d, rv, left: L.left, players: L.players, bounty: L.bounty, ack: acks[p.id] ?? 0 });
}

// ===== Relógio =====
export function lanTick(seconds: number) {
  const g = G;
  if (!g || L.phase !== 'play') return;
  if (L.host) L.left = Math.max(0, L.left - seconds);
  peak = Math.max(peak, owned().length);
  if (cheat.cards) while (L.hand.length < HAND) L.hand = [...L.hand, pick(CARDS).id];
  if (!hasRule('semcartas')) {
    L.nextCard -= seconds * (hasRule('cartas') ? 2 : 1);
    if (L.nextCard <= 0) {
      L.nextCard = CARD_S;
      if (L.hand.length < HAND) {
        L.hand = [...L.hand, pick(CARDS).id];
        hooks.sound('buy');
      }
    }
  }
  if (g.battle && !g.battle.done) {
    L.battleLeft -= seconds;
    if (L.battleLeft <= 0) {
      battleRound(autoPick());
      L.battleLeft = BATTLE_S;
    }
  } else L.battleLeft = BATTLE_S;
  respawnTick(g, seconds);
  if (L.challenge) {
    L.challenge.left -= seconds;
    const c = CHALLENGES.find((x) => x.id === L.challenge!.id)!;
    if (g.stats[c.stat] - L.challenge.base >= c.n) {
      const id = L.challenge.id;
      L.challenge = null;
      if (L.host) challengeWon(L.me, id);
      else wires.toHost({ t: 'done', id });
    } else if (L.challenge.left <= 0) L.challenge = null;
  }
  if (L.host) hostTick(seconds);
  else sendUpdate();
}
/** Quem perde tudo volta como azarão em um país neutro */
function respawnTick(g: NonNullable<typeof G>, seconds: number) {
  if (owned().length) {
    L.respawn = 0;
    return;
  }
  if (L.mode === 'ultimo') return;
  if (!L.respawn) L.respawn = RESPAWN_S;
  L.respawn -= seconds;
  if (L.respawn > 0) return;
  const free = COUNTRY_IDS.filter((id) => g.countries[id].owner === '' && COUNTRIES[id].coastal && COUNTRIES[id].income >= 12);
  if (!free.length) {
    L.respawn = 5;
    return;
  }
  const home = pick(free);
  Object.assign(g.countries[home], { owner: PLAYER, def: 60, happy: 80 });
  g.capital = home;
  g.army.inf += 60;
  g.army.navy = Math.max(g.army.navy, 4);
  g.money += 2000;
  g.buffs.push({ k: 'attack', v: 0.25, left: 120 });
  L.respawn = 0;
  shout(`🔥 renasceu em ${COUNTRIES[home].name}!`);
}

function hostTick(seconds: number) {
  const g = game();
  const king = g.countries[L.hill]?.owner;
  if (L.mode === 'colina' && king) {
    const p = king === PLAYER ? L.me : king;
    if (score[p]) score[p].hill += seconds;
  }
  for (const r of Object.values(g.rivals)) if (!isHuman(r.id) && !owned(r.id).length) r.alive = false;
  timers.event -= seconds;
  if (timers.event <= 0) {
    timers.event = EVENT_S;
    const e = pick(WORLD_EVENTS);
    const order = [...L.players].sort((a, b) => b.score - a.score);
    const who = e.who === 'all' ? '' : (e.who === 'leader' ? order[0] : e.who === 'last' ? order[order.length - 1] : pick(L.players)).id;
    broadcast({ t: 'event', id: e.id, who });
    worldEvent(e.id, who);
  }
  timers.challenge -= seconds;
  if (timers.challenge <= 0) {
    timers.challenge = CHALLENGE_S;
    const c = pick(CHALLENGES);
    openChallenge = c.id;
    broadcast({ t: 'chal', id: c.id });
    newChallenge(c.id);
  }
  sendWorld();
  checkEnd();
}
let openChallenge = '';

function worldEvent(id: string, who: string) {
  const e = WORLD_EVENTS.find((x) => x.id === id);
  if (!e) return;
  say('', `${e.icon} ${e.name}: ${e.text}${who ? ` (${playerOf(who)?.name})` : ''}`);
  if (!who || who === L.me) applyEffect(e.fx);
  hooks.sound('alert');
}
function newChallenge(id: string) {
  const c = CHALLENGES.find((x) => x.id === id);
  if (!c) return;
  L.challenge = { id, base: game().stats[c.stat], left: CHALLENGE_S - 10 };
  say('', `🏁 Desafio: o primeiro a ${c.text} ganha prêmio!`);
}
function challengeWon(seat: string, id: string) {
  if (id !== openChallenge) return;
  openChallenge = '';
  broadcast({ t: 'won', who: seat });
  challengeEnd(seat);
}
function challengeEnd(who: string) {
  L.challenge = null;
  say('', `🏁 ${playerOf(who)?.name} venceu o desafio!`);
  if (who === L.me) {
    applyEffect(CHALLENGE_PRIZE);
    hooks.sound('win');
  }
}

// ===== Fim =====
function checkEnd() {
  const g = game();
  const ais = Object.values(g.rivals).filter((r) => !isHuman(r.id) && r.alive);
  const alive = L.players.filter((p) => p.n > 0);
  const coopWon = L.mode === 'coop' && !ais.length;
  const last = L.mode === 'ultimo' && alive.length <= 1;
  if (L.left > 0 && !coopWon && !last) return;
  const rank = [...L.players].sort((a, b) => b.score - a.score || b.money - a.money);
  const medals = MEDALS.map((md) => {
    const top = [...L.players].sort((a, b) => (b.tally[md.key] ?? 0) - (a.tally[md.key] ?? 0))[0];
    return { player: top.id, id: md.id, v: top.tally[md.key] ?? 0 };
  }).filter((x) => x.v > 0).map(({ player, id }) => ({ player, id }));
  const title = L.mode === 'coop' ? (coopWon ? 'Os humanos venceram!' : 'A máquina resistiu!') : L.mode === 'equipes' ? `Time ${teamOf(rank[0].id) ? 'B' : 'A'} venceu!` : `${rank[0].name} venceu!`;
  const end: End = { rank: rank.map((p) => p.id), medals, title };
  broadcast({ t: 'end', end, players: L.players });
  finish(end, L.players);
}
function finish(end: End, players: Player[]) {
  L.players = players;
  L.end = end;
  L.phase = 'end';
  const place = end.rank.indexOf(L.me);
  const won = L.mode === 'coop' ? end.title.startsWith('Os humanos') : L.mode === 'equipes' ? teamOf(L.me) === teamOf(end.rank[0]) : place === 0;
  M.lan = { played: (M.lan?.played ?? 0) + 1, wins: (M.lan?.wins ?? 0) + (won ? 1 : 0) };
  M.chests += won ? 3 : 1;
  addXp(won ? 120 : 50);
  hooks.sound(won ? 'win' : 'lose');
  save();
  bump();
}
/** Revanche: mesma sala, mesmas pessoas */
export function rematch() {
  if (!L.host) return;
  L.players = L.players.filter((p) => p.online);
  for (const p of L.players) Object.assign(p, { ready: p.id === 'h0', n: 1, score: 0, tally: {} });
  L.phase = 'lobby';
  L.end = null;
  setGame(null);
  sendLobby();
  bump();
}
export { colorOf, rivalDef };
export const thisDevice = deviceId;
