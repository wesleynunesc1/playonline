import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 500;

/** Conta suavemente até o novo valor */
export function useAnimatedNumber(target: number): number {
  const [shown, setShown] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    const from = current.current;
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      current.current = from + (target - from) * (1 - (1 - t) ** 3);
      setShown(current.current);
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return shown;
}
