/**
 * Formata valores numéricos para moeda no padrão do jogo ($ 1.250 ou $ 1.5M para números gigantes)
 */
export function formatMoney(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '$ 0';
  
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    return `${sign}$ ${(abs / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}$ ${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 100_000) {
    return `${sign}$ ${(abs / 1_000).toFixed(1)}k`;
  }

  return `${sign}$ ${Math.floor(abs).toLocaleString('pt-BR')}`;
}

/**
 * Formata valores numéricos gerais (ex: tropas, defesa)
 */
export function formatNumber(value: number): string {
  if (isNaN(value)) return '0';
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 10_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return Math.floor(value).toLocaleString('pt-BR');
}

/**
 * Formata duração em segundos para texto legível (ex: 2h 14min, 45s, 5min 12s)
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s';
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  if (minutes > 0) {
    return `${minutes}min ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}
