/** Catálogo do Magnata do Cassino: salas, hóspedes, equipe, rivais e cidades do Ceará. Mude números aqui. */
export type Kind = 'lobby' | 'slots' | 'cartas' | 'roleta' | 'corrida' | 'bingo' | 'mesas' | 'bar' | 'loja' | 'teatro' | 'agua' | 'hotel';
export type GuestId = 'turista' | 'aposentada' | 'empresario' | 'cantora' | 'professor' | 'herdeiro' | 'atleta' | 'influencer';
export type StaffId = 'crupie' | 'garcom' | 'seguranca' | 'limpeza';

export interface RoomDef {
  id: string; name: string; icon: string; kind: Kind; floor: number; slot: 0 | 1 | 2 | 3;
  game: boolean; cost: number; ticket: number; seats: number; svc: number; max: number;
  carpet: [string, string]; style?: number; text: string;
}
export interface FloorDef { name: string; cost: number; wall: string; neon: string }

export const FLOOR_H = 21;
/** Espaços de cada andar: centro x, centro z, largura, fundo */
export const SLOTS: [number, number, number, number][] = [[-6.9, -3.6, 12.4, 10.4], [6.9, -3.6, 12.4, 10.4], [-6.9, 6, 12.4, 6.6], [6.9, 6, 12.4, 6.6]];

export const FLOORS: FloorDef[] = [
  { name: 'Térreo', cost: 0, wall: '#3b1d5c', neon: '#ff4fd8' },
  { name: 'Salão das Cartas', cost: 12_000, wall: '#1d3557', neon: '#39d0ff' },
  { name: 'Arena das Corridas', cost: 220_000, wall: '#4a1c1c', neon: '#ffb020' },
  { name: 'Palácio dos Shows', cost: 4_500_000, wall: '#173b2f', neon: '#4dffa6' },
  { name: 'Cobertura VIP', cost: 90_000_000, wall: '#2a2346', neon: '#ffe066' },
];

const r = (id: string, name: string, icon: string, kind: Kind, floor: number, slot: 0 | 1 | 2 | 3, game: boolean, cost: number, ticket: number, seats: number, svc: number, max: number, carpet: [string, string], text: string, style = 0): RoomDef =>
  ({ id, name, icon, kind, floor, slot, game, cost, ticket, seats, svc, max, carpet, text, style });

export const ROOMS: RoomDef[] = [
  r('recepcao', 'Recepção', '🛎️', 'lobby', 0, 0, false, 0, 0, 0, 1, 1, ['#7a1f2b', '#c9a227'], 'Cada nível traz mais hóspedes por minuto.'),
  r('niqueis', 'Caça-níqueis', '🎰', 'slots', 0, 1, true, 25, 2, 2, 6, 10, ['#6d1a8a', '#ff4fd8'], 'Barato e rápido. Todo mundo gosta.'),
  r('cafe', 'Cafeteria', '☕', 'mesas', 0, 2, false, 300, 3, 4, 8, 6, ['#6b4226', '#e9c46a'], 'Cafezinho e tapioca para quem chega.'),
  r('loja', 'Loja de Lembranças', '🛍️', 'loja', 0, 3, false, 1_200, 6, 3, 10, 6, ['#1f4e5f', '#8ecae6'], 'Rendas, chapéus de palha e chaveiros.'),
  r('blackjack', 'Blackjack', '🃏', 'cartas', 1, 0, true, 9_000, 14, 5, 12, 6, ['#0f5132', '#c9a227'], 'Mesa de cartas que chega a 21.'),
  r('roleta', 'Roleta', '🎡', 'roleta', 1, 1, true, 20_000, 22, 6, 14, 5, ['#7a1f2b', '#111'], 'A bolinha gira e o salão vibra.'),
  r('bar', 'Bar Neon', '🍹', 'bar', 1, 2, false, 32_000, 18, 6, 9, 6, ['#14213d', '#39d0ff'], 'Drinques coloridos e música.'),
  r('neon', 'Caça-níqueis Neon', '💎', 'slots', 1, 3, true, 50_000, 26, 2, 6, 10, ['#2b0f4a', '#39d0ff'], 'Máquinas novas com prêmio maior.', 1),
  r('corrida', 'Corrida de Cavalos', '🏇', 'corrida', 2, 0, true, 180_000, 90, 8, 20, 5, ['#1b4332', '#95d5b2'], 'Telão gigante e torcida animada.'),
  r('bacara', 'Bacará', '🎴', 'cartas', 2, 1, true, 320_000, 140, 6, 16, 6, ['#3d0e2a', '#e9c46a'], 'O jogo de cartas preferido dos ricos.', 1),
  r('restaurante', 'Restaurante', '🍽️', 'mesas', 2, 2, false, 450_000, 120, 4, 14, 8, ['#5c3d2e', '#f4a261'], 'Peixada, baião de dois e sobremesa.', 1),
  r('poquer', 'Pôquer', '♠️', 'cartas', 2, 3, true, 700_000, 210, 6, 18, 6, ['#0b3d2e', '#9ef01a'], 'Torneios de fichas a noite inteira.', 2),
  r('bingo', 'Bingo', '🔢', 'bingo', 3, 0, true, 3_800_000, 900, 4, 22, 8, ['#5a189a', '#ffd60a'], 'Cartelas, bolinhas e muita gritaria.'),
  r('teatro', 'Teatro de Shows', '🎭', 'teatro', 3, 1, false, 6_000_000, 1_400, 10, 30, 5, ['#6a040f', '#ffba08'], 'Forró, humor e mágica no palco.'),
  r('sucos', 'Bar de Sucos', '🥤', 'bar', 3, 2, false, 8_000_000, 1_100, 6, 9, 6, ['#386641', '#a7c957'], 'Caju, cajá e graviola geladinhos.', 1),
  r('spa', 'Spa', '💆', 'agua', 3, 3, false, 12_000_000, 2_000, 3, 18, 6, ['#1b4965', '#bee9e8'], 'Massagem e banho quente.', 1),
  r('vip', 'Salão VIP', '👑', 'cartas', 4, 0, true, 70_000_000, 12_000, 6, 18, 6, ['#3c096c', '#ffd60a'], 'Mesas de ouro só para milionários.', 3),
  r('piscina', 'Piscina', '🏊', 'agua', 4, 1, false, 110_000_000, 9_000, 6, 20, 6, ['#0077b6', '#caf0f8'], 'Vista do mar de cima do prédio.'),
  r('hotel', 'Suítes', '🛏️', 'hotel', 4, 2, false, 160_000_000, 16_000, 4, 30, 8, ['#4a3b2b', '#e9c46a'], 'Quem dorme aqui volta amanhã.'),
  r('lounge', 'Lounge', '🛋️', 'mesas', 4, 3, false, 240_000_000, 20_000, 4, 16, 8, ['#22223b', '#c9ada7'], 'Sofás, piano e vista da cidade.', 2),
];
export const ROOM = Object.fromEntries(ROOMS.map((x) => [x.id, x])) as Record<string, RoomDef>;
export const GAME_ROOMS = ROOMS.filter((x) => x.game);

export interface GuestDef { id: GuestId; name: string; icon: string; spend: number; likes: string[]; stars: number; color: string; text: string }
export const GUESTS: GuestDef[] = [
  { id: 'turista', name: 'Turista', icon: '🧳', spend: 1, likes: ['niqueis', 'roleta', 'cafe', 'loja'], stars: 0, color: '#ffb703', text: 'Chega de ônibus e gasta pouco.' },
  { id: 'aposentada', name: 'Aposentada', icon: '👵', spend: 1.3, likes: ['bingo', 'niqueis', 'restaurante'], stars: 0, color: '#c77dff', text: 'Ama bingo e comida boa.' },
  { id: 'empresario', name: 'Empresário', icon: '💼', spend: 2.6, likes: ['blackjack', 'poquer', 'bar'], stars: 1, color: '#4361ee', text: 'Joga cartas depois do trabalho.' },
  { id: 'professor', name: 'Professor', icon: '🎓', spend: 1.8, likes: ['bacara', 'blackjack', 'cafe'], stars: 1, color: '#2a9d8f', text: 'Gosta de jogos de raciocínio.' },
  { id: 'atleta', name: 'Atleta', icon: '🏅', spend: 2.2, likes: ['corrida', 'sucos', 'piscina'], stars: 2, color: '#e63946', text: 'Aposta nas corridas e cuida da saúde.' },
  { id: 'influencer', name: 'Influenciadora', icon: '📱', spend: 2.4, likes: ['neon', 'spa', 'teatro'], stars: 2, color: '#ff4fd8', text: 'Posta tudo e traz seguidores.' },
  { id: 'cantora', name: 'Cantora famosa', icon: '🎤', spend: 4, likes: ['teatro', 'roleta', 'lounge'], stars: 3, color: '#ffd60a', text: 'Onde ela vai, a fama vai junto.' },
  { id: 'herdeiro', name: 'Herdeiro rico', icon: '🎩', spend: 7, likes: ['vip', 'bacara', 'hotel'], stars: 4, color: '#f4f1de', text: 'Gasta sem olhar o preço.' },
];
export const GUEST = Object.fromEntries(GUESTS.map((g) => [g.id, g])) as Record<GuestId, GuestDef>;

export const STAFF: { id: StaffId; name: string; icon: string; text: string; base: number }[] = [
  { id: 'crupie', name: 'Crupiês', icon: '🤵', text: '+6% de lucro nos jogos por nível', base: 400 },
  { id: 'garcom', name: 'Garçons', icon: '🧑‍🍳', text: '+6% de lucro nos serviços por nível', base: 500 },
  { id: 'seguranca', name: 'Segurança', icon: '🕶️', text: '+3% de satisfação por nível', base: 700 },
  { id: 'limpeza', name: 'Limpeza', icon: '🧹', text: '+3% de satisfação por nível', base: 600 },
];
export const STAFF_MAX = 25;

/** Resorts rivais da cidade: passar cada um dá diamantes; passar todos libera a próxima cidade */
export const RIVALS = [
  { name: 'Cassino Brisa', icon: '🌬️', fame: 6 },
  { name: 'Hotel Jangada', icon: '⛵', fame: 60 },
  { name: 'Palácio Sol', icon: '☀️', fame: 500 },
  { name: 'Torre Dourada', icon: '🗼', fame: 4_000 },
  { name: 'Grand Mandacaru', icon: '🌵', fame: 30_000 },
  { name: 'Império da Sorte', icon: '🍀', fame: 200_000 },
];
export const CITIES = ['Fortaleza', 'Cumbuco', 'Canoa Quebrada', 'Jericoacoara', 'Juazeiro do Norte', 'Guaramiranga', 'Aracati', 'Sobral'];
export const cityName = (i: number) => CITIES[i % CITIES.length] + (i >= CITIES.length ? ` ${Math.floor(i / CITIES.length) + 1}` : '');
/** Cada cidade nova multiplica todo o lucro e a força dos rivais */
export const cityMult = (i: number) => Math.pow(3, i);

export const STARS = [0, 30, 90, 200, 380];
export const OFFLINE_MAX = 4 * 3600;
export const CASH_SECONDS = 90;

export type EventId = 'onibus' | 'jackpot' | 'vip' | 'torneio' | 'festa';
export const EVENTS: Record<EventId, { icon: string; name: string; text: string; time: number }> = {
  onibus: { icon: '🚌', name: 'Ônibus de turistas', text: 'Dobro de hóspedes chegando', time: 60 },
  jackpot: { icon: '🎰', name: 'Noite do Jackpot', text: 'Caça-níqueis rendem 3x', time: 60 },
  vip: { icon: '🤩', name: 'Visita famosa', text: 'Toque para receber a gorjeta', time: 25 },
  torneio: { icon: '🏆', name: 'Torneio', text: 'Uma mesa rende 2x e dá diamantes', time: 90 },
  festa: { icon: '🎉', name: 'Festa no salão', text: 'Hóspedes mais felizes', time: 60 },
};

export const SHOP = [
  { id: 'dobro', icon: '⚡', name: 'Lucro em dobro', text: '10 minutos com tudo rendendo 2x', gems: 8 },
  { id: 'onibus', icon: '🚌', name: 'Ônibus extra', text: 'Chama um ônibus de turistas agora', gems: 5 },
  { id: 'cofre', icon: '💰', name: 'Cofre de 2 horas', text: 'Recebe 2 horas de lucro na hora', gems: 20 },
  { id: 'festa', icon: '🎉', name: 'Festa agora', text: 'Hóspedes mais felizes por 1 minuto', gems: 4 },
] as const;
