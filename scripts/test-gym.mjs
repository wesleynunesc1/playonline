// Joga o Magnata Fitness do zero até o final com um jogador guloso e mede o ritmo.
// Uso: node scripts/test-gym.mjs [horas]
import { build } from 'esbuild';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.window = {};
const out = new URL('./.gym-bundle.mjs', import.meta.url);
await build({ stdin: { contents: "export * from './src/gym/sim.ts'; export * from './src/gym/data.ts';", resolveDir: '.', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: fileURLToPath(out), logLevel: 'error' });
const G = await import(out.href);
rmSync(out);
const { ROOMS, FLOORS, STAFF, RIVALS, CITIES } = G;

const hours = Number(process.argv[2] ?? 60);
G.load();
const log = [];
const mark = (t, what) => log.push(`${(t / 3600).toFixed(2).padStart(6)}h  ${what}`);
let lastBeaten = 0, lastFloor = 1, lastCity = 0, lastStars = 1, idle = 0, maxIdle = 0;

// O jogador olha o jogo a cada 5 s, recolhe, pega missão e compra o que for mais barato e útil
for (let t = 0; t < hours * 3600; t += 5) {
  for (let i = 0; i < 20; i++) G.tick(0.25);
  if (G.C.won) { mark(t, `ZEROU O JOGO em ${CITIES[G.C.city]}`); break; }
  const C = G.C;
  G.collectAll();
  G.claimQuest();
  if (C.event?.id === 'famoso') G.claimVip();
  if (C.beaten >= RIVALS.length) G.moveCity();
  const inc = G.S.income;
  const opts = [];
  for (const d of ROOMS) {
    if (d.floor >= C.floors) continue;
    const l = G.lv(d.id);
    if (l < G.ROOM_MAX) opts.push([G.roomCost(d, l) * (l ? 1 : 0.5), () => G.upgrade(d.id, 1)]);
    if (l && d.kind !== 'lobby' && !C.rooms[d.id].mgr) opts.push([G.mgrCost(d) * 0.4, () => G.hire(d.id)]);
  }
  if (C.floors < FLOORS.length) opts.push([G.floorCost(C.floors) * 0.6, () => G.openFloor()]);
  for (const s of STAFF) if (C.staff[s.id] < 25) opts.push([G.staffCost(s.id, C.staff[s.id]) * 1.5, () => G.train(s.id)]);
  if (C.deco < G.UPG_MAX) opts.push([G.decoCost(C.deco) * 1.5, () => G.decorate()]);
  if (C.mkt < G.UPG_MAX) opts.push([G.mktCost(C.mkt) * 1.5, () => G.advertise()]);
  opts.sort((a, b) => a[0] - b[0]);
  let bought = 0;
  for (let k = 0; k < 40; k++) {
    const before = C.money;
    const best = opts.find(([c]) => c <= C.money * 1.6);
    if (!best) break;
    best[1]();
    if (C.money === before) { opts.splice(opts.indexOf(best), 1); continue; }
    bought++;
    opts.splice(opts.indexOf(best), 1);
  }
  // Campanhas nos alunos que mais gastam
  const open = G.guestsOpen().sort((a, b) => b.spend - a.spend).map((g) => g.id);
  for (const g of open) if (G.C.targets.length < G.targetSlots() && !G.C.targets.includes(g)) G.toggleTarget(g);
  idle = bought ? 0 : idle + 5;
  maxIdle = Math.max(maxIdle, idle);
  if (G.C.floors !== lastFloor) mark(t, `abriu o andar ${G.C.floors} (${FLOORS[G.C.floors - 1].name}) · ${G.money(inc)}/s`);
  if (G.stars() !== lastStars) mark(t, `${G.stars()} estrelas`);
  if (G.C.city !== lastCity) mark(t, `abriu a academia de ${CITIES[G.C.city % CITIES.length]} (${G.C.units.length + 1}ª) · marca x${G.S.brand.toFixed(1)}`);
  if (G.C.beaten > lastBeaten) mark(t, `passou ${RIVALS[G.C.beaten - 1].name}`);
  lastBeaten = G.C.beaten;
  lastFloor = G.C.floors; lastStars = G.stars(); lastCity = G.C.city;
}
console.log(log.join('\n'));
console.log(`\nMissão atual: ${G.quest().text} · maior tempo sem conseguir comprar nada: ${Math.round(maxIdle / 60)} min`);
