import React from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { COUNTRIES_DATA } from '../../data/countries';
import {
  calculateEconomyUpgradeCost,
  calculateIncomeForLevel,
  calculateWinChance,
  calculateRecruitCost,
} from '../../utils/formulas';
import { formatMoney, formatNumber } from '../../utils/formatters';
import { TrendingUp, ShieldAlert, Swords, Plus, DollarSign, Award } from 'lucide-react';

export const CountryDetailModal: React.FC = () => {
  const activeModal = useGameStore((state) => state.activeModal);
  const selectedCountryId = useGameStore((state) => state.selectedCountryId);
  const countries = useGameStore((state) => state.countries);
  const playerCountryId = useGameStore((state) => state.playerCountryId);
  const money = useGameStore((state) => state.money);
  const militaryPower = useGameStore((state) => state.militaryPower);
  const closeModal = useGameStore((state) => state.closeModal);
  const upgradeCountryEconomy = useGameStore((state) => state.upgradeCountryEconomy);
  const attackCountry = useGameStore((state) => state.attackCountry);
  const recruitMilitary = useGameStore((state) => state.recruitMilitary);

  if (activeModal !== 'country_detail' || !selectedCountryId) {
    return null;
  }

  const base = COUNTRIES_DATA[selectedCountryId];
  const runtime = countries[selectedCountryId];
  if (!base || !runtime) return null;

  const isPlayerOwner = runtime.owner === 'player';
  const isCapital = selectedCountryId === playerCountryId;

  // Cálculos para upgrade econômico
  const upgradeCost = calculateEconomyUpgradeCost(base.baseIncome, runtime.economyLevel);
  const nextLevel = runtime.economyLevel + 1;
  const nextIncome = calculateIncomeForLevel(base.baseIncome, nextLevel);
  const canAffordUpgrade = money >= upgradeCost;

  // Cálculos para ataque
  const winChance = calculateWinChance(militaryPower, runtime.defense);
  const recruitCost = calculateRecruitCost(militaryPower, 1);
  const canAffordRecruit = money >= recruitCost;

  // Chance color helper
  const getChanceBadge = (chance: number) => {
    if (chance >= 75) {
      return { text: 'Alta', color: 'text-emerald-400 bg-emerald-950/80 border-emerald-500/40' };
    }
    if (chance >= 45) {
      return { text: 'Moderada', color: 'text-amber-400 bg-amber-950/80 border-amber-500/40' };
    }
    return { text: 'Baixa (Perigosa)', color: 'text-rose-400 bg-rose-950/80 border-rose-500/40' };
  };

  const chanceBadge = getChanceBadge(winChance);

  return (
    <Modal
      isOpen={activeModal === 'country_detail'}
      onClose={closeModal}
      maxWidth="md"
      title={
        <span className="flex items-center gap-2 text-xl font-bold">
          <span className="text-2xl">{base.flag}</span>
          <span>{base.name}</span>
          {isCapital && (
            <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/40 px-2 py-0.5 rounded-full font-semibold">
              CAPITAL
            </span>
          )}
        </span>
      }
      subtitle={base.region}
    >
      <div className="space-y-4">
        {/* Descrição resumida da nação */}
        <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800 leading-relaxed">
          {base.description}
        </p>

        {isPlayerOwner ? (
          /* ==================== MODO: TERRITÓRIO SOB SEU COMANDO ==================== */
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">Status</span>
                <span className="text-sm font-bold text-blue-400 flex items-center gap-1.5 mt-0.5">
                  <Award size={15} /> Sob Seu Comando
                </span>
              </div>
              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">Nível Econômico</span>
                <span className="text-sm font-bold text-slate-100 font-mono mt-0.5">
                  Nv. {runtime.economyLevel}
                </span>
              </div>
            </div>

            {/* Painel de Renda e Upgrade */}
            <div className="bg-slate-950/80 border border-blue-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-slate-300 font-medium">Renda Atual:</span>
                </div>
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  +${runtime.income}/s
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Próximo Nível (Nv. {nextLevel}):</span>
                <span className="font-semibold text-slate-200 font-mono">+${nextIncome}/s</span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Custo de Upgrade:</span>
                <span className={`font-bold font-mono ${canAffordUpgrade ? 'text-amber-300' : 'text-rose-400'}`}>
                  {formatMoney(upgradeCost)}
                </span>
              </div>

              <Button
                variant={canAffordUpgrade ? 'primary' : 'secondary'}
                fullWidth
                disabled={!canAffordUpgrade}
                onClick={() => upgradeCountryEconomy(selectedCountryId)}
                icon={<TrendingUp size={16} />}
              >
                {canAffordUpgrade ? 'MELHORAR ECONOMIA' : 'SALDO INSUFICIENTE'}
              </Button>
            </div>
          </div>
        ) : (
          /* ==================== MODO: PAÍS INDEPENDENTE / ALVO MILITAR ==================== */
          <div className="space-y-4">
            {/* Estatísticas do Alvo */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">Status</span>
                <span className="text-sm font-bold text-amber-400 flex items-center gap-1.5 mt-0.5">
                  <ShieldAlert size={15} /> Independente
                </span>
              </div>
              <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block font-medium">Renda Potencial</span>
                <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
                  +${runtime.income}/s
                </span>
              </div>
            </div>

            {/* Comparativo Militar */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="text-xs text-slate-400">Defesa Inimiga</div>
                <div className="text-sm font-bold text-rose-400 font-mono">🛡 {formatNumber(runtime.defense)}</div>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="text-xs text-slate-400">Seu Poder Militar</div>
                <div className="text-sm font-bold text-blue-400 font-mono">⚔ {formatNumber(militaryPower)}</div>
              </div>

              {/* Barra de Probabilidade de Vitória */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-300">CHANCE DE VITÓRIA:</span>
                  <span className={`px-2 py-0.5 rounded-full border text-[11px] ${chanceBadge.color}`}>
                    {winChance}% ({chanceBadge.text})
                  </span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-300 ${
                      winChance >= 70
                        ? 'bg-emerald-500'
                        : winChance >= 40
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${winChance}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Ações: Atacar ou Recrutar Tropas Extras */}
            <div className="space-y-2 pt-1">
              <Button
                variant="danger"
                size="lg"
                fullWidth
                onClick={() => attackCountry(selectedCountryId)}
                icon={<Swords size={18} />}
              >
                ORDENAR ATAQUE
              </Button>

              {/* Botão contextual para aumentar poder militar antes de atacar */}
              <div className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-300 block font-medium">Aumentar Exército (+10 tropas)</span>
                  <span className="text-[11px] text-slate-400">Custo: {formatMoney(recruitCost)}</span>
                </div>
                <Button
                  size="sm"
                  variant={canAffordRecruit ? 'secondary' : 'outline'}
                  disabled={!canAffordRecruit}
                  onClick={() => recruitMilitary(1)}
                  icon={<Plus size={14} />}
                >
                  Recrutar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
