import { TOTAL_COUNTRIES } from './countries';

interface Progress {
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
  rewardMoney: number;
  rewardMilitary: number;
  isCompleted: (p: Progress) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ach_first_blood',
    title: 'Primeiro Golpe Imperial',
    description: 'Conquiste seu primeiro território estrangeiro.',
    rewardMoney: 1000,
    rewardMilitary: 20,
    isCompleted: ({ conqueredCount }) => conqueredCount >= 2,
  },
  {
    id: 'ach_rich_nation',
    title: 'Tubarão Financeiro',
    description: 'Alcance uma renda imperial de +$100/s ou mais.',
    rewardMoney: 2500,
    rewardMilitary: 30,
    isCompleted: ({ incomePerSecond }) => incomePerSecond >= 100,
  },
  {
    id: 'ach_army_strong',
    title: 'Exército de Ferro',
    description: 'Mobilize uma força militar combinada superior a 250 tropas.',
    rewardMoney: 1500,
    rewardMilitary: 50,
    isCompleted: ({ militaryPower }) => militaryPower >= 250,
  },
  {
    id: 'ach_tech_pioneer',
    title: 'Vanguarda Tecnológica',
    description: 'Pesquise e ative pelo menos 3 tecnologias de ponta em P&D.',
    rewardMoney: 3000,
    rewardMilitary: 40,
    isCompleted: ({ unlockedTechsCount }) => unlockedTechsCount >= 3,
  },
  {
    id: 'ach_superpower',
    title: 'Superpotência Continental',
    description: 'Tenha 5 territórios sob o comando da sua bandeira.',
    rewardMoney: 5000,
    rewardMilitary: 80,
    isCompleted: ({ conqueredCount }) => conqueredCount >= 5,
  },
  {
    id: 'ach_war_machine',
    title: 'Complexo Militar Titânico',
    description: 'Alcance o poder militar de 600 ou mais soldados de prontidão.',
    rewardMoney: 6000,
    rewardMilitary: 120,
    isCompleted: ({ militaryPower }) => militaryPower >= 600,
  },
  {
    id: 'ach_treasury_king',
    title: 'Cofres Inesgotáveis',
    description: 'Acumule $20.000 em reservas do tesouro soberano.',
    rewardMoney: 4000,
    rewardMilitary: 60,
    isCompleted: ({ money }) => money >= 20000,
  },
  {
    id: 'ach_hegemon',
    title: 'Hegemonia Intercontinental',
    description: 'Controle 12 territórios ao redor do globo.',
    rewardMoney: 12000,
    rewardMilitary: 150,
    isCompleted: ({ conqueredCount }) => conqueredCount >= 12,
  },
  {
    id: 'ach_world_empire',
    title: 'Dominação Planetária Absoluta',
    description: `Unifique todos os ${TOTAL_COUNTRIES} territórios sob o estandarte do World Empire!`,
    rewardMoney: 25000,
    rewardMilitary: 300,
    isCompleted: ({ conqueredCount }) => conqueredCount >= TOTAL_COUNTRIES,
  },
];
