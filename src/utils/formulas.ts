import { CountryRuntimeState, BattleResult } from '../types/game';

/**
 * Constantes de balanceamento econômico e militar
 */
export const BALANCE = {
  // Economia
  ECONOMY_BASE_UPGRADE_COST: 350,
  ECONOMY_COST_EXPONENT: 1.65,
  ECONOMY_INCOME_GROWTH_PER_LEVEL: 0.5, // Cada nível soma +50% da renda base

  // Militar
  RECRUIT_BATCH_SIZE: 10,
  RECRUIT_BASE_COST: 250,
  RECRUIT_COST_EXPONENT: 1.05, // Ligeiro aumento conforme o exército cresce para evitar snowball infinito

  // Combate
  MIN_RANDOM_FACTOR: 0.85,
  MAX_RANDOM_FACTOR: 1.15,
  CASUALTY_VICTORY_MIN: 0.12, // 12% a 25% de perdas na vitória
  CASUALTY_VICTORY_MAX: 0.25,
  CASUALTY_DEFEAT_MIN: 0.35,  // 35% a 55% de perdas na derrota
  CASUALTY_DEFEAT_MAX: 0.55,
};

/**
 * Calcula o custo do próximo nível econômico de um território
 * Fórmula: custoBase * 1.65^(nivel - 1)
 */
export function calculateEconomyUpgradeCost(baseIncome: number, currentLevel: number): number {
  const dynamicBaseCost = Math.max(BALANCE.ECONOMY_BASE_UPGRADE_COST, baseIncome * 18);
  return Math.round(dynamicBaseCost * Math.pow(BALANCE.ECONOMY_COST_EXPONENT, currentLevel - 1));
}

/**
 * Calcula a renda gerada pelo território em um determinado nível econômico
 */
export function calculateIncomeForLevel(baseIncome: number, level: number): number {
  // Nível 1 = baseIncome
  // Nível 2 = baseIncome + 50%
  // Nível 3 = baseIncome + 100% etc.
  return Math.round(baseIncome * (1 + (level - 1) * BALANCE.ECONOMY_INCOME_GROWTH_PER_LEVEL));
}

/**
 * Calcula o custo para recrutar tropas
 * Permite compra do lote básico de +10 tropas
 */
export function calculateRecruitCost(currentMilitaryPower: number, batchCount: number = 1): number {
  // Escala levemente com o poder militar atual
  const tier = Math.floor(currentMilitaryPower / 100);
  const unitCost = BALANCE.RECRUIT_BASE_COST * Math.pow(BALANCE.RECRUIT_COST_EXPONENT, tier);
  return Math.round(unitCost * batchCount);
}

/**
 * Gera um número aleatório entre min e max inclusivo
 */
export function getRandomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Calcula a chance teórica de vitória (%) contra um país defensor
 * Usa simulação de Monte Carlo leve para obter porcentagem realista
 */
export function calculateWinChance(playerMilitary: number, enemyDefense: number): number {
  if (playerMilitary <= 0) return 0;
  if (enemyDefense <= 0) return 100;

  let wins = 0;
  const iterations = 500;

  for (let i = 0; i < iterations; i++) {
    const playerRoll = playerMilitary * getRandomRange(BALANCE.MIN_RANDOM_FACTOR, BALANCE.MAX_RANDOM_FACTOR);
    const enemyRoll = enemyDefense * getRandomRange(BALANCE.MIN_RANDOM_FACTOR, BALANCE.MAX_RANDOM_FACTOR);
    if (playerRoll > enemyRoll) {
      wins++;
    }
  }

  const percentage = Math.round((wins / iterations) * 100);
  // Limita entre 1% e 99% a menos que a disparidade seja absurda
  if (percentage === 0 && playerMilitary > 0) return 2;
  if (percentage === 100 && enemyDefense > playerMilitary * 0.5) return 98;
  return percentage;
}

/**
 * Executa a batalha entre o jogador e um território alvo
 */
export function resolveBattle(
  playerMilitary: number,
  targetCountry: CountryRuntimeState
): BattleResult {
  const playerRoll = Math.round(playerMilitary * getRandomRange(BALANCE.MIN_RANDOM_FACTOR, BALANCE.MAX_RANDOM_FACTOR));
  const enemyRoll = Math.round(targetCountry.defense * getRandomRange(BALANCE.MIN_RANDOM_FACTOR, BALANCE.MAX_RANDOM_FACTOR));

  const won = playerRoll > enemyRoll;

  let casualtyRate: number;
  if (won) {
    // Vitória: baixa perda militar
    casualtyRate = getRandomRange(BALANCE.CASUALTY_VICTORY_MIN, BALANCE.CASUALTY_VICTORY_MAX);
  } else {
    // Derrota: alta perda militar
    casualtyRate = getRandomRange(BALANCE.CASUALTY_DEFEAT_MIN, BALANCE.CASUALTY_DEFEAT_MAX);
  }

  const playerCasualties = Math.min(playerMilitary, Math.max(5, Math.round(playerMilitary * casualtyRate)));

  return {
    won,
    targetCountryId: targetCountry.id,
    playerCasualties,
    enemyDefenseInitial: targetCountry.defense,
    playerAttackRoll: playerRoll,
    enemyDefenseRoll: enemyRoll,
    territoryConquered: won,
    incomeGained: won ? targetCountry.income : 0,
  };
}
