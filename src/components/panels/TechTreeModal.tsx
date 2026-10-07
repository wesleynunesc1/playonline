import React, { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { TECHNOLOGIES } from '../../data/technologies';
import { TechBranch, TechNode } from '../../types/game';
import { formatMoney } from '../../utils/formatters';
import { Cpu, DollarSign, Shield, Eye, CheckCircle2, Lock, ArrowRight } from 'lucide-react';

export const TechTreeModal: React.FC = () => {
  const activeModal = useGameStore((state) => state.activeModal);
  const closeModal = useGameStore((state) => state.closeModal);
  const money = useGameStore((state) => state.money);
  const unlockedTechIds = useGameStore((state) => state.unlockedTechIds);
  const unlockTech = useGameStore((state) => state.unlockTech);

  const [activeBranch, setActiveBranch] = useState<TechBranch>('economy');

  if (activeModal !== 'tech_tree') return null;

  const branchTechs = TECHNOLOGIES.filter((t) => t.branch === activeBranch);

  const canUnlock = (tech: TechNode) => {
    if (unlockedTechIds.includes(tech.id)) return false;
    if (tech.requiredTechId && !unlockedTechIds.includes(tech.requiredTechId)) return false;
    return money >= tech.cost;
  };

  const isLockedByPrereq = (tech: TechNode) => {
    return tech.requiredTechId && !unlockedTechIds.includes(tech.requiredTechId);
  };

  return (
    <Modal
      isOpen={activeModal === 'tech_tree'}
      onClose={closeModal}
      maxWidth="lg"
      title={
        <span className="flex items-center gap-2 text-cyan-400">
          <Cpu size={22} /> Centro de Pesquisa & Doutrinas Nacionais
        </span>
      }
      subtitle="Desenvolva inovações estratégicas para expandir seu poderio global"
    >
      <div className="space-y-4">
        {/* Abas dos Ramos Tecnológicos */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveBranch('economy')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeBranch === 'economy'
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign size={14} /> Economia
          </button>
          <button
            onClick={() => setActiveBranch('military')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeBranch === 'military'
                ? 'bg-blue-950/80 text-blue-300 border border-blue-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield size={14} /> Militar
          </button>
          <button
            onClick={() => setActiveBranch('intelligence')}
            className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeBranch === 'intelligence'
                ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye size={14} /> Inteligência
          </button>
        </div>

        {/* Lista de Tecnologias do Ramo */}
        <div className="space-y-3 max-h-[58vh] overflow-y-auto pr-1">
          {branchTechs.map((tech) => {
            const isUnlocked = unlockedTechIds.includes(tech.id);
            const lockedByPrereq = isLockedByPrereq(tech);
            const affordable = money >= tech.cost;
            const prereqTech = tech.requiredTechId ? TECHNOLOGIES.find((t) => t.id === tech.requiredTechId) : null;

            return (
              <div
                key={tech.id}
                className={`p-4 rounded-xl border transition-all ${
                  isUnlocked
                    ? 'bg-slate-900/40 border-emerald-500/40 shadow-sm'
                    : lockedByPrereq
                    ? 'bg-slate-950/40 border-slate-800 opacity-60'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-100">{tech.name}</h4>
                      {isUnlocked && (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={11} /> ATIVA
                        </span>
                      )}
                      {lockedByPrereq && (
                        <span className="flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
                          <Lock size={11} /> REQUER ANTERIOR
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{tech.description}</p>

                    {prereqTech && !isUnlocked && (
                      <div className="text-[11px] text-amber-400/90 font-mono flex items-center gap-1 pt-0.5">
                        <ArrowRight size={11} /> Requer tecnologia: {prereqTech.name}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-2">
                    {!isUnlocked ? (
                      <>
                        <span className={`text-xs font-mono font-bold ${affordable ? 'text-amber-300' : 'text-rose-400'}`}>
                          {formatMoney(tech.cost)}
                        </span>
                        <Button
                          size="sm"
                          variant={canUnlock(tech) ? 'primary' : 'secondary'}
                          disabled={!canUnlock(tech)}
                          onClick={() => unlockTech(tech.id)}
                        >
                          Pesquisar
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs font-mono text-emerald-400 font-bold">OPERACIONAL</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
