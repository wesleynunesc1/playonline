import { COUNTRIES } from '../data/countries';
import { GENERALS, GeneralDef, ITEMS, MISSION_POOL, PERKS, RARITY, Rarity, SEASONS, SEASON_STEP, SEASON_TIERS, Skill, Stat } from '../data/content';
import { formatMoney } from '../utils/formatters';
import { G, M, Mission, bump, clearSave, fail, game, hooks, levelOf, news, ok, owned, pick, save, scenarioOf, setGame, titleOf } from './state';

/** Progresso permanente: generais, baús, missões, sequência, temporada, prestígio. */

const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
export function weekKey(d = new Date()) {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(monday);
}
export const seasonName = () => SEASONS[new Date().getMonth()];

function rollMissions(count: number, scale: number): Mission[] {
  const pool = [...MISSION_POOL];
  return Array.from({ length: count }, () => {
    const [m] = pool.splice(Math.floor(Math.random() * pool.length), 1);
    const n = m.n * scale;
    return { stat: m.stat, n, text: m.text.replace('{n}', n.toLocaleString('pt-BR')), have: 0, done: false };
  });
}

/** Renova missões e temporada; a sequência pausa (não zera) quando você falta */
export function refreshCalendar(): number {
  const today = dayKey();
  let gained = 0;
  if (M.day !== today) {
    M.day = today;
    M.daily = rollMissions(3, 1);
    M.streak++;
    M.lastDay = today;
    gained = 1 + Math.floor(Math.min(M.streak, 28) / 7);
    M.chests += gained;
  }
  if (M.week !== weekKey()) {
    M.week = weekKey();
    M.weekly = rollMissions(3, 5);
  }
  const d = new Date();
  const season = `${d.getFullYear()}-${d.getMonth()}`;
  if (M.season.id !== season) M.season = { id: season, pts: 0, claimed: 0 };
  save();
  return gained;
}

export function addXp(n: number) {
  const before = levelOf(M.xp);
  M.xp += n;
  M.season.pts += n;
  const now = levelOf(M.xp);
  if (now > before) {
    M.chests += now - before;
    hooks.sound('tech');
    ok(`Nível ${now}: ${titleOf(now)}! +${now - before} baú`);
  }
}

export function track(stat: Stat, n = 1) {
  if (G) G.stats[stat] += n;
  const advance = (list: Mission[], chests: number, xp: number) => {
    for (const m of list) {
      if (m.stat !== stat || m.done) continue;
      m.have = Math.min(m.n, m.have + n);
      if (m.have < m.n) continue;
      m.done = true;
      M.chests += chests;
      addXp(xp);
      hooks.sound('tech');
      ok(`Missão cumprida: ${m.text} (+${chests} baú)`);
    }
  };
  advance(M.daily, 1, 40);
  advance(M.weekly, 3, 150);
}

export function claimSeason() {
  const tier = M.season.claimed + 1;
  if (tier > SEASON_TIERS || M.season.pts < tier * SEASON_STEP) return fail('Ainda faltam pontos de temporada.');
  M.season.claimed = tier;
  M.chests += tier === SEASON_TIERS ? 6 : 1 + Math.floor(tier / 4);
  save();
  bump();
  return ok(`Prêmio ${tier} da temporada ${seasonName()} recebido!`);
}

// ===== Baús e generais =====
function rollRarity(): Rarity {
  let r = Math.random() * 100;
  for (const k of Object.keys(RARITY) as Rarity[]) if ((r -= RARITY[k].weight) < 0) return k;
  return 'comum';
}
export interface Loot { icon: string; title: string; text: string; rarity: Rarity }
export function openChest(): Loot | null {
  if (M.chests <= 0) return null;
  M.chests--;
  const rarity = rollRarity();
  const kind = Math.random();
  let loot: Loot;
  if (kind < 0.5) loot = grantGeneral(pick(GENERALS.filter((g) => g.rarity === rarity)));
  else if (kind < 0.8) {
    const item = pick(ITEMS.filter((i) => i.rarity === rarity && !i.boss));
    M.items[item.id] = (M.items[item.id] ?? 0) + 1;
    loot = { icon: item.icon, title: item.name, text: 'Novo equipamento', rarity };
  } else if (G) {
    const money = Math.round(800 * RARITY[rarity].power * (1 + owned().length * 0.3));
    G.money += money;
    G.army.inf += Math.round(8 * RARITY[rarity].power);
    loot = { icon: '💰', title: formatMoney(money), text: 'Dinheiro e reforços', rarity };
  } else {
    addXp(Math.round(20 * RARITY[rarity].power));
    loot = { icon: '⭐', title: 'Experiência', text: 'Pontos de imperador', rarity };
  }
  hooks.sound(rarity === 'comum' ? 'buy' : 'tech');
  save();
  bump();
  return loot;
}
export function grantGeneral(def: GeneralDef): Loot {
  const have = M.generals[def.id];
  if (have) {
    addGeneralXp(def.id, 60);
    return { icon: def.icon, title: def.name, text: 'Repetido: +60 de experiência', rarity: def.rarity };
  }
  M.generals[def.id] = { lvl: 1, xp: 0, pts: 0, skills: { ofensiva: 0, protecao: 0, estrategia: 0 }, item: '', captor: '' };
  if (M.staff.length < 3) M.staff.push(def.id);
  return { icon: def.icon, title: def.name, text: `Novo general! "${def.quote}"`, rarity: def.rarity };
}
export function addGeneralXp(id: string, n: number) {
  const s = M.generals[id];
  if (!s) return;
  s.xp += n;
  while (s.xp >= s.lvl * 40 && s.lvl < 20) {
    s.xp -= s.lvl * 40;
    s.lvl++;
    s.pts++;
  }
}
export function learnSkill(id: string, skill: Skill) {
  const s = M.generals[id];
  if (!s || s.pts < 1 || s.skills[skill] >= 5) return fail('Sem pontos de habilidade.');
  s.pts--;
  s.skills[skill]++;
  hooks.sound('tech');
  save();
  bump();
  return true;
}
export function equip(id: string, item: string) {
  const s = M.generals[id];
  if (!s) return;
  if (s.item) M.items[s.item] = (M.items[s.item] ?? 0) + 1;
  s.item = '';
  if (item && M.items[item] > 0) {
    M.items[item]--;
    s.item = item;
  }
  save();
  bump();
}
export function toggleStaff(id: string) {
  if (M.staff.includes(id)) M.staff = M.staff.filter((x) => x !== id);
  else if (M.staff.length < 3) M.staff = [...M.staff, id];
  else return fail('O estado-maior tem 3 vagas.');
  save();
  bump();
  return true;
}
export const ransomCost = (id: string) => 1500 * (M.generals[id]?.lvl ?? 1);
/** Resgate em dinheiro ou troca por recursos */
export function ransom(id: string, how: 'dinheiro' | 'troca') {
  const s = M.generals[id];
  const g = game();
  if (!s?.captor) return false;
  if (how === 'dinheiro') {
    if (g.money < ransomCost(id)) return fail('Dinheiro insuficiente para o resgate.');
    g.money -= ransomCost(id);
  } else {
    if (g.res.iron < 40 || g.res.oil < 40) return fail('A troca exige 40 ferro e 40 petróleo.');
    g.res.iron -= 40;
    g.res.oil -= 40;
  }
  s.captor = '';
  save();
  bump();
  return ok('General de volta ao comando!');
}
/** Conquistar o país do captor liberta o general */
export function freeGenerals(captor: string) {
  for (const id in M.generals) {
    if (M.generals[id].captor !== captor) continue;
    M.generals[id].captor = '';
    news(`${GENERALS.find((g) => g.id === id)?.name} foi libertado em ${COUNTRIES[captor]?.name ?? 'combate'}!`, 'war');
  }
}

// ===== Prestígio =====
export function prestigeGain() {
  const g = G;
  if (!g) return 0;
  return owned().length < 10 && !g.victories.length ? 0 : 1 + Math.floor(owned().length / 12) + g.victories.length * 3 + g.space;
}
export function doPrestige() {
  const gain = prestigeGain();
  if (!gain) return fail('Conquiste 10 países ou vença para iniciar uma Nova Era.');
  M.legacy += gain;
  M.prestige++;
  addXp(100 * gain);
  finishGame();
  return ok(`Nova Era! +${gain} pontos de legado`);
}
export function buyPerk(id: string) {
  const perk = PERKS.find((p) => p.id === id)!;
  const lvl = M.perks[id] ?? 0;
  if (lvl >= perk.max || M.legacy < lvl + 1) return fail('Pontos de legado insuficientes.');
  M.legacy -= lvl + 1;
  M.perks[id] = lvl + 1;
  hooks.sound('tech');
  save();
  bump();
  return true;
}
/** Encerra a partida: generais presos voltam para casa */
export function finishGame() {
  for (const id in M.generals) M.generals[id].captor = '';
  clearSave();
  setGame(null);
  save();
}
export function completeScenario(mode: string) {
  const sc = scenarioOf(mode);
  if (!sc) return;
  const chapter = /^c(\d)$/.exec(mode);
  if (chapter) M.campaign = Math.max(M.campaign, Number(chapter[1]));
  M.chests += 3;
  addXp(200);
}
