// Guerra Ceará 2026: node scripts/test-war.mjs
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
globalThis.sessionStorage = globalThis.localStorage;
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true }, appType: 'custom', logLevel: 'error' });
const D = await server.ssrLoadModule('/src/war/data.ts');
const S = await server.ssrLoadModule('/src/war/sim.ts');
const B = await server.ssrLoadModule('/src/war/bot.ts');

// Dados oficiais e catálogo
assert.equal(D.CITIES.length, 184);
assert.equal(D.CITIES.reduce((s, c) => s + c.pop, 0), 8794957);
for (const u of D.UNIT_IDS) assert.ok(D.WORKS[D.UNITS[u].from], u);
const total = D.UNIT_IDS.length + D.WORKS_IDS.length + D.POWER_IDS.length + D.RESEARCH.length * 3 + Object.keys(D.LANDMARKS).length + Object.keys(D.REGION_BONUS).length + D.EVENTS.length + D.MODES.length + D.RULES.length + D.MEDALS.length + D.PHRASES.length;
assert.ok(total >= 150, `${total} ideias`);
console.log(`✔ 184 cidades, ${D.ROADS.length} estradas, ${total} itens de conteúdo`);

const setup = (n, bots = 0) => ['Fortaleza', 'Juazeiro do Norte', 'Sobral', 'Iguatu', 'Aracati', 'Tauá'].slice(0, n).map((c, i) => ({ name: `P${i}`, emblem: '🦅', start: D.CITIES.find((x) => x.name === c).id, bot: i >= n - bots ? 2 : 0 }));
const run = (w, s) => { for (let i = 0; i < s / S.STEP; i++) { w.fx = []; S.step(w); } };

// Regras
let w = S.createWorld(setup(2), 'dominio', 15, []);
const p = w.players[0];
const home = S.cityAt(w, p.start);
assert.ok(home.owner === 0 && S.armySize(w, 0) === 6);
p.money = 1e6;
p.fuel = 1e6;
assert.equal(S.command(w, 0, { c: 'build', city: home.id, k: 'fabrica' }), '');
assert.notEqual(S.command(w, 0, { c: 'train', city: home.id, k: 'tanque' }), '', 'fábrica em obras');
run(w, 16);
assert.equal(S.command(w, 0, { c: 'train', city: home.id, k: 'tanque', n: 5 }), '');
assert.equal(S.command(w, 0, { c: 'cancel', city: home.id }), '');
run(w, 60);
assert.equal(w.units.filter((u) => u.o === 0 && u.k === 'tanque').length, 4);
assert.notEqual(S.command(w, 0, { c: 'build', city: S.cityAt(w, w.players[1].start).id, k: 'torre' }), '', 'cidade alheia');
assert.notEqual(S.command(w, 0, { c: 'power', k: 'balistico', x: 0, z: 0 }), '', 'precisa de silo');
assert.equal(S.command(w, 0, { c: 'research', id: 'ia' }), '');
// Conquista de cidade neutra vizinha
const near = w.cities.filter((c) => c.owner < 0).sort((a, b) => Math.hypot(a.x - home.x, a.z - home.z) - Math.hypot(b.x - home.x, b.z - home.z))[0];
assert.equal(S.command(w, 0, { c: 'move', u: w.units.filter((u) => u.o === 0).map((u) => u.i), x: near.x, z: near.z }), '');
run(w, 60);
assert.equal(near.owner, 0, 'tomou a cidade vizinha');
// Ordens maliciosas
for (const bad of [{ c: 'move', u: 'x', x: 1, z: 1 }, { c: 'move', u: [1], x: NaN, z: 0 }, { c: 'zzz' }, { c: 'train', city: 1, k: 'tanque' }, { c: 'build', city: home.id, k: 'comando' }]) S.command(w, 1, bad);
const enemy = w.units.filter((u) => u.o === 0).map((u) => u.i);
S.command(w, 1, { c: 'move', u: enemy, x: 30, z: 30 });
assert.ok(w.units.filter((u) => u.o === 0).every((u) => u.tx !== 30), 'não move tropas alheias');
// Apoios
S.command(w, 0, { c: 'build', city: home.id, k: 'silo' });
home.works.push({ k: 'silo', left: 0, cool: 0 });
const foe = S.cityAt(w, w.players[1].start);
for (const k of D.POWER_IDS) assert.equal(S.command(w, 0, { c: 'power', k, x: foe.x, z: foe.z }), '', k);
const before = foe.hp;
run(w, 6);
assert.ok(foe.hp < before * 0.3 && S.armySize(w, 1) < 6, 'míssil balístico');
assert.ok(S.eyes(w, 0).length > 3);
// Rede: estado recomposto igual
const copy = S.createWorld(setup(2), 'dominio', 15, []);
const pk = JSON.parse(JSON.stringify(S.pack(w, true)));
S.unpack(copy, pk);
assert.equal(copy.units.length, w.units.length);
copy.cities.forEach((c, i) => assert.ok(c.owner === w.cities[i].owner && c.works.length === w.cities[i].works.length));
assert.ok(JSON.stringify(pk).length < 60000, `${JSON.stringify(pk).length} bytes`);
console.log('✔ Regras, conquista, apoios e rede');

// Partidas completas só de robôs, em todos os modos
for (const mode of D.MODES) {
  w = S.createWorld(setup(6, mode.id === 'coop' ? 3 : 6).map((x) => ({ ...x, bot: x.bot || (mode.id === 'coop' ? 0 : 2) })), mode.id, 20, mode.id === 'total' ? ['caos', 'renda'] : []);
  const t0 = performance.now();
  let steps = 0;
  let max = 0;
  while (!w.over && steps < 12100) {
    w.fx = [];
    S.step(w);
    if (++steps % 15 === 0) for (const q of w.players) { if (q.bot || mode.id === 'coop') { const b = q.bot; q.bot = b || 2; B.think(w, q.i); q.bot = b; } }
    max = Math.max(max, w.units.length);
    for (const u of w.units) assert.ok(Number.isFinite(u.x) && Number.isFinite(u.hp));
    for (const q of w.players) assert.ok(q.money >= -1 && Number.isFinite(q.money));
  }
  assert.ok(w.over, mode.id);
  console.log(`  ${mode.icon} ${mode.name}: ${Math.round(w.t / 60)} min, ${w.over.title} [${w.players.map((q) => S.citiesOf(w, q.i).length).join('/')}] neutras ${w.cities.filter((c) => c.owner < 0).length}, até ${max} unidades, ${((performance.now() - t0) / steps).toFixed(2)} ms/passo, baixas ${w.players.reduce((s, q) => s + (q.stats.lost ?? 0), 0)}`);
}
console.log('✔ Partidas completas');

// Serviço de salas separa os jogos
const L = await server.ssrLoadModule('/api/lan.ts');
const call = async (b) => (await L.POST(new Request('http://x', { method: 'POST', body: JSON.stringify(b) }))).json();
await call({ op: 'announce', code: 'WARA', secret: 's'.repeat(20), name: 'A', kind: 'ce' });
await call({ op: 'announce', code: 'EMPA', secret: 't'.repeat(20), name: 'B' });
assert.deepEqual((await call({ op: 'list', kind: 'ce' })).rooms.map((r) => r.code), ['WARA']);
assert.deepEqual((await call({ op: 'list' })).rooms.map((r) => r.code), ['EMPA']);
console.log('✔ Salas separadas por jogo');
process.exit(0);
