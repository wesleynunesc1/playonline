import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Button } from '../common/Button';
import { sound } from '../../utils/audio';
import { Globe } from '../common/Globe';
import { Modal } from '../common/Modal';
import { Play, Gamepad2, RotateCcw, Settings, Globe2, Volume2, VolumeX, ShieldCheck } from 'lucide-react';

export const HomeScreen: React.FC = () => {
  const setScreen = useGameStore((state) => state.setScreen);
  const hasSavedGame = useGameStore((state) => state.hasSavedGame);
  const continueSavedGame = useGameStore((state) => state.continueSavedGame);
  const initFromStorage = useGameStore((state) => state.initFromStorage);
  const soundEnabled = useGameStore((state) => state.soundEnabled);
  const toggleSound = useGameStore((state) => state.toggleSound);

  const [showConfirmNewGame, setShowConfirmNewGame] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    initFromStorage();
  }, [initFromStorage]);

  const handleNewGameClick = () => {
    if (hasSavedGame) {
      setShowConfirmNewGame(true);
    } else {
      setScreen('country_select');
    }
  };

  const handleConfirmNewGame = () => {
    setShowConfirmNewGame(false);
    setScreen('country_select');
  };

  const handleContinue = () => {
    const success = continueSavedGame();
    if (!success) {
      setScreen('country_select');
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-6 sm:p-10 overflow-x-hidden overflow-y-auto bg-[#05070f] select-none">
      <Globe />

      {/* Topo / Status */}
      <div className="relative z-10 w-full flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono tracking-wider">PLAY ONLINE</span>
        </div>
        <button
          onClick={() => setShowSettingsModal(true)}
          className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title="Configurações"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Centro / Título e Subtítulo */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-lg my-auto space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-950/70 border border-blue-500/30 text-blue-400 text-xs font-semibold tracking-wide uppercase shadow-inner">
            <Globe2 size={15} /> Estratégia Geopolítica
          </div>

          <h1 className="text-4xl sm:text-6xl font-black title-glow text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-slate-400 tracking-tight leading-none">
            WORLD EMPIRE
          </h1>

          <p className="text-base sm:text-lg font-medium text-slate-300 tracking-wide">
            Construa. Domine. Conquiste.
          </p>
        </div>

        {/* Menu de Ações */}
        <div className="w-full max-w-xs space-y-3">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleNewGameClick}
            icon={<Play size={20} />}
          >
            NOVO JOGO
          </Button>

          <Button
            variant="secondary"
            size="lg"
            fullWidth
            disabled={!hasSavedGame}
            onClick={handleContinue}
            icon={<RotateCcw size={20} />}
          >
            CONTINUAR
          </Button>

          <Button
            variant="outline"
            size="md"
            fullWidth
            onClick={() => setShowSettingsModal(true)}
            icon={<Settings size={18} />}
          >
            CONFIGURAÇÕES
          </Button>
        </div>

        {/* Cobra */}
        <button
          onClick={() => {
            sound.playClick();
            setScreen('snake');
          }}
          className="shine w-full max-w-xs flex items-center gap-4 p-4 rounded-2xl text-left bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-500/50 active:scale-95 transition-all"
        >
          <span className="text-3xl">🐍</span>
          <span className="flex-1">
            <span className="block font-black text-emerald-300">JOGO DA COBRA</span>
            <span className="block text-xs text-slate-300">Partida rápida • bata seu recorde</span>
          </span>
          <Gamepad2 size={22} className="text-emerald-400" />
        </button>
      </div>

      {/* Rodapé Informativo */}
      <div className="relative z-10 text-center text-xs text-slate-400">
        <p>Grátis • Sem cadastro • Progresso salvo no navegador</p>
      </div>

      {/* Modal de Confirmação para Novo Jogo caso já exista save */}
      <Modal
        isOpen={showConfirmNewGame}
        onClose={() => setShowConfirmNewGame(false)}
        maxWidth="sm"
        title="Iniciar Novo Jogo?"
      >
        <div className="space-y-4 text-center py-1">
          <p className="text-xs sm:text-sm text-slate-300">
            Você já possui uma partida salva. Deseja iniciar uma nova partida? O progresso anterior será substituído.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setShowConfirmNewGame(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleConfirmNewGame}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Configurações */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        maxWidth="sm"
        title="Configurações do Jogo"
      >
        <div className="space-y-4 py-1">
          <div className="flex items-center justify-between p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-2.5">
              {soundEnabled ? <Volume2 className="text-blue-400" size={20} /> : <VolumeX className="text-slate-500" size={20} />}
              <div>
                <span className="text-sm font-semibold text-slate-200 block">Efeitos Sonoros</span>
                <span className="text-xs text-slate-400">Sons táteis da interface e combates</span>
              </div>
            </div>
            <Button
              size="sm"
              variant={soundEnabled ? 'primary' : 'secondary'}
              onClick={toggleSound}
            >
              {soundEnabled ? 'Ligado' : 'Mudo'}
            </Button>
          </div>

          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5 text-xs text-slate-300">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span>Armazenamento Local</span>
            </div>
            <p className="text-slate-400">
              Seu progresso é gravado automaticamente no seu navegador. Quando você voltar, receberá seus ganhos gerados no período offline!
            </p>
          </div>

          <Button
            variant="outline"
            size="md"
            fullWidth
            onClick={() => setShowSettingsModal(false)}
          >
            Fechar
          </Button>
        </div>
      </Modal>
    </div>
  );
};
