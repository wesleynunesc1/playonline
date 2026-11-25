// Partida no Wi-Fi com três aparelhos simulados: node scripts/test-lan.mjs
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const mem = new Map();
const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
globalThis.localStorage = storage;
globalThis.sessionStorage = storage;
const realTimeout = globalThis.setTimeout;

const servers = [];
async function device() {
  const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true }, appType: 'custom', logLevel: 'error' });
  servers.push(server);
  const load = (p) => server.ssrLoadModule(p);
  const d = {
    X: await load('/src/lan/match.ts'), E: await load('/src/engine/state.ts'), W: await load('/src/engine/war.ts'),
    C: await load('/src/engine/calc.ts'), T: await load('/src/engine/tick.ts'), K: await load('/src/lan/content.ts'), H: await load('/src/engine/cheats.ts'),
  };
  d.W.timing.strike = 0;
  return d;
}
const A = await device();
const B = await device();
const D = await device();
globalThis.setTimeout = (fn, ms, ...a) => (ms === 0 ? (fn(...a), 0) : realTimeout(fn, ms, ...a));
const copy = (m) => JSON.parse(JSON.stringify(m));
const guests = { h1: B, h2: D };
A.X.wires.toSeat = (seat, m) => guests[seat]?.X.guestReceive(copy(m));
for (const [seat, g] of Object.entries(guests)) g.X.wires.toHost = (m) => A.X.hostReceive(`dev-${seat}`, copy(m));

// Conteúdo: pelo menos 150 itens distintos
const K = A.K;
const total = K.MODES.length + K.RULES.length + K.CARDS.length + K.WORLD_EVENTS.length + K.CHALLENGES.length + K.MEDALS.length + K.PHRASES.length + K.EMOJIS.length + K.EMBLEMS.length;
assert.ok(total >= 150, `${total} itens`);
console.log(`✔ ${K.MODES.length} modos, ${K.RULES.length} regras, ${K.CARDS.length} cartas, ${K.WORLD_EVENTS.length} eventos, ${K.CHALLENGES.length} desafios, ${K.MEDALS.length} medalhas, ${K.PHRASES.length + K.EMOJIS.length + K.EMBLEMS.length} interações: ${total}`);

const lobby = (mode, rules = []) => {
  A.X.createRoom();
  A.X.setMine({ country: 'BR' });
  for (const [seat, g] of Object.entries(guests)) {
    Object.assign(g.X.L, { phase: 'lobby', host: false, me: '' });
    A.X.hostReceive(`dev-${seat}`, { t: 'hello', name: seat === 'h1' ? 'Bia' : 'Duda', emblem: '🐺' });
    assert.equal(g.X.L.me, seat);
  }
  B.X.setMine({ country: 'BR' });
  assert.notEqual(A.X.playerOf('h1').country, 'BR', 'país repetido é recusado');
  B.X.setMine({ country: 'AR' });
  D.X.setMine({ country: 'ES' });
  A.X.setOptions(mode, rules);
  assert.equal(A.X.canStart(), false);
  B.X.setMine({ ready: true });
  D.X.setMine({ ready: true });
  assert.ok(A.X.canStart());
  A.X.startMatch();
};
const all = [A, B, D];
const step = (n = 1) => {
  for (let i = 0; i < n; i++) for (const d of [B, D, A]) { d.T.tick(1); d.X.lanTick(1); }
};
const canon = (d, id) => { const o = d.E.game().countries[id].owner; return o === 'P' ? d.X.L.me : o; };
const sameWorld = () => {
  step(2);
  for (const id of Object.keys(A.E.game().countries)) for (const d of [B, D]) assert.equal(canon(d, id), canon(A, id), `dono de ${id}`);
};

// ===== Sincronização =====
lobby('classica', ['semcartas']);
for (const d of all) assert.ok(d.E.game().mode === 'lan' && d.X.L.phase === 'play');
assert.equal(canon(A, 'AR'), 'h1');
sameWorld();
B.E.game().army.inf = 2000;
assert.ok(B.W.startAttack('UY', { inf: 1500, tank: 0, air: 0, navy: 0 }, ''));
B.W.autoBattle();
B.W.closeBattle();
sameWorld();
assert.equal(canon(A, 'UY'), 'h1', 'conquista do convidado chega ao criador');
assert.equal(canon(D, 'UY'), 'h1', 'e ao outro convidado');

// Disputa simultânea: só um leva
A.W.conquer('PY');
B.W.conquer('PY');
sameWorld();
assert.equal(canon(B, 'PY'), 'h0', 'o juiz decide');

// Ataque entre jogadores, escudo e captura da capital
for (const d of all) for (const r of Object.values(d.E.game().rivals)) r.truce = 0;
A.E.game().shield = true;
B.E.game().army.inf = 3000;
const before = B.E.game().army.inf;
assert.ok(B.W.startAttack('BR', { inf: 2000, tank: 0, air: 0, navy: 0 }, ''));
assert.equal(B.E.game().battle, null, 'escudo cancela');
assert.equal(B.E.game().army.inf, before, 'tropas voltam');
assert.ok(B.X.setBounty('h0'));
assert.ok(B.W.startAttack('BR', { inf: 2000, tank: 0, air: 0, navy: 0 }, ''));
B.W.autoBattle();
assert.equal(B.E.game().battle.done, 'won');
B.W.closeBattle();
sameWorld();
assert.equal(canon(A, 'BR'), 'h1');
assert.equal(A.X.playerOf('h1').tally.kills, 1);
assert.deepEqual(A.X.L.bounty, {}, 'recompensa paga');

// Trapaça de um convidado não pode dar países a outros nem mexer no que é dos outros
A.X.hostReceive('dev-h1', { t: 'up', seq: 999, claims: [{ id: 'ES', from: 'h2', to: 'h0', def: 1 }, { id: 'XX', from: '', to: 'h1', def: 1 }], defs: { ES: 1 }, hits: { ZZ: 5 }, power: NaN, money: 'x', tally: { a: 'b' } });
assert.equal(canon(A, 'ES'), 'h2');
A.X.hostReceive('dev-h1', { t: 'to', to: 'h0', m: { t: 'gift', what: 'money', n: -1e9 } });
for (const bad of [null, {}, { t: 5 }, { t: 'up' }, { t: 'say' }, { t: 'to', to: 'h9' }]) A.X.hostReceive('dev-h1', bad);
assert.ok(Number.isFinite(A.E.game().money) && A.E.game().money >= 0);

// Diplomacia entre jogadores
D.X.propose('h1', 'ally');
assert.equal(B.X.L.proposals.length, 1);
B.X.answer(B.X.L.proposals[0], true);
assert.ok(B.E.game().rivals.h2.ally && D.E.game().rivals.h1.ally);
const cash = D.E.game().money;
B.X.sendGift('h2', 'money');
assert.ok(D.E.game().money > cash);

// Cartas
D.X.L.hand = ['ladrao', 'pix', 'crash'];
B.E.game().money = 10000;
assert.equal(D.X.playCard(0), false, 'carta de ataque pede alvo');
assert.ok(D.X.playCard(0, 'h1'));
assert.ok(B.E.game().money < 9000);
for (const c of K.CARDS) { D.X.L.hand = [c.id]; assert.ok(D.X.playCard(0, 'h1'), c.id); }
for (const e of K.WORLD_EVENTS) for (const d of all) d.X.applyEffect(e.fx);
for (const d of all) for (const v of Object.values(d.E.game().army)) assert.ok(v >= 0);

// Renascer
for (const id of A.E.owned()) A.E.game().countries[id].owner = 'h1';
step(20);
assert.ok(A.E.owned().length >= 1, 'azarão renasce');
sameWorld();

// Reconexão sem perder a partida
const money = B.E.game().money;
A.X.hostReceive('dev-h1', { t: 'hello', name: 'Bia', emblem: '🐺' });
assert.equal(B.E.game().money, money);

// Fim, pódio e revanche
A.X.L.left = 1;
step(2);
for (const d of all) assert.ok(d.X.L.phase === 'end' && d.X.L.end.rank.length === 3 && d.X.L.end.medals.length > 3);
A.X.rematch();
for (const d of all) assert.equal(d.X.L.phase, 'lobby');
console.log('✔ Sincronização, ataques, escudo, recompensa, cartas, diplomacia, reconexão e pódio');

// ===== Todos os modos e regras até o fim =====
for (const m of K.MODES) {
  A.X.quit();
  lobby(m.id, m.id === 'classica' ? K.RULES.map((r) => r.id).filter((r) => !['semia', 'semcartas', 'pobre'].includes(r)) : []);
  for (let i = 0; i < 90; i++) {
    for (const d of all) {
      const g = d.E.game();
      const t = Object.keys(g.countries).find((id) => i % 6 === 0 && !d.W.attackBlock(id) && d.C.reach(id) && d.C.defensePower(id) < 120);
      if (t) {
        const a = d.W.suggestArmy(t, '');
        if (d.W.startAttack(t, a, '')) { d.W.autoBattle(); d.W.closeBattle(); }
      }
      if (d.X.L.hand.length) d.X.playCard(0, d.X.L.players.find((p) => p.id !== d.X.L.me).id);
    }
    step(1);
  }
  if (A.X.L.phase === 'play') {
    sameWorld();
    A.X.L.left = 0;
    step(1);
  }
  for (const d of all) assert.equal(d.X.L.phase, 'end', m.id);
  console.log(`  ${m.icon} ${m.name}: ${A.X.L.end.title} [${A.X.L.players.map((p) => `${p.name} ${p.score}`).join(', ')}]`);
}

// ===== Trapaças do administrador =====
const { E, W, C, T, H } = A;
A.X.quit();
E.newGame('BR');
for (const f of H.FLAGS) E.cheat[f.id] = true;
E.cheat.speed = 20;
E.game().threat = { by: 'r1', target: 'BR', left: 1, power: 1e9 };
T.tick(1);
assert.ok(E.game().money >= 4e5 && E.game().army.inf >= 2000 && !E.game().threat && E.game().time >= 20);
assert.ok(C.reach('MN') && !W.attackBlock('US'));
assert.ok(W.startAttack('US', { inf: 10, tank: 0, air: 0, navy: 0 }, ''));
W.battleRound('avancar');
assert.equal(E.game().battle.done, 'won');
W.closeBattle();
for (const f of ['maxTech', 'maxBuildings', 'allWonders', 'goMars', 'befriendAll', 'weakenAll', 'unlockGenerals', 'allItems', 'maxPerks', 'finishMissions', 'unlockCampaign']) H[f]();
H.take('JP');
H.takeContinent('Europa');
H.destroyRival(Object.values(E.game().rivals).find((r) => r.alive).id);
H.takeWorld();
assert.equal(E.owned().length, 172);
H.forceEnd(true);
assert.ok(E.game().over.won);
console.log(`✔ ${H.FLAGS.length} chaves e funções do administrador`);
globalThis.setTimeout = realTimeout;
process.exit(0);
