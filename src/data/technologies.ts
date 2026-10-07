import { TechNode } from '../types/game';

export const TECHNOLOGIES: TechNode[] = [
  // ================= RAMO ECONÔMICO =================
  {
    id: 'eco_automation',
    branch: 'economy',
    name: 'Automação Industrial',
    description: 'Moderniza linhas de montagem e inteligência logística. +15% de renda em todo o império.',
    icon: 'Factory',
    cost: 1200,
    unlocked: false,
    effects: {
      incomeMultiplier: 0.15,
    },
  },
  {
    id: 'eco_free_trade',
    branch: 'economy',
    name: 'Zonas de Livre Comércio',
    description: 'Incentivos fiscais interterritoriais. Reduz em 20% o custo de todos os upgrades econômicos.',
    icon: 'TrendingUp',
    cost: 3500,
    requiredTechId: 'eco_automation',
    unlocked: false,
    effects: {
      upgradeCostDiscount: 0.20,
    },
  },
  {
    id: 'eco_energy_grid',
    branch: 'economy',
    name: 'Matriz Energética Soberana',
    description: 'Independência energética e redes de alta eficiência. +25% de renda nacional contínua.',
    icon: 'Zap',
    cost: 8500,
    requiredTechId: 'eco_free_trade',
    unlocked: false,
    effects: {
      incomeMultiplier: 0.25,
    },
  },

  // ================= RAMO MILITAR =================
  {
    id: 'mil_logistics',
    branch: 'military',
    name: 'Logística de Mobilização Rápida',
    description: 'Cadeia de suprimentos militar otimizada. Reduz o custo de recrutamento de tropas em 20%.',
    icon: 'Truck',
    cost: 1500,
    unlocked: false,
    effects: {
      recruitCostDiscount: 0.20,
    },
  },
  {
    id: 'mil_blitz',
    branch: 'military',
    name: 'Doutrina de Guerra Relâmpago',
    description: 'Manobras de choque combinadas. +20% de poder militar ofensivo e 30% menos baixas em combate.',
    icon: 'Swords',
    cost: 4000,
    requiredTechId: 'mil_logistics',
    unlocked: false,
    effects: {
      attackPowerBonus: 0.20,
      casualtyReduction: 0.30,
    },
  },
  {
    id: 'mil_air_defense',
    branch: 'military',
    name: 'Escudo Aeroespacial & Defesa de Ferro',
    description: 'Supremacia tática nos céus. Garante +12% de chance de vitória em qualquer invasão e reforça defesas.',
    icon: 'Shield',
    cost: 9000,
    requiredTechId: 'mil_blitz',
    unlocked: false,
    effects: {
      winChanceBonus: 12,
      defenseBonus: 0.25,
    },
  },

  // ================= RAMO DE INTELIGÊNCIA =================
  {
    id: 'int_surveillance',
    branch: 'intelligence',
    name: 'Constelação de Satélites Militares',
    description: 'Vigilância orbital 24/7. Mapeia fraquezas inimigas, concedendo +8% de chance de vitória.',
    icon: 'Radar',
    cost: 1100,
    unlocked: false,
    effects: {
      winChanceBonus: 8,
    },
  },
  {
    id: 'int_black_ops',
    branch: 'intelligence',
    name: 'Divisão de Operações Secretas',
    description: 'Ciberguerra e agentes de campo. Desbloqueia operações de sabotagem em nações rivais.',
    icon: 'Eye',
    cost: 3800,
    requiredTechId: 'int_surveillance',
    unlocked: false,
    effects: {
      spySuccessBonus: 0.25,
    },
  },
  {
    id: 'int_hegemony',
    branch: 'intelligence',
    name: 'Doutrina de Hegemonia Global',
    description: 'Prestígio diplomático e dominação geopolítica total. +20% de renda e tributação de fronteiras.',
    icon: 'Crown',
    cost: 10000,
    requiredTechId: 'int_black_ops',
    unlocked: false,
    effects: {
      incomeMultiplier: 0.20,
      winChanceBonus: 10,
    },
  },
];
