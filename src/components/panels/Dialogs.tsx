import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { useApp } from '../../ui';
import { GEOPOLITICAL_EVENTS } from '../../data/events';
import { bump, game, save, scenarioOf, useGame } from '../../engine/state';
import { castVote, resolveCrisis } from '../../engine/realm';
import { doPrestige, finishGame, prestigeGain } from '../../engine/meta';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

const noop = () => {};

/** Algum diálogo de decisão aberto? (o tempo para enquanto isso) */
export const dialogOpen = () => {
  const g = game();
  return !!g && (!!g.over || !g.storySeen || g.report.length > 0 || !!g.crisis || !!g.vote);
};

/** Mostra um diálogo por vez */
export const Dialogs: React.FC = () => {
  useGame();
  const g = game();
  if (!g || g.mode === 'lan' || g.battle) return null;
  if (g.over) return <Over />;
  if (!g.storySeen) return <Story />;
  if (g.report.length) return <Report />;
  if (g.crisis) return <Crisis />;
  if (g.vote) return <Vote />;
  return null;
};

const Over: React.FC = () => {
  const g = game();
  const setScreen = useApp((s) => s.setScreen);
  const won = !!g.over?.won;
  const free = g.mode === 'livre';
  useEffect(() => {
    if (won) confetti({ particleCount: 200, spread: 110, origin: { y: 0.6 } });
  }, [won]);
  const leave = () => {
    finishGame();
    setScreen('home');
  };
  return (
    <Modal isOpen onClose={noop} maxWidth="sm" showCloseButton={false}>
      <div className="text-center space-y-4">
        <p className="text-6xl">{won ? '👑' : '💀'}</p>
        <h2 className={`text-2xl font-black ${won ? 'text-amber-300' : 'text-rose-400'}`}>{g.over?.title}</h2>
        <p className="text-sm text-slate-300">{g.over?.text}</p>
        {free && prestigeGain() > 0 && (
          <Button variant="gold" fullWidth onClick={() => { doPrestige(); setScreen('home'); }}>Nova Era: +{prestigeGain()} de legado</Button>
        )}
        {won && free && (
          <Button variant="secondary" fullWidth onClick={() => { g.over = null; save(); bump(); }}>Continuar reinando</Button>
        )}
        <Button variant="outline" fullWidth onClick={leave}>Voltar ao menu</Button>
      </div>
    </Modal>
  );
};

const Story: React.FC = () => {
  const g = game();
  const sc = scenarioOf(g.mode)!;
  const lines = sc.story ?? [];
  const [i, setI] = useState(0);
  const next = () => {
    if (i < lines.length - 1) return setI(i + 1);
    g.storySeen = true;
    bump();
  };
  return (
    <Modal isOpen onClose={noop} maxWidth="md" showCloseButton={false} title={`${sc.icon} ${sc.name}`}>
      <p className="text-amber-300 font-bold text-sm">{lines[i]?.who}</p>
      <p key={i} className="animate-in text-lg text-slate-100">“{lines[i]?.line}”</p>
      <p className="text-xs text-slate-400">Objetivo: {sc.text}</p>
      <Button fullWidth onClick={next}>{i < lines.length - 1 ? 'Continuar' : 'Começar'}</Button>
    </Modal>
  );
};

const Report: React.FC = () => {
  const g = game();
  const close = () => {
    g.report = [];
    bump();
  };
  return (
    <Modal isOpen onClose={close} maxWidth="sm" title="📰 Enquanto você esteve fora">
      <ul className="space-y-2 text-sm text-slate-200">{g.report.map((l) => <li key={l}>{l}</li>)}</ul>
      <Button variant="gold" fullWidth onClick={close}>Retomar o comando</Button>
    </Modal>
  );
};

const Crisis: React.FC = () => {
  const g = game();
  const e = GEOPOLITICAL_EVENTS.find((x) => x.id === g.crisis);
  if (!e) return null;
  return (
    <Modal isOpen onClose={noop} maxWidth="md" showCloseButton={false} title={`⚠️ ${e.title}`} subtitle={e.subtitle}>
      <p className="text-sm text-slate-200">{e.description}</p>
      {e.choices.map((c) => (
        <button key={c.id} disabled={!!c.costMoney && g.money < c.costMoney} onClick={() => resolveCrisis(c.id)}
          className="w-full text-left rounded-xl border border-slate-700 bg-slate-800/80 hover:border-blue-500 disabled:opacity-40 p-3">
          <span className="block font-bold text-sm text-slate-100">{c.label}</span>
          <span className="block text-xs text-slate-300">{c.description}</span>
        </button>
      ))}
    </Modal>
  );
};

const Vote: React.FC = () => {
  const v = game().vote!;
  return (
    <Modal isOpen onClose={noop} maxWidth="sm" showCloseButton={false} title="🇺🇳 Votação na ONU">
      <p className="text-sm text-slate-200">{v.text}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" onClick={() => castVote(true)}>Sim</Button>
        <Button variant="danger" onClick={() => castVote(false)}>Não</Button>
      </div>
    </Modal>
  );
};
