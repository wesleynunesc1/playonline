// Testes de jogabilidade: node scripts/test-gameplay.mjs
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
// Golpes resolvem na hora
const realTimeout = globalThis.setTimeout;
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true }, appType: 'custom', logLevel: 'error' });
try {
  const load = (p) => server.ssrLoadModule(p);

  // ===== Cobra =====
  const S = await load('/src/games/snake.ts');
  let s = S.createSnake(true);
  S.turn(s, 'left');
  assert.equal(s.queue.length, 0, 'meia-volta deve ser ignorada');
  let r;
  for (let i = 0; i < 20 && r !== 'eat'; i++) r = S.step(s);
  assert.equal(r, 'eat');
  s.food = { x: 0, y: 0 };
  for (let i = 0; i < 20 && r !== 'dead'; i++) r = S.step(s);
  assert.equal(r, 'dead', 'parede deve matar');
  console.log('✔ Cobra');

  const E = await load('/src/engine/state.ts');
  const C = await load('/src/engine/calc.ts');
  const W = await load('/src/engine/war.ts');
  const R = await load('/src/engine/realm.ts');
  const T = await load('/src/engine/tick.ts');
  const X = await load('/src/engine/meta.ts');
  const D = await load('/src/data/content.ts');
  const { COUNTRIES, COUNTRY_IDS } = await load('/src/data/countries.ts');
  W.timing.strike = 0;
  globalThis.setTimeout = (fn, ms, ...a) => (ms === 0 ? (fn(...a), 0) : realTimeout(fn, ms, ...a));
  const G = () => E.game();
  const rich = () => {
    const g = G();
    g.money = 1e9;
    g.science = 1e6;
    for (const k in g.res) g.res[k] = 1000;
  };

  // ===== Dados =====
  for (const c of Object.values(COUNTRIES)) {
    for (const n of c.neighbors) assert.ok(COUNTRIES[n]?.neighbors.includes(c.id), `fronteira ${c.id}-${n}`);
    assert.ok(c.name && Number.isFinite(c.income) && Number.isFinite(c.anchor[0]), c.id);
  }
  assert.equal(D.TOTAL_TECHS, 45);
  console.log(`✔ ${COUNTRY_IDS.length} países, 45 tecnologias`);

  // ===== Mecânicas =====
  E.newGame('BR');
  rich();
  assert.equal(C.reach('UY'), 'terra');
  assert.equal(C.reach('MN'), null, 'Mongólia sem litoral é inalcançável');
  assert.equal(W.startAttack('MN', { inf: 10, tank: 0, air: 0, navy: 0 }, ''), false);
  assert.ok(W.usePower('paraquedas') && C.reach('MN') === 'ar');
  G().para = false;
  for (const u of D.UNITS) assert.ok(W.recruit(u, 200));
  assert.ok(W.startAttack('UY', W.suggestArmy('UY', 'g1'), 'g1') && G().battle);
  W.autoBattle();
  assert.equal(G().battle.done, 'won');
  W.closeBattle();
  assert.ok(E.isMine('UY') && G().infamy > 0);
  assert.ok(W.garrison('UY', 10) && W.garrison('UY', -5));
  for (const b of Object.keys(D.BUILDINGS)) assert.ok(R.build('UY', b), b);
  assert.ok(R.upgradeCountry('UY'));
  for (const w of D.WONDERS) { G().res.iron = 1000; assert.ok(R.buildWonder(w.id, 'UY'), w.id); }
  for (const b of D.BRANCHES) for (let i = 0; i < 5; i++) if (!R.techBlock(b.id)) R.research(b.id);
  assert.equal(G().techs.mercado, 5);
  assert.equal(G().techs.estado, 2, 'ramos rivais se excluem');
  while (G().era < 5) assert.ok(R.advanceEra());
  assert.ok(R.reachSpace() && R.reachSpace());
  for (const reg of D.REGIMES) R.setRegime(reg.id);
  assert.ok(R.trade('oil', 10) && R.trade('oil', -10));
  assert.ok(R.takeLoan() && R.payLoan() && R.payLoan());
  assert.ok(R.toggleRoute('CO') && C.budget().routes > 0);
  assert.ok(W.toggleSiege('PY') && C.budget().siege > 0);
  for (let i = 0; i < 300 && !E.isMine('PY'); i++) { T.tick(1); G().crisis = ''; G().over = null; G().threat = null; }
  assert.ok(E.isMine('PY'), 'cerco deve render');
  G().army.inf = 3000;
  assert.ok(R.vassalize('BO') && C.budget().vassals > 0);
  assert.ok(R.buyCountry('PE') && E.isMine('PE'));
  for (let i = 0; i < 30 && !E.isMine('EC'); i++) R.ultimatum('EC');
  assert.ok(E.isMine('EC'), 'ultimato');
  const rid = Object.keys(G().rivals)[0];
  const cap = () => G().rivals[rid].capital;
  for (let i = 0; i < 12; i++) R.gift(rid);
  assert.ok(R.proposeTrade(rid) && R.proposeTruce(rid) && R.proposeAlliance(rid));
  assert.ok(W.attackBlock(cap()), 'aliado não pode ser atacado');
  assert.ok(R.callAlly(rid, Object.keys(G().rivals)[1]));
  assert.ok(R.betray(rid) && G().rivals[rid].rel < 50);
  G().rivals[rid].truce = 0;
  for (const op of ['infiltrar', 'roubar', 'sabotar', 'ciber']) for (let i = 0; i < 40; i++) { R.spyOp(op, cap()); if (op === 'infiltrar' && G().rivals[rid].spy) break; }
  assert.ok(G().rivals[rid].spy && G().rivals[rid].cyber > 0);
  for (let i = 0; i < 60 && !E.isMine('CL'); i++) R.spyOp('golpe', 'CL');
  assert.ok(E.isMine('CL'), 'golpe de Estado');
  G().powers.nuclear = 0;
  const target = cap();
  const before = G().countries[target].def;
  assert.ok(W.usePower('nuclear', target) && G().countries[target].def < before);
  assert.ok(W.usePower('bombardeio', target) && W.usePower('escudo') && W.usePower('satelite'));
  T.tick(1);
  Object.assign(G(), { infamy: 80, over: null });
  T.tick(1);
  assert.ok(G().coalition, 'infâmia alta forma coalizão');
  for (const kind of ['sancao', 'paz', 'contra']) { G().vote = { rival: rid, kind, text: '' }; R.castVote(true); assert.equal(G().vote, null); }
  G().threat = { by: rid, target: 'UY', left: 0, power: 1e9 };
  W.resolveThreat();
  assert.ok(E.isMine('UY') && !G().shield, 'escudo anula');
  G().threat = { by: rid, target: 'UY', left: 0, power: 1e9 };
  W.resolveThreat();
  assert.equal(G().countries.UY.owner, rid, 'invasão toma o país');
  W.conquer(target);
  assert.equal(G().rivals[rid].alive, false, 'queda da capital desmonta o rival');
  Object.assign(G(), { over: null });
  G().rivals[rid].returnIn = 0.5;
  T.tick(1);
  assert.ok(G().rivals[rid].alive, 'arqui-inimigo volta');
  // Generais, baús, missões, prestígio
  E.M.chests = 60;
  while (X.openChest());
  assert.ok(Object.keys(E.M.generals).length > 3);
  X.addGeneralXp('g1', 500);
  assert.ok(X.learnSkill('g1', 'ofensiva'));
  E.M.items.i1 = 1;
  X.equip('g1', 'i1');
  E.M.generals.g1.captor = 'CL';
  rich();
  assert.ok(X.ransom('g1', 'troca'));
  X.refreshCalendar();
  assert.equal(E.M.daily.length, 3);
  assert.ok(E.M.weekly.length === 3 && E.M.streak === 1);
  X.refreshCalendar();
  assert.equal(E.M.streak, 1);
  E.M.season.pts = 60;
  assert.ok(X.claimSeason());
  G().army.inf = 1e6;
  assert.ok(W.fightBoss('g1'));
  W.autoBattle();
  assert.equal(E.M.items.i7, 1, 'prêmio do chefão');
  W.closeBattle();
  G().savedAt = Date.now() - 4 * 3600e3;
  mem.set('WORLD_EMPIRE_V3', JSON.stringify(G()));
  assert.ok(T.continueGame() && G().report.length >= 3, 'relatório de retorno');
  G().victories = ['cientifica'];
  assert.ok(X.doPrestige() && E.M.legacy > 0 && !E.G);
  assert.ok(X.buyPerk('p1'));
  E.newGame('AR');
  assert.ok(C.mods().income > 0);
  console.log('✔ Mecânicas');

  // ===== Campanhas jogadas por um bot =====
  const fresh = JSON.parse(JSON.stringify({ perks: {}, prestige: 0 }));
  const play = (country, mode, maxS) => {
    Object.assign(E.M, fresh, { staff: ['g1'] });
    E.newGame(country, mode);
    const g = G();
    let last = 0;
    while (g.time < maxS && !g.over) {
      T.tick(1);
      for (const k of ['money', 'science', 'infamy', 'morale']) assert.ok(Number.isFinite(g[k]), k);
      for (const u of D.UNITS) assert.ok(g.army[u] >= 0);
      if (g.crisis) { const c = (g.crisis, true); g.crisis = c ? '' : g.crisis; }
      if (g.vote) R.castVote(false);
      // Uma ação a cada 4 segundos, como uma pessoa
      if (g.time - last < 4) continue;
      last = g.time;
      const mine = E.owned();
      if (g.powers.paraquedas <= 0 && !g.para) W.usePower('paraquedas');
      const targets = COUNTRY_IDS.filter((id) => !W.attackBlock(id) && C.reach(id) && C.defensePower(id) < 1e5);
      targets.sort((a, b) => C.defensePower(a) - C.defensePower(b));
      const goal = E.scenarioOf(mode)?.goal;
      const caps = goal === 'rival' ? targets.filter((id) => Object.values(g.rivals).some((x) => x.capital === id && x.alive)) : [];
      const boss = caps.find((id) => C.attackPower(W.suggestArmy(id, 'g1'), id, 'g1') > C.defensePower(id) * 1.35);
      if (goal === 'alianca') for (const x of Object.values(g.rivals)) if (!x.ally && x.alive && (x.rel >= 50 ? R.proposeAlliance(x.id) : g.money > R.giftCost() && R.gift(x.id))) break;
      if (goal === 'espaco') { if (R.reachSpace()) continue; if (E.owned().length >= 45 && !g.threat) { if (g.science > 20000) continue; } }
      const t = boss ?? targets[0];
      if (t && (boss || g.infamy < 55)) {
        const a = W.suggestArmy(t, 'g1');
        if (C.attackPower(a, t, 'g1') > C.defensePower(t) * 1.35 && W.startAttack(t, a, 'g1')) {
          W.autoBattle();
          W.closeBattle();
          continue;
        }
      }
      const b = D.BRANCHES.find((x) => !R.techBlock(x.id) && R.techCost(x.id) <= g.science * 0.6);
      if (b) R.research(b.id);
      else if (D.ERAS[g.era + 1] && g.money > D.ERAS[g.era + 1].money * 1.2 && g.science > D.ERAS[g.era + 1].science) R.advanceEra();
      else if (goal === 'espaco' && C.armyPower(g.army) > 2500) continue;
      else {
        const site = mine.find((id) => g.countries[id].b.fabrica < 1 && C.buildCost(id, 'fabrica') < g.money * 0.5) ?? null;
        const lab = mine.find((id) => g.countries[id].b.laboratorio < 1 && C.buildCost(id, 'laboratorio') < g.money * 0.3);
        if (site && last % 8 < 4) R.build(site, 'fabrica');
        else if (lab) R.build(lab, 'laboratorio');
        else {
          const u = E.pick(D.UNITS);
          const n = Math.floor((g.money * 0.7) / C.recruitCost(u, 1));
          if (n > 0) {
            const need = D.UNIT_INFO[u].cost;
            let max = n;
            for (const k in need) max = Math.min(max, Math.floor(g.res[k] / need[k]));
            if (max > 0) W.recruit(u, max);
            else R.trade(Object.keys(need)[0], Math.max(1, Math.floor((g.money * 0.2) / g.prices[Object.keys(need)[0]])));
          }
        }
      }
    }
    return g;
  };
  for (const c of ['BR', 'UY', 'PL', 'EG']) {
    const g = play(c, 'livre', 2 * 3600);
    const live = Object.values(g.rivals).filter((x) => x.alive).length;
    console.log(`  ${c}: ${Math.round(g.time / 60)} min, ${E.owned().length} países, rivais vivos ${live}, ${g.over?.title ?? 'sem fim'}`);
    assert.ok(g.over, `${c}: partida sem desfecho em 2h`);
  }
  for (const sc of [...D.SCENARIOS, ...D.CAMPAIGN]) {
    const g = play(sc.country ?? 'BR', sc.id, sc.special === 'ondas' ? 1800 : 7200);
    console.log(`  ${sc.name}: ${Math.round(g.time / 60)} min, ${E.owned().length} países, ${g.over?.title ?? 'sem fim'} ${sc.special === 'ondas' ? `onda ${g.wave}` : ''}`);
    if (sc.special !== 'ondas') assert.ok(g.over?.won, `${sc.name}: objetivo não alcançado`);
  }
} finally {
  globalThis.setTimeout = realTimeout;
  await server.close();
}
process.exit(0);
