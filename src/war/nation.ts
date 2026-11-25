import { Bonus, CITIES, CITY, PowerId, RESEARCH, UNITS, UNIT_ERA, UnitId } from './data';
import { realmMood } from './realm';
import { CityState, World, allied, armyCap, armySize, citiesOf, cityAt, hostile, mods, say, spawn, stat, unitPrice } from './sim';

/** Vida da nação: doutrina, políticas, impostos, humor do povo, maravilhas, espiões, mercado, dilemas, caixas e desastres. */
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(l: readonly T[]) => l[Math.floor(Math.random() * l.length)];

// ===== 8 doutrinas: uma por partida =====
export const DOCTRINES: { id: string; name: string; icon: string; text: string; bonus: Bonus }[] = [
  { id: 'mercador', name: 'Mercador', icon: '💰', text: 'Vive do comércio', bonus: { income: 0.15, cost: 0.04 } },
  { id: 'industrial', name: 'Industrial', icon: '🏭', text: 'Produz sem parar', bonus: { train: 0.2, fuel: 0.1 } },
  { id: 'estrategista', name: 'Estrategista', icon: '🎯', text: 'Enxerga e atira longe', bonus: { range: 0.07, vision: 0.2 } },
  { id: 'blindado', name: 'Punho de Aço', icon: '🛡️', text: 'Tropas duras', bonus: { armor: 0.14 } },
  { id: 'relampago', name: 'Relâmpago', icon: '⚡', text: 'Tropas velozes', bonus: { speed: 0.15 } },
  { id: 'fortaleza', name: 'Guardião', icon: '🏰', text: 'Cidades difíceis de tomar', bonus: { city: 0.35, heal: 0.3 } },
  { id: 'artilheiro', name: 'Artilheiro', icon: '💥', text: 'Apoios mais rápidos e fortes', bonus: { power: 0.25, dmg: 0.05 } },
  { id: 'humanista', name: 'Humanista', icon: '🕊️', text: 'Povo feliz e cidades ricas', bonus: { income: 0.08, heal: 0.5 } },
];
// ===== 12 políticas: uma vaga por era =====
export const POLICIES: { id: string; name: string; icon: string; text: string; bonus: Bonus; mood?: number; era: number }[] = [
  { id: 'feiras', name: 'Feiras livres', icon: '🌾', text: 'Mais renda', bonus: { income: 0.08 }, era: 1 },
  { id: 'reservistas', name: 'Reservistas', icon: '🪖', text: 'Treino rápido', bonus: { train: 0.12 }, era: 1 },
  { id: 'festas', name: 'Festas populares', icon: '✨', text: 'Povo contente', bonus: { income: -0.04 }, mood: 14, era: 1 },
  { id: 'subsidio', name: 'Subsídio ao diesel', icon: '🛢️', text: 'Mais combustível', bonus: { fuel: 0.2, income: -0.05 }, era: 2 },
  { id: 'muralhas', name: 'Defesa civil', icon: '🧱', text: 'Cidades fortes', bonus: { city: 0.2 }, era: 2 },
  { id: 'escolas', name: 'Escola integral', icon: '🎓', text: 'Pesquisa 20% mais barata', bonus: {}, mood: 6, era: 2 },
  { id: 'censura', name: 'Controle da imprensa', icon: '📣', text: 'Espiões falham mais, povo irritado', bonus: {}, mood: -8, era: 3 },
  { id: 'livre', name: 'Livre mercado', icon: '📈', text: 'Comércio rende o dobro', bonus: {}, era: 3 },
  { id: 'convocacao', name: 'Convocação geral', icon: '🚩', text: '+10 tropas, povo irritado', bonus: {}, mood: -10, era: 3 },
  { id: 'logistica', name: 'Logística militar', icon: '⚙️', text: 'Tropas rápidas e baratas', bonus: { speed: 0.08, cost: 0.06 }, era: 4 },
  { id: 'drones', name: 'Guerra remota', icon: '🛩️', text: 'Mais dano e visão', bonus: { dmg: 0.08, vision: 0.15 }, era: 4 },
  { id: 'dissuasao', name: 'Dissuasão nuclear', icon: '☢️', text: 'Apoios muito rápidos', bonus: { power: 0.35 }, era: 5 },
];
// ===== 10 maravilhas: só uma nação constrói cada uma =====
export const WONDERS: { id: string; name: string; icon: string; text: string; bonus: Bonus; mood?: number; era: number; money: number; fuel: number; time: number; coast?: boolean }[] = [
  { id: 'ponte', name: 'Ponte Monumental', icon: '🌐', text: 'Liga o estado', bonus: { speed: 0.12 }, era: 2, money: 2500, fuel: 400, time: 60 },
  { id: 'catedral', name: 'Grande Catedral', icon: '⛪', text: 'Alegra o povo', bonus: {}, mood: 15, era: 2, money: 2500, fuel: 200, time: 60 },
  { id: 'arena', name: 'Arena Olímpica', icon: '🏆', text: 'Orgulho e turismo', bonus: { income: 0.12 }, mood: 6, era: 3, money: 4500, fuel: 500, time: 75 },
  { id: 'porto', name: 'Superporto', icon: '🚢', text: 'Porta do mundo', bonus: { income: 0.18 }, era: 3, money: 6000, fuel: 900, time: 80, coast: true },
  { id: 'universidade', name: 'Cidade da Ciência', icon: '🎓', text: 'Pesquisa 25% mais barata', bonus: { train: 0.05 }, era: 3, money: 6000, fuel: 800, time: 80 },
  { id: 'usina', name: 'Usina de Hidrogênio', icon: '🌱', text: 'Energia limpa', bonus: { fuel: 0.4 }, era: 3, money: 6500, fuel: 300, time: 80 },
  { id: 'muralha', name: 'Cinturão de Aço', icon: '🧱', text: 'Cidades quase intomáveis', bonus: { city: 0.5 }, era: 4, money: 9000, fuel: 2000, time: 95 },
  { id: 'espacial', name: 'Base Espacial', icon: '🚀', text: 'Olhos no céu', bonus: { vision: 0.5, range: 0.06 }, era: 4, money: 11000, fuel: 2500, time: 100 },
  { id: 'cerebro', name: 'Supercomputador', icon: '🧠', text: 'Mira e comando por IA', bonus: { dmg: 0.12, power: 0.15 }, era: 4, money: 12000, fuel: 2500, time: 100 },
  { id: 'torre', name: 'Torre do Sol', icon: '☀️', text: 'A mais alta do país', bonus: { income: 0.15, fuel: 0.15 }, mood: 10, era: 5, money: 20000, fuel: 5000, time: 120 },
];
// ===== 6 missões de espionagem =====
export type SpyId = 'mapa' | 'tech' | 'sabotar' | 'revolta' | 'roubar' | 'virus' | 'infiltrar' | 'boato';
export const SPIES: Record<SpyId, { name: string; icon: string; text: string; money: number; chance: number }> = {
  mapa: { name: 'Vigiar', icon: '👁️', text: 'Vê as cidades dele por 60s', money: 150, chance: 0.9 },
  roubar: { name: 'Desviar verba', icon: '💼', text: 'Rouba 15% do dinheiro', money: 300, chance: 0.55 },
  tech: { name: 'Copiar pesquisa', icon: '🔬', text: 'Ganha um nível que ele tem', money: 600, chance: 0.5 },
  sabotar: { name: 'Sabotar', icon: '💥', text: 'Desliga uma cidade por 30s', money: 400, chance: 0.6 },
  revolta: { name: 'Incitar revolta', icon: '📣', text: 'Irrita o povo de uma cidade', money: 400, chance: 0.6 },
  infiltrar: { name: 'Infiltrar agente', icon: '🕵️', text: 'Vê as cidades dele para sempre', money: 900, chance: 0.4 },
  boato: { name: 'Notícia falsa', icon: '📣', text: 'Irrita todas as cidades dele', money: 350, chance: 0.55 },
  virus: { name: 'Ataque cibernético', icon: '💻', text: 'Apoios dele param por 60s', money: 700, chance: 0.5 },
};
export const SPY_COOL = 45;
// ===== 14 dilemas: decisões do governo =====
type Effect = { money?: number; fuel?: number; mood?: number; troops?: UnitId; ruin?: number; research?: boolean };
export const DILEMMAS: { icon: string; title: string; text: string; a: [string, Effect]; b: [string, Effect] }[] = [
  { icon: '🌾', title: 'Seca no sertão', text: 'Os agricultores pedem ajuda.', a: ['Mandar carros-pipa', { money: -300, mood: 10 }], b: ['Não há verba', { mood: -12 }] },
  { icon: '🏭', title: 'Fábrica estrangeira', text: 'Uma empresa quer se instalar, mas polui.', a: ['Aceitar', { money: 700, mood: -8 }], b: ['Recusar', { mood: 8 }] },
  { icon: '📣', title: 'Greve dos transportes', text: 'Caminhoneiros param as estradas.', a: ['Dar aumento', { money: -350, mood: 6 }], b: ['Usar a força', { fuel: -120, mood: -10 }] },
  { icon: '🎓', title: 'Jovens cientistas', text: 'Um grupo pede bolsa para uma invenção.', a: ['Financiar', { money: -400, research: true }], b: ['Deixar para depois', {}] },
  { icon: '🪖', title: 'Voluntários', text: 'Moradores querem se alistar.', a: ['Treinar já', { money: -150, troops: 'soldado' }], b: ['Voltem ao trabalho', { money: 200 }] },
  { icon: '🛢️', title: 'Poço de petróleo', text: 'Achado em área de reserva.', a: ['Explorar', { fuel: 500, mood: -10 }], b: ['Preservar', { mood: 12 }] },
  { icon: '🏆', title: 'Jogos estaduais', text: 'Sediar o evento?', a: ['Sediar', { money: -400, mood: 16 }], b: ['Passar a vez', { mood: -3 }] },
  { icon: '💼', title: 'Corrupção', text: 'Um assessor desviou dinheiro.', a: ['Punir em público', { mood: 10, money: -100 }], b: ['Abafar e recuperar', { money: 500, mood: -12 }] },
  { icon: '🏥', title: 'Surto de dengue', text: 'Os postos estão cheios.', a: ['Mutirão', { money: -300, mood: 8 }], b: ['Esperar passar', { mood: -14 }] },
  { icon: '🚚', title: 'Comboio perdido', text: 'Um comboio sem dono aparece na estrada.', a: ['Ficar com a carga', { fuel: 300, mood: -4 }], b: ['Devolver', { mood: 8, money: 150 }] },
  { icon: '🛩️', title: 'Inventor de drones', text: 'Ele oferece um protótipo.', a: ['Comprar', { money: -250, troops: 'fpv' }], b: ['Dispensar', {}] },
  { icon: '🕊️', title: 'Refugiados', text: 'Famílias pedem abrigo.', a: ['Acolher', { money: -250, mood: 12 }], b: ['Fechar a divisa', { mood: -8 }] },
  { icon: '🎣', title: 'Pesca proibida', text: 'Pescadores pedem liberação.', a: ['Liberar', { money: 250, mood: 4 }], b: ['Manter a lei', { mood: -4 }] },
  { icon: '🔥', title: 'Incêndio na mata', text: 'O fogo chega perto da cidade.', a: ['Bombeiros já', { money: -200, mood: 4 }], b: ['Deixar queimar', { ruin: 0.25, mood: -10 }] },
];
// ===== 5 desastres =====
export const DISASTERS: { name: string; icon: string; text: string; ruin: number; mood: number; off: number }[] = [
  { name: 'Incêndio', icon: '🔥', text: 'atinge', ruin: 0.3, mood: -12, off: 0 },
  { name: 'Enchente', icon: '🌧️', text: 'alaga', ruin: 0.22, mood: -10, off: 12 },
  { name: 'Apagão', icon: '🔌', text: 'apaga', ruin: 0, mood: -8, off: 30 },
  { name: 'Vendaval', icon: '🌬️', text: 'destelha', ruin: 0.18, mood: -6, off: 6 },
  { name: 'Tremor', icon: '⛰️', text: 'sacode', ruin: 0.35, mood: -10, off: 8 },
];
// ===== 5 caixas de suprimento =====
export const CRATES = ['money', 'fuel', 'troop', 'star', 'mood'] as const;
export interface Crate { x: number; z: number; k: number; left: number }
export const LOAN = 1500;

export interface Nation { doc: string; pol: string[]; tax: -1 | 0 | 1; spy: number; debt: number; dil: { i: number; left: number } | null; nextDil: number; see: { o: number; left: number }[]; price: number; rebels: number }
export const newNation = (): Nation => ({ doc: '', pol: [], tax: 0, spy: 0, debt: 0, dil: null, nextDil: rand(80, 130), see: [], price: 1, rebels: 0 });
export const wonderOf = (w: World, id: string) => w.wonders.find((x) => x.id === id);
const has = (w: World, i: number, id: string) => w.wonders.some((x) => x.id === id && x.o === i && x.left <= 0);
export const policySlots = (w: World, i: number) => w.players[i].era;
/** Desconto da pesquisa */
export const studyFactor = (w: World, i: number) => 1 - (w.players[i].n.pol.includes('escolas') ? 0.2 : 0) - (has(w, i, 'universidade') ? 0.25 : 0);
export const tradeRate = (w: World, i: number) => (w.players[i].n.pol.includes('livre') ? 0.16 : 0.08);
export const extraCap = (w: World, i: number) => (w.players[i].n.pol.includes('convocacao') ? 10 : 0);
export function nationBonus(w: World, i: number, add: (b: Bonus | undefined) => void) {
  const n = w.players[i].n;
  add(DOCTRINES.find((d) => d.id === n.doc)?.bonus);
  for (const p of POLICIES) if (n.pol.includes(p.id)) add(p.bonus);
  for (const x of WONDERS) if (has(w, i, x.id)) add(x.bonus);
  add({ income: n.tax * 0.25 });
}
/** Humor para onde o povo de uma cidade caminha */
export function moodTarget(w: World, c: CityState): number {
  const n = w.players[c.owner].n;
  let m = 68 - n.tax * 24 + c.dev * 4 - c.ruin * 35;
  for (const p of POLICIES) if (n.pol.includes(p.id)) m += p.mood ?? 0;
  for (const x of WONDERS) if (has(w, c.owner, x.id)) m += x.mood ?? 0;
  if (n.doc === 'humanista') m += 10;
  m += realmMood(w, c.owner);
  if (c.works.some((k) => k.k === 'hospital' && k.left <= 0)) m += 6;
  if (w.players.some((p) => p.alive && hostile(w, p.i, c.owner))) m -= 10;
  if (w.rads.some((a) => Math.hypot(a.x - c.x, a.z - c.z) < a.r)) m -= 40;
  // Império grande demais é mais difícil de governar
  m -= Math.max(0, citiesOf(w, c.owner).length - 14) * 0.5;
  return Math.max(0, Math.min(100, m));
}
export const moodBonus = (mood: number) => 0.7 + (mood / 100) * 0.5;

export type NationCmd =
  | { c: 'doc'; id: string } | { c: 'pol'; id: string } | { c: 'tax'; v: number } | { c: 'wonder'; id: string; city: number } | { c: 'spy'; to: number; k: SpyId }
  | { c: 'market'; buy: boolean } | { c: 'loan'; pay: boolean } | { c: 'choose'; n: number } | { c: 'merc'; city: number; k: UnitId } | { c: 'patrol'; u: number[]; x: number; z: number } | { c: 'scout'; u: number[] };
type Pay = (v: [number, number]) => string;
export const marketPrice = (w: World, i: number) => Math.round(120 * w.players[i].n.price);
export const mercPrice = (w: World, i: number, k: UnitId): [number, number] => {
  const [m, f] = unitPrice(w, i, k);
  return [Math.round(m * 2.2), f];
};
const coastal = (c: CityState) => ['Fortaleza', 'Caucaia', 'São Gonçalo do Amarante', 'Camocim', 'Acaraú', 'Aracati', 'Aquiraz', 'Cascavel', 'Beberibe', 'Paracuru', 'Trairi', 'Icapuí', 'Itapipoca', 'Amontada', 'Itarema', 'Cruz', 'Jijoca de Jericoacoara', 'Barroquinha', 'Paraipaba', 'Fortim'].includes(CITY[c.id].name);
export function wonderBlock(w: World, i: number, id: string, c: CityState | null): string {
  const d = WONDERS.find((x) => x.id === id);
  if (!d || !c || c.owner !== i) return 'Cidade inválida.';
  const x = wonderOf(w, id);
  if (x) return x.left > 0 ? `${w.players[x.o].name} está construindo.` : `Já é de ${w.players[x.o].name}.`;
  if (w.players[i].era < d.era) return `Precisa da Era ${d.era}.`;
  if (w.wonders.some((k) => k.o === i && k.left > 0)) return 'Uma maravilha por vez.';
  if (w.wonders.some((k) => k.city === c.id)) return 'Esta cidade já tem uma maravilha.';
  if (d.coast && !coastal(c)) return 'Precisa ser no litoral.';
  return '';
}
export function govern(w: World, i: number, cmd: NationCmd, pay: Pay): string | undefined {
  const p = w.players[i];
  const n = p.n;
  const own = (id: number) => w.cities.find((c) => c.id === id && c.owner === i) ?? null;
  switch (cmd.c) {
    case 'doc':
      if (n.doc) return 'A doutrina já foi escolhida.';
      if (!DOCTRINES.some((d) => d.id === cmd.id)) return 'Doutrina inválida.';
      n.doc = cmd.id;
      return '';
    case 'pol': {
      const d = POLICIES.find((x) => x.id === cmd.id);
      if (!d) return 'Política inválida.';
      if (n.pol.includes(d.id)) {
        n.pol = n.pol.filter((x) => x !== d.id);
        return '';
      }
      if (p.era < d.era) return `Precisa da Era ${d.era}.`;
      if (n.pol.length >= policySlots(w, i)) return 'Sem vaga. Avance de era ou troque uma política.';
      n.pol = [...n.pol, d.id];
      return '';
    }
    case 'tax':
      if (![-1, 0, 1].includes(cmd.v)) return 'Imposto inválido.';
      n.tax = cmd.v as 0;
      return '';
    case 'wonder': {
      const c = own(cmd.city);
      const no = wonderBlock(w, i, cmd.id, c);
      if (no || !c) return no;
      const d = WONDERS.find((x) => x.id === cmd.id)!;
      const cost = pay([d.money, d.fuel]);
      if (cost) return cost;
      w.wonders.push({ id: d.id, o: i, city: c.id, left: mods.get(i)?.instant ? 0.1 : d.time });
      say(w, `${d.icon} ${p.name} começou: ${d.name}`, 'event');
      return '';
    }
    case 'spy': {
      const d = SPIES[cmd.k];
      const q = w.players[cmd.to];
      if (!d || !q || !q.alive || q.i === i || q.team === p.team) return 'Alvo inválido.';
      if (n.spy > 0) return `Espião descansando: ${Math.ceil(n.spy)}s.`;
      const cost = pay([d.money, 0]);
      if (cost) return cost;
      n.spy = SPY_COOL;
      const guard = (q.n.pol.includes('censura') ? 0.25 : 0) + (citiesOf(w, q.i).some((c) => c.works.some((k) => k.k === 'radar')) ? 0.08 : 0);
      if (Math.random() > d.chance - guard + (p.l.mole.includes(q.i) ? 0.2 : 0)) {
        say(w, `👁️ Um espião de ${p.name} foi pego por ${q.name}`, 'alert');
        return '';
      }
      const target = pick(citiesOf(w, q.i));
      if (cmd.k === 'mapa') n.see.push({ o: q.i, left: 60 });
      else if (cmd.k === 'infiltrar') p.l.mole = [...new Set([...p.l.mole, q.i])];
      else if (cmd.k === 'boato') for (const c of citiesOf(w, q.i)) c.mood = Math.max(0, c.mood - 10);
      else if (cmd.k === 'roubar') {
        const v = Math.round(q.money * 0.15);
        q.money -= v;
        p.money += v;
      } else if (cmd.k === 'tech') {
        const r = RESEARCH.filter((x) => (q.res[x.id] ?? 0) > (p.res[x.id] ?? 0));
        if (!r.length) return 'Ele não sabe nada que você já não saiba.';
        const x = pick(r);
        p.res[x.id] = (p.res[x.id] ?? 0) + 1;
      } else if (cmd.k === 'sabotar' && target) {
        target.off = 30;
        w.fx.push(['bum', target.x, target.z, target.x, target.z]);
      } else if (cmd.k === 'revolta' && target) target.mood = Math.max(0, target.mood - 40);
      else if (cmd.k === 'virus') for (const k in q.cool) q.cool[k as PowerId] = (q.cool[k as PowerId] ?? 0) + 60;
      stat(p, 'spies');
      say(w, `👁️ ${d.name}: missão secreta bem-sucedida contra ${q.name}`, 'info');
      return '';
    }
    case 'market': {
      const v = marketPrice(w, i);
      if (cmd.buy) {
        const no = pay([v, 0]);
        if (no) return no;
        p.fuel += 100;
        n.price = Math.min(2.5, n.price * 1.06);
      } else {
        if (p.fuel < 100) return 'Falta combustível.';
        p.fuel -= 100;
        p.money += Math.round(v * 0.7);
        n.price = Math.max(0.4, n.price * 0.94);
      }
      return '';
    }
    case 'loan':
      if (cmd.pay) {
        if (!n.debt) return 'Você não deve nada.';
        const v = Math.min(n.debt, p.money);
        p.money -= v;
        n.debt = Math.round(n.debt - v);
        return '';
      }
      if (n.debt > 0) return 'Pague o empréstimo atual antes.';
      p.money += LOAN;
      n.debt = Math.round(LOAN * 1.25);
      return '';
    case 'choose': {
      if (!n.dil) return 'Não há decisão pendente.';
      const d = DILEMMAS[n.dil.i];
      const e = (cmd.n === 0 ? d.a : d.b)[1];
      if ((e.money ?? 0) < 0 && p.money < -e.money!) return 'Falta dinheiro.';
      n.dil = null;
      effect(w, i, e);
      return '';
    }
    case 'merc': {
      const c = own(cmd.city);
      if (!c || !UNITS[cmd.k]) return 'Cidade inválida.';
      if (p.era < UNIT_ERA[cmd.k]) return `Precisa da Era ${UNIT_ERA[cmd.k]}.`;
      if (UNITS[cmd.k].sea || cmd.k === 'general' || cmd.k === 'colosso') return 'Não há mercenário desse tipo.';
      if (armySize(w, i) >= armyCap(w, i)) return 'Limite de tropas.';
      const no = pay(mercPrice(w, i, cmd.k));
      if (no) return no;
      spawn(w, cmd.k, i, c.x + rand(-0.6, 0.6), c.z + 0.8);
      return '';
    }
    case 'patrol':
      if (!Number.isFinite(cmd.x) || !Number.isFinite(cmd.z) || !Array.isArray(cmd.u)) return 'Ordem inválida.';
      for (const u of w.units) if (u.o === i && cmd.u.includes(u.i)) Object.assign(u, { pat: [u.x, u.z, cmd.x, cmd.z], tx: cmd.x, tz: cmd.z, go: 1, aim: 0 });
      return '';
    case 'scout':
      for (const u of w.units) if (u.o === i && Array.isArray(cmd.u) && cmd.u.includes(u.i)) {
        const c = pick(CITIES);
        Object.assign(u, { pat: null, scout: 1, tx: c.x, tz: c.z, go: 1, aim: 0 });
      }
      return '';
  }
}
function effect(w: World, i: number, e: Effect) {
  const p = w.players[i];
  p.money = Math.max(0, p.money + (e.money ?? 0));
  p.fuel = Math.max(0, p.fuel + (e.fuel ?? 0));
  const mine = citiesOf(w, i);
  if (e.mood) for (const c of mine) c.mood = Math.max(0, Math.min(100, c.mood + e.mood));
  if (e.ruin && mine[0]) pick(mine).ruin = e.ruin;
  if (e.troops && mine[0]) for (let k = 0; k < 2; k++) spawn(w, e.troops, i, mine[0].x + rand(-0.6, 0.6), mine[0].z + 0.8);
  if (e.research) {
    const r = RESEARCH.filter((x) => (p.res[x.id] ?? 0) < 2 && x.id !== 'nuclear');
    if (r.length) {
      const x = pick(r);
      p.res[x.id] = (p.res[x.id] ?? 0) + 1;
    }
  }
}
/** Uma vez por segundo */
export function stepNation(w: World) {
  for (const p of w.players) {
    if (!p.alive) continue;
    const n = p.n;
    n.spy = Math.max(0, n.spy - 1);
    n.price += (1 - n.price) * 0.01;
    for (const s of n.see) s.left -= 1;
    n.see = n.see.filter((s) => s.left > 0);
    // Parcelas do empréstimo
    if (n.debt > 0) {
      const v = Math.min(n.debt, Math.max(2, p.money * 0.004));
      if (p.money >= v) {
        p.money -= v;
        n.debt = Math.max(0, n.debt - v);
      }
    }
    if (p.bot) {
      if (!n.doc) n.doc = pick(DOCTRINES).id;
      if (n.pol.length < p.era && Math.random() < 0.05) {
        const l = POLICIES.filter((x) => x.era <= p.era && !n.pol.includes(x.id) && (x.mood ?? 0) >= 0);
        if (l.length) n.pol = [...n.pol, pick(l).id];
      }
      if (Math.random() < 0.01 && p.era >= 2) {
        const d = pick(WONDERS);
        const c = citiesOf(w, p.i).find((x) => !wonderBlock(w, p.i, d.id, x));
        if (c && p.money > d.money * 1.6 && p.fuel > d.fuel) {
          p.money -= d.money;
          p.fuel -= d.fuel;
          w.wonders.push({ id: d.id, o: p.i, city: c.id, left: d.time });
          say(w, `${d.icon} ${p.name} começou: ${d.name}`, 'event');
        }
      }
    } else if (n.dil) {
      n.dil.left -= 1;
      if (n.dil.left <= 0) {
        effect(w, p.i, { mood: -5 });
        n.dil = null;
      }
    } else if ((n.nextDil -= 1) <= 0) {
      n.dil = { i: Math.floor(Math.random() * DILEMMAS.length), left: 45 };
      n.nextDil = rand(130, 200);
    }
  }
  for (const c of w.cities) {
    if (c.owner < 0) continue;
    c.mood += Math.sign(moodTarget(w, c) - c.mood) * Math.min(0.5, Math.abs(moodTarget(w, c) - c.mood));
    // Povo revoltado expulsa o governo
    const p = w.players[c.owner];
    if (c.mood < 12 && c.id !== p.start && Math.random() < 0.015 && !mods.get(c.owner)?.god) {
      say(w, `📣 ${CITY[c.id].name} se rebelou contra ${p.name}!`, 'alert');
      Object.assign(c, { owner: -1, q: [], loop: '', devLeft: 0, hp: c.max, mood: 60 });
      w.fx.push(['tomada', c.x, c.z, c.x, c.z]);
      p.n.rebels++;
    }
  }
  for (const x of w.wonders) {
    const c = cityAt(w, x.city);
    if (x.left > 0) {
      if (c.owner !== x.o) x.left = -99;
      else if ((x.left -= 1) <= 0) {
        x.left = 0;
        const d = WONDERS.find((k) => k.id === x.id)!;
        say(w, `${d.icon} ${w.players[x.o].name} ergueu: ${d.name}!`, 'event');
        stat(w.players[x.o], 'wonders');
        w.fx.push(['era', c.x, c.z, c.x, c.z]);
      }
    } else if (c.owner >= 0 && c.owner !== x.o) x.o = c.owner;
  }
  w.wonders = w.wonders.filter((x) => x.left > -50);
  stepCrates(w);
  // Desastre raro
  if (Math.random() < 1 / 260) {
    const mine = w.cities.filter((c) => c.owner >= 0 && c.dev > 0);
    if (mine.length) {
      const c = pick(mine);
      const d = pick(DISASTERS);
      c.ruin = Math.min(1, c.ruin + d.ruin);
      c.mood = Math.max(0, c.mood + d.mood);
      c.off = Math.max(c.off, d.off);
      w.fx.push(['desastre', c.x, c.z, c.x, c.z]);
      say(w, `${d.icon} ${d.name} ${d.text} ${CITY[c.id].name}`, 'alert');
    }
  }
}
function stepCrates(w: World) {
  for (const x of w.crates) x.left -= 1;
  if (w.crates.length < 8 && Math.random() < 1 / 28) {
    const c = pick(CITIES);
    const a = rand(0, 6.28);
    w.crates.push({ x: c.x + Math.cos(a) * 1.5, z: c.z + Math.sin(a) * 1.5, k: Math.floor(Math.random() * CRATES.length), left: 150 });
  }
  for (const x of w.crates) {
    const u = w.units.find((k) => k.hp > 0 && !w.players[k.o].npc && Math.hypot(k.x - x.x, k.z - x.z) < 0.55);
    if (!u || x.left <= 0) continue;
    x.left = 0;
    const p = w.players[u.o];
    const k = CRATES[x.k];
    if (k === 'money') p.money += 350 + p.era * 120;
    else if (k === 'fuel') p.fuel += 150 + p.era * 60;
    else if (k === 'troop') spawn(w, pick((Object.keys(UNIT_ERA) as UnitId[]).filter((t) => UNIT_ERA[t] <= p.era && !UNITS[t].sea && t !== 'general')), u.o, x.x, x.z);
    else if (k === 'star') {
      u.star = Math.min(3, u.star + 1);
      u.hp = u.max;
    } else for (const c of citiesOf(w, u.o)) c.mood = Math.min(100, c.mood + 12);
    stat(p, 'crates');
    w.fx.push(['caixa', x.x, x.z, x.x, x.z]);
  }
  w.crates = w.crates.filter((x) => x.left > 0);
}
/** Força de cada lado em um ataque, para a previsão */
export function odds(w: World, i: number, ids: number[], c: CityState): number {
  const value = (k: UnitId, hp: number) => hp * 0.5 + UNITS[k].dmg[0] * 3 + UNITS[k].dmg[1] * 2;
  const mine = w.units.filter((u) => u.o === i && ids.includes(u.i)).reduce((s, u) => s + value(u.k, u.hp), 0);
  const foes = w.units.filter((u) => hostile(w, u.o, i) && !allied(w, u.o, i) && Math.hypot(u.x - c.x, u.z - c.z) < 3).reduce((s, u) => s + value(u.k, u.hp), 0);
  const town = c.hp * 0.8 + CITY[c.id].level * 110 + c.works.length * (c.owner >= 0 ? 60 : 0) + foes;
  return Math.max(3, Math.min(97, Math.round((mine / (mine + town)) * 100 * 1.1 - 5)));
}
// ===== Vitórias alternativas do mundo aberto =====
export const VICTORIES = [
  { id: 'povo', name: 'Supremacia', icon: '👑', text: 'Governe 60% da população' },
  { id: 'ouro', name: 'Economia', icon: '💰', text: 'Junte 600 mil de dinheiro' },
  { id: 'saber', name: 'Ciência', icon: '🔬', text: 'Complete todas as pesquisas' },
  { id: 'obra', name: 'Cultura', icon: '🏆', text: 'Tenha 5 maravilhas' },
];
export function victoryOf(w: World, i: number): [number, number][] {
  const p = w.players[i];
  const total = CITIES.reduce((s, c) => s + c.pop, 0) * 0.6;
  return [
    [citiesOf(w, i).reduce((s, c) => s + CITY[c.id].pop, 0), total], [p.money, 600_000], [RESEARCH.reduce((s, r) => s + (p.res[r.id] ?? 0), 0), RESEARCH.length * 3], [w.wonders.filter((x) => x.o === i && x.left <= 0).length, 5],
  ];
}
