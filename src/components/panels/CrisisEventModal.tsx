import React from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { AlertTriangle, Radio, CheckCircle, ChevronRight } from 'lucide-react';

export const CrisisEventModal: React.FC = () => {
  const activeModal = useGameStore((state) => state.activeModal);
  const activeCrisisEvent = useGameStore((state) => state.activeCrisisEvent);
  const resolveCrisisEvent = useGameStore((state) => state.resolveCrisisEvent);
  const money = useGameStore((state) => state.money);

  if (activeModal !== 'crisis_event' || !activeCrisisEvent) {
    return null;
  }

  return (
    <Modal
      isOpen={activeModal === 'crisis_event'}
      onClose={() => {}}
      maxWidth="md"
      showCloseButton={false}
      title={
        <span className="flex items-center gap-2 text-rose-400 font-black tracking-wide uppercase">
          <AlertTriangle className="animate-bounce" size={22} /> {activeCrisisEvent.title}
        </span>
      }
      subtitle={activeCrisisEvent.subtitle}
    >
      <div className="space-y-4">
        {/* Banner de Transmissão Tática */}
        <div className="bg-slate-950/90 border border-rose-500/30 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-rose-400">
            <Radio size={14} className="animate-pulse" /> COMUNICADO DE SEGURANÇA NACIONAL
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
            {activeCrisisEvent.description}
          </p>
        </div>

        {/* Opções de Resposta do Gabinete */}
        <div className="space-y-2.5 pt-1">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Selecione a Diretriz Imperial:
          </span>

          {activeCrisisEvent.choices.map((choice) => {
            const hasFunds = !choice.costMoney || money >= choice.costMoney;

            return (
              <div
                key={choice.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-blue-500/60 rounded-xl p-3.5 space-y-2 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h5 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                      <CheckCircle size={15} className="text-blue-400 shrink-0" />
                      {choice.label}
                    </h5>
                    <p className="text-xs text-slate-300 leading-relaxed">{choice.description}</p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant={hasFunds ? 'primary' : 'secondary'}
                    disabled={!hasFunds}
                    onClick={() => resolveCrisisEvent(choice.id)}
                    icon={<ChevronRight size={14} />}
                  >
                    {hasFunds ? 'Executar Diretriz' : 'Recursos Insuficientes'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
