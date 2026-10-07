import {
  calculateEconomyUpgradeCost,
  calculateIncomeForLevel,
  calculateRecruitCost,
  calculateWinChance,
  resolveBattle,
  BALANCE,
} from '../src/utils/formulas.ts';

import { formatMoney, formatNumber, formatDuration } from '../src/utils/formatters.ts';
import { COUNTRIES_DATA, INITIAL_COUNTRY_IDS } from '../src/data/countries.ts';

console.log('=== TESTE DE JOGABILIDADE E REGRAS DE NEGÓCIO - WORLD EMPIRE ===\n');

// 1. Verificação da Base de Países
console.log('[1/8] Verificando base de 10 países...');
if (INITIAL_COUNTRY_IDS.length !== 10) {
  throw new Error(`Esperado 10 países, recebido ${INITIAL_COUNTRY_IDS.length}`);
}
for (const id of INITIAL_COUNTRY_IDS) {
  const c = COUNTRIES_DATA[id];
  if (!c || !c.name || !c.flag || !c.baseIncome || !c.initialMilitary || !c.baseDefense || !c.svg.path) {
    throw new Error(`País ${id} com dados incompletos!`);
  }
}
console.log('✔ Todos os 10 países possuem ID, nome, bandeira, renda, militar, defesa e dados SVG válidos.\n');

// 2. Teste de Economia e Fórmulas de Upgrade
console.log('[2/8] Testando progressão econômica...');
const baseIncome = COUNTRIES_DATA.BRA.baseIncome; // 28
const costLvl1 = calculateEconomyUpgradeCost(baseIncome, 1);
const costLvl2 = calculateEconomyUpgradeCost(baseIncome, 2);
const costLvl3 = calculateEconomyUpgradeCost(baseIncome, 3);

if (costLvl2 <= costLvl1 || costLvl3 <= costLvl2) {
  throw new Error('Custo de upgrade não está escalando adequadamente!');
}

const incomeLvl1 = calculateIncomeForLevel(baseIncome, 1);
const incomeLvl2 = calculateIncomeForLevel(baseIncome, 2);
const incomeLvl3 = calculateIncomeForLevel(baseIncome, 3);

if (incomeLvl1 !== 28 || incomeLvl2 <= incomeLvl1 || incomeLvl3 <= incomeLvl2) {
  throw new Error('Renda por nível não está aumentando progressivamente!');
}
console.log(`✔ Nv 1: +$${incomeLvl1}/s (Custo prox: $${costLvl1})`);
console.log(`✔ Nv 2: +$${incomeLvl2}/s (Custo prox: $${costLvl2})`);
console.log(`✔ Nv 3: +$${incomeLvl3}/s (Custo prox: $${costLvl3})\n`);

// 3. Teste de Recrutamento Militar
console.log('[3/8] Testando recrutamento de tropas...');
const recruitCost0 = calculateRecruitCost(100, 1);
const recruitCost1000 = calculateRecruitCost(1000, 1);
if (recruitCost1000 < recruitCost0) {
  throw new Error('Custo de recrutamento deve escalar ou manter valor base coerente');
}
console.log(`✔ Recrutar +${BALANCE.RECRUIT_BATCH_SIZE} tropas custa $${recruitCost0} inicialmente.\n`);

// 4. Teste de Chances de Vitória
console.log('[4/8] Testando cálculo de chances de vitória...');
const chanceSuperior = calculateWinChance(250, 80);
const chanceEquilibrada = calculateWinChance(100, 100);
const chanceDesfavoravel = calculateWinChance(40, 150);

if (chanceSuperior <= chanceEquilibrada || chanceEquilibrada <= chanceDesfavoravel) {
  throw new Error('Chances de vitória calculadas estão incoerentes!');
}
console.log(`✔ Exército 250 vs Defesa 80: ${chanceSuperior}% de vitória`);
console.log(`✔ Exército 100 vs Defesa 100: ${chanceEquilibrada}% de vitória`);
console.log(`✔ Exército 40 vs Defesa 150: ${chanceDesfavoravel}% de vitória\n`);

// 5. Teste de Batalha e Conquista
console.log('[5/8] Testando resolução de batalha (Brasil atacando Argentina)...');
const argentina = {
  id: 'ARG',
  name: 'Argentina',
  iso: 'AR',
  flag: '🇦🇷',
  income: 19,
  militaryPower: 85,
  defense: 80,
  economyLevel: 1,
  owner: null,
};

let victories = 0;
let defeats = 0;
for (let i = 0; i < 20; i++) {
  const result = resolveBattle(150, argentina);
  if (result.won) victories++;
  else defeats++;
  if (result.playerCasualties <= 0 || result.playerCasualties > 150) {
    throw new Error('Baixas de combate inválidas!');
  }
}
console.log(`✔ Em 20 combates simulados: ${victories} vitórias e ${defeats} derrotas. Baixas e dados aleatórios funcionando.\n`);

// 6. Teste de Formatadores
console.log('[6/8] Testando formatadores visuais...');
if (formatMoney(1250) !== '$ 1.250') throw new Error(`formatMoney falhou: ${formatMoney(1250)}`);
if (formatMoney(1500000) !== '$ 1.50M') throw new Error(`formatMoney falhou: ${formatMoney(1500000)}`);
if (formatNumber(320) !== '320') throw new Error(`formatNumber falhou: ${formatNumber(320)}`);
if (formatDuration(8040) !== '2h 14min') throw new Error(`formatDuration falhou: ${formatDuration(8040)}`);
console.log('✔ Formatadores formatMoney, formatNumber e formatDuration validados com sucesso.\n');

// 7. Simulação Completa do Fluxo do Jogador
console.log('[7/8] Simulando fluxo completo de ponta a ponta...');
let money = 1000;
let military = 120; // Brasil
let incomeTotal = 28;

// Passo 1: Recebe 5 segundos de renda
money += incomeTotal * 5;
console.log(`- Após 5 segundos: Dinheiro = $${money}`);

// Passo 2: Compra upgrade econômico
const upCost = calculateEconomyUpgradeCost(28, 1);
if (money >= upCost) {
  money -= upCost;
  incomeTotal = calculateIncomeForLevel(28, 2);
  console.log(`- Melhorou economia para Nv. 2: Custo pago = $${upCost}, Nova Renda = +$${incomeTotal}/s, Saldo = $${money}`);
}

// Passo 3: Recruta tropas
const recCost = calculateRecruitCost(military, 1);
if (money >= recCost) {
  money -= recCost;
  military += BALANCE.RECRUIT_BATCH_SIZE;
  console.log(`- Recrutou tropas: Custo pago = $${recCost}, Nova Força Militar = ⚔ ${military}, Saldo = $${money}`);
}

// Passo 4: Conquista Argentina
const battle = resolveBattle(military, argentina);
if (battle.won) {
  military -= battle.playerCasualties;
  incomeTotal += argentina.income;
  console.log(`- Venceu invasão da Argentina! Baixas = ${battle.playerCasualties}, Nova Renda Total = +$${incomeTotal}/s, Força Militar = ⚔ ${military}`);
} else {
  military -= battle.playerCasualties;
  console.log(`- Invasão repelida! Baixas = ${battle.playerCasualties}, Força Militar = ⚔ ${military}`);
}

console.log('\n[8/8] TODAS AS VALIDAÇÕES DE JOGABILIDADE PASSARAM COM 100% DE SUCESSO!\n');
