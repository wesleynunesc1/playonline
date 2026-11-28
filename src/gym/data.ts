/** Catálogo do Magnata Fitness: salas, alunos, equipe, rivais e cidades da rede. Mude números aqui. */
export type Kind = 'lobby' | 'pesos' | 'cardio' | 'vestiario' | 'bar' | 'loja' | 'funcional' | 'ringue' | 'estudio' | 'agua' | 'mesas' | 'macas';
export type GuestId = 'iniciante' | 'aposentada' | 'executivo' | 'corredora' | 'lutador' | 'dancarina' | 'influencer' | 'fisiculturista';
export type StaffId = 'professor' | 'atendente' | 'personal' | 'limpeza';

export interface RoomDef {
  id: string; name: string; icon: string; kind: Kind; floor: number; slot: 0 | 1 | 2 | 3;
  game: boolean; cost: number; seats: number; svc: number; max: number;
  carpet: [string, string]; style?: number; text: string;
}
export interface FloorDef { name: string; cost: number; wall: string; neon: string }

export const FLOOR_H = 21;
/** Espaços de cada andar: centro x, centro z, largura, fundo */
export const SLOTS: [number, number, number, number][] = [[-6.9, -3.6, 12.4, 10.4], [6.9, -3.6, 12.4, 10.4], [-6.9, 6, 12.4, 6.6], [6.9, 6, 12.4, 6.6]];

export const FLOORS: FloorDef[] = [
  { name: 'Térreo', cost: 0, wall: '#1f2937', neon: '#22d3ee' },
  { name: 'Andar Funcional', cost: 12_000, wall: '#3b1d1d', neon: '#fb923c' },
  { name: 'Lutas e Dança', cost: 220_000, wall: '#2e1a47', neon: '#e879f9' },
  { name: 'Bem-estar', cost: 4_500_000, wall: '#123a3a', neon: '#34d399' },
  { name: 'Cobertura Premium', cost: 90_000_000, wall: '#2b2410', neon: '#facc15' },
];

const r = (id: string, name: string, icon: string, kind: Kind, floor: number, slot: 0 | 1 | 2 | 3, game: boolean, cost: number, seats: number, svc: number, max: number, carpet: [string, string], text: string, style = 0): RoomDef =>
  ({ id, name, icon, kind, floor, slot, game, cost, seats, svc, max, carpet, text, style });

/** game = sala de treino (lucro dos professores); senão é serviço (lucro dos atendentes) */
export const ROOMS: RoomDef[] = [
  r('recepcao', 'Recepção', '🛎️', 'lobby', 0, 0, false, 0, 0, 1, 1, ['#334155', '#22d3ee'], 'Cada nível traz mais alunos por minuto.'),
  r('musculacao', 'Musculação', '🏋️', 'pesos', 0, 1, true, 25, 2, 6, 10, ['#1f2937', '#f97316'], 'Supino, agachamento e halteres.'),
  r('esteiras', 'Esteiras', '🏃', 'cardio', 0, 2, true, 300, 1, 5, 8, ['#0f172a', '#22d3ee'], 'Corrida e caminhada com vista.'),
  r('vestiario', 'Vestiário', '🚿', 'vestiario', 0, 3, false, 1_200, 3, 10, 6, ['#e2e8f0', '#64748b'], 'Armários e banho quente.'),
  r('spinning', 'Spinning', '🚴', 'cardio', 1, 0, true, 9_000, 1, 8, 12, ['#1e1b4b', '#fb923c'], 'Bicicletas com luz e música alta.', 1),
  r('funcional', 'Funcional', '🤸', 'funcional', 1, 1, true, 20_000, 3, 10, 6, ['#3f3f46', '#facc15'], 'Caixotes, cordas e kettlebells.'),
  r('lanchonete', 'Lanchonete Fit', '🥤', 'bar', 1, 2, false, 32_000, 6, 9, 6, ['#14532d', '#86efac'], 'Açaí, tapioca e vitaminas.'),
  r('suplementos', 'Loja de Suplementos', '🛍️', 'loja', 1, 3, false, 50_000, 3, 10, 6, ['#1e3a8a', '#93c5fd'], 'Whey, roupas e garrafinhas.'),
  r('ringue', 'Ringue de Lutas', '🥊', 'ringue', 2, 0, true, 180_000, 6, 18, 6, ['#450a0a', '#ef4444'], 'Boxe, muay thai e jiu-jítsu.'),
  r('danca', 'Estúdio de Dança', '💃', 'estudio', 2, 1, true, 320_000, 6, 16, 6, ['#4a044e', '#f0abfc'], 'Zumba, forró e ritmos.'),
  r('yoga', 'Yoga', '🧘', 'estudio', 2, 2, true, 450_000, 4, 14, 8, ['#3f2d20', '#fcd34d'], 'Respiração e alongamento.', 1),
  r('pilates', 'Pilates', '🤾', 'estudio', 2, 3, true, 700_000, 2, 12, 6, ['#164e63', '#a5f3fc'], 'Aparelhos para postura e força.', 2),
  r('natacao', 'Natação', '🏊', 'agua', 3, 0, true, 3_800_000, 6, 20, 6, ['#0369a1', '#e0f2fe'], 'Piscina semiolímpica aquecida.'),
  r('fisio', 'Fisioterapia', '🩺', 'macas', 3, 1, false, 6_000_000, 2, 16, 8, ['#f1f5f9', '#38bdf8'], 'Recuperação de lesões.'),
  r('nutri', 'Nutricionista', '🥗', 'mesas', 3, 2, false, 8_000_000, 2, 12, 6, ['#365314', '#bef264'], 'Dieta e avaliação física.'),
  r('sauna', 'Sauna e Spa', '♨️', 'agua', 3, 3, false, 12_000_000, 3, 18, 6, ['#7c2d12', '#fed7aa'], 'Vapor, massagem e relaxamento.', 1),
  r('vip', 'Personal VIP', '👑', 'pesos', 4, 0, true, 70_000_000, 2, 10, 10, ['#1c1917', '#facc15'], 'Aparelhos de ouro e treino exclusivo.', 1),
  r('areia', 'Quadra de Areia', '🏐', 'funcional', 4, 1, true, 110_000_000, 6, 14, 4, ['#d6b370', '#fef3c7'], 'Vôlei e beach tennis no terraço.', 1),
  r('crio', 'Recuperação Premium', '🧊', 'macas', 4, 2, false, 160_000_000, 2, 20, 8, ['#0c4a6e', '#bae6fd'], 'Banheira de gelo e massagem.', 1),
  r('lounge', 'Lounge', '🛋️', 'mesas', 4, 3, false, 240_000_000, 4, 16, 8, ['#27272a', '#d4d4d8'], 'Sofás, café e vista da cidade.', 2),
];
export const ROOM = Object.fromEntries(ROOMS.map((x) => [x.id, x])) as Record<string, RoomDef>;

export interface GuestDef { id: GuestId; name: string; icon: string; spend: number; likes: string[]; stars: number; color: string; text: string }
export const GUESTS: GuestDef[] = [
  { id: 'iniciante', name: 'Iniciante', icon: '🙋', spend: 1, likes: ['musculacao', 'esteiras', 'vestiario', 'lanchonete'], stars: 0, color: '#60a5fa', text: 'Começou agora e paga o plano básico.' },
  { id: 'aposentada', name: 'Aposentada', icon: '👵', spend: 1.3, likes: ['esteiras', 'pilates', 'natacao', 'fisio'], stars: 0, color: '#c084fc', text: 'Cuida da saúde todo dia cedo.' },
  { id: 'executivo', name: 'Executivo', icon: '💼', spend: 2.6, likes: ['spinning', 'sauna', 'vip', 'lounge'], stars: 1, color: '#334155', text: 'Treina antes do trabalho e paga caro.' },
  { id: 'corredora', name: 'Corredora', icon: '🏃‍♀️', spend: 1.8, likes: ['esteiras', 'funcional', 'nutri', 'suplementos'], stars: 1, color: '#f97316', text: 'Treina para maratona.' },
  { id: 'lutador', name: 'Lutador', icon: '🥋', spend: 2.2, likes: ['ringue', 'musculacao', 'fisio'], stars: 2, color: '#ef4444', text: 'Vive no ringue e no saco de pancada.' },
  { id: 'dancarina', name: 'Dançarina', icon: '💃', spend: 2.4, likes: ['danca', 'yoga', 'lanchonete'], stars: 2, color: '#e879f9', text: 'Não perde uma aula de ritmos.' },
  { id: 'influencer', name: 'Influenciadora fitness', icon: '📱', spend: 4, likes: ['areia', 'crio', 'suplementos', 'danca'], stars: 3, color: '#facc15', text: 'Posta o treino e traz seguidores.' },
  { id: 'fisiculturista', name: 'Fisiculturista', icon: '💪', spend: 7, likes: ['vip', 'musculacao', 'nutri', 'suplementos'], stars: 4, color: '#a16207', text: 'Treina pesado e compra de tudo.' },
];
export const GUEST = Object.fromEntries(GUESTS.map((g) => [g.id, g])) as Record<GuestId, GuestDef>;

export const STAFF: { id: StaffId; name: string; icon: string; text: string; base: number }[] = [
  { id: 'professor', name: 'Professores', icon: '🧑‍🏫', text: '+6% de lucro nas salas de treino por nível', base: 400 },
  { id: 'atendente', name: 'Atendentes', icon: '🧑‍💼', text: '+6% de lucro nos serviços por nível', base: 500 },
  { id: 'personal', name: 'Personal trainers', icon: '📋', text: '+3% de satisfação por nível', base: 700 },
  { id: 'limpeza', name: 'Limpeza', icon: '🧹', text: '+3% de satisfação por nível', base: 600 },
];
export const STAFF_MAX = 25;

/** Academias rivais da cidade: passar cada uma dá medalhas; passar todas libera a próxima unidade da rede */
export const RIVALS = [
  { name: 'Academia Bairro Forte', icon: '🏚️', fame: 6 },
  { name: 'Corpo em Forma', icon: '🤸', fame: 60 },
  { name: 'Força Total', icon: '🦾', fame: 500 },
  { name: 'Studio Equilíbrio', icon: '🧘', fame: 4_000 },
  { name: 'Mega Fit Nordeste', icon: '🌵', fame: 30_000 },
  { name: 'Titã Academias', icon: '🏆', fame: 200_000 },
];
export const CITIES = ['Fortaleza', 'Caucaia', 'Maracanaú', 'Sobral', 'Juazeiro do Norte', 'Crato', 'Iguatu', 'Quixadá'];
export const cityName = (i: number) => CITIES[i % CITIES.length] + (i >= CITIES.length ? ` ${Math.floor(i / CITIES.length) + 1}` : '');
/** Cada unidade nova multiplica todo o lucro */
export const cityMult = (i: number) => Math.pow(3, i);
/** Parte do lucro de uma unidade que continua entrando depois que você abre a próxima */
export const FRANCHISE = 0.25;

export const STARS = [0, 30, 90, 200, 380];
export const OFFLINE_MAX = 4 * 3600;
export const CASH_SECONDS = 90;

export type EventId = 'verao' | 'promo' | 'famoso' | 'campeonato' | 'aulao';
export const EVENTS: Record<EventId, { icon: string; name: string; text: string; time: number }> = {
  verao: { icon: '☀️', name: 'Projeto Verão', text: 'Dobro de alunos chegando', time: 60 },
  promo: { icon: '🏷️', name: 'Promoção de matrícula', text: 'Musculação rende 3x', time: 60 },
  famoso: { icon: '🤩', name: 'Visita famosa', text: 'Toque para receber o patrocínio', time: 25 },
  campeonato: { icon: '🏆', name: 'Campeonato', text: 'Uma sala rende 2x e dá medalhas', time: 90 },
  aulao: { icon: '🎉', name: 'Aulão aberto', text: 'Alunos mais felizes', time: 60 },
};

export const SHOP = [
  { id: 'dobro', icon: '⚡', name: 'Lucro em dobro', text: '10 minutos com tudo rendendo 2x', gems: 8 },
  { id: 'verao', icon: '☀️', name: 'Projeto Verão', text: 'Dobra a chegada de alunos por 1 minuto', gems: 5 },
  { id: 'cofre', icon: '💰', name: 'Cofre de 2 horas', text: 'Recebe 2 horas de lucro na hora', gems: 20 },
  { id: 'aulao', icon: '🎉', name: 'Aulão agora', text: 'Alunos mais felizes por 1 minuto', gems: 4 },
] as const;
