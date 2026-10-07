import { GeopoliticalEvent } from '../types/game';

export const GEOPOLITICAL_EVENTS: GeopoliticalEvent[] = [
  {
    id: 'event_oil_discovery',
    title: 'Descoberta de Megacampo de Petróleo',
    subtitle: 'Relatório Geológico Especial',
    category: 'oportunidade',
    description:
      'Satélites de prospecção e equipes submarinas detectaram reservas bilionárias de petróleo na sua plataforma continental. Seu gabinete aguarda instruções.',
    choices: [
      {
        id: 'nationalize',
        label: 'Estatizar e Investir na Extração',
        description: 'Custa $1.200 em maquinário, mas garante +$35/s de renda contínua ao tesouro.',
        costMoney: 1200,
        rewardIncomeBonus: 35,
        soundEffect: 'buy',
      },
      {
        id: 'auction',
        label: 'Leiloar Concessões Internacionais',
        description: 'Venda rápida de direitos de exploração para fundos globais. Receba +$3.500 imediatamente em caixa.',
        rewardMoney: 3500,
        soundEffect: 'buy',
      },
    ],
  },
  {
    id: 'event_cyber_attack',
    title: 'Alerta de Ciberguerra Hostil',
    subtitle: 'Centro Nacional de Segurança Digital',
    category: 'crise',
    description:
      'Uma rede coordenada de hackers estatais estrangeiros está testando os servidores da sua defesa e do Banco Central.',
    choices: [
      {
        id: 'counter_offensive',
        label: 'Contra-ataque Cibernético Ofensivo',
        description: 'Mobiliza especialistas em ofensiva militar. Sabota defesas de rivais vizinhos e ganha 25 tropas de inteligência.',
        rewardMilitary: 25,
        soundEffect: 'sabotage',
      },
      {
        id: 'shield_infrastructure',
        label: 'Blindagem e Firewalls Nacionais',
        description: 'Investe $600 em criptografia quântica, neutralizando a ameaça e protegendo o tesouro.',
        costMoney: 600,
        rewardMoney: 800,
        soundEffect: 'buy',
      },
    ],
  },
  {
    id: 'event_arms_deal',
    title: 'Oferta Especial do Mercado de Defesa',
    subtitle: 'Comitê Conjunto de Aquisições',
    category: 'militar',
    description:
      'Uma potência aliada está desmobilizando um lote moderno de blindados e radares e oferece preço de oportunidade com entrega imediata.',
    choices: [
      {
        id: 'buy_weapons',
        label: 'Adquirir Lote Estratégico',
        description: 'Investe $800 para incorporar imediatamente +60 Tropas de Elite às suas forças armadas.',
        costMoney: 800,
        rewardMilitary: 60,
        soundEffect: 'recruit',
      },
      {
        id: 'decline_weapons',
        label: 'Recusar e Preservar Recursos',
        description: 'Mantém foco financeiro. O tesouro ganha um pequeno bônus de prudência fiscal (+ $400).',
        rewardMoney: 400,
        soundEffect: 'buy',
      },
    ],
  },
  {
    id: 'event_border_tension',
    title: 'Escaramuça Fronteiriça & Tensão Diplomática',
    subtitle: 'Comando de Teatro de Operações',
    category: 'crise',
    description:
      'Patrulhas de fronteira relatam escaramuças armadas com forças neutras. Como sua nação responderá ao incidente?',
    choices: [
      {
        id: 'show_of_force',
        label: 'Demonstração Contundente de Força',
        description: 'Desloca baterias de artilharia. Moral militar explode (+35 tropas recrutadas por patriotismo).',
        rewardMilitary: 35,
        soundEffect: 'recruit',
      },
      {
        id: 'diplomatic_settlement',
        label: 'Acordo Diplomático e Indenização',
        description: 'Negocia tratado de desescalada recebendo $1.000 em compensação comercial.',
        rewardMoney: 1000,
        soundEffect: 'buy',
      },
    ],
  },
  {
    id: 'event_market_boom',
    title: 'Surto de Demanda Global de Commodities',
    subtitle: 'Bolsa de Mercadorias e Exportações',
    category: 'oportunidade',
    description:
      'Uma crise de suprimentos em outros continentes faz o preço das matérias-primas do seu território bater recorde histórico.',
    choices: [
      {
        id: 'expand_capacity',
        label: 'Expandir Portos e Ferrovias',
        description: 'Aplica $1.000 para ampliar infraestrutura e ganha +$25/s de renda definitiva.',
        costMoney: 1000,
        rewardIncomeBonus: 25,
        soundEffect: 'buy',
      },
      {
        id: 'cash_in',
        label: 'Liquidars Estoques e Lucrar Imediatamente',
        description: 'Vende excedentes a preços de pico: adiciona +$2.800 diretamente ao tesouro.',
        rewardMoney: 2800,
        soundEffect: 'buy',
      },
    ],
  },
];
