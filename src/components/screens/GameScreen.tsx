import React from 'react';
import { useGameLoop } from '../../hooks/useGameLoop';
import { TopHUD } from '../hud/TopHUD';
import { InteractiveMap } from '../map/InteractiveMap';
import { CountryDetailModal } from '../panels/CountryDetailModal';
import { BattleModal } from '../panels/BattleModal';
import { OfflineProgressModal } from '../panels/OfflineProgressModal';
import { PauseMenuModal } from '../panels/PauseMenuModal';
import { DebugPanel } from '../panels/DebugPanel';
import { TechTreeModal } from '../panels/TechTreeModal';
import { CrisisEventModal } from '../panels/CrisisEventModal';
import { AchievementsModal } from '../panels/AchievementsModal';
import { VictoryModal } from '../panels/VictoryModal';
import { ThreatBanner } from '../hud/ThreatBanner';
import { TimeSpeedControls } from '../hud/TimeSpeedControls';
import { NotificationToast } from '../hud/NotificationToast';
import { useGameStore } from '../../stores/useGameStore';
import { Shield, TrendingUp, Cpu, Trophy, Swords } from 'lucide-react';

export const GameScreen: React.FC = () => {
  // Ativa o loop central do jogo e autosave
  useGameLoop();

  const playerCountryId = useGameStore((state) => state.playerCountryId);
  const selectCountry = useGameStore((state) => state.selectCountry);
  const openModal = useGameStore((state) => state.openModal);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#060911] text-slate-100 overflow-hidden select-none">
      {/* HUD Superior com recursos e dados em tempo real */}
      <TopHUD />

      {/* Notificações Flutuantes */}
      <NotificationToast />

      {/* Mapa Central Interativo */}
      <main className="flex-1 min-h-0 w-full relative overflow-hidden">
        <InteractiveMap />
        <ThreatBanner />
        <div className="absolute left-3 bottom-3 sm:bottom-16 z-20 md:hidden">
          <TimeSpeedControls />
        </div>
      </main>

      {/* Barra de Ação Rápida Inferior (Mobile Friendly com Safe Area) */}
      <footer className="relative z-30 shrink-0 bg-slate-950/95 border-t border-slate-800/80 px-2 py-1.5 sm:hidden flex items-center justify-around">
        <button
          onClick={() => playerCountryId && selectCountry(playerCountryId)}
          className="flex flex-col items-center gap-0.5 text-[10px] text-slate-300 active:scale-95 transition-transform"
        >
          <TrendingUp size={16} className="text-emerald-400" />
          <span>Economia</span>
        </button>

        <button
          onClick={() => {
            const state = useGameStore.getState();
            state.recruitMilitary(1);
          }}
          className="flex flex-col items-center gap-0.5 text-[10px] text-slate-300 active:scale-95 transition-transform"
        >
          <Shield size={16} className="text-blue-400" />
          <span>Recrutar</span>
        </button>

        <button
          onClick={() => openModal('tech_tree')}
          className="flex flex-col items-center gap-0.5 text-[10px] text-cyan-300 active:scale-95 transition-transform"
        >
          <Cpu size={16} className="text-cyan-400" />
          <span>P&D</span>
        </button>

        <button
          onClick={() => openModal('achievements')}
          className="flex flex-col items-center gap-0.5 text-[10px] text-amber-300 active:scale-95 transition-transform"
        >
          <Trophy size={16} className="text-amber-400" />
          <span>Conquistas</span>
        </button>

        <button
          onClick={() => {
            const weakest = Object.values(useGameStore.getState().countries)
              .filter((c) => c.owner !== 'player')
              .sort((a, b) => a.defense - b.defense)[0];
            if (weakest) selectCountry(weakest.id);
          }}
          className="flex flex-col items-center gap-0.5 text-[10px] text-rose-300 active:scale-95 transition-transform"
        >
          <Swords size={16} className="text-rose-400" />
          <span>Alvo</span>
        </button>
      </footer>

      {/* Modais do Jogo */}
      <CountryDetailModal />
      <BattleModal />
      <OfflineProgressModal />
      <PauseMenuModal />
      <DebugPanel />
      <TechTreeModal />
      <CrisisEventModal />
      <AchievementsModal />
      <VictoryModal />
    </div>
  );
};
