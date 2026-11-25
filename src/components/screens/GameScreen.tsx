import React, { useEffect } from 'react';
import { FastForward, Pause, Play, ShieldAlert } from 'lucide-react';
import { Panel, updateMusic, useApp } from '../../ui';
import { COUNTRIES, RES_LIST } from '../../data/countries';
import { POWERS, Power, RES_INFO } from '../../data/content';
import { G, M, bump, game, owned, ownerName, rivalDef, save, useGame } from '../../engine/state';
import { armyPower, budget, defensePower, winChance } from '../../engine/calc';
import { awayReport, nextGoal, tick } from '../../engine/tick';
import { garrison, usePower } from '../../engine/war';
import { refreshCalendar } from '../../engine/meta';
import { formatMoney, formatNumber } from '../../utils/formatters';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';
import { InteractiveMap } from '../map/InteractiveMap';
import { CountryPanel } from '../panels/CountryPanel';
import { BattleModal } from '../panels/BattleModal';
import { NukeCinematic } from '../panels/NukeCinematic';
import { HelpButton } from '../panels/HelpModal';
import { Panels } from '../panels/Panels';
import { Dialogs, dialogOpen } from '../panels/Dialogs';
import { LanEnd, LanSide, LiveBattles, LanTop } from '../panels/LanHud';
import { L, lanTick } from '../../lan/match';
import { useWakeLock } from '../../hooks/useDevice';
import { Button } from '../common/Button';

const AWAY_GAP_S = 60;
const AUTOSAVE_S = 15;
const NAV: { id: Exclude<Panel, null>; icon: string; name: string }[] = [
  { id: 'imperio', icon: '🏛️', name: 'Império' },
  { id: 'exercito', icon: '⚔️', name: 'Exército' },
  { id: 'generais', icon: '🎖️', name: 'Generais' },
  { id: 'diplomacia', icon: '🤝', name: 'Aliados' },
  { id: 'ciencia', icon: '🔬', name: 'Ciência' },
  { id: 'missoes', icon: '🎯', name: 'Missões' },
  { id: 'mundo', icon: '🌍', name: 'Mundo' },
  { id: 'menu', icon: '☰', name: 'Menu' },
];

function useGameLoop() {
  useEffect(() => {
    let last = Date.now();
    let sinceSave = 0;
    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - last) / 1000;
      last = now;
      if (!G) return;
      if (G.mode === 'lan') {
        if (L.phase === 'play') {
          tick(Math.min(elapsed, 5));
          lanTick(Math.min(elapsed, 5));
        }
      } else if (elapsed > AWAY_GAP_S) {
        // Aba suspensa: vira relatório de ausência
        if (!G.paused && !G.over) awayReport(G, Math.min(elapsed, 8 * 3600));
        bump();
      } else tick(Math.min(elapsed, 5), dialogOpen() || useApp.getState().help || useApp.getState().panel === 'menu');
      updateMusic();
      sinceSave += elapsed;
      if (sinceSave > AUTOSAVE_S) {
        refreshCalendar();
        save();
        sinceSave = 0;
      }
    }, 1000);
    const onHide = () => document.hidden && save();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', save);
      updateMusic();
    };
  }, []);
}

export const GameScreen: React.FC = () => {
  useGameLoop();
  useWakeLock();
  useGame();
  const setPanel = useApp((s) => s.setPanel);
  const setScreen = useApp((s) => s.setScreen);
  useEffect(() => {
    // Partida encerrada por fora (sala fechada, revanche)
    if (!G) setScreen(L.phase === 'lobby' || L.error ? 'lan' : 'home');
  });
  if (!G) return null;
  const lan = G.mode === 'lan';
  const badge: Partial<Record<string, number>> = { generais: M.chests };
  return (
    <div className="relative w-full h-full flex flex-col bg-[#060911] text-slate-100 overflow-hidden">
      <Hud />
      <main className="flex-1 min-h-0 relative overflow-hidden">
        <InteractiveMap />
        {lan && <LiveBattles />}
        <div className="absolute top-2 inset-x-2 z-20 mx-auto max-w-lg space-y-2 pointer-events-none">
          {lan ? <LanTop /> : <p className="glass-panel rounded-xl px-3 py-1.5 text-xs text-center text-amber-200">🎯 {nextGoal()}</p>}
          <Threat />
        </div>
        <div className="absolute left-2 bottom-2 z-20 flex flex-col gap-2">
          {lan && <LanSide />}
          <PowerBar />
          {!lan && <span className="flex gap-1.5"><Speed /><HelpButton className="glass-btn w-9 h-9 text-amber-300" /></span>}
        </div>
      </main>
      <nav className="game-nav relative z-30 shrink-0 grid grid-cols-8 bg-slate-950 border-t border-slate-800 pb-[env(safe-area-inset-bottom)]">
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setPanel(n.id)} className="relative flex flex-col items-center gap-0.5 py-2 text-[10px] xs:text-[11px] text-slate-300 hover:bg-slate-900 active:scale-95 transition min-w-0">
            <span className="text-lg leading-none">{n.icon}</span>
            <span className="nav-label truncate max-w-full">{n.name}</span>
            {!!badge[n.id] && <span className="absolute top-0.5 right-1/4 bg-rose-600 text-white rounded-full px-1 text-[9px] font-bold">{badge[n.id]}</span>}
          </button>
        ))}
      </nav>
      <CountryPanel />
      <Panels />
      <BattleModal />
      <NukeCinematic />
      <Dialogs />
      <LanEnd />
    </div>
  );
};

const Hud: React.FC = () => {
  const g = game();
  const money = useAnimatedNumber(g.money);
  const income = budget().total;
  const power = useAnimatedNumber(armyPower(g.army));
  return (
    <header className="safe-top relative z-30 shrink-0 bg-slate-950 border-b border-slate-800">
      <p key={g.news[0]?.id} className="news-in news-line px-3 py-1 text-[11px] text-slate-300 truncate border-b border-slate-900">📡 {g.news[0]?.text}</p>
      <div className="flex items-center justify-between gap-2 px-2 sm:px-4 py-1.5 text-xs font-mono overflow-x-auto no-scrollbar">
        <span className="shrink-0 font-bold">{COUNTRIES[g.capital].flag} {owned().length}</span>
        <span className="shrink-0 text-amber-300 font-bold">💰 {formatMoney(money)} <span className={income < 0 ? 'text-rose-400' : 'text-emerald-400'}>{income < 0 ? '' : '+'}{Math.round(income)}/s</span></span>
        <span className="shrink-0 text-blue-300 font-bold">⚔️ {formatNumber(power)}</span>
        <span className="shrink-0 text-cyan-300">🔬 {formatNumber(g.science)}</span>
        {RES_LIST.map((r) => <span key={r} className="shrink-0 text-slate-300" title={RES_INFO[r].name}>{RES_INFO[r].icon} {formatNumber(g.res[r])}</span>)}
        {g.infamy > 20 && <span className={`shrink-0 ${g.infamy > 45 ? 'text-rose-400' : 'text-orange-300'}`} title="Má fama">😠 {Math.round(g.infamy)}</span>}
      </div>
    </header>
  );
};

const Threat: React.FC = () => {
  const g = game();
  const t = g.threat;
  if (!t) return null;
  const who = t.by === 'alien' ? '👽 Alienígenas' : t.by === 'onda' ? `🌊 Onda ${g.wave}` : g.rivals[t.by] ? `${rivalDef(t.by).icon} ${rivalDef(t.by).leader}` : ownerName(t.by);
  const chance = Math.round(winChance(defensePower(t.target), t.power) * 100);
  return (
    <div className="pointer-events-auto glass-panel threat-banner flex items-center gap-3 rounded-xl px-3 py-2 text-xs">
      <ShieldAlert size={20} className="text-rose-400 shrink-0 animate-pulse" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-rose-300">{who} vai atacar {COUNTRIES[t.target].name}</p>
        <p className="font-mono text-slate-300">{Math.ceil(t.left)}s • defesa {chance}%{g.shield && ' • escudo pronto'}</p>
      </div>
      <Button size="sm" variant="secondary" disabled={g.army.inf < 10} onClick={() => garrison(t.target, 10)}>+10 guarda</Button>
      <Button size="sm" variant="secondary" disabled={g.powers.escudo > 0 || g.shield} onClick={() => usePower('escudo')}>🛡️</Button>
    </div>
  );
};

const PowerBar: React.FC = () => {
  const g = game();
  return (
    <div className="flex gap-1.5">
      {(['escudo', 'paraquedas', 'satelite'] as Power[]).map((p) => {
        const on = (p === 'escudo' && g.shield) || (p === 'paraquedas' && g.para) || (p === 'satelite' && g.satellite > 0);
        return (
          <button key={p} title={`${POWERS[p].name}: ${POWERS[p].text}`} aria-label={POWERS[p].name} disabled={g.powers[p] > 0} onClick={() => usePower(p)}
            className={`glass-btn w-11 h-11 text-lg ${on ? '!border-amber-400' : ''} ${g.powers[p] > 0 ? 'opacity-60' : ''}`}>
            {g.powers[p] > 0 && !on ? <span className="text-[11px] font-mono">{Math.ceil(g.powers[p])}</span> : POWERS[p].icon}
          </button>
        );
      })}
    </div>
  );
};

const Speed: React.FC = () => {
  const g = game();
  const set = (speed: 1 | 2 | 5) => {
    g.speed = speed;
    g.paused = false;
    bump();
  };
  return (
    <div className="flex glass-panel rounded-xl p-0.5 text-xs font-mono font-bold w-fit">
      <button aria-label={g.paused ? 'Retomar' : 'Pausar'} onClick={() => { g.paused = !g.paused; bump(); }} className={`px-2.5 py-2 rounded-lg ${g.paused ? 'bg-amber-500 text-slate-950' : 'text-slate-300'}`}>
        {g.paused ? <Play size={13} /> : <Pause size={13} />}
      </button>
      {([1, 2, 5] as const).map((s) => (
        <button key={s} onClick={() => set(s)} className={`px-2.5 py-2 rounded-lg flex items-center gap-0.5 ${!g.paused && g.speed === s ? 'bg-blue-600 text-white' : 'text-slate-300'}`}>
          {s > 1 && <FastForward size={10} />}{s}x
        </button>
      ))}
    </div>
  );
};
