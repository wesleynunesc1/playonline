import { useEffect } from 'react';
import { useGameStore } from '../stores/useGameStore';
import { BALANCE } from '../utils/formulas';

/**
 * Loop central único do jogo.
 * - Usa tempo real decorrido (o navegador limita timers em segundo plano)
 * - Lacunas longas (app minimizado no celular) viram progresso offline
 * - Salva periodicamente e sempre que o app vai para segundo plano
 */
export function useGameLoop() {
  const screen = useGameStore((s) => s.screen);

  useEffect(() => {
    if (screen !== 'game') return;
    const { gameTick, saveGame, grantOfflineProgress } = useGameStore.getState();
    let last = Date.now();
    let sinceSave = 0;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - last) / 1000;
      last = now;

      if (elapsed > BALANCE.BACKGROUND_GAP_S) {
        grantOfflineProgress(elapsed);
      } else {
        gameTick(elapsed);
      }

      sinceSave += elapsed;
      if (sinceSave >= BALANCE.AUTOSAVE_INTERVAL_S) {
        saveGame();
        sinceSave = 0;
      }
    }, 1000);

    const onHide = () => {
      if (document.visibilityState === 'hidden') saveGame();
    };

    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', saveGame);
    window.addEventListener('beforeunload', saveGame);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', saveGame);
      window.removeEventListener('beforeunload', saveGame);
    };
  }, [screen]);
}
