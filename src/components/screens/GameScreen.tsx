import React from 'react';
import { useGameLoop } from '../../hooks/useGameLoop';
import { TopHUD } from '../hud/TopHUD';
import { InteractiveMap } from '../map/InteractiveMap';
import { CountryDetailModal } from '../panels/CountryDetailModal';
import { BattleModal } from '../panels/BattleModal';
import { OfflineProgressModal } from '../panels/OfflineProgressModal';
import { PauseMenuModal } from '../panels/PauseMenuModal';
import { DebugPanel } from '../panels/DebugPanel';
import { NotificationToast } from '../hud/NotificationToast';
import { useGameStore } from '../../stores/useGameStore';
import { Shield, TrendingUp, Info } from 'lucide-react';

export const GameScreen: React.FC = () => {
  // Ativa o loop central do jogo e autosave
  useGameLoop();

  const selectedCountryId = useGameStore((state) => state.selectedCountryId);
  const playerCountryId = useGameStore((state) => state.playerCountryId);
  const selectCountry = useGameStore((state) => state.selectCountry);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#070a12] text-slate-100 overflow-hidden select-none">
      {/* HUD Superior com recursos e dados em tempo real */}
      <TopHUD />

      {/* Notificações Flutuantes */}
      <NotificationToast />

      {/* Mapa Central Interativo */}
      <main className="flex-1 w-full h-full pt-14 pb-14 sm:pb-0 relative overflow-hidden">
        <InteractiveMap />
      </main>

      {/* Barra de Ação Rápida Inferior (Mobile Friendly) */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 bg-slate-950/90 backdrop-blur-md border-t border-slate-800/80 px-4 py-2 sm:hidden flex items-center justify-around">
        <button
          onClick={() => playerCountryId && selectCountry(playerCountryId)}
          className="flex flex-col items-center gap-1 text-[11px] text-slate-300 active:scale-95 transition-transform"
        >
          <TrendingUp size={18} className="text-emerald-400" />
          <span>Sua Economia</span>
        </button>

        <button
          onClick={() => {
            const state = useGameStore.getState();
            state.recruitMilitary(1);
          }}
          className="flex flex-col items-center gap-1 text-[11px] text-slate-300 active:scale-95 transition-transform"
        >
          <Shield size={18} className="text-blue-400" />
          <span>Recrutar +10</span>
        </button>

        <button
          onClick={() => {
            if (selectedCountryId) {
              selectCountry(selectedCountryId);
            } else if (playerCountryId) {
              selectCountry(playerCountryId);
            }
          }}
          className="flex flex-col items-center gap-1 text-[11px] text-slate-300 active:scale-95 transition-transform"
        >
          <Info size={18} className="text-amber-400" />
          <span>Detalhes</span>
        </button>
      </footer>

      {/* Modais do Jogo */}
      <CountryDetailModal />
      <BattleModal />
      <OfflineProgressModal />
      <PauseMenuModal />
      <DebugPanel />
    </div>
  );
};
