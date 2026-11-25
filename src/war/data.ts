import raw from './cities.json';

/** Guerra Ceará 2026: catálogo. Cidades, fronteiras e população: IBGE (malha municipal e Censo 2022). */
export interface City { id: number; name: string; pop: number; region: string; x: number; z: number; rings: number[][]; level: number }
const S = 0.12;
/** Coordenadas do mapa (centésimos de grau) para o mundo 3D */
export const wx = (x: number) => (x - 225) * S;
export const wz = (y: number) => -(y - 285) * S;
const ROWS = raw as unknown as [number, string, number, string, number, number, number[][]][];
export const CITIES: City[] = ROWS.map(([id, name, pop, region, x, y, rings]) => ({
  id, name, pop, region, x: wx(x), z: wz(y), rings,
  level: pop > 400_000 ? 6 : pop > 110_000 ? 5 : pop > 60_000 ? 4 : pop > 30_000 ? 3 : pop > 16_000 ? 2 : 1,
}));
export const CITY = Object.fromEntries(CITIES.map((c) => [c.id, c])) as Record<number, City>;
export const CITY_INDEX = Object.fromEntries(CITIES.map((c, i) => [c.id, i])) as Record<number, number>;
/** Estradas: cada cidade ligada às duas mais próximas */
export const ROADS: [City, City][] = (() => {
  const out: [City, City][] = [];
  const seen = new Set<string>();
  for (const c of CITIES) {
    const near = CITIES.filter((o) => o !== c).sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z)).slice(0, 3);
    for (const n of near) {
      const key = [c.id, n.id].sort().join('-');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([c, n]);
    }
  }
  return out;
})();
export const REGION_COLOR: Record<string, string> = {
  'Metropolitana de Fortaleza': '#7f9a6c', Norte: '#86a065', Noroeste: '#97a063', Jaguaribe: '#a99a68', Sertões: '#b1925f', 'Centro-Sul': '#a98a59', Sul: '#7f9860',
};

export type BonusKey = 'income' | 'fuel' | 'dmg' | 'armor' | 'speed' | 'range' | 'vision' | 'train' | 'cost' | 'city' | 'power' | 'heal';
export type Bonus = Partial<Record<BonusKey, number>>;
export const BONUS_LABEL: Record<BonusKey, string> = {
  income: 'dinheiro', fuel: 'combustível', dmg: 'dano', armor: 'blindagem', speed: 'velocidade', range: 'alcance', vision: 'visão', train: 'treino mais rápido',
  cost: 'desconto', city: 'defesa das cidades', power: 'recarga dos apoios', heal: 'reparo',
};
export const bonusText = (b: Bonus) => (Object.entries(b) as [BonusKey, number][]).map(([k, v]) => `+${Math.round(v * 100)}% ${BONUS_LABEL[k]}`).join(', ');

// ===== 15 unidades =====
export type UnitId = 'soldado' | 'antitanque' | 'sniper' | 'medico' | 'hacker' | 'moto' | 'blindado' | 'tanque' | 'artilharia' | 'foguete' | 'antiaerea' | 'fpv' | 'recon' | 'heli' | 'caca';
export type Class = 'inf' | 'vei' | 'ar';
export interface UnitDef {
  name: string; icon: string; cls: Class; hp: number; dmg: [number, number, number]; every: number; range: number; min?: number; vision: number; speed: number;
  money: number; fuel: number; time: number; from: WorksId; text: string; splash?: number; suicide?: boolean; heal?: number; jam?: boolean; shot: Shot; captures?: boolean;
}
/** dmg = contra infantaria, veículo e aéreo */
export const UNITS: Record<UnitId, UnitDef> = {
  soldado: { name: 'Infantaria', icon: '🪖', cls: 'inf', hp: 100, dmg: [12, 5, 4], every: 0.8, range: 0.95, vision: 2.4, speed: 0.42, money: 60, fuel: 0, time: 4, from: 'quartel', text: 'Toma cidades. Barata.', shot: 'bala', captures: true },
  antitanque: { name: 'Antitanque', icon: '🎯', cls: 'inf', hp: 90, dmg: [10, 62, 0], every: 2.4, range: 1.5, vision: 2.4, speed: 0.4, money: 110, fuel: 0, time: 6, from: 'quartel', text: 'Míssil portátil contra blindados.', shot: 'missil', captures: true },
  sniper: { name: 'Sniper', icon: '🔭', cls: 'inf', hp: 70, dmg: [60, 6, 0], every: 2.6, range: 2.2, vision: 3.4, speed: 0.42, money: 130, fuel: 0, time: 7, from: 'quartel', text: 'Elimina infantaria de longe.', shot: 'bala', captures: true },
  medico: { name: 'Médico', icon: '⛑️', cls: 'inf', hp: 90, dmg: [0, 0, 0], every: 1, range: 1.6, vision: 2, speed: 0.44, money: 120, fuel: 0, time: 6, from: 'quartel', text: 'Cura quem está perto.', heal: 9, shot: 'bala' },
  hacker: { name: 'Guerra Eletrônica', icon: '📡', cls: 'vei', hp: 120, dmg: [0, 0, 0], every: 1, range: 2.6, vision: 2.6, speed: 0.5, money: 220, fuel: 60, time: 9, from: 'drones', text: 'Derruba drones inimigos por perto.', jam: true, shot: 'bala' },
  moto: { name: 'Moto-Tropa', icon: '🏍️', cls: 'inf', hp: 90, dmg: [10, 4, 2], every: 0.8, range: 0.9, vision: 3, speed: 1.05, money: 100, fuel: 20, time: 5, from: 'quartel', text: 'Muito rápida. Toma cidades.', shot: 'bala', captures: true },
  blindado: { name: 'Blindado', icon: '🛻', cls: 'vei', hp: 320, dmg: [20, 12, 8], every: 0.6, range: 1.2, vision: 2.8, speed: 0.72, money: 220, fuel: 60, time: 9, from: 'fabrica', text: 'Transporte armado. Toma cidades.', shot: 'bala', captures: true },
  tanque: { name: 'Tanque', icon: '🚜', cls: 'vei', hp: 620, dmg: [42, 78, 0], every: 1.9, range: 1.45, vision: 2.6, speed: 0.56, money: 420, fuel: 130, time: 14, from: 'fabrica', text: 'A ponta de lança.', splash: 0.35, shot: 'canhao', captures: true },
  artilharia: { name: 'Artilharia', icon: '💥', cls: 'vei', hp: 190, dmg: [64, 52, 0], every: 4, range: 4.2, min: 1, vision: 2.2, speed: 0.42, money: 480, fuel: 110, time: 15, from: 'fabrica', text: 'Bombardeia de muito longe.', splash: 0.8, shot: 'canhao' },
  foguete: { name: 'Lança-Foguetes', icon: '🚀', cls: 'vei', hp: 190, dmg: [90, 70, 0], every: 7, range: 5.6, min: 1.6, vision: 2.2, speed: 0.46, money: 720, fuel: 200, time: 20, from: 'fabrica', text: 'Salva de foguetes em área.', splash: 1.1, shot: 'missil' },
  antiaerea: { name: 'Antiaérea', icon: '🛡️', cls: 'vei', hp: 240, dmg: [6, 4, 70], every: 1.4, range: 3.4, vision: 3.6, speed: 0.55, money: 330, fuel: 90, time: 12, from: 'fabrica', text: 'Derruba aviões, helicópteros e drones.', shot: 'missil' },
  fpv: { name: 'Drone FPV', icon: '🛩️', cls: 'ar', hp: 30, dmg: [80, 210, 40], every: 0.5, range: 0.25, vision: 2.6, speed: 1.6, money: 130, fuel: 10, time: 5, from: 'drones', text: 'Drone suicida: mergulha e explode.', splash: 0.45, suicide: true, shot: 'bala' },
  recon: { name: 'Drone Espião', icon: '🛰️', cls: 'ar', hp: 60, dmg: [0, 0, 0], every: 1, range: 0.1, vision: 6, speed: 1.3, money: 120, fuel: 15, time: 6, from: 'drones', text: 'Enxerga muito longe.', shot: 'bala' },
  heli: { name: 'Helicóptero', icon: '🚁', cls: 'ar', hp: 360, dmg: [34, 60, 14], every: 1.1, range: 1.7, vision: 3.4, speed: 1.15, money: 620, fuel: 220, time: 18, from: 'aeroporto', text: 'Caça blindados por cima de tudo.', shot: 'missil' },
  caca: { name: 'Caça', icon: '✈️', cls: 'ar', hp: 300, dmg: [40, 60, 95], every: 1.5, range: 1.9, vision: 4, speed: 2.6, money: 900, fuel: 350, time: 24, from: 'aeroporto', text: 'O mais rápido. Domina o céu.', splash: 0.4, shot: 'missil' },
};
export const UNIT_IDS = Object.keys(UNITS) as UnitId[];
export type Shot = 'bala' | 'canhao' | 'missil';
export const unitCap = (cities: number) => Math.min(60, 22 + cities * 3);

// ===== 17 construções =====
export type WorksId =
  | 'comando' | 'mercado' | 'shopping' | 'refinaria' | 'solar' | 'eolica' | 'banco' | 'quartel' | 'fabrica' | 'drones' | 'aeroporto' | 'hospital'
  | 'torre' | 'antiaerea' | 'obuseiro' | 'radar' | 'gerador' | 'silo' | 'vigia';
export interface WorksDef {
  name: string; icon: string; money: number; fuel: number; time: number; text: string; level: number; income?: number; fuelOut?: number;
  gun?: { dmg: [number, number, number]; every: number; range: number; splash?: number; shot: Shot };
}
/** `level`: tamanho mínimo da cidade */
export const WORKS: Record<WorksId, WorksDef> = {
  comando: { name: 'Quartel-General', icon: '🏢', money: 0, fuel: 0, time: 0, level: 99, text: 'A sede da sua campanha.' },
  mercado: { name: 'Comércio', icon: '🏪', money: 200, fuel: 0, time: 8, level: 1, income: 2.2, text: '+2,2 de dinheiro por segundo.' },
  shopping: { name: 'Shopping', icon: '🛍️', money: 700, fuel: 0, time: 16, level: 4, income: 6.5, text: '+6,5 de dinheiro por segundo.' },
  banco: { name: 'Banco', icon: '🏦', money: 500, fuel: 0, time: 14, level: 3, income: 4.2, text: '+4,2 de dinheiro por segundo.' },
  refinaria: { name: 'Refinaria', icon: '⛽', money: 250, fuel: 0, time: 9, level: 1, fuelOut: 1.5, text: '+1,5 de combustível por segundo.' },
  solar: { name: 'Usina Solar', icon: '☀️', money: 420, fuel: 0, time: 12, level: 2, fuelOut: 2.4, text: '+2,4 de combustível por segundo.' },
  eolica: { name: 'Torre Eólica', icon: '🌬️', money: 560, fuel: 0, time: 14, level: 3, fuelOut: 3.4, text: '+3,4 de combustível por segundo.' },
  quartel: { name: 'Quartel', icon: '🎖️', money: 250, fuel: 0, time: 8, level: 1, text: 'Treina infantaria.' },
  fabrica: { name: 'Fábrica de Blindados', icon: '🏭', money: 600, fuel: 100, time: 14, level: 2, text: 'Produz veículos, tanques e artilharia.' },
  drones: { name: 'Centro de Drones', icon: '🛰️', money: 500, fuel: 60, time: 12, level: 2, text: 'Produz drones e guerra eletrônica.' },
  aeroporto: { name: 'Base Aérea', icon: '✈️', money: 1100, fuel: 250, time: 20, level: 4, text: 'Produz helicópteros e caças.' },
  hospital: { name: 'Hospital', icon: '🏥', money: 400, fuel: 0, time: 10, level: 2, text: 'Cura e repara unidades na cidade.' },
  torre: { name: 'Torre Automática', icon: '🔫', money: 260, fuel: 30, time: 8, level: 1, text: 'Metralha quem chega.', gun: { dmg: [24, 12, 6], every: 0.5, range: 1.7, shot: 'bala' } },
  vigia: { name: 'Posto de Vigia', icon: '🗼', money: 180, fuel: 0, time: 6, level: 1, text: 'Enxerga longe e atira em infantaria.', gun: { dmg: [22, 5, 6], every: 1, range: 2, shot: 'bala' } },
  antiaerea: { name: 'Bateria Antiaérea', icon: '🎯', money: 420, fuel: 60, time: 12, level: 2, text: 'Protege o céu da cidade.', gun: { dmg: [0, 0, 80], every: 1.3, range: 3.6, shot: 'missil' } },
  obuseiro: { name: 'Obuseiro', icon: '💣', money: 560, fuel: 80, time: 14, level: 3, text: 'Artilharia fixa de longo alcance.', gun: { dmg: [60, 50, 0], every: 3.6, range: 4, splash: 0.7, shot: 'canhao' } },
  radar: { name: 'Radar', icon: '📡', money: 320, fuel: 30, time: 9, level: 2, text: 'Grande visão em volta.' },
  gerador: { name: 'Defesa Reforçada', icon: '🛡️', money: 480, fuel: 60, time: 12, level: 3, text: 'A cidade aguenta o dobro.' },
  silo: { name: 'Silo de Mísseis', icon: '🚀', money: 1500, fuel: 400, time: 26, level: 5, text: 'Libera o Míssil Balístico.' },
};
export const WORKS_IDS = (Object.keys(WORKS) as WorksId[]).filter((k) => k !== 'comando');
export const slotsOf = (level: number) => 2 + level;
export const cityIncome = (level: number) => 0.8 + level * 0.7;
export const cityFuel = (level: number) => 0.15 + level * 0.12;
export const cityHp = (level: number) => Math.round(180 * level ** 1.15);
export const cityGun = (level: number): WorksDef['gun'] => ({ dmg: [7 + level * 2.5, 4 + level * 1.6, 3 + level], every: 0.9, range: 1.35, shot: 'bala' });
export const CAPTURE_RADIUS = 0.8;
export const CAPTURE_S = 4;

// ===== 8 apoios =====
export type PowerId = 'barragem' | 'aereo' | 'fumaca' | 'emp' | 'paraquedas' | 'satelite' | 'reparo' | 'balistico';
export const POWERS: Record<PowerId, { name: string; icon: string; money: number; cool: number; radius: number; text: string; color: string }> = {
  barragem: { name: 'Barragem', icon: '💥', money: 250, cool: 45, radius: 1.3, text: 'Chuva de artilharia por 4 segundos.', color: '#fb923c' },
  aereo: { name: 'Ataque Aéreo', icon: '🛩️', money: 400, cool: 70, radius: 1.5, text: 'Bombardeiros despejam tudo no alvo.', color: '#f87171' },
  fumaca: { name: 'Fumaça', icon: '🌫️', money: 100, cool: 35, radius: 1.5, text: 'Quem está dentro não pode ser mirado.', color: '#cbd5e1' },
  emp: { name: 'Pulso EMP', icon: '📴', money: 300, cool: 70, radius: 1.6, text: 'Para veículos, aéreos e defesas por 6s.', color: '#38bdf8' },
  paraquedas: { name: 'Paraquedistas', icon: '🪂', money: 350, cool: 80, radius: 0.8, text: '5 soldados em qualquer lugar.', color: '#facc15' },
  satelite: { name: 'Satélite', icon: '🛰️', money: 120, cool: 50, radius: 8, text: 'Revela uma área enorme por 15s.', color: '#a78bfa' },
  reparo: { name: 'Reparo', icon: '🔧', money: 200, cool: 50, radius: 1.6, text: 'Recupera 45% da vida das suas tropas.', color: '#4ade80' },
  balistico: { name: 'Míssil Balístico', icon: '☢️', money: 1200, cool: 150, radius: 2, text: 'Destruição enorme. Precisa de Silo.', color: '#ef4444' },
};
export const POWER_IDS = Object.keys(POWERS) as PowerId[];

// ===== 30 pesquisas: 10 áreas x 3 níveis =====
export const RESEARCH: { id: string; name: string; icon: string; levels: [string, string, string]; per: Bonus }[] = [
  { id: 'ia', name: 'Mira por IA', icon: '🧠', levels: ['Assistente', 'Rede Neural', 'Autônoma'], per: { dmg: 0.08 } },
  { id: 'blindagem', name: 'Blindagem', icon: '🦾', levels: ['Reativa', 'Grafeno', 'Ativa'], per: { armor: 0.09 } },
  { id: 'fintech', name: 'Economia Digital', icon: '💳', levels: ['Pix Turbo', 'Open Finance', 'Real Digital'], per: { income: 0.1 } },
  { id: 'verde', name: 'Hidrogênio Verde', icon: '🌱', levels: ['Eletrólise', 'Polo do Pecém', 'Exportação'], per: { fuel: 0.12 } },
  { id: 'motor', name: 'Motores Híbridos', icon: '⚙️', levels: ['Turbo', 'Híbrido', 'Elétrico'], per: { speed: 0.07 } },
  { id: 'optica', name: 'Óptica', icon: '🔭', levels: ['Térmica', 'Noturna', 'Quântica'], per: { range: 0.05, vision: 0.1 } },
  { id: 'logistica', name: 'Logística 5G', icon: '📦', levels: ['Rastreio', 'Drones de Carga', 'Estoque Zero'], per: { train: 0.12, cost: 0.03 } },
  { id: 'cidade', name: 'Cidade Fortificada', icon: '🏰', levels: ['Trincheiras', 'Bunkers', 'Domo'], per: { city: 0.15 } },
  { id: 'comando', name: 'Comando Integrado', icon: '🎧', levels: ['Rádio', 'Satélite', 'Nuvem de Guerra'], per: { power: 0.12 } },
  { id: 'medicina', name: 'Medicina de Combate', icon: '🧬', levels: ['Torniquete', 'Telecirurgia', 'Biogel'], per: { heal: 0.25 } },
];
export const researchCost = (level: number) => [400, 1100, 2600][level] ?? 0;

// ===== 17 cidades estratégicas =====
const byName = (n: string) => CITIES.find((c) => c.name === n)!.id;
export const LANDMARKS: Record<number, { name: string; icon: string; bonus: Bonus }> = Object.fromEntries(([
  ['Fortaleza', 'Hub de Cabos Submarinos', '🌐', { income: 0.15 }], ['São Gonçalo do Amarante', 'Porto do Pecém', '🚢', { fuel: 0.2 }],
  ['Juazeiro do Norte', 'Polo do Cariri', '⛪', { income: 0.1 }], ['Sobral', 'Polo Universitário', '🎓', { train: 0.12 }],
  ['Jijoca de Jericoacoara', 'Jericoacoara', '🏄', { income: 0.06 }], ['Aracati', 'Canoa Quebrada', '🌅', { income: 0.06 }],
  ['Crato', 'Chapada do Araripe', '🦖', { armor: 0.05 }], ['Quixadá', 'Monólitos', '🪂', { vision: 0.15 }],
  ['Canindé', 'Romaria', '🙏', { heal: 0.3 }], ['Guaramiranga', 'Serra de Baturité', '⛰️', { range: 0.05 }],
  ['Aquiraz', 'Litoral Leste', '🎢', { income: 0.06 }], ['Caucaia', 'Cumbuco', '🪁', { fuel: 0.1 }],
  ['Ubajara', 'Ibiapaba', '🚡', { city: 0.12 }], ['Camocim', 'Porto Pesqueiro', '🎣', { fuel: 0.08 }],
  ['Maracanaú', 'Distrito Industrial', '🏭', { cost: 0.06 }], ['Limoeiro do Norte', 'Agro 4.0', '🌾', { income: 0.06 }], ['Eusébio', 'Polo de Tecnologia', '🔬', { dmg: 0.06 }],
] as [string, string, string, Bonus][]).map(([city, name, icon, bonus]) => [byName(city), { name, icon, bonus }]));
// ===== 7 regiões =====
export const REGION_BONUS: Record<string, Bonus> = {
  'Metropolitana de Fortaleza': { income: 0.25 }, Norte: { fuel: 0.25 }, Noroeste: { armor: 0.12 }, Jaguaribe: { train: 0.15 }, Sertões: { dmg: 0.12 }, 'Centro-Sul': { speed: 0.1 }, Sul: { power: 0.2 },
};

// ===== 14 eventos da partida =====
export const EVENTS: { name: string; icon: string; text: string; seconds: number; bonus?: Bonus; gift?: [number, number] }[] = [
  { name: 'Ajuda internacional', icon: '📦', text: 'Todos recebem recursos', seconds: 0, gift: [400, 120] },
  { name: 'Alta do petróleo', icon: '🛢️', text: 'Menos combustível', seconds: 60, bonus: { fuel: -0.4 } },
  { name: 'Vento forte', icon: '🌬️', text: 'Mais energia eólica e solar', seconds: 60, bonus: { fuel: 0.5 } },
  { name: 'Chuva pesada', icon: '🌧️', text: 'Tropas mais lentas', seconds: 45, bonus: { speed: -0.25 } },
  { name: 'Neblina', icon: '🌫️', text: 'Visão reduzida', seconds: 50, bonus: { vision: -0.4 } },
  { name: 'Moral alta', icon: '🚩', text: 'Mais dano', seconds: 50, bonus: { dmg: 0.2 } },
  { name: 'Black Friday bélica', icon: '🏷️', text: 'Tudo mais barato', seconds: 60, bonus: { cost: 0.25 } },
  { name: 'Mobilização', icon: '📣', text: 'Treino mais rápido', seconds: 60, bonus: { train: 0.5 } },
  { name: 'Blecaute', icon: '🔌', text: 'Renda menor', seconds: 45, bonus: { income: -0.3 } },
  { name: 'Safra recorde', icon: '🌽', text: 'Renda maior', seconds: 60, bonus: { income: 0.35 } },
  { name: 'Céu limpo', icon: '☀️', text: 'Alcance maior', seconds: 50, bonus: { range: 0.12 } },
  { name: 'Cibercrise', icon: '💻', text: 'Apoios recarregam devagar', seconds: 60, bonus: { power: -0.4 } },
  { name: 'Reservistas', icon: '🪖', text: 'Cidades mais fortes', seconds: 60, bonus: { city: 0.3 } },
  { name: 'Fundo secreto', icon: '💼', text: 'Todos recebem dinheiro', seconds: 0, gift: [700, 0] },
];

// ===== 5 modos e 12 regras =====
export type ModeId = 'dominio' | 'total' | 'capital' | 'equipes' | 'coop';
export const MODES: { id: ModeId; name: string; icon: string; text: string }[] = [
  { id: 'dominio', name: 'Domínio', icon: '🗺️', text: 'Quem controlar mais população no fim vence.' },
  { id: 'total', name: 'Guerra Total', icon: '💀', text: 'Vence o último de pé.' },
  { id: 'capital', name: 'Corrida a Fortaleza', icon: '🏙️', text: 'Segure Fortaleza por 3 minutos somados.' },
  { id: 'equipes', name: 'Equipes', icon: '🤝', text: 'Times alternados somam população.' },
  { id: 'coop', name: 'Contra a Máquina', icon: '🤖', text: 'Humanos juntos contra os robôs.' },
];
export const MINUTES = [10, 15, 25, 40];
export const RULES: { id: string; name: string; icon: string; text: string }[] = [
  { id: 'rico', name: 'Muito dinheiro', icon: '💰', text: 'Começa com 5 vezes mais' },
  { id: 'turbo', name: 'Turbo', icon: '⏩', text: 'Treino e obras 2x mais rápidos' },
  { id: 'veloz', name: 'Guerra-relâmpago', icon: '⚡', text: 'Tropas 50% mais velozes' },
  { id: 'aberto', name: 'Mapa aberto', icon: '👁️', text: 'Todos enxergam tudo' },
  { id: 'semar', name: 'Sem aviação', icon: '🚫', text: 'Nada de caças e helicópteros' },
  { id: 'semapoio', name: 'Sem apoios', icon: '🙅', text: 'Só tropas' },
  { id: 'drones', name: 'Guerra de drones', icon: '🛩️', text: 'Drones pela metade do preço' },
  { id: 'fraco', name: 'Cidades frágeis', icon: '🏚️', text: 'Cidades neutras com metade da defesa' },
  { id: 'forte', name: 'Cidades-fortaleza', icon: '🏰', text: 'Cidades com o dobro da defesa' },
  { id: 'renda', name: 'Economia em alta', icon: '📈', text: '+60% de renda' },
  { id: 'caos', name: 'Eventos em dobro', icon: '🎲', text: 'Eventos 2x mais frequentes' },
  { id: 'exercito', name: 'Exército pronto', icon: '🪖', text: 'Começa com tropas extras' },
];

// ===== 14 medalhas =====
export type Stat = 'kills' | 'lost' | 'caps' | 'lostCities' | 'built' | 'trained' | 'spent' | 'powers' | 'tanks' | 'air' | 'drones' | 'research' | 'damage' | 'earned';
export const MEDALS: { name: string; icon: string; stat: Stat }[] = [
  { name: 'Ás do Combate', icon: '🎖️', stat: 'kills' }, { name: 'Libertador', icon: '🚩', stat: 'caps' }, { name: 'Construtor', icon: '🏗️', stat: 'built' },
  { name: 'Recrutador', icon: '🪖', stat: 'trained' }, { name: 'Gastador', icon: '💸', stat: 'spent' }, { name: 'Chuva de Fogo', icon: '💥', stat: 'powers' },
  { name: 'Coração de Aço', icon: '🚜', stat: 'tanks' }, { name: 'Dono do Céu', icon: '✈️', stat: 'air' }, { name: 'Mestre dos Drones', icon: '🛩️', stat: 'drones' },
  { name: 'Cientista', icon: '🔬', stat: 'research' }, { name: 'Devastador', icon: '☄️', stat: 'damage' }, { name: 'Magnata', icon: '💰', stat: 'earned' },
  { name: 'Sacrifício', icon: '🕯️', stat: 'lost' }, { name: 'Resistente', icon: '🧱', stat: 'lostCities' },
];
export const PHRASES = ['Bora!', 'Trégua?', 'Vou te pegar', 'Ajuda aqui!', 'Boa!', 'Kkkkk', 'Recuar!', 'Avançar!', 'Traidor!', 'GG', 'Égua, macho!', 'Arretado! 🔥'];
export const COLORS = ['#2f7bff', '#ff3b3b', '#22c55e', '#f5b301', '#b04bff', '#ff7a1a'];
export const EMBLEMS = ['🦅', '🐆', '🦈', '🐍', '🦂', '🐂', '🐉', '🦁'];
export const MAX_PLAYERS = 6;
