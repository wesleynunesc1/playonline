import React, { useEffect } from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { COUNTRIES_DATA } from '../../data/countries';
import { formatNumber } from '../../utils/formatters';
import confetti from 'canvas-confetti';
import { Trophy, Skull, Swords, ArrowRight } from 'lucide-react';

export const BattleModal: React.FC = () => {
  const activeModal = useGameStore((state) => state.activeModal);
  const lastBattleResult = useGameStore((state) => state.lastBattleResult);
  const closeModal = useGameStore((state) => state.closeModal);
  const militaryPower = useGameStore((state) => state.militaryPower);

  useEffect(() => {
    if (activeModal === 'battle_result' && lastBattleResult?.won) {
      // Disparar confetes de comemoração
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#3b82f6', '#10b981', '#f59e0b', '#ffffff'],
        });
      } catch {
        // Ignora caso ambiente não suporte canvas
      }
    }
  }, [activeModal, lastBattleResult]);

  if (activeModal !== 'battle_result' || !lastBattleResult) {
    return null;
  }

  const targetCountry = COUNTRIES_DATA[lastBattleResult.targetCountryId];
  if (!targetCountry) return null;

  return (
    <Modal
      isOpen={activeModal === 'battle_result'}
      onClose={closeModal}
      maxWidth="sm"
      showCloseButton={false}
    >
      <div className="text-center py-2 space-y-4">
        {/* Ícone e Título da Batalha */}
        {lastBattleResult.won ? (
          <div className="space-y-2 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Trophy size={36} />
            </div>
            <h2 className="text-xl font-extrabold text-emerald-400 tracking-wide uppercase">
              Território Conquistado!
            </h2>
            <p className="text-sm text-slate-300">
              <span className="text-lg mr-1">{targetCountry.flag}</span>
              <strong>{targetCountry.name}</strong> agora faz parte do seu império.
            </p>
          </div>
        ) : (
          <div className="space-y-2 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Skull size={36} />
            </div>
            <h2 className="text-xl font-extrabold text-rose-400 tracking-wide uppercase">
              Invasão Fracassou!
            </h2>
            <p className="text-sm text-slate-300">
              Suas tropas foram rechaçadas pelas defesas de{' '}
              <span className="font-semibold text-slate-100">{targetCountry.name}</span>.
            </p>
          </div>
        )}

        {/* Relatório de Combate */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs text-left">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80 font-semibold text-slate-400">
            <span className="flex items-center gap-1.5">
              <Swords size={14} /> Relatório de Confronto
            </span>
            <span className={lastBattleResult.won ? 'text-emerald-400' : 'text-rose-400'}>
              {lastBattleResult.won ? 'VITÓRIA' : 'DERROTA'}
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span>Ataque Efetivo de Suas Forças:</span>
            <span className="font-mono font-bold text-blue-400">{lastBattleResult.playerAttackRoll}</span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span>Resistência Defensiva Inimiga:</span>
            <span className="font-mono font-bold text-rose-400">{lastBattleResult.enemyDefenseRoll}</span>
          </div>

          <div className="flex items-center justify-between text-slate-300">
            <span>Baixas Sofridas:</span>
            <span className="font-mono font-bold text-amber-400">-{formatNumber(lastBattleResult.playerCasualties)} tropas</span>
          </div>

          {lastBattleResult.won && (
            <div className="flex items-center justify-between text-emerald-300 font-semibold pt-1 border-t border-slate-800">
              <span>Renda Incorporada ao Tesouro:</span>
              <span className="font-mono text-sm">+${lastBattleResult.incomeGained}/s</span>
            </div>
          )}

          <div className="flex items-center justify-between text-slate-400 pt-1 text-[11px]">
            <span>Força Militar Restante:</span>
            <span className="font-mono text-slate-200">⚔ {formatNumber(militaryPower)}</span>
          </div>
        </div>

        {/* Botão de Fechamento */}
        <Button
          variant={lastBattleResult.won ? 'primary' : 'secondary'}
          size="lg"
          fullWidth
          onClick={closeModal}
          icon={<ArrowRight size={18} />}
        >
          {lastBattleResult.won ? 'Continuar Expansão' : 'Reagrupar Tropas'}
        </Button>
      </div>
    </Modal>
  );
};
