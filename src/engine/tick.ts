import { COUNTRIES, COUNTRY_IDS, distance } from '../data/countries';
import { JOKES, RESOURCES, RES_INFO, RIVALS, TOTAL_TECHS } from '../data/content';
import { ACHIEVEMENTS } from '../data/achievements';
import { formatMoney, formatDuration } from '../utils/formatters';
import { TAX_INFO, armyPower, budget, defensePower, mods, production, reach, scienceRate } from './calc';
import { addXp, completeScenario, track } from './meta';
import { randomCrisis } from './realm';
import { Game, M, PLAYER, Rival, ZOMBIES, bump, clamp, fail, game, hooks, loadSave, news, ok, owned, pick, rand, rivalDef, save, scenarioOf, setGame } from './state';
import { changeMorale, conquer, loseCountry, lostCountry, remember, resolveThreat } from './war';

/** Passagem do tempo: economia, rivais, eventos e vitória. */

const THREAT_WARNING = 25;
const OFFLINE_LIMIT_S = 8 * 3600;

export function tick(seconds: number, blocked = false) {
  const g = game();
  if (!g || g.paused || g.over || g.battle || blocked) return;
  const dt = seconds * g.speed;
  g.time += dt;
  economy(g, dt);
  timers(g, dt);
  // Vários passos curtos para a velocidade 5x não pular decisões dos rivais
  for (const r of Object.values(g.rivals)) rivalTick(g, r, dt);
  coalition(g);
  if (g.threat) {
    g.threat.left -= dt;
    if (g.threat.left <= 0 && !g.strike) resolveThreat();
  }
  achievements(g);
  victory(g);
  bump();
}

function economy(g: Game, dt: number) {
  const m = mods();
  const b = budget(m);
  g.money += b.total * dt;
  track('earned', Math.max(0, Math.round(b.total * dt)));
  g.science += scienceRate(m) * dt;
  const prod = production(m);
  for (const r of RESOURCES) g.res[r] += prod[r] * dt;
  g.infamy = Math.max(0, g.infamy - 0.06 * dt);
  g.morale += (1 - g.morale) * Math.min(1, 0.004 * dt);
  g.satellite = Math.max(0, g.satellite - dt);
  g.sanction = Math.max(0, g.sanction - dt);
  for (const p in g.powers) g.powers[p as 'escudo'] = Math.max(0, g.powers[p as 'escudo'] - dt);

  if (g.money < 0) {
    g.debt += -g.money;
    g.money = 0;
  }
  if (g.debt > (3000 + b.taxes * 120) * 1.5) {
    // Falência: credores levam parte do exército e a felicidade despenca
    g.debt = 0;
    for (const u of ['inf', 'tank', 'air', 'navy'] as const) g.army[u] = Math.floor(g.army[u] * 0.5);
    for (const id of owned()) g.countries[id].happy = Math.max(0, g.countries[id].happy - 30);
    news('FALÊNCIA! Credores confiscam metade do seu exército.', 'market');
    fail('Seu império faliu!');
  }

  const happyTarget = clamp(68 + TAX_INFO[g.tax].happy + m.happy - Math.min(15, owned().length * 0.2), 0, 100);
  for (const id of COUNTRY_IDS) {
    const c = g.countries[id];
    c.sab = Math.max(0, c.sab - dt);
    c.cyber = Math.max(0, c.cyber - dt);
    if (c.owner === PLAYER) {
      c.happy += (happyTarget - c.happy) * Math.min(1, 0.02 * dt);
      const cap = 12 + c.b.quartel * 15 + COUNTRIES[id].defense * 0.2;
      if (c.def < cap) c.def += 0.04 * dt;
    } else if (c.siege) {
      c.def -= Math.max(0.2, c.def * 0.012) * (1 + m.siege) * dt;
      if (c.def < COUNTRIES[id].defense * 0.25) {
        c.siege = false;
        conquer(id);
        track('sieges');
        ok(`${COUNTRIES[id].name} se rendeu ao cerco!`);
      }
    }
  }
}

function timers(g: Game, dt: number) {
  const t = g.timers;
  const due = (k: keyof Game['timers'], every: number) => {
    t[k] -= dt;
    if (t[k] > 0) return false;
    t[k] = every;
    return true;
  };
  if (due('market', 12)) {
    for (const r of RESOURCES) {
      const base = RES_INFO[r].price;
      g.prices[r] = clamp(g.prices[r] * rand(0.92, 1.085) + (base - g.prices[r]) * 0.04, base * 0.3, base * 4);
    }
  }
  if (due('joke', rand(35, 60))) news(pick(JOKES), 'fun');
  if (due('event', rand(90, 140)) && !g.strike) {
    g.crisis = randomCrisis();
    hooks.sound('alert');
  }
  if (due('vote', 240)) proposeVote(g);
  if (due('revolt', 30)) {
    for (const id of owned()) {
      const c = g.countries[id];
      if (id === g.capital || c.happy > 25 || Math.random() > 0.3) continue;
      loseCountry(id, '');
      news(`Revolta! ${COUNTRIES[id].name} declara independência.`, 'war');
      fail(`${COUNTRIES[id].name} se rebelou. Baixe impostos ou aumente a felicidade.`);
      break;
    }
  }
  if (due('raid', rand(70, 120))) {
    const routes = COUNTRY_IDS.filter((id) => g.countries[id].route);
    const foe = Object.values(g.rivals).find((r) => r.alive && r.rel < -10 && !r.ally);
    if (routes.length && foe) {
      const id = pick(routes);
      g.countries[id].route = false;
      const loss = Math.round(Math.min(g.money * 0.08, 3000));
      g.money -= loss;
      news(`${rivalDef(foe.id).title} saqueou sua rota com ${COUNTRIES[id].name} (-${formatMoney(loss)}).`, 'market');
    }
  }
  const special = scenarioOf(g.mode)?.special;
  if (special && due('special', special === 'ondas' ? 50 : 35)) specialTick(g, special);
}

function proposeVote(g: Game) {
  const live = Object.values(g.rivals).filter((r) => r.alive);
  if (!live.length) return;
  if (g.infamy > 45) g.vote = { rival: '', kind: 'contra', text: 'O mundo propõe sanções contra VOCÊ. Aceita pagar 10% do tesouro como reparação?' };
  else if (Math.random() < 0.5) {
    const r = pick(live);
    g.vote = { rival: r.id, kind: 'sancao', text: `Aplicar sanções a ${rivalDef(r.id).title}?` };
  } else g.vote = { rival: '', kind: 'paz', text: 'Cessar-fogo mundial de 1 minuto?' };
}

function specialTick(g: Game, special: 'zumbis' | 'aliens' | 'ondas') {
  if (special === 'zumbis') {
    const z = owned(ZOMBIES);
    if (!z.length) return;
    const near = [...new Set(z.flatMap((id) => COUNTRIES[id].neighbors))].filter((id) => g.countries[id].owner !== ZOMBIES);
    if (!near.length) return;
    const id = pick(near);
    const c = g.countries[id];
    if (c.owner === PLAYER) threaten(g, ZOMBIES, id, 30 + g.time * 0.12);
    else {
      const before = c.owner;
      Object.assign(c, { owner: ZOMBIES, def: Math.round(COUNTRIES[id].defense * 0.9), vassal: false, route: false });
      if (g.rivals[before]) lostCountry(before, id);
      news(`Zumbis tomam ${COUNTRIES[id].name}!`, 'war');
    }
  } else {
    g.wave++;
    if (special === 'ondas') {
      M.waveRecord = Math.max(M.waveRecord, g.wave - 1);
      addXp(5);
    }
    const strength = special === 'ondas' ? 30 + g.wave * 16 * (1 + g.wave * 0.12) : 60 + g.time * 0.3;
    threaten(g, special === 'ondas' ? 'onda' : 'alien', pick(owned()), strength);
  }
}

function threaten(g: Game, by: string, target: string, power: number) {
  if (g.threat) return;
  g.threat = { by, target, left: THREAT_WARNING, power };
  hooks.sound('alert');
}

// ===== Rivais =====
function rivalTick(g: Game, r: Rival, dt: number) {
  const def = rivalDef(r.id);
  if (!r.alive) {
    if (r.returnIn > 0) {
      r.returnIn -= dt;
      if (r.returnIn <= 0) nemesisReturn(g, r);
    }
    return;
  }
  r.truce = Math.max(0, r.truce - dt);
  r.sanction = Math.max(0, r.sanction - dt);
  r.cyber = Math.max(0, r.cyber - dt);
  r.warTime = Math.max(0, r.warTime - dt);
  if (r.war && (r.warTime <= 0 || !g.rivals[r.war]?.alive)) r.war = '';
  const mine = owned(r.id);
  const income = mine.reduce((s, id) => s + COUNTRIES[id].income, 0);
  r.power += income * 0.009 * (def.personality === 'comerciante' ? 1.2 : 1) * (r.cyber > 0 ? 0.2 : 1) * (r.sanction > 0 ? 0.5 : 1) * (1 + M.prestige * 0.1) * dt;
  r.power = Math.min(r.power, 500 + mine.length * 150);
  r.rel = clamp(r.rel + (r.ally ? 0.02 : r.rel < 0 ? 0.015 : 0) * dt - (g.infamy > 40 ? 0.03 : 0) * dt, -100, 100);

  // Aliado traiçoeiro
  if (r.ally && def.personality === 'traidor' && Math.random() < 0.0012 * dt) {
    r.ally = false;
    r.rel = -40;
    remember(r.id, 'Traiu você.');
    news(`TRAIÇÃO! ${def.leader}: "${def.war}"`, 'war');
    fail(`${def.leader} traiu a aliança!`);
  }
  r.next -= dt;
  if (r.next > 0) return;
  r.next = rand(18, 34) * (def.personality === 'agressivo' ? 0.8 : def.personality === 'pacifico' ? 1.5 : 1);

  // Guerra entre rivais
  if (!r.war && Math.random() < (def.personality === 'pacifico' ? 0.05 : 0.15)) {
    const foe = Object.values(g.rivals).find((o) => o.alive && o !== r && mine.some((id) => COUNTRIES[id].neighbors.some((n) => g.countries[n].owner === o.id)));
    if (foe) {
      r.war = foe.id;
      r.warTime = 120;
      foe.war ||= r.id;
      foe.warTime = 120;
      news(`${def.title} e ${rivalDef(foe.id).title} entram em guerra!`, 'war');
    }
  }

  // Ataque ao jogador
  const hostile = !r.ally && r.truce <= 0 && (g.coalition || r.rel < -15 - (def.personality === 'pacifico' ? 30 : 0) || (def.personality === 'agressivo' && r.rel < 15));
  if (hostile && !g.threat && Math.random() < 0.5 + Math.min(0.3, r.grudge * 0.04)) {
    const targets = owned().filter((id) => reach(id, r.id));
    if (targets.length) {
      const target = targets.reduce((best, id) => (defensePower(id) < defensePower(best) ? id : best));
      const force = r.power * rand(0.3, 0.45) * (r.nemesis ? 1.2 : 1);
      // Não se suicida contra defesas muito superiores
      if (force > defensePower(target) * 0.55) {
        threaten(g, r.id, target, force);
        news(`${def.leader}: "${r.grudge > 3 ? def.revenge : def.war}"`, 'war');
        return;
      }
    }
  }

  // Expansão
  const candidates = [...new Set(mine.flatMap((id) => COUNTRIES[id].neighbors))].filter((id) => {
    const c = g.countries[id];
    return !c.vassal && (c.owner === '' || c.owner === ZOMBIES || (r.war && c.owner === r.war));
  });
  if (!candidates.length) {
    const from = pick(mine);
    const sea = COUNTRY_IDS.filter((id) => g.countries[id].owner === '' && !g.countries[id].vassal && COUNTRIES[id].coastal && distance(from, id) < 35);
    candidates.push(...sea);
  }
  if (!candidates.length) return;
  const strength = (id: string) => {
    const c = g.countries[id];
    const foe = g.rivals[c.owner];
    return (c.owner ? c.def : COUNTRIES[id].defense) + (foe ? foe.power * (foe.capital === id ? 0.5 : 0.15) : 0);
  };
  const target = candidates.reduce((best, id) => (strength(id) < strength(best) ? id : best));
  const need = strength(target);
  if (r.power * 0.6 < need) return;
  const c = g.countries[target];
  const before = c.owner;
  r.power -= need * 0.3;
  Object.assign(c, { owner: r.id, def: Math.round(COUNTRIES[target].defense * 0.6), route: false, siege: false, spy: false });
  if (g.rivals[before]) lostCountry(before, target);
  news(`${def.title} conquista ${COUNTRIES[target].name}.`, 'war');
}

function nemesisReturn(g: Game, r: Rival) {
  const free = COUNTRY_IDS.filter((id) => g.countries[id].owner === '' && !g.countries[id].vassal);
  if (!free.length) return;
  const home = free.reduce((b, id) => (COUNTRIES[id].income > COUNTRIES[b].income ? id : b));
  const def = RIVALS.find((x) => x.id === r.id)!;
  Object.assign(r, { alive: true, capital: home, power: 250 + owned().length * 20, rel: -80, truce: 0, next: 20 });
  g.countries[home].owner = r.id;
  g.countries[home].def = Math.round(g.countries[home].def * 1.4);
  news(`${def.leader} VOLTOU em ${COUNTRIES[home].name}! "${def.revenge}"`, 'war');
  fail(`Seu arqui-inimigo ${def.leader} está de volta!`);
  hooks.sound('alert');
}

function coalition(g: Game) {
  const should = g.coalition ? g.infamy > 40 : g.infamy >= 65;
  if (should === g.coalition) return;
  g.coalition = should;
  if (should) {
    for (const r of Object.values(g.rivals)) {
      r.trade = false;
      if (r.rel < 60) r.ally = false;
    }
    news('COALIZÃO MUNDIAL formada contra você!', 'war');
    hooks.sound('alert');
  } else news('A coalizão mundial se desfez.');
}

function achievements(g: Game) {
  const p = {
    money: g.money, militaryPower: armyPower(g.army), conqueredCount: owned().length,
    incomePerSecond: budget().total, unlockedTechsCount: Object.values(g.techs).reduce((a, b) => a + b, 0),
  };
  for (const a of ACHIEVEMENTS) {
    if (g.achievements.includes(a.id) || !a.isCompleted(p)) continue;
    g.achievements.push(a.id);
    g.money += a.rewardMoney;
    g.army.inf += Math.round(a.rewardMilitary / 3);
    addXp(20);
    hooks.sound('tech');
    ok(`🏆 ${a.title}: +${formatMoney(a.rewardMoney)}`);
  }
}

// ===== Vitória =====
export const VICTORIES = [
  { id: 'militar', name: 'Militar', icon: '⚔️', text: '70 países, ou 40 sem nenhum rival de pé' },
  { id: 'economica', name: 'Econômica', icon: '💰', text: '$ 500 mil em caixa e $ 1.500/s' },
  { id: 'diplomatica', name: 'Diplomática', icon: '🕊️', text: 'Aliança com todos os rivais vivos (mínimo 3), após 8 minutos' },
  { id: 'cientifica', name: 'Científica', icon: '🚀', text: 'Chegar a Marte' },
];
export function victoryProgress(id: string): number {
  const g = game();
  const live = Object.values(g.rivals).filter((r) => r.alive);
  const n = owned().length;
  if (id === 'militar') return Math.max(n / 70, live.length ? 0 : n / 40);
  if (id === 'economica') return Math.min(g.money / 500000, budget().total / 1500);
  if (id === 'diplomatica') return Math.min(g.time / 480, live.filter((r) => r.ally).length / Math.max(3, live.length));
  return Math.max(g.space / 2, (Object.values(g.techs).reduce((a, b) => a + b, 0) / TOTAL_TECHS) * 0.3, g.era / 10);
}
export function scenarioProgress(g: Game): { have: number; need: number } | null {
  const sc = scenarioOf(g.mode);
  if (!sc) return null;
  const have = {
    paises: owned().length, rival: g.defeated, renda: Math.floor(budget().total), espaco: g.space, sobreviver: g.wave,
    alianca: Object.values(g.rivals).filter((r) => r.ally).length + Object.values(g.countries).filter((c) => c.vassal).length,
  }[sc.goal];
  return { have, need: sc.target };
}
function victory(g: Game) {
  if (g.over) return;
  const sp = scenarioProgress(g);
  if (sp) {
    const zombiesGone = scenarioOf(g.mode)?.special === 'zumbis' && !owned(ZOMBIES).length;
    if ((sp.have >= sp.need || zombiesGone) && !g.victories.includes('cenario')) {
      g.victories.push('cenario');
      completeScenario(g.mode);
      g.over = { won: true, title: 'Objetivo cumprido!', text: `${scenarioOf(g.mode)!.name} concluído. +3 baús.` };
      hooks.sound('win');
    }
    return;
  }
  for (const v of VICTORIES) {
    if (g.victories.includes(v.id) || victoryProgress(v.id) < 1) continue;
    g.victories.push(v.id);
    M.chests += 5;
    addXp(300);
    g.over = { won: true, title: `Vitória ${v.name}!`, text: `${v.text}. Tempo: ${formatDuration(g.time)}. +5 baús.` };
    hooks.sound('win');
    return;
  }
}

/** Próximo objetivo sugerido, sempre visível */
export function nextGoal(): string {
  const g = game();
  const sc = scenarioOf(g.mode);
  const sp = scenarioProgress(g);
  if (g.stats.conquests === 0) return 'Toque em um país vizinho destacado em amarelo e prepare seu primeiro ataque';
  if (g.stats.upgrades === 0) return 'Toque em um país seu e construa uma Fábrica';
  if (g.stats.techs === 0 && g.science >= 20) return 'Abra Ciência e pesquise sua primeira tecnologia';
  if (M.chests > 0) return `Você tem ${M.chests} baú(s) para abrir em Generais`;
  if (g.countries[g.capital].happy < 35) return 'Seu povo está infeliz: baixe os impostos';
  if (sc && sp) return `${sc.name}: ${sc.text} (${sp.have}/${sp.need})`;
  const best = [...VICTORIES].sort((a, b) => victoryProgress(b.id) - victoryProgress(a.id))[0];
  return `Rumo à vitória ${best.name.toLowerCase()}: ${Math.floor(clamp(victoryProgress(best.id), 0, 1) * 100)}%`;
}

// ===== Retorno =====
export function continueGame(): boolean {
  const g = loadSave();
  if (!g) return false;
  setGame(g);
  const away = Math.min(OFFLINE_LIMIT_S, (Date.now() - g.savedAt) / 1000);
  if (away > 60 && !g.paused) awayReport(g, away);
  g.threat = null;
  save();
  bump();
  return true;
}
/** O mundo continua andando na ausência (até 8 horas), sem tirar países do jogador */
export function awayReport(g: Game, seconds: number) {
  const b = Math.max(0, budget().total) * 0.5;
  const money = Math.round(b * seconds);
  g.money += money;
  const science = Math.round(scienceRate() * seconds * 0.25);
  g.science += science;
  const lines = [`Você ficou fora por ${formatDuration(seconds)}.`, `💰 Tesouro: +${formatMoney(money)}`, `🔬 Ciência: +${science}`];
  const moves = Math.min(6, Math.floor(seconds / 1800) + 1);
  const seen = g.news.length;
  for (let i = 0; i < moves; i++) {
    for (const r of Object.values(g.rivals)) {
      if (!r.alive) continue;
      const free = owned(r.id).flatMap((id) => COUNTRIES[id].neighbors).filter((id) => g.countries[id].owner === '' && !g.countries[id].vassal);
      if (!free.length || Math.random() < 0.6) continue;
      const id = pick(free);
      g.countries[id].owner = r.id;
      lines.push(`🗺️ ${rivalDef(r.id).title} tomou ${COUNTRIES[id].name}.`);
    }
  }
  const angry = Object.values(g.rivals).filter((r) => r.alive && !r.ally).sort((a, c) => a.rel - c.rel)[0];
  if (angry) lines.push(`⚠️ ${rivalDef(angry.id).leader} prepara tropas na fronteira.`);
  changeMorale(0.05);
  g.news.length = Math.min(g.news.length, seen);
  g.report = lines.slice(0, 10);
}
