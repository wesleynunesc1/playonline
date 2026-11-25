import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Map as MapIcon, Search } from 'lucide-react';
import { useApp } from '../../ui';
import { hooks, cheat } from '../../engine/state';
import { sound } from '../../utils/audio';
import { formatNumber } from '../../utils/formatters';
import { BUILDS, BUILD_IDS, BuildId, CITIES, CITY, CLAN_PHRASES, GRID, MAX_LEVEL, RAID_SECONDS, TROOPS, TROOP_IDS, TroopId, dpsAt, hpAt, leagueOf, produces, upCost, upTime } from '../../ceara/content';
import * as V from '../../ceara/village';
import { Net, donate, fetchBase, leaveCity, loadPlayers, playerAt, publish, reportRaid, say, startSync } from '../../ceara/online';
import { Raid, STEP, canDeploy, deploy, startRaid, stepRaid, survivors } from '../../ceara/sim';
import { Map3D, Mark } from '../../ceara/map3d';
import { Village3D } from '../../ceara/village3d';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { Action, Bar, Card, Row } from '../common/Kit';

type View = 'vila' | 'mapa' | 'ataque';
const toast = (error: string, good = '') => {
  if (error) hooks.toast(error, 'danger');
  else if (good) hooks.toast(good, 'success');
  return !error;
};
const clock = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${Math.ceil(s % 60)}s` : `${Math.max(0, Math.ceil(s))}s`);

export const CearaScreen: React.FC = () => {
  V.useVillage();
  const [view, setView] = useState<View>(V.V ? 'vila' : 'mapa');
  const [target, setTarget] = useState<V.Base | null>(null);
  useEffect(() => {
    loadPlayers();
    V.events.quest = (text, prize) => hooks.toast(`🎯 ${text}: +${prize} rapaduras`, 'success');
    const timer = setInterval(V.tick, 1000);
    return () => clearInterval(timer);
  }, []);
  const founded = !!V.V;
  useEffect(() => (founded ? startSync() : undefined), [founded]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#1b2a35] text-slate-100">
      {view === 'mapa' && <MapView onVillage={() => setView('vila')} onAttack={(b) => { setTarget(b); setView('ataque'); }} />}
      {view === 'vila' && founded && <VillageView onMap={() => setView('mapa')} />}
      {view === 'ataque' && target && <RaidView key={target.city} base={target} onEnd={() => { setTarget(null); setView('mapa'); }} />}
    </div>
  );
};

// ===================== Mapa =====================
const MapView: React.FC<{ onVillage: () => void; onAttack: (b: V.Base) => void }> = ({ onVillage, onAttack }) => {
  V.useVillage();
  const setScreen = useApp((s) => s.setScreen);
  const ref = useRef<HTMLCanvasElement>(null);
  const map = useRef<Map3D | null>(null);
  const [picked, setPicked] = useState(0);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const v = V.V;

  useEffect(() => {
    const m = new Map3D(ref.current!);
    m.onPick = (id) => { sound.playClick(); setPicked(id); };
    map.current = m;
    if (V.V) m.select(V.V.city, true);
    return () => m.destroy();
  }, []);
  const conquered = v?.conquered;
  const players = Net.players;
  useEffect(() => {
    const marks: Record<number, Mark> = {};
    const names: Record<number, string> = {};
    for (const id in conquered) marks[Number(id)] = 'mine';
    for (const p of players) {
      marks[p.city] = 'player';
      names[p.city] = p.name;
    }
    if (v) {
      marks[v.city] = 'home';
      names[v.city] = v.name;
    }
    map.current?.setMarks(marks, names);
  }, [v, conquered && Object.keys(conquered).length, players]);
  useEffect(() => map.current?.select(picked), [picked]);

  const found = useMemo(() => {
    const q = query.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
    return q.length < 2 ? [] : CITIES.filter((c) => c.name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().includes(q)).slice(0, 6);
  }, [query]);
  const go = (id: number) => {
    setQuery('');
    setPicked(id);
    map.current?.select(id, true);
  };
  const attack = async (id: number) => {
    const p = playerAt(id);
    if (p && p.shield > Date.now()) return hooks.toast('Cidade protegida por escudo.', 'danger');
    if (!V.spaceUsed()) return hooks.toast('Treine tropas antes de atacar.', 'danger');
    setBusy(true);
    try {
      const base = p ? await fetchBase(id) : null;
      if (p && !base) throw new Error('Vila indisponível agora.');
      onAttack(base ?? V.cityBase(id));
    } catch (e) {
      hooks.toast((e as Error).message, 'danger');
    }
    setBusy(false);
  };

  return (
    <>
      <canvas ref={ref} className="absolute inset-0 w-full h-full touch-none" aria-label="Mapa 3D do Ceará" />
      <header className="safe-top absolute top-0 inset-x-0 p-2 flex items-start gap-2 pointer-events-none">
        <button onClick={() => setScreen('home')} className="glass-btn h-11 px-3 gap-2 text-sm pointer-events-auto"><ArrowLeft size={18} /> Menu</button>
        <div className="flex-1 max-w-xs mx-auto pointer-events-auto">
          <label className="flex items-center gap-2 glass-panel rounded-xl px-3"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cidade" className="flex-1 min-w-0 bg-transparent py-2.5 text-base outline-none" /></label>
          {found.map((c) => <button key={c.id} onClick={() => go(c.id)} className="w-full text-left glass-panel px-3 py-2.5 text-sm">{c.name}</button>)}
        </div>
        {v && <button onClick={onVillage} className="glass-btn h-11 px-3 text-sm pointer-events-auto">🏠 Vila</button>}
      </header>
      {v && (
        <div className="absolute left-2 bottom-2 glass-panel rounded-xl px-3 py-2 text-xs space-y-0.5 safe-bottom !pb-2">
          <p>🚩 {Object.keys(v.conquered).length}/183 conquistadas</p>
          <p>{Net.online ? `🟢 ${players.length} jogador(es) online` : '⚪ Sem conexão'}</p>
        </div>
      )}
      {!v && !picked && <p className="absolute inset-x-4 bottom-6 mx-auto max-w-md glass-panel rounded-2xl p-4 text-center font-bold">Toque em uma das 184 cidades do Ceará para fundar a sua vila!</p>}
      <Modal isOpen={!!picked} onClose={() => setPicked(0)} maxWidth="sm" title={picked ? CITY[picked].name : ''} subtitle={picked ? `${CITY[picked].region} • ${CITY[picked].pop.toLocaleString('pt-BR')} habitantes` : ''}>
        {picked > 0 && (v ? <CityInfo id={picked} busy={busy} onAttack={() => attack(picked)} onVillage={onVillage} /> : <FoundForm id={picked} onDone={onVillage} />)}
      </Modal>
    </>
  );
};

const FoundForm: React.FC<{ id: number; onDone: () => void }> = ({ id, onDone }) => {
  const [name, setName] = useState('');
  const owner = playerAt(id);
  if (owner) return <p className="text-sm">Esta cidade já é de <b>{owner.name}</b>. Escolha outra.</p>;
  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      if (name.trim().length < 2) return;
      V.found(id, name.trim());
      sound.playVictory();
      onDone();
    }}>
      <p className="text-sm text-slate-300">Sua vila ficará aqui. As outras 183 cidades serão seus alvos.</p>
      <input value={name} maxLength={14} onChange={(e) => setName(e.target.value)} placeholder="Seu nome no jogo" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 outline-none" />
      <Button type="submit" size="lg" variant="gold" fullWidth disabled={name.trim().length < 2}>Fundar em {CITY[id].name}</Button>
    </form>
  );
};

const CityInfo: React.FC<{ id: number; busy: boolean; onAttack: () => void; onVillage: () => void }> = ({ id, busy, onAttack, onVillage }) => {
  const v = V.me();
  const p = playerAt(id);
  if (id === v.city) return <Button fullWidth onClick={onVillage}>🏠 Entrar na minha vila</Button>;
  const base = p ? null : V.cityBase(id);
  const ally = p && v.clan && p.clan.toLowerCase() === v.clan.toLowerCase();
  return (
    <div className="space-y-3 text-sm">
      {p ? (
        <Card title={`⚔️ ${p.name}`}>
          <Row label="Prefeitura">nível {p.level}</Row>
          <Row label="Troféus">🏆 {p.trophies}</Row>
          {p.clan && <Row label="Clã">{p.clan}</Row>}
          {p.shield > Date.now() && <Row label="Escudo" tone="text-sky-300">{clock((p.shield - Date.now()) / 1000)}</Row>}
        </Card>
      ) : (
        <Card>
          <Row label="Dificuldade">{'⭐'.repeat(CITY[id].level)}</Row>
          <Row label="Saque">🪙 {formatNumber(base!.moedas)} 🌾 {formatNumber(base!.farinha)}</Row>
          {v.conquered[id] ? <p className="text-emerald-300 font-bold">🚩 Conquistada: paga tributo</p> : <p className="text-slate-400">3 estrelas conquistam a cidade e rendem tributo.</p>}
        </Card>
      )}
      <Row label="Seu exército">{V.spaceUsed() ? TROOP_IDS.filter((t) => v.army[t]).map((t) => `${TROOPS[t].icon}${v.army[t]}`).join(' ') || 'treinando...' : 'vazio'}</Row>
      {ally ? <p className="text-emerald-300">É do seu clã. Não dá para atacar.</p> : <Button variant="danger" size="lg" fullWidth disabled={busy} onClick={onAttack}>{busy ? 'Carregando...' : '⚔️ Atacar'}</Button>}
    </div>
  );
};

// ===================== Vila =====================
type Sheet = '' | 'loja' | 'tropas' | 'cla' | 'ranking' | 'missoes' | 'diario';
const NAV: [Sheet, string, string][] = [['loja', '🏗️', 'Construir'], ['tropas', '🪖', 'Tropas'], ['cla', '🛡️', 'Clã'], ['ranking', '🏆', 'Ranking'], ['missoes', '🎯', 'Missões'], ['diario', '📜', 'Diário']];

const VillageView: React.FC<{ onMap: () => void }> = ({ onMap }) => {
  V.useVillage();
  const ref = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Village3D | null>(null);
  const [sheet, setSheet] = useState<Sheet>('');
  const [picked, setPicked] = useState(0);
  const [place, setPlace] = useState<{ b: BuildId; x: number; y: number; move: number } | null>(null);
  const state = useRef({ place, picked });
  state.current = { place, picked };
  const v = V.me();
  const now = Date.now();

  useEffect(() => {
    const s = new Village3D(ref.current!);
    s.onTap = (x, y, id, held) => {
      if (held) return;
      const pl = state.current.place;
      if (pl) {
        const half = BUILDS[pl.b].size / 2;
        setPlace({ ...pl, x: Math.max(1, Math.min(GRID - 1 - half * 2, Math.round(x - half))), y: Math.max(1, Math.min(GRID - 1 - half * 2, Math.round(y - half))) });
        return;
      }
      sound.playClick();
      setPicked(id);
    };
    scene.current = s;
    return () => s.destroy();
  }, []);
  useEffect(() => {
    scene.current?.setItems(v.builds.map((p) => ({ ...p, busy: p.done > 0 })));
  });
  useEffect(() => {
    if (place) scene.current?.setGhost(place.b, place.x, place.y, V.fits(place.b, place.x, place.y, place.move));
    else if (picked) scene.current?.select(picked);
    else scene.current?.setGhost(null);
  }, [place, picked]);

  const confirm = () => {
    if (!place) return;
    if (place.move) {
      if (toast(V.move(place.move, place.x, place.y))) setPlace(null);
      return;
    }
    if (!toast(V.build(place.b, place.x, place.y))) return;
    sound.playBuy();
    // Muros em sequência: já prepara o próximo ao lado
    if (place.b === 'muro' && V.countOf('muro') < V.maxOf('muro')) {
      const next = [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([a, b]) => ({ ...place, x: place.x + a, y: place.y + b })).find((q) => V.fits('muro', q.x, q.y));
      setPlace(next ?? null);
    } else setPlace(null);
  };
  const waiting = v.builds.reduce((s, p) => s + V.pending(p, now), 0) + V.pendingTribute(now);
  const item = v.builds.find((p) => p.id === picked);

  return (
    <>
      <canvas ref={ref} className="absolute inset-0 w-full h-full touch-none" aria-label="Sua vila em 3D" />
      <header className="safe-top absolute top-0 inset-x-0 p-2 space-y-1.5 pointer-events-none">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar text-xs font-bold font-mono">
          <Pill icon="🪙" value={v.moedas} cap={V.capOf('moedas')} />
          <Pill icon="🌾" value={v.farinha} cap={V.capOf('farinha')} />
          <span className="glass-panel rounded-full px-3 py-1.5 shrink-0">🍬 {v.rapadura}</span>
          <span className="glass-panel rounded-full px-3 py-1.5 shrink-0">🏆 {v.trophies} {leagueOf(v.trophies).icon}</span>
          <span className="glass-panel rounded-full px-3 py-1.5 shrink-0">👷 {V.freeBuilders()}/{V.BUILDERS}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="glass-panel rounded-full px-3 py-1.5 truncate">{v.name} • {CITY[v.city].name}</span>
          {v.shield > now && <span className="glass-panel rounded-full px-3 py-1.5 text-sky-300">🛡️ {clock((v.shield - now) / 1000)}</span>}
          <span title={Net.online ? 'Online' : 'Sem conexão'}>{Net.online ? '🟢' : '⚪'}</span>
        </div>
        {Net.error && <p className="glass-panel rounded-xl px-3 py-2 text-xs text-amber-300 pointer-events-auto">{Net.error}</p>}
      </header>

      {place ? (
        <div className="absolute inset-x-3 bottom-4 mx-auto max-w-sm glass-panel rounded-2xl p-3 space-y-2 safe-bottom !pb-3">
          <p className="text-sm text-center">{BUILDS[place.b].icon} {BUILDS[place.b].name}: toque onde quer colocar</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setPlace(null)}>Cancelar</Button>
            <Button disabled={!V.fits(place.b, place.x, place.y, place.move)} onClick={confirm}>{place.move ? 'Mover' : 'Construir'}</Button>
          </div>
        </div>
      ) : (
        <footer className="absolute bottom-0 inset-x-0 p-2 space-y-2 safe-bottom !pb-2 pointer-events-none">
          <div className="flex items-end justify-between gap-2">
            <button onClick={() => { const n = V.collect(); if (n) { sound.playBuy(); hooks.toast(`+${formatNumber(n)} coletados`, 'success'); } else hooks.toast('Armazéns cheios.', 'danger'); }} disabled={waiting < 1} className="pointer-events-auto glass-panel rounded-2xl px-4 py-2.5 text-sm font-bold disabled:opacity-40">🧺 Coletar {waiting >= 1 && formatNumber(waiting)}</button>
            <button onClick={onMap} className="pointer-events-auto rounded-2xl px-5 py-3 font-black text-white bg-gradient-to-b from-amber-500 to-red-700 border-2 border-amber-300 shadow-xl flex items-center gap-2 active:scale-95"><MapIcon size={20} /> Atacar!</button>
          </div>
          <nav className="grid grid-cols-6 gap-1 pointer-events-auto">
            {NAV.map(([id, icon, name]) => (
              <button key={id} onClick={() => { sound.playClick(); setSheet(id); }} className="glass-panel rounded-xl py-1.5 text-[10px] flex flex-col items-center active:scale-95"><span className="text-lg leading-tight">{icon}</span>{name}</button>
            ))}
          </nav>
        </footer>
      )}

      <Modal isOpen={!!item && !place} onClose={() => setPicked(0)} maxWidth="sm" title={item && `${BUILDS[item.b].icon} ${BUILDS[item.b].name}`} subtitle={item && (item.level ? `Nível ${item.level}` : 'Em construção')}>
        {item && <BuildInfo p={item} onMove={() => { setPlace({ b: item.b, x: item.x, y: item.y, move: item.id }); setPicked(0); }} />}
      </Modal>
      <Modal isOpen={!!sheet} onClose={() => setSheet('')} maxWidth="md" title={NAV.find((n) => n[0] === sheet)?.slice(1).join(' ')}>
        {sheet === 'loja' && <Shop onBuy={(b) => {
          const s = V.findSpot(b);
          if (!s) return hooks.toast('Sem espaço na vila.', 'danger');
          setSheet('');
          setPlace({ b, ...s, move: 0 });
        }} />}
        {sheet === 'tropas' && <Troops />}
        {sheet === 'cla' && <Clan />}
        {sheet === 'ranking' && <Ranking />}
        {sheet === 'missoes' && <Quests />}
        {sheet === 'diario' && <Diary />}
      </Modal>
    </>
  );
};
const Pill: React.FC<{ icon: string; value: number; cap: number }> = ({ icon, value, cap }) => (
  <span className={`glass-panel rounded-full px-3 py-1.5 shrink-0 ${value >= cap ? 'text-rose-300' : ''}`}>{icon} {formatNumber(value)}<span className="opacity-50">/{formatNumber(cap)}</span></span>
);

const BuildInfo: React.FC<{ p: V.Placed; onMove: () => void }> = ({ p, onMove }) => {
  const d = BUILDS[p.b];
  const left = (p.done - Date.now()) / 1000;
  const cost = upCost(p.b, p.level + 1);
  return (
    <>
      <p className="text-sm text-slate-300">{d.text}</p>
      <Card>
        <Row label="Resistência">{hpAt(p.b, Math.max(1, p.level))}</Row>
        {d.defense && <><Row label="Dano por segundo">{Math.round(dpsAt(p.b, Math.max(1, p.level)))}</Row><Row label="Alvo">{d.defense.ground && d.defense.air ? 'chão e ar' : d.defense.air ? 'só ar' : 'só chão'}</Row></>}
        {(p.b === 'feira' || p.b === 'casafarinha') && p.level > 0 && <Row label="Produção">{produces(p.level).toFixed(1)}/s</Row>}
      </Card>
      {p.done > 0 ? (
        <>
          <Row label="Em obras">{clock(left)}</Row>
          <Button variant="gold" fullWidth onClick={() => toast(V.rush(p.id))}>Terminar agora: 🍬 {V.rushCost(left)}</Button>
        </>
      ) : p.level < MAX_LEVEL ? (
        <Button fullWidth onClick={() => { if (toast(V.upgrade(p.id))) sound.playBuy(); }}>
          Nível {p.level + 1}: {d.pay === 'moedas' ? '🪙' : '🌾'} {formatNumber(cost)} {upTime(p.b, p.level + 1) > 0 && `• ${clock(upTime(p.b, p.level + 1))}`}
        </Button>
      ) : <p className="text-center text-amber-300 font-bold">Nível máximo!</p>}
      <Button variant="outline" fullWidth onClick={onMove}>Mover</Button>
    </>
  );
};
const Shop: React.FC<{ onBuy: (b: BuildId) => void }> = ({ onBuy }) => (
  <>
    {BUILD_IDS.filter((b) => b !== 'prefeitura').map((b) => {
      const d = BUILDS[b];
      const full = V.countOf(b) >= V.maxOf(b);
      return <Action key={b} icon={d.icon} title={`${d.name} ${V.countOf(b)}/${V.maxOf(b)}`} text={d.text} button={full ? (V.hall() < MAX_LEVEL ? 'Limite' : 'Máx.') : `${d.pay === 'moedas' ? '🪙' : '🌾'} ${formatNumber(upCost(b, 1))}`} disabled={full || V.me()[d.pay] < upCost(b, 1)} variant="primary" onClick={() => onBuy(b)} />;
    })}
    <p className="text-xs text-slate-400">Evolua a Prefeitura para liberar mais.</p>
  </>
);
const Troops: React.FC = () => {
  const v = V.me();
  return (
    <>
      <Row label="Terreiro">{V.spaceUsed()}/{V.campSize()}</Row>
      <Bar value={V.spaceUsed() / Math.max(1, V.campSize())} color="bg-amber-500" />
      {v.training.length > 0 && <p className="text-xs text-slate-300">Treinando: {v.training.map((q) => `${q.n}${TROOPS[q.t].icon}`).join(' ')} • pronto em {clock((v.training[v.training.length - 1].ready - Date.now()) / 1000)}</p>}
      {TROOP_IDS.map((t) => {
        const d = TROOPS[t];
        const ok = V.canTrain(t);
        return (
          <div key={t} className={`flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 text-xs ${ok ? '' : 'opacity-50'}`}>
            <span className="text-3xl">{d.icon}</span>
            <span className="flex-1 min-w-0"><b className="block text-sm">{d.name} <span className="text-amber-300">x{v.army[t]}</span></b><span className="text-slate-400">{ok ? d.text : `Rancho nível ${d.rancho}`}</span><span className="block text-slate-500">🌾 {d.cost} • espaço {d.space}</span></span>
            <span className="flex gap-1">{[1, 5].map((n) => <Button key={n} size="sm" variant="secondary" disabled={!ok} onClick={() => toast(V.train(t, n))}>+{n}</Button>)}</span>
          </div>
        );
      })}
    </>
  );
};
const Clan: React.FC = () => {
  const v = V.me();
  const [name, setName] = useState('');
  if (!v.clan) {
    const clans = [...new Set(Net.players.map((p) => p.clan).filter(Boolean))];
    const join = (c: string) => {
      v.clan = c.trim().slice(0, 14);
      V.touch();
      publish();
    };
    return (
      <>
        <p className="text-sm text-slate-300">Clãs trocam tropas e não se atacam. Entre em um ou crie o seu.</p>
        {clans.map((c) => <Action key={c} icon="🛡️" title={c} text={`${Net.players.filter((p) => p.clan.toLowerCase() === c.toLowerCase()).length} membro(s)`} button="Entrar" onClick={() => join(c)} />)}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim().length > 1) join(name); }}>
          <input value={name} maxLength={14} onChange={(e) => setName(e.target.value)} placeholder="Nome do clã" className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 outline-none" />
          <Button type="submit">Criar</Button>
        </form>
      </>
    );
  }
  const members = Net.players.filter((p) => p.clan.toLowerCase() === v.clan.toLowerCase()).sort((a, b) => b.trophies - a.trophies);
  const give = TROOP_IDS.find((t) => v.army[t] > 0);
  return (
    <>
      <Row label="Seu clã">🛡️ {v.clan}</Row>
      {members.map((p) => (
        <Action key={p.city} icon="👤" title={p.name} text={`${CITY[p.city].name} • 🏆 ${p.trophies}`} button={p.city === v.city ? 'Você' : give ? `Doar ${TROOPS[give].icon}` : 'Sem tropa'} disabled={p.city === v.city || !give} onClick={() => give && donate(p.city, give)} />
      ))}
      <Card title="Conversa">
        <div className="flex flex-wrap gap-1.5">{CLAN_PHRASES.map((p, i) => <button key={p} onClick={() => say(i)} className="rounded-full bg-slate-800 border border-slate-700 px-3 py-2 active:scale-95">{p}</button>)}</div>
        {Net.chat.map((c) => <p key={c.at + c.by}><b className="text-amber-300">{c.by}:</b> {CLAN_PHRASES[c.i] ?? ''}</p>)}
      </Card>
      <Button variant="outline" size="sm" fullWidth onClick={() => { v.clan = ''; Net.chat = []; V.touch(); publish(); }}>Sair do clã</Button>
    </>
  );
};
const Ranking: React.FC = () => {
  const list = [...Net.players].sort((a, b) => b.trophies - a.trophies);
  return (
    <>
      {!list.length && <p className="text-sm text-slate-400">Nenhum jogador online ainda. Chame os amigos!</p>}
      {list.map((p, i) => (
        <div key={p.city} className={`flex items-center gap-3 rounded-xl border p-2.5 text-sm ${p.city === V.me().city ? 'border-amber-400 bg-amber-950/40' : 'border-slate-800 bg-slate-950/70'}`}>
          <b className="w-8 text-center">{['🥇', '🥈', '🥉'][i] ?? i + 1}</b>
          <span className="flex-1 min-w-0"><b className="block truncate">{p.name}{p.clan && <span className="text-sky-300"> [{p.clan}]</span>}</b><span className="text-xs text-slate-400">{CITY[p.city].name} • 🚩 {p.conquered}</span></span>
          <span className="font-mono">{leagueOf(p.trophies).icon} {p.trophies}</span>
        </div>
      ))}
    </>
  );
};
const Quests: React.FC = () => {
  const setScreen = useApp((s) => s.setScreen);
  const [sure, setSure] = useState(false);
  return (
    <>
      {V.QUESTS.map((q) => <Row key={q.id} label={<span className={V.me().quests.includes(q.id) ? 'line-through text-emerald-300' : 'text-slate-200'}>{q.text}</span>}>{V.me().quests.includes(q.id) ? '✔' : `🍬 ${q.prize}`}</Row>)}
      <div className="grid grid-cols-1 gap-2 pt-3">
        <Button variant="secondary" onClick={() => setScreen('home')}>Voltar ao menu</Button>
        <Button variant={sure ? 'danger' : 'outline'} onClick={async () => {
          if (!sure) return setSure(true);
          await leaveCity();
          V.abandon();
          setScreen('home');
        }}>{sure ? 'Apagar tudo mesmo? Toque de novo' : 'Abandonar a vila'}</Button>
      </div>
    </>
  );
};
const Diary: React.FC = () => (
  <>
    {!V.me().log.length && <p className="text-sm text-slate-400">Nenhum ataque ainda.</p>}
    {V.me().log.map((l) => (
      <div key={l.at} className={`rounded-xl border p-2.5 text-xs ${l.mine ? 'border-emerald-800' : 'border-rose-800'}`}>
        <p className="font-bold text-sm">{l.mine ? `Você atacou ${l.by}` : `${l.by} atacou você`} {'★'.repeat(l.stars)}{'☆'.repeat(3 - l.stars)}</p>
        <p className="text-slate-300">{l.mine ? '+' : '-'}🪙 {formatNumber(l.moedas)} {l.mine ? '+' : '-'}🌾 {formatNumber(l.farinha)} • 🏆 {l.trophies > 0 ? '+' : ''}{l.trophies} • {new Date(l.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
      </div>
    ))}
  </>
);

// ===================== Ataque =====================
const RaidView: React.FC<{ base: V.Base; onEnd: () => void }> = ({ base, onEnd }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const raid = useRef<Raid>(null as unknown as Raid);
  raid.current ??= startRaid(base, V.me().army);
  const [troop, setTroop] = useState<TroopId>(() => TROOP_IDS.find((t) => V.me().army[t] > 0) ?? 'vaqueiro');
  const chosen = useRef(troop);
  chosen.current = troop;
  const [, redraw] = useState(0);
  const [result, setResult] = useState<{ stars: number; percent: number; moedas: number; farinha: number; trophies: number } | null>(null);
  const r = raid.current;

  const finish = useRef(() => {});
  finish.current = () => {
    const x = raid.current;
    if (result || !x) return;
    x.over = true;
    const loot = { moedas: Math.floor(x.moedas), farinha: Math.floor(x.farinha) };
    const got = V.applyRaid(base, x.stars, loot, survivors(x));
    if (base.player) reportRaid(base.city, x.stars, loot.moedas, loot.farinha).catch((e) => hooks.toast((e as Error).message, 'danger'));
    setResult({ stars: x.stars, percent: x.percent, ...got });
    if (x.stars) sound.playVictory();
    else sound.playDefeat();
    publish();
  };
  useEffect(() => {
    const s = new Village3D(ref.current!);
    s.setItems(base.builds);
    let warned = 0;
    s.onTap = (x, y) => {
      const R = raid.current;
      if (R.over) return;
      let t = chosen.current;
      if (R.left[t] < 1) {
        const next = TROOP_IDS.find((k) => R.left[k] > 0);
        if (!next) return;
        t = next;
        setTroop(next);
      }
      if (!canDeploy(R, x, y)) {
        if (Date.now() - warned > 1200) hooks.toast('Solte as tropas fora da vila.', 'danger');
        warned = Date.now();
        return;
      }
      if (deploy(R, t, x, y)) sound.playRecruit();
      redraw((n) => n + 1);
    };
    let acc = 0;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      acc = Math.min(1, acc + (now - last) / 1000);
      last = now;
      const R = raid.current;
      while (acc >= STEP && !R.over) {
        acc -= STEP;
        if (cheat.win) for (const u of R.troops) u.hp = u.max;
        stepRaid(R);
        s.syncRaid(R);
        if (R.fallen.some((b) => b.b !== 'muro')) sound.playImpact();
      }
      redraw((n) => n + 1);
      if (R.over) {
        clearInterval(timer);
        setTimeout(() => finish.current(), 900);
      }
    }, 50);
    return () => {
      clearInterval(timer);
      s.destroy();
    };
  }, [base]);

  return (
    <>
      <canvas ref={ref} className="absolute inset-0 w-full h-full touch-none" aria-label={`Ataque a ${base.name}`} />
      <header className="safe-top absolute top-0 inset-x-0 p-2 flex items-start justify-between gap-2 pointer-events-none">
        <div className="glass-panel rounded-xl px-3 py-2 text-xs space-y-0.5"><p className="font-bold">{base.name}</p><p>🪙 {formatNumber(r.moedas)}/{formatNumber(base.moedas)}</p><p>🌾 {formatNumber(r.farinha)}/{formatNumber(base.farinha)}</p></div>
        <div className="glass-panel rounded-xl px-4 py-2 text-center"><p className="text-lg leading-none">{'★'.repeat(r.stars)}<span className="opacity-30">{'★'.repeat(3 - r.stars)}</span></p><p className="text-xs font-mono">{r.percent}%</p></div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`glass-panel rounded-xl px-3 py-2 font-mono font-bold ${r.time < 20 ? 'text-rose-400' : ''}`}>⏱ {clock(r.started ? r.time : RAID_SECONDS)}</span>
          {!result && <button onClick={() => (r.started ? finish.current() : onEnd())} className="pointer-events-auto glass-btn px-3 h-10 text-xs">{r.started ? 'Encerrar' : 'Voltar'}</button>}
        </div>
      </header>
      {!r.started && <p className="absolute top-28 inset-x-6 mx-auto max-w-sm text-center glass-panel rounded-2xl p-3 text-sm pointer-events-none">Escolha a tropa embaixo e toque no chão em volta da vila. Segure para soltar várias.</p>}
      <footer className="absolute bottom-0 inset-x-0 p-2 safe-bottom !pb-2 flex gap-1.5 overflow-x-auto no-scrollbar justify-center">
        {TROOP_IDS.filter((t) => V.me().army[t] > 0 || r.left[t] > 0).map((t) => (
          <button key={t} onClick={() => setTroop(t)} disabled={r.left[t] < 1} className={`shrink-0 w-16 rounded-xl border-2 py-1.5 text-center disabled:opacity-30 ${t === troop ? 'border-amber-300 bg-amber-900/80' : 'border-slate-700 bg-slate-950/80'}`}>
            <span className="block text-2xl leading-tight">{TROOPS[t].icon}</span><b className="text-xs">x{r.left[t]}</b>
          </button>
        ))}
      </footer>
      <Modal isOpen={!!result} onClose={onEnd} maxWidth="sm" showCloseButton={false}>
        {result && (
          <div className="text-center space-y-3">
            <p className="text-5xl text-amber-300">{'★'.repeat(result.stars)}<span className="opacity-25">{'★'.repeat(3 - result.stars)}</span></p>
            <h2 className="text-2xl font-black">{result.stars ? 'Vitória!' : 'Derrota'}</h2>
            <p>{result.percent}% destruído</p>
            <p className="font-mono">+🪙 {formatNumber(result.moedas)} +🌾 {formatNumber(result.farinha)} • 🏆 {result.trophies > 0 ? '+' : ''}{result.trophies}</p>
            {result.stars === 3 && !base.player && <p className="text-emerald-300 font-bold">🚩 {CITY[base.city].name} conquistada!</p>}
            <Button size="lg" fullWidth onClick={onEnd}>Continuar</Button>
          </div>
        )}
      </Modal>
    </>
  );
};
