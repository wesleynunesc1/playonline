import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { COUNTRIES } from '../../data/countries';
import { GENERALS, TERRAIN_INFO } from '../../data/content';
import { Tactic, game, useGame } from '../../engine/state';
import { BOSS, TACTICS, autoBattle, battleRound, closeBattle, retreat } from '../../engine/war';
import { formatNumber } from '../../utils/formatters';
import { L } from '../../lan/match';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { BattleScene } from './BattleScene';
import { Bar } from '../common/Kit';

const TITLE = { won: 'Vitória!', lost: 'Derrota', fled: 'Retirada', '': '' };

/** Batalha em rodadas: leia a tática inimiga e escolha a que vence */
export const BattleModal: React.FC = () => {
  useGame();
  const b = game()?.battle;
  useEffect(() => {
    if (b?.done === 'won') confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  }, [b?.done]);
  if (!b) return null;
  const base = COUNTRIES[b.target];
  const name = b.boss ? BOSS.name : base.name;
  const general = GENERALS.find((x) => x.id === b.general);

  return (
    <Modal isOpen onClose={b.done ? closeBattle : () => {}} maxWidth="xl" showCloseButton={false}
      title={b.done ? TITLE[b.done] : <>⚔️ Batalha por {b.boss ? `${BOSS.icon} ${name}` : `${base.flag} ${name}`}</>}
      subtitle={b.done ? name : `Rodada ${b.round}${game().mode === 'lan' ? ` • ⏱ ${Math.ceil(L.battleLeft)}s` : ''}${b.boss ? '' : ` • ${TERRAIN_INFO[base.terrain].icon} ${TERRAIN_INFO[base.terrain].name}`}`}>
      <BattleScene key={b.target + b.a0} battle={b} terrain={b.boss ? 'deserto' : base.terrain} boss={b.boss} />
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="space-y-1">
          <p className="text-blue-300 font-bold">{general ? `${general.icon} ${general.name}` : 'Suas tropas'} • {formatNumber(b.a)}</p>
          <Bar value={b.a / b.a0} color="bg-blue-500" />
        </div>
        <div className="space-y-1 text-right">
          <p className="text-rose-300 font-bold">{name} • {formatNumber(b.d)}</p>
          <Bar value={b.d / b.d0} color="bg-rose-500" />
        </div>
      </div>
      {b.done ? (
        <>
          <ul className="text-sm text-center text-slate-200 space-y-1">{b.summary.map((s) => <li key={s}>{s}</li>)}</ul>
          <Button size="lg" fullWidth onClick={closeBattle}>Continuar</Button>
        </>
      ) : (
        <>
          <p className="text-center text-sm text-slate-200">
            Batedores dizem que o inimigo vai <strong className="text-amber-300">{TACTICS[b.hint].name.toLowerCase()}</strong> {TACTICS[b.hint].icon}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(TACTICS) as Tactic[]).map((t) => (
              <button key={t} onClick={() => battleRound(t)} className="rounded-xl bg-slate-800 hover:bg-blue-700 border border-slate-600 p-3 text-xs text-slate-100 active:scale-95 transition">
                <span className="block text-2xl">{TACTICS[t].icon}</span>
                <span className="block font-bold">{TACTICS[t].name}</span>
                <span className="block text-slate-400">{TACTICS[t].vs}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" onClick={autoBattle}>Resolver automático</Button>
            <Button size="sm" variant="outline" onClick={retreat}>🏳️ Retirada</Button>
          </div>
          <ul className="text-xs text-slate-400 min-h-[2rem]">{b.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </>
      )}
    </Modal>
  );
};
