import { BattleResult, CountryId, CountryRuntimeState } from '../types/game';
import { TECHNOLOGIES } from '../data/technologies';

/**
 * Todas as constantes de balanceamento do jogo. Não use números mágicos fora daqui.
 */
export const BALANCE = {
  STARTING_MONEY: 1000,

  // Economia
  ECONOMY_BASE_UPGRADE_COST: 350,
  ECONOMY_COST_PER_INCOME: 18,
  ECONOMY_COST_EXPONENT: 1.65,
  ECONOMY_INCOME_GROWTH_PER_LEVEL: 0.5,

  // Militar
  RECRUIT_BATCH_SIZE: 10,
  RECRUIT_BASE_COST: 250,
  RECRUIT_COST_EXPONENT: 1.05,
  RECRUIT_TIER_SIZE: 100,
  MIN_ATTACK_POWER: 10,
  MIN_DISCOUNT_FACTOR: 0.3,

  // Combate
  MIN_RANDOM_FACTOR: 0.85,
  MAX_RANDOM_FACTOR: 1.15,
  MIN_WIN_CHANCE: 0.02,
  MAX_WIN_CHANCE: 0.98,
  CASUALTY_VICTORY_MIN: 0.1,
  CASUALTY_VICTORY_MAX: 0.22,
  CASUALTY_DEFEAT_MIN: 0.35,
  CASUALTY_DEFEAT_MAX: 0.55,
  MIN_CASUALTIES: 3,

  // Espionagem
  SABOTAGE_COST: 800,
  SABOTAGE_DURATION_S: 90,
  SABOTAGE_DEFENSE_FACTOR: 0.75,
  SABOTAGE_BASE_SUCCESS: 0.75,
  SABOTAGE_MAX_SUCCESS: 0.95,

  // Rivais (pressão de jogo)
  REARM_INTERVAL_S: 60,
  REARM_FACTOR: 1.025,
  /** Cada conquista do jogador faz os rivais se mobilizarem */
  MOBILIZATION_FACTOR: 1.1,
  THREAT_MIN_INTERVAL_S: 100,
  THREAT_MAX_INTERVAL_S: 160,
  THREAT_WARNING_S: 20,
  ENEMY_OFFENSE_FACTOR: 0.6,
  DEFENSE_CASUALTY_WIN: 0.1,
  DEFENSE_CASUALTY_LOSS: 0.22,

  // Ritmo
  EVENT_FIRST_S: 40,
  EVENT_INTERVAL_S: 65,
  NEWS_INTERVAL_S: 15,
  AUTOSAVE_INTERVAL_S: 15,
  OFFLINE_MIN_S: 10,
  BACKGROUND_GAP_S: 5,
  STRIKE_DURATION_MS: 1100,
};

export interface Modifiers {
  incomeMultiplier: number;
  upgradeDiscount: number;
  recruitDiscount: number;
  attackBonus: number;
  casualtyReduction: number;
  defenseBonus: number;
  winChanceBonus: number;
  spyBonus: number;
}

/** Soma os efeitos de todas as tecnologias desbloqueadas (fonte única dos bônus) */
export function getModifiers(unlockedTechIds: string[]): Modifiers {
  const m: Modifiers = {
    incomeMultiplier: 1,
    upgradeDiscount: 0,
    recruitDiscount: 0,
    attackBonus: 0,
    casualtyReduction: 0,
    defenseBonus: 0,
    winChanceBonus: 0,
    spyBonus: 0,
  };
  for (const t of TECHNOLOGIES) {
    if (!unlockedTechIds.includes(t.id)) continue;
    const e = t.effects;
    m.incomeMultiplier += e.incomeMultiplier ?? 0;
    m.upgradeDiscount += e.upgradeCostDiscount ?? 0;
    m.recruitDiscount += e.recruitCostDiscount ?? 0;
    m.attackBonus += e.attackPowerBonus ?? 0;
    m.casualtyReduction += e.casualtyReduction ?? 0;
    m.defenseBonus += e.defenseBonus ?? 0;
    m.winChanceBonus += e.winChanceBonus ?? 0;
    m.spyBonus += e.spySuccessBonus ?? 0;
  }
  return m;
}

const discountFactor = (discount: number) => Math.max(BALANCE.MIN_DISCOUNT_FACTOR, 1 - discount);

export function computeIncome(
  countries: Record<CountryId, CountryRuntimeState>,
  mods: Modifiers,
  bonusIncome: number
): number {
  let sum = 0;
  for (const c of Object.values(countries)) if (c.owner === 'player') sum += c.income;
  return Math.round(sum * mods.incomeMultiplier) + bonusIncome;
}

export function calculateEconomyUpgradeCost(baseIncome: number, currentLevel: number, upgradeDiscount = 0): number {
  const base = Math.max(BALANCE.ECONOMY_BASE_UPGRADE_COST, baseIncome * BALANCE.ECONOMY_COST_PER_INCOME);
  const raw = base * Math.pow(BALANCE.ECONOMY_COST_EXPONENT, currentLevel - 1);
  return Math.round(raw * discountFactor(upgradeDiscount));
}

export function calculateIncomeForLevel(baseIncome: number, level: number): number {
  return Math.round(baseIncome * (1 + (level - 1) * BALANCE.ECONOMY_INCOME_GROWTH_PER_LEVEL));
}

export function calculateRecruitCost(currentMilitaryPower: number, batchCount = 1, recruitDiscount = 0): number {
  const tier = Math.floor(currentMilitaryPower / BALANCE.RECRUIT_TIER_SIZE);
  const unitCost = BALANCE.RECRUIT_BASE_COST * Math.pow(BALANCE.RECRUIT_COST_EXPONENT, tier);
  return Math.round(unitCost * batchCount * discountFactor(recruitDiscount));
}

export function getRandomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function getEffectiveDefense(country: CountryRuntimeState): number {
  if (country.sabotageSeconds > 0) {
    return Math.max(20, Math.round(country.defense * BALANCE.SABOTAGE_DEFENSE_FACTOR));
  }
  return country.defense;
}

/**
 * Probabilidade (0..1) de `attack × U(0.85,1.15)` superar `defense × U(0.85,1.15)`.
 * Integração numérica determinística: o valor exibido é exatamente o usado na batalha.
 */
export function winProbability(attack: number, defense: number, flatBonusPoints = 0): number {
  if (attack <= 0) return 0;
  if (defense <= 0) return 1;
  const N = 40;
  const min = BALANCE.MIN_RANDOM_FACTOR;
  const span = BALANCE.MAX_RANDOM_FACTOR - min;
  let wins = 0;
  for (let i = 0; i < N; i++) {
    const a = attack * (min + (span * (i + 0.5)) / N);
    for (let j = 0; j < N; j++) {
      if (a > defense * (min + (span * (j + 0.5)) / N)) wins++;
    }
  }
  const p = wins / (N * N) + flatBonusPoints / 100;
  return Math.min(BALANCE.MAX_WIN_CHANCE, Math.max(BALANCE.MIN_WIN_CHANCE, p));
}

/** Chance de vitória em % para exibição */
export function calculateWinChance(attack: number, defense: number, flatBonusPoints = 0): number {
  return Math.round(winProbability(attack, defense, flatBonusPoints) * 100);
}

export function getAttackStrength(militaryPower: number, mods: Modifiers): number {
  return Math.round(militaryPower * (1 + mods.attackBonus));
}

/** Ofensiva do jogador contra um país independente */
export function resolveBattle(playerMilitary: number, target: CountryRuntimeState, mods: Modifiers): BattleResult {
  const playerStrength = getAttackStrength(playerMilitary, mods);
  const enemyStrength = getEffectiveDefense(target);
  const p = winProbability(playerStrength, enemyStrength, mods.winChanceBonus);
  const won = Math.random() < p;

  const rate = won
    ? getRandomRange(BALANCE.CASUALTY_VICTORY_MIN, BALANCE.CASUALTY_VICTORY_MAX)
    : getRandomRange(BALANCE.CASUALTY_DEFEAT_MIN, BALANCE.CASUALTY_DEFEAT_MAX);
  const adjusted = rate * discountFactor(mods.casualtyReduction);

  return {
    won,
    defensive: false,
    targetCountryId: target.id,
    playerCasualties: Math.min(playerMilitary, Math.max(BALANCE.MIN_CASUALTIES, Math.round(playerMilitary * adjusted))),
    playerStrength,
    enemyStrength,
    winChance: Math.round(p * 100),
    incomeGained: won ? target.income : 0,
  };
}

/** Força defensiva do jogador e ofensiva do rival numa invasão inimiga */
export function getDefenseMatchup(playerMilitary: number, attacker: CountryRuntimeState, mods: Modifiers) {
  const playerStrength = Math.round(playerMilitary * (1 + mods.defenseBonus));
  const enemyStrength = Math.round(getEffectiveDefense(attacker) * BALANCE.ENEMY_OFFENSE_FACTOR);
  return { playerStrength, enemyStrength, winChance: calculateWinChance(playerStrength, enemyStrength) };
}

/** Invasão de um rival contra um território do jogador */
export function resolveDefense(
  playerMilitary: number,
  attacker: CountryRuntimeState,
  target: CountryRuntimeState,
  mods: Modifiers
): BattleResult {
  const { playerStrength, enemyStrength } = getDefenseMatchup(playerMilitary, attacker, mods);
  const p = winProbability(playerStrength, enemyStrength);
  const won = Math.random() < p;
  const rate = (won ? BALANCE.DEFENSE_CASUALTY_WIN : BALANCE.DEFENSE_CASUALTY_LOSS) * discountFactor(mods.casualtyReduction);

  return {
    won,
    defensive: true,
    targetCountryId: target.id,
    attackerId: attacker.id,
    playerCasualties: Math.min(playerMilitary, Math.max(BALANCE.MIN_CASUALTIES, Math.round(playerMilitary * rate))),
    playerStrength,
    enemyStrength,
    winChance: Math.round(p * 100),
    incomeGained: won ? 0 : -target.income,
  };
}
