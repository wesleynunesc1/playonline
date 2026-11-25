import { BRANCHES, CAMPAIGN, ERAS, GENERALS, ITEMS, PERKS, RESOURCES, UNITS, WONDERS } from '../data/content';
import { BY_REGION, COUNTRY_IDS } from '../data/countries';
import { G, M, PLAYER, bump, cheat, game, isMine, owned, save } from './state';
import { conquer, lostCountry } from './war';
import { grantGeneral, track } from './meta';

/** Funções do menu de administrador. */
const done = () => {
  save();
  bump();
};

export const FLAGS: { id: Exclude<keyof typeof cheat, 'speed'>; name: string; icon: string; text: string }[] = [
  { id: 'god', name: 'Invencível', icon: '🛡️', text: 'Nenhum país seu pode ser tomado' },
  { id: 'win', name: 'Sempre vencer', icon: '⚔️', text: 'Toda batalha é vitória sem baixas' },
  { id: 'rich', name: 'Recursos infinitos', icon: '♾️', text: 'Dinheiro, ciência e recursos sem fim' },
  { id: 'army', name: 'Exército infinito', icon: '🪖', text: 'Tropas sempre cheias' },
  { id: 'reach', name: 'Alcance total', icon: '🌐', text: 'Ataca qualquer país do mundo' },
  { id: 'free', name: 'Atacar sem limite', icon: '🚫', text: 'Ignora tréguas e alianças' },
  { id: 'power', name: 'Poderes sem recarga', icon: '⚡', text: 'Bombardeio, escudo e nuclear à vontade' },
  { id: 'calm', name: 'Povo e fama perfeitos', icon: '😇', text: 'Felicidade, moral e fama no máximo' },
  { id: 'freeze', name: 'Congelar rivais', icon: '🧊', text: 'Impérios da máquina não agem' },
  { id: 'see', name: 'Ver tudo', icon: '👁️', text: 'Planos, poder e táticas revelados' },
  { id: 'snake', name: 'Cobra imortal', icon: '🐍', text: 'Atravessa tudo na Cobra' },
  { id: 'cards', name: 'Cartas infinitas', icon: '🃏', text: 'Wi-Fi: mão sempre cheia' },
];

/** Aplicado a cada passo enquanto as chaves estiverem ligadas */
export function cheatTick() {
  const g = game();
  if (cheat.rich) {
    g.money = Math.max(g.money, 400_000);
    g.science = Math.max(g.science, 10_000);
    g.debt = 0;
    for (const r of RESOURCES) g.res[r] = Math.max(g.res[r], 999);
  }
  if (cheat.army) for (const u of UNITS) g.army[u] = Math.max(g.army[u], 2000);
  if (cheat.power) for (const p in g.powers) g.powers[p as 'escudo'] = 0;
  if (cheat.calm) {
    g.infamy = 0;
    g.morale = 1.3;
    g.vet = 100;
    for (const id of owned()) g.countries[id].happy = 100;
  }
  if (cheat.god) {
    g.threat = null;
    for (const id of owned()) g.countries[id].def = Math.max(g.countries[id].def, 99_999);
  }
  if (cheat.see) g.satellite = 60;
}

export const addMoney = (n: number) => { game().money += n; done(); };
export const addScience = (n: number) => { game().science += n; done(); };
export function addArmy(n: number) {
  for (const u of UNITS) game().army[u] += n;
  done();
}
export function addResources(n: number) {
  for (const r of RESOURCES) game().res[r] += n;
  done();
}
export function maxTech() {
  const g = game();
  for (const b of BRANCHES) g.techs[b.id] = 5;
  g.era = ERAS.length - 1;
  done();
}
export function maxBuildings() {
  const g = game();
  for (const id of owned()) {
    const c = g.countries[id];
    c.level = Math.max(c.level, 10);
    for (const b in c.b) c.b[b as 'porto'] = 3;
  }
  done();
}
export function allWonders() {
  for (const w of WONDERS) game().wonders[w.id] ??= game().capital;
  done();
}
export function goMars() { game().space = 2; done(); }
export function take(id: string) {
  if (G && !isMine(id)) conquer(id, true);
  done();
}
export function takeContinent(region: string) {
  for (const id of BY_REGION[region]) if (!isMine(id)) conquer(id, true);
  done();
}
export function takeWorld() {
  for (const id of COUNTRY_IDS) if (!isMine(id)) conquer(id, true);
  done();
}
export function destroyRival(id: string) {
  const r = game().rivals[id];
  const lands = owned(id);
  const capital = r.capital;
  for (const x of lands) game().countries[x].owner = '';
  lostCountry(id, capital);
  Object.assign(r, { alive: false, returnIn: 0 });
  game().defeated++;
  done();
}
export function befriendAll() {
  for (const r of Object.values(game().rivals)) Object.assign(r, { rel: 100, ally: true, trade: true, grudge: 0, war: '' });
  game().coalition = false;
  done();
}
export function weakenAll() {
  const g = game();
  for (const id of COUNTRY_IDS) if (g.countries[id].owner !== PLAYER) g.countries[id].def = 5;
  for (const r of Object.values(g.rivals)) r.power = 5;
  done();
}
export function forceEnd(won: boolean) {
  game().over = { won, title: won ? 'Vitória!' : 'Derrota', text: 'Encerrada pelo administrador.' };
  if (won && !game().victories.includes('militar')) game().victories.push('militar');
  done();
}
// ===== Progresso permanente =====
export function unlockGenerals() {
  for (const d of GENERALS) {
    if (!M.generals[d.id]) grantGeneral(d);
    Object.assign(M.generals[d.id], { lvl: 20, pts: 0, captor: '', skills: { ofensiva: 5, protecao: 5, estrategia: 5 } });
  }
  done();
}
export function allItems() {
  for (const i of ITEMS) M.items[i.id] = (M.items[i.id] ?? 0) + 5;
  done();
}
export function addChests(n: number) { M.chests += n; done(); }
export function addXpCheat(n: number) { M.xp += n; M.season.pts += n; done(); }
export function maxPerks() {
  for (const p of PERKS) M.perks[p.id] = p.max;
  done();
}
export function addLegacy(n: number) { M.legacy += n; done(); }
export function finishMissions() {
  for (const m of [...M.daily, ...M.weekly]) if (!m.done) track(m.stat, m.n);
  done();
}
export function unlockCampaign() { M.campaign = CAMPAIGN.length; done(); }
