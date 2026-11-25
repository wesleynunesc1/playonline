import React from 'react';
import { Plus, ShieldAlert } from 'lucide-react';
import { useGameStore } from '../../stores/useGameStore';
import { COUNTRIES_DATA } from '../../data/countries';
import { getDefenseMatchup } from '../../utils/formulas';
import { formatMoney } from '../../utils/formatters';
import { Button } from '../common/Button';

/** Aviso de invasão com tempo para o jogador reforçar as tropas */
export const ThreatBanner: React.FC = () => {
  const threat = useGameStore((s) => s.threat);
  const attacker = useGameStore((s) => (s.threat ? s.countries[s.threat.attackerId] : null));
  const military = useGameStore((s) => s.militaryPower);
  const money = useGameStore((s) => s.money);
  const cost = useGameStore((s) => s.getRecruitCost());
  const recruit = useGameStore((s) => s.recruitMilitary);
  const getModifiers = useGameStore((s) => s.getModifiers);

  if (!threat || !attacker) return null;
  const { winChance } = getDefenseMatchup(military, attacker, getModifiers());

  return (
    <div className="absolute top-20 inset-x-3 z-20 mx-auto max-w-md flex items-center gap-3 glass-panel threat-banner rounded-xl px-3 py-2 text-xs">
      <ShieldAlert size={20} className="text-rose-400 shrink-0 animate-pulse" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-rose-300">
          {COUNTRIES_DATA[threat.attackerId].name} vai atacar {COUNTRIES_DATA[threat.targetId].name}
        </p>
        <p className="text-slate-300 font-mono">
          {Math.ceil(threat.secondsLeft)}s • chance de defesa {winChance}%
        </p>
      </div>
      <Button size="sm" variant="secondary" disabled={money < cost} onClick={() => recruit(1)} icon={<Plus size={13} />}>
        10 ({formatMoney(cost)})
      </Button>
    </div>
  );
};
