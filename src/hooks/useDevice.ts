import { useEffect } from 'react';

/** Mantém a tela do celular acesa durante a partida */
export function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    const request = () => {
      if (document.hidden || !navigator.wakeLock) return;
      navigator.wakeLock.request('screen').then((l) => {
        if (alive) lock = l;
        else l.release().catch(() => {});
      }, () => {});
    };
    request();
    document.addEventListener('visibilitychange', request);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', request);
      lock?.release().catch(() => {});
    };
  }, []);
}

/** Aparelho lento: desliga nuvens e brilhos sozinho */
export function useLiteEffects() {
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let start = performance.now();
    let slow = 0;
    const frame = (now: number) => {
      frames++;
      if (now - start > 2000) {
        const fps = (frames * 1000) / (now - start);
        slow = fps < 24 ? slow + 1 : 0;
        if (slow >= 3) {
          document.documentElement.classList.add('lite');
          return;
        }
        frames = 0;
        start = now;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
}

export function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
