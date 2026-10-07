import React from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { INITIAL_COUNTRY_IDS, COUNTRIES_DATA } from '../../data/countries';
import { Bug, DollarSign, Shield, Clock, Flag, RotateCcw } from 'lucide-react';

export const DebugPanel: React.FC = () => {
  const activeModal = useGameStore((state) => state.activeModal);
  const closeModal = useGameStore((state) => state.closeModal);
  const debugAddMoney = useGameStore((state) => state.debugAddMoney);
  const debugAddMilitary = useGameStore((state) => state.debugAddMilitary);
  const debugConquerCountry = useGameStore((state) => state.debugConquerCountry);
  const debugAdvanceTime = useGameStore((state) => state.debugAdvanceTime);
  const restartGame = useGameStore((state) => state.restartGame);
  const countries = useGameStore((state) => state.countries);

  if (activeModal !== 'debug') return null;

  return (
    <Modal
      isOpen={activeModal === 'debug'}
      onClose={closeModal}
      maxWidth="md"
      title={
        <span className="flex items-center gap-2 text-amber-400">
          <Bug size={20} /> Painel de Testes & Debug
        </span>
      }
      subtitle="Ferramentas exclusivas para validação e testes"
    >
      <div className="space-y-4 text-xs">
        {/* Adicionar Recursos */}
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2">
          <span className="font-bold text-slate-300 block flex items-center gap-1.5">
            <DollarSign size={14} className="text-amber-400" /> Injeção de Capital
          </span>
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" variant="secondary" onClick={() => debugAddMoney(1000)}>
              +$ 1.000
            </Button>
            <Button size="sm" variant="secondary" onClick={() => debugAddMoney(10000)}>
              +$ 10.000
            </Button>
            <Button size="sm" variant="secondary" onClick={() => debugAddMoney(100000)}>
              +$ 100.000
            </Button>
          </div>
        </div>

        {/* Adicionar Força Militar */}
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2">
          <span className="font-bold text-slate-300 block flex items-center gap-1.5">
            <Shield size={14} className="text-blue-400" /> Reforço Militar Imediato
          </span>
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" variant="secondary" onClick={() => debugAddMilitary(50)}>
              +50 Tropas
            </Button>
            <Button size="sm" variant="secondary" onClick={() => debugAddMilitary(250)}>
              +250 Tropas
            </Button>
            <Button size="sm" variant="secondary" onClick={() => debugAddMilitary(1000)}>
              +1.000 Tropas
            </Button>
          </div>
        </div>

        {/* Avançar Tempo */}
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2">
          <span className="font-bold text-slate-300 block flex items-center gap-1.5">
            <Clock size={14} className="text-emerald-400" /> Simulação de Tempo (Renda)
          </span>
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" variant="secondary" onClick={() => debugAdvanceTime(60)}>
              +1 Minuto
            </Button>
            <Button size="sm" variant="secondary" onClick={() => debugAdvanceTime(600)}>
              +10 Minutos
            </Button>
            <Button size="sm" variant="secondary" onClick={() => debugAdvanceTime(3600)}>
              +1 Hora
            </Button>
          </div>
        </div>

        {/* Conquistar Territórios Instantaneamente */}
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2">
          <span className="font-bold text-slate-300 block flex items-center gap-1.5">
            <Flag size={14} className="text-indigo-400" /> Anexação Territorial Direta
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto pr-1">
            {INITIAL_COUNTRY_IDS.map((id) => {
              const country = COUNTRIES_DATA[id];
              const isOwned = countries[id]?.owner === 'player';
              return (
                <button
                  key={id}
                  disabled={isOwned}
                  onClick={() => debugConquerCountry(id)}
                  className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium flex items-center justify-between transition-colors ${
                    isOwned
                      ? 'bg-blue-950/50 border-blue-500/40 text-blue-300 cursor-default'
                      : 'bg-slate-900 border-slate-700 hover:border-slate-500 text-slate-300'
                  }`}
                >
                  <span>{country.flag} {country.name}</span>
                  {isOwned && <span className="text-[9px]">✔</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Reset Geral */}
        <div className="pt-2 border-t border-slate-800">
          <Button
            size="sm"
            variant="danger"
            fullWidth
            onClick={() => {
              restartGame();
              closeModal();
            }}
            icon={<RotateCcw size={14} />}
          >
            Resetar Save e Voltar ao Início
          </Button>
        </div>
      </div>
    </Modal>
  );
};
