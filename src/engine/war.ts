import { COUNTRIES, distance } from '../data/countries';
import { GENERALS, POWERS, Power, UNITS, UNIT_INFO, Unit } from '../data/content';
import { SHIP_CAPACITY, armyPower, attackPower, defensePower, generalStats, landTroops, mods, reach, recruitCost, revealed, winChance } from './calc';
import { addGeneralXp, addXp, freeGenerals, track, weekKey } from './meta';
import { Army, Battle, M, PLAYER, STRIKE_IMPACT, STRIKE_MS, StrikeKind, Tactic, ZOMBIES, bump, cheat, clamp, emptyArmy, fail, game, hooks, isHuman, isMine, net, news, ok, owned, ownerName, pick, rand, rivalDef, save, scar } from './state';

/** Batalhas, poderes, cercos e defesa. */

export function recruit(u: Unit, n: number) {
  const g = game();
  const cost = recruitCost(u, n);
  if (g.money < cost) return fail('Dinheiro insuficiente.');
  const need = UNIT_INFO[u].cost;
  for (const r in need) {
    if (g.res[r as 'oil'] < need[r as 'oil']! * n) return fail('Faltam recursos. Compre no mercado.');
  }
  for (const r in need) g.res[r as 'oil'] -= need[r as 'oil']! * n;
  g.money -= cost;
  g.army[u] += n;
  // Recrutas novos diluem a experiência dos veteranos
  g.vet *= 1 - n / Math.max(n, UNITS.reduce((s, x) => s + g.army[x], 0)) * 0.6;
  track('recruited', n);
  hooks.sound('recruit');
  bump();
  return true;
}

/** Move infantaria entre a reserva e a guarnição de um país */
export function garrison(id: string, n: number) {
  const g = game();
  const c = g.countries[id];
  if (!isMine(id)) return false;
  const move = n > 0 ? Math.min(n, Math.floor(g.army.inf)) : -Math.min(-n, Math.floor(c.def));
  if (!move) return fail('Sem tropas para mover.');
  g.army.inf -= move;
  c.def += move;
  hooks.sound('recruit');
  bump();
  return true;
}

export function changeMorale(n: number) {
  const g = game();
  g.morale = clamp(g.morale + n, 0.7, 1.3);
}

// ===== Diplomacia que impede ataques =====
export function attackBlock(target: string): string {
  const g = game();
  const c = g.countries[target];
  const r = g.rivals[c.owner];
  if (c.owner === PLAYER) return 'O país já é seu.';
  if (c.vassal) return 'Este país é seu vassalo.';
  if (cheat.free) return g.strike || g.battle ? 'Há um ataque em andamento.' : '';
  if (r?.ally) return 'É seu aliado. Rompa a aliança na Diplomacia para atacar.';
  if (r && r.truce > 0) return `Trégua em vigor: ${Math.ceil(r.truce)}s.`;
  if (g.strike || g.battle) return 'Há um ataque em andamento.';
  return '';
}

/** Monta a tropa mínima para vencer com folga */
export function suggestArmy(target: string, general: string): Army {
  const g = game();
  const way = reach(target);
  const out = emptyArmy();
  const goal = defensePower(target) * 1.5;
  const coast = COUNTRIES[target].coastal;
  if (way === 'mar') out.navy = Math.floor(g.army.navy);
  for (const u of ['air', 'tank', 'inf', 'navy'] as Unit[]) {
    if (u === 'navy' && (!coast || way === 'mar')) continue;
    const step = Math.max(1, Math.floor(g.army[u] / 20));
    while (out[u] + step <= g.army[u] && attackPower(out, target, general) < goal) {
      if (way === 'mar' && u !== 'navy' && landTroops(out) + step > out.navy * SHIP_CAPACITY) break;
      out[u] += step;
    }
  }
  return out;
}

const STANCES: Tactic[] = ['avancar', 'flanquear', 'atrair'];
/** Cada tática vence a próxima: avançar > atrair > flanquear > avançar */
const BEATS: Record<Tactic, Tactic> = { avancar: 'atrair', atrair: 'flanquear', flanquear: 'avancar' };
export const TACTICS: Record<Tactic, { name: string; icon: string; vs: string }> = {
  avancar: { name: 'Avançar', icon: '⚔️', vs: 'vence quem recua' },
  flanquear: { name: 'Flanquear', icon: '↪️', vs: 'vence quem avança' },
  atrair: { name: 'Recuar e atrair', icon: '🪤', vs: 'vence quem flanqueia' },
};

function rollStance(b: Battle) {
  const g = game();
  const owner = b.boss ? '' : g.countries[b.target].owner;
  b.stance = pick(STANCES);
  const accuracy = revealed(owner) ? 0.97 : 0.6 + generalStats(b.general).read;
  b.hint = Math.random() < accuracy ? b.stance : pick(STANCES.filter((s) => s !== b.stance));
}
function createBattle(target: string, army: Army, general: string, a: number, d: number, boss = false): Battle {
  const b: Battle = { target, army, general, a0: a, d0: d, a, d, round: 1, stance: 'avancar', hint: 'avancar', log: [], done: '', boss, summary: [] };
  rollStance(b);
  return b;
}

let launched: Army | null = null;
export function startAttack(target: string, army: Army, general: string) {
  const g = game();
  const block = attackBlock(target);
  if (block) return fail(block);
  const way = reach(target);
  if (!way) return fail('Fora de alcance: conquiste vizinhos, construa portos ou use paraquedistas.');
  if (UNITS.some((u) => army[u] < 0 || army[u] > g.army[u])) return fail('Tropas inválidas.');
  if (armyPower(army) < 5) return fail('Envie mais tropas.');
  if (way === 'mar' && landTroops(army) > army.navy * SHIP_CAPACITY) return fail(`Cada navio leva ${SHIP_CAPACITY} tropas. Envie mais navios.`);
  if (M.generals[general]?.captor) general = '';
  for (const u of UNITS) g.army[u] -= army[u];
  launched = { ...army };
  if (way === 'ar') g.para = false;
  const owner = g.countries[target].owner;
  if (g.rivals[owner]) provoke(owner, 25, `Você atacou ${COUNTRIES[target].name}.`);
  const battle = createBattle(target, { ...army }, general, attackPower(army, target, general), defensePower(target));
  const from = owned().reduce((best, id) => (distance(id, target) < distance(best, target) ? id : best), g.capital);
  launch(from, target, way);
  if (isHuman(owner)) net.incoming(owner, target);
  bump();
  setTimeout(() => {
    if (game() !== g || !g.strike) return;
    g.strike = null;
    g.battle = battle;
    bump();
  }, STRIKE_MS[way] * timing.strike);
  return true;
}
/** Multiplicador da duração dos lançamentos; os testes zeram */
export const timing = { strike: 1 };
function launch(from: string, to: string, kind: StrikeKind) {
  const g = game();
  g.strike = { from, to, kind, key: ++g.seq };
}

export function battleRound(tactic: Tactic) {
  const g = game();
  const b = g.battle;
  if (!b || b.done) return;
  const good = BEATS[tactic] === b.stance;
  const bad = BEATS[b.stance] === tactic;
  const mine = good ? 1.35 : bad ? 0.75 : 1;
  const dealt = b.a0 * 0.3 * mine * rand(0.85, 1.15);
  const taken = (b.d0 * 0.3 * rand(0.85, 1.15)) / mine;
  b.d = cheat.win ? 0 : Math.max(0, b.d - dealt);
  if (!cheat.win) b.a = Math.max(0, b.a - taken);
  b.last = tactic;
  b.log = [`${good ? '✅' : bad ? '❌' : '➖'} ${TACTICS[tactic].name} contra ${TACTICS[b.stance].name.toLowerCase()}`, ...b.log].slice(0, 5);
  b.round++;
  if (b.d <= 0 && (b.a > 0 || dealt >= taken)) endBattle('won');
  else if (b.a <= 0) endBattle('lost');
  else rollStance(b);
  bump();
}
export function retreat() {
  endBattle('fled');
  bump();
}
/** Tática que vence o palpite dos batedores */
export const autoPick = (): Tactic => STANCES.find((t) => BEATS[t] === game().battle?.hint) ?? 'avancar';
export function autoBattle() {
  const b = game().battle;
  for (let i = 0; b && !b.done && i < 30; i++) battleRound(autoPick());
}
/** Escudo do outro jogador: as tropas voltam para casa */
export function cancelAttack(target: string) {
  const g = game();
  const army = g.battle?.target === target && !g.battle.done ? g.battle.army : g.strike?.to === target ? launched : null;
  if (!army) return false;
  for (const u of UNITS) g.army[u] += army[u];
  g.battle = null;
  g.strike = null;
  return true;
}

function endBattle(done: 'won' | 'lost' | 'fled') {
  const g = game();
  const b = g.battle!;
  b.done = done;
  const m = mods();
  const damage = 1 - Math.max(0, b.a) / b.a0;
  const lossRate = clamp(damage * 0.85, 0.05, 0.85) * (1 - Math.min(0.75, m.casualty + generalStats(b.general).casualty));
  let lost = 0;
  for (const u of UNITS) {
    const dead = Math.round(b.army[u] * lossRate);
    lost += dead;
    g.army[u] += b.army[u] - dead;
  }
  b.summary = [`Baixas: ${lost} tropas`];
  g.vet = clamp(g.vet + (done === 'won' ? 6 : 3), 0, 100);
  track('battles');
  addGeneralXp(b.general, done === 'won' ? 25 : 10);
  if (b.boss) {
    if (done === 'won') {
      M.bossWeek = weekKey();
      M.items.i7 = (M.items.i7 ?? 0) + 1;
      M.chests += 3;
      addXp(150);
      b.summary.push('Prêmio: Garra do Titã e 3 baús!');
    }
  } else if (done === 'won') {
    b.summary.push(`Renda: +$ ${COUNTRIES[b.target].income}/s`);
    conquer(b.target);
    changeMorale(0.04);
  } else {
    const c = g.countries[b.target];
    c.def = Math.max(8, Math.round(c.def * (1 - (1 - b.d / b.d0) * 0.5)));
    changeMorale(done === 'lost' ? -0.06 : -0.02);
    const s = M.generals[b.general];
    if (done === 'lost' && s && Math.random() < 0.3) {
      s.captor = b.target;
      b.summary.push(`${GENERALS.find((x) => x.id === b.general)!.name} foi capturado!`);
    }
  }
  hooks.sound(done === 'won' ? 'win' : 'lose');
  save();
}
export function closeBattle() {
  game().battle = null;
  bump();
}

/** Passa um país ao jogador e trata as consequências */
export function conquer(id: string, peaceful = false) {
  const g = game();
  const c = g.countries[id];
  const before = c.owner;
  Object.assign(c, { owner: PLAYER, def: Math.max(10, Math.round(COUNTRIES[id].defense * 0.2)), happy: peaceful ? 75 : 50, sab: 0, cyber: 0, siege: false, vassal: false, spy: false, route: false });
  if (!peaceful) scar(id);
  freeGenerals(id);
  track('conquests');
  addXp(15);
  if (!peaceful) g.infamy = Math.min(100, g.infamy + 3);
  // O mundo se arma conforme o império cresce
  for (const x in g.mode === 'lan' ? {} : g.countries) {
    const o = g.countries[x];
    if (o.owner !== PLAYER) o.def = Math.round(Math.min(o.def * 1.02 + 0.5, COUNTRIES[x].defense * 12));
  }
  for (const r of Object.values(g.rivals)) if (!r.ally) r.rel = clamp(r.rel - 1, -100, 100);
  news(`${COUNTRIES[id].name} agora faz parte do seu império.`, 'war');
  if (g.threat?.by && g.threat.target === id) g.threat = null;
  if (g.rivals[before]) lostCountry(before, id);
}

/** Perda de território por um rival; perder a capital desmonta o império */
export function lostCountry(rivalId: string, id: string) {
  const g = game();
  const r = g.rivals[rivalId];
  if (!r.alive) return;
  r.power *= 0.92;
  const rest = owned(rivalId);
  if (isHuman(rivalId) || (r.capital !== id && rest.length)) return;
  for (const x of rest) g.countries[x].owner = '';
  Object.assign(r, { alive: false, ally: false, trade: false, war: '', power: r.power * 0.5 });
  if (g.threat?.by === rivalId) g.threat = null;
  if (g.countries[id].owner === PLAYER) {
    g.defeated++;
    r.grudge += 3;
    addXp(60);
    M.chests++;
    changeMorale(0.08);
    if (!r.nemesis && g.mode !== 'lan') {
      r.nemesis = true;
      r.returnIn = 240;
    }
  }
  news(`${rivalDef(rivalId).title} desmoronou! ${rivalDef(rivalId).leader} fugiu.`, 'war');
}

export function remember(rivalId: string, text: string) {
  const r = game().rivals[rivalId];
  r.memory = [text, ...r.memory].slice(0, 6);
}
export function provoke(rivalId: string, amount: number, why: string) {
  const r = game().rivals[rivalId];
  r.rel = clamp(r.rel - amount, -100, 100);
  r.grudge++;
  r.trade = false;
  remember(rivalId, why);
}

// ===== Invasões contra o jogador =====
export function resolveThreat() {
  const g = game();
  const t = g.threat;
  if (!t) return;
  g.threat = null;
  if (!isMine(t.target) || (g.rivals[t.by] && !g.rivals[t.by].alive)) return;
  const who = t.by === 'alien' ? 'Frota alienígena' : t.by === 'onda' ? `Onda ${g.wave}` : ownerName(t.by);
  const name = COUNTRIES[t.target].name;
  const from = g.rivals[t.by]?.capital ?? owned('')[0] ?? t.target;
  launch(from, t.target, 'inimigo');
  setTimeout(() => {
    if (game() !== g) return;
    g.strike = null;
    if (g.shield) {
      g.shield = false;
      news(`Escudo antimíssil anulou o ataque a ${name}!`, 'war');
      ok('O escudo anulou a invasão!');
      return bump();
    }
    const c = g.countries[t.target];
    const defended = Math.random() < winChance(defensePower(t.target), t.power);
    const r = g.rivals[t.by];
    if (defended) {
      c.def = Math.max(4, Math.round(c.def * 0.75));
      g.army.inf = Math.floor(g.army.inf * 0.96);
      g.vet = Math.min(100, g.vet + 4);
      if (r) r.power *= 0.75;
      changeMorale(0.03);
      track('defended');
      addXp(12);
      news(`${name} repeliu ${who}!`, 'war');
      hooks.sound('win');
      ok(`${name} resistiu ao ataque!`);
    } else {
      loseCountry(t.target, r ? t.by : '');
      if (r) remember(t.by, `Tomou ${name} de você.`);
      news(`${who} tomou ${name}!`, 'war');
      hooks.sound('lose');
      fail(`${name} foi perdido!`);
    }
    save();
    bump();
  }, STRIKE_MS.inimigo * timing.strike);
}

/** O jogador perde um país; a sede muda se a capital cair. Azarão: último país ganha resistência heroica */
export function loseCountry(id: string, to: string) {
  const g = game();
  scar(id);
  Object.assign(g.countries[id], { owner: to, def: Math.round(COUNTRIES[id].defense * 0.6), happy: 60, siege: false });
  changeMorale(-0.05);
  const rest = owned();
  if (g.mode === 'lan') net.lost();
  if (!rest.length) {
    if (g.mode === 'lan') return;
    g.over = { won: false, title: 'O império caiu', text: `Você resistiu por ${Math.floor(g.time / 60)} minutos.` };
    return;
  }
  if (g.capital === id) g.capital = rest.reduce((b, x) => (COUNTRIES[x].income > COUNTRIES[b].income ? x : b));
  if (rest.length <= 2) {
    g.army.inf += 30;
    g.countries[g.capital].def += 30;
    changeMorale(0.15);
    ok('Resistência heroica: voluntários se juntam à sua causa!');
  }
}

// ===== Poderes =====
export function usePower(p: Power, target = '') {
  const g = game();
  if (g.powers[p] > 0) return fail('Poder recarregando.');
  if (POWERS[p].needsTarget && (!target || isMine(target) || attackBlock(target))) return fail(attackBlock(target) || 'Escolha um país inimigo no mapa.');
  const c = g.countries[target];
  if (p === 'bombardeio') {
    c.def = Math.max(5, Math.round(c.def * 0.7));
    if (g.rivals[c.owner]) provoke(c.owner, 15, `Bombardeou ${COUNTRIES[target].name}.`);
  } else if (p === 'escudo') g.shield = true;
  else if (p === 'paraquedas') g.para = true;
  else if (p === 'satelite') g.satellite = 60;
  else {
    if (g.era < 3) return fail('Exige a Era Moderna.');
    if (g.res.uranium < 20) return fail('Exige 20 urânio.');
    g.res.uranium -= 20;
    c.def = Math.max(3, Math.round(c.def * 0.1));
    c.level = Math.max(1, c.level - 1);
    g.infamy = Math.min(100, g.infamy + 40);
    if (g.rivals[c.owner]) g.rivals[c.owner].power *= 0.6;
    for (const id in g.rivals) {
      g.rivals[id].rel = clamp(g.rivals[id].rel - 40, -100, 100);
      g.rivals[id].ally = false;
      remember(id, 'Usou a arma nuclear.');
    }
    news(`Arma nuclear devasta ${COUNTRIES[target].name}. O mundo se volta contra você.`, 'war');
  }
  if (POWERS[p].needsTarget) {
    const nuke = p === 'nuclear';
    const kind = nuke ? 'nuclear' : 'bomba';
    launch(g.capital, target, kind);
    if (nuke) net.nuke(target);
    if (nuke) setTimeout(() => game() === g && hooks.nuke(target), STRIKE_MS.nuclear * STRIKE_IMPACT * timing.strike + 350 * timing.strike);
    setTimeout(() => {
      if (game() !== g) return;
      g.strike = null;
      scar(target, nuke);
      bump();
    }, STRIKE_MS[kind] * timing.strike);
  } else hooks.sound('tech');
  g.powers[p] = POWERS[p].cooldown * (1 - Math.min(0.5, mods().power));
  track('powers');
  bump();
  return true;
}

/** Ataque forçado pelo mod menu, sem custo nem recarga */
export function forceStrike(kind: 'bomba' | 'nuclear', target: string) {
  const g = game();
  if (g.strike || g.battle) return fail('Há um ataque em andamento.');
  const c = g.countries[target];
  const nuke = kind === 'nuclear';
  launch(g.capital === target ? owned().find((x) => x !== target) ?? 'GL' : g.capital, target, kind);
  if (nuke) {
    net.nuke(target);
    setTimeout(() => game() === g && hooks.nuke(target), STRIKE_MS.nuclear * STRIKE_IMPACT * timing.strike + 350 * timing.strike);
  }
  setTimeout(() => {
    if (game() !== g) return;
    g.strike = null;
    c.def = Math.max(3, c.def * (nuke ? 0.1 : 0.6));
    scar(target, nuke);
    bump();
  }, STRIKE_MS[kind] * timing.strike);
  bump();
  return true;
}

// ===== Cerco =====
export function toggleSiege(id: string) {
  const g = game();
  const c = g.countries[id];
  if (!c.siege) {
    const block = attackBlock(id);
    if (block) return fail(block);
    if (reach(id) !== 'terra') return fail('O cerco exige fronteira terrestre.');
    if (c.owner === ZOMBIES) return fail('Zumbis não se rendem.');
    if (g.rivals[c.owner]) provoke(c.owner, 20, `Cercou ${COUNTRIES[id].name}.`);
  }
  c.siege = !c.siege;
  hooks.sound('recruit');
  bump();
  return true;
}

// ===== Chefão semanal =====
export const BOSS = { name: 'Titã Dragossauro', icon: '🦖' };
export const bossPower = () => Math.round(250 + M.xp * 0.3 + (game() ? owned().length * 25 : 0));
export function fightBoss(general: string) {
  const g = game();
  if (M.bossWeek === weekKey()) return fail('Chefão derrotado. Um novo chega na segunda-feira.');
  if (g.battle || g.strike) return fail('Há um ataque em andamento.');
  if (armyPower(g.army) < 20) return fail('Exército pequeno demais.');
  const army = { ...g.army };
  g.army = emptyArmy();
  g.battle = createBattle(g.capital, army, M.generals[general]?.captor ? '' : general, attackPower(army, g.capital, general), bossPower(), true);
  bump();
  return true;
}
