import { GameSaveData, OfflineProgressInfo } from '../types/game';
import { formatDuration } from '../utils/formatters';
import { BALANCE } from '../utils/formulas';

const SAVE_KEY = 'WORLD_EMPIRE_SAVE_V1';
export const SAVE_VERSION = 2;

/**
 * Persistência local. Toda leitura/escrita passa por aqui para que uma futura
 * migração para Supabase/Firebase troque apenas esta camada.
 */
export class StorageService {
  static hasSave(): boolean {
    return StorageService.loadGame() !== null;
  }

  static saveGame(data: Omit<GameSaveData, 'lastSaveTimestamp'>): boolean {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, lastSaveTimestamp: Date.now() }));
      return true;
    } catch {
      return false;
    }
  }

  /** Retorna null para save inexistente ou corrompido */
  static loadGame(): GameSaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<GameSaveData>;
      if (!parsed || typeof parsed !== 'object' || !parsed.playerCountryId || !parsed.countries || typeof parsed.money !== 'number') {
        return null;
      }
      return parsed as GameSaveData;
    } catch {
      return null;
    }
  }

  static clearSave(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* armazenamento indisponível */
    }
  }

  /** Ganho offline para um período; null se o período for curto demais */
  static buildOfflineProgress(seconds: number, incomePerSecond: number): OfflineProgressInfo | null {
    const s = Math.floor(seconds);
    if (s < BALANCE.OFFLINE_MIN_S || incomePerSecond <= 0) return null;
    return { secondsOffline: s, moneyEarned: s * incomePerSecond, formattedDuration: formatDuration(s) };
  }
}
