import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { useApp } from '../../ui';
import { COUNTRIES } from '../../data/countries';
import { CARDS, CHALLENGES, EMOJIS, MEDALS, PHRASES } from '../../lan/content';
import { L, Proposal, answer, colorOf, modeOf, playCard, playerOf, propose, quit, rematch, sendGift, setBounty, shout } from '../../lan/match';
import { Rival, bump, game, setGame, useGame } from '../../engine/state';
import { betray, declareWar } from '../../engine/realm';
import { formatMoney } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const PROPOSAL = { truce: 'propõe trégua de 2 minutos', ally: 'propõe aliança', trade: 'propõe tratado comercial' };
const nameOf = (id: string) => playerOf(id)?.name ?? '';

/** Relógio e placar ao vivo, no topo do mapa */
export const LanTop: React.FC = () => {
  useGame();
  if (L.phase !== 'play') return null;
  const unit = modeOf().unit;
  const board = [...L.players].sort((a, b) => b.score - a.score);
  const challenge = L.challenge && CHALLENGES.find((c) => c.id === L.challenge!.id);
  return (
    <div className="space-y-1.5">
      <div className="glass-panel rounded-xl px-2 py-1.5 flex items-center gap-2 text-xs overflow-x-auto no-scrollbar pointer-events-auto">
        <span className={`shrink-0 font-mono font-bold text-sm ${L.left < 60 ? 'text-rose-400 animate-pulse' : 'text-amber-300'}`}>⏱ {clock(L.left)}</span>
        {board.map((p, i) => (
          <span key={p.id} title={unit} className={`shrink-0 rounded-full px-2 py-0.5 font-bold text-white ${p.online ? '' : 'opacity-40'}`} style={{ background: colorOf(p.id) }}>
            {i === 0 && '👑'}{p.emblem} {p.id === L.me ? 'Você' : p.name} {p.score}{L.bounty[p.id] ? ' 💰' : ''}
          </span>
        ))}
      </div>
      {challenge && <p className="glass-panel rounded-xl px-3 py-1 text-[11px] text-center text-cyan-200">🏁 Primeiro a {challenge.text}: {Math.min(challenge.n, game().stats[challenge.stat] - L.challenge!.base)}/{challenge.n}</p>}
      {L.mode === 'colina' && <button onClick={() => useApp.getState().select(L.hill)} className="glass-panel rounded-xl px-3 py-1 text-[11px] text-amber-200 pointer-events-auto w-full">⛰️ Trono: {COUNTRIES[L.hill].flag} {COUNTRIES[L.hill].name}</button>}
      {L.respawn > 0 && <p className="glass-panel rounded-xl px-3 py-2 text-sm text-center text-rose-300">Você caiu! Renascendo em {Math.ceil(L.respawn)}s</p>}
      {!L.connected && <p className="glass-panel rounded-xl px-3 py-2 text-sm text-center text-amber-300">Reconectando...</p>}
      {L.proposals.map((p) => <ProposalCard key={p.from + p.kind} p={p} />)}
    </div>
  );
};
const ProposalCard: React.FC<{ p: Proposal }> = ({ p }) => (
  <div className="glass-panel rounded-xl px-3 py-2 flex items-center gap-2 text-xs pointer-events-auto">
    <span className="flex-1">{playerOf(p.from)?.emblem} <b>{nameOf(p.from)}</b> {PROPOSAL[p.kind]}</span>
    <Button size="sm" onClick={() => answer(p, true)}>Aceitar</Button>
    <Button size="sm" variant="outline" onClick={() => answer(p, false)}>Não</Button>
  </div>
);

/** Falas flutuantes e botões de carta e conversa */
export const LanSide: React.FC = () => {
  useGame();
  const [open, setOpen] = useState<'' | 'cartas' | 'chat'>('');
  if (L.phase !== 'play') return null;
  return (
    <>
      <div className="flex flex-col gap-1 items-start pointer-events-none max-w-[60vw] sm:max-w-xs">
        {L.float.map((f) => (
          <p key={f.id} className={`speech rounded-xl px-2.5 py-1.5 ${f.big ? 'text-4xl' : 'text-xs glass-panel'}`}>
            {f.from && <b style={{ color: colorOf(f.from) }}>{nameOf(f.from)} </b>}{f.text}
          </p>
        ))}
      </div>
      <div className="flex gap-1.5">
        <button onClick={() => setOpen('cartas')} aria-label="Cartas" className={`glass-btn relative h-11 px-3 text-lg ${L.hand.length ? '!border-amber-400' : ''}`}>
          🃏<span className="text-xs font-bold ml-1">{L.hand.length}</span>
        </button>
        <button onClick={() => { L.unread = 0; setOpen('chat'); }} aria-label="Conversa" className="glass-btn relative h-11 px-3 text-lg">
          💬{L.unread > 0 && <span className="absolute -top-1 -right-1 bg-rose-600 rounded-full text-[10px] px-1 font-bold">{Math.min(99, L.unread)}</span>}
        </button>
      </div>
      {open === 'cartas' && <Cards onClose={() => setOpen('')} />}
      {open === 'chat' && <Chat onClose={() => { L.unread = 0; setOpen(''); }} />}
    </>
  );
};

const Cards: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [aim, setAim] = useState(-1);
  const foes = L.players.filter((p) => p.id !== L.me && p.n > 0);
  const use = (i: number, target = '') => {
    if (playCard(i, target)) onClose();
  };
  return (
    <Modal isOpen onClose={onClose} maxWidth="md" title="🃏 Suas cartas" subtitle={L.hand.length >= 4 ? 'Mão cheia: use para receber mais' : `Próxima em ${Math.ceil(L.nextCard)}s`}>
      {!L.hand.length && <p className="text-sm text-slate-400">Nenhuma carta ainda.</p>}
      <div className="grid grid-cols-2 gap-2">
        {L.hand.map((id, i) => {
          const c = CARDS.find((x) => x.id === id)!;
          return (
            <button key={`${id}${i}`} onClick={() => (c.target === 'foe' ? setAim(aim === i ? -1 : i) : use(i))} className={`card-in rounded-2xl border-2 p-3 text-center text-xs bg-gradient-to-b from-slate-800 to-slate-950 active:scale-95 transition ${aim === i ? 'border-rose-400' : c.target === 'foe' ? 'border-rose-800' : c.target === 'all' ? 'border-fuchsia-700' : 'border-emerald-700'}`}>
              <span className="block text-4xl">{c.icon}</span>
              <b className="block text-sm text-white">{c.name}</b>
              <span className="text-slate-300">{c.text}</span>
            </button>
          );
        })}
      </div>
      {aim >= 0 && (
        <div className="space-y-2">
          <p className="text-sm text-rose-200">Usar em quem?</p>
          {foes.map((p) => <Button key={p.id} fullWidth variant="secondary" onClick={() => use(aim, p.id)}>{p.emblem} {p.name} ({p.score})</Button>)}
        </div>
      )}
    </Modal>
  );
};

const Chat: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [text, setText] = useState('');
  const send = (t: string, big = false) => {
    shout(t, big);
    setText('');
  };
  return (
    <Modal isOpen onClose={onClose} maxWidth="md" title="💬 Conversa">
      <div className="grid grid-cols-8 gap-1">{EMOJIS.map((e) => <button key={e} onClick={() => send(e, true)} className="h-11 text-2xl rounded-xl bg-slate-800 active:scale-90">{e}</button>)}</div>
      <div className="flex flex-wrap gap-1.5">{PHRASES.map((p) => <button key={p} onClick={() => send(p)} className="rounded-full bg-slate-800 border border-slate-700 px-3 py-2 text-xs active:scale-95">{p}</button>)}</div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input value={text} maxLength={60} onChange={(e) => setText(e.target.value)} placeholder="Mensagem" className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-base outline-none" />
        <Button type="submit">Enviar</Button>
      </form>
      <div className="max-h-48 overflow-y-auto space-y-1 text-xs">{L.feed.map((f) => <p key={f.id}>{f.from && <b style={{ color: colorOf(f.from) }}>{nameOf(f.from)}: </b>}{f.text}</p>)}</div>
    </Modal>
  );
};

/** Ações diplomáticas com um jogador real (usado na aba Diplomacia) */
export const HumanActions: React.FC<{ r: Rival }> = ({ r }) => (
  <div className="grid grid-cols-2 gap-2">
    <Button size="sm" variant="secondary" disabled={r.truce > 0} onClick={() => propose(r.id, 'truce')}>🕊️ Trégua</Button>
    <Button size="sm" variant="secondary" disabled={r.ally} onClick={() => propose(r.id, 'ally')}>🤝 Aliança</Button>
    <Button size="sm" variant="secondary" disabled={r.trade} onClick={() => propose(r.id, 'trade')}>📜 Tratado</Button>
    <Button size="sm" variant="secondary" onClick={() => sendGift(r.id, 'money')}>💵 Enviar 15%</Button>
    <Button size="sm" variant="secondary" onClick={() => sendGift(r.id, 'inf')}>🪖 Enviar 20</Button>
    <Button size="sm" variant="secondary" onClick={() => sendGift(r.id, 'food')}>🌽 Enviar 20</Button>
    <Button size="sm" variant="gold" onClick={() => setBounty(r.id)}>💰 Recompensa</Button>
    <Button size="sm" variant="danger" onClick={() => (r.ally ? betray(r.id) : declareWar(r.id))}>{r.ally ? '🗡️ Trair' : '⚔️ Guerra'}</Button>
  </div>
);

/** Pódio final */
export const LanEnd: React.FC = () => {
  useGame();
  const setScreen = useApp((s) => s.setScreen);
  const end = L.end;
  useEffect(() => {
    if (end) confetti({ particleCount: 180, spread: 110, origin: { y: 0.6 } });
  }, [end]);
  if (!end) return null;
  const leave = () => {
    quit();
    setScreen('home');
  };
  const again = () => {
    if (L.host) rematch();
    else {
      // Espera o criador: a sala reaparece quando ele pedir revanche
      L.phase = 'lobby';
      setGame(null);
    }
    L.end = null;
    setScreen('lan');
    bump();
  };
  return (
    <Modal isOpen onClose={() => {}} maxWidth="md" showCloseButton={false} title={`🏆 ${end.title}`}>
      {end.rank.map((id, i) => {
        const p = playerOf(id);
        if (!p) return null;
        return (
          <div key={id} className="podium rounded-xl border border-slate-700 p-2.5 text-xs" style={{ animationDelay: `${i * 0.2}s`, borderColor: colorOf(id) }}>
            <p className="flex items-center gap-2 text-sm"><span className="text-xl">{['🥇', '🥈', '🥉'][i] ?? `${i + 1}º`}</span><b className="flex-1">{p.emblem} {p.name}</b><span className="font-mono">{p.score} {modeOf().unit}</span></p>
            <p className="text-slate-400">{p.n} países • {formatMoney(p.money)}</p>
            <div className="flex flex-wrap gap-1 mt-1">{end.medals.filter((m) => m.player === id).map((m) => { const d = MEDALS.find((x) => x.id === m.id)!; return <span key={m.id} className="rounded-full bg-amber-950 text-amber-200 px-2 py-0.5">{d.icon} {d.name}</span>; })}</div>
          </div>
        );
      })}
      <Button variant="gold" fullWidth onClick={again}>Revanche</Button>
      <Button variant="outline" fullWidth onClick={leave}>Sair</Button>
    </Modal>
  );
};
