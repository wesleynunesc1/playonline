import { Bonus, CITIES, CITY, REL, RESEARCH, UNITS, UNIT_ERA, UnitId, isSea, researchCost } from './data';
import { CityState, World, allied, citiesOf, cityAt, hostile, popOf, relOf, say, spawn, stat } from './sim';

/** Vida avançada do estado: eleições, ministros, leis, bolsa, comboios, assembleia, histórias, segredos, heróis, perigos e mais. */
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(l: readonly T[]) => l[Math.floor(Math.random() * l.length)];
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

// ===== Governo =====
export const MINISTERS: { id: string; name: string; icon: string; text: string; bonus: Bonus; mood: number }[] = [
  { id: 'ana', name: 'Ana Dinheiro', icon: '💰', text: 'Avarenta: rende muito, agrada pouco', bonus: { income: 0.12 }, mood: -4 },
  { id: 'beto', name: 'Beto Ferro', icon: '🛡️', text: 'Durão: tropas fortes', bonus: { armor: 0.08 }, mood: -3 },
  { id: 'clara', name: 'Clara Luz', icon: '✨', text: 'Querida por todos', bonus: {}, mood: 12 },
  { id: 'davi', name: 'Davi Motor', icon: '⚙️', text: 'Apaixonado por estradas', bonus: { speed: 0.08 }, mood: 1 },
  { id: 'elza', name: 'Elza Átomo', icon: '☢️', text: 'Cientista ousada', bonus: { power: 0.15 }, mood: -2 },
  { id: 'fabio', name: 'Fábio Olho', icon: '👁️', text: 'Desconfiado: vê tudo', bonus: { vision: 0.2 }, mood: -1 },
  { id: 'gil', name: 'Gil Obra', icon: '🏗️', text: 'Negocia preço com todo mundo', bonus: { cost: 0.05 }, mood: 0 },
  { id: 'helena', name: 'Helena Campo', icon: '🌾', text: 'Cuida do sertão', bonus: { fuel: 0.12 }, mood: 4 },
];
export const LAWS: { id: string; name: string; icon: string; text: string; bonus: Bonus; mood: number }[] = [
  { id: 'ficha', name: 'Ficha limpa', icon: '⚖️', text: 'Povo confia no governo', bonus: {}, mood: 10 },
  { id: 'porto', name: 'Porto livre', icon: '🚢', text: 'Comércio sem taxa', bonus: { income: 0.1 }, mood: 0 },
  { id: 'servico', name: 'Serviço obrigatório', icon: '🪖', text: 'Treino bem mais rápido', bonus: { train: 0.25 }, mood: -6 },
  { id: 'verde', name: 'Lei verde', icon: '🌱', text: 'Energia limpa', bonus: { fuel: 0.18 }, mood: 4 },
  { id: 'fronteira', name: 'Fronteira blindada', icon: '🏰', text: 'Cidades resistentes', bonus: { city: 0.25 }, mood: 0 },
  { id: 'patente', name: 'Patente aberta', icon: '🔬', text: 'Pesquisa mais rápida', bonus: { train: 0.04 }, mood: 2 },
];
// ===== Pesquisa avançada =====
/** Especializações: cada par só deixa escolher um lado */
export const SPECS: [string, { name: string; icon: string; bonus: Bonus }, { name: string; icon: string; bonus: Bonus }][] = [
  ['tropa', { name: 'Elite', icon: '🎖️', bonus: { dmg: 0.1 } }, { name: 'Massa', icon: '🪖', bonus: { cost: 0.07, train: 0.1 } }],
  ['campo', { name: 'Ataque veloz', icon: '⚡', bonus: { speed: 0.1 } }, { name: 'Linha firme', icon: '🧱', bonus: { armor: 0.1 } }],
  ['cidade', { name: 'Metrópoles', icon: '🏙️', bonus: { income: 0.12 } }, { name: 'Fortalezas', icon: '🏰', bonus: { city: 0.3 } }],
  ['ceu', { name: 'Olhos no céu', icon: '🛰️', bonus: { vision: 0.25 } }, { name: 'Chuva de fogo', icon: '💥', bonus: { power: 0.2 } }],
];
export const SECRETS: { id: string; name: string; icon: string; text: string; bonus: Bonus; money: number }[] = [
  { id: 'orbital', name: 'Escudo orbital', icon: '🛰️', text: 'Cidades muito resistentes', bonus: { city: 0.4 }, money: 9000 },
  { id: 'enxame', name: 'Enxame de drones', icon: '🛩️', text: 'Mais dano e visão', bonus: { dmg: 0.12, vision: 0.2 }, money: 9000 },
  { id: 'nano', name: 'Nanorreparo', icon: '🧬', text: 'Tropas se recuperam', bonus: { heal: 1, armor: 0.06 }, money: 9000 },
  { id: 'clima', name: 'Máquina do clima', icon: '🌧️', text: 'Colheitas perfeitas', bonus: { income: 0.15, fuel: 0.15 }, money: 9000 },
];
export const SCIENTISTS = ['Dra. Iracema Nunes', 'Prof. Cazuza Lima', 'Dra. Luzia Vale', 'Eng. Patativa Rocha', 'Dr. Bento Sobral', 'Dra. Moreninha Sá'];
// ===== Economia =====
export const STOCKS: { name: string; icon: string }[] = [{ name: 'Energia do Vento', icon: '🌬️' }, { name: 'Porto Pecém', icon: '🚢' }, { name: 'Castanha S.A.', icon: '🌾' }, { name: 'Drones CE', icon: '🛩️' }];
/** Prédios que rendem mais quando estão na mesma cidade */
export const SYNERGY: [string, string, string, number][] = [['mercado', 'banco', 'Centro financeiro', 0.12], ['solar', 'eolica', 'Polo de energia', 0.12], ['mercado', 'shopping', 'Polo de compras', 0.12], ['refinaria', 'fabrica', 'Polo industrial', 0.1], ['hospital', 'banco', 'Centro de serviços', 0.08]];
// ===== Assembleia =====
export const MOTIONS: { id: string; name: string; icon: string; text: string }[] = [
  { id: 'desarme', name: 'Desarmamento', icon: '🕊️', text: 'Armas nucleares proibidas por 3 min' },
  { id: 'ajuda', name: 'Ajuda ao menor', icon: '🤝', text: 'Quem tem menos cidades ganha 1000' },
  { id: 'taxa', name: 'Taxar o maior', icon: '💰', text: 'Quem tem mais cidades perde 15% do dinheiro' },
  { id: 'tregua', name: 'Trégua geral', icon: '🏳️', text: 'Ninguém atira por 60 segundos' },
  { id: 'comercio', name: 'Semana do comércio', icon: '📦', text: 'Renda +20% por 2 min' },
  { id: 'presidente', name: 'Presidente do Ceará', icon: '👑', text: 'Eleger quem tem a melhor reputação' },
];
// ===== Histórias com personagens que voltam =====
export interface Chapter { who: string; title: string; text: string; a: [string, { money?: number; fuel?: number; mood?: number; troops?: UnitId; research?: boolean }]; b: [string, { money?: number; fuel?: number; mood?: number; troops?: UnitId; research?: boolean }] }
export const STORIES: Chapter[][] = [
  [
    { who: 'Dona Zefa', title: 'A rendeira', text: 'Dona Zefa quer abrir uma cooperativa de renda.', a: ['Emprestar 200', { money: -200, mood: 5 }], b: ['Desejar sorte', {}] },
    { who: 'Dona Zefa', title: 'A cooperativa cresceu', text: 'Agora ela exporta. Oferece sociedade.', a: ['Virar sócio', { money: 600 }], b: ['Doar a parte ao povo', { mood: 14 }] },
    { who: 'Dona Zefa', title: 'Orgulho do sertão', text: 'Ela quer batizar uma escola com seu nome.', a: ['Aceitar', { mood: 12 }], b: ['Pedir um laboratório', { research: true }] },
  ],
  [
    { who: 'Tião Vaqueiro', title: 'Um homem na estrada', text: 'Tião diz conhecer trilhas secretas.', a: ['Contratar como guia', { money: -150, troops: 'moto' }], b: ['Mandar embora', {}] },
    { who: 'Tião Vaqueiro', title: 'Emboscada', text: 'Tião descobriu um depósito inimigo.', a: ['Tomar a carga', { fuel: 400 }], b: ['Queimar tudo', { mood: 8 }] },
    { who: 'Tião Vaqueiro', title: 'O capitão', text: 'Ele pede uma tropa para comandar.', a: ['Dar um tanque', { troops: 'tanque' }], b: ['Dar uma fazenda', { money: 500 }] },
  ],
  [
    { who: 'Prof. Nilo', title: 'O inventor', text: 'Nilo jura que fez um motor a água.', a: ['Pagar o teste', { money: -250, fuel: 300 }], b: ['Rir da ideia', { mood: -3 }] },
    { who: 'Prof. Nilo', title: 'A explosão', text: 'O laboratório explodiu, mas algo funcionou.', a: ['Reconstruir', { money: -300, research: true }], b: ['Vender a sucata', { money: 250 }] },
    { who: 'Prof. Nilo', title: 'O prêmio', text: 'Nilo ganhou um prêmio e divide com você.', a: ['Ficar com o dinheiro', { money: 900 }], b: ['Criar bolsas', { mood: 15 }] },
  ],
];
// ===== Objetivos secretos =====
export const GOALS: { text: string; icon: string; ok: (w: World, i: number) => boolean }[] = [
  { text: 'Governe 4 cidades do litoral', icon: '🌊', ok: (w, i) => citiesOf(w, i).filter((c) => coastal(c.id)).length >= 4 },
  { text: 'Tenha 3 acordos ao mesmo tempo', icon: '🤝', ok: (w, i) => w.players.filter((p) => p.alive && p.i !== i && relOf(w, i, p.i) >= REL.comercio).length >= 3 },
  { text: 'Junte 15 mil de dinheiro', icon: '💰', ok: (w, i) => w.players[i].money >= 15000 },
  { text: 'Tenha 3 tropas de 3 estrelas', icon: '⭐', ok: (w, i) => w.units.filter((u) => u.o === i && u.star >= 3).length >= 3 },
  { text: 'Governe 10 cidades sem tomar nenhuma à força', icon: '🕊️', ok: (w, i) => citiesOf(w, i).length >= 10 && !w.players[i].stats.caps },
  { text: 'Deixe 5 cidades com humor acima de 85%', icon: '😀', ok: (w, i) => citiesOf(w, i).filter((c) => c.mood > 85).length >= 5 },
  { text: 'Evolua 6 cidades ao máximo', icon: '🌃', ok: (w, i) => citiesOf(w, i).filter((c) => c.dev >= 3).length >= 6 },
  { text: 'Pegue 5 caixas de suprimento', icon: '📦', ok: (w, i) => (w.players[i].stats.crates ?? 0) >= 5 },
];
// ===== Mercador, heróis e equipamentos =====
export const OFFERS: { name: string; icon: string; text: string; money: number; get: 'fuel' | 'troop' | 'mood' | 'star' | 'map' }[] = [
  { name: 'Tambores de diesel', icon: '🛢️', text: '+400 de combustível', money: 220, get: 'fuel' }, { name: 'Veterano errante', icon: '🪖', text: 'Uma tropa da sua era', money: 260, get: 'troop' },
  { name: 'Trio elétrico', icon: '✨', text: 'Povo +15 de humor', money: 240, get: 'mood' }, { name: 'Medalhas', icon: '🎖️', text: '3 tropas ganham estrela', money: 320, get: 'star' }, { name: 'Mapas antigos', icon: '🗺️', text: 'Mostra uma ruína secreta', money: 180, get: 'map' },
];
export const KITS: { name: string; icon: string; text: string; money: number }[] = [
  { name: 'Colete', icon: '🛡️', text: '+20% de vida', money: 90 }, { name: 'Mira', icon: '🎯', text: '+15% de dano', money: 90 }, { name: 'Binóculo', icon: '🔭', text: '+40% de visão', money: 60 },
];
export const FORMATIONS = ['Bloco', 'Linha', 'Coluna', 'Círculo'];
export const STANCES = ['Normal', 'Firme', 'Cessar-fogo'];
/** Datas do calendário que dão um agrado a todos */
const DAYS: Record<string, string> = { '1-1': 'Ano Novo', '25-3': 'Data Magna do Ceará', '1-5': 'Dia do Trabalho', '24-6': 'São João', '7-9': 'Independência', '12-10': 'Dia das Crianças', '2-12': 'Dia do Samba', '25-12': 'Natal' };
export const specialDay = (d = new Date()) => DAYS[`${d.getDate()}-${d.getMonth() + 1}`] ?? '';
/** Inverno e verão do sertão, alternando durante a partida */
export const seasonOf = (t: number) => Math.sin((t / 600) * Math.PI * 2);
const COAST = new Set(CITIES.filter((c) => [0, 1, 2, 3, 4, 5, 6, 7].some((a) => isSea(c.x + Math.cos(a * 0.785) * 1.5, c.z + Math.sin(a * 0.785) * 1.5))).map((c) => c.id));
export const coastal = (id: number) => COAST.has(id);

// ===== Estado =====
export interface Convoy { a: number; b: number; x: number; z: number; tx: number; tz: number }
export interface Extra {
  stk: number[]; convoys: Convoy[]; merchant: { x: number; z: number; city: number; left: number } | null; ruins: { x: number; z: number; done: boolean }[]; treasure: { city: number; done: boolean };
  mines: { o: number; x: number; z: number }[]; walls: { o: number; x: number; z: number; left: number }[]; vote: { id: string; left: number; yes: number[]; no: number[] } | null; nextVote: number; ban: number; truce: number; fair: number;
  winter: number; nuked: number; embargo: [number, number][]; pacts: { a: number; b: number; left: number }[]; nextBoss: number; wave: number; nextWave: number; special: string; region: string; nextRaid: number;
}
export const newExtra = (): Extra => ({
  stk: [100, 100, 100, 100], convoys: [], merchant: null, ruins: [], treasure: { city: pick(CITIES).id, done: false }, mines: [], walls: [], vote: null, nextVote: 260, ban: 0, truce: 0, fair: 0,
  winter: 0, nuked: 0, embargo: [], pacts: [], nextBoss: 420, wave: 0, nextWave: 45, special: specialDay(), region: '', nextRaid: 200,
});
export interface Life {
  mins: string[]; laws: string[]; spec: string[]; secret: string; lab: { id: string; left: number } | null; sci: string[]; rep: number; peace: number; infl: number; stk: number[]; mole: number[]; story: [number, number] | null; chapter: Chapter | null; goal: number; goalDone: boolean;
  fest: number; elect: number; help: number; evac: number; spyMsg: number;
}
export const newLife = (): Life => ({ mins: [], laws: [], spec: [], secret: '', lab: null, sci: [], rep: 50, peace: 0, infl: 0, stk: [0, 0, 0, 0], mole: [], story: null, chapter: null, goal: Math.floor(Math.random() * GOALS.length), goalDone: false, fest: 0, elect: 360, help: 0, evac: 0, spyMsg: 0 });

export const labTime = (lvl: number) => 8 + lvl * 8;
export function realmBonus(w: World, i: number, add: (b: Bonus | undefined) => void) {
  const l = w.players[i].l;
  for (const m of MINISTERS) if (l.mins.includes(m.id)) add(m.bonus);
  for (const m of LAWS) if (l.laws.includes(m.id)) add(m.bonus);
  for (const [id, a, b] of SPECS) if (l.spec.includes(`${id}0`)) add(a.bonus);
    else if (l.spec.includes(`${id}1`)) add(b.bonus);
  add(SECRETS.find((s) => s.id === l.secret)?.bonus);
  if (w.x.special) add({ income: 0.1 });
  if (w.x.fair > 0) add({ income: 0.2 });
  if (w.x.winter > 0) add({ income: -0.25, fuel: -0.25, vision: -0.15 });
  // Época de chuva: colheita boa e estrada ruim
  const s = seasonOf(w.t);
  if (s > 0.4) add({ income: 0.05, speed: -0.05 });
  else if (s < -0.4) add({ income: -0.04, speed: 0.04 });
}
export const realmMood = (w: World, i: number) => {
  const l = w.players[i].l;
  return MINISTERS.reduce((s, m) => s + (l.mins.includes(m.id) ? m.mood : 0), 0) + LAWS.reduce((s, m) => s + (l.laws.includes(m.id) ? m.mood : 0), 0);
};
/** Multiplicador de renda: turismo da paz, embargos e prédios combinados */
export const realmIncome = (w: World, i: number) => 1 + Math.min(0.15, w.players[i].l.peace / 2400) - Math.min(0.2, w.x.embargo.filter(([, b]) => b === i).length * 0.05);
export const synergyOf = (c: CityState) => SYNERGY.filter(([a, b]) => [a, b].every((k) => c.works.some((x) => x.k === k && x.left <= 0)));
export const inflation = (w: World, i: number) => 1 + w.players[i].l.infl;

// ===== Ordens =====
export type RealmCmd =
  | { c: 'min'; id: string } | { c: 'law'; id: string } | { c: 'spec'; id: string; n: 0 | 1 } | { c: 'secret'; id: string } | { c: 'fest'; city: number } | { c: 'stock'; n: number; buy: boolean } | { c: 'vote'; yes: boolean }
  | { c: 'embargo'; to: number } | { c: 'pact'; to: number } | { c: 'help' } | { c: 'gift'; to: number } | { c: 'joint'; id: string } | { c: 'scientist' } | { c: 'upgrade'; city: number; n: number } | { c: 'place'; city: number; n: number; x: number; z: number }
  | { c: 'kit'; u: number[]; n: number } | { c: 'officer'; u: number } | { c: 'stance'; u: number[]; s: number } | { c: 'load'; u: number } | { c: 'unload'; u: number } | { c: 'evac'; city: number } | { c: 'deal'; n: number } | { c: 'story'; n: number };
type Pay = (v: [number, number]) => string;
export const upgradeCost = (k: { k: string; lv?: number }, base: number): [number, number] => [Math.round(base * 0.8 * (k.lv ?? 1)), (k.lv ?? 1) * 40];
export const CARGO: Partial<Record<UnitId, number>> = { heli: 3, blindado: 2, desembarque: 8 };
export const pactOf = (w: World, a: number, b: number) => w.x.pacts.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
export function rule(w: World, i: number, cmd: RealmCmd, pay: Pay): string | undefined {
  const p = w.players[i];
  const l = p.l;
  const own = (id: number) => w.cities.find((c) => c.id === id && c.owner === i) ?? null;
  const mine = (id: number) => w.units.find((u) => u.i === id && u.o === i) ?? null;
  const other = (to: number) => {
    const q = w.players[to];
    return q && q.alive && q.i !== i && q.team !== p.team ? q : null;
  };
  switch (cmd.c) {
    case 'min': {
      if (!MINISTERS.some((m) => m.id === cmd.id)) return 'Ministro inválido.';
      if (l.mins.includes(cmd.id)) l.mins = l.mins.filter((m) => m !== cmd.id);
      else if (l.mins.length >= 2) return 'Só há 2 cadeiras. Dispense um antes.';
      else if (w.players.some((q) => q.l.mins.includes(cmd.id))) return 'Esse ministro já trabalha para outro governo.';
      else l.mins = [...l.mins, cmd.id];
      return '';
    }
    case 'law': {
      if (!LAWS.some((m) => m.id === cmd.id) || l.laws.includes(cmd.id)) return 'Lei inválida.';
      if (l.laws.length >= (p.era >= 4 ? 2 : p.era >= 2 ? 1 : 0)) return 'A constituição aceita 1 lei na Era 2 e outra na Era 4.';
      l.laws = [...l.laws, cmd.id];
      return '';
    }
    case 'spec': {
      const s = SPECS.find((x) => x[0] === cmd.id);
      if (!s || ![0, 1].includes(cmd.n)) return 'Escolha inválida.';
      if (l.spec.some((x) => x.startsWith(cmd.id))) return 'Você já escolheu um lado.';
      if (l.spec.length >= p.era - 1) return 'Uma especialização por era, a partir da Era 2.';
      const no = pay([900, 0]);
      if (no) return no;
      l.spec = [...l.spec, `${cmd.id}${cmd.n}`];
      return '';
    }
    case 'secret': {
      const s = SECRETS.find((x) => x.id === cmd.id);
      if (!s || l.secret) return 'Só um projeto secreto por governo.';
      if (p.era < 4) return 'Precisa da Era 4.';
      const no = pay([s.money, 1500]);
      if (no) return no;
      l.secret = s.id;
      return '';
    }
    case 'fest': {
      const c = own(cmd.city);
      if (!c) return 'Cidade inválida.';
      if (l.fest > 0) return `Próxima festa em ${Math.ceil(l.fest)}s.`;
      const no = pay([250, 0]);
      if (no) return no;
      l.fest = 120;
      for (const k of citiesOf(w, i)) k.mood = Math.min(100, k.mood + (k === c ? 25 : 8));
      w.fx.push(['fogos', c.x, c.z, c.x, c.z]);
      return '';
    }
    case 'stock': {
      const v = w.x.stk[cmd.n];
      if (!v) return 'Ação inválida.';
      if (cmd.buy) {
        const no = pay([Math.round(v), 0]);
        if (no) return no;
        l.stk[cmd.n]++;
      } else {
        if (!l.stk[cmd.n]) return 'Você não tem essa ação.';
        l.stk[cmd.n]--;
        p.money += Math.round(v);
      }
      return '';
    }
    case 'vote': {
      const v = w.x.vote;
      if (!v) return 'Nenhuma votação aberta.';
      v.yes = v.yes.filter((x) => x !== i);
      v.no = v.no.filter((x) => x !== i);
      (cmd.yes ? v.yes : v.no).push(i);
      return '';
    }
    case 'embargo': {
      if (!other(cmd.to)) return 'Alvo inválido.';
      const on = w.x.embargo.some(([a, b]) => a === i && b === cmd.to);
      if (!on && relOf(w, i, cmd.to) >= REL.comercio) return 'Rompa o comércio antes.';
      w.x.embargo = on ? w.x.embargo.filter(([a, b]) => a !== i || b !== cmd.to) : [...w.x.embargo, [i, cmd.to]];
      if (!on) say(w, `🚫 ${p.name} embargou ${w.players[cmd.to].name}`, 'alert');
      return '';
    }
    case 'pact': {
      const q = other(cmd.to);
      if (!q) return 'Alvo inválido.';
      if (hostile(w, i, q.i)) return 'Façam as pazes antes.';
      if (pactOf(w, i, q.i)) return 'O pacto já vale.';
      if (w.offers.some((o) => o.a === i && o.b === q.i)) return 'Espere a resposta.';
      w.offers.push({ a: i, b: q.i, k: 4, left: 45 });
      return '';
    }
    case 'help': {
      if (l.help > 0) return `Espere ${Math.ceil(l.help)}s.`;
      const friends = w.players.filter((q) => q.alive && q.i !== i && allied(w, i, q.i));
      if (!friends.length) return 'Você não tem aliados.';
      l.help = 60;
      const home = cityAt(w, p.start).owner === i ? cityAt(w, p.start) : citiesOf(w, i)[0];
      for (const q of friends) {
        say(w, `🤝 ${p.name} pediu ajuda a ${q.name}`, 'alert');
        if (q.bot) for (const u of w.units.filter((x) => x.o === q.i && UNITS[x.k].cls !== 'ar').slice(0, 6)) Object.assign(u, { tx: home.x + rand(-0.8, 0.8), tz: home.z + rand(-0.8, 0.8), go: 1, aim: 0, pat: null });
      }
      return '';
    }
    case 'gift': {
      const q = w.players[cmd.to];
      if (!q || !q.alive || q.i === i) return 'Alvo inválido.';
      const no = pay([500, 0]);
      if (no) return no;
      q.money += 500;
      l.rep = Math.min(100, l.rep + 4);
      say(w, `🎁 ${p.name} enviou 500 a ${q.name}`, 'info');
      return '';
    }
    case 'joint':
    case 'scientist': {
      if (cmd.c === 'scientist') {
        const free = SCIENTISTS.filter((s) => !w.players.some((q) => q.l.sci.includes(s)));
        if (!free.length) return 'Todos os cientistas já foram contratados.';
        if (l.sci.length >= 2) return 'No máximo 2 cientistas.';
        const no = pay([1500, 0]);
        if (no) return no;
        l.sci = [...l.sci, pick(free)];
        return '';
      }
      const r = RESEARCH.find((x) => x.id === cmd.id);
      const friend = w.players.find((q) => q.alive && q.i !== i && relOf(w, i, q.i) === REL.alianca && (q.res[cmd.id] ?? 0) === (p.res[cmd.id] ?? 0));
      if (!r || (p.res[cmd.id] ?? 0) >= 3) return 'Pesquisa completa.';
      if (!friend) return 'Precisa de um aliado no mesmo nível dessa pesquisa.';
      const no = pay([Math.round(researchCost(p.res[cmd.id] ?? 0) * 0.65), 0]);
      if (no) return no;
      p.res[cmd.id] = (p.res[cmd.id] ?? 0) + 1;
      friend.res[cmd.id] = (friend.res[cmd.id] ?? 0) + 1;
      say(w, `🔬 ${p.name} e ${friend.name} pesquisaram juntos: ${r.name}`, 'event');
      return '';
    }
    case 'upgrade': {
      const c = own(cmd.city);
      const k = c?.works[cmd.n];
      if (!k || k.k === 'comando' || k.left > 0) return 'Construção inválida.';
      if ((k.lv ?? 1) >= 3) return 'Nível máximo.';
      if (p.era < (k.lv ?? 1) + 1) return `Precisa da Era ${(k.lv ?? 1) + 1}.`;
      const no = pay(upgradeCost(k, 400));
      if (no) return no;
      k.lv = (k.lv ?? 1) + 1;
      k.left = 8;
      return '';
    }
    case 'place': {
      const c = own(cmd.city);
      const k = c?.works[cmd.n];
      if (!c || !k || !Number.isFinite(cmd.x) || !Number.isFinite(cmd.z)) return 'Lugar inválido.';
      if (dist(c, cmd) > 1.7) return 'Longe demais da cidade.';
      if (isSea(cmd.x, cmd.z)) return 'Não dá para construir no mar.';
      k.px = cmd.x - c.x;
      k.pz = cmd.z - c.z;
      return '';
    }
    case 'kit': {
      const d = KITS[cmd.n];
      if (!d || !Array.isArray(cmd.u)) return 'Equipamento inválido.';
      const list = w.units.filter((u) => u.o === i && cmd.u.includes(u.i) && UNITS[u.k].cls === 'inf' && !u.kit);
      if (!list.length) return 'Escolha infantaria sem equipamento.';
      for (const u of list) {
        const no = pay([d.money, 0]);
        if (no) return no;
        u.kit = cmd.n + 1;
        if (cmd.n === 0) {
          u.max = Math.round(u.max * 1.2);
          u.hp = Math.min(u.max, u.hp * 1.2);
        }
      }
      return '';
    }
    case 'officer': {
      const u = mine(cmd.u);
      if (!u || u.star < 2) return 'Precisa de uma tropa com 2 estrelas.';
      if (u.chief) return 'Já é oficial.';
      if (w.units.filter((x) => x.o === i && x.chief).length >= 4) return 'No máximo 4 oficiais.';
      const no = pay([400, 0]);
      if (no) return no;
      u.chief = 1;
      w.fx.push(['estrela', u.x, u.z, u.x, u.z]);
      return '';
    }
    case 'stance':
      if (![0, 1, 2].includes(cmd.s) || !Array.isArray(cmd.u)) return 'Postura inválida.';
      for (const u of w.units) if (u.o === i && cmd.u.includes(u.i)) u.stance = cmd.s;
      return '';
    case 'load': {
      const t = mine(cmd.u);
      const room = t ? CARGO[t.k] ?? 0 : 0;
      if (!t || !room) return 'Essa tropa não transporta.';
      const list = w.units.filter((u) => u.o === i && u !== t && UNITS[u.k].cls === 'inf' && u.k !== 'general' && dist(u, t) < 1.3).slice(0, room - t.cargo.length);
      if (!list.length) return 'Chegue perto da infantaria, com vaga a bordo.';
      for (const u of list) {
        t.cargo.push([u.k, Math.round(u.hp), u.max, u.star]);
        u.hp = -1;
        u.gone = 1;
      }
      return '';
    }
    case 'unload': {
      const t = mine(cmd.u);
      if (!t || !t.cargo.length) return 'Não há ninguém a bordo.';
      const spot = [...Array(24).keys()].map((n) => ({ x: t.x + Math.cos(n * 0.26) * 0.9, z: t.z + Math.sin(n * 0.26) * 0.9 })).find((s) => !isSea(s.x, s.z));
      if (!spot) return 'Chegue perto da praia.';
      t.cargo.forEach(([k, hp, max, star], n) => Object.assign(spawn(w, k, i, spot.x + Math.cos(n) * 0.2, spot.z + Math.sin(n) * 0.2), { hp, max, star }));
      t.cargo = [];
      return '';
    }
    case 'evac': {
      const c = own(cmd.city);
      if (!c) return 'Cidade inválida.';
      if (l.evac > 0) return `Espere ${Math.ceil(l.evac)}s.`;
      l.evac = 90;
      c.safe = 60;
      c.mood = Math.max(0, c.mood - 10);
      say(w, `🏃 ${CITY[c.id].name} está sendo evacuada`, 'alert');
      return '';
    }
    case 'deal': {
      const m = w.x.merchant;
      const d = OFFERS[cmd.n];
      if (!m || !d) return 'O mercador já foi.';
      if (![...citiesOf(w, i), ...w.units.filter((u) => u.o === i)].some((o) => dist(o, m) < 2.2)) return 'Aproxime uma tropa ou cidade do mercador.';
      const no = pay([d.money, 0]);
      if (no) return no;
      if (d.get === 'fuel') p.fuel += 400;
      else if (d.get === 'troop') spawn(w, pick((Object.keys(UNIT_ERA) as UnitId[]).filter((k) => UNIT_ERA[k] <= p.era && !UNITS[k].sea && k !== 'general' && k !== 'colosso')), i, m.x + 0.3, m.z + 0.3);
      else if (d.get === 'mood') for (const c of citiesOf(w, i)) c.mood = Math.min(100, c.mood + 15);
      else if (d.get === 'star') for (const u of w.units.filter((x) => x.o === i && x.star < 3).slice(0, 3)) u.star++;
      else {
        const r = w.x.ruins.find((x) => !x.done);
        if (r) l.spyMsg = w.x.ruins.indexOf(r) + 1;
      }
      m.left = Math.min(m.left, 12);
      return '';
    }
    case 'story': {
      const ch = l.chapter;
      if (!ch) return 'Nenhuma história agora.';
      const e = (cmd.n === 0 ? ch.a : ch.b)[1];
      if ((e.money ?? 0) < 0 && p.money < -e.money!) return 'Falta dinheiro.';
      l.chapter = null;
      p.money += e.money ?? 0;
      p.fuel += e.fuel ?? 0;
      if (e.mood) for (const c of citiesOf(w, i)) c.mood = Math.max(0, Math.min(100, c.mood + e.mood));
      const home = citiesOf(w, i)[0];
      if (e.troops && home) spawn(w, e.troops, i, home.x + 0.5, home.z + 0.8);
      if (e.research) learn(w, i);
      if (l.story) l.story = l.story[1] >= 2 ? null : [l.story[0], l.story[1] + 1];
      return '';
    }
  }
}
export function learn(w: World, i: number): string {
  const p = w.players[i];
  const r = RESEARCH.filter((x) => (p.res[x.id] ?? 0) < 2 && x.id !== 'nuclear');
  if (!r.length) return '';
  const x = pick(r);
  p.res[x.id] = (p.res[x.id] ?? 0) + 1;
  return x.name;
}

// ===== A cada segundo =====
export function stepRealm(w: World) {
  const x = w.x;
  const live = w.players.filter((p) => p.alive);
  const npc = w.players.find((p) => p.npc)!;
  for (const k of ['ban', 'truce', 'fair', 'winter'] as const) x[k] = Math.max(0, x[k] - 1);
  for (const p of live) stepLife(w, p.i);
  x.pacts = x.pacts.filter((k) => (k.left -= 1) > 0);
  if (Math.round(w.t) % 5 === 0) x.stk = x.stk.map((v) => Math.max(20, Math.min(400, v * rand(0.955, 1.05) + (100 - v) * 0.004)));
  // Comboios entre parceiros comerciais
  if (x.convoys.length < 8 && Math.random() < 0.03) {
    const pairs = live.flatMap((a) => live.filter((b) => b.i > a.i && a.team !== b.team && relOf(w, a.i, b.i) >= REL.comercio).map((b) => [a, b] as const));
    if (pairs.length) {
      const [a, b] = pick(pairs);
      const [p, q] = [citiesOf(w, a.i)[0], citiesOf(w, b.i)[0]];
      if (p && q) x.convoys.push({ a: a.i, b: b.i, x: p.x, z: p.z, tx: q.x, tz: q.z });
    }
  }
  x.convoys = x.convoys.filter((c) => {
    const d = Math.hypot(c.tx - c.x, c.tz - c.z);
    const s = Math.min(0.7, d);
    c.x += ((c.tx - c.x) / (d || 1)) * s;
    c.z += ((c.tz - c.z) / (d || 1)) * s;
    const thief = w.units.find((u) => u.hp > 0 && u.o !== npc.i && (hostile(w, u.o, c.a) || hostile(w, u.o, c.b)) && !allied(w, u.o, c.a) && dist(u, c) < 0.7);
    if (thief) {
      w.players[thief.o].money += 220;
      w.fx.push(['bum', c.x, c.z, c.x, c.z]);
      say(w, `📦 ${w.players[thief.o].name} saqueou um comboio de ${w.players[c.a].name}`, 'alert');
      return false;
    }
    if (d > 0.8) return true;
    for (const i of [c.a, c.b]) w.players[i].money += 130;
    return false;
  });
  // Mercador viajante
  if (!x.merchant) {
    if (Math.random() < 1 / 90) {
      const c = pick(CITIES);
      x.merchant = { x: c.x, z: c.z, city: pick(CITIES).id, left: 240 };
    }
  } else {
    const m = x.merchant;
    const c = CITY[m.city];
    const d = Math.hypot(c.x - m.x, c.z - m.z);
    if (d < 0.5) m.city = pick(CITIES).id;
    else {
      m.x += ((c.x - m.x) / d) * Math.min(0.35, d);
      m.z += ((c.z - m.z) / d) * Math.min(0.35, d);
    }
    if ((m.left -= 1) <= 0) x.merchant = null;
  }
  // Ruínas secretas e tesouro
  if (!x.ruins.length) for (let i = 0; i < 12; i++) {
    const c = pick(CITIES);
    const a = rand(0, 6.28);
    const r = { x: c.x + Math.cos(a) * 1.8, z: c.z + Math.sin(a) * 1.8, done: false };
    if (!isSea(r.x, r.z)) x.ruins.push(r);
  }
  for (const r of x.ruins) {
    if (r.done) continue;
    const u = w.units.find((k) => k.o !== npc.i && k.hp > 0 && dist(k, r) < 0.6);
    if (!u) continue;
    r.done = true;
    const p = w.players[u.o];
    p.money += 500;
    u.star = Math.min(3, u.star + 1);
    w.fx.push(['caixa', r.x, r.z, r.x, r.z]);
    say(w, `🗿 ${p.name} descobriu uma ruína secreta`, 'event');
  }
  if (!x.treasure.done) {
    const c = CITY[x.treasure.city];
    const u = w.units.find((k) => k.o !== npc.i && k.hp > 0 && dist(k, c) < 0.7);
    if (u && w.t > 120) {
      x.treasure.done = true;
      w.players[u.o].money += 3000;
      w.fx.push(['fogos', c.x, c.z, c.x, c.z]);
      say(w, `💎 ${w.players[u.o].name} achou o tesouro perdido em ${c.name}!`, 'event');
    }
  }
  // Minas e barreiras
  x.mines = x.mines.filter((m) => {
    const u = w.units.find((k) => k.hp > 0 && UNITS[k.k].cls !== 'ar' && !UNITS[k.k].sea && hostile(w, k.o, m.o) && dist(k, m) < 0.35);
    if (!u) return true;
    w.fx.push(['bum', m.x, m.z, m.x, m.z]);
    u.hp -= UNITS[u.k].cls === 'inf' ? 90 : 220;
    u.hit = 1;
    return false;
  });
  x.walls = x.walls.filter((k) => (k.left -= 1) > 0);
  stepVote(w);
  stepAuras(w);
  stepPerils(w, npc.i);
  for (const c of w.cities) if (c.safe) c.safe = Math.max(0, c.safe - 1);
  // Sem apoio terrestre não há porta-drones parado: ele lança drones
  for (const u of w.units) if (u.k === 'portadrones' && Math.round(w.t) % 14 === 0 && w.units.filter((k) => k.o === u.o && k.k === 'fpv').length < 10) spawn(w, 'fpv', u.o, u.x + 0.3, u.z + 0.3);
}
function stepLife(w: World, i: number) {
  const p = w.players[i];
  const l = p.l;
  for (const k of ['fest', 'help', 'evac'] as const) l[k] = Math.max(0, l[k] - 1);
  l.peace = w.players.some((q) => q.alive && hostile(w, i, q.i) && q.i !== i) ? 0 : l.peace + 1;
  // Dinheiro parado demais gera inflação
  l.infl = Math.max(0, Math.min(0.4, l.infl + (p.money > 25000 ? 0.002 : -0.003)));
  if (l.lab && (l.lab.left -= 1) <= 0) {
    p.res[l.lab.id] = Math.min(3, (p.res[l.lab.id] ?? 0) + 1);
    stat(p, 'research');
    l.lab = null;
  }
  if (Math.random() < (l.sci.length ? 1 / 260 : 1 / 600)) {
    const name = learn(w, i);
    if (name && !p.bot) say(w, `✨ Invenção surpresa de ${l.sci[0] ?? p.name}: ${name}`, 'event');
  }
  if ((l.elect -= 1) <= 0) {
    l.elect = 360;
    const mine = citiesOf(w, i);
    const mood = mine.reduce((s, c) => s + c.mood, 0) / Math.max(1, mine.length);
    if (mood < 40) {
      l.mins = [];
      p.n.pol = [];
      for (const c of mine) c.mood = Math.min(100, c.mood + 18);
      say(w, `📣 ${p.name} quase perdeu a eleição: ministros e políticas caíram`, 'alert');
    } else {
      const prize = Math.round(mood * 12);
      p.money += prize;
      if (!p.bot) say(w, `👑 ${p.name} foi reeleito com ${Math.round(mood)}% e recebeu ${prize}`, 'event');
    }
  }
  // Capítulos de história, entre um dilema e outro
  if (!p.bot && !p.npc && !l.chapter && !p.n.dil && Math.random() < 1 / 150) {
    if (!l.story) l.story = [Math.floor(Math.random() * STORIES.length), 0];
    l.chapter = STORIES[l.story[0]][l.story[1]];
  }
  if (!l.goalDone && Math.round(w.t) % 3 === 0 && GOALS[l.goal].ok(w, i)) {
    l.goalDone = true;
    p.money += 2000;
    p.fuel += 500;
    say(w, `🎯 ${p.name} cumpriu seu objetivo secreto`, 'event');
  }
  if (p.bot && Math.random() < 0.01) {
    const m = pick(MINISTERS);
    if (l.mins.length < 2 && !w.players.some((q) => q.l.mins.includes(m.id))) l.mins = [...l.mins, m.id];
    if (l.laws.length < (p.era >= 4 ? 2 : p.era >= 2 ? 1 : 0)) l.laws = [...l.laws, pick(LAWS.filter((x) => !l.laws.includes(x.id))).id];
    const s = pick(SPECS);
    if (l.spec.length < p.era - 1 && !l.spec.some((k) => k.startsWith(s[0]))) l.spec = [...l.spec, `${s[0]}${Math.random() < 0.5 ? 0 : 1}`];
  }
}
function stepVote(w: World) {
  const x = w.x;
  const live = w.players.filter((p) => p.alive);
  if (!x.vote) {
    if ((x.nextVote -= 1) > 0 || live.length < 3) return;
    x.nextVote = 280;
    const m = pick(MOTIONS.filter((k) => k.id !== 'presidente' || w.t > 1200));
    x.vote = { id: m.id, left: 30, yes: [], no: [] };
    say(w, `⚖️ Assembleia: ${m.name}. Vote!`, 'event');
    return;
  }
  const v = x.vote;
  for (const p of live) if ((p.bot || !p.online) && ![...v.yes, ...v.no].includes(p.i) && Math.random() < 0.12) (Math.random() < (v.id === 'presidente' ? 0.4 : 0.55) ? v.yes : v.no).push(p.i);
  if ((v.left -= 1) > 0) return;
  x.vote = null;
  const m = MOTIONS.find((k) => k.id === v.id)!;
  const need = v.id === 'presidente' ? Math.ceil((live.length * 2) / 3) : v.no.length + 1;
  if (v.yes.length < need) return say(w, `⚖️ Assembleia rejeitou: ${m.name}`, 'info');
  say(w, `⚖️ Assembleia aprovou: ${m.name}`, 'event');
  const by = [...live].sort((a, b) => citiesOf(w, a.i).length - citiesOf(w, b.i).length);
  if (v.id === 'desarme') x.ban = 180;
  else if (v.id === 'tregua') x.truce = 60;
  else if (v.id === 'comercio') x.fair = 120;
  else if (v.id === 'ajuda') by[0].money += 1000;
  else if (v.id === 'taxa') by[by.length - 1].money *= 0.85;
  else {
    const top = [...live].sort((a, b) => b.l.rep - a.l.rep || popOf(w, b.i) - popOf(w, a.i))[0];
    w.over = { rank: [top, ...live.filter((p) => p !== top)].map((p) => p.i), title: `${top.name} foi eleito Presidente do Ceará!` };
  }
}
/** Generais, oficiais e cobertura valem para quem está por perto */
function stepAuras(w: World) {
  const chiefs = w.units.filter((u) => u.k === 'general' || u.chief);
  for (const u of w.units) {
    u.aura = chiefs.reduce((s, c) => (c.o === u.o && c !== u && dist(c, u) < 1.8 ? Math.max(s, c.k === 'general' ? 0.2 : 0.1) : s), 0);
    const inf = UNITS[u.k].cls === 'inf';
    u.cover = inf && w.cities.some((c) => dist(c, u) < 0.95) ? 0.25 : 0;
    if (inf && w.cities.some((c) => c.owner === u.o && dist(c, u) < 1.5 && c.works.some((k) => k.k === 'trincheira' && k.left <= 0))) u.cover = 0.4;
    u.slow = UNITS[u.k].cls !== 'ar' && w.x.walls.some((b) => hostile(w, b.o, u.o) && dist(b, u) < 1.1) ? 0.45 : 0;
    // Moral: infantaria quase morta recua sozinha, a menos que esteja firme ou seja veterana
    if (inf && u.hp > 0 && u.hp < u.max * 0.25 && u.hit > 0 && u.stance !== 1 && u.star < 2 && u.go !== 2 && u.k !== 'general' && !w.players[u.o].npc) {
      const home = citiesOf(w, u.o).sort((a, b) => dist(a, u) - dist(b, u))[0];
      if (home && dist(home, u) > 1) Object.assign(u, { tx: home.x, tz: home.z, go: 2, aim: 0, pat: null, scout: 0, q: [] });
    }
  }
}
/** Bandidos, ondas, chefe, invasão e meteoro: só com a regra ligada */
function stepPerils(w: World, npc: number) {
  const x = w.x;
  const on = w.rules.includes('perigos');
  const gang = (k: UnitId, cx: number, cz: number, n: number) => {
    for (let i = 0; i < n; i++) spawn(w, k, npc, cx + rand(-0.5, 0.5), cz + rand(-0.5, 0.5));
  };
  const foes = w.units.filter((u) => u.o === npc);
  if (w.mode === 'ondas') {
    if ((x.nextWave -= 1) <= 0) {
      x.wave++;
      x.nextWave = 55;
      const own = w.players.filter((p) => p.alive).flatMap((p) => citiesOf(w, p.i));
      const c = own.length ? pick(own) : cityAt(w, CITIES[0].id);
      const a = rand(0, 6.28);
      const spot = { x: c.x + Math.cos(a) * 6, z: c.z + Math.sin(a) * 6 };
      const n = 2 + Math.floor(x.wave * 1.2);
      gang('soldado', spot.x, spot.z, Math.min(16, n));
      if (x.wave > 2) gang('blindado', spot.x, spot.z, Math.min(8, Math.floor(x.wave / 2)));
      if (x.wave > 4) gang('tanque', spot.x, spot.z, Math.min(9, Math.floor(x.wave / 3)));
      if (x.wave > 6) gang('fpv', spot.x, spot.z, Math.min(8, Math.floor(x.wave / 3)));
      if (x.wave % 8 === 0) gang('colosso', spot.x, spot.z, 1);
      say(w, `⚠️ Onda ${x.wave} chegando perto de ${CITY[c.id].name}`, 'alert');
      for (const p of w.players) if (p.alive) p.money += 200 + x.wave * 40;
    }
  } else if (on) {
    if ((x.nextRaid -= 1) <= 0 && foes.length < 24) {
      x.nextRaid = 110;
      const c = pick(CITIES);
      gang('soldado', c.x + rand(-2.5, 2.5), c.z + rand(-2.5, 2.5), 3);
      say(w, `⚠️ Bandidos vistos perto de ${c.name}`, 'info');
    }
    if ((x.nextBoss -= 1) <= 0) {
      x.nextBoss = 480;
      const c = pick(CITIES);
      if (Math.random() < 0.5) {
        gang('colosso', c.x + 1.5, c.z + 1.5, 1);
        say(w, `⚠️ Um Colosso de guerra apareceu perto de ${c.name}!`, 'alert');
      } else {
        // Exército de fora entra pela divisa sul
        gang('tanque', rand(-8, 8), 36, 5);
        gang('soldado', rand(-8, 8), 36, 8);
        say(w, '⚠️ Um exército invasor cruzou a divisa!', 'alert');
      }
    }
    if (Math.random() < 1 / 900) {
      const c = pick(CITIES);
      const m = { x: c.x + rand(-2, 2), z: c.z + rand(-2, 2) };
      w.fx.push(['meteoro', m.x, m.z, m.x, m.z]);
      for (const u of w.units) if (dist(u, m) < 1.1) u.hp -= 200;
      for (const k of w.cities) if (dist(k, m) < 1) k.ruin = Math.min(1, k.ruin + 0.5);
      say(w, `☄️ Um meteoro caiu perto de ${c.name}!`, 'alert');
    }
  }
  // Inimigos do mundo marcham para a cidade governada mais próxima
  for (const u of foes) {
    if (u.go) continue;
    const c = w.cities.filter((k) => k.owner >= 0).sort((a, b) => dist(a, u) - dist(b, u))[0];
    if (c && (w.mode === 'ondas' || u.k === 'colosso' || u.k === 'tanque' || dist(c, u) < 5)) Object.assign(u, { tx: c.x + rand(-0.4, 0.4), tz: c.z + rand(-0.4, 0.4), go: 1 });
  }
}
/** Três pistas do tesouro, cada vez mais claras */
export function clues(w: World): string[] {
  const c = CITY[w.x.treasure.city];
  const out = [`Fica na região ${c.region}.`];
  if (w.t > 240) out.push(`A cidade tem ${c.name.length} letras, contando espaços.`);
  if (w.t > 480) out.push(`O nome começa com ${c.name.slice(0, 2)}.`);
  return out;
}
