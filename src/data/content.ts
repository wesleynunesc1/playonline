import { RES_LIST } from './countries';
import type { Res, Terrain } from './countries';

/** Catálogo do jogo: tudo que é dado (nomes, custos, efeitos) fica aqui. */

// ===== Modificadores =====
export type ModKey =
  | 'income' | 'attack' | 'defense' | 'science' | 'recruit' | 'upgrade' | 'happy' | 'spy' | 'trade'
  | 'casualty' | 'food' | 'diplomacy' | 'siege' | 'power' | 'resource' | 'garrison' | 'navy';
export type Mods = Partial<Record<ModKey, number>>;
export const MOD_LABEL: Record<ModKey, string> = {
  income: 'renda', attack: 'ataque', defense: 'defesa', science: 'ciência', recruit: 'desconto em tropas', upgrade: 'desconto em obras',
  happy: 'felicidade', spy: 'espionagem', trade: 'comércio', casualty: 'menos baixas', food: 'comida', diplomacy: 'diplomacia',
  siege: 'cerco', power: 'recarga de poderes', resource: 'recursos', garrison: 'guarnições', navy: 'alcance naval',
};
const FLAT: ModKey[] = ['happy', 'spy'];
export const describeMods = (m: Mods) =>
  (Object.entries(m) as [ModKey, number][]).map(([k, v]) => `${v > 0 ? '+' : ''}${FLAT.includes(k) ? v : `${Math.round(v * 100)}%`} ${MOD_LABEL[k]}`).join(', ');

// ===== Tropas =====
export type Unit = 'inf' | 'tank' | 'air' | 'navy';
export const UNITS: Unit[] = ['inf', 'tank', 'air', 'navy'];
export const UNIT_INFO: Record<Unit, { icon: string; money: number; cost: Partial<Record<Res, number>>; power: number; beats: string }> = {
  inf: { icon: '🪖', money: 22, cost: { food: 0.2 }, power: 1, beats: 'forte contra aéreo' },
  tank: { icon: '🛡️', money: 50, cost: { iron: 0.4 }, power: 2, beats: 'forte contra infantaria' },
  air: { icon: '✈️', money: 60, cost: { oil: 0.4 }, power: 2.2, beats: 'forte contra blindado' },
  navy: { icon: '🚢', money: 55, cost: { iron: 0.3, oil: 0.2 }, power: 2, beats: 'forte no litoral' },
};

export const ERAS: { name: string; money: number; science: number; units: Record<Unit, string>; bonus: number }[] = [
  { name: 'Antiguidade', money: 0, science: 0, bonus: 0, units: { inf: 'Lanceiros', tank: 'Carruagens', air: 'Arqueiros', navy: 'Galeras' } },
  { name: 'Medieval', money: 4000, science: 60, bonus: 0.15, units: { inf: 'Cavaleiros', tank: 'Aríetes', air: 'Besteiros', navy: 'Caravelas' } },
  { name: 'Industrial', money: 15000, science: 200, bonus: 0.35, units: { inf: 'Fuzileiros', tank: 'Artilharia', air: 'Balões', navy: 'Encouraçados' } },
  { name: 'Moderna', money: 50000, science: 600, bonus: 0.6, units: { inf: 'Infantaria', tank: 'Tanques', air: 'Caças', navy: 'Destróieres' } },
  { name: 'Digital', money: 150000, science: 1500, bonus: 0.9, units: { inf: 'Forças Especiais', tank: 'Blindados IA', air: 'Drones', navy: 'Submarinos' } },
  { name: 'Espacial', money: 400000, science: 4000, bonus: 1.3, units: { inf: 'Exoesqueletos', tank: 'Mechas', air: 'Naves', navy: 'Leviatãs' } },
];

export const TERRAIN_INFO: Record<Terrain, { name: string; icon: string; mult: Partial<Record<Unit, number>>; defense: number }> = {
  planicie: { name: 'Planície', icon: '🌾', mult: { tank: 1.2 }, defense: 0 },
  montanha: { name: 'Montanha', icon: '⛰️', mult: { tank: 0.7, inf: 1.1 }, defense: 0.2 },
  deserto: { name: 'Deserto', icon: '🏜️', mult: { inf: 0.85, air: 1.15 }, defense: 0.05 },
  selva: { name: 'Selva', icon: '🌴', mult: { tank: 0.8, inf: 1.15, air: 0.9 }, defense: 0.1 },
  frio: { name: 'Frio', icon: '❄️', mult: { inf: 0.9 }, defense: 0.1 },
};

export const RES_INFO: Record<Res, { name: string; icon: string; price: number }> = {
  oil: { name: 'Petróleo', icon: '🛢️', price: 40 },
  iron: { name: 'Ferro', icon: '⛏️', price: 30 },
  food: { name: 'Comida', icon: '🌽', price: 20 },
  uranium: { name: 'Urânio', icon: '☢️', price: 120 },
};
export const RESOURCES = RES_LIST;

// ===== Construções e maravilhas =====
export type Building = 'fabrica' | 'banco' | 'quartel' | 'porto' | 'laboratorio';
export const BUILDINGS: Record<Building, { name: string; icon: string; cost: number; text: string }> = {
  fabrica: { name: 'Fábrica', icon: '🏭', cost: 500, text: '+30% renda e recursos do país' },
  banco: { name: 'Banco', icon: '🏦', cost: 1200, text: '+2% na renda de todo o império' },
  quartel: { name: 'Quartel', icon: '🏰', cost: 800, text: '+2% de desconto em tropas e reforça a guarnição' },
  porto: { name: 'Porto', icon: '⚓', cost: 900, text: 'Aumenta alcance naval e comércio' },
  laboratorio: { name: 'Laboratório', icon: '🔬', cost: 1000, text: '+0,5 ciência/s' },
};
export const MAX_BUILDING = 3;

export const WONDERS: { id: string; name: string; icon: string; cost: number; iron: number; mods: Mods }[] = [
  { id: 'cristo', name: 'Cristo de Ouro', icon: '⛪', cost: 8000, iron: 40, mods: { happy: 10 } },
  { id: 'muralha', name: 'Grande Muralha', icon: '🧱', cost: 12000, iron: 80, mods: { defense: 0.25 } },
  { id: 'piramide', name: 'Pirâmide Solar', icon: '🔺', cost: 15000, iron: 60, mods: { upgrade: 0.2 } },
  { id: 'biblioteca', name: 'Biblioteca Infinita', icon: '📚', cost: 18000, iron: 40, mods: { science: 0.4 } },
  { id: 'coliseu', name: 'Maracanã Imperial', icon: '🏟️', cost: 25000, iron: 100, mods: { happy: 15, income: 0.05 } },
  { id: 'canal', name: 'Canal dos Mundos', icon: '🌉', cost: 30000, iron: 120, mods: { trade: 0.5, navy: 0.4 } },
  { id: 'arsenal', name: 'Arsenal Supremo', icon: '⚔️', cost: 45000, iron: 180, mods: { attack: 0.2 } },
  { id: 'bolsa', name: 'Bolsa Planetária', icon: '💹', cost: 60000, iron: 120, mods: { income: 0.25 } },
];

// ===== Tecnologia: 9 ramos x 5 níveis = 45. Ramos em dupla se excluem a partir do nível 3 =====
export interface Branch { id: string; name: string; icon: string; mods: Mods; levels: string[]; rival?: string }
export const BRANCHES: Branch[] = [
  { id: 'mercado', name: 'Livre Mercado', icon: '💵', mods: { income: 0.06, trade: 0.1 }, rival: 'estado', levels: ['Moeda', 'Comércio', 'Bolsa', 'Globalização', 'Cripto-Real'] },
  { id: 'estado', name: 'Estado Industrial', icon: '🏗️', mods: { upgrade: 0.06, resource: 0.1 }, rival: 'mercado', levels: ['Oficinas', 'Metalurgia', 'Estatais', 'Automação', 'Nanofábricas'] },
  { id: 'blitz', name: 'Guerra Relâmpago', icon: '⚡', mods: { attack: 0.06 }, rival: 'guerrilha', levels: ['Formação', 'Cavalaria', 'Blitz', 'Armas Combinadas', 'Guerra Autônoma'] },
  { id: 'guerrilha', name: 'Defesa Popular', icon: '🌿', mods: { defense: 0.08, garrison: 0.1 }, rival: 'blitz', levels: ['Milícia', 'Trincheiras', 'Guerrilha', 'Bunkers', 'Domo de Energia'] },
  { id: 'vigilancia', name: 'Vigilância', icon: '👁️', mods: { spy: 5 }, rival: 'softpower', levels: ['Informantes', 'Cifras', 'Escutas', 'Satélites', 'IA Preditiva'] },
  { id: 'softpower', name: 'Influência Cultural', icon: '🎭', mods: { diplomacy: 0.12, happy: 2 }, rival: 'vigilancia', levels: ['Embaixadas', 'Novelas', 'Carnaval Global', 'Streaming', 'Meme Universal'] },
  { id: 'medicina', name: 'Medicina Militar', icon: '⚕️', mods: { casualty: 0.06 }, levels: ['Curandeiros', 'Hospitais', 'Antibióticos', 'Cirurgia Robótica', 'Regeneração'] },
  { id: 'logistica', name: 'Logística', icon: '🚚', mods: { recruit: 0.04, navy: 0.08, siege: 0.1 }, levels: ['Estradas', 'Ferrovias', 'Contêineres', 'Hipersônicos', 'Teletransporte'] },
  { id: 'ciencia', name: 'Academia', icon: '🧪', mods: { science: 0.1, power: 0.05 }, levels: ['Escrita', 'Universidade', 'Método Científico', 'Computação', 'Singularidade'] },
];
export const TECH_COST = [20, 60, 160, 400, 900];
export const TOTAL_TECHS = BRANCHES.length * 5;

// ===== Regimes =====
export const REGIMES: { id: string; name: string; icon: string; mods: Mods }[] = [
  { id: 'republica', name: 'República', icon: '🏛️', mods: { income: 0.1 } },
  { id: 'democracia', name: 'Democracia', icon: '🗳️', mods: { happy: 15, science: 0.15, attack: -0.05 } },
  { id: 'imperio', name: 'Império', icon: '👑', mods: { attack: 0.15, recruit: 0.1, happy: -10 } },
  { id: 'tecnocracia', name: 'Tecnocracia', icon: '🤖', mods: { science: 0.4, happy: -5 } },
];

// ===== Rivais (líderes fictícios) =====
export type Personality = 'agressivo' | 'traidor' | 'comerciante' | 'pacifico';
export interface RivalDef { id: string; capital: string; leader: string; title: string; icon: string; personality: Personality; color: string; war: string; peace: string; revenge: string }
export const RIVALS: RivalDef[] = [
  { id: 'r1', capital: 'US', leader: 'Comandante Burger', title: 'Liga do Fast-Food', icon: '🍔', personality: 'agressivo', color: '#ef4444', war: 'Vou querer seu país, com fritas grandes!', peace: 'Paz? Só se vier com refil.', revenge: 'Você cuspiu no meu milk-shake. Nunca esqueci.' },
  { id: 'r2', capital: 'CN', leader: 'Imperatriz Entrega Grátis', title: 'Dinastia do Frete', icon: '📦', personality: 'comerciante', color: '#eab308', war: 'Sua derrota chega em 3 dias úteis.', peace: 'Negócio fechado! Avalie com 5 estrelas.', revenge: 'Seu pedido de misericórdia foi cancelado.' },
  { id: 'r3', capital: 'RU', leader: 'Marechal Geladeira', title: 'União do Gelo', icon: '🧊', personality: 'agressivo', color: '#a855f7', war: 'Vim buscar um lugar mais quentinho.', peace: 'Meu coração descongelou um grau.', revenge: 'Vingança é um prato que se come frio. Eu só como frio.' },
  { id: 'r4', capital: 'FR', leader: 'Barão Croissant', title: 'Império Folhado', icon: '🥐', personality: 'traidor', color: '#ec4899', war: 'Nada pessoal, mon ami. Só apetite.', peace: 'Amigos para sempre! (ou até terça)', revenge: 'Você amassou meu croissant. Imperdoável!' },
  { id: 'r5', capital: 'IN', leader: 'Marajá do Pix', title: 'Confederação do Pix', icon: '📲', personality: 'comerciante', color: '#f97316', war: 'Sua conta foi invadida. E seu país também.', peace: 'Transferência de amizade confirmada.', revenge: 'Estorno de ofensa em processamento.' },
  { id: 'r6', capital: 'ZA', leader: 'Rainha Suricata', title: 'Reino da Savana', icon: '🦁', personality: 'pacifico', color: '#14b8a6', war: 'Até suricata morde quando pisam na toca.', peace: 'A savana é grande, cabe todo mundo.', revenge: 'A savana lembra de cada pegada.' },
  { id: 'r7', capital: 'BR', leader: 'Coronel Feijoada', title: 'República do Churrasco', icon: '🍖', personality: 'traidor', color: '#22c55e', war: 'Passei só pra pegar um prato. O país inteiro.', peace: 'Chega mais, tem carne pra todos!', revenge: 'Você furou a fila do churrasco. Agora aguenta.' },
];

// ===== Generais =====
export type Rarity = 'comum' | 'raro' | 'epico' | 'lendario';
export const RARITY: Record<Rarity, { name: string; color: string; weight: number; power: number }> = {
  comum: { name: 'Comum', color: 'text-slate-300', weight: 60, power: 1 },
  raro: { name: 'Raro', color: 'text-sky-300', weight: 27, power: 1.6 },
  epico: { name: 'Épico', color: 'text-fuchsia-300', weight: 10, power: 2.4 },
  lendario: { name: 'Lendário', color: 'text-amber-300', weight: 3, power: 3.5 },
};
export type Skill = 'ofensiva' | 'protecao' | 'estrategia';
export const SKILLS: Record<Skill, { name: string; text: string }> = {
  ofensiva: { name: 'Ofensiva', text: '+4% ataque' },
  protecao: { name: 'Proteção', text: '-5% baixas' },
  estrategia: { name: 'Estratégia', text: '+6% leitura do inimigo' },
};
export interface GeneralDef { id: string; name: string; icon: string; rarity: Rarity; unit: Unit; quote: string }
export const GENERALS: GeneralDef[] = [
  { id: 'g1', name: 'Cabo Marmita', icon: '🍱', rarity: 'comum', unit: 'inf', quote: 'Exército marcha com a barriga.' },
  { id: 'g2', name: 'Sargento Pneu', icon: '🛞', rarity: 'comum', unit: 'tank', quote: 'Se furar, a gente remenda.' },
  { id: 'g3', name: 'Tenente Pipa', icon: '🪁', rarity: 'comum', unit: 'air', quote: 'Vento a favor!' },
  { id: 'g4', name: 'Capitão Boia', icon: '🛟', rarity: 'comum', unit: 'navy', quote: 'Eu não afundo.' },
  { id: 'g5', name: 'Major Motoboy', icon: '🛵', rarity: 'raro', unit: 'inf', quote: 'Chego em 10 minutos.' },
  { id: 'g6', name: 'Dona Trator', icon: '🚜', rarity: 'raro', unit: 'tank', quote: 'Passo por cima.' },
  { id: 'g7', name: 'Comandante Drone', icon: '🛸', rarity: 'raro', unit: 'air', quote: 'Estou vendo tudo.' },
  { id: 'g8', name: 'Almirante Jangada', icon: '⛵', rarity: 'raro', unit: 'navy', quote: 'O mar é meu quintal.' },
  { id: 'g9', name: 'Coronel Capivara', icon: '🦫', rarity: 'epico', unit: 'inf', quote: 'Calma. Já ganhamos.' },
  { id: 'g10', name: 'Baronesa de Aço', icon: '🦾', rarity: 'epico', unit: 'tank', quote: 'Não dobro.' },
  { id: 'g11', name: 'Gavião Real', icon: '🦅', rarity: 'epico', unit: 'air', quote: 'O céu tem dono.' },
  { id: 'g12', name: 'Capitã Tubarão', icon: '🦈', rarity: 'epico', unit: 'navy', quote: 'Sinto cheiro de medo.' },
  { id: 'g13', name: 'Marechal Caramelo', icon: '🐕', rarity: 'lendario', unit: 'inf', quote: 'O vira-lata que latiu para impérios.' },
  { id: 'g14', name: 'Dama de Ferro-Velho', icon: '🤖', rarity: 'lendario', unit: 'tank', quote: 'Reciclo exércitos.' },
  { id: 'g15', name: 'Senhora Trovão', icon: '🌩️', rarity: 'lendario', unit: 'air', quote: 'Olhe para cima.' },
  { id: 'g16', name: 'Netuno da Baixada', icon: '🔱', rarity: 'lendario', unit: 'navy', quote: 'A maré obedece.' },
];
/** Duplas no estado-maior (3 vagas) que liberam bônus */
export const COMBOS: { ids: [string, string]; name: string; mods: Mods }[] = [
  { ids: ['g1', 'g5'], name: 'Delivery de Guerra', mods: { recruit: 0.1 } },
  { ids: ['g2', 'g6'], name: 'Oficina Pesada', mods: { upgrade: 0.1 } },
  { ids: ['g3', 'g7'], name: 'Olhos no Céu', mods: { spy: 10 } },
  { ids: ['g4', 'g8'], name: 'Maré Alta', mods: { navy: 0.3 } },
  { ids: ['g9', 'g13'], name: 'Zoológico Invencível', mods: { attack: 0.15, happy: 10 } },
  { ids: ['g10', 'g14'], name: 'Ferro e Fogo', mods: { defense: 0.2 } },
  { ids: ['g11', 'g15'], name: 'Tempestade Alada', mods: { attack: 0.15 } },
  { ids: ['g12', 'g16'], name: 'Senhores do Mar', mods: { navy: 0.5, attack: 0.08 } },
];

export const ITEMS: { id: string; name: string; icon: string; rarity: Rarity; attack: number; casualty: number; boss?: boolean }[] = [
  { id: 'i1', name: 'Cantil da Sorte', icon: '🧃', rarity: 'comum', attack: 0.03, casualty: 0 },
  { id: 'i2', name: 'Colete Remendado', icon: '🦺', rarity: 'comum', attack: 0, casualty: 0.06 },
  { id: 'i3', name: 'Binóculo Tático', icon: '🔭', rarity: 'raro', attack: 0.07, casualty: 0 },
  { id: 'i4', name: 'Capacete Blindado', icon: '🪖', rarity: 'raro', attack: 0, casualty: 0.12 },
  { id: 'i5', name: 'Espada Cerimonial', icon: '🗡️', rarity: 'epico', attack: 0.13, casualty: 0.04 },
  { id: 'i6', name: 'Coroa de Guerra', icon: '👑', rarity: 'lendario', attack: 0.2, casualty: 0.12 },
  { id: 'i7', name: 'Garra do Titã', icon: '🦖', rarity: 'lendario', attack: 0.28, casualty: 0.1, boss: true },
];

// ===== Poderes =====
export type Power = 'bombardeio' | 'escudo' | 'paraquedas' | 'satelite' | 'nuclear';
export const POWERS: Record<Power, { name: string; icon: string; cooldown: number; text: string; needsTarget: boolean }> = {
  bombardeio: { name: 'Bombardeio', icon: '💣', cooldown: 90, text: 'Derruba 30% da defesa do alvo', needsTarget: true },
  escudo: { name: 'Escudo Antimíssil', icon: '🛡️', cooldown: 180, text: 'Anula a próxima invasão contra você', needsTarget: false },
  paraquedas: { name: 'Paraquedistas', icon: '🪂', cooldown: 120, text: 'Próximo ataque alcança qualquer país', needsTarget: false },
  satelite: { name: 'Olho Total', icon: '🛰️', cooldown: 120, text: '60s vendo todos os planos e táticas', needsTarget: false },
  nuclear: { name: 'Arma Nuclear', icon: '☢️', cooldown: 400, text: 'Arrasa o alvo. Gasta 20 urânio, exige Era Moderna e o mundo se volta contra você', needsTarget: true },
};

// ===== Missões =====
export type Stat = 'conquests' | 'battles' | 'defended' | 'recruited' | 'upgrades' | 'techs' | 'spies' | 'trades' | 'gifts' | 'earned' | 'powers' | 'sieges';
export const MISSION_POOL: { stat: Stat; text: string; n: number }[] = [
  { stat: 'conquests', text: 'Conquiste {n} países', n: 3 },
  { stat: 'battles', text: 'Lute {n} batalhas', n: 5 },
  { stat: 'defended', text: 'Repila {n} invasões', n: 2 },
  { stat: 'recruited', text: 'Recrute {n} tropas', n: 150 },
  { stat: 'upgrades', text: 'Faça {n} obras', n: 5 },
  { stat: 'techs', text: 'Pesquise {n} tecnologias', n: 2 },
  { stat: 'spies', text: 'Faça {n} operações secretas', n: 3 },
  { stat: 'trades', text: 'Negocie {n} vezes no mercado', n: 5 },
  { stat: 'gifts', text: 'Faça {n} gestos diplomáticos', n: 3 },
  { stat: 'earned', text: 'Arrecade $ {n}', n: 20000 },
  { stat: 'powers', text: 'Use {n} poderes', n: 4 },
  { stat: 'sieges', text: 'Vença {n} cerco', n: 1 },
];

// ===== Prestígio =====
export const PERKS: { id: string; name: string; icon: string; mods: Mods; max: number }[] = [
  { id: 'p1', name: 'Tesouro Ancestral', icon: '💰', mods: { income: 0.1 }, max: 5 },
  { id: 'p2', name: 'Sangue Guerreiro', icon: '⚔️', mods: { attack: 0.08 }, max: 5 },
  { id: 'p3', name: 'Muralhas Eternas', icon: '🧱', mods: { defense: 0.1 }, max: 5 },
  { id: 'p4', name: 'Mentes Brilhantes', icon: '🧠', mods: { science: 0.15 }, max: 5 },
  { id: 'p5', name: 'Alistamento', icon: '🪖', mods: { recruit: 0.06 }, max: 5 },
  { id: 'p6', name: 'Povo Feliz', icon: '🎉', mods: { happy: 5 }, max: 4 },
];

export const TITLES = ['Recruta', 'Prefeito', 'Governador', 'Presidente', 'Generalíssimo', 'Rei', 'Imperador', 'Conquistador', 'Lenda', 'Dono do Mundo'];
export const SEASONS = ['Verão de Fogo', 'Carnaval de Guerra', 'Marcha das Águas', 'Outono de Ferro', 'Maio Rebelde', 'Festa Junina Bélica', 'Inverno Total', 'Ventos de Agosto', 'Independência', 'Noite dos Generais', 'Novembro Negro', 'Natal Blindado'];
export const SEASON_STEP = 60;
export const SEASON_TIERS = 10;

// ===== Modos =====
export type Goal = 'sobreviver' | 'rival' | 'renda' | 'paises' | 'alianca' | 'espaco';
export interface Scenario { id: string; name: string; icon: string; text: string; country?: string; goal: Goal; target: number; rivals: string[]; money: number; troops: number; special?: 'zumbis' | 'aliens' | 'ondas'; story?: { who: string; line: string }[] }
export const SCENARIOS: Scenario[] = [
  { id: 'fria', name: 'Guerra Fria', icon: '🥶', text: 'Dois blocos gigantes. Derrube um deles sem virar pó.', goal: 'rival', target: 1, rivals: ['r1', 'r3'], money: 4000, troops: 120 },
  { id: 'zumbis', name: 'Apocalipse Zumbi', icon: '🧟', text: 'A praga se espalha de país em país. Elimine todos os focos.', goal: 'paises', target: 25, rivals: ['r2', 'r5'], money: 5000, troops: 150, special: 'zumbis' },
  { id: 'aliens', name: 'Invasão Alienígena', icon: '👽', text: 'Naves atacam do céu. Chegue a 20 países e expulse-as.', goal: 'paises', target: 20, rivals: ['r1', 'r6'], money: 6000, troops: 160, special: 'aliens' },
  { id: 'ondas', name: 'Sobrevivência', icon: '🌊', text: 'Ondas cada vez mais fortes. Até onde você aguenta?', goal: 'sobreviver', target: 999, rivals: [], money: 5000, troops: 150, special: 'ondas' },
];
export const CAMPAIGN: Scenario[] = [
  { id: 'c1', name: 'Cap. 1: O Herdeiro', icon: '📜', text: 'Conquiste 3 países.', country: 'BR', goal: 'paises', target: 4, rivals: ['r6'], money: 3000, troops: 90, story: [{ who: 'Vovó Estrategista', line: 'Meu neto, seu avô perdeu o império num jogo de truco.' }, { who: 'Vovó Estrategista', line: 'Recupere o que é nosso. Comece pelos vizinhos, e leve um casaco.' }] },
  { id: 'c2', name: 'Cap. 2: O Continente', icon: '🌎', text: 'Domine 8 países.', country: 'BR', goal: 'paises', target: 8, rivals: ['r1', 'r6'], money: 4000, troops: 110, story: [{ who: 'Comandante Burger', line: 'Quem é esse moleque mexendo no meu quintal?' }, { who: 'Vovó Estrategista', line: 'Ele late, mas só morde hambúrguer. Avance!' }] },
  { id: 'c3', name: 'Cap. 3: Dinheiro Fala', icon: '💹', text: 'Alcance renda de $ 500/s.', country: 'DE', goal: 'renda', target: 500, rivals: ['r2', 'r4'], money: 5000, troops: 100, story: [{ who: 'Imperatriz Entrega Grátis', line: 'Guerra é cara. Que tal um cupom?' }, { who: 'Vovó Estrategista', line: 'Encha o cofre, criança. Canhão não aceita fiado.' }] },
  { id: 'c4', name: 'Cap. 4: O Traidor', icon: '🥐', text: 'Faça 2 aliados ou vassalos.', country: 'ES', goal: 'alianca', target: 2, rivals: ['r4', 'r5', 'r6'], money: 6000, troops: 120, story: [{ who: 'Barão Croissant', line: 'Confie em mim, mon ami!' }, { who: 'Vovó Estrategista', line: 'Nunca confie em quem come só o recheio.' }] },
  { id: 'c5', name: 'Cap. 5: Gelo e Sangue', icon: '🧊', text: 'Derrube o Marechal Geladeira.', country: 'PL', goal: 'rival', target: 1, rivals: ['r3'], money: 8000, troops: 200, story: [{ who: 'Marechal Geladeira', line: 'Venha. Aqui até a coragem congela.' }, { who: 'Vovó Estrategista', line: 'Esse ganhou do seu avô no truco. Cobre a dívida!' }] },
  { id: 'c6', name: 'Cap. 6: Além do Céu', icon: '🚀', text: 'Chegue a Marte.', country: 'BR', goal: 'espaco', target: 2, rivals: ['r1', 'r2', 'r3'], money: 60000, troops: 300, story: [{ who: 'Vovó Estrategista', line: 'O mundo ficou pequeno, meu neto.' }, { who: 'Vovó Estrategista', line: 'Traga um pouco de terra vermelha para as minhas plantas.' }] },
];
export const SPACE = [
  { name: 'Lua', icon: '🌙', money: 250000, science: 2500, income: 400 },
  { name: 'Marte', icon: '🔴', money: 700000, science: 6000, income: 1500 },
];

export const JOKES = [
  'Ministro do Pix anuncia imposto sobre figurinhas de WhatsApp.',
  'Cachorro caramelo é visto negociando cessar-fogo.',
  'Exército pede reforço de pão de queijo na linha de frente.',
  'Especialistas alertam: segunda-feira continua invicta.',
  'Capivara é eleita prefeita e propõe soneca nacional.',
  'Satélite confirma: a fila do banco é visível do espaço.',
  'Cientistas descobrem que o 5 minutinhos dura 2 horas.',
  'General perde batalha por esquecer o carregador.',
];
