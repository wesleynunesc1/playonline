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

export interface GameSaveData {
  version: number;
  playerCountryId: CountryId;
  money: number;
  militaryPower: number;
  countries: Record<CountryId, CountryRuntimeState>;
  conqueredCount: number;
  totalPlayTimeSeconds: number;
  lastSaveTimestamp: number;
}

export interface OfflineProgressInfo {
  secondsOffline: number;
  moneyEarned: number;
  formattedDuration: string;
}
