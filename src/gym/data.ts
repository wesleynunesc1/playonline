/** Catálogo do Magnata Fitness em reais (R$). Preços, salários e aluguéis inspirados em academias do Ceará. */
export type Kind = 'lobby' | 'pesos' | 'livre' | 'cardio' | 'spinning' | 'vestiario' | 'bar' | 'loja' | 'funcional' | 'ringue' | 'estudio' | 'agua' | 'mesas' | 'macas';
export type GuestId = 'iniciante' | 'aposentada' | 'executivo' | 'corredora' | 'lutador' | 'dancarina' | 'influencer' | 'fisiculturista';
export type StaffId = 'professor' | 'atendente' | 'personal' | 'limpeza';

/**
 * Tipo de espaço (zona) que você monta num salão alugado. Zonas de treino (train) dão capacidade: cada aparelho atende `per` alunos.
 * Serviços (lanchonete, loja, nutri...) vendem `sale` reais por aluno no mês, limitados a `per` alunos por posto.
 */
export interface ZoneDef {
  id: string; name: string; icon: string; kind: Kind; train: boolean; build: number; unit: number; unitName: string;
  max: number; per: number; sale: number; power: number; carpet: [string, string]; style?: number; text: string;
}

/** O galpão: 5 colunas x 4 fileiras de salões de 10 x 8 m. A fileira da frente dá para a rua */
export const PLOT_W = 10;
export const PLOT_D = 8;
export interface PlotDef { x: number; z: number; cost: number; rent: number }
export const PLOTS: PlotDef[] = [];
for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) {
  // Salões do fundo e das pontas são mais baratos (menos visíveis da rua)
  const front = row === 3 ? 1.25 : 1;
  PLOTS.push({ x: (col - 2) * PLOT_W, z: (row - 1.5) * PLOT_D, cost: Math.round(28_000 * front), rent: Math.round(1_800 * front) });
}
/** Recepção na frente, no meio; quem começa tem recepção, musculação e vestiário (academia de bairro) */
export const RECEP_PLOT = 17;
export const START: [number, string, number][] = [[17, 'recepcao', 1], [16, 'musculacao', 8], [18, 'vestiario', 2]];
export const neighbors = (i: number) => {
  const c = i % 5, r = Math.floor(i / 5);
  return [c > 0 ? i - 1 : -1, c < 4 ? i + 1 : -1, r > 0 ? i - 5 : -1, r < 3 ? i + 5 : -1].filter((x) => x >= 0);
};

const z = (id: string, name: string, icon: string, kind: Kind, train: boolean, build: number, unit: number, unitName: string, max: number, per: number, sale: number, power: number, carpet: [string, string], text: string, style = 0): ZoneDef =>
  ({ id, name, icon, kind, train, build, unit, unitName, max, per, sale, power, carpet, text, style });

/** build: montagem da zona (piso, espelho, som) · unit: preço de cada aparelho ou posto · power: luz por aparelho no mês */
export const ZONES: ZoneDef[] = [
  z('recepcao', 'Recepção', '🛎️', 'lobby', false, 0, 0, '', 1, 0, 0, 0, ['#334155', '#22d3ee'], 'Balcão, catracas e fachada. Melhorar traz mais gente que passa na rua.'),
  z('musculacao', 'Máquinas de Musculação', '🏋️', 'pesos', true, 12_000, 7_500, 'máquina', 12, 30, 0, 15, ['#18181b', '#facc15'], 'Leg press, extensora, puxador, crossover e mais.'),
  z('pesolivre', 'Peso Livre', '🦍', 'livre', true, 10_000, 5_000, 'estação', 10, 32, 0, 5, ['#1c1917', '#ef4444'], 'Racks, smith, supinos e halteres.'),
  z('cardio', 'Cardio', '🏃', 'cardio', true, 10_000, 14_000, 'aparelho', 12, 25, 0, 120, ['#0f172a', '#22d3ee'], 'Esteiras, elípticos, bicicletas e remo.'),
  z('vestiario', 'Vestiário', '🚿', 'vestiario', false, 15_000, 4_500, 'box de banho', 8, 120, 0, 60, ['#e2e8f0', '#64748b'], 'Sem banho, aluno reclama. Cada box atende 120 alunos.'),
  z('spinning', 'Spinning', '🚴', 'spinning', true, 25_000, 5_500, 'bicicleta', 16, 20, 0, 20, ['#1e1b4b', '#fb923c'], 'Aulas com luz e música alta.'),
  z('funcional', 'Funcional', '🤸', 'funcional', true, 15_000, 3_500, 'kit', 8, 25, 0, 5, ['#3f3f46', '#facc15'], 'Gaiola, caixotes, cordas e kettlebells.'),
  z('ringue', 'Lutas', '🥊', 'ringue', true, 45_000, 1_500, 'saco de pancada', 8, 30, 0, 0, ['#450a0a', '#ef4444'], 'Ringue, tatame e sacos de pancada.'),
  z('danca', 'Estúdio de Dança', '💃', 'estudio', true, 30_000, 900, 'vaga de aula', 8, 35, 0, 10, ['#4a044e', '#f0abfc'], 'Zumba, forró e ritmos.'),
  z('yoga', 'Yoga e Alongamento', '🧘', 'estudio', true, 12_000, 400, 'tapete', 12, 15, 0, 0, ['#3f2d20', '#fcd34d'], 'Respiração e alongamento.', 1),
  z('pilates', 'Pilates', '🤾', 'estudio', true, 20_000, 9_000, 'aparelho', 6, 15, 0, 0, ['#164e63', '#a5f3fc'], 'Aparelhos para postura e força.', 2),
  z('natacao', 'Piscina', '🏊', 'agua', true, 380_000, 15_000, 'raia', 4, 70, 0, 900, ['#0369a1', '#e0f2fe'], 'Piscina aquecida: cara de manter, muito procurada.'),
  z('lanchonete', 'Lanchonete Fit', '🥤', 'bar', false, 35_000, 2_500, 'banco no balcão', 8, 150, 28, 40, ['#14532d', '#86efac'], 'Açaí e vitaminas: uns R$ 28 por aluno no mês.'),
  z('suplementos', 'Loja de Suplementos', '🛍️', 'loja', false, 30_000, 6_000, 'estante', 6, 200, 22, 10, ['#1e3a8a', '#93c5fd'], 'Whey e roupas: uns R$ 22 por aluno no mês.'),
  z('fisio', 'Fisioterapia', '🩺', 'macas', false, 40_000, 7_000, 'maca', 8, 60, 18, 30, ['#f1f5f9', '#38bdf8'], 'Atende lesões: uns R$ 18 por aluno no mês.'),
  z('nutri', 'Nutricionista', '🥗', 'mesas', false, 25_000, 5_000, 'consultório', 6, 150, 15, 15, ['#365314', '#bef264'], 'Avaliação e dieta: uns R$ 15 por aluno no mês.'),
  z('sauna', 'Sauna e Spa', '♨️', 'agua', false, 90_000, 8_000, 'maca de massagem', 6, 200, 12, 250, ['#7c2d12', '#fed7aa'], 'Relaxamento: uns R$ 12 por aluno no mês e alunos mais felizes.', 1),
  z('crio', 'Recuperação', '🧊', 'macas', false, 80_000, 18_000, 'banheira de gelo', 6, 120, 14, 120, ['#0c4a6e', '#bae6fd'], 'Banheira de gelo e massagem: uns R$ 14 por aluno no mês.', 1),
];
export const ZONE = Object.fromEntries(ZONES.map((x) => [x.id, x])) as Record<string, ZoneDef>;

/** plan: quanto paga em relação à mensalidade básica. Só se matricula quem acha ao menos uma sala de que gosta */
export interface GuestDef { id: GuestId; name: string; icon: string; plan: number; likes: string[]; color: string; text: string }
export const GUESTS: GuestDef[] = [
  { id: 'iniciante', name: 'Iniciante', icon: '🙋', plan: 1, likes: ['musculacao', 'cardio'], color: '#60a5fa', text: 'Paga o plano básico.' },
  { id: 'aposentada', name: 'Aposentada', icon: '👵', plan: 0.85, likes: ['cardio', 'pilates', 'natacao', 'yoga'], color: '#c084fc', text: 'Tem desconto de melhor idade.' },
  { id: 'corredora', name: 'Corredora', icon: '🏃‍♀️', plan: 1.2, likes: ['cardio', 'funcional', 'spinning'], color: '#f97316', text: 'Treina para maratona.' },
  { id: 'executivo', name: 'Executivo', icon: '💼', plan: 1.8, likes: ['spinning', 'sauna', 'natacao', 'crio'], color: '#334155', text: 'Paga plano completo.' },
  { id: 'lutador', name: 'Lutador', icon: '🥋', plan: 1.3, likes: ['ringue', 'funcional'], color: '#ef4444', text: 'Paga a mais pelas aulas de luta.' },
  { id: 'dancarina', name: 'Dançarina', icon: '💃', plan: 1.2, likes: ['danca', 'yoga'], color: '#e879f9', text: 'Não perde uma aula de ritmos.' },
  { id: 'influencer', name: 'Influenciadora fitness', icon: '📱', plan: 1.5, likes: ['pesolivre', 'crio', 'danca', 'pilates'], color: '#facc15', text: 'Posta o treino e traz amigos.' },
  { id: 'fisiculturista', name: 'Fisiculturista', icon: '💪', plan: 1.6, likes: ['pesolivre', 'musculacao'], color: '#a16207', text: 'Treina pesado todo dia.' },
];
export const GUEST = Object.fromEntries(GUESTS.map((g) => [g.id, g])) as Record<GuestId, GuestDef>;

/** salary: salário com encargos por mês · ratio: quantos alunos (ou aparelhos, na limpeza) cada um dá conta */
export const STAFF: { id: StaffId; name: string; icon: string; text: string; salary: number; ratio: number }[] = [
  { id: 'professor', name: 'Professores', icon: '🧑‍🏫', text: '1 para cada 120 alunos. Faltando, o treino fica ruim.', salary: 2_800, ratio: 120 },
  { id: 'atendente', name: 'Recepcionistas', icon: '🧑‍💼', text: '1 para cada 300 alunos. Faltando, a fila da catraca irrita.', salary: 2_000, ratio: 300 },
  { id: 'limpeza', name: 'Limpeza', icon: '🧹', text: '1 para cada 35 aparelhos. Faltando, a academia fica suja.', salary: 1_800, ratio: 35 },
  { id: 'personal', name: 'Personal trainers', icon: '📋', text: 'Cada um vende uns R$ 5.500 de aulas por mês para quem paga plano caro.', salary: 3_500, ratio: 0 },
];

/** Academias rivais em Fortaleza (alunos). Nas outras cidades o tamanho segue a população */
export const RIVALS = [
  { name: 'Academia Bairro Forte', icon: '🏚️', members: 250 },
  { name: 'Corpo em Forma', icon: '🤸', members: 600 },
  { name: 'Força Total', icon: '🦾', members: 1_100 },
  { name: 'Studio Equilíbrio', icon: '🧘', members: 1_700 },
  { name: 'Mega Fit Nordeste', icon: '🌵', members: 2_400 },
  { name: 'Titã Academias', icon: '🏆', members: 3_200 },
];
/** População (IBGE 2022, arredondada), aluguel em relação a Fortaleza e custo para abrir a unidade (reforma do térreo) */
export const CITIES: { name: string; pop: number; rent: number; open: number }[] = [
  { name: 'Fortaleza', pop: 2_430_000, rent: 1, open: 0 },
  { name: 'Caucaia', pop: 355_000, rent: 0.7, open: 250_000 },
  { name: 'Juazeiro do Norte', pop: 287_000, rent: 0.65, open: 250_000 },
  { name: 'Maracanaú', pop: 234_000, rent: 0.65, open: 230_000 },
  { name: 'Sobral', pop: 204_000, rent: 0.6, open: 220_000 },
  { name: 'Crato', pop: 131_000, rent: 0.55, open: 200_000 },
  { name: 'Iguatu', pop: 98_000, rent: 0.5, open: 180_000 },
  { name: 'Quixadá', pop: 85_000, rent: 0.5, open: 180_000 },
];
/** Rival na cidade: cresce com a população, mas nunca fica minúsculo */
export const rivalMembers = (i: number, city: number) => Math.round(RIVALS[i].members * Math.max(0.12, Math.sqrt(CITIES[city].pop / CITIES[0].pop)));

/** Tempo: 1 dia do jogo dura DAY segundos de verdade */
export const DAY = 6;
export const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
/** Procura por academia em cada mês (janeiro é o mês das promessas de ano novo) */
export const SEASON = [1.6, 1.3, 1.1, 1, 0.95, 0.8, 0.8, 0.9, 1, 1.05, 1.2, 1.35];
export const OFFLINE_DAYS = 30;
export const TAX = 0.06;
export const LOAN_RATE = 0.018;
export const OVERDRAFT_RATE = 0.08;

export type EventId = 'influencer' | 'campeonato' | 'fiscal' | 'quebra' | 'aulao';
export const EVENTS: Record<EventId, { icon: string; name: string; text: string; days: number }> = {
  influencer: { icon: '📱', name: 'Influenciadora postou', text: 'Muita gente procurando a academia', days: 7 },
  campeonato: { icon: '🥊', name: 'Campeonato de luta', text: 'Patrocinador pagou para usar o ringue', days: 5 },
  fiscal: { icon: '🧾', name: 'Vigilância Sanitária', text: 'Fiscalização da limpeza', days: 1 },
  quebra: { icon: '🔧', name: 'Aparelho quebrou', text: 'Conserto pago da manutenção', days: 1 },
  aulao: { icon: '🎉', name: 'Aulão aberto no fim de semana', text: 'Alunos mais felizes', days: 3 },
};
export const BUDGETS = [0, 800, 2_500, 6_000, 15_000, 40_000];
