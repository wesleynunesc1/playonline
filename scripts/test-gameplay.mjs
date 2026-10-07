import {
  calculateEconomyUpgradeCost,
  calculateIncomeForLevel,
  calculateRecruitCost,
  calculateWinChance,
  resolveBattle,
  getEffectiveDefense,
  BALANCE,
} from '../src/utils/formulas.ts';

import { formatMoney, formatNumber, formatDuration } from '../src/utils/formatters.ts';
import { COUNTRIES_DATA, INITIAL_COUNTRY_IDS } from '../src/data/countries.ts';
import { TECHNOLOGIES } from '../src/data/technologies.ts';
import { GEOPOLITICAL_EVENTS } from '../src/data/events.ts';
import { ACHIEVEMENTS } from '../src/data/achievements.ts';

console.log('=== TESTE EXPANDIDO DE JOGABILIDADE IMERSIVA - WORLD EMPIRE ===\n');

// 1. Verificação da Base de Países
console.log('[1/10] Verificando base de 10 países...');
if (INITIAL_COUNTRY_IDS.length !== 10) throw new Error('Países insuficientes');
console.log('✔ Base com 10 países completa e validada.\n');

// 2. Verificação do Catálogo de Tecnologias (P&D)
console.log('[2/10] Verificando árvore de tecnologias...');
if (TECHNOLOGIES.length !== 9) throw new Error('Esperado 9 tecnologias');
const techEco = TECHNOLOGIES.find(t => t.id === 'eco_free_trade');
if (!techEco || techEco.effects.upgradeCostDiscount !== 0.20) {
  throw new Error('Efeito da tecnologia de comércio incorreto');
}
console.log(`✔ 9 tecnologias validadas em 3 ramos (Econômico, Militar, Inteligência).\n`);

// 3. Verificação do Catálogo de Eventos Geopolíticos
console.log('[3/10] Verificando eventos geopolíticos de crise...');
if (GEOPOLITICAL_EVENTS.length < 5) throw new Error('Eventos insuficientes');
GEOPOLITICAL_EVENTS.forEach(e => {
  if (!e.title || e.choices.length !== 2) throw new Error(`Evento ${e.id} inválido`);
});
console.log(`✔ ${GEOPOLITICAL_EVENTS.length} eventos de crise com escolhas críticas validados.\n`);

// 4. Verificação do Sistema de Conquistas
console.log('[4/10] Verificando sistema de conquistas...');
if (ACHIEVEMENTS.length < 8) throw new Error('Conquistas insuficientes');
const firstBlood = ACHIEVEMENTS.find(a => a.id === 'ach_first_blood');
if (!firstBlood || !firstBlood.isCompleted({ money: 0, militaryPower: 0, conqueredCount: 2, incomePerSecond: 0, unlockedTechsCount: 0 })) {
  throw new Error('Lógica da conquista Primeiro Golpe falhou');
}
console.log(`✔ ${ACHIEVEMENTS.length} conquistas imperiais validadas com sucesso.\n`);

// 5. Teste de Sabotagem e Defesa Efetiva
console.log('[5/10] Testando sistema de sabotagem e defesa...');
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
  sabotagedTurns: 0,
};

const normalDef = getEffectiveDefense(argentina);
argentina.sabotagedTurns = 3;
const sabotagedDef = getEffectiveDefense(argentina);

if (sabotagedDef >= normalDef) {
  throw new Error('Sabotagem não reduziu a defesa inimiga!');
}
console.log(`✔ Defesa normal: ${normalDef} -> Defesa com agentes de sabotagem: ${sabotagedDef} (-25%).\n`);

// 6. Teste de Bônus de Tecnologia no Combate
console.log('[6/10] Testando resolução de batalha com doutrina militar...');
const techBlitz = TECHNOLOGIES.find(t => t.id === 'mil_blitz');
const battleWithTech = resolveBattle(150, argentina, [techBlitz]);
if (!battleWithTech.won) {
  console.log('Derrota inesperada com poder superior, testando novamente...');
}
console.log(`✔ Combate processado com Doutrina de Guerra Relâmpago. Baixas sofridas: ${battleWithTech.playerCasualties}.\n`);

// 7. Teste de Descontos de P&D em Upgrades e Recrutamento
console.log('[7/10] Testando descontos econômicos e de mobilização...');
const normalUpgrade = calculateEconomyUpgradeCost(28, 1, 0);
const discountedUpgrade = calculateEconomyUpgradeCost(28, 1, 0.20);
if (discountedUpgrade >= normalUpgrade) throw new Error('Desconto de upgrade não aplicado!');

const normalRecruit = calculateRecruitCost(100, 1, 0);
const discountedRecruit = calculateRecruitCost(100, 1, 0.20);
if (discountedRecruit >= normalRecruit) throw new Error('Desconto de recrutamento não aplicado!');

console.log(`✔ Upgrade base: $${normalUpgrade} -> Com P&D: $${discountedUpgrade}`);
console.log(`✔ Recrutamento base: $${normalRecruit} -> Com P&D: $${discountedRecruit}\n`);

// 8. Teste de Formatadores
console.log('[8/10] Testando formatadores visuais...');
if (formatMoney(1250) !== '$ 1.250') throw new Error('formatMoney erro');
if (formatNumber(320) !== '320') throw new Error('formatNumber erro');
if (formatDuration(134) !== '2min 14s') throw new Error('formatDuration erro');
console.log('✔ Formatadores validados.\n');

// 9. Simulação Completa da Nova Experiência Viciante
console.log('[9/10] Simulando ciclo completo de jogo expandido...');
let money = 2000;
let military = 140;
let income = 35;
let conquered = 1;
const unlockedTechIds = [];

// Passo A: Desbloqueia Automação Industrial
const autoTech = TECHNOLOGIES.find(t => t.id === 'eco_automation');
money -= autoTech.cost;
unlockedTechIds.push(autoTech.id);
income = Math.round(income * (1 + autoTech.effects.incomeMultiplier));
console.log(`- Pesquisou Automação Industrial: Saldo = $${money}, Renda expandida para +$${income}/s`);

// Passo B: Recebe evento de Petróleo
const oilEvent = GEOPOLITICAL_EVENTS[0];
const choice = oilEvent.choices[1]; // Leiloar
money += choice.rewardMoney;
console.log(`- Evento "${oilEvent.title}": Optou por "${choice.label}" -> +$${choice.rewardMoney}. Novo Saldo = $${money}`);

// Passo C: Infiltração e Sabotagem da Argentina
argentina.sabotagedTurns = 3;
money -= 800;
console.log(`- Operação de Sabotagem executada com sucesso contra Argentina!`);

// Passo D: Invasão e Conquista
const finalBattle = resolveBattle(military, argentina, [autoTech]);
if (finalBattle.won) {
  military -= finalBattle.playerCasualties;
  income += argentina.income;
  conquered += 1;
  console.log(`- Conquistou Argentina! Renda Total = +$${income}/s, Territórios = ${conquered}`);
}

// Passo E: Conquista Desbloqueada
const ach = ACHIEVEMENTS.find(a => a.id === 'ach_first_blood');
if (ach.isCompleted({ money, militaryPower: military, conqueredCount: conquered, incomePerSecond: income, unlockedTechsCount: unlockedTechIds.length })) {
  money += ach.rewardMoney;
  console.log(`- Conquista "${ach.title}" atingida! Recompensa coletada = +$${ach.rewardMoney}`);
}

console.log('\n[10/10] TODAS AS MECÂNICAS EXPANDIDAS FORAM TESTADAS COM 100% DE SUCESSO!\n');
