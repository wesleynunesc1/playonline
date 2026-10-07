import React from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Play, Pause, FastForward } from 'lucide-react';
import { GameSpeed } from '../../types/game';

export const TimeSpeedControls: React.FC = () => {
  const gameSpeed = useGameStore((state) => state.gameSpeed);
  const isPaused = useGameStore((state) => state.isPaused);
  const setGameSpeed = useGameStore((state) => state.setGameSpeed);
  const togglePause = useGameStore((state) => state.togglePause);

  const speeds: GameSpeed[] = [1, 2, 5];

  return (
    <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-xl p-0.5 select-none shadow-sm">
      {/* Botão Pausa */}
      <button
        onClick={togglePause}
        className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
          isPaused
            ? 'bg-amber-500 text-slate-950 font-bold'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
        title={isPaused ? 'Retomar Simulação' : 'Pausar Simulação'}
      >
        {isPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} />}
      </button>

      {/* Botões de Velocidade 1x, 2x, 5x */}
      {speeds.map((s) => {
        const isActive = !isPaused && gameSpeed === s;
        return (
          <button
            key={s}
            onClick={() => setGameSpeed(s)}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold transition-all flex items-center gap-0.5 ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title={`Velocidade ${s}x`}
          >
            {s > 1 && <FastForward size={10} />}
            <span>{s}x</span>
          </button>
        );
      })}
    </div>
  );
};
