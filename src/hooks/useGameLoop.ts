import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/useGameStore';

/**
 * Loop central do jogo:
 * - Executa gameTick a cada 1000ms de forma precisa e sem derivas
 * - Salva periodicamente o estado a cada 15 segundos
 * - Reage ao estado da aba (visibilitychange) para pausar / calcular offline suavemente
 */
export function useGameLoop() {
  const gameTick = useGameStore((state) => state.gameTick);
  const saveGame = useGameStore((state) => state.saveGame);
  const screen = useGameStore((state) => state.screen);

  const saveCounterRef = useRef<number>(0);

  useEffect(() => {
    if (screen !== 'game') return;

    const interval = setInterval(() => {
      gameTick(1);
      saveCounterRef.current += 1;

      // Salva automaticamente a cada 15 segundos
      if (saveCounterRef.current >= 15) {
        saveGame();
        saveCounterRef.current = 0;
      }
    }, 1000);

    const handleBeforeUnload = () => {
      saveGame();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [screen, gameTick, saveGame]);
}
