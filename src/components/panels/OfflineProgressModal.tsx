import React from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { formatMoney } from '../../utils/formatters';
import { Coins, Clock } from 'lucide-react';

export const OfflineProgressModal: React.FC = () => {
  const activeModal = useGameStore((state) => state.activeModal);
  const offlineProgress = useGameStore((state) => state.offlineProgress);
  const collectOfflineProgress = useGameStore((state) => state.collectOfflineProgress);

  if (activeModal !== 'offline_progress' || !offlineProgress) {
    return null;
  }

  return (
    <Modal
      isOpen={activeModal === 'offline_progress'}
      onClose={collectOfflineProgress}
      maxWidth="sm"
      showCloseButton={false}
    >
      <div className="text-center py-2 space-y-5 animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
          <Coins size={36} />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-extrabold text-slate-100 tracking-wide uppercase">
            Bem-vindo de Volta!
          </h2>
          <p className="text-xs text-slate-400">
            Seus territórios continuaram operando enquanto você esteve ausente.
          </p>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <Clock size={14} className="text-slate-400" /> Tempo ausente:
            </span>
            <span className="font-semibold text-slate-200 font-mono">
              {offlineProgress.formattedDuration}
            </span>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex flex-col items-center justify-center">
            <span className="text-[11px] text-amber-400/90 font-medium uppercase tracking-wider">
              Seu Império Produziu
            </span>
            <span className="text-2xl font-black text-amber-400 font-mono mt-0.5">
              +{formatMoney(offlineProgress.moneyEarned)}
            </span>
          </div>
        </div>

        <Button
          variant="gold"
          size="lg"
          fullWidth
          onClick={collectOfflineProgress}
          icon={<Coins size={18} />}
        >
          COLETAR
        </Button>
      </div>
    </Modal>
  );
};
