import { GameSaveData, OfflineProgressInfo } from '../types/game';
import { formatDuration } from '../utils/formatters';

const SAVE_KEY = 'WORLD_EMPIRE_SAVE_V1';

export class StorageService {
  /**
   * Verifica se existe um save salvo válido
   */
  static hasSave(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Partial<GameSaveData>;
      return !!(parsed && parsed.playerCountryId && parsed.money !== undefined && parsed.countries);
    } catch {
      return false;
    }
  }

  /**
   * Salva o estado atual do jogo no localStorage
   */
  static saveGame(data: Omit<GameSaveData, 'lastSaveTimestamp'>): boolean {
    try {
      const fullSave: GameSaveData = {
        ...data,
        lastSaveTimestamp: Date.now(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(fullSave));
      return true;
    } catch (err) {
      console.error('Falha ao salvar o jogo no LocalStorage:', err);
      return false;
    }
  }

  /**
   * Carrega os dados salvos com validação
   */
  static loadGame(): GameSaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as GameSaveData;
      if (!parsed.playerCountryId || !parsed.countries) {
        return null;
      }
      return parsed;
    } catch (err) {
      console.warn('Save corrompido ou ilegível:', err);
      return null;
    }
  }

  /**
   * Remove o save existente
   */
  static clearSave(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (err) {
      console.error('Erro ao limpar save:', err);
    }
  }

  /**
   * Calcula o progresso offline se o jogador ficou ausente por mais de 5 segundos
   */
  static calculateOfflineProgress(save: GameSaveData, currentIncomePerSecond: number): OfflineProgressInfo | null {
    if (!save.lastSaveTimestamp || currentIncomePerSecond <= 0) return null;

    const now = Date.now();
    const elapsedSeconds = Math.floor((now - save.lastSaveTimestamp) / 1000);

    // Mínimo de 10 segundos fora para disparar o aviso de boas-vindas
    if (elapsedSeconds < 10) {
      return null;
    }

    const moneyEarned = elapsedSeconds * currentIncomePerSecond;

    return {
      secondsOffline: elapsedSeconds,
      moneyEarned,
      formattedDuration: formatDuration(elapsedSeconds),
    };
  }
}
