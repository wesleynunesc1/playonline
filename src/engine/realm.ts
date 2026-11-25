import { COUNTRIES, Res } from '../data/countries';
import { BRANCHES, Building, ERAS, MAX_BUILDING, REGIMES, RES_INFO, SPACE, TECH_COST, WONDERS } from '../data/content';
import { GEOPOLITICAL_EVENTS } from '../data/events';
import { armyPower, budget, buildCost, countryIncome, defensePower, mods, reach, spyChance, upgradeCost } from './calc';
import { addXp, track } from './meta';
import { bump, clamp, fail, game, hooks, isHuman, isMine, net, news, ok, owned, pick, rivalDef, save } from './state';
import { conquer, provoke, remember } from './war';

/** Economia, ciência, diplomacia e espionagem. */

function pay(money: number) {
  const g = game();
  if (g.money < money) return fail('Dinheiro insuficiente.');
  g.money -= money;
  return true;
}
function done(sound: 'buy' | 'tech' | 'spy' = 'buy') {
  hooks.sound(sound);
  save();
  bump();
  return true;
}

// ===== Construções =====
export function upgradeCountry(id: string) {
  if (!isMine(id) || !pay(upgradeCost(id))) return false;
  game().countries[id].level++;
  track('upgrades');
  return done();
}
export function build(id: string, b: Building) {
  const c = game().countries[id];
  if (c.b[b] >= MAX_BUILDING) return fail('Nível máximo.');
  if (b === 'porto' && !COUNTRIES[id].coastal) return fail('País sem litoral.');
  if (!isMine(id) || !pay(buildCost(id, b))) return false;
  c.b[b]++;
  if (b === 'quartel') c.def += 15;
  track('upgrades');
  return done();
}
export function buildWonder(id: string, where: string) {
  const g = game();
  const w = WONDERS.find((x) => x.id === id)!;
  if (g.wonders[id]) return fail('Maravilha já construída.');
  if (!isMine(where)) return fail('Escolha um país seu.');
  if (g.res.iron < w.iron) return fail(`Exige ${w.iron} ferro.`);
  if (!pay(w.cost)) return false;
  g.res.iron -= w.iron;
  g.wonders[id] = where;
  track('upgrades');
  addXp(40);
  news(`${w.name} erguida em ${COUNTRIES[where].name}!`, 'fun');
  return done('tech');
}
export function reachSpace() {
  const g = game();
  const s = SPACE[g.space];
  if (!s) return fail('Você já chegou a Marte.');
  if (g.era < 5) return fail('Exige a Era Espacial.');
  if (g.science < s.science) return fail('Ciência insuficiente.');
  if (!pay(s.money)) return false;
  g.science -= s.science;
  g.space++;
  addXp(150);
  news(`Sua bandeira tremula em ${s.name}!`, 'fun');
  return done('tech');
}

// ===== Mercado e finanças =====
export function trade(res: Res, n: number) {
  const g = game();
  const price = g.prices[res];
  if (n > 0) {
    if (!pay(Math.ceil(price * n * 1.05))) return false;
    g.res[res] += n;
  } else {
    if (g.res[res] < -n) return fail('Estoque insuficiente.');
    g.res[res] += n;
    g.money += Math.floor(price * -n * 0.95);
  }
  // Comprar encarece; vender barateia
  g.prices[res] = clamp(price * (1 + n * 0.003), RES_INFO[res].price * 0.3, RES_INFO[res].price * 4);
  track('trades');
  return done();
}
export function setTax(t: 0 | 1 | 2 | 3) {
  game().tax = t;
  bump();
}
export const loanLimit = () => Math.round(3000 + budget().taxes * 120);
export function takeLoan() {
  const g = game();
  const n = Math.round(loanLimit() / 3);
  if (g.debt + n > loanLimit()) return fail('Os bancos recusaram: dívida alta demais.');
  g.debt += n;
  g.money += n;
  return done();
}
export function payLoan() {
  const g = game();
  const n = Math.min(g.debt, g.money, Math.max(1000, g.debt / 2));
  if (n <= 0) return fail('Nada a pagar.');
  g.debt -= n;
  g.money -= n;
  if (g.debt < 1) g.debt = 0;
  return done();
}
export const routeLimit = () => 2 + Math.floor(owned().length / 4) + owned().reduce((s, id) => s + game().countries[id].b.porto, 0);
export function toggleRoute(id: string) {
  const g = game();
  const c = g.countries[id];
  if (!c.route) {
    if (isMine(id) || c.owner) return fail('Rotas só com países independentes.');
    if (Object.values(g.countries).filter((x) => x.route).length >= routeLimit()) return fail(`Limite de ${routeLimit()} rotas. Construa portos.`);
    if (!pay(300)) return false;
    track('trades');
  }
  c.route = !c.route;
  return done();
}

// ===== Ciência =====
export const techCost = (branch: string) => TECH_COST[game().techs[branch] ?? 0] ?? 0;
export function techBlock(branch: string): string {
  const g = game();
  const b = BRANCHES.find((x) => x.id === branch)!;
  const lvl = g.techs[branch] ?? 0;
  if (lvl >= 5) return 'Completo';
  if (lvl >= 2 && b.rival && (g.techs[b.rival] ?? 0) >= 3) return `Bloqueado por ${BRANCHES.find((x) => x.id === b.rival)!.name}`;
  return '';
}
export function research(branch: string) {
  const g = game();
  const block = techBlock(branch);
  if (block) return fail(block);
  if (g.science < techCost(branch)) return fail('Ciência insuficiente.');
  g.science -= techCost(branch);
  g.techs[branch] = (g.techs[branch] ?? 0) + 1;
  track('techs');
  addXp(10);
  news(`Descoberta: ${BRANCHES.find((b) => b.id === branch)!.levels[g.techs[branch] - 1]}!`, 'fun');
  return done('tech');
}
export function advanceEra() {
  const g = game();
  const e = ERAS[g.era + 1];
  if (!e) return fail('Você já está na última era.');
  if (g.science < e.science) return fail('Ciência insuficiente.');
  if (!pay(e.money)) return false;
  g.science -= e.science;
  g.era++;
  addXp(50);
  news(`Seu império entrou na Era ${e.name}!`, 'fun');
  return done('tech');
}
export const regimeCost = () => Math.round(1000 + budget().taxes * 20);
export function setRegime(id: string) {
  const g = game();
  if (g.regime === id) return false;
  if (!pay(regimeCost())) return false;
  g.regime = id;
  for (const c of owned()) g.countries[c].happy = clamp(g.countries[c].happy - 10, 0, 100);
  news(`Revolução! Agora você governa uma ${REGIMES.find((r) => r.id === id)!.name}.`);
  return done('tech');
}

// ===== Diplomacia =====
export const giftCost = () => Math.round(500 + budget().taxes * 8);
const liveRival = (id: string) => game().rivals[id]?.alive;
export function gift(id: string) {
  const r = game().rivals[id];
  if (!liveRival(id) || !pay(giftCost())) return false;
  const p = rivalDef(id).personality;
  r.rel = clamp(r.rel + Math.round((p === 'comerciante' ? 18 : p === 'agressivo' ? 9 : 13) * (1 + mods().diplomacy)), -100, 100);
  remember(id, 'Você mandou um presente.');
  track('gifts');
  ok(`${rivalDef(id).leader}: "${rivalDef(id).peace}"`);
  return done();
}
export function proposeTrade(id: string) {
  const r = game().rivals[id];
  if (r.trade) return fail('Tratado já ativo.');
  if (r.rel < 10) return fail('Relação baixa demais (precisa de 10).');
  r.trade = true;
  track('gifts');
  remember(id, 'Assinaram um tratado comercial.');
  ok('Tratado comercial assinado!');
  return done();
}
export function proposeTruce(id: string) {
  const r = game().rivals[id];
  const strong = armyPower(game().army) > r.power * 0.7;
  if (r.rel < -60 && !strong) return fail(`${rivalDef(id).leader} recusou a trégua.`);
  r.truce = 180;
  track('gifts');
  ok('Trégua de 3 minutos assinada.');
  return done();
}
export function proposeAlliance(id: string) {
  const r = game().rivals[id];
  if (r.ally) return fail('Já são aliados.');
  if (r.rel < 50) return fail('Relação baixa demais (precisa de 50).');
  r.ally = true;
  track('gifts');
  remember(id, 'Firmaram aliança.');
  news(`Aliança com ${rivalDef(id).title}!`);
  return done('tech');
}
/** Romper aliança é traição: dá vantagem de surpresa, mas o mundo não esquece */
export function betray(id: string) {
  const g = game();
  const r = g.rivals[id];
  if (!r.ally) return false;
  if (net.locked(id)) return fail('Vocês são do mesmo time.');
  if (isHuman(id)) net.war(id, true);
  r.ally = false;
  r.truce = 0;
  r.power *= 0.85;
  r.grudge += 4;
  provoke(id, 70, 'VOCÊ O TRAIU.');
  g.infamy = Math.min(100, g.infamy + 15);
  for (const o in g.rivals) if (o !== id) g.rivals[o].rel = clamp(g.rivals[o].rel - 10, -100, 100);
  news(`Traição! ${rivalDef(id).leader}: "${rivalDef(id).revenge}"`, 'war');
  return done('spy');
}
export function declareWar(id: string) {
  const r = game().rivals[id];
  if (r.ally) return betray(id);
  if (isHuman(id)) net.war(id, false);
  r.truce = 0;
  provoke(id, 40, 'Você declarou guerra.');
  news(`Guerra! ${rivalDef(id).leader}: "${rivalDef(id).war}"`, 'war');
  return done('spy');
}
/** Aliado ataca outro rival */
export function callAlly(id: string, against: string) {
  const r = game().rivals[id];
  if (!r.ally) return fail('Só aliados atendem.');
  if (r.rel < 60) return fail('O aliado pede relação 60.');
  r.war = against;
  r.warTime = 150;
  r.rel -= 12;
  news(`${rivalDef(id).title} declara guerra a ${rivalDef(against).title} a seu pedido.`, 'war');
  return done();
}
/** Ultimato: país fraco se rende sem luta */
export function ultimatum(id: string) {
  const g = game();
  const c = g.countries[id];
  if (c.owner) return fail('Só países independentes aceitam ultimatos.');
  if (!reach(id)) return fail('Fora de alcance: a ameaça não assusta.');
  const ratio = armyPower(g.army) / defensePower(id);
  g.infamy = Math.min(100, g.infamy + 2);
  if (Math.random() < clamp((ratio - 2) * 0.25, 0, 0.85)) {
    conquer(id, true);
    ok(`${COUNTRIES[id].name} se rendeu sem luta!`);
  } else {
    c.def = Math.round(c.def * 1.1 + 3);
    fail(`${COUNTRIES[id].name} recusou e reforçou as defesas.`);
  }
  return done('spy');
}
export const buyPrice = (id: string) => Math.round((1500 + countryIncome(id) * 220) * (1 + owned().length * 0.06));
export function buyCountry(id: string) {
  const c = game().countries[id];
  if (c.owner) return fail('Só países independentes podem ser comprados.');
  if (!pay(buyPrice(id))) return false;
  conquer(id, true);
  ok(`${COUNTRIES[id].name} agora é seu, com nota fiscal.`);
  return done();
}
export function vassalize(id: string) {
  const g = game();
  const c = g.countries[id];
  if (c.owner || c.vassal) return fail('Só países independentes viram vassalos.');
  if (!reach(id)) return fail('Fora de alcance.');
  if (armyPower(g.army) < defensePower(id) * 1.8) return fail('Seu exército precisa ser 1,8x mais forte.');
  if (!pay(Math.round(buyPrice(id) * 0.2))) return false;
  c.vassal = true;
  c.route = false;
  addXp(10);
  news(`${COUNTRIES[id].name} aceita ser seu vassalo e pagar tributo.`);
  return done();
}

// ===== ONU =====
export function castVote(yes: boolean) {
  const g = game();
  const v = g.vote;
  if (!v) return;
  g.vote = null;
  const live = Object.values(g.rivals).filter((r) => r.alive);
  const favor = live.filter((r) => (v.kind === 'contra' ? r.rel < 10 : r.id !== v.rival && Math.random() < 0.5)).length + (yes ? 1.5 : 0);
  const passed = favor > live.length / 2;
  if (v.kind === 'sancao') {
    const r = g.rivals[v.rival];
    r.rel = clamp(r.rel + (yes ? -15 : 12), -100, 100);
    if (passed) r.sanction = 120;
  } else if (v.kind === 'paz') {
    if (yes) g.infamy = Math.max(0, g.infamy - 10);
    if (passed) for (const r of live) r.truce = Math.max(r.truce, 60);
  } else if (passed && !yes) g.sanction = 120;
  else if (yes) {
    g.money = Math.max(0, g.money - g.money * 0.1);
    g.infamy = Math.max(0, g.infamy - 20);
  }
  news(`ONU: proposta ${passed ? 'aprovada' : 'rejeitada'}.`);
  return done();
}

// ===== Espionagem =====
export const SPY_COST = { infiltrar: 600, roubar: 800, sabotar: 700, golpe: 4000, ciber: 1500 };
export type SpyOp = keyof typeof SPY_COST;
export const OP_INFO: Record<SpyOp, { name: string; icon: string; text: string; bonus: number; rivalOnly: boolean }> = {
  infiltrar: { name: 'Infiltrar espião', icon: '🕵️', text: 'Revela planos e táticas do império', bonus: 15, rivalOnly: true },
  roubar: { name: 'Roubar tecnologia', icon: '💾', text: 'Ganha ciência (exige espião)', bonus: 0, rivalOnly: true },
  sabotar: { name: 'Sabotar defesas', icon: '💥', text: '-25% de defesa por 90s', bonus: 15, rivalOnly: false },
  ciber: { name: 'Ciberataque', icon: '💻', text: 'Congela a economia por 90s', bonus: 5, rivalOnly: true },
  golpe: { name: 'Golpe de Estado', icon: '🎭', text: 'Derruba o governo e toma o país', bonus: -30, rivalOnly: false },
};
export function spyOp(op: SpyOp, id: string) {
  const g = game();
  const c = g.countries[id];
  const r = g.rivals[c.owner];
  if (isMine(id) || c.vassal) return fail('Alvo inválido.');
  if (OP_INFO[op].rivalOnly && !r) return fail('Só contra impérios rivais.');
  if (op === 'roubar' && !r.spy) return fail('Infiltre um espião antes.');
  if (op === 'golpe' && isHuman(c.owner)) return fail('Jogadores não caem por golpe.');
  if (op === 'golpe' && r && r.capital === id) return fail('A capital é protegida demais para um golpe.');
  if (!pay(SPY_COST[op])) return false;
  track('spies');
  if (Math.random() * 100 > spyChance(OP_INFO[op].bonus + (r?.spy ? 10 : 0))) {
    if (r) provoke(c.owner, 12, 'Flagrou um espião seu.');
    fail('Agentes capturados. A operação fracassou.');
    return done('spy');
  }
  if (op === 'infiltrar') r.spy = true;
  else if (op === 'roubar') g.science += 25 + g.era * 40;
  else if (op === 'sabotar') c.sab = 90;
  else if (op === 'ciber') {
    r.cyber = 90;
    if (isHuman(c.owner)) net.cyber(c.owner);
    for (const x of owned(c.owner)) g.countries[x].cyber = 90;
  } else conquer(id, true);
  addXp(8);
  ok(`${OP_INFO[op].name}: sucesso!`);
  return done('spy');
}

// ===== Crises =====
export function randomCrisis() {
  return pick(GEOPOLITICAL_EVENTS).id;
}
export function resolveCrisis(choiceId: string) {
  const g = game();
  const c = GEOPOLITICAL_EVENTS.find((e) => e.id === g.crisis)?.choices.find((x) => x.id === choiceId);
  if (!c) return false;
  if (c.costMoney && !pay(c.costMoney)) return false;
  g.money += c.rewardMoney ?? 0;
  g.army.inf = Math.max(0, g.army.inf - (c.costMilitary ?? 0) + (c.rewardMilitary ?? 0));
  g.bonusIncome += (c.rewardIncomeBonus ?? 0) * 0.4;
  g.crisis = '';
  return done();
}
