// Testes de jogabilidade: node scripts/test-gameplay.mjs
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' });
try {
  // ===== Cobra =====
  const S = await server.ssrLoadModule('/src/games/snake.ts');
  let g = S.createSnake(true);
  S.turn(g, 'left');
  assert.equal(g.queue.length, 0, 'meia-volta deve ser ignorada');
  let r;
  for (let i = 0; i < 20 && r !== 'eat'; i++) r = S.step(g);
  assert.equal(r, 'eat');
  assert.equal(g.body.length, 5);
  assert.equal(g.score, S.FOOD_POINTS);
  g.food = { x: 0, y: 0 };
  for (let i = 0; i < 20 && r !== 'dead'; i++) r = S.step(g);
  assert.equal(r, 'dead', 'parede deve matar');

  g = S.createSnake(false);
  g.food = { x: 0, y: 0 };
  for (let i = 0; i < 40; i++) assert.equal(S.step(g), 'move', 'sem paredes a cobra atravessa');

  g = S.createSnake(true);
  Object.assign(g, {
    body: [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }],
    dir: 'up', queue: ['right'], food: { x: 0, y: 0 },
  });
  assert.equal(S.step(g), 'move', 'pode entrar na célula que a cauda libera');
  console.log('✔ Cobra');

  // ===== World Empire: um bot simples joga campanhas completas =====
  const { useGameStore: store } = await server.ssrLoadModule('/src/stores/useGameStore.ts');
  const F = await server.ssrLoadModule('/src/utils/formulas.ts');
  const { TECHNOLOGIES } = await server.ssrLoadModule('/src/data/technologies.ts');
  const { TOTAL_COUNTRIES } = await server.ssrLoadModule('/src/data/countries.ts');
  F.BALANCE.STRIKE_DURATION_MS = 0;

  for (const country of ['BRA', 'URY', 'USA']) {
    store.getState().startNewGame(country);
    for (let t = 0; t < 4 * 3600; t++) {
      store.getState().gameTick(1);
      if (store.getState().strike) await new Promise((ok) => setTimeout(ok, 5));
      const st = store.getState();
      if (st.victoryShown) break;
      if (st.activeModal === 'crisis_event') {
        const c = st.activeCrisisEvent.choices.find((x) => !x.costMoney || x.costMoney <= st.money);
        assert.ok(c, `evento sem saída: ${st.activeCrisisEvent.id}`);
        st.resolveCrisisEvent(c.id);
        continue;
      }
      if (st.activeModal) {
        st.closeModal();
        continue;
      }
      const mods = st.getModifiers();
      const target = Object.values(st.countries).filter((c) => c.owner !== 'player').sort((a, b) => a.defense - b.defense)[0];
      if (target && F.calculateWinChance(F.getAttackStrength(st.militaryPower, mods), F.getEffectiveDefense(target), mods.winChanceBonus) >= 75) {
        st.attackCountry(target.id);
        continue;
      }
      const has = (id) => !id || st.unlockedTechIds.includes(id);
      const tech = TECHNOLOGIES.find((x) => !has(x.id) && has(x.requiredTechId) && x.cost <= st.money);
      const upgrade = Object.values(st.countries).find((c) => c.owner === 'player' && c.economyLevel < 4 && st.getUpgradeCost(c.id) <= st.money);
      if (tech) st.unlockTech(tech.id);
      else if (upgrade && t % 3 === 0) st.upgradeCountryEconomy(upgrade.id);
      else if (st.money >= st.getRecruitCost()) st.recruitMilitary(1);
      const v = store.getState();
      assert.ok(Number.isFinite(v.money) && v.money >= 0 && v.militaryPower >= 0);
    }
    const end = store.getState();
    assert.ok(end.victoryShown, `${country}: campanha não vencida (${end.getConqueredTerritoriesCount()}/${TOTAL_COUNTRIES})`);
    console.log(`✔ ${country}: vitória em ${Math.round(end.totalPlayTimeSeconds / 60)} min (1x)`);
  }
} finally {
  await server.close();
}
process.exit(0);
