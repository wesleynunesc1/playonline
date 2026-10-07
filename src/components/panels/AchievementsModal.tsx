import React from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Modal } from '../common/Modal';
import { ACHIEVEMENTS } from '../../data/achievements';
import { formatMoney } from '../../utils/formatters';
import { Trophy, CheckCircle2, Lock, Award } from 'lucide-react';

export const AchievementsModal: React.FC = () => {
  const activeModal = useGameStore((state) => state.activeModal);
  const closeModal = useGameStore((state) => state.closeModal);
  const unlockedAchievementIds = useGameStore((state) => state.unlockedAchievementIds);

  if (activeModal !== 'achievements') return null;

  const totalUnlocked = unlockedAchievementIds.length;
  const progressPercent = Math.round((totalUnlocked / ACHIEVEMENTS.length) * 100);

  return (
    <Modal
      isOpen={activeModal === 'achievements'}
      onClose={closeModal}
      maxWidth="md"
      title={
        <span className="flex items-center gap-2 text-amber-400">
          <Trophy size={22} /> Insígnias & Conquistas Imperiais
        </span>
      }
      subtitle="Conquiste marcos históricos para consagrar o domínio do seu império"
    >
      <div className="space-y-4">
        {/* Barra Geral de Progresso Imperial */}
        <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Award size={15} className="text-amber-400" /> Progresso da Campanha
            </span>
            <span className="font-mono text-amber-300 font-bold">
              {totalUnlocked} / {ACHIEVEMENTS.length} ({progressPercent}%)
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className="h-full bg-amber-500 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Lista de Conquistas */}
        <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
          {ACHIEVEMENTS.map((ach) => {
            const isUnlocked = unlockedAchievementIds.includes(ach.id);

            return (
              <div
                key={ach.id}
                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                  isUnlocked
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : 'bg-slate-950/50 border-slate-800/80 opacity-75'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                      isUnlocked
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    {isUnlocked ? <Trophy size={20} /> : <Lock size={18} />}
                  </div>

                  <div className="space-y-0.5">
                    <h5
                      className={`text-sm font-bold ${
                        isUnlocked ? 'text-amber-200' : 'text-slate-300'
                      }`}
                    >
                      {ach.title}
                    </h5>
                    <p className="text-xs text-slate-400 leading-snug">{ach.description}</p>
                    <div className="text-[11px] font-mono text-emerald-400">
                      Recompensa: +{formatMoney(ach.rewardMoney)} {ach.rewardMilitary ? `• ⚔ +${ach.rewardMilitary}` : ''}
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  {isUnlocked ? (
                    <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-full">
                      <CheckCircle2 size={12} /> CONQUISTADA
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-400 uppercase">BLOQUEADA</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
