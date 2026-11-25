/** Chaves do mod menu na Guerra no Ceará (só quem entrou com a senha liga). */
export const mod = {
  god: false, oneHit: false, anywhere: false, endless: false, spells: false, freeze: false, clock: false, fast: false,
  free: false, instant: false, noLimit: false, safe: false, through: false, loot: false,
};
export type ModId = keyof typeof mod;
export const MODS: { id: ModId; icon: string; name: string; group: 'Ataque' | 'Vila' }[] = [
  { id: 'god', icon: '🛡️', name: 'Tropas imortais', group: 'Ataque' },
  { id: 'oneHit', icon: '💥', name: 'Destruir com um golpe', group: 'Ataque' },
  { id: 'endless', icon: '♾️', name: 'Tropas infinitas', group: 'Ataque' },
  { id: 'spells', icon: '✨', name: 'Feitiços infinitos', group: 'Ataque' },
  { id: 'anywhere', icon: '📍', name: 'Soltar em qualquer lugar', group: 'Ataque' },
  { id: 'through', icon: '👻', name: 'Atravessar muros', group: 'Ataque' },
  { id: 'freeze', icon: '🧊', name: 'Congelar defesas', group: 'Ataque' },
  { id: 'fast', icon: '⏩', name: 'Tropas turbo', group: 'Ataque' },
  { id: 'clock', icon: '⏱️', name: 'Tempo infinito', group: 'Ataque' },
  { id: 'loot', icon: '🪙', name: 'Saque x10 (cidades sem jogador)', group: 'Ataque' },
  { id: 'free', icon: '🆓', name: 'Tudo de graça', group: 'Vila' },
  { id: 'instant', icon: '⚡', name: 'Obras e treino na hora', group: 'Vila' },
  { id: 'noLimit', icon: '🚫', name: 'Sem limite de construções e tropas', group: 'Vila' },
  { id: 'safe', icon: '🏰', name: 'Não perder nada ao ser atacado', group: 'Vila' },
];
