// Guerra no Ceará: node scripts/test-ceara.mjs
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true }, appType: 'custom', logLevel: 'error' });
const K = await server.ssrLoadModule('/src/ceara/content.ts');
const V = await server.ssrLoadModule('/src/ceara/village.ts');
const S = await server.ssrLoadModule('/src/ceara/sim.ts');
const API = await server.ssrLoadModule('/api/ceara.ts');

// Dados oficiais
assert.equal(K.CITIES.length, 184);
assert.equal(K.CITIES.reduce((s, c) => s + c.pop, 0), 8794957);
assert.ok(K.CITIES.every((c) => c.name && K.REGION_COLOR[c.region] && c.rings[0].length > 6), 'região e contorno');
assert.equal(K.CITIES.find((c) => c.name === 'Fortaleza').level, 6);
console.log('✔ 184 cidades,', [1, 2, 3, 4, 5, 6].map((l) => K.CITIES.filter((c) => c.level === l).length).join('/'), 'por nível');

// Bases geradas: válidas, sem sobreposição e iguais a cada chamada
for (const c of K.CITIES) {
  const b = V.cityBase(c.id);
  assert.deepEqual(b, V.cityBase(c.id));
  assert.ok(b.builds.some((x) => x.b === 'prefeitura'));
  const cells = new Set();
  for (const p of b.builds) {
    for (let x = 0; x < K.BUILDS[p.b].size; x++) for (let y = 0; y < K.BUILDS[p.b].size; y++) {
      const k = `${p.x + x},${p.y + y}`;
      assert.ok(!cells.has(k) && p.x >= 1 && p.y >= 1, `${c.name} ${k}`);
      cells.add(k);
    }
  }
}

// Vila
V.found(2304400, 'Teste');
let v = V.me();
assert.equal(V.build('muro', 3, 3), '');
assert.notEqual(V.build('muro', 3, 3), '');
assert.equal(V.upgrade(2), '');
assert.equal(V.upgrade(3), '');
assert.notEqual(V.upgrade(4), '', 'dois pedreiros');
v.builds.forEach((p) => { if (p.done) p.done = 1; });
V.tick();
assert.equal(v.builds.find((p) => p.id === 2).level, 2);
v.builds.find((p) => p.id === 2).since -= 600_000;
const m0 = v.moedas;
assert.ok(V.collect() > 500 && v.moedas > m0);
assert.equal(V.train('vaqueiro', 2), '');
assert.notEqual(V.train('rezadeira'), '');
v.training.forEach((q) => { q.ready = 1; });
V.tick();
assert.equal(v.army.vaqueiro, 14);
assert.equal(V.move(1, 12, 11), '');
for (let i = 0; i < 400; i++) { v.moedas = 1e7; v.farinha = 1e7; v.rapadura = 1e6; for (const p of [...v.builds]) { V.upgrade(p.id); V.rush(p.id); } }
assert.equal(V.hall(), 6);
for (const b of K.BUILD_IDS) while (V.countOf(b) < V.maxOf(b) && b !== 'muro') {
  const s = V.findSpot(b);
  if (!s) break;
  v.moedas = v.farinha = 1e7;
  assert.equal(V.build(b, s.x, s.y), '');
  V.rush(v.builds.at(-1).id);
}
console.log('✔ Vila, obras, coleta e treino');

// Ataques: exército compatível vence, fraco perde, saque limitado, sempre termina
const army = (lvl) => ({ ...V.emptySquad(), vaqueiro: 14 + lvl * 10, rendeira: 6 + lvl * 7, cangaceiro: lvl > 1 ? lvl * 2 : 0, jegue: lvl > 1 ? lvl * 2 : 0, carcara: lvl > 2 ? lvl : 0, boitata: lvl > 3 ? lvl * 2 : 0, rezadeira: lvl > 4 ? 2 : 0 });
const fight = (base, squad) => {
  const r = S.startRaid(base, squad);
  let n = 0;
  while (!r.over && n++ < 3000) {
    if (n % 2 === 0) for (const t of K.TROOP_IDS) if (r.left[t] > 0) { const a = (n * 0.37) % 1.2; S.deploy(r, t, 13 + Math.cos(a) * 14.2, 13 + Math.sin(a) * 14.2); }
    S.stepRaid(r);
  }
  assert.ok(r.over && r.moedas <= base.moedas + 1 && r.farinha <= base.farinha + 1);
  return r;
};
for (const lvl of [1, 2, 3, 4, 5, 6]) {
  const list = K.CITIES.filter((c) => c.level === lvl).slice(0, 8).map((c) => V.cityBase(c.id));
  const strong = list.map((b) => fight(b, army(lvl)));
  const weak = list.map((b) => fight(b, { ...V.emptySquad(), vaqueiro: 4 }));
  const avg = (l, k) => (l.reduce((s, r) => s + r[k], 0) / l.length).toFixed(1);
  console.log(`  nível ${lvl}: forte ${avg(strong, 'stars')}★ ${avg(strong, 'percent')}%, fraco ${avg(weak, 'stars')}★`);
  global.bal = (global.bal ?? []).concat([[lvl, Number(avg(strong, 'stars')), Number(avg(weak, 'stars'))]]);
}
assert.ok(global.bal.every(([l, s, w]) => s >= 1.2 && w <= (l === 1 ? 1 : 0.6)));
const easy = V.cityBase(K.CITIES.find((c) => c.level === 1).id);
const res = fight(easy, army(6));
assert.equal(res.stars, 3);
V.applyRaid(easy, 3, res, S.survivors(res));
assert.equal(Object.keys(v.conquered).length, 1);
const t0 = v.trophies;
V.sufferRaid('Bia', 2, 1e12, 5);
assert.ok(v.moedas === 0 && v.trophies <= t0 && v.shield > Date.now());
// Feitiços
const spellBase = V.cityBase(K.CITIES.find((c) => c.level === 3).id);
const sr = S.startRaid(spellBase, army(3), { reza: 1, trovao: 1, forro: 1 });
assert.equal(S.cast(sr, 'trovao', 13, 13), false, 'só depois de começar');
S.deploy(sr, 'vaqueiro', 13 + 14.2, 13);
const hp = sr.builds.reduce((s, b) => s + b.hp, 0);
assert.ok(S.cast(sr, 'trovao', 13, 13) && sr.builds.reduce((s, b) => s + b.hp, 0) < hp && !S.cast(sr, 'trovao', 13, 13));
assert.ok(S.cast(sr, 'forro', sr.troops[0].x, sr.troops[0].y) && S.cast(sr, 'reza', sr.troops[0].x, sr.troops[0].y));
sr.troops[0].hp = 5;
const x0 = sr.troops[0].x;
S.stepRaid(sr);
assert.ok(sr.troops[0].hp > 5 && x0 - sr.troops[0].x > K.TROOPS.vaqueiro.speed * S.STEP * 1.2);
v.moedas = 1e6;
assert.equal(V.buySpell('reza'), '');
v.army = V.emptySquad();
v.farinha = 1e6;
assert.ok(V.TROOP_TOTAL(v.last) > 0 ? V.retrain() > 0 : true);
v.builds.push({ id: 9999, b: 'muro', level: 1, x: 2, y: 2, done: 0, since: 0 });
assert.ok(V.upgradeWalls() > 0);
assert.ok(V.dailyGift() > 0 && V.dailyGift() === 0 && V.nextStep());
console.log('✔ Ataques e feitiços');
// Mod menu
const { mod, MODS } = await server.ssrLoadModule('/src/ceara/mods.ts');
for (const m of MODS) mod[m.id] = true;
const hard = V.cityBase(2304400);
const mr = S.startRaid(hard, { ...V.emptySquad(), vaqueiro: 1 }, { reza: 1, trovao: 0, forro: 0 });
for (let i = 0; i < 12; i++) assert.ok(S.deploy(mr, 'vaqueiro', 13, 13), 'tropas infinitas em qualquer lugar');
for (let i = 0; i < 3000 && !mr.over; i++) S.stepRaid(mr);
assert.ok(mr.stars === 3 && mr.time === K.RAID_SECONDS && mr.troops.length === 12 && mr.moedas > hard.moedas * 5);
v.moedas = 0;
v.farinha = 0;
assert.equal(V.train('rezadeira', 50), '');
assert.equal(V.build('catapulta', ...Object.values(V.findSpot('catapulta'))), '');
V.sufferRaid('X', 3, 100, 100);
for (const m of MODS) mod[m.id] = false;
console.log(`✔ Mod menu: ${MODS.length} chaves`);

// Servidor
const call = async (b) => { const r = await API.POST(new Request('http://x', { method: 'POST', body: JSON.stringify(b) })); return [r.status, await r.json()]; };
const A = { city: 2304400, secret: 'a'.repeat(24) };
const B = { city: 2307304, secret: 'b'.repeat(24) };
const base = (name, clan) => ({ name, clan, trophies: 10, level: 2, conquered: 0, shield: 0, builds: [{ id: 1, b: 'prefeitura', level: 1, x: 1, y: 1 }], moedas: 500, farinha: 300 });
assert.equal((await call({ op: 'publish', ...A, base: base('Ana', 'Jangada') }))[0], 200);
assert.equal((await call({ op: 'publish', ...A, secret: 'z'.repeat(24), base: base('Ladrao', '') }))[0], 409, 'cidade tem dono');
assert.equal((await call({ op: 'publish', ...B, base: base('Bia', 'jangada') }))[0], 200);
assert.equal((await call({ op: 'list' }))[1].players.length, 2);
assert.equal((await call({ op: 'get', city: A.city }))[1].base.name, 'Ana');
assert.equal((await call({ op: 'raid', ...B, target: A.city, stars: 2, moedas: 99999, farinha: -5 }))[0], 200);
assert.equal((await call({ op: 'raid', ...B, target: A.city, stars: 2, moedas: 1, farinha: 1 }))[0], 409, 'escudo');
assert.equal((await call({ op: 'donate', ...B, target: A.city, t: 'vaqueiro', n: 50 }))[0], 200);
assert.equal((await call({ op: 'say', ...B, i: 3 }))[0], 200);
const [, got] = await call({ op: 'publish', ...A, base: base('Ana', 'Jangada') });
assert.deepEqual(got.mail.map((m) => m.k), ['raid', 'troops']);
assert.ok(got.mail[0].moedas === 500 && got.mail[0].farinha === 0 && got.mail[1].n === 5 && got.chat[0].by === 'Bia');
assert.equal((await call({ op: 'publish', ...A, base: base('Ana', 'Jangada') }))[1].mail.length, 0);
for (const bad of [{}, { op: 'publish' }, { op: 'raid', ...A, target: 1 }, { op: 'publish', city: 1, secret: 'x'.repeat(20) }, { op: 'publish', ...A, base: { name: 'x' } }]) assert.ok((await call(bad))[0] >= 400);
console.log('✔ Servidor');
process.exit(0);
