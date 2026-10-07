import React, { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Play, Save, RotateCcw, Home, Volume2, VolumeX, AlertTriangle, Bug } from 'lucide-react';

export const PauseMenuModal: React.FC = () => {
  const activeModal = useGameStore((state) => state.activeModal);
  const closeModal = useGameStore((state) => state.closeModal);
  const saveGame = useGameStore((state) => state.saveGame);
  const restartGame = useGameStore((state) => state.restartGame);
  const returnToHome = useGameStore((state) => state.returnToHome);
  const soundEnabled = useGameStore((state) => state.soundEnabled);
  const toggleSound = useGameStore((state) => state.toggleSound);
  const showNotification = useGameStore((state) => state.showNotification);
  const openModal = useGameStore((state) => state.openModal);

  const [confirmRestart, setConfirmRestart] = useState(false);

  if (activeModal !== 'pause_menu') {
    return null;
  }

  const handleManualSave = () => {
    saveGame();
    showNotification('Progresso da partida salvo com sucesso!', 'success');
  };

  const handleConfirmRestart = () => {
    setConfirmRestart(false);
    restartGame();
    showNotification('Partida reiniciada. Escolha sua nova nação.', 'info');
  };

  return (
    <Modal
      isOpen={activeModal === 'pause_menu'}
      onClose={closeModal}
      maxWidth="sm"
      title="Centro de Operações"
      subtitle="Gerenciamento do Jogo"
    >
      <div className="space-y-3">
        {confirmRestart ? (
          <div className="bg-rose-950/40 border border-rose-500/40 p-4 rounded-xl text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-rose-400 font-bold text-sm">
              <AlertTriangle size={18} /> Confirmar Reinício?
            </div>
            <p className="text-xs text-slate-300">
              Isso apagará o progresso atual da sua nação e permitirá iniciar do zero com um novo país.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmRestart(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmRestart}
              >
                Sim, Reiniciar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button
              variant="primary"
              fullWidth
              onClick={closeModal}
              icon={<Play size={18} />}
            >
              Continuar Partida
            </Button>

            <Button
              variant="secondary"
              fullWidth
              onClick={handleManualSave}
              icon={<Save size={18} />}
            >
              Salvar Partida
            </Button>

            <Button
              variant="secondary"
              fullWidth
              onClick={toggleSound}
              icon={soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            >
              Som: {soundEnabled ? 'Ativado' : 'Desativado'}
            </Button>

            <Button
              variant="outline"
              fullWidth
              onClick={returnToHome}
              icon={<Home size={18} />}
            >
              Voltar ao Menu Principal
            </Button>

            <Button
              variant="danger"
              fullWidth
              onClick={() => setConfirmRestart(true)}
              icon={<RotateCcw size={18} />}
            >
              Reiniciar Partida
            </Button>

            {/* Acesso rápido ao Painel de Testes/Debug */}
            <div className="pt-2 border-t border-slate-800">
              <button
                onClick={() => openModal('debug')}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Bug size={14} /> Painel de Testes / Sandbox
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
