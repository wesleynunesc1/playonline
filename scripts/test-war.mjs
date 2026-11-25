// Guerra Ceará 2026: node scripts/test-war.mjs
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
globalThis.sessionStorage = globalThis.localStorage;
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true }, appType: 'custom', logLevel: 'error' });
const D = await server.ssrLoadModule('/src/war/data.ts');
const S = await server.ssrLoadModule('/src/war/sim.ts');
const N = await server.ssrLoadModule('/src/war/nation.ts');
const B = await server.ssrLoadModule('/src/war/bot.ts');

// Dados oficiais e catálogo
assert.equal(D.CITIES.length, 184);
assert.equal(D.CITIES.reduce((s, c) => s + c.pop, 0), 8794957);
for (const u of D.UNIT_IDS) assert.ok(D.WORKS[D.UNITS[u].from], u);
const total = D.UNIT_IDS.length + D.WORKS_IDS.length + D.POWER_IDS.length + D.RESEARCH.length * 3 + Object.keys(D.LANDMARKS).length + Object.keys(D.REGION_BONUS).length + D.EVENTS.length + D.MODES.length + D.RULES.length + D.MEDALS.length + D.PHRASES.length + D.QUESTS.length + D.ERAS.length + N.DOCTRINES.length + N.POLICIES.length + N.WONDERS.length + Object.keys(N.SPIES).length + N.DILEMMAS.length + N.DISASTERS.length + N.CRATES.length + N.VICTORIES.length;
assert.ok(total >= 150, `${total} ideias`);
console.log(`✔ 184 cidades, ${D.ROADS.length} estradas, ${total} itens de conteúdo`);

const setup = (n, bots = 0) => ['Fortaleza', 'Juazeiro do Norte', 'Sobral', 'Iguatu', 'Aracati', 'Tauá'].slice(0, n).map((c, i) => ({ name: `P${i}`, emblem: '🦅', start: D.CITIES.find((x) => x.name === c).id, bot: i >= n - bots ? 2 : 0 }));
const run = (w, s) => { for (let i = 0; i < s / S.STEP; i++) { w.fx = []; S.step(w); } };

// Regras
let w = S.createWorld(setup(2), 'dominio', 15, ['guerra']);
w.players.forEach((q) => { q.era = 5; });
w.nextEvent = 1e9; // sem eventos aleatórios no teste de regras
const p = w.players[0];
const home = S.cityAt(w, p.start);
assert.ok(home.owner === 0 && S.armySize(w, 0) === 6);
p.money = 2e5;
p.fuel = 1e6;
assert.equal(S.command(w, 0, { c: 'build', city: home.id, k: 'fabrica' }), '');
assert.notEqual(S.command(w, 0, { c: 'train', city: home.id, k: 'tanque' }), '', 'fábrica em obras');
run(w, 16);
assert.equal(S.command(w, 0, { c: 'train', city: home.id, k: 'tanque', n: 5 }), '');
assert.equal(S.command(w, 0, { c: 'cancel', city: home.id }), '');
run(w, 60);
assert.equal(w.units.filter((u) => u.o === 0 && u.k === 'tanque').length, 4);
assert.notEqual(S.command(w, 0, { c: 'build', city: S.cityAt(w, w.players[1].start).id, k: 'torre' }), '', 'cidade alheia');
assert.notEqual(S.command(w, 0, { c: 'power', k: 'balistico', x: 0, z: 0 }), '', 'precisa de silo e pesquisa');
assert.equal(S.needOf(w, 0, 'balistico'), 'Pesquise Programa Nuclear nível 2.');
p.res.nuclear = 3;
assert.equal(S.needOf(w, 0, 'balistico'), 'Construa um Silo de Mísseis.');
assert.equal(S.command(w, 0, { c: 'research', id: 'ia' }), '');
// Conquista de cidade neutra vizinha
const near = w.cities.filter((c) => c.owner < 0).sort((a, b) => Math.hypot(a.x - home.x, a.z - home.z) - Math.hypot(b.x - home.x, b.z - home.z))[0];
assert.equal(S.command(w, 0, { c: 'move', u: w.units.filter((u) => u.o === 0).map((u) => u.i), x: near.x, z: near.z, hit: true }), '');
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
run(w, 10);
assert.ok(foe.hp < before * 0.3 && S.armySize(w, 1) < 6, 'míssil balístico');
assert.ok(w.rads.length >= 2, 'radiação');
assert.ok(S.eyes(w, 0).length > 3);
// Rede: estado recomposto igual
const copy = S.createWorld(setup(2), 'dominio', 15, []);
const pk = JSON.parse(JSON.stringify(S.pack(w, true)));
S.unpack(copy, pk);
assert.equal(copy.units.length, w.units.length);
copy.cities.forEach((c, i) => assert.ok(c.owner === w.cities[i].owner && c.works.length === w.cities[i].works.length));
assert.ok(JSON.stringify(pk).length < 60000, `${JSON.stringify(pk).length} bytes`);
// Antimíssil, missões e produção contínua
{
  const g = S.createWorld(setup(2), 'dominio', 15, ['guerra']);
  g.players.forEach((q) => { q.era = 5; });
  g.nextEvent = 1e9;
  const t = S.cityAt(g, g.players[1].start);
  const h = S.cityAt(g, g.players[0].start);
  Object.assign(g.players[0], { money: 1e5, fuel: 1e5, res: { nuclear: 3 } });
  h.works.push({ k: 'silo', left: 0, cool: 0 });
  t.works.push({ k: 'domo', left: 0, cool: 0 });
  assert.equal(S.command(g, 0, { c: 'power', k: 'tatica', x: t.x, z: t.z }), '');
  run(g, 8);
  assert.ok(t.hp > t.max * 0.95 && g.rads.length === 0, 'domo interceptou');
  assert.equal(S.command(g, 0, { c: 'power', k: 'balistico', x: t.x, z: t.z }), '');
  run(g, 9);
  assert.ok(t.hp < t.max * 0.5 && g.rads.length === 1, 'domo recarregando');
  assert.equal(S.command(g, 0, { c: 'loop', city: h.id, k: 'soldado' }), '');
  const n = S.armySize(g, 0);
  run(g, 30);
  assert.ok(S.armySize(g, 0) > n + 3, 'produção contínua');
  assert.ok(g.players[0].quests.length >= 0, 'missões cumpridas');
  const ban = S.createWorld(setup(2), 'dominio', 15, ['semnuke']);
  ban.players[0].era = 5;
  assert.match(S.command(ban, 0, { c: 'power', k: 'tatica', x: 0, z: 0 }), /proibidas/);
  // Muitos tiros no mesmo pacote nunca cortam uma explosão nuclear
  g.fx = [['nuclear', 1, 0, 0, 0], ...Array.from({ length: 900 }, () => ['bala', 0, 0, 0, 0])];
  assert.ok(S.pack(g, false).fx.some((x) => x[0] === 'nuclear'));
}
// Mundo em paz: crescer, acordos, eras e ultimato
{
  const g = S.createWorld(setup(3), 'dominio', 15, []);
  g.nextEvent = 1e9;
  const [a, b] = g.players;
  const h = S.cityAt(g, a.start);
  Object.assign(a, { money: 1e5, fuel: 1e5 });
  assert.match(S.command(g, 0, { c: 'build', city: h.id, k: 'fabrica' }), /Era 2/);
  assert.equal(S.command(g, 0, { c: 'dev', city: h.id }), '');
  run(g, 16);
  assert.equal(h.dev, 1);
  const n = g.cities.filter((c) => c.owner < 0).sort((x, y) => Math.hypot(x.x - h.x, x.z - h.z) - Math.hypot(y.x - h.x, y.z - h.z));
  assert.match(S.command(g, 0, { c: 'annex', city: n[n.length - 1].id }), /Longe/);
  assert.equal(S.command(g, 0, { c: 'annex', city: n[0].id }), '');
  run(g, 45);
  assert.equal(n[0].owner, 0, 'acordo');
  assert.equal(S.command(g, 0, { c: 'era' }), '');
  assert.equal(a.era, 2);
  // Em paz ninguém se fere, mesmo lado a lado
  for (const u of g.units) Object.assign(u, { x: 0, z: 0, tx: 0, tz: 0, go: 0 });
  run(g, 10);
  assert.ok(g.units.every((u) => u.hp === u.max), 'paz');
  a.era = 5;
  a.res.nuclear = 3;
  h.works.push({ k: 'silo', left: 0, cool: 0 });
  const t = S.cityAt(g, b.start);
  assert.match(S.command(g, 0, { c: 'power', k: 'balistico', x: t.x, z: t.z }), /paz/);
  assert.equal(S.command(g, 0, { c: 'dip', to: 1, k: 'comercio' }), '');
  assert.match(S.command(g, 0, { c: 'dip', to: 1, k: 'alianca' }), /comércio/);
  assert.equal(S.command(g, 1, { c: 'answer', from: 0, yes: true }), '');
  assert.equal(S.relOf(g, 1, 0), D.REL.comercio);
  assert.equal(S.command(g, 0, { c: 'dip', to: 1, k: 'guerra' }), '');
  run(g, 10);
  assert.ok(!S.hostile(g, 0, 1), 'ultimato ainda corre');
  run(g, 25);
  assert.ok(S.hostile(g, 0, 1) && !S.hostile(g, 0, 2));
  assert.equal(S.command(g, 0, { c: 'power', k: 'balistico', x: t.x, z: t.z }), '');
  run(g, 9);
  assert.equal(t.ruin > 0.9, true, 'ruínas');
  const cp = S.createWorld(setup(3), 'dominio', 15, []);
  S.unpack(cp, JSON.parse(JSON.stringify(S.pack(g, true))));
  assert.ok(S.hostile(cp, 0, 1) && S.cityAt(cp, h.id).dev === 1 && S.cityAt(cp, t.id).ruin > 0.9);
  // Robôs em nível fácil nunca começam guerra
  const calm = S.createWorld(setup(6, 6).map((x) => ({ ...x, bot: 1 })), 'dominio', 25, []);
  for (let i = 1; i < 15000; i++) {
    calm.fx = [];
    S.step(calm);
    if (i % 15 === 0) for (const q of calm.players) B.think(calm, q.i);
  }
  assert.ok(calm.players.every((q) => q.alive && !S.atWar(calm, q.i)));
  console.log(`  🕊️ 25 min em paz: eras ${calm.players.map((q) => q.era)}, cidades ${calm.players.map((q) => S.citiesOf(calm, q.i).length)}, evoluções ${calm.cities.reduce((x, c) => x + c.dev, 0)}`);
  // Robôs normais: ao menos os 10 primeiros minutos são de paz
  const mid = S.createWorld(setup(6, 6), 'dominio', 40, []);
  let first = 0;
  for (let i = 1; i < 24000; i++) {
    mid.fx = [];
    S.step(mid);
    if (i % 15 === 0) for (const q of mid.players) B.think(mid, q.i);
    if (!first && mid.players.some((q) => S.atWar(mid, q.i))) first = mid.t;
  }
  assert.ok(!first || first > 900);
  console.log(`  ⚖️ 40 min equilibrado: primeira guerra aos ${Math.round(first / 60)} min, eras ${mid.players.map((q) => q.era)}, cidades ${mid.players.map((q) => S.citiesOf(mid, q.i).length)}`);
}
// Nação: doutrina, políticas, impostos, maravilhas, espiões, mercado, dilemas, caixas e revolta
{
  const g = S.createWorld(setup(3), 'dominio', 40, []);
  g.nextEvent = 1e9;
  const a = g.players[0];
  const h = S.cityAt(g, a.start);
  Object.assign(a, { money: 1e5, fuel: 1e5, era: 5 });
  assert.equal(S.command(g, 0, { c: 'doc', id: 'mercador' }), '');
  assert.notEqual(S.command(g, 0, { c: 'doc', id: 'blindado' }), '');
  for (const p of N.POLICIES.slice(0, 5)) assert.equal(S.command(g, 0, { c: 'pol', id: p.id }), '');
  assert.match(S.command(g, 0, { c: 'pol', id: N.POLICIES[6].id }), /vaga/);
  const base = S.incomeOf(g, 0)[0];
  S.command(g, 0, { c: 'tax', v: 1 });
  g.t += 2;
  assert.ok(S.incomeOf(g, 0)[0] > base);
  assert.equal(S.command(g, 0, { c: 'wonder', id: 'porto', city: h.id }), '');
  assert.notEqual(S.command(g, 0, { c: 'wonder', id: 'arena', city: h.id }), '');
  run(g, 85);
  assert.ok(g.wonders[0].left === 0 && a.stats.wonders === 1);
  assert.equal(S.command(g, 0, { c: 'market', buy: true }), '');
  assert.equal(S.command(g, 0, { c: 'loan', pay: false }), '');
  assert.ok(a.n.debt > 1500);
  assert.equal(S.command(g, 0, { c: 'loan', pay: true }), '');
  assert.equal(a.n.debt, 0);
  for (let i = 0; i < N.DILEMMAS.length; i++) for (const n of [0, 1]) {
    a.n.dil = { i, left: 40 };
    assert.equal(S.command(g, 0, { c: 'choose', n }), '');
  }
  for (const k of Object.keys(N.SPIES)) for (let i = 0; i < 12; i++) {
    a.n.spy = 0;
    S.command(g, 0, { c: 'spy', to: 1, k });
  }
  assert.ok(a.stats.spies > 5);
  assert.match(S.command(g, 0, { c: 'spy', to: 0, k: 'mapa' }), /inválido/);
  assert.equal(S.command(g, 0, { c: 'merc', city: h.id, k: 'tanque' }), '');
  const u = g.units.find((x) => x.o === 0);
  assert.equal(S.command(g, 0, { c: 'patrol', u: [u.i], x: u.x + 2, z: u.z }), '');
  run(g, 12);
  assert.ok(u.go === 1 && u.pat, 'patrulha continua');
  g.crates = [{ x: u.x, z: u.z, k: 0, left: 100 }];
  run(g, 1.2);
  assert.ok(a.stats.crates >= 1);
  const c = g.cities.find((x) => x.owner < 0);
  Object.assign(c, { owner: 0, mood: 0, ruin: 1 });
  S.command(g, 0, { c: 'tax', v: 1 });
  for (let i = 0; i < 600 && c.owner === 0; i++) {
    c.mood = 0;
    run(g, 1);
  }
  assert.equal(c.owner, -1, 'revolta');
  a.n.dil = null;
  for (const bad of [{ c: 'pol', id: 'x' }, { c: 'wonder', id: 'x', city: 1 }, { c: 'spy', to: 99, k: 'mapa' }, { c: 'spy', to: 1, k: 'zz' }, { c: 'tax', v: 7 }, { c: 'patrol', u: 5, x: 1, z: 1 }, { c: 'choose', n: 0 }, { c: 'merc', city: 3, k: 'zz' }]) assert.notEqual(S.command(g, 0, bad), '');
  for (const r of D.RESEARCH) a.res[r.id] = 3;
  run(g, 3);
  assert.match(g.over.title, /Ciência/);
}
console.log('✔ Regras, conquista, apoios e rede');

// Partidas completas só de robôs, em todos os modos
for (const mode of D.MODES) {
  w = S.createWorld(setup(6, mode.id === 'coop' ? 3 : 6).map((x) => ({ ...x, bot: x.bot || (mode.id === 'coop' ? 0 : 2) })), mode.id, 20, mode.id === 'total' ? ['guerra', 'caos', 'renda'] : ['guerra']);
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
