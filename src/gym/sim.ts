import { create } from 'zustand';
import { sound } from '../utils/audio';
import {
  BUDGETS, CITIES, DAY, EVENTS, EventId, GUESTS, GuestId, LOAN_RATE, MONTHS, OFFLINE_DAYS, OVERDRAFT_RATE, PLOTS, RIVALS, SEASON, STAFF, START, StaffId, TAX, ZONE, ZONES, ZoneDef, neighbors, rivalMembers,
} from './data';

/**
 * Economia do Magnata Fitness, como uma academia de verdade:
 * entra dinheiro das mensalidades e das vendas; sai aluguel, salários, luz, manutenção, marketing, impostos e juros.
 * Alunos entram pela procura da cidade e saem quando estão insatisfeitos. Todas as unidades da rede funcionam ao mesmo tempo.
 */
/** Salão alugado no galpão: zona '' = ainda vazio; n = aparelhos comprados */
export interface Space { zone: string; n: number }
export interface Unit {
  city: number; spaces: (Space | null)[]; recep: number; staff: Record<StaffId, number>;
  deco: number; price: number; budget: number; targets: GuestId[];
  members: number; mix: Record<string, number>; rep: number;
}
export interface Report { month: string; revenue: number; costs: Record<string, number>; profit: number; joins: number; quits: number }
export interface Gym {
  v: 3; money: number; loan: number; day: number; units: Unit[]; active: number;
  event: { id: EventId; unit: number; left: number } | null; nextEvent: number;
  request: { unit: number; space: number; target: number; left: number } | null; nextReq: number;
  month: Report; last: Report | null; quest: number; won: boolean; t: number; played: number; earned: number;
}
const KEY = 'PLAY_ONLINE_ACADEMIA3';
try {
  for (const k of ['PLAY_ONLINE_CASSINO', 'PLAY_ONLINE_ACADEMIA', 'PLAY_ONLINE_ACADEMIA2']) localStorage.removeItem(k); // saves antigos, de outra economia
} catch { /* armazenamento indisponível */ }

const emptyReport = (day: number): Report => ({ month: monthName(day), revenue: 0, costs: {}, profit: 0, joins: 0, quits: 0 });
const newUnit = (city: number): Unit => {
  const spaces: (Space | null)[] = PLOTS.map(() => null);
  for (const [i, zone, n] of START) spaces[i] = { zone, n: zone === 'musculacao' && city ? 4 : n };
  return {
  city, spaces, recep: 1, staff: { professor: city ? 1 : 2, atendente: 1, limpeza: 1, personal: 0 },
  deco: 0, price: 99, budget: 0, targets: [], members: city ? 0 : 200, mix: { iniciante: 1 }, rep: 3,
  };
};
const fresh = (): Gym => ({
  v: 3, money: 40_000, loan: 0, day: 0, units: [newUnit(0)], active: 0, event: null, nextEvent: 25, request: null, nextReq: 12,
  month: emptyReport(0), last: null, quest: 0, won: false, t: Date.now(), played: 0, earned: 0,
});
export let C: Gym = fresh();
/** Trapaças do mod menu (não ficam salvas) */
export const mod = { free: false };

// ===== Leitura =====
export const U = () => C.units[C.active];
/** Aparelhos de um tipo de zona somando todos os salões (recepção: nível da fachada) */
export const lv = (id: string, u = U()) => (id === 'recepcao' ? u.recep : u.spaces.reduce((s, x) => s + (x?.zone === id ? x.n : 0), 0));
export function monthName(day: number) {
  return `${MONTHS[Math.floor(day / 30) % 12]} ${2026 + Math.floor(day / 360)}`;
}
export const dateText = () => `Dia ${(C.day % 30) + 1} · ${monthName(C.day)}`;
export const recepCost = (l: number) => 4_000 * Math.pow(1.8, l - 1);
export const decoCost = (l: number) => 6_000 * Math.pow(1.7, l);
export const RECEP_MAX = 10;
export const DECO_MAX = 10;
const rentMult = (u = U()) => CITIES[u.city].rent;
/** Alugar e reformar um salão vizinho */
export const plotCost = (i: number, u = U()) => PLOTS[i].cost * rentMult(u);
export const plotRent = (i: number, u = U()) => PLOTS[i].rent * rentMult(u);
export const canRent = (i: number, u = U()) => !u.spaces[i] && neighbors(i).some((j) => u.spaces[j]);
/** Montar a zona (piso, espelho, som) com o primeiro aparelho, ou comprar mais um */
export const zoneCost = (d: ZoneDef, n: number) => (n ? d.unit : d.build + d.unit);
export const machines = (u: Unit) => u.spaces.reduce((s, x) => s + (x && x.zone !== 'recepcao' ? x.n : 0), 0);
export const equipValue = (u: Unit) => u.spaces.reduce((s, x) => s + (x?.zone ? x.n * ZONE[x.zone].unit : 0), 0);
export const capacity = (u: Unit) => u.spaces.reduce((s, x) => s + (x?.zone && ZONE[x.zone].train ? x.n * ZONE[x.zone].per : 0), 0);
export const need = (u: Unit, id: StaffId) => {
  const st = STAFF.find((s) => s.id === id)!;
  if (id === 'limpeza') return Math.max(1, Math.ceil(machines(u) / st.ratio));
  return st.ratio ? Math.max(1, Math.ceil(u.members / st.ratio)) : 0;
};
/** Tipos de aluno que encontram ao menos uma sala de que gostam */
export const guestsOpen = (u = U()) => GUESTS.filter((g) => g.likes.some((id) => lv(id, u) > 0));
export const loanLimit = () => 30_000 + 6 * Math.max(0, C.last?.revenue ?? 0);
export const rank = (u: Unit) => RIVALS.filter((_, i) => rivalMembers(i, u.city) > u.members).length + 1;
export const beaten = (u: Unit) => RIVALS.filter((_, i) => rivalMembers(i, u.city) < u.members).length;

/** Números de uma unidade por mês: o que entra, o que sai e por quê */
export interface Flow {
  cap: number; crowd: number; sat: number; joins: number; quits: number; revenue: number; plans: number; sales: number; personal: number;
  costs: Record<string, number>; profit: number; why: string[]; mix: Record<string, number>; avgPlan: number;
}
export function flow(u: Unit, day = C.day): Flow {
  const cap = capacity(u);
  const M = u.members;
  const crowd = cap ? M / cap : 2;
  const why: string[] = [];
  const ratio = (id: StaffId) => Math.min(1, u.staff[id] / need(u, id));
  const shower = lv('vestiario', u) * ZONE.vestiario.per;
  const open = guestsOpen(u);
  const ev = C.event?.unit === C.units.indexOf(u) ? C.event : null;
  let sat = 0.6 + 0.025 * u.deco + 0.15 * (open.length / GUESTS.length) + (lv('sauna', u) ? 0.04 : 0) + (ev?.id === 'aulao' ? 0.1 : 0);
  const pen = (v: number, text: string) => {
    if (v > 0.02) why.push(text);
    sat -= v;
  };
  pen(Math.max(0, crowd - 0.9) * 1.2, 'Lotada: faltam aparelhos');
  pen((1 - ratio('professor')) * 0.3, 'Faltam professores');
  pen((1 - ratio('atendente')) * 0.15, 'Fila na recepção');
  pen((1 - ratio('limpeza')) * 0.25, 'Academia suja: falta limpeza');
  pen(M > shower ? 0.2 * (1 - shower / M) : 0, 'Vestiário pequeno');
  pen(Math.max(0, u.price / 99 - 1) * 0.15, 'Mensalidade cara');
  sat = Math.min(1, Math.max(0, sat));
  // Procura: gente da cidade que quer treinar e ainda não treina em lugar nenhum
  const rivals = RIVALS.reduce((s, _, i) => s + rivalMembers(i, u.city), 0);
  const market = Math.max(0, CITIES[u.city].pop * 0.045 - rivals * 0.6 - M);
  const look = 0.08 + 0.05 * lv('recepcao', u) + [0, 0.08, 0.18, 0.32, 0.5, 0.8][u.budget];
  const price = Math.pow(99 / u.price, 1.6);
  // Em cidade pequena há menos opções e todo mundo fica sabendo: a procura proporcional é maior
  const town = Math.sqrt(CITIES[0].pop / CITIES[u.city].pop);
  const joins = open.length ? market * 0.0007 * town * (0.25 + (0.75 * u.rep) / 5) * look * price * SEASON[Math.floor(day / 30) % 12] * (ev?.id === 'influencer' ? 2 : 1) * 30 : 0;
  const quits = M * (0.0025 + 0.03 * (1 - sat) ** 2) * 30;
  // Quem entra segue o perfil da propaganda; só vem quem acha a sala de que gosta
  const mix: Record<string, number> = {};
  let tot = 0;
  for (const g of open) tot += mix[g.id] = u.targets.includes(g.id) ? 3 : 1;
  for (const g of open) mix[g.id] /= tot;
  const avgPlan = GUESTS.reduce((s, g) => s + (u.mix[g.id] ?? 0) * g.plan, 0) || 1;
  const plans = M * u.price * avgPlan;
  const sales = ZONES.reduce((s, d) => s + (d.sale ? Math.min(M, lv(d.id, u) * d.per) * d.sale : 0), 0);
  const premium = M * ((u.mix.executivo ?? 0) + (u.mix.fisiculturista ?? 0) + (u.mix.influencer ?? 0));
  const personal = Math.min(u.staff.personal * 5_500, premium * 0.25 * 220);
  const revenue = plans + sales + personal;
  const costs: Record<string, number> = {
    Aluguel: u.spaces.reduce((s, x, i) => s + (x ? plotRent(i, u) : 0), 0),
    Salários: STAFF.reduce((s, st) => s + u.staff[st.id] * st.salary, 0),
    'Luz e água': u.spaces.reduce((s, x) => s + (x ? 150 + (x.zone ? x.n * ZONE[x.zone].power : 0) : 0), 0),
    Manutenção: equipValue(u) * 0.008,
    Marketing: BUDGETS[u.budget],
    Impostos: revenue * TAX,
  };
  const profit = revenue - Object.values(costs).reduce((a, b) => a + b, 0);
  return { cap, crowd, sat, joins, quits, revenue, plans, sales, personal, costs, profit, why, mix, avgPlan };
}

export interface Stats { flows: Flow[]; profit: number; revenue: number; members: number; interest: number }
export let S: Stats = { flows: [], profit: 0, revenue: 0, members: 0, interest: 0 };
export function compute(): Stats {
  const flows = C.units.map((u) => flow(u));
  const interest = C.loan * LOAN_RATE + Math.max(0, -C.money) * OVERDRAFT_RATE;
  return (S = {
    flows, interest, revenue: flows.reduce((s, f) => s + f.revenue, 0), members: C.units.reduce((s, u) => s + u.members, 0),
    profit: flows.reduce((s, f) => s + f.profit, 0) - interest,
  });
}
/** Lucro do mês da unidade ativa, para a tela */
export const F = () => S.flows[C.active] ?? flow(U());

// ===== Loja reativa da interface =====
export const useGym = create<{ v: number; offline: Report | null; toast: string; won: boolean; report: Report | null }>(() => ({ v: 0, offline: null, toast: '', won: false, report: null }));
const bump = () => useGym.setState((s) => ({ v: s.v + 1 }));
let toastTimer: ReturnType<typeof setTimeout>;
export function say(text: string) {
  clearTimeout(toastTimer);
  useGym.setState({ toast: text });
  toastTimer = setTimeout(() => useGym.setState({ toast: '' }), 3600);
}
/** Ganchos para a cena 3D */
export const fx = { rebuild: () => {}, level: (_space: number, _lv: number, _big: boolean) => {}, join: (_n: number) => {} };

// ===== Ações (tudo custa dinheiro de verdade) =====
const pay = (n: number, what: string) => {
  if (mod.free) return true;
  if (C.money < n) {
    say(`Falta dinheiro para ${what}. Veja o empréstimo em Finanças.`);
    return false;
  }
  C.money -= n;
  return true;
};
export function rentPlot(i: number) {
  const u = U();
  if (!canRent(i)) return say('Só dá para alugar o salão vizinho de um que você já tem');
  if (!pay(plotCost(i), 'alugar e reformar o salão')) return;
  u.spaces[i] = { zone: '', n: 0 };
  sound.playTechUnlocked();
  say(`🏗️ Salão alugado! Aluguel: +${money(plotRent(i))}/mês. Escolha o que montar nele.`);
  changed(true);
}
/** Monta uma zona num salão vazio (já com o primeiro aparelho) */
export function setZone(i: number, zone: string) {
  const sp = U().spaces[i];
  const d = ZONE[zone];
  if (!sp || sp.zone) return;
  if (!pay(zoneCost(d, 0), `montar ${d.name}`)) return;
  sp.zone = zone;
  sp.n = 1;
  sound.playBuy();
  say(`${d.icon} ${d.name} montado!`);
  fx.level(i, 1, false);
  changed(true);
}
/** Compra aparelhos para o salão (ou melhora a fachada, na recepção) */
export function buyMachine(i: number, n = 1) {
  const u = U();
  const sp = u.spaces[i];
  if (!sp?.zone) return;
  const d = ZONE[sp.zone];
  let done = 0;
  for (let k = 0; k < n; k++) {
    if (sp.zone === 'recepcao') {
      if (u.recep >= RECEP_MAX || !pay(recepCost(u.recep + 1), 'reformar a fachada')) break;
      u.recep++;
    } else {
      if (sp.n >= d.max || !pay(d.unit, `mais um(a) ${d.unitName}`)) break;
      sp.n++;
    }
    done++;
  }
  if (!done) return;
  sound.playBuy();
  fx.level(i, sp.zone === 'recepcao' ? u.recep : sp.n, sp.n >= d.max);
  changed(true);
}
/** Quantos aparelhos cabem no caixa agora (botão MÁX) */
export function affordable(i: number) {
  const sp = U().spaces[i];
  if (!sp?.zone || sp.zone === 'recepcao') return 1;
  const d = ZONE[sp.zone];
  return Math.max(1, Math.min(d.max - sp.n, mod.free ? 99 : Math.floor(C.money / d.unit)));
}
export function hire(id: StaffId, delta: 1 | -1) {
  const u = U();
  if (delta < 0 && u.staff[id] <= (id === 'personal' ? 0 : 1)) return say('Precisa de pelo menos um');
  u.staff[id] += delta;
  sound.playClick();
  say(delta > 0 ? `Contratou: ${STAFF.find((s) => s.id === id)!.name.toLowerCase()} (+salário no mês)` : 'Demitido: a rescisão foi paga');
  if (delta < 0) C.money -= STAFF.find((s) => s.id === id)!.salary; // rescisão
  changed();
}
export function decorate() {
  const u = U();
  if (u.deco >= DECO_MAX || !pay(decoCost(u.deco), 'melhorar a estrutura')) return;
  u.deco++;
  sound.playBuy();
  changed(true);
}
export function setBudget(b: number) {
  U().budget = b;
  sound.playClick();
  changed();
}
export function setPrice(p: number) {
  U().price = Math.round(Math.min(249, Math.max(59, p)));
  changed();
}
export const targetSlots = (u = U()) => (u.budget >= 4 ? 3 : u.budget >= 2 ? 2 : u.budget >= 1 ? 1 : 0);
export function toggleTarget(g: GuestId) {
  const u = U();
  if (u.targets.includes(g)) u.targets = u.targets.filter((x) => x !== g);
  else if (u.targets.length < targetSlots()) u.targets = [...u.targets, g];
  else return say(targetSlots() ? 'Todas as campanhas estão em uso: aumente a verba' : 'Defina uma verba de marketing primeiro');
  sound.playClick();
  changed();
}
/** Abre uma unidade nova em outra cidade: reforma do térreo, 4 aparelhos e equipe mínima */
export function openUnit(city: number) {
  if (C.units.some((u) => u.city === city) || !pay(CITIES[city].open, `abrir em ${CITIES[city].name}`)) return;
  C.units.push(newUnit(city));
  C.active = C.units.length - 1;
  sound.playVictory();
  say(`🏗️ Academia de ${CITIES[city].name} aberta! Agora ela precisa de alunos.`);
  changed(true);
}
export function setActive(i: number) {
  C.active = i;
  changed(true);
}
export function borrow(n: number) {
  if (C.loan + n > loanLimit()) return say(`O banco libera até ${money(loanLimit())} para você`);
  C.loan += n;
  C.money += n;
  sound.playBuy();
  say(`🏦 Empréstimo de ${money(n)} a ${(LOAN_RATE * 100).toFixed(1).replace('.', ',')}% ao mês`);
  changed();
}
export function repay(n: number) {
  n = Math.min(n, C.loan);
  if (!n || !pay(n, 'pagar o empréstimo')) return;
  C.loan -= n;
  sound.playBuy();
  changed();
}
function startEvent(id: EventId, unit: number) {
  const u = C.units[unit];
  const name = CITIES[u.city].name;
  if (id === 'campeonato') {
    const a = 6_000 + u.members * 4;
    C.money += a;
    C.earned += a;
    say(`🥊 Campeonato em ${name}: patrocínio de ${money(a)}`);
  } else if (id === 'fiscal') {
    if (u.staff.limpeza < need(u, 'limpeza')) {
      C.money -= 4_000;
      u.rep = Math.max(0, u.rep - 0.4);
      say(`🧾 Multa de ${money(4_000)} em ${name}: falta gente na limpeza`);
    } else {
      u.rep = Math.min(5, u.rep + 0.15);
      say(`🧾 ${name} passou na fiscalização sem problema`);
    }
  } else if (id === 'quebra') {
    const ds = ZONES.filter((d) => d.unit && lv(d.id, u) > 0);
    const d = ds[Math.floor(Math.random() * ds.length)];
    if (!d) return;
    const a = Math.round(d.unit * 0.12);
    C.money -= a;
    say(`🔧 Quebrou um(a) ${d.unitName} em ${name}: conserto de ${money(a)}`);
  } else if (id === 'aulao') {
    C.money -= 1_500;
    say(`🎉 Aulão em ${name} (DJ e frutas: ${money(1_500)}). Alunos mais felizes!`);
  } else say(`📱 Uma influenciadora postou a academia de ${name}: dobro de procura por 7 dias`);
  C.event = { id, unit, left: EVENTS[id].days };
  sound.playSonar();
}

// ===== Objetivos (guiam o caminho; o lucro vem da academia) =====
interface Quest { text: string; need: number; get: () => number; go: string }
const q = (text: string, need: number, get: () => number, go = 'up'): Quest => ({ text, need, get, go });
const first = () => C.units[0];
const QUESTS: Quest[] = [
  q('Compre mais uma máquina de musculação', 7, () => lv('musculacao', first()), 'musculacao'),
  q('Alugue o salão vizinho', 4, () => first().spaces.filter(Boolean).length, 'rent'),
  q('Monte uma área de Cardio', 1, () => lv('cardio', first()), 'cardio'),
  q('Chegue a 150 alunos', 150, () => first().members, 'p:marketing'),
  q('Contrate o segundo professor', 2, () => first().staff.professor, 'p:equipe'),
  q('Melhore a fachada da Recepção (nível 3)', 3, () => first().recep, 'recepcao'),
  q('Faça marketing todo mês', 1, () => first().budget, 'p:marketing'),
  q('Monte o Peso Livre', 1, () => lv('pesolivre', first()), 'pesolivre'),
  q('Monte a Lanchonete Fit', 1, () => lv('lanchonete', first()), 'lanchonete'),
  q('Chegue a 500 alunos', 500, () => first().members, 'up'),
  q('Tenha 8 salões no galpão', 8, () => first().spaces.filter(Boolean).length, 'rent'),
  q(`Passe a ${RIVALS[1].name}`, 2, () => beaten(first()), 'up'),
  q('Chegue a 1.000 alunos', 1_000, () => first().members, 'up'),
  q('Abra a segunda academia da rede', 2, () => C.units.length, 'p:rede'),
  q('Monte a Piscina', 1, () => lv('natacao', first()), 'natacao'),
  q('Tenha 4 academias na rede', 4, () => C.units.length, 'p:rede'),
  q('Ocupe o galpão inteiro em Fortaleza', PLOTS.length, () => first().spaces.filter(Boolean).length, 'rent'),
  q('Seja a maior academia de Fortaleza', RIVALS.length, () => beaten(first()), 'up'),
  q(`Tenha academias nas ${CITIES.length} cidades`, CITIES.length, () => C.units.length, 'p:rede'),
  q(`Seja a número 1 nas ${CITIES.length} cidades`, CITIES.length, () => C.units.filter((u) => beaten(u) >= RIVALS.length).length, 'p:rede'),
];
export const quest = (): Quest | null => QUESTS[C.quest] ?? null;
/** Salão onde está uma zona (o primeiro) */
export const spaceOf = (zone: string, u = U()) => u.spaces.findIndex((x) => x?.zone === zone);
/** Salão vizinho mais barato para alugar */
export const nextPlot = (u = U()) => PLOTS.map((_, i) => i).filter((i) => canRent(i, u)).sort((a, b) => plotCost(a, u) - plotCost(b, u))[0] ?? -1;
/** Para onde a seta do guia aponta: número do salão ('3'), 'p:painel' ou '' */
export function guide(): string {
  const u = U();
  const go = quest()?.go ?? 'up';
  if (go.startsWith('p:')) return go;
  const empty = u.spaces.findIndex((x) => x && !x.zone);
  if (go === 'rent') return String(empty >= 0 ? empty : nextPlot(u));
  if (go !== 'up') {
    const at = spaceOf(go, u);
    return String(at >= 0 ? at : empty >= 0 ? empty : nextPlot(u));
  }
  const f = flow(u);
  if (f.crowd > 0.9) {
    const at = u.spaces.findIndex((x) => x?.zone && ZONE[x.zone].train && x.n < ZONE[x.zone].max);
    return String(at >= 0 ? at : empty >= 0 ? empty : nextPlot(u));
  }
  if (f.why.length) return 'p:equipe';
  return 'p:marketing';
}

// ===== Tempo =====
let acc = 0, saveAt = 0;
/** Avança o relógio: dinheiro e alunos mudam aos poucos, o fechamento é no fim do mês */
export function tick(dt: number) {
  dt = Math.min(dt, 1);
  C.played += dt;
  const frac = dt / DAY / 30;
  compute();
  apply(frac);
  acc += dt;
  while (acc >= DAY) {
    acc -= DAY;
    newDay();
  }
  if ((saveAt += dt) >= 5) {
    saveAt = 0;
    persist();
  }
  useGym.setState((u) => ({ v: u.v + 1 }));
}
/** Aplica uma fração do mês em todas as unidades */
function apply(frac: number) {
  let joined = 0;
  C.units.forEach((u, i) => {
    const f = S.flows[i];
    const j = f.joins * frac, out = f.quits * frac;
    if (u.members + j > 0) for (const g of GUESTS) u.mix[g.id] = ((u.mix[g.id] ?? 0) * u.members + (f.mix[g.id] ?? 0) * j) / (u.members + j);
    u.members = Math.max(0, u.members + j - out);
    C.month.joins += j;
    C.month.quits += out;
    if (i === C.active) joined += j;
    C.money += f.profit * frac;
    C.month.revenue += f.revenue * frac;
    for (const k in f.costs) C.month.costs[k] = (C.month.costs[k] ?? 0) + f.costs[k] * frac;
    C.earned += Math.max(0, f.revenue) * frac;
  });
  const interest = S.interest * frac;
  C.money -= interest;
  if (interest) C.month.costs.Juros = (C.month.costs.Juros ?? 0) + interest;
  joinAcc += joined;
  if (joinAcc >= 1) {
    fx.join(Math.floor(joinAcc));
    joinAcc %= 1;
  }
}
let joinAcc = 0;
function newDay() {
  C.day++;
  C.units.forEach((u, i) => {
    u.rep += ((S.flows[i]?.sat ?? 0.6) * 5 - u.rep) * 0.04;
  });
  const ev = C.event;
  if (ev && --ev.left <= 0) C.event = null;
  if (!C.event && --C.nextEvent <= 0) {
    C.nextEvent = 20 + Math.random() * 25;
    const unit = Math.floor(Math.random() * C.units.length);
    const pool: EventId[] = ['influencer', 'fiscal', 'quebra', 'aulao'];
    if (lv('ringue', C.units[unit])) pool.push('campeonato');
    startEvent(pool[Math.floor(Math.random() * pool.length)], unit);
  }
  requests();
  const k = quest();
  if (k && k.get() >= k.need) {
    C.quest++;
    sound.playTechUnlocked();
    say(`🎯 Objetivo cumprido: ${k.text}`);
  }
  if (!C.won && C.units.length >= CITIES.length && C.units.every((u) => beaten(u) >= RIVALS.length)) {
    C.won = true;
    useGym.setState({ won: true });
    sound.playVictory();
  }
  if (C.day % 30 === 0) closeMonth();
}
/** Fechamento do mês: relatório com o que entrou e o que saiu */
function closeMonth() {
  const m = C.month;
  m.profit = m.revenue - Object.values(m.costs).reduce((a, b) => a + b, 0);
  C.last = m;
  C.month = emptyReport(C.day);
  useGym.setState({ report: m });
  if (C.money < 0) say(`⚠️ Fechou ${m.month} no vermelho: o banco cobra ${(OVERDRAFT_RATE * 100).toFixed(0)}% ao mês do saldo negativo`);
}
/** Pedidos dos alunos: se atender no prazo, a fama da academia sobe; se não, cai */
function requests() {
  const r = C.request;
  if (r) {
    const u = C.units[r.unit];
    if (!u) return void (C.request = null);
    if ((u.spaces[r.space]?.n ?? 0) >= r.target) {
      u.rep = Math.min(5, u.rep + 0.3);
      C.request = null;
      C.nextReq = 20 + Math.random() * 20;
      sound.playVictory();
      say('🙌 Pedido atendido! Os alunos estão elogiando a academia');
    } else if (--r.left <= 0) {
      u.rep = Math.max(0, u.rep - 0.2);
      C.request = null;
      C.nextReq = 20 + Math.random() * 20;
      say('😕 O pedido dos alunos não foi atendido a tempo');
    }
    return;
  }
  if (--C.nextReq > 0) return;
  const u = U();
  const pool = u.spaces.map((x, i) => [x, i] as const).filter(([x]) => x?.zone && ZONE[x.zone].train && x.n < ZONE[x.zone].max);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (!pick) return;
  const [sp, i] = pick;
  const d = ZONE[sp!.zone];
  C.request = { unit: C.active, space: i, target: Math.min(d.max, sp!.n + 1 + Math.floor(Math.random() * 2)), left: 20 };
  sound.playSonar();
  say(`📣 Os alunos pedem mais ${d.unitName}s em ${d.name}`);
}
const changed = (scene = false) => {
  compute();
  if (scene) fx.rebuild();
  bump();
  persist();
};

// ===== Salvar =====
export function persist() {
  C.t = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(C));
  } catch { /* sem espaço */ }
}
/** Carrega e roda os dias que passaram com o app fechado (até um mês) */
export function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Gym | null;
    C = raw?.v === 3 ? { ...fresh(), ...raw } : fresh();
  } catch {
    C = fresh();
  }
  const days = Math.min(OFFLINE_DAYS, Math.floor((Date.now() - C.t) / 1000 / DAY));
  if (days >= 1) {
    const money0 = C.money, members0 = C.units.reduce((s, u) => s + u.members, 0);
    for (let i = 0; i < days; i++) {
      compute();
      apply(1 / 30);
      newDay();
    }
    const away = emptyReport(C.day);
    away.month = `${days} dia${days > 1 ? 's' : ''}`;
    away.profit = C.money - money0;
    away.joins = C.units.reduce((s, u) => s + u.members, 0) - members0;
    useGym.setState({ offline: away });
  }
  compute();
  persist();
}
export function wipe() {
  C = fresh();
  changed(true);
}
/** Mod menu: mexe direto na rede */
export function cheat(f: (c: Gym) => void) {
  f(C);
  changed(true);
}
/** Avança dias de uma vez (mod e testes) */
export function skipDays(n: number) {
  for (let i = 0; i < n; i++) {
    compute();
    apply(1 / 30);
    newDay();
  }
  changed(true);
}

/** Dinheiro em reais, como no banco: R$ 12.345 · R$ 1,2 mi */
export function money(n: number) {
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e9) return `${s}R$ ${(a / 1e9).toFixed(2).replace('.', ',')} bi`;
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toFixed(2).replace('.', ',')} mi`;
  return `${s}R$ ${Math.round(a).toLocaleString('pt-BR')}`;
}
export const people = (n: number) => Math.round(n).toLocaleString('pt-BR');
