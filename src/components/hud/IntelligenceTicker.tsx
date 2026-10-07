import React from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Radio, AlertCircle, TrendingUp, ShieldAlert } from 'lucide-react';

export const IntelligenceTicker: React.FC = () => {
  const currentNews = useGameStore((state) => state.currentNews);
  const totalPlayTimeSeconds = useGameStore((state) => state.totalPlayTimeSeconds);

  // Data de simulação iniciando em 2026 e avançando por dias de campanha
  const startDate = new Date(2026, 9, 15);
  const simulatedDays = Math.floor(totalPlayTimeSeconds / 5);
  const currentDate = new Date(startDate.getTime() + simulatedDays * 24 * 60 * 60 * 1000);
  const dateFormatted = currentDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const categoryIcons = {
    breaking: <AlertCircle size={13} className="text-rose-400 shrink-0" />,
    intel: <Radio size={13} className="text-cyan-400 shrink-0 animate-pulse" />,
    market: <TrendingUp size={13} className="text-emerald-400 shrink-0" />,
    war: <ShieldAlert size={13} className="text-amber-400 shrink-0" />,
  };

  return (
    <div className="w-full bg-[#05070d]/90 border-b border-slate-800/80 px-2 sm:px-4 py-1 flex items-center justify-between text-[11px] font-mono text-slate-400 select-none overflow-hidden">
      {/* Relógio de Campanha */}
      <div className="flex items-center gap-2 shrink-0 border-r border-slate-800 pr-3">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
        <span className="text-slate-200 font-bold tracking-tight">{dateFormatted}</span>
      </div>

      {/* Feed Noticioso em Ticker */}
      <div className="flex-1 mx-3 flex items-center gap-2 overflow-hidden truncate">
        {categoryIcons[currentNews.category]}
        <span className="text-slate-400 text-[10px] hidden xs:inline">[{currentNews.timestamp}]</span>
        <span className="text-slate-200 truncate tracking-tight">{currentNews.text}</span>
      </div>

      {/* Indicador de Varredura Orbital */}
      <div className="hidden md:flex items-center gap-1.5 shrink-0 pl-3 border-l border-slate-800 text-[10px] text-cyan-400/80">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
        <span>SATÉLITE CONECTADO</span>
      </div>
    </div>
  );
};
