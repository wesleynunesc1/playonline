import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useApp } from '../../ui';
import { cheat } from '../../engine/state';
import { sound } from '../../utils/audio';
import { Button } from '../common/Button';
import { BONUS_POINTS, Direction, FOOD_POINTS, SnakeGame, createSnake, step, stepMs, turn } from '../../games/snake';
import { SnakeRenderer } from '../../games/snakeRenderer';

type Status = 'ready' | 'playing' | 'paused' | 'over' | 'won';

const BEST_KEY = 'PLAY_ONLINE_SNAKE_BEST';
const SWIPE_PX = 18;
const KEYS: Record<string, Direction> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};
const TITLES: Record<Status, string> = {
  ready: 'Jogo da Cobra',
  playing: '',
  paused: 'Pausado',
  over: 'Fim de jogo',
  won: 'Você venceu!',
};

const readBest = (): number => {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
};

export const SnakeScreen: React.FC = () => {
  const setScreen = useApp((s) => s.setScreen);
  const soundEnabled = useApp((s) => s.soundEnabled);
  const toggleSound = useApp((s) => s.toggleSound);

  const [walls, setWalls] = useState(true);
  const [status, setStatusState] = useState<Status>('ready');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(readBest);
  const [isRecord, setIsRecord] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef<SnakeGame>(createSnake(true));
  const renderer = useRef(new SnakeRenderer());
  const statusRef = useRef<Status>('ready');
  const wallsRef = useRef(walls);
  wallsRef.current = walls;
  const bestRef = useRef(best);
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const setStatus = useCallback((s: Status) => {
    statusRef.current = s;
    setStatusState(s);
  }, []);

  const start = useCallback(() => {
    game.current = createSnake(wallsRef.current);
    renderer.current.reset();
    setScore(0);
    setIsRecord(false);
    setStatus('playing');
  }, [setStatus]);

  const primary = useCallback(() => {
    if (statusRef.current === 'playing') setStatus('paused');
    else if (statusRef.current === 'paused') setStatus('playing');
    else start();
  }, [setStatus, start]);

  const steer = useCallback((dir: Direction) => {
    if (statusRef.current === 'ready') start();
    if (statusRef.current === 'paused') setStatus('playing');
    if (statusRef.current === 'playing') turn(game.current, dir);
  }, [setStatus, start]);

  // Lógica em passos fixos, desenho a cada quadro
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const finish = (won: boolean) => {
      setStatus(won ? 'won' : 'over');
      const final = game.current.score;
      setScore(final);
      if (final > bestRef.current) {
        bestRef.current = final;
        setBest(final);
        setIsRecord(true);
        try { localStorage.setItem(BEST_KEY, String(final)); } catch { /* armazenamento indisponível */ }
      }
      if (won) sound.playVictory();
      else {
        renderer.current.die(game.current);
        sound.playImpact();
      }
    };

    const advance = () => {
      const result = step(game.current, cheat.snake);
      if (result === 'dead' || result === 'win') finish(result === 'win');
      else if (result !== 'move') {
        const bonus = result === 'bonus';
        renderer.current.eat(game.current.body[0], bonus ? BONUS_POINTS : FOOD_POINTS, bonus);
        if (bonus) sound.playTechUnlocked();
        else sound.playBuy();
        setScore(game.current.score);
      }
    };

    const frame = (now: number) => {
      // Limita o salto para não simular vários passos após um travamento
      const dt = Math.min(100, Math.max(0, now - last));
      last = now;
      if (statusRef.current === 'playing') {
        acc += dt;
        while (statusRef.current === 'playing' && acc >= stepMs(game.current)) {
          acc -= stepMs(game.current);
          advance();
        }
      }
      const s = statusRef.current;
      const active = s === 'playing' || s === 'paused';
      if (!active) acc = 0;
      const t = active ? Math.min(1, acc / stepMs(game.current)) : 1;
      if (canvasRef.current) renderer.current.draw(canvasRef.current, game.current, t, now, dt / 1000, s === 'over');
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const pause = () => {
      if (statusRef.current === 'playing') setStatus('paused');
    };
    const onKey = (e: KeyboardEvent) => {
      const dir = KEYS[e.code];
      if (dir) {
        e.preventDefault();
        steer(dir);
      } else if (e.code === 'Escape') pause();
      else if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
        // Botões comuns (menu, som) continuam acessíveis pelo teclado
        if (e.target instanceof HTMLButtonElement && !('game' in e.target.dataset)) return;
        e.preventDefault();
        primary();
      }
    };
    const onVisibility = () => document.hidden && pause();
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [primary, setStatus, steer]);

  const onPointerMove = (e: React.PointerEvent) => {
    if (!swipe.current) return;
    const dx = e.clientX - swipe.current.x;
    const dy = e.clientY - swipe.current.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    swipe.current = { x: e.clientX, y: e.clientY };
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  };
  const endSwipe = () => {
    swipe.current = null;
  };

  const pad = (dir: Direction, Icon: typeof ArrowUp, pos: string, label: string) => (
    <button
      data-game
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        steer(dir);
      }}
      className={`glass-btn w-14 h-14 touch-none ${pos}`}
    >
      <Icon size={24} />
    </button>
  );

  const ended = status === 'over' || status === 'won';

  return (
    <div className="w-full h-full flex flex-col items-center gap-3 p-3 sm:p-5 safe-top overflow-y-auto bg-[radial-gradient(ellipse_at_top,#0f3b38,#050b0d_70%)]">
      <header className="w-full max-w-2xl flex items-center justify-between gap-2">
        <button onClick={() => setScreen('home')} className="glass-btn h-11 px-3 gap-2 text-sm">
          <ArrowLeft size={18} /> Menu
        </button>
        <div className="flex gap-5 text-center font-mono">
          <div>
            <p className="text-[10px] text-slate-300">PONTOS</p>
            <p key={score} className="score-pop text-xl font-bold text-emerald-300">{score}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-300">RECORDE</p>
            <p className="text-xl font-bold text-amber-300">{best}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleSound} className="glass-btn w-11 h-11" aria-label={soundEnabled ? 'Desligar som' : 'Ligar som'}>
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button data-game onClick={primary} className="glass-btn w-11 h-11" aria-label={status === 'playing' ? 'Pausar' : 'Jogar'}>
            {status === 'playing' ? <Pause size={18} /> : <Play size={18} />}
          </button>
        </div>
      </header>

      <div
        className="snake-board relative shrink-0 aspect-square w-[min(100%,calc(100dvh-17rem))] landscape:w-[min(100%,calc(100dvh-5.5rem))] sm:w-[min(100%,calc(100dvh-7rem))] min-w-[240px] max-w-3xl rounded-2xl overflow-hidden touch-none"
        onPointerDown={(e) => { swipe.current = { x: e.clientX, y: e.clientY }; }}
        onPointerMove={onPointerMove}
        onPointerUp={endSwipe}
        onPointerCancel={endSwipe}
        onPointerLeave={endSwipe}
      >
        <canvas ref={canvasRef} className="block w-full h-full" aria-label="Tabuleiro do jogo da cobra" />
        {status !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 bg-black/60 text-center animate-in">
            <h1 className="title-glow text-3xl sm:text-5xl font-black text-white">{TITLES[status]}</h1>
            {ended && (
              <p className="text-slate-200">
                {score} pontos{isRecord && <strong className="block text-amber-300">🏆 Novo recorde!</strong>}
              </p>
            )}
            <Button data-game size="lg" icon={<Play size={18} />} onClick={primary}>
              {status === 'paused' ? 'Continuar' : ended ? 'Jogar de novo' : 'Jogar'}
            </Button>
            {status !== 'paused' && (
              <button onClick={() => setWalls((w) => !w)} className="text-sm text-slate-200 underline underline-offset-4 p-2">
                Paredes: {walls ? 'ligadas' : 'desligadas (atravessa)'}
              </button>
            )}
            <p className="text-xs text-slate-300">Setas, WASD ou deslize o dedo • Espaço pausa</p>
          </div>
        )}
      </div>

      <div className="sm:hidden landscape:hidden grid grid-cols-3 gap-1.5">
        {pad('up', ArrowUp, 'col-start-2', 'Cima')}
        {pad('left', ArrowLeft, 'col-start-1 row-start-2', 'Esquerda')}
        {pad('down', ArrowDown, 'col-start-2 row-start-2', 'Baixo')}
        {pad('right', ArrowRight, 'col-start-3 row-start-2', 'Direita')}
      </div>
    </div>
  );
};
