import { CountryRuntimeState, BattleResult, TechNode } from '../types/game';

/**
 * Constantes de balanceamento econômico e militar
 */
export const BALANCE = {
  // Economia
  ECONOMY_BASE_UPGRADE_COST: 350,
  ECONOMY_COST_EXPONENT: 1.65,
  ECONOMY_INCOME_GROWTH_PER_LEVEL: 0.5,

  // Militar
  RECRUIT_BATCH_SIZE: 10,
  RECRUIT_BASE_COST: 250,
  RECRUIT_COST_EXPONENT: 1.05,

  // Combate
  MIN_RANDOM_FACTOR: 0.85,
  MAX_RANDOM_FACTOR: 1.15,
  CASUALTY_VICTORY_MIN: 0.10,
  CASUALTY_VICTORY_MAX: 0.22,
  CASUALTY_DEFEAT_MIN: 0.35,
  CASUALTY_DEFEAT_MAX: 0.55,
};

/**
 * Calcula o custo do próximo nível econômico considerando bônus de tecnologias
 */
export function calculateEconomyUpgradeCost(
  baseIncome: number,
  currentLevel: number,
  upgradeDiscount = 0
): number {
  const dynamicBaseCost = Math.max(BALANCE.ECONOMY_BASE_UPGRADE_COST, baseIncome * 18);
  const rawCost = dynamicBaseCost * Math.pow(BALANCE.ECONOMY_COST_EXPONENT, currentLevel - 1);
  const discounted = rawCost * Math.max(0.3, 1 - upgradeDiscount);
  return Math.round(discounted);
}

/**
 * Calcula a renda gerada pelo território em um determinado nível econômico
 */
export function calculateIncomeForLevel(baseIncome: number, level: number): number {
  return Math.round(baseIncome * (1 + (level - 1) * BALANCE.ECONOMY_INCOME_GROWTH_PER_LEVEL));
}

/**
 * Calcula o custo para recrutar tropas considerando bônus de tecnologias
 */
export function calculateRecruitCost(
  currentMilitaryPower: number,
  batchCount = 1,
  recruitDiscount = 0
): number {
  const tier = Math.floor(currentMilitaryPower / 100);
  const unitCost = BALANCE.RECRUIT_BASE_COST * Math.pow(BALANCE.RECRUIT_COST_EXPONENT, tier);
  const total = unitCost * batchCount;
  const discounted = total * Math.max(0.3, 1 - recruitDiscount);
  return Math.round(discounted);
}

/**
 * Gera um número aleatório entre min e max inclusivo
 */
export function getRandomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Retorna a defesa efetiva do país considerando status de sabotagem
 */
export function getEffectiveDefense(country: CountryRuntimeState): number {
  if (country.sabotagedTurns && country.sabotagedTurns > 0) {
    return Math.max(20, Math.round(country.defense * 0.75));
  }
  return country.defense;
}

/**
 * Calcula a chance teórica de vitória (%) contra um país defensor
 */
export function calculateWinChance(
  playerMilitary: number,
  enemyDefense: number,
  attackBonus = 0,
  flatWinChanceBonus = 0
): number {
  if (playerMilitary <= 0) return 0;
  if (enemyDefense <= 0) return 100;

  const effectivePlayerMil = playerMilitary * (1 + attackBonus);

  let wins = 0;
  const iterations = 500;

  for (let i = 0; i < iterations; i++) {
    const playerRoll = effectivePlayerMil * getRandomRange(BALANCE.MIN_RANDOM_FACTOR, BALANCE.MAX_RANDOM_FACTOR);
    const enemyRoll = enemyDefense * getRandomRange(BALANCE.MIN_RANDOM_FACTOR, BALANCE.MAX_RANDOM_FACTOR);
    if (playerRoll > enemyRoll) {
      wins++;
    }
  }

  let percentage = Math.round((wins / iterations) * 100) + flatWinChanceBonus;
  percentage = Math.max(2, Math.min(99, percentage));

  return percentage;
}

/**
 * Executa a batalha entre o jogador e um território alvo
 */
export function resolveBattle(
  playerMilitary: number,
  targetCountry: CountryRuntimeState,
  unlockedTechs: TechNode[] = []
): BattleResult {
  let attackMultiplier = 1;
  let casualtyReduction = 0;

  unlockedTechs.forEach((t) => {
    if (t.effects.attackPowerBonus) attackMultiplier += t.effects.attackPowerBonus;
    if (t.effects.casualtyReduction) casualtyReduction += t.effects.casualtyReduction;
  });

  const effectiveDefense = getEffectiveDefense(targetCountry);
  const effectivePlayerAttack = playerMilitary * attackMultiplier;

  const playerRoll = Math.round(effectivePlayerAttack * getRandomRange(BALANCE.MIN_RANDOM_FACTOR, BALANCE.MAX_RANDOM_FACTOR));
  const enemyRoll = Math.round(effectiveDefense * getRandomRange(BALANCE.MIN_RANDOM_FACTOR, BALANCE.MAX_RANDOM_FACTOR));

  const won = playerRoll > enemyRoll;

  let casualtyRate: number;
  if (won) {
    casualtyRate = getRandomRange(BALANCE.CASUALTY_VICTORY_MIN, BALANCE.CASUALTY_VICTORY_MAX);
  } else {
    casualtyRate = getRandomRange(BALANCE.CASUALTY_DEFEAT_MIN, BALANCE.CASUALTY_DEFEAT_MAX);
  }

  // Aplica redução de baixas das tecnologias
  casualtyRate = casualtyRate * Math.max(0.3, 1 - casualtyReduction);

  const playerCasualties = Math.min(playerMilitary, Math.max(3, Math.round(playerMilitary * casualtyRate)));

  return {
    won,
    targetCountryId: targetCountry.id,
    playerCasualties,
    enemyDefenseInitial: effectiveDefense,
    playerAttackRoll: playerRoll,
    enemyDefenseRoll: enemyRoll,
    territoryConquered: won,
    incomeGained: won ? targetCountry.income : 0,
  };
}
