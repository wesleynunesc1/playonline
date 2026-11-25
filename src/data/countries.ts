import { CountryBaseData, CountryId } from '../types/game';

type Def = Omit<CountryBaseData, 'id'>;

/**
 * Definições imutáveis dos países jogáveis.
 * `numericId` liga cada país ao seu polígono real no mapa (ISO 3166 numérico).
 * Para adicionar um país: inclua o ID em CountryId e uma entrada aqui.
 */
const DEFS: Record<CountryId, Def> = {
  // ===== América do Sul =====
  BRA: { name: 'Brasil', iso: 'BR', numericId: '076', flag: '🇧🇷', baseIncome: 28, initialMilitary: 120, baseDefense: 110, population: '215M', region: 'América do Sul', anchor: [-51, -10], description: 'Gigante continental com agricultura potente e a maior biodiversidade do planeta.' },
  ARG: { name: 'Argentina', iso: 'AR', numericId: '032', flag: '🇦🇷', baseIncome: 19, initialMilitary: 85, baseDefense: 80, population: '46M', region: 'América do Sul', anchor: [-65, -35], description: 'Planícies pampeanas férteis e grande tradição agropecuária.' },
  CHL: { name: 'Chile', iso: 'CL', numericId: '152', flag: '🇨🇱', baseIncome: 20, initialMilitary: 80, baseDefense: 85, population: '19M', region: 'América do Sul', anchor: [-71, -28], description: 'Faixa costeira do Pacífico, líder mundial em cobre.' },
  COL: { name: 'Colômbia', iso: 'CO', numericId: '170', flag: '🇨🇴', baseIncome: 18, initialMilitary: 85, baseDefense: 80, population: '52M', region: 'América do Sul', anchor: [-73.5, 4], description: 'Porta dos Andes, conectando dois oceanos.' },
  PER: { name: 'Peru', iso: 'PE', numericId: '604', flag: '🇵🇪', baseIncome: 16, initialMilitary: 75, baseDefense: 75, population: '34M', region: 'América do Sul', anchor: [-75, -9.5], description: 'Nação andina com imenso patrimônio mineral.' },
  VEN: { name: 'Venezuela', iso: 'VE', numericId: '862', flag: '🇻🇪', baseIncome: 17, initialMilitary: 80, baseDefense: 75, population: '28M', region: 'América do Sul', anchor: [-66, 7], description: 'Detentora das maiores reservas de petróleo comprovadas do mundo.' },
  BOL: { name: 'Bolívia', iso: 'BO', numericId: '068', flag: '🇧🇴', baseIncome: 12, initialMilitary: 60, baseDefense: 60, population: '12M', region: 'América do Sul', anchor: [-64.5, -17], description: 'Coração do triângulo do lítio, recurso vital do século XXI.' },
  URY: { name: 'Uruguai', iso: 'UY', numericId: '858', flag: '🇺🇾', baseIncome: 14, initialMilitary: 55, baseDefense: 58, population: '3.4M', region: 'América do Sul', anchor: [-56, -32.8], description: 'Pequena nação estável com forte setor de serviços e portos.' },

  // ===== América do Norte e Caribe =====
  MEX: { name: 'México', iso: 'MX', numericId: '484', flag: '🇲🇽', baseIncome: 22, initialMilitary: 95, baseDefense: 90, population: '128M', region: 'América do Norte', anchor: [-102, 23.5], description: 'Ponte estratégica entre as Américas com vibrante indústria.' },
  USA: { name: 'Estados Unidos', iso: 'US', numericId: '840', flag: '🇺🇸', baseIncome: 50, initialMilitary: 200, baseDefense: 190, population: '335M', region: 'América do Norte', anchor: [-98, 39], description: 'Potência global com economia sólida e alta capacidade industrial.' },
  CAN: { name: 'Canadá', iso: 'CA', numericId: '124', flag: '🇨🇦', baseIncome: 35, initialMilitary: 120, baseDefense: 130, population: '38M', region: 'América do Norte', anchor: [-106, 57], description: 'Vasta nação rica em recursos naturais e fronteira polar.' },
  CUB: { name: 'Cuba', iso: 'CU', numericId: '192', flag: '🇨🇺', baseIncome: 12, initialMilitary: 70, baseDefense: 72, population: '11M', region: 'Caribe', anchor: [-79, 21.7], description: 'Ilha estratégica que controla as rotas do Caribe.' },

  // ===== Europa =====
  GBR: { name: 'Reino Unido', iso: 'GB', numericId: '826', flag: '🇬🇧', baseIncome: 45, initialMilitary: 160, baseDefense: 160, population: '67M', region: 'Europa', anchor: [-2, 53.5], description: 'Centro financeiro global com marinha de longo alcance.' },
  FRA: { name: 'França', iso: 'FR', numericId: '250', flag: '🇫🇷', baseIncome: 46, initialMilitary: 160, baseDefense: 165, population: '68M', region: 'Europa', anchor: [2.5, 46.5], description: 'Potência nuclear e diplomática no coração da Europa.' },
  DEU: { name: 'Alemanha', iso: 'DE', numericId: '276', flag: '🇩🇪', baseIncome: 50, initialMilitary: 150, baseDefense: 160, population: '84M', region: 'Europa', anchor: [10.4, 51], description: 'Motor industrial da Europa e líder em engenharia de precisão.' },
  RUS: { name: 'Rússia', iso: 'RU', numericId: '643', flag: '🇷🇺', baseIncome: 48, initialMilitary: 210, baseDefense: 205, population: '144M', region: 'Eurásia', anchor: [95, 62], description: 'Maior território do planeta, com vastas reservas de gás e petróleo.' },

  // ===== África =====
  EGY: { name: 'Egito', iso: 'EG', numericId: '818', flag: '🇪🇬', baseIncome: 20, initialMilitary: 110, baseDefense: 100, population: '105M', region: 'África', anchor: [30, 26.5], description: 'Guardião do Canal de Suez, artéria do comércio mundial.' },
  NGA: { name: 'Nigéria', iso: 'NG', numericId: '566', flag: '🇳🇬', baseIncome: 22, initialMilitary: 90, baseDefense: 85, population: '220M', region: 'África', anchor: [8, 9.5], description: 'Nação mais populosa da África e potência petrolífera.' },
  ZAF: { name: 'África do Sul', iso: 'ZA', numericId: '710', flag: '🇿🇦', baseIncome: 24, initialMilitary: 95, baseDefense: 92, population: '60M', region: 'África', anchor: [24, -29], description: 'Economia mais diversificada do continente, rica em ouro e platina.' },

  // ===== Ásia e Oceania =====
  CHN: { name: 'China', iso: 'CN', numericId: '156', flag: '🇨🇳', baseIncome: 55, initialMilitary: 220, baseDefense: 200, population: '1.4B', region: 'Ásia', anchor: [103, 35], description: 'Fábrica do mundo com imenso contingente militar e tecnológico.' },
  JPN: { name: 'Japão', iso: 'JP', numericId: '392', flag: '🇯🇵', baseIncome: 45, initialMilitary: 140, baseDefense: 150, population: '125M', region: 'Ásia', anchor: [138.5, 36.5], description: 'Arquipélago de alta tecnologia e forte economia industrial.' },
  KOR: { name: 'Coreia do Sul', iso: 'KR', numericId: '410', flag: '🇰🇷', baseIncome: 40, initialMilitary: 150, baseDefense: 145, population: '52M', region: 'Ásia', anchor: [128, 36.3], description: 'Potência em semicondutores com forças armadas modernas.' },
  IND: { name: 'Índia', iso: 'IN', numericId: '356', flag: '🇮🇳', baseIncome: 46, initialMilitary: 190, baseDefense: 180, population: '1.4B', region: 'Ásia', anchor: [79, 22], description: 'Democracia mais populosa do mundo e polo tecnológico emergente.' },
  AUS: { name: 'Austrália', iso: 'AU', numericId: '036', flag: '🇦🇺', baseIncome: 38, initialMilitary: 120, baseDefense: 125, population: '26M', region: 'Oceania', anchor: [134, -25], description: 'Continente-nação rico em minérios e posição estratégica no Pacífico.' },
};

export const COUNTRIES_DATA = Object.fromEntries(
  Object.entries(DEFS).map(([id, def]) => [id, { id, ...def }])
) as Record<CountryId, CountryBaseData>;

export const INITIAL_COUNTRY_IDS = Object.keys(DEFS) as CountryId[];

export const TOTAL_COUNTRIES = INITIAL_COUNTRY_IDS.length;

/** Mapa ISO numérico → ID do jogo, usado pelo mapa vetorial */
export const NUMERIC_TO_COUNTRY: Record<string, CountryId> = Object.fromEntries(
  INITIAL_COUNTRY_IDS.map((id) => [DEFS[id].numericId, id])
);

/** Dificuldade estimada ao escolher a nação (nações pobres = começo mais difícil) */
export function getDifficulty(id: CountryId): { label: string; color: string } {
  const income = DEFS[id].baseIncome;
  if (income < 18) return { label: 'Difícil', color: 'text-rose-300 bg-rose-500/10 border-rose-500/30' };
  if (income < 35) return { label: 'Média', color: 'text-amber-300 bg-amber-500/10 border-amber-500/30' };
  return { label: 'Fácil', color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' };
}
