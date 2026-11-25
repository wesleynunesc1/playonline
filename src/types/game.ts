export type CountryId =
  | 'BRA' | 'ARG' | 'CHL' | 'COL' | 'PER' | 'VEN' | 'BOL' | 'URY'
  | 'MEX' | 'USA' | 'CAN' | 'CUB'
  | 'GBR' | 'FRA' | 'DEU' | 'RUS'
  | 'EGY' | 'NGA' | 'ZAF'
  | 'CHN' | 'JPN' | 'KOR' | 'IND' | 'AUS';

export interface CountryBaseData {
  id: CountryId;
  name: string;
  iso: string;
  /** Código ISO 3166 numérico, usado para ligar o país ao mapa vetorial real (world-atlas) */
  numericId: string;
  flag: string;
  baseIncome: number;
  initialMilitary: number;
  baseDefense: number;
  population: string;
  region: string;
  description: string;
  /** [longitude, latitude] do ponto de referência (rótulo e origem de ataques) */
  anchor: [number, number];
}

export interface CountryRuntimeState {
  id: CountryId;
  income: number;
  defense: number;
  economyLevel: number;
  owner: 'player' | null;
  /** Segundos restantes de sabotagem ativa */
  sabotageSeconds: number;
}

export type ScreenType = 'home' | 'country_select' | 'game' | 'snake';

export interface BattleResult {
  won: boolean;
  /** true quando o jogador foi o defensor */
  defensive: boolean;
  targetCountryId: CountryId;
  attackerId?: CountryId;
  playerCasualties: number;
  playerStrength: number;
  enemyStrength: number;
  winChance: number;
  incomeGained: number;
}

export interface Strike {
  fromId: CountryId;
  toId: CountryId;
  hostile: boolean;
  key: number;
}

export interface Threat {
  attackerId: CountryId;
  targetId: CountryId;
  secondsLeft: number;
}

export type TechBranch = 'economy' | 'military' | 'intelligence';

export interface TechEffects {
  incomeMultiplier?: number;
  upgradeCostDiscount?: number;
  recruitCostDiscount?: number;
  attackPowerBonus?: number;
  casualtyReduction?: number;
  defenseBonus?: number;
  winChanceBonus?: number;
  spySuccessBonus?: number;
}

export interface TechNode {
  id: string;
  branch: TechBranch;
  name: string;
  description: string;
  icon: string;
  cost: number;
  requiredTechId?: string;
  unlocked: boolean;
  effects: TechEffects;
}

export interface EventChoice {
  id: string;
  label: string;
  description: string;
  costMoney?: number;
  costMilitary?: number;
  rewardMoney?: number;
  rewardMilitary?: number;
  rewardIncomeBonus?: number;
  soundEffect?: 'buy' | 'recruit' | 'victory' | 'sabotage';
}

export interface GeopoliticalEvent {
  id: string;
  title: string;
  subtitle: string;
  category: 'crise' | 'oportunidade' | 'militar' | 'diplomacia';
  description: string;
  choices: [EventChoice, EventChoice];
}

export interface AchievementProgress {
  money: number;
  militaryPower: number;
  conqueredCount: number;
  incomePerSecond: number;
  unlockedTechsCount: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  rewardMoney: number;
  rewardMilitary: number;
  isCompleted: (state: AchievementProgress) => boolean;
}

export interface NewsItem {
  id: string;
  text: string;
  timestamp: string;
  category: 'breaking' | 'intel' | 'market' | 'war';
}

export type GameSpeed = 1 | 2 | 5;

export interface GameSaveData {
  version: number;
  playerCountryId: CountryId;
  money: number;
  militaryPower: number;
  countries: Partial<Record<CountryId, Partial<CountryRuntimeState>>>;
  conqueredCount: number;
  totalPlayTimeSeconds: number;
  lastSaveTimestamp: number;
  unlockedTechIds: string[];
  unlockedAchievementIds: string[];
  gameSpeed: GameSpeed;
  bonusIncomePerSecond: number;
  victoryShown: boolean;
}

export interface OfflineProgressInfo {
  secondsOffline: number;
  moneyEarned: number;
  formattedDuration: string;
}
