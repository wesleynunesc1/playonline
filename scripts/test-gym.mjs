// Joga o Magnata Fitness do zero até o final como um dono cuidadoso e mostra o ritmo e as contas.
// Uso: node scripts/test-gym.mjs [anos de jogo]
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
const { ZONE, STAFF, CITIES, DAY, PLOTS } = G;

const years = Number(process.argv[2] ?? 12);
G.load();
const log = [];
const real = (day) => `${((day * DAY) / 3600).toFixed(1).padStart(5)}h`;
const mark = (what) => log.push(`${real(G.C.day)}  ${G.dateText().padEnd(18)} ${what}`);
const plan = ['cardio', 'pesolivre', 'lanchonete', 'musculacao', 'vestiario', 'spinning', 'suplementos', 'funcional', 'cardio', 'musculacao', 'ringue', 'danca', 'pesolivre', 'yoga', 'nutri', 'pilates', 'natacao', 'fisio', 'sauna', 'crio'];
let lastUnits = 1, lastQuest = 0, minMoney = Infinity;

for (let day = 0; day < years * 360; day++) {
  for (let i = 0; i < DAY; i++) G.tick(1);
  const C = G.C;
  minMoney = Math.min(minMoney, C.money);
  C.units.forEach((u, idx) => {
    G.setActive(idx);
    const f = G.flow(u);
    for (const st of STAFF) if (st.ratio && u.staff[st.id] < G.need(u, st.id)) G.hire(st.id, 1);
    if (u.budget < 1 && f.profit > 3_000) G.setBudget(1);
    if (u.budget < 2 && f.revenue > 25_000) G.setBudget(2);
    if (u.budget < 3 && f.revenue > 120_000) G.setBudget(3);
    if (u.recep < 6 && C.money > G.recepCost(u.recep + 1) * 3) G.buyMachine(u.spaces.findIndex((x) => x?.zone === 'recepcao'));
    if (u.deco < 6 && C.money > G.decoCost(u.deco) * 4) G.decorate();
    if (f.crowd < 0.82 || C.money < 5_000) return;
    // Lotou: compra aparelho onde cabe; sem lugar, monta zona nova; sem salão, aluga
    const spot = u.spaces.findIndex((x) => x?.zone && ZONE[x.zone].train && x.n < ZONE[x.zone].max);
    if (spot >= 0) return G.buyMachine(spot);
    const empty = u.spaces.findIndex((x) => x && !x.zone);
    if (empty >= 0) {
      const used = u.spaces.filter((x) => x?.zone).map((x) => x.zone);
      const z = plan.find((id, k) => plan.slice(0, k + 1).filter((p) => p === id).length > used.filter((x) => x === id).length) ?? 'musculacao';
      return G.setZone(empty, z);
    }
    const p = G.nextPlot(u);
    if (p >= 0) G.rentPlot(p);
  });
  // Rede: abre a próxima cidade quando sobra dinheiro
  const next = CITIES.findIndex((_, i) => !C.units.some((u) => u.city === i));
  if (next > 0 && C.money > CITIES[next].open * 2.2 && G.S.profit > 30_000) G.openUnit(next);
  G.setActive(0);
  if (C.units.length !== lastUnits) mark(`abriu a academia de ${CITIES[C.units.at(-1).city].name} (${C.units.length}ª)`);
  if (C.quest !== lastQuest) mark(`✓ objetivo ${lastQuest + 1}`);
  lastUnits = C.units.length;
  lastQuest = C.quest;
  if (day % 360 === 359) mark(`fim do ano: caixa ${G.money(C.money)} · ${G.people(G.S.members)} alunos · lucro ${G.money(G.S.profit)}/mês · ${C.units.map((u) => `${CITIES[u.city].name.slice(0, 4)} ${u.spaces.filter(Boolean).length}/${PLOTS.length} ${G.rank(u)}º`).join(' ')}`);
  if (C.won) { mark('ZEROU O JOGO'); break; }
}
const L = G.C.last;
console.log(log.join('\n'));
console.log(`\nÚltimo mês (${L?.month}): entrou ${G.money(L?.revenue ?? 0)} · ${Object.entries(L?.costs ?? {}).map(([k, v]) => `${k} ${G.money(v)}`).join(' · ')} · lucro ${G.money(L?.profit ?? 0)}`);
console.log(`Menor saldo: ${G.money(minMoney)} · objetivo atual: ${G.quest()?.text ?? 'todos cumpridos'}`);
