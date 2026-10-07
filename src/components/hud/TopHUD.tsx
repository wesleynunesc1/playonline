import React from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { formatMoney, formatNumber } from '../../utils/formatters';
import { Menu, Shield, Plus } from 'lucide-react';
import { COUNTRIES_DATA } from '../../data/countries';
import { calculateRecruitCost } from '../../utils/formulas';

export const TopHUD: React.FC = () => {
  const money = useGameStore((state) => state.money);
  const militaryPower = useGameStore((state) => state.militaryPower);
  const playerCountryId = useGameStore((state) => state.playerCountryId);
  const getTotalIncomePerSecond = useGameStore((state) => state.getTotalIncomePerSecond);
  const getConqueredTerritoriesCount = useGameStore((state) => state.getConqueredTerritoriesCount);
  const openModal = useGameStore((state) => state.openModal);
  const recruitMilitary = useGameStore((state) => state.recruitMilitary);

  const income = getTotalIncomePerSecond();
  const territories = getConqueredTerritoriesCount();
  const playerCountry = playerCountryId ? COUNTRIES_DATA[playerCountryId] : null;

  const recruitCost = calculateRecruitCost(militaryPower, 1);
  const canRecruit = money >= recruitCost;

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800/80 px-2 sm:px-4 py-2 select-none">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        {/* Jogador / Império & Territórios */}
        <div className="flex items-center gap-2">
          {playerCountry && (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl">
              <span className="text-xl sm:text-2xl leading-none">{playerCountry.flag}</span>
              <div className="hidden sm:block">
                <span className="text-xs font-bold text-slate-200 block leading-tight">{playerCountry.name}</span>
                <span className="text-[10px] text-blue-400 font-medium">Soberano</span>
              </div>
            </div>
          )}

          {/* Territórios */}
          <div
            className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800/90 px-2.5 py-1.5 rounded-xl"
            title="Territórios sob seu comando"
          >
            <span className="text-base sm:text-lg">🌎</span>
            <div>
              <span className="text-xs sm:text-sm font-extrabold text-slate-100">{territories}</span>
              <span className="text-[10px] text-slate-400 hidden md:inline ml-1">/ 10 territórios</span>
            </div>
          </div>
        </div>

        {/* Recursos Principais (Dinheiro & Força Militar) */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Dinheiro & Renda */}
          <div className="flex items-center gap-2 bg-slate-900/95 border border-amber-500/30 px-2.5 sm:px-3 py-1.5 rounded-xl shadow-sm">
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
          <div className="flex items-center gap-2 bg-slate-900/95 border border-blue-500/30 px-2.5 sm:px-3 py-1.5 rounded-xl shadow-sm">
            <Shield className="w-4 h-4 text-blue-400" />
            <div className="flex flex-col text-left">
              <span className="text-xs sm:text-sm font-bold text-blue-300 font-mono leading-tight">
                ⚔ {formatNumber(militaryPower)}
              </span>
              <span className="text-[10px] text-slate-400 leading-tight hidden xs:inline">Tropas</span>
            </div>

            {/* Ação rápida de recrutamento */}
            <button
              onClick={() => recruitMilitary(1)}
              disabled={!canRecruit}
              title={`Recrutar +10 tropas (${formatMoney(recruitCost)})`}
              className={`ml-1 flex items-center justify-center w-6 h-6 rounded-lg transition-all ${
                canRecruit
                  ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Menu / Pausa */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => openModal('pause_menu')}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 px-2.5 py-2 rounded-xl transition-colors"
            title="Opções do Jogo"
          >
            <Menu size={18} />
            <span className="text-xs font-medium hidden md:inline">Menu</span>
          </button>
        </div>
      </div>
    </header>
  );
};
