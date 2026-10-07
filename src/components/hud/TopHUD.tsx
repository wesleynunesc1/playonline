import React from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { formatMoney, formatNumber } from '../../utils/formatters';
import { Menu, Shield, Plus, Cpu, Trophy } from 'lucide-react';
import { COUNTRIES_DATA } from '../../data/countries';
import { calculateRecruitCost } from '../../utils/formulas';
import { IntelligenceTicker } from './IntelligenceTicker';
import { TimeSpeedControls } from './TimeSpeedControls';

export const TopHUD: React.FC = () => {
  const money = useGameStore((state) => state.money);
  const militaryPower = useGameStore((state) => state.militaryPower);
  const playerCountryId = useGameStore((state) => state.playerCountryId);
  const getTotalIncomePerSecond = useGameStore((state) => state.getTotalIncomePerSecond);
  const getConqueredTerritoriesCount = useGameStore((state) => state.getConqueredTerritoriesCount);
  const openModal = useGameStore((state) => state.openModal);
  const recruitMilitary = useGameStore((state) => state.recruitMilitary);
  const unlockedTechIds = useGameStore((state) => state.unlockedTechIds);
  const unlockedAchievementIds = useGameStore((state) => state.unlockedAchievementIds);

  const income = getTotalIncomePerSecond();
  const territories = getConqueredTerritoriesCount();
  const playerCountry = playerCountryId ? COUNTRIES_DATA[playerCountryId] : null;

  const recruitCost = calculateRecruitCost(militaryPower, 1);
  const canRecruit = money >= recruitCost;

  return (
    <div className="fixed top-0 left-0 right-0 z-40 flex flex-col select-none">
      {/* Ticker de Inteligência e Data de Operações */}
      <IntelligenceTicker />

      {/* Barra Principal de Recursos */}
      <header className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-2 sm:px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Jogador / Soberano & Territórios */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {playerCountry && (
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-2 sm:px-2.5 py-1.5 rounded-xl">
                <span className="text-xl sm:text-2xl leading-none">{playerCountry.flag}</span>
                <div className="hidden sm:block">
                  <span className="text-xs font-bold text-slate-200 block leading-tight">{playerCountry.name}</span>
                  <span className="text-[10px] text-blue-400 font-medium">Soberano</span>
                </div>
              </div>
            )}

            {/* Territórios */}
            <div
              className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800/90 px-2 sm:px-2.5 py-1.5 rounded-xl"
              title="Territórios sob seu comando"
            >
              <span className="text-base sm:text-lg">🌎</span>
              <div>
                <span className="text-xs sm:text-sm font-extrabold text-slate-100">{territories}</span>
                <span className="text-[10px] text-slate-400 hidden lg:inline ml-1">/ 10</span>
              </div>
            </div>
          </div>

          {/* Recursos Centrais (Dinheiro e Poder Militar) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Dinheiro & Renda */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/95 border border-amber-500/30 px-2 sm:px-3 py-1.5 rounded-xl shadow-sm">
              <span className="text-base sm:text-lg">💰</span>
              <div className="flex flex-col text-left">
                <span className="text-xs sm:text-sm font-bold text-amber-300 font-mono tracking-tight leading-tight">
                  {formatMoney(money)}
                </span>
                <span className="text-[10px] sm:text-xs font-semibold text-emerald-400 font-mono leading-tight">
                  +${income}/s
                </span>
              </div>
            </div>

            {/* Poder Militar */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/95 border border-blue-500/30 px-2 sm:px-3 py-1.5 rounded-xl shadow-sm">
              <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
              <div className="flex flex-col text-left">
                <span className="text-xs sm:text-sm font-bold text-blue-300 font-mono leading-tight">
                  ⚔ {formatNumber(militaryPower)}
                </span>
                <span className="text-[10px] text-slate-400 leading-tight hidden xs:inline">Tropas</span>
              </div>

              {/* Botão rápido de recrutamento */}
              <button
                onClick={() => recruitMilitary(1)}
                disabled={!canRecruit}
                title={`Recrutar +10 tropas (${formatMoney(recruitCost)})`}
                className={`ml-0.5 sm:ml-1 flex items-center justify-center w-6 h-6 rounded-lg transition-all ${
                  canRecruit
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Ações Táticas: P&D, Conquistas, Velocidade e Menu */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Controles de Velocidade de Jogo */}
            <div className="hidden md:block">
              <TimeSpeedControls />
            </div>

            {/* P&D Tecnológico */}
            <button
              onClick={() => openModal('tech_tree')}
              className="relative flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-cyan-400 px-2 sm:px-2.5 py-1.5 rounded-xl transition-colors"
              title="Pesquisa & Desenvolvimento Tecnológico"
            >
              <Cpu size={16} />
              <span className="text-xs font-semibold hidden lg:inline">P&D</span>
              {unlockedTechIds.length > 0 && (
                <span className="text-[9px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-500/40 px-1 rounded-full">
                  {unlockedTechIds.length}
                </span>
              )}
            </button>

            {/* Conquistas Imperiais */}
            <button
              onClick={() => openModal('achievements')}
              className="relative flex items-center gap-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-amber-400 px-2 sm:px-2.5 py-1.5 rounded-xl transition-colors"
              title="Insígnias e Conquistas"
            >
              <Trophy size={16} />
              {unlockedAchievementIds.length > 0 && (
                <span className="text-[9px] font-mono bg-amber-950 text-amber-300 border border-amber-500/40 px-1 rounded-full">
                  {unlockedAchievementIds.length}
                </span>
              )}
            </button>

            {/* Menu Principal */}
            <button
              onClick={() => openModal('pause_menu')}
              className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 px-2 sm:px-2.5 py-1.5 rounded-xl transition-colors"
              title="Opções do Jogo"
            >
              <Menu size={16} />
            </button>
          </div>
        </div>
      </header>
    </div>
  );
};
