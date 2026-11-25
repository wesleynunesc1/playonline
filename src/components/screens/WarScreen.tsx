import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Share2, X } from 'lucide-react';
import { useApp } from '../../ui';
import { hooks } from '../../engine/state';
import { myEmblem, myName, saveProfile } from '../../lan/match';
import { RoomInfo, listRooms } from '../../lan/net';
import { sound } from '../../utils/audio';
import { formatNumber } from '../../utils/formatters';
import { useWakeLock } from '../../hooks/useDevice';
import {
  CITIES, CITY, COLORS, EMBLEMS, EVENTS, LANDMARKS, MAX_PLAYERS, MEDALS, MINUTES, MODES, PHRASES, POWERS, POWER_IDS, PowerId, RESEARCH, RULES, UNITS, UNIT_IDS, UnitId, WORKS, WORKS_IDS,
  WorksId, bonusText, cityFuel, cityIncome, researchCost, slotsOf,
} from '../../war/data';
import { W, backToLobby, career, createSolo, createWar, enterWar, kickSeat, myHome, myPlayer, mySeat, order, quitWar, ready, sayPhrase, sendPing, setOptions, setSeat, startWar, toggleRule, total, touch, useWar } from '../../war/match';
import { allied, armyCap, armySize, citiesOf, cityAt, incomeOf, popOf, scoreOf, unitPrice, worksPrice } from '../../war/sim';
import { World3D } from '../../war/world3d';
import { HelpButton } from '../panels/HelpModal';
import { Button } from '../common/Button';
import { Action, Bar, Card } from '../common/Kit';
import { Modal } from '../common/Modal';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const initial = { city: 0, sel: [] as number[], power: null as PowerId | null, rally: 0, box: false, menu: '' as '' | 'apoios' | 'pesquisa' | 'placar' | 'fala' | 'sair' };

/** Guerra Ceará 2026: menu, sala e partida */
export const WarScreen: React.FC = () => {
  useWar();
  useWakeLock();
  useEffect(() => quitWar, []);
  return W.phase === 'lobby' || W.phase === 'play' ? <Field /> : <Finder />;
};

// ===== Menu =====
const Finder: React.FC = () => {
  const setScreen = useApp((s) => s.setScreen);
  const [name, setName] = useState(myName());
  const [emblem, setEmblem] = useState(EMBLEMS.includes(myEmblem()) ? myEmblem() : EMBLEMS[0]);
  const [code, setCode] = useState('');
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () => listRooms('ce').then((r) => { if (alive) { setRooms(r); setOffline(false); } }, () => alive && setOffline(true));
    load();
    const t = setInterval(() => document.hidden || load(), 3000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const go = (fn: () => void) => {
    if (name.trim().length < 2) return hooks.toast('Escreva seu apelido primeiro.', 'danger');
    saveProfile(name.trim(), emblem);
    fn();
  };
  const busy = W.phase === 'joining';
  const c = career();
  return (
    <div className="w-full h-full flex flex-col bg-[radial-gradient(ellipse_at_top,#3a2f22,#07080a_70%)] overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-2 border-b border-slate-800 shrink-0">
        <button onClick={() => setScreen('home')} className="glass-btn h-11 px-3 gap-2 text-xs"><ArrowLeft size={16} /> Menu</button>
        <h2 className="font-black">🪖 Guerra Ceará 2026</h2>
        <span className="ml-auto"><HelpButton /></span>
      </header>
      <div className="flex-1 overflow-y-auto overscroll-contain p-4">
        <div className="max-w-4xl mx-auto grid gap-3 landscape:grid-cols-2 md:grid-cols-2 items-start">
          <div className="space-y-3">
            {W.error && <p className="rounded-xl border border-rose-500 bg-rose-950/60 p-3 text-sm text-rose-200">{W.error}</p>}
            <Card title="Quem é você?">
              <input value={name} maxLength={14} onChange={(e) => setName(e.target.value)} placeholder="Seu apelido" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 outline-none focus:border-amber-500" />
              <div className="grid grid-cols-8 gap-1">
                {EMBLEMS.map((e) => <button key={e} onClick={() => setEmblem(e)} aria-label={`Emblema ${e}`} className={`h-10 rounded-xl text-xl ${e === emblem ? 'bg-amber-600' : 'bg-slate-800'}`}>{e}</button>)}
              </div>
              {c.played > 0 && <p className="text-slate-400">{c.wins} vitórias em {c.played} partidas • {c.caps} cidades tomadas • {c.kills} abates</p>}
            </Card>
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" disabled={busy} onClick={() => go(createWar)}>📶 Criar sala</Button>
              <Button size="lg" variant="gold" disabled={busy} onClick={() => go(createSolo)}>🤖 Jogar sozinho</Button>
            </div>
          </div>
          <div className="space-y-3">
            <Card title={<span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Salas neste Wi-Fi</span>}>
              {offline && <p className="text-amber-300">Sem conexão com a internet.</p>}
              {rooms?.length === 0 && <p className="text-slate-400">Nenhuma sala ainda. Crie uma e peça para entrarem neste mesmo site.</p>}
              {rooms?.map((r) => (
                <Action key={r.code} icon="🪖" title={r.name} text={`${r.code} • ${r.players}/${MAX_PLAYERS}${r.started ? ' • em andamento' : ''}`} button={busy ? '...' : r.started ? 'Voltar' : 'Entrar'} variant="primary"
                  disabled={busy || (!r.started && r.players >= MAX_PLAYERS)} onClick={() => go(() => enterWar(r.code))} />
              ))}
            </Card>
            <Card title="Não apareceu? Use o código">
              <div className="flex gap-2">
                <input value={code} maxLength={4} autoCapitalize="characters" onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} placeholder="ABCD" className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 font-mono tracking-[0.4em] text-center outline-none focus:border-amber-500" />
                <Button disabled={code.length !== 4 || busy} onClick={() => go(() => enterWar(code))}>{busy ? 'Conectando...' : 'Entrar'}</Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// ===== Mapa, usado na sala e na partida =====
const Field: React.FC = () => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useRef<World3D | null>(null);
  const [ui, setUi] = useState(initial);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [flash, setFlash] = useState(0);
  const [failed, setFailed] = useState(false);
  const live = useRef(ui);
  live.current = ui;
  const patch = (p: Partial<typeof initial>) => setUi((u) => ({ ...u, ...p }));
  const phase = W.phase;

  useEffect(() => {
    let w: World3D;
    try {
      w = new World3D(canvas.current!);
    } catch {
      setFailed(true);
      return;
    }
    world.current = w;
    w.onFlash = () => setFlash((n) => n + 1);
    w.onRect = setRect;
    w.onBox = (sel) => patch({ sel, box: false, city: 0 });
    w.onDouble = (_, l) => { sound.playClick(); patch({ sel: l.map((u) => u.i), city: 0 }); };
    w.onTap = (t) => {
      const u = live.current;
      if (W.phase === 'lobby') {
        if (t.city) {
          setSeat({ start: t.city.id });
          w.go(t.city.x, t.city.z);
        }
        return;
      }
      const g = W.world;
      if (!g || g.over || !myPlayer().alive) return;
      if (u.power) {
        order({ c: 'power', k: u.power, x: t.x, z: t.z });
        return patch({ power: null });
      }
      if (u.rally) {
        order({ c: 'rally', city: u.rally, x: t.x, z: t.z });
        hooks.toast('Ponto de encontro marcado.', 'success');
        return patch({ rally: 0 });
      }
      if (t.unit && t.unit.o === W.me) {
        sound.playClick();
        return patch({ sel: [t.unit.i], city: 0 });
      }
      if (u.sel.length) {
        const c = t.city && Math.hypot(t.city.x - t.x, t.city.z - t.z) < 0.7 ? t.city : null;
        const foe = t.unit && !allied(g, t.unit.o, W.me) ? t.unit : null;
        order({ c: 'move', u: u.sel, x: foe?.x ?? c?.x ?? t.x, z: foe?.z ?? c?.z ?? t.z });
        sound.playRecruit();
        return;
      }
      patch({ city: t.city?.id ?? 0, menu: '' });
    };
    return () => {
      world.current = null;
      w.destroy();
    };
  }, []);
  useEffect(() => {
    if (phase !== 'play') return setUi(initial);
    const h = myHome();
    world.current?.go(h.x, h.z, 11);
  }, [phase]);
  const w3 = world.current;
  if (w3) {
    w3.selected = new Set(ui.sel);
    w3.aim = ui.power;
    w3.boxing = ui.box;
    w3.focus = ui.city;
  }
  if (failed) return <p className="m-auto p-6 text-center">Este aparelho não conseguiu abrir o mapa 3D.<br /><Button className="mt-4" onClick={quitWar}>Voltar</Button></p>;
  return (
    <div className={`war relative w-full h-full overflow-hidden ${phase === 'lobby' ? 'war-in-lobby' : ''}`}>
      <div className="war-map"><canvas ref={canvas} className="absolute inset-0 w-full h-full touch-none" aria-label="Mapa 3D do Ceará" /></div>
      {flash > 0 && <div key={flash} className="war-flash" />}
      {rect && <div className="fixed z-40 border-2 border-emerald-300 bg-emerald-300/15 pointer-events-none" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />}
      {phase === 'lobby' ? <Lobby goTo={(id) => w3?.go(CITY[id].x, CITY[id].z, 26)} /> : W.world && <Battle ui={ui} patch={patch} w3={w3} />}
    </div>
  );
};

// ===== Sala =====
const Lobby: React.FC<{ goTo: (city: number) => void }> = ({ goTo }) => {
  const me = mySeat();
  const [query, setQuery] = useState('');
  if (!me) return null;
  const share = async () => {
    const text = `Entra na minha Guerra Ceará 2026! Código ${W.code}: ${location.origin}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        hooks.toast('Convite copiado!', 'success');
      }
    } catch { /* cancelado */ }
  };
  const chip = (on: boolean) => `rounded-full px-3 py-2 border text-left ${on ? 'bg-amber-600 border-amber-300 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'}`;
  const found = query ? CITIES.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : [];
  const start = CITY[me.start];
  return (
    <>
      <button onClick={quitWar} className="absolute left-2 top-1 z-10 glass-btn h-11 px-3 gap-2 text-xs"><ArrowLeft size={16} /> Sair</button>
      <div className="war-lobby">
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-3">
          <Card title={<span className="flex justify-between gap-2"><span>Sua cidade: {start.name}</span><span className="text-amber-300">{'★'.repeat(start.level)}</span></span>}>
            <p className="text-slate-300">Toque em uma cidade no mapa ou busque. {formatNumber(start.pop)} habitantes • {start.region}{LANDMARKS[start.id] && ` • ${LANDMARKS[start.id].icon} ${bonusText(LANDMARKS[start.id].bonus)}`}</p>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar entre as 184 cidades" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 outline-none" />
            {found.length > 0 && <div className="flex flex-wrap gap-1.5">{found.map((c) => <button key={c.id} className={chip(c.id === me.start)} onClick={() => { setSeat({ start: c.id }); goTo(c.id); setQuery(''); }}>{c.name} {c.level}★</button>)}</div>}
          </Card>
          <Card title={W.solo ? 'Exércitos' : `Jogadores ${W.seats.length}/${MAX_PLAYERS}`}>
            {W.seats.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 rounded-xl bg-slate-900/80 border border-slate-800 p-2">
                <span className="text-xl w-9 h-9 grid place-items-center rounded-full" style={{ background: COLORS[i] }}>{p.emblem}</span>
                <button className="flex-1 min-w-0 text-left" onClick={() => goTo(p.start)}><b className="block truncate">{p.name}{i === 0 && !W.solo && ' 👑'}{p.id === W.seat && ' (você)'}</b><span className="text-slate-400">{CITY[p.start].name}{W.mode === 'equipes' && ` • Time ${i % 2 ? 'B' : 'A'}`}</span></button>
                {!W.solo && <span className={p.ready ? 'text-emerald-300 font-bold' : 'text-slate-500'}>{p.ready ? 'Pronto' : 'Escolhendo'}</span>}
                {W.host && p.id !== W.seat && <button onClick={() => kickSeat(p.id)} aria-label={`Remover ${p.name}`} className="glass-btn w-9 h-9">✕</button>}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400">Robôs:</span>
              {[0, 1, 2, 3, 4, 5].filter((n) => W.seats.length + n <= MAX_PLAYERS && (!W.solo || n)).map((n) => <button key={n} disabled={!W.host} className={chip(W.bots === n)} onClick={() => setOptions({ bots: n })}>{n}</button>)}
            </div>
            {W.bots > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-slate-400">Nível:</span>{['Fácil', 'Normal', 'Difícil'].map((t, i) => <button key={t} disabled={!W.host} className={chip(W.skill === i + 1)} onClick={() => setOptions({ skill: i + 1 })}>{t}</button>)}</div>}
            {!W.solo && <Button size="sm" variant="outline" fullWidth icon={<Share2 size={14} />} onClick={share}>Convidar (código {W.code})</Button>}
          </Card>
          <Card title="Modo e tempo">
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-1.5">
              {MODES.map((m) => (
                <button key={m.id} disabled={!W.host} onClick={() => setOptions({ mode: m.id })} className={`text-left rounded-xl border p-2 ${W.mode === m.id ? 'border-amber-400 bg-amber-950/40' : 'border-slate-800 bg-slate-900/60'} ${!W.host && W.mode !== m.id ? 'hidden' : ''}`}><b>{m.icon} {m.name}</b><span className="block text-slate-300">{m.text}</span></button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">{MINUTES.map((n) => <button key={n} disabled={!W.host} className={chip(W.minutes === n)} onClick={() => setOptions({ minutes: n })}>{n} min</button>)}</div>
          </Card>
          <Card title={`Regras extras ${W.rules.length ? `(${W.rules.length})` : ''}`}>
            <div className="flex flex-wrap gap-1.5">
              {RULES.filter((r) => W.host || W.rules.includes(r.id)).map((r) => <button key={r.id} disabled={!W.host} title={r.text} className={chip(W.rules.includes(r.id))} onClick={() => toggleRule(r.id)}>{r.icon} {r.name}{W.rules.includes(r.id) && <span className="block text-[10px]">{r.text}</span>}</button>)}
              {!W.host && !W.rules.length && <span className="text-slate-400">Nenhuma</span>}
            </div>
          </Card>
        </div>
        <div className="p-3 pt-2 shrink-0 border-t border-slate-800">
          {W.host
            ? <Button size="lg" variant="gold" fullWidth disabled={!ready()} onClick={startWar}>{total() < 2 ? 'Esperando jogadores ou robôs' : ready() ? 'Começar a guerra!' : 'Esperando todos ficarem prontos'}</Button>
            : <Button size="lg" variant={me.ready ? 'secondary' : 'gold'} fullWidth onClick={() => setSeat({ ready: !me.ready })}>{me.ready ? 'Cancelar' : 'Estou pronto!'}</Button>}
        </div>
      </div>
    </>
  );
};

// ===== Partida =====
type Ui = typeof initial;
interface BattleProps { ui: Ui; patch: (p: Partial<Ui>) => void; w3: World3D | null }
const Battle: React.FC<BattleProps> = ({ ui, patch, w3 }) => {
  const w = W.world!;
  const me = myPlayer();
  const [m, f] = incomeOf(w, W.me);
  const mine = citiesOf(w, W.me);
  const army = w.units.filter((u) => u.o === W.me);
  const sel = army.filter((u) => ui.sel.includes(u.i));
  const ids = sel.map((u) => u.i);
  const attacked = mine.find((c) => c.hit > 0);
  const rank = [...w.players].sort((a, b) => Number(b.alive) - Number(a.alive) || scoreOf(w, b.i) - scoreOf(w, a.i));
  const close = () => patch({ sel: [], city: 0, power: null, rally: 0, box: false, menu: '' });
  const hint = ui.power ? `${POWERS[ui.power].icon} Toque onde quer usar` : ui.rally ? 'Toque onde as tropas novas devem ir' : ui.box ? 'Arraste para desenhar a área' : '';
  const kinds = UNIT_IDS.map((k) => [k, sel.filter((u) => u.k === k)] as const).filter(([, l]) => l.length);
  const chatNow = W.chat.filter((b) => Date.now() - b.at < 5000);
  const panel = ui.city > 0 || (ui.menu && ui.menu !== 'sair');
  return (
    <>
      <div className="war-hud">
        <div className="flex gap-1 items-center">
          <span className="war-chip text-amber-200">💰 {formatNumber(me.money)} <i>+{Math.round(m)}</i></span>
          <span className="war-chip text-orange-200">⛽ {formatNumber(me.fuel)} <i>+{Math.round(f)}</i></span>
          <span className="war-chip">🪖 {army.length}/{armyCap(w, W.me)}</span>
          <span className="war-chip">🏙️ {mine.length}</span>
          <span className={`war-chip font-mono ${w.left < 60 ? 'text-rose-300' : ''}`}>⏱ {clock(w.left)}</span>
        </div>
        <div className="flex gap-1 items-center">
          {rank.map((p) => (
            <button key={p.i} className={`war-chip ${p.alive ? '' : 'opacity-40 line-through'}`} style={{ borderColor: p.color }} onClick={() => patch({ menu: 'placar', city: 0 })}>{p.emblem} {p.i === W.me ? 'Você' : p.name.split(' ').pop()} <i>{w.mode === 'capital' ? `${scoreOf(w, p.i)}s` : formatNumber(scoreOf(w, p.i))}</i></button>
          ))}
          {w.event && <span className="war-chip text-sky-200">{EVENTS[w.event.i].icon} {EVENTS[w.event.i].name} <i>{Math.ceil(w.event.left)}s</i></span>}
        </div>
      </div>
      <div className="war-log" aria-live="polite">
        {W.lost && <p className="!bg-rose-900/80">Conexão caiu. Reconectando...</p>}
        {W.paused && <p>⏸ Pausado</p>}
        {!me.alive && !w.over && <p className="!bg-rose-900/80">Você foi eliminado. Assista ao fim da guerra.</p>}
        {w.log.slice(0, 2).map((l, i) => <p key={l.t + i} className={l.k === 'alert' ? 'text-rose-200' : l.k === 'event' ? 'text-sky-200' : ''}>{l.t}</p>)}
        {chatNow.map((b) => <p key={b.i} className="speech" style={{ borderLeft: `4px solid ${w.players[b.i]?.color}` }}>{w.players[b.i]?.name}: {b.text}</p>)}
        {attacked && <button className="!bg-rose-800/90 pointer-events-auto animate-pulse" onClick={() => w3?.go(attacked.x, attacked.z, 10)}>⚠️ {CITY[attacked.id].name} sob ataque! Ver</button>}
      </div>

      <div className="war-left">
        <Tool icon="🏠" name="Base" onClick={() => { const c = mine.find((x) => x.id === me.start) ?? mine[0]; if (c) w3?.go(c.x, c.z, 11); }} />
        <Tool icon="⬚" name="Área" on={ui.box} onClick={() => patch({ box: !ui.box, power: null, rally: 0 })} />
        <Tool icon="🪖" name="Todas" onClick={() => patch({ sel: army.map((u) => u.i), city: 0, menu: '' })} />
        <Tool icon="💥" name="Apoios" on={ui.menu === 'apoios'} onClick={() => patch({ menu: ui.menu === 'apoios' ? '' : 'apoios', city: 0, power: null })} />
        <Tool icon="🔬" name="Pesquisa" on={ui.menu === 'pesquisa'} onClick={() => patch({ menu: ui.menu === 'pesquisa' ? '' : 'pesquisa', city: 0 })} />
        <Tool icon="💬" name="Falar" on={ui.menu === 'fala'} onClick={() => patch({ menu: ui.menu === 'fala' ? '' : 'fala', city: 0 })} />
        {W.solo && <Tool icon={W.paused ? '▶' : '⏸'} name={W.paused ? 'Voltar' : 'Pausar'} onClick={() => { W.paused = !W.paused; touch(); }} />}
        <Tool icon="🚪" name="Sair" onClick={() => patch({ menu: 'sair' })} />
      </div>

      {(hint || sel.length > 0) && !panel && (
        <div className="war-bar">
          {hint
            ? <p className="flex items-center justify-between gap-2 text-sm font-bold">{hint}<button onClick={close} aria-label="Cancelar" className="glass-btn w-11 h-11"><X size={18} /></button></p>
            : <>
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {kinds.map(([k, l]) => <button key={k} className="war-unit" title={`Só ${UNITS[k].name}`} onClick={() => patch({ sel: l.map((u) => u.i) })}>{UNITS[k].icon}<b>{l.length}</b><Bar value={l.reduce((s, u) => s + u.hp / u.max, 0) / l.length} color="bg-emerald-500" /></button>)}
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => order({ c: 'stop', u: ids })}>✋ Parar</Button>
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => { const c = [...mine].sort((a, b) => Math.hypot(a.x - sel[0].x, a.z - sel[0].z) - Math.hypot(b.x - sel[0].x, b.z - sel[0].z))[0]; if (c) order({ c: 'move', u: ids, x: c.x, z: c.z, hold: true }); }}>↩ Recuar</Button>
                <Button size="sm" variant="secondary" onClick={() => w3?.go(sel[0].x, sel[0].z, 9)}>👁</Button>
                <Button size="sm" variant="danger" onClick={close}>✕</Button>
              </div>
            </>}
        </div>
      )}

      {panel && (
        <div className="war-panel">
          <button onClick={close} aria-label="Fechar" className="absolute right-2 top-2 z-10 glass-btn w-10 h-10"><X size={18} /></button>
          {ui.city > 0 && <CityPanel id={ui.city} patch={patch} w3={w3} />}
          {ui.menu === 'apoios' && <Supports patch={patch} />}
          {ui.menu === 'pesquisa' && <Research />}
          {ui.menu === 'placar' && <Score />}
          {ui.menu === 'fala' && (
            <>
              <h3 className="font-bold pr-12">💬 Falar com todos</h3>
              <div className="grid grid-cols-2 gap-1.5">{PHRASES.map((p, i) => <Button key={p} size="sm" variant="secondary" onClick={() => { sayPhrase(i); close(); }}>{p}</Button>)}</div>
              <Button size="sm" variant="gold" fullWidth onClick={() => { const c = w3?.center(); if (c) sendPing(c.x, c.z); close(); }}>📍 Marcar o centro da tela no mapa</Button>
            </>
          )}
        </div>
      )}
      <Modal isOpen={ui.menu === 'sair'} onClose={() => patch({ menu: '' })} maxWidth="sm" title="Sair da guerra?">
        <p className="text-sm text-slate-300">{W.solo ? 'A partida será encerrada.' : W.host ? 'Você criou a sala: se sair, a partida acaba para todos.' : 'Um robô vai comandar seu exército. Você pode voltar pela lista de salas.'}</p>
        <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => patch({ menu: '' })}>Ficar</Button><Button variant="danger" onClick={quitWar}>Sair</Button></div>
      </Modal>
      {w.over && <End />}
    </>
  );
};
const Tool: React.FC<{ icon: string; name: string; on?: boolean; onClick: () => void }> = ({ icon, name, on, onClick }) => (
  <button className={`war-tool ${on ? 'on' : ''}`} onClick={() => { sound.playClick(); onClick(); }}><span>{icon}</span><small>{name}</small></button>
);
const Cost: React.FC<{ v: [number, number] }> = ({ v: [m, f] }) => {
  const p = myPlayer();
  return <span className="text-[10px]"><span className={p.money < m ? 'text-rose-300' : 'text-amber-200'}>💰{m}</span>{f > 0 && <span className={p.fuel < f ? 'text-rose-300' : 'text-orange-200'}> ⛽{f}</span>}</span>;
};

const CityPanel: React.FC<{ id: number; patch: BattleProps['patch']; w3: World3D | null }> = ({ id, patch, w3 }) => {
  const w = W.world!;
  const s = cityAt(w, id);
  const c = CITY[id];
  const owner = w.players[s.owner];
  const own = s.owner === W.me;
  const [tab, setTab] = useState<'treinar' | 'construir' | 'obras'>('treinar');
  const slots = slotsOf(c.level) + (id === owner?.start ? 1 : 0);
  const trainable = UNIT_IDS.filter((k) => s.works.some((x) => x.k === UNITS[k].from && x.left <= 0));
  return (
    <>
      <div className="pr-12">
        <h3 className="font-bold text-base">{LANDMARKS[id]?.icon ?? '🏙️'} {c.name} <span className="text-amber-300">{c.level}★</span></h3>
        <p className="text-slate-300">{owner ? <span style={{ color: owner.color }}>{owner.emblem} {own ? 'Sua cidade' : owner.name}</span> : 'Neutra'} • {formatNumber(c.pop)} hab. • +{Math.round(cityIncome(c.level) * 10) / 10} 💰/s +{Math.round(cityFuel(c.level) * 10) / 10} ⛽/s</p>
        {LANDMARKS[id] && <p className="text-sky-200">{LANDMARKS[id].name}: {bonusText(LANDMARKS[id].bonus)}</p>}
      </div>
      <Bar value={s.hp / s.max} color={s.hp / s.max < 0.35 ? 'bg-rose-500' : 'bg-emerald-500'} />
      {!own && <p className="text-slate-300">Defesa {Math.round((s.hp / s.max) * 100)}%. Escolha tropas e toque nesta cidade para atacar. Zere a defesa e deixe infantaria ou blindados no centro.</p>}
      {own && (
        <>
          {s.q.length > 0 && <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">{s.q.map((q, i) => <span key={i} className="war-unit">{UNITS[q.u].icon}{i === 0 && <b>{Math.ceil(q.left)}s</b>}</span>)}<Button size="sm" variant="outline" onClick={() => order({ c: 'cancel', city: id })}>✕</Button></div>}
          <div className="grid grid-cols-3 gap-1">{(['treinar', 'construir', 'obras'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-lg py-2 font-bold capitalize ${tab === t ? 'bg-amber-600' : 'bg-slate-800'}`}>{t === 'obras' ? `Obras ${s.works.length}/${slots}` : t}</button>)}</div>
          {tab === 'treinar' && (trainable.length === 0 ? <p className="text-amber-200">Construa um Quartel para treinar tropas aqui.</p> : (
            <>
              <div className="war-grid">
                {trainable.map((k: UnitId) => <button key={k} className="war-item" title={UNITS[k].text} onClick={() => order({ c: 'train', city: id, k })} onContextMenu={(e) => { e.preventDefault(); order({ c: 'train', city: id, k, n: 5 }); }}><span className="text-2xl">{UNITS[k].icon}</span><b>{UNITS[k].name}</b><small>{UNITS[k].text}</small><Cost v={unitPrice(w, W.me, k)} /></button>)}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => patch({ rally: id, city: 0 })}>🚩 Ponto de encontro</Button>
                <Button size="sm" variant="secondary" onClick={() => patch({ city: 0, sel: w.units.filter((u) => u.o === W.me && Math.hypot(u.x - s.x, u.z - s.z) < 2).map((u) => u.i) })}>🪖 Tropas daqui</Button>
              </div>
            </>
          ))}
          {tab === 'construir' && (
            <div className="war-grid">
              {WORKS_IDS.map((k: WorksId) => <button key={k} className="war-item" disabled={c.level < WORKS[k].level || s.works.length >= slots} onClick={() => order({ c: 'build', city: id, k })}><span className="text-2xl">{WORKS[k].icon}</span><b>{WORKS[k].name}</b><small>{c.level < WORKS[k].level ? `Só em cidade ${WORKS[k].level}★` : WORKS[k].text}</small><Cost v={worksPrice(w, W.me, k)} /></button>)}
            </div>
          )}
          {tab === 'obras' && (s.works.length ? s.works.map((k, n) => <Action key={n} icon={WORKS[k.k].icon} title={WORKS[k.k].name} text={k.left > 0 ? `Em obras: ${Math.ceil(k.left)}s` : WORKS[k.k].text} button="Vender" disabled={k.k === 'comando'} onClick={() => order({ c: 'sell', city: id, n })} />) : <p className="text-slate-400">Nada construído.</p>)}
        </>
      )}
      <Button size="sm" variant="outline" fullWidth onClick={() => w3?.go(c.x, c.z, 9)}>👁 Ver no mapa</Button>
    </>
  );
};

const Supports: React.FC<{ patch: BattleProps['patch'] }> = ({ patch }) => {
  const p = myPlayer();
  return (
    <>
      <h3 className="font-bold pr-12">💥 Apoios</h3>
      <div className="war-grid">
        {POWER_IDS.map((k) => {
          const cool = p.cool[k] ?? 0;
          return <button key={k} className="war-item" disabled={cool > 0 || p.money < POWERS[k].money} onClick={() => patch({ power: k, menu: '', sel: [] })}><span className="text-2xl">{POWERS[k].icon}</span><b>{POWERS[k].name}</b><small>{POWERS[k].text}</small>{cool > 0 ? <span className="text-sky-200">{Math.ceil(cool)}s</span> : <Cost v={[POWERS[k].money, 0]} />}</button>;
        })}
      </div>
    </>
  );
};
const Research: React.FC = () => {
  const p = myPlayer();
  return (
    <>
      <h3 className="font-bold pr-12">🔬 Pesquisa</h3>
      <div className="war-grid">
        {RESEARCH.map((r) => {
          const lvl = p.res[r.id] ?? 0;
          return <button key={r.id} className="war-item" disabled={lvl >= 3 || p.money < researchCost(lvl)} onClick={() => order({ c: 'research', id: r.id })}><span className="text-2xl">{r.icon}</span><b>{r.name} {lvl}/3</b><small>{lvl < 3 ? `${r.levels[lvl]}: ${bonusText(r.per)}` : 'Completa'}</small>{lvl < 3 && <Cost v={[researchCost(lvl), 0]} />}</button>;
        })}
      </div>
    </>
  );
};
const Score: React.FC = () => {
  const w = W.world!;
  return (
    <>
      <h3 className="font-bold pr-12">{MODES.find((m) => m.id === w.mode)?.icon} {MODES.find((m) => m.id === w.mode)?.name}</h3>
      <p className="text-slate-300">{MODES.find((m) => m.id === w.mode)?.text}</p>
      {[...w.players].sort((a, b) => popOf(w, b.i) - popOf(w, a.i)).map((p) => (
        <div key={p.i} className={`rounded-xl border p-2 bg-slate-900/70 ${p.alive ? '' : 'opacity-40'}`} style={{ borderColor: p.color }}>
          <b>{p.emblem} {p.name}{!p.online && ' 📴'}</b>
          <span className="block text-slate-300">🏙️ {citiesOf(w, p.i).length} • 👥 {formatNumber(popOf(w, p.i))} • 🪖 {armySize(w, p.i)} • 💀 {Math.round(p.stats.kills ?? 0)}</span>
        </div>
      ))}
    </>
  );
};
const End: React.FC = () => {
  const w = W.world!;
  const won = w.players[w.over!.rank[0]].team === myPlayer().team;
  useEffect(() => { (won ? sound.playVictory() : sound.playDefeat()); }, []);
  const medals = MEDALS.map((m) => {
    const best = [...w.players].sort((a, b) => (b.stats[m.stat] ?? 0) - (a.stats[m.stat] ?? 0))[0];
    return { ...m, who: best, n: Math.round(best.stats[m.stat] ?? 0) };
  }).filter((m) => m.n > 0);
  return (
    <Modal isOpen onClose={() => {}} showCloseButton={false} maxWidth="lg" title={`${won ? '🏆' : '🏳️'} ${w.over!.title}`} subtitle={`${won ? 'Vitória' : 'Derrota'} • ${clock(w.t)} de guerra`}>
      {w.over!.rank.map((i, n) => {
        const p = w.players[i];
        return <div key={i} className="podium flex items-center gap-2 text-sm rounded-xl border p-2" style={{ borderColor: p.color, animationDelay: `${n * 0.1}s` }}><b className="w-6">{n + 1}º</b><span className="flex-1 truncate">{p.emblem} {p.name}{i === W.me && ' (você)'}</span><span className="text-slate-300 text-xs">🏙️ {citiesOf(w, i).length} • 💀 {Math.round(p.stats.kills ?? 0)}</span></div>;
      })}
      <div className="grid grid-cols-2 gap-1.5 text-xs">{medals.map((m) => <p key={m.name} className="rounded-lg bg-slate-800/70 p-2">{m.icon} <b>{m.name}</b><span className="block text-slate-300 truncate">{m.who.name}: {formatNumber(m.n)}</span></p>)}</div>
      {W.host ? <Button variant="gold" size="lg" fullWidth onClick={backToLobby}>Jogar de novo</Button> : <p className="text-center text-slate-300 text-sm">Esperando quem criou a sala...</p>}
      <Button variant="outline" fullWidth onClick={quitWar}>Sair</Button>
    </Modal>
  );
};
