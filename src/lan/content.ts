import type { ModKey, Stat } from '../data/content';
import type { Res } from '../data/countries';

/** Catálogo do modo Wi-Fi: modos, regras, cartas, eventos, desafios, medalhas e interações. */

/** Efeito aplicado à nação de quem o recebe */
export interface Effect {
  money?: number; // segundos de renda
  moneyPct?: number;
  army?: number; // fração do exército
  inf?: number;
  science?: number;
  res?: Partial<Record<Res, number>>;
  morale?: number;
  guard?: number; // defesa em cada país seu
  happy?: number;
  infamy?: number;
  shield?: boolean;
  para?: boolean;
  satellite?: number;
  reset?: boolean; // recarrega poderes
  era?: number;
  buff?: [ModKey, number, number][]; // bônus, valor, segundos
}

// ===== 10 modos =====
export type ModeId = 'relampago' | 'classica' | 'longa' | 'colina' | 'riqueza' | 'continente' | 'cacada' | 'ultimo' | 'coop' | 'equipes';
export const MODES: { id: ModeId; name: string; icon: string; minutes: number; text: string; unit: string }[] = [
  { id: 'relampago', name: 'Relâmpago', icon: '⚡', minutes: 8, text: 'Mais países em 8 minutos.', unit: 'países' },
  { id: 'classica', name: 'Clássica', icon: '🌍', minutes: 20, text: 'Mais países em 20 minutos.', unit: 'países' },
  { id: 'longa', name: 'Épica', icon: '🏰', minutes: 40, text: 'Mais países em 40 minutos.', unit: 'países' },
  { id: 'colina', name: 'Rei da Colina', icon: '⛰️', minutes: 15, text: 'Domine o país dourado por mais tempo.', unit: 's no trono' },
  { id: 'riqueza', name: 'Magnatas', icon: '💰', minutes: 15, text: 'Quem terminar com mais dinheiro.', unit: 'mil' },
  { id: 'continente', name: 'Continentes', icon: '🗺️', minutes: 20, text: 'Mais países em um mesmo continente.', unit: 'no continente' },
  { id: 'cacada', name: 'Caça às Capitais', icon: '🎯', minutes: 15, text: 'Cada capital de jogador tomada vale 10; cada país vale 1.', unit: 'pontos' },
  { id: 'ultimo', name: 'Último de Pé', icon: '💀', minutes: 30, text: 'Sem volta: perdeu tudo, acabou.', unit: 'países' },
  { id: 'coop', name: 'Todos contra a Máquina', icon: '🤖', minutes: 25, text: 'Aliados, derrubem todos os impérios da máquina.', unit: 'países' },
  { id: 'equipes', name: 'Equipes', icon: '🤝', minutes: 20, text: 'Times alternados; vale a soma de países.', unit: 'países do time' },
];

// ===== 22 regras opcionais da sala =====
export const RULES: { id: string; name: string; icon: string; text: string; start?: Effect; forever?: [ModKey, number][] }[] = [
  { id: 'turbo', name: 'Turbo', icon: '⏩', text: 'Economia e mundo 2x mais rápidos' },
  { id: 'rico', name: 'Cofre cheio', icon: '🪙', text: 'Começa com mais dinheiro', start: { money: 200 } },
  { id: 'pobre', name: 'Falidos', icon: '🪫', text: 'Começa quase sem dinheiro', start: { moneyPct: -0.9 } },
  { id: 'exercito', name: 'Tropas em dobro', icon: '🪖', text: 'Dobro de tropas no início', start: { army: 1 } },
  { id: 'renda', name: 'Anos dourados', icon: '📈', text: '+60% de renda', forever: [['income', 0.6]] },
  { id: 'genios', name: 'Gênios', icon: '🧠', text: 'Ciência em dobro', start: { science: 60 }, forever: [['science', 1]] },
  { id: 'liquida', name: 'Liquidação', icon: '🏷️', text: 'Recrutar custa 30% menos', forever: [['recruit', 0.3]] },
  { id: 'obras', name: 'Mutirão', icon: '🏗️', text: 'Obras 35% mais baratas', forever: [['upgrade', 0.35]] },
  { id: 'ferro', name: 'Muralhas', icon: '🧱', text: '+40% de defesa', start: { guard: 15 }, forever: [['defense', 0.4]] },
  { id: 'furia', name: 'Fúria', icon: '😤', text: '+25% de ataque', forever: [['attack', 0.25]] },
  { id: 'mar', name: 'Mar aberto', icon: '🌊', text: 'Alcance naval em dobro', forever: [['navy', 1]] },
  { id: 'espioes', name: 'Ninho de espiões', icon: '🕵️', text: '+25% de sucesso em espionagem', forever: [['spy', 25]] },
  { id: 'medicos', name: 'Médicos', icon: '⚕️', text: '40% menos baixas', forever: [['casualty', 0.4]] },
  { id: 'fartura', name: 'Fartura', icon: '🛢️', text: 'Recursos em dobro e estoque inicial', start: { res: { oil: 60, iron: 60, food: 80, uranium: 10 } }, forever: [['resource', 1]] },
  { id: 'moderna', name: 'Era Moderna', icon: '✈️', text: 'Todos começam na Era Moderna', start: { era: 3 } },
  { id: 'nuclear', name: 'Botão vermelho', icon: '☢️', text: 'Era Moderna e urânio para uma bomba', start: { era: 3, res: { uranium: 20 } } },
  { id: 'poderes', name: 'Poderes rápidos', icon: '🔋', text: 'Poderes recarregam em metade do tempo', forever: [['power', 0.5]] },
  { id: 'cartas', name: 'Baralho maluco', icon: '🃏', text: 'Cartas 2x mais rápidas' },
  { id: 'semcartas', name: 'Sem cartas', icon: '🚫', text: 'Só estratégia' },
  { id: 'guerra', name: 'Guerra total', icon: '⚔️', text: 'Sem trégua inicial nem alianças entre jogadores' },
  { id: 'semia', name: 'Só humanos', icon: '🧑‍🤝‍🧑', text: 'Sem impérios da máquina' },
  { id: 'brutal', name: 'Máquina brutal', icon: '👹', text: 'Impérios da máquina 2x mais fortes' },
];

// ===== 36 cartas =====
export interface CardDef { id: string; name: string; icon: string; text: string; target: 'self' | 'foe' | 'all'; fx?: Effect; self?: Effect }
export const CARDS: CardDef[] = [
  { id: 'pix', name: 'Pix surpresa', icon: '📲', text: 'Ganha 1 minuto de renda', target: 'self', fx: { money: 60 } },
  { id: 'loteria', name: 'Loteria', icon: '🎰', text: 'Ganha 2 minutos de renda, mas perde moral', target: 'self', fx: { money: 120, morale: -0.05 } },
  { id: 'recruta', name: 'Alistamento', icon: '🪖', text: '+40 infantaria', target: 'self', fx: { inf: 40 } },
  { id: 'reforco', name: 'Reforços', icon: '🚁', text: '+20% do exército', target: 'self', fx: { army: 0.2 } },
  { id: 'muro', name: 'Muro relâmpago', icon: '🧱', text: '+12 de guarda em todos os seus países', target: 'self', fx: { guard: 12 } },
  { id: 'escudo', name: 'Escudo', icon: '🛡️', text: 'Anula a próxima invasão', target: 'self', fx: { shield: true } },
  { id: 'paraq', name: 'Paraquedas', icon: '🪂', text: 'Próximo ataque alcança qualquer lugar', target: 'self', fx: { para: true } },
  { id: 'olho', name: 'Drone espião', icon: '🛰️', text: 'Vê planos e táticas por 90s', target: 'self', fx: { satellite: 90 } },
  { id: 'livro', name: 'Eureka', icon: '💡', text: '+60 ciência', target: 'self', fx: { science: 60 } },
  { id: 'feira', name: 'Feira livre', icon: '🌽', text: '+40 comida, ferro e petróleo', target: 'self', fx: { res: { food: 40, iron: 40, oil: 40 } } },
  { id: 'uranio', name: 'Caixa suspeita', icon: '☢️', text: '+10 urânio', target: 'self', fx: { res: { uranium: 10 } } },
  { id: 'festa', name: 'Feriadão', icon: '🎉', text: 'Povo feliz e moral alta', target: 'self', fx: { happy: 30, morale: 0.1 } },
  { id: 'furia', name: 'Fúria', icon: '😤', text: '+30% ataque por 60s', target: 'self', fx: { buff: [['attack', 0.3, 60]] } },
  { id: 'fort', name: 'Fortaleza', icon: '🏰', text: '+50% defesa por 60s', target: 'self', fx: { buff: [['defense', 0.5, 60]] } },
  { id: 'boom', name: 'Boom econômico', icon: '📈', text: '+50% renda por 90s', target: 'self', fx: { buff: [['income', 0.5, 90]] } },
  { id: 'promo', name: 'Queima de estoque', icon: '🏷️', text: 'Tropas 40% mais baratas por 60s', target: 'self', fx: { buff: [['recruit', 0.4, 60]] } },
  { id: 'cafe', name: 'Café forte', icon: '☕', text: 'Recarrega todos os poderes', target: 'self', fx: { reset: true } },
  { id: 'mar', name: 'Maré alta', icon: '🌊', text: 'Alcance naval dobrado por 120s', target: 'self', fx: { buff: [['navy', 1, 120]] } },
  { id: 'anjo', name: 'Marketing', icon: '😇', text: '-25 de má fama', target: 'self', fx: { infamy: -25 } },
  { id: 'medico', name: 'Mutirão da saúde', icon: '⚕️', text: '40% menos baixas por 90s', target: 'self', fx: { buff: [['casualty', 0.4, 90]] } },
  { id: 'ladrao', name: 'Mão leve', icon: '🦝', text: 'Rouba 12% do dinheiro de um rival', target: 'foe', fx: { moneyPct: -0.12 }, self: { money: 45 } },
  { id: 'greve', name: 'Greve geral', icon: '✊', text: 'Rival: -50% renda por 45s', target: 'foe', fx: { buff: [['income', -0.5, 45]] } },
  { id: 'gripe', name: 'Gripe', icon: '🤧', text: 'Rival perde 12% do exército', target: 'foe', fx: { army: -0.12 } },
  { id: 'medo', name: 'Fofoca', icon: '🗣️', text: 'Rival perde moral', target: 'foe', fx: { morale: -0.15 } },
  { id: 'cupim', name: 'Cupim', icon: '🐜', text: 'Rival: -10 de guarda em todos os países', target: 'foe', fx: { guard: -10 } },
  { id: 'apagao', name: 'Apagão', icon: '🔌', text: 'Rival: -40% defesa por 40s', target: 'foe', fx: { buff: [['defense', -0.4, 40]] } },
  { id: 'lama', name: 'Lamaçal', icon: '🟤', text: 'Rival: -30% ataque por 45s', target: 'foe', fx: { buff: [['attack', -0.3, 45]] } },
  { id: 'fake', name: 'Fake news', icon: '📰', text: 'Povo do rival fica infeliz', target: 'foe', fx: { happy: -30, infamy: 15 } },
  { id: 'hacker', name: 'Hacker', icon: '💻', text: 'Rouba 30 de ciência', target: 'foe', fx: { science: -30 }, self: { science: 30 } },
  { id: 'gasto', name: 'Inflação', icon: '💸', text: 'Rival paga 40% mais por tropas por 60s', target: 'foe', fx: { buff: [['recruit', -0.4, 60]] } },
  { id: 'pombo', name: 'Pombo da paz', icon: '🕊️', text: 'Todos ganham moral; você limpa a má fama', target: 'all', fx: { morale: 0.05 }, self: { infamy: -40 } },
  { id: 'eclipse', name: 'Eclipse', icon: '🌑', text: 'Todos: -25% ataque por 40s', target: 'all', fx: { buff: [['attack', -0.25, 40]] } },
  { id: 'crash', name: 'Quebra da bolsa', icon: '📉', text: 'Todos os outros perdem 8% do dinheiro', target: 'all', fx: { moneyPct: -0.08 } },
  { id: 'churras', name: 'Churrasco', icon: '🍖', text: 'Todos +15 infantaria; você +45', target: 'all', fx: { inf: 15 }, self: { inf: 45 } },
  { id: 'chuva', name: 'Temporal', icon: '⛈️', text: 'Os outros: -6 de guarda', target: 'all', fx: { guard: -6 } },
  { id: 'carnaval', name: 'Carnaval', icon: '🎭', text: 'Todos felizes; você ganha 30s de renda', target: 'all', fx: { happy: 15 }, self: { money: 30 } },
];

// ===== 18 eventos mundiais =====
export const WORLD_EVENTS: { id: string; name: string; icon: string; text: string; who: 'all' | 'leader' | 'last' | 'random'; fx: Effect }[] = [
  { id: 'w1', name: 'Safra recorde', icon: '🌾', text: 'Todos ganham comida', who: 'all', fx: { res: { food: 50 } } },
  { id: 'w2', name: 'Corrida do ouro', icon: '⛏️', text: 'Todos ganham 40s de renda', who: 'all', fx: { money: 40 } },
  { id: 'w3', name: 'Crise mundial', icon: '📉', text: 'Renda -30% por 60s', who: 'all', fx: { buff: [['income', -0.3, 60]] } },
  { id: 'w4', name: 'Onda de calor', icon: '🥵', text: 'Ataque -15% por 60s', who: 'all', fx: { buff: [['attack', -0.15, 60]] } },
  { id: 'w5', name: 'Febre patriótica', icon: '🚩', text: 'Moral alta para todos', who: 'all', fx: { morale: 0.1 } },
  { id: 'w6', name: 'Renascimento', icon: '🎨', text: '+50 ciência para todos', who: 'all', fx: { science: 50 } },
  { id: 'w7', name: 'Inveja', icon: '😒', text: 'O líder ganha má fama', who: 'leader', fx: { infamy: 25 } },
  { id: 'w8', name: 'Imposto do líder', icon: '🧾', text: 'O líder perde 10% do dinheiro', who: 'leader', fx: { moneyPct: -0.1 } },
  { id: 'w9', name: 'Rebelião', icon: '🔥', text: 'O povo do líder fica infeliz', who: 'leader', fx: { happy: -20 } },
  { id: 'w10', name: 'Azarão', icon: '🐎', text: 'O último ganha 60 tropas', who: 'last', fx: { inf: 60 } },
  { id: 'w11', name: 'Ajuda humanitária', icon: '📦', text: 'O último ganha 2 min de renda', who: 'last', fx: { money: 120 } },
  { id: 'w12', name: 'Heróis improváveis', icon: '🦸', text: 'O último: +30% ataque por 90s', who: 'last', fx: { buff: [['attack', 0.3, 90]] } },
  { id: 'w13', name: 'Meteoro', icon: '☄️', text: 'Um azarado perde 10% do exército', who: 'random', fx: { army: -0.1 } },
  { id: 'w14', name: 'Bilhete premiado', icon: '🎟️', text: 'Um sortudo ganha 90s de renda', who: 'random', fx: { money: 90 } },
  { id: 'w15', name: 'Desertores', icon: '🏃', text: 'Um sortudo ganha 40 tropas', who: 'random', fx: { inf: 40 } },
  { id: 'w16', name: 'Liquidação bélica', icon: '🏷️', text: 'Tropas 30% mais baratas por 60s', who: 'all', fx: { buff: [['recruit', 0.3, 60]] } },
  { id: 'w17', name: 'Mar calmo', icon: '⛵', text: 'Alcance naval +60% por 90s', who: 'all', fx: { buff: [['navy', 0.6, 90]] } },
  { id: 'w18', name: 'Muralhas antigas', icon: '🏯', text: 'Todos ganham guarda', who: 'all', fx: { guard: 8 } },
];

// ===== 16 desafios relâmpago: o primeiro a cumprir leva o prêmio =====
export const CHALLENGES: { id: string; text: string; stat: Stat; n: number }[] = [
  { id: 'd1', text: 'conquistar 2 países', stat: 'conquests', n: 2 },
  { id: 'd2', text: 'conquistar 4 países', stat: 'conquests', n: 4 },
  { id: 'd3', text: 'lutar 3 batalhas', stat: 'battles', n: 3 },
  { id: 'd4', text: 'recrutar 60 tropas', stat: 'recruited', n: 60 },
  { id: 'd5', text: 'recrutar 200 tropas', stat: 'recruited', n: 200 },
  { id: 'd6', text: 'fazer 2 obras', stat: 'upgrades', n: 2 },
  { id: 'd7', text: 'fazer 4 obras', stat: 'upgrades', n: 4 },
  { id: 'd8', text: 'pesquisar 1 tecnologia', stat: 'techs', n: 1 },
  { id: 'd9', text: 'pesquisar 3 tecnologias', stat: 'techs', n: 3 },
  { id: 'd10', text: 'fazer 2 operações secretas', stat: 'spies', n: 2 },
  { id: 'd11', text: 'negociar 4 vezes no mercado', stat: 'trades', n: 4 },
  { id: 'd12', text: 'fazer 2 gestos diplomáticos', stat: 'gifts', n: 2 },
  { id: 'd13', text: 'usar 2 poderes', stat: 'powers', n: 2 },
  { id: 'd14', text: 'vencer um cerco', stat: 'sieges', n: 1 },
  { id: 'd15', text: 'repelir uma invasão', stat: 'defended', n: 1 },
  { id: 'd16', text: 'arrecadar $ 8 mil', stat: 'earned', n: 8000 },
];
export const CHALLENGE_PRIZE: Effect = { money: 60, inf: 20 };

// ===== 20 medalhas do pódio =====
export type Tally = Stat | 'lost' | 'cards' | 'talk' | 'n' | 'money' | 'science' | 'power' | 'kills' | 'peak' | 'betrayals' | 'sent';
export const MEDALS: { id: string; name: string; icon: string; key: Tally; least?: boolean }[] = [
  { id: 'm1', name: 'Conquistador', icon: '🗺️', key: 'conquests' },
  { id: 'm2', name: 'Briguento', icon: '🥊', key: 'battles' },
  { id: 'm3', name: 'Muralha Humana', icon: '🧱', key: 'defended' },
  { id: 'm4', name: 'Sargentão', icon: '🪖', key: 'recruited' },
  { id: 'm5', name: 'Mestre de Obras', icon: '🏗️', key: 'upgrades' },
  { id: 'm6', name: 'Cientista Maluco', icon: '🧪', key: 'techs' },
  { id: 'm7', name: 'Agente Secreto', icon: '🕵️', key: 'spies' },
  { id: 'm8', name: 'Camelô Mundial', icon: '🛍️', key: 'trades' },
  { id: 'm9', name: 'Diplomata', icon: '🤝', key: 'gifts' },
  { id: 'm10', name: 'Máquina de Dinheiro', icon: '💵', key: 'earned' },
  { id: 'm11', name: 'Dedo no Botão', icon: '🔴', key: 'powers' },
  { id: 'm12', name: 'Paciência de Jó', icon: '⛓️', key: 'sieges' },
  { id: 'm13', name: 'Saco de Pancada', icon: '🤕', key: 'lost' },
  { id: 'm14', name: 'Embaralhador', icon: '🃏', key: 'cards' },
  { id: 'm15', name: 'Tagarela', icon: '💬', key: 'talk' },
  { id: 'm16', name: 'Tio Patinhas', icon: '🦆', key: 'money' },
  { id: 'm17', name: 'General Supremo', icon: '⚔️', key: 'power' },
  { id: 'm18', name: 'Regicida', icon: '👑', key: 'kills' },
  { id: 'm19', name: 'Judas', icon: '🗡️', key: 'betrayals' },
  { id: 'm20', name: 'Coração Mole', icon: '💝', key: 'sent' },
];

// ===== Social =====
export const PHRASES = ['Bora!', 'Vem tranquilo 😏', 'Paz?', 'Você vai se arrepender', 'Kkkkkk', 'Ajuda aqui!', 'Traidor!', 'Boa jogada!', 'Foi sem querer', 'Tá com medo?', 'GG', 'Acorda! ⏰'];
export const EMOJIS = ['😂', '😡', '😱', '🔥', '👑', '💀', '🫡', '🙏'];
export const EMBLEMS = ['🦁', '🐉', '🦅', '🐺', '🦈', '🐂', '🦂', '🐍', '🦊', '🐗', '🦍', '🦜'];
export const COLORS = ['#3b82f6', '#22d3ee', '#f43f5e', '#84cc16', '#d946ef', '#fb923c'];
export const MAX_PLAYERS = 6;
