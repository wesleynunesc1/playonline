import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Crown } from 'lucide-react';
import { useGameStore } from '../../stores/useGameStore';
import { TOTAL_COUNTRIES } from '../../data/countries';
import { formatDuration } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

export const VictoryModal: React.FC = () => {
  const isOpen = useGameStore((s) => s.activeModal === 'victory');
  const closeModal = useGameStore((s) => s.closeModal);
  const restartGame = useGameStore((s) => s.restartGame);
  const playTime = useGameStore((s) => s.totalPlayTimeSeconds);

  useEffect(() => {
    if (isOpen) confetti({ particleCount: 180, spread: 110, origin: { y: 0.6 } });
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={closeModal} maxWidth="sm" showCloseButton={false}>
      <div className="text-center space-y-4 py-2">
        <Crown size={56} className="mx-auto text-amber-400 animate-bounce" />
        <h2 className="text-2xl font-black text-amber-300">O MUNDO É SEU!</h2>
        <p className="text-sm text-slate-300">
          Você unificou os {TOTAL_COUNTRIES} territórios em {formatDuration(Math.floor(playTime))} de campanha.
        </p>
        <Button variant="gold" size="lg" fullWidth onClick={restartGame}>
          Nova Campanha
        </Button>
        <Button variant="outline" fullWidth onClick={closeModal}>
          Continuar Reinando
        </Button>
      </div>
    </Modal>
  );
};
