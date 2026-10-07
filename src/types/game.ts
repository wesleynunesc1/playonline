export type CountryId =
  | 'BRA'
  | 'ARG'
  | 'CHL'
  | 'COL'
  | 'PER'
  | 'MEX'
  | 'USA'
  | 'CAN'
  | 'CHN'
  | 'JPN';

export interface CountrySvgData {
  path: string;
  center: [number, number]; // [x, y] para rótulo ou pino
  namePosition?: [number, number];
}

export interface CountryBaseData {
  id: CountryId;
  name: string;
  iso: string;
  flag: string;
  baseIncome: number;
  initialMilitary: number;
  baseDefense: number;
  population: string;
  region: string;
  description: string;
  svg: CountrySvgData;
}

export interface CountryRuntimeState {
  id: CountryId;
  name: string;
  iso: string;
  flag: string;
  income: number;           // Renda atual gerada por este país/segundo
  militaryPower: number;    // Guarnição/Poder do país se independente
  defense: number;          // Defesa para cálculo de batalha
  economyLevel: number;     // Nível econômico atual
  owner: 'player' | null;   // null = independente/neutro, 'player' = controlado pelo jogador
  sabotagedTurns?: number;  // Quantas rodadas este país está com defesas sabotadas por espionagem
}

export type ScreenType = 'home' | 'country_select' | 'game';

export interface BattleResult {
  won: boolean;
  targetCountryId: CountryId;
  playerCasualties: number;
  enemyDefenseInitial: number;
  playerAttackRoll: number;
  enemyDefenseRoll: number;
  territoryConquered: boolean;
  incomeGained: number;
}

export type TechBranch = 'economy' | 'military' | 'intelligence';

export interface TechNode {
  id: string;
  branch: TechBranch;
  name: string;
  description: string;
  icon: string;
  cost: number;
  requiredTechId?: string;
  unlocked: boolean;
  effects: {
    incomeMultiplier?: number;      // Multiplicador percentual de renda (ex: +0.15)
    upgradeCostDiscount?: number;   // Desconto no custo de upgrade econômico (ex: 0.20)
    recruitCostDiscount?: number;   // Desconto no custo de recrutamento (ex: 0.20)
    attackPowerBonus?: number;      // Bônus percentual no ataque militar (ex: 0.20)
    casualtyReduction?: number;     // Redução percentual de baixas (ex: 0.25)
    defenseBonus?: number;          // Aumento percentual de defesa (ex: 0.20)
    winChanceBonus?: number;        // Bônus plano na chance de vitória (ex: 10%)
    spySuccessBonus?: number;       // Bônus no sucesso de operações de espionagem
  };
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
  defensePenaltyTargetId?: CountryId;
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

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  rewardMoney: number;
  rewardMilitary: number;
  isCompleted: (state: {
    money: number;
    militaryPower: number;
    conqueredCount: number;
    incomePerSecond: number;
    unlockedTechsCount: number;
  }) => boolean;
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
  countries: Record<CountryId, CountryRuntimeState>;
  conqueredCount: number;
  totalPlayTimeSeconds: number;
  lastSaveTimestamp: number;
  unlockedTechIds: string[];
  unlockedAchievementIds: string[];
  gameSpeed: GameSpeed;
}

export interface OfflineProgressInfo {
  secondsOffline: number;
  moneyEarned: number;
  formattedDuration: string;
}
