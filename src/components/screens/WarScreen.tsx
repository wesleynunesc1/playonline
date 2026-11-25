import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bomb, Shield, ArrowLeft, Atom, BookOpen, Building2, Camera, Clock, Cloud, Coins, Crown, Eye, FastForward, Fuel, Globe2, Handshake, Home, Landmark, LogOut, Menu as MenuIcon, MessageCircle, Microscope, Pause, Plane, Play, Radiation, Rocket, Satellite, Settings as Gear, Share2, Sparkles, SquareDashed, Star, Target, TrendingUp, Trophy, Users, Wrench, X, Zap } from 'lucide-react';
import { useApp } from '../../ui';
import { hooks } from '../../engine/state';
import { myEmblem, myName, saveProfile } from '../../lan/match';
import { RoomInfo, listRooms } from '../../lan/net';
import { sound } from '../../utils/audio';
import { formatNumber } from '../../utils/formatters';
import { useWakeLock } from '../../hooks/useDevice';
import {
  CITIES, CITY, COLORS, emblemLevel, ERAS, MAX_DEV, REL, REL_COLOR, REL_NAME, UNIT_ERA, WORKS_ERA, annexCost, annexTime, devCost, EMBLEMS, EVENTS, LANDMARKS, MAX_PLAYERS, MEDALS, MINUTES, MODES, NUKES, PHRASES, POWERS, POWER_IDS, PowerId, QUESTS, RESEARCH, RULES, UNITS, UNIT_IDS, UnitId, WORKS, WORKS_IDS,
  WorksId, bonusText, cityFuel, cityIncome, researchCost,
} from '../../war/data';
import { W, askPause, deleteSave, loadFavorite, prefs, saveFavorite, shuffleRules, shuffleSeats, backToLobby, career, careerLevel, resumeSolo, savedSolo, createSolo, createWar, enterWar, kickSeat, playReplay, stopReplay, myHome, myPlayer, mySeat, order, quitWar, ready, sayPhrase, sendPing, setOptions, setSeat, startWar, toggleRule, total, touch, useWar } from '../../war/match';
import { allied, annexBlock, atWar, hostile, armyCap, armySize, citiesOf, cityAt, incomeOf, irradiated, needOf, popOf, questValue, relOf, slotsIn, tradesOf, scoreOf, unitPrice, worksPrice } from '../../war/sim';
import { Quality, World3D, savedQuality } from '../../war/world3d';
import { BOUNDS } from '../../war/terrain';
import { thumbs } from '../../war/thumbs';
import { DILEMMAS, DOCTRINES, POLICIES, SPIES, SpyId, VICTORIES, WONDERS, marketPrice, mercPrice, moodTarget, odds, policySlots, studyFactor, tradeRate, victoryOf, wonderBlock, wonderOf } from '../../war/nation';
import { Ico, Rich } from '../../war/icons';
import { Cabinet, CareerModal, CityList, Encyclopedia, Exchange, GoalBar, Lab, Merchant, Modes, News, Report, Settings, TIPS, Tutorial, VoteBar, advise } from '../panels/WarPanels';
import { music, speak } from '../../utils/music';
import { CARGO, FORMATIONS, KITS, STANCES, pactOf, synergyOf, upgradeCost } from '../../war/realm';
import { HelpButton } from '../panels/HelpModal';
import { Button } from '../common/Button';
import { Action, Bar, Card } from '../common/Kit';
import { Modal } from '../common/Modal';

const Pic: React.FC<{ k: string; e: string; big?: boolean }> = ({ k, e, big }) => {
  const src = thumbs()[k];
  return src ? <img src={src} alt="" draggable={false} className={big ? 'war-pic big' : 'war-pic'} /> : <span className={big ? 'text-2xl' : ''}>{e}</span>;
};
const POWER_ICON: Record<PowerId, React.ReactNode> = {
  barragem: <Target />, aereo: <Plane />, fumaca: <Cloud />, emp: <Zap />, paraquedas: <Users />, minas: <Bomb />, barreira: <Shield />, satelite: <Satellite />, reparo: <Wrench />, tatica: <Radiation />, balistico: <Rocket />, hidrogenio: <Atom />,
};
const nearest = (x: number, z: number) => CITIES.reduce((b, c) => (Math.hypot(c.x - x, c.z - z) < Math.hypot(b.x - x, b.z - z) ? c : b)).name;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const initial = { city: 0, sel: [] as number[], power: null as PowerId | null, rally: 0, box: false, menu: '' as '' | 'apoios' | 'pesquisa' | 'placar' | 'fala' | 'missoes' | 'mais' | 'sair' | 'diplomacia' | 'era' | 'video' | 'governo' | 'maravilhas' | 'gabinete' | 'bolsa' | 'mundo' | 'cidades' | 'enciclopedia', strike: 0, form: 0, queue: false, place: null as [number, number] | null, route: 0 as 0 | 1, photo: false, groups: [[], [], []] as number[][] };

/** Guerra Ceará 2026: menu, sala e partida */
export const WarScreen: React.FC = () => {
  useWar();
  useWakeLock();
  useEffect(() => quitWar, []);
  return <Field />;
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
  const lv = careerLevel(c);
  const saves = [0, 1, 2].map((n) => ({ n, s: savedSolo(n) })).filter((x) => x.s);
  const tip = useMemo(() => TIPS[Math.floor(Math.random() * TIPS.length)], []);
  const [feats, setFeats] = useState(false);
  return (
    <div className="war-menu">
      <header className="flex items-center gap-3 px-4 py-2 shrink-0">
        <button onClick={() => setScreen('home')} className="glass-btn h-11 px-3 gap-2 text-xs"><ArrowLeft size={16} /> Menu</button>
                <span className="ml-auto"><HelpButton /></span>
      </header>
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
        <div className="war-hero"><small>MUNDO ABERTO</small><h1>CEARÁ <br />2026</h1><p>Construa, negocie ou conquiste as 184 cidades.</p></div>
        <div className="max-w-4xl mx-auto grid gap-3 landscape:grid-cols-2 md:grid-cols-2 items-start">
          <div className="space-y-3">
            {W.error && <p className="rounded-xl border border-rose-500 bg-rose-950/60 p-3 text-sm text-rose-200">{W.error}</p>}
            <Card title="Quem é você?">
              <input value={name} maxLength={14} onChange={(e) => setName(e.target.value)} placeholder="Seu apelido" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 outline-none focus:border-amber-500" />
              <div className="grid grid-cols-8 gap-1">
                {EMBLEMS.map((e, i) => <button key={e} disabled={lv.level < emblemLevel(i)} title={lv.level < emblemLevel(i) ? `Abre no nível ${emblemLevel(i)}` : ''} onClick={() => setEmblem(e)} aria-label={`Emblema ${e}`} className={`h-10 rounded-xl text-xl disabled:opacity-25 ${e === emblem ? 'bg-amber-600' : 'bg-slate-800'}`}>{e}</button>)}
              </div>
              <button className="w-full text-left space-y-1" onClick={() => setFeats(true)}><span className="flex justify-between"><b>{lv.title} • nível {lv.level}</b><span className="text-amber-200">Ver carreira</span></span><Bar value={lv.part} color="bg-amber-500" /></button>
            </Card>
            {saves.map(({ n, s: g }) => <div key={n} className="flex gap-2"><Button size="lg" variant="primary" fullWidth disabled={busy} icon={<Play size={18} />} onClick={() => go(() => resumeSolo(n))}>Continuar ({clock(g!.t)}, {g!.cities} {g!.cities === 1 ? 'cidade' : 'cidades'})</Button><Button variant="outline" onClick={() => deleteSave(n)}><X size={16} /></Button></div>)}
            <div className="grid grid-cols-2 gap-2">
              <Button size="lg" disabled={busy} onClick={() => go(createWar)} icon={<Users size={18} />}>Criar sala</Button>
              <Button size="lg" variant="gold" disabled={busy} onClick={() => go(createSolo)} icon={<Play size={18} />}>Jogar solo</Button>
            </div>
          </div>
          {feats && <CareerModal onClose={() => setFeats(false)} />}
          <div className="space-y-3">
            <Modes go={go} />
            <p className="text-slate-300 text-center">Dica: {tip}</p>
            <Card title={<span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Salas neste Wi-Fi</span>}>
              {offline && <p className="text-amber-300">Sem conexão com a internet.</p>}
              {rooms?.length === 0 && <p className="text-slate-400">Nenhuma sala ainda. Crie uma e peça para entrarem neste mesmo site.</p>}
              {rooms?.map((r) => (
                <Action key={r.code} icon={<Users size={20} />} title={r.name} text={`${r.code} • ${r.players}/${MAX_PLAYERS}${r.started ? ' • em andamento' : ''}`} button={busy ? '...' : r.started ? 'Ver ou voltar' : 'Entrar'} variant="primary"
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
  const [, setReady3d] = useState(false);
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
    setReady3d(true);
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
      if (u.place) {
        order({ c: 'place', city: u.place[0], n: u.place[1], x: t.x, z: t.z });
        return patch({ place: null });
      }
      if (u.route && u.sel.length) {
        order({ c: 'patrol', u: u.sel, x: t.x, z: t.z });
        hooks.toast('Patrulha definida.', 'success');
        return patch({ route: 0 });
      }
      if (u.sel.length) {
        const c = t.city && Math.hypot(t.city.x - t.x, t.city.z - t.z) < 0.7 ? t.city : null;
        const foe = t.unit && hostile(g, t.unit.o, W.me) ? t.unit : null;
        // Cidade neutra: pergunta antes de atacar
        if (c && !foe && cityAt(g, c.id).owner < 0) return patch({ strike: c.id });
        order({ c: 'move', u: u.sel, x: foe?.x ?? c?.x ?? t.x, z: foe?.z ?? c?.z ?? t.z, hit: !!c, f: u.form, add: u.queue });
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
    if (W.replay && W.best) world.current?.go(W.best.x, W.best.z, 10);
  }, [W.replay]);
  useEffect(() => {
    if (phase === 'lobby') {
      const c = CITY[mySeat()?.start ?? 0];
      if (c) world.current?.overview(c.x, c.z);
    }
    if (phase !== 'play' || !W.world) return setUi(initial);
    const h = myHome();
    if (prefs.intro && !W.news && W.world.t < 2) world.current?.intro(h.x, h.z);
    else world.current?.go(h.x, h.z, 11);
  }, [phase]);
  // Música conforme a situação e narrador dos avisos
  const inWar = phase === 'play' && !!W.world && atWar(W.world, W.me);
  useEffect(() => {
    music.set(phase === 'play' && prefs.music && sound.enabled ? (inWar ? 'guerra' : 'paz') : null);
    return () => music.set(null);
  }, [phase, inWar, prefs.music]);
  const headline = W.world?.log[0];
  useEffect(() => {
    if (phase === 'play' && prefs.voice && sound.enabled && headline && headline.k !== 'info') speak(headline.t.replace(/\p{Extended_Pictographic}\uFE0F?/gu, ''));
  }, [headline?.t]);
  // Atalhos de teclado
  useEffect(() => {
    if (phase !== 'play') return;
    const key = (e: KeyboardEvent) => {
      if ((e.target as Element).closest('input,select,textarea') || !W.world) return;
      const u = live.current;
      const army = W.world.units.filter((x) => x.o === W.me).map((x) => x.i);
      const k = e.key.toLowerCase();
      if (k === 'h') world.current?.go(myHome().x, myHome().z, 11);
      else if (k === 'a') patch({ sel: army, city: 0, menu: '' });
      else if (k === 'q') patch({ box: !u.box });
      else if (k === 'b') patch({ menu: 'apoios', city: 0 });
      else if (k === 'g') patch({ menu: 'governo', city: 0 });
      else if (k === 'c') patch({ menu: 'cidades', city: 0 });
      else if (k === ' ') {
        e.preventDefault();
        askPause();
      } else if (k === 'escape') patch({ ...initial, groups: u.groups });
      else if ('123'.includes(k)) patch({ sel: u.groups[Number(k) - 1].filter((i) => army.includes(i)) });
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [phase]);
  const w3 = world.current;
  if (w3) {
    w3.selected = new Set(ui.sel);
    w3.aim = ui.power;
    w3.boxing = ui.box;
    w3.focus = ui.city;
  }
  const menu = phase !== 'lobby' && phase !== 'play';
  if (w3) w3.orbit = menu;
  if (failed && menu) return <Finder />;
  if (failed) return <p className="m-auto p-6 text-center">Este aparelho não conseguiu abrir o mapa 3D.<br /><Button className="mt-4" onClick={quitWar}>Voltar</Button></p>;
  return (
    <div className={`war relative w-full h-full overflow-hidden ${phase === 'lobby' ? 'war-in-lobby' : menu ? 'war-in-menu' : ''}`}>
      <div className="war-map"><canvas ref={canvas} className="absolute inset-0 w-full h-full touch-none" aria-label="Mapa 3D do Ceará" /></div>
      {flash > 0 && <div key={flash} className="war-flash" />}
      {rect && <div className="fixed z-40 border-2 border-emerald-300 bg-emerald-300/15 pointer-events-none" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />}
      {menu ? <Finder /> : phase === 'lobby' ? <Lobby goTo={(id) => w3?.go(CITY[id].x, CITY[id].z, 26)} /> : W.world && <Battle ui={ui} patch={patch} w3={w3} />}
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
          <Card title={<span className="flex justify-between gap-2"><span>Sua cidade: {start.name}</span><span className="text-amber-300 text-xs">tamanho {start.level}</span></span>}>
            <p className="text-slate-300">Toque em uma cidade no mapa ou busque. {formatNumber(start.pop)} habitantes • {start.region}{LANDMARKS[start.id] && ` • ${bonusText(LANDMARKS[start.id].bonus)}`}</p>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar entre as 184 cidades" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 outline-none" />
            {found.length > 0 && <div className="flex flex-wrap gap-1.5">{found.map((c) => <button key={c.id} className={chip(c.id === me.start)} onClick={() => { setSeat({ start: c.id }); goTo(c.id); setQuery(''); }}>{c.name}</button>)}</div>}
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
            {W.bots > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-slate-400">Rivais:</span>{['Pacíficos', 'Equilibrados', 'Agressivos'].map((t, i) => <button key={t} disabled={!W.host} className={chip(W.skill === i + 1)} onClick={() => setOptions({ skill: i + 1 })}>{t}</button>)}</div>}
            {!W.solo && <Button size="sm" variant="outline" fullWidth icon={<Share2 size={14} />} onClick={share}>Convidar (código {W.code})</Button>}
          </Card>
          <Card title="Modo e tempo">
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-1.5">
              {MODES.map((m) => (
                <button key={m.id} disabled={!W.host} onClick={() => setOptions({ mode: m.id })} className={`text-left rounded-xl border p-2 ${W.mode === m.id ? 'border-amber-400 bg-amber-950/40' : 'border-slate-800 bg-slate-900/60'} ${!W.host && W.mode !== m.id ? 'hidden' : ''}`}><b className="flex items-center gap-1.5"><Ico e={m.icon} /> {m.name}</b><span className="block text-slate-300">{m.text}</span></button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">{MINUTES.map((n) => <button key={n} disabled={!W.host} className={chip(W.minutes === n)} onClick={() => setOptions({ minutes: n })}>{n ? `${n} min` : 'Sem limite'}</button>)}</div>
          </Card>
          {W.host && (
            <Card title="Cenário próprio">
              <div className="flex flex-wrap gap-1.5">
                <button className={chip(false)} onClick={shuffleRules}>Sortear regras</button><button className={chip(false)} onClick={shuffleSeats}>Sortear cidades</button><button className={chip(false)} onClick={saveFavorite}>Salvar favoritas</button><button className={chip(false)} onClick={loadFavorite}>Usar favoritas</button>
              </div>
              {([['money', 'Dinheiro inicial', [0.5, 1, 3, 10], 'x'], ['era', 'Era inicial', [1, 2, 3, 4, 5], ''], ['neutral', 'Defesa das neutras', [0.5, 1, 2, 4], 'x'], ['army', 'Soldados extras', [0, 5, 12], '']] as const).map(([k, t, l, u]) => <div key={k} className="flex flex-wrap items-center gap-1.5"><span className="text-slate-400 w-32">{t}:</span>{l.map((v) => <button key={v} className={chip((W.custom ?? { money: 1, era: 1, neutral: 1, army: 0 })[k] === v)} onClick={() => setOptions({ custom: { ...(W.custom ?? { money: 1, era: 1, neutral: 1, army: 0 }), [k]: v } })}>{v}{u}</button>)}</div>)}
            </Card>
          )}
          <Card title={`Regras extras ${W.rules.length ? `(${W.rules.length})` : ''}`}>
            <div className="flex flex-wrap gap-1.5">
              {RULES.filter((r) => W.host || W.rules.includes(r.id)).map((r) => <button key={r.id} disabled={!W.host} title={r.text} className={chip(W.rules.includes(r.id))} onClick={() => toggleRule(r.id)}><Ico e={r.icon} size={14} /> {r.name}{W.rules.includes(r.id) && <span className="block text-[10px]">{r.text}</span>}</button>)}
              {!W.host && !W.rules.length && <span className="text-slate-400">Nenhuma</span>}
            </div>
          </Card>
        </div>
        <div className="p-3 pt-2 shrink-0 border-t border-slate-800">
          {W.host
            ? <Button size="lg" variant="gold" fullWidth disabled={!ready()} onClick={startWar}>{total() < 2 ? 'Esperando jogadores ou robôs' : ready() ? 'Começar!' : 'Esperando todos ficarem prontos'}</Button>
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
  const rank = w.players.filter((p) => !p.npc).sort((a, b) => Number(b.alive) - Number(a.alive) || scoreOf(w, b.i) - scoreOf(w, a.i));
  const close = () => patch({ strike: 0, place: null, route: 0, sel: [], city: 0, power: null, rally: 0, box: false, menu: '' });
  const hint = ui.power ? `${POWERS[ui.power].name}: toque no alvo` : ui.place ? 'Toque onde a construção deve ficar' : ui.route ? 'Toque até onde patrulhar' : ui.rally ? 'Toque onde as tropas novas devem ir' : ui.box ? 'Arraste para desenhar a área' : '';
  const kinds = UNIT_IDS.map((k) => [k, sel.filter((u) => u.k === k)] as const).filter(([, l]) => l.length);
  const chatNow = W.chat.filter((b) => Date.now() - b.at < 5000);
  const quest = QUESTS.find((q) => !me.quests.includes(q.id));
  const nukes = w.zones.filter((z) => NUKES[z.k] && z.tick < 90);
  const [team, setTeam] = useState(false);
  const done = useRef(me.quests.length);
  useEffect(() => {
    if (me.quests.length > done.current) {
      const q = QUESTS.find((x) => x.id === me.quests[me.quests.length - 1]);
      if (q) hooks.toast(`Missão cumprida: ${q.text}`, 'success');
      sound.playTechUnlocked();
    }
    done.current = me.quests.length;
  }, [me.quests.length]);
  const offers = w.offers.filter((o) => o.b === W.me);
  const threats = w.ult.filter((u) => u.b === W.me);
  const next = ERAS[me.era];
  const canEra = !!next && mine.length >= next.cities && me.money >= next.money && me.fuel >= next.fuel;
  const tipNow = me.alive && !W.spec ? advise(w, W.me) : '';
  const panel = ui.strike > 0 || ui.city > 0 || (ui.menu && ui.menu !== 'sair');
  return (
    <>
      {ui.photo && (
        <div className="absolute inset-x-0 bottom-3 z-30 mx-auto w-fit flex gap-2">
          <button className="war-chip" onClick={() => patch({ photo: false })}>Voltar</button>
          <button className="war-chip" onClick={async () => {
            const src = w3?.photo();
            if (!src) return;
            const file = new File([await (await fetch(src)).blob()], 'guerra-ceara.jpg', { type: 'image/jpeg' });
            try {
              if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
              else {
                const a = document.createElement('a');
                a.href = src;
                a.download = file.name;
                a.click();
              }
            } catch { /* cancelado */ }
          }}>Compartilhar foto</button>
        </div>
      )}
      <div className={ui.photo ? 'hidden' : 'contents'}>
      <div className="war-hud">
        <div className="flex gap-1 items-center">
          <button className={`war-chip ${canEra ? 'war-glow' : ''}`} onClick={() => patch({ menu: 'era', city: 0 })}><Ico e={ERAS[me.era - 1].icon} size={14} /> {me.era}</button>
          <span className="war-chip text-amber-200"><Coins size={13} /> {formatNumber(me.money)} <i>+{Math.round(m)}</i></span>
          <span className="war-chip text-orange-200"><Fuel size={13} /> {formatNumber(me.fuel)} <i>+{Math.round(f)}</i></span>
          <span className="war-chip"><Users size={13} /> {army.length}/{armyCap(w, W.me)}</span>
          <span className="war-chip"><Building2 size={13} /> {mine.length}</span>
          <span className={`war-chip font-mono ${w.left < 60 ? 'text-rose-300' : ''}`}><Clock size={13} /> {clock(w.left > 1e6 ? w.t : w.left)}</span>
        </div>
        <div className="flex gap-1 items-center">
          {rank.map((p) => (
            <button key={p.i} className={`war-chip ${p.alive ? '' : 'opacity-40 line-through'}`} style={{ borderColor: p.color }} onClick={() => patch({ menu: 'diplomacia', city: 0 })}>{p.i !== W.me && relOf(w, W.me, p.i) === REL.guerra ? <Ico e="⚔️" size={13} className="text-rose-400" /> : p.emblem} {p.i === W.me ? 'Você' : p.name.split(' ').pop()} <i>{w.mode === 'capital' ? `${scoreOf(w, p.i)}s` : formatNumber(scoreOf(w, p.i))}</i></button>
          ))}
          {w.event && <span className="war-chip text-sky-200"><Ico e={EVENTS[w.event.i].icon} size={13} /> {EVENTS[w.event.i].name} <i>{Math.ceil(w.event.left)}s</i></span>}
        </div>
      </div>
      <div className="war-log" aria-live="polite">
        {nukes.map((z, i) => <button key={i} className="war-nuke pointer-events-auto" onClick={() => { w3?.go(z.x, z.z, 18); w3?.chase(); }}><Ico e="☢️" /> {POWERS[z.k].name} caindo em {nearest(z.x, z.z)} • {Math.max(0, Math.ceil(z.left - 0.5))}s • Ver</button>)}
        {threats.map((u) => <button key={u.a} className="war-nuke pointer-events-auto" onClick={() => patch({ menu: 'diplomacia', city: 0 })}><Ico e="⚔️" /> {w.players[u.a].name} vai declarar guerra em {Math.ceil(u.left)}s</button>)}
        {offers.map((o) => (
          <div key={o.a} className="war-offer pointer-events-auto"><span>{w.players[o.a].emblem} {w.players[o.a].name} propõe: <b><Rich t={REL_NAME[o.k]} /></b></span><span className="flex gap-1.5"><button onClick={() => order({ c: 'answer', from: o.a, yes: true })}>Aceitar</button><button onClick={() => order({ c: 'answer', from: o.a, yes: false })}>Recusar</button></span></div>
        ))}
        {W.spec && <p>Assistindo</p>}
        {w.mode === 'ondas' && <p className="text-rose-200">Onda {w.x.wave} • próxima em {Math.ceil(w.x.nextWave)}s</p>}
        {w.goal && <p><GoalBar /></p>}
        <VoteBar />
        {!W.spec && !me.n.doc && me.alive && <button className="pointer-events-auto !border-amber-400 text-amber-200" onClick={() => patch({ menu: 'governo', city: 0 })}><Ico e="👑" size={14} /> Escolha sua doutrina</button>}
        {quest && !nukes.length && !w.goal && !W.spec && <button className="pointer-events-auto text-amber-100" onClick={() => patch({ menu: 'missoes', city: 0 })}><Ico e={quest.icon} size={14} /> {quest.text} <b>{Math.min(quest.n, Math.floor(questValue(w, W.me, quest.stat)))}/{quest.n}</b></button>}
        {W.lost && <p className="!bg-rose-900/80">Conexão caiu. Reconectando...</p>}
        {W.paused && <p>Pausado</p>}
        {!me.alive && !w.over && <p className="!bg-rose-900/80">Você foi eliminado. Assista ao fim da guerra.</p>}
        {w.log.slice(0, w.x.vote || offers.length ? 1 : 2).map((l, i) => <p key={l.t + i} className={l.k === 'alert' ? 'text-rose-200' : l.k === 'event' ? 'text-sky-200' : ''}><Rich t={l.t} /></p>)}
        {chatNow.map((b) => <p key={b.i} className="speech" style={{ borderLeft: `4px solid ${w.players[b.i]?.color}` }}>{w.players[b.i]?.name}: {b.text}</p>)}
        {attacked && <button className="!bg-rose-800/90 pointer-events-auto animate-pulse" onClick={() => w3?.go(attacked.x, attacked.z, 10)}><Ico e="⚠️" /> {CITY[attacked.id].name} ({CITY[attacked.id].region}) sob ataque! {mine.filter((c) => c.hit > 0).length > 1 ? `+${mine.filter((c) => c.hit > 0).length - 1} ` : ''}Ver</button>}
      </div>

      {W.replay && <div className="war-replay"><b>● REPLAY</b><button onClick={stopReplay}>Sair</button></div>}
      <MiniMap w3={w3} />
      <div className="war-left">
        <Tool icon={<Home size={19} />} name="Base" onClick={() => { const c = mine.find((x) => x.id === me.start) ?? mine[0]; if (c) w3?.go(c.x, c.z, 11); }} />
        <Tool icon={<SquareDashed size={19} />} name="Área" on={ui.box} onClick={() => patch({ box: !ui.box, power: null, rally: 0 })} />
        <Tool icon={<Users size={19} />} name="Todas" onClick={() => patch({ sel: army.map((u) => u.i), city: 0, menu: '' })} />
        <Tool icon={<Rocket size={19} />} name="Arsenal" on={ui.menu === 'apoios'} onClick={() => patch({ menu: ui.menu === 'apoios' ? '' : 'apoios', city: 0, power: null })} />
        <Tool icon={<Handshake size={19} />} name="Acordos" on={ui.menu === 'diplomacia'} onClick={() => patch({ menu: ui.menu === 'diplomacia' ? '' : 'diplomacia', city: 0 })} />
        <Tool icon={<MenuIcon size={19} />} name="Mais" on={ui.menu === 'mais'} onClick={() => patch({ menu: ui.menu === 'mais' ? '' : 'mais', city: 0 })} />
      </div>

      {!panel && !sel.length && !hint && ui.groups.some((g) => g.some((i) => army.some((u) => u.i === i))) && (
        <div className="war-groups">{ui.groups.map((g, n) => { const on = g.filter((i) => army.some((u) => u.i === i)); return on.length > 0 && <button key={n} onClick={() => patch({ sel: on })}>{n + 1}<small>{on.length}</small></button>; })}</div>
      )}
      {(hint || sel.length > 0) && !panel && (
        <div className="war-bar">
          {hint
            ? <p className="flex items-center justify-between gap-2 text-sm font-bold">{hint}<button onClick={close} aria-label="Cancelar" className="glass-btn w-11 h-11"><X size={18} /></button></p>
            : <>
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {kinds.map(([k, l]) => <button key={k} className="war-unit" title={`Só ${UNITS[k].name}`} onClick={() => patch({ sel: l.map((u) => u.i) })}><Pic k={k} e={UNITS[k].icon} /><b>{l.length}</b><Bar value={l.reduce((s, u) => s + u.hp / u.max, 0) / l.length} color="bg-emerald-500" /></button>)}
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => order({ c: 'stop', u: ids })}>Parar</Button>
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => patch({ route: 1 })}>Patrulhar</Button>
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => { const c = [...mine].sort((a, b) => Math.hypot(a.x - sel[0].x, a.z - sel[0].z) - Math.hypot(b.x - sel[0].x, b.z - sel[0].z))[0]; if (c) order({ c: 'move', u: ids, x: c.x, z: c.z, hold: true }); }}>Recuar</Button>
                <Button size="sm" variant="secondary" onClick={() => w3?.go(sel[0].x, sel[0].z, 9)}><Eye size={16} /></Button>
                <Button size="sm" variant="danger" onClick={close}><X size={16} /></Button>
              </div>
              <div className="flex gap-1 text-[11px] overflow-x-auto no-scrollbar">
                <button className={`shrink-0 rounded-lg px-2 py-1.5 ${ui.queue ? 'bg-amber-600' : 'bg-white/10'}`} onClick={() => patch({ queue: !ui.queue })}>Fila</button>
                <button className="shrink-0 rounded-lg bg-white/10 px-2 py-1.5" onClick={() => patch({ form: (ui.form + 1) % FORMATIONS.length })}>{FORMATIONS[ui.form]}</button>
                <button className="shrink-0 rounded-lg bg-white/10 px-2 py-1.5" onClick={() => order({ c: 'stance', u: ids, s: ((sel[0].stance ?? 0) + 1) % 3 })}>{STANCES[sel[0].stance ?? 0]}</button>
                {sel.some((u) => UNITS[u.k].cls === 'inf' && !u.kit) && KITS.map((k, n) => <button key={k.name} className="shrink-0 rounded-lg bg-white/10 px-2 py-1.5" title={k.text} onClick={() => order({ c: 'kit', u: ids, n })}>{k.name} ({k.money})</button>)}
                {sel.length === 1 && sel[0].star >= 2 && !sel[0].chief && <button className="shrink-0 rounded-lg bg-amber-700 px-2 py-1.5" onClick={() => order({ c: 'officer', u: sel[0].i })}>Oficial (400)</button>}
                {sel.length === 1 && CARGO[sel[0].k] && <button className="shrink-0 rounded-lg bg-sky-800 px-2 py-1.5" onClick={() => order({ c: 'load', u: sel[0].i })}>Embarcar {sel[0].cargo.length}/{CARGO[sel[0].k]}</button>}
                {sel.length === 1 && sel[0].cargo.length > 0 && <button className="shrink-0 rounded-lg bg-sky-800 px-2 py-1.5" onClick={() => order({ c: 'unload', u: sel[0].i })}>Desembarcar</button>}
              </div>
              <div className="flex gap-1.5 text-[11px]">
                {[0, 1, 2].map((n) => <button key={n} className="flex-1 rounded-lg bg-white/10 py-1.5" onClick={() => patch({ groups: ui.groups.map((g, i) => (i === n ? ids : g)) })}>Salvar grupo {n + 1}</button>)}
                {sel.some((u) => ['recon', 'moto', 'caca', 'heli'].includes(u.k)) && <button className="flex-1 rounded-lg bg-sky-800 py-1.5" onClick={() => order({ c: 'scout', u: sel.filter((u) => ['recon', 'moto', 'caca', 'heli'].includes(u.k)).map((u) => u.i) })}>Explorar sozinho</button>}
              </div>
            </>}
        </div>
      )}

      {panel && (
        <div className="war-panel">
          <button onClick={close} aria-label="Fechar" className="absolute right-2 top-2 z-10 glass-btn w-10 h-10"><X size={18} /></button>
          {ui.city > 0 && <CityPanel id={ui.city} patch={patch} w3={w3} />}
          {ui.strike > 0 && (
            <>
              <h3 className="font-bold pr-12">{CITY[ui.strike].name} é neutra</h3>
              <p className="text-slate-300">Atacar toma a cidade à força e deixa ruínas. Por acordo ela entra inteira. Chance estimada do ataque: <b className="text-amber-200">{odds(w, W.me, ids, cityAt(w, ui.strike))}%</b></p>
              <div className="grid grid-cols-3 gap-1.5">
                <Button size="sm" variant="danger" onClick={() => { order({ c: 'move', u: ids, x: CITY[ui.strike].x, z: CITY[ui.strike].z, hit: true }); patch({ strike: 0 }); }}>Atacar</Button>
                <Button size="sm" variant="secondary" onClick={() => { order({ c: 'move', u: ids, x: CITY[ui.strike].x, z: CITY[ui.strike].z }); patch({ strike: 0 }); }}>Só ir lá</Button>
                <Button size="sm" variant="gold" onClick={() => patch({ city: ui.strike, strike: 0, sel: [] })}>Acordo</Button>
              </div>
            </>
          )}
          {ui.menu === 'diplomacia' && <Diplomacy />}
          {ui.menu === 'governo' && <Government />}
          {ui.menu === 'gabinete' && <Cabinet />}
          {ui.menu === 'bolsa' && <Exchange />}
          {ui.menu === 'mundo' && <Merchant go={(x, z) => { w3?.go(x, z, 10); close(); }} />}
          {ui.menu === 'cidades' && <CityList open={(id) => { w3?.go(CITY[id].x, CITY[id].z, 11); patch({ city: id, menu: '' }); }} />}
          {ui.menu === 'enciclopedia' && <Encyclopedia />}
          {ui.menu === 'maravilhas' && <Wonders />}
          {ui.menu === 'era' && (
            <>
              <h3 className="font-bold pr-12"><Ico e={ERAS[me.era - 1].icon} /> Era {me.era}: {ERAS[me.era - 1].name}</h3>
              {ERAS.map((e, i) => <div key={e.name} className={`rounded-xl border p-2 ${i + 1 === me.era ? 'border-amber-400' : 'border-slate-700'} ${i + 1 < me.era ? 'opacity-50' : ''}`}><b className="flex items-center gap-1.5"><Ico e={e.icon} /> {i + 1}. {e.name}</b><span className="block text-slate-300">{e.text}</span>{i === me.era && <span className="block text-amber-200">Precisa: {e.cities} cidades ({mine.length}), {formatNumber(e.money)} de dinheiro, {formatNumber(e.fuel)} de combustível</span>}</div>)}
              {next && <Button variant="gold" fullWidth disabled={!canEra} onClick={() => order({ c: 'era' })}>Avançar para {next.name}</Button>}
            </>
          )}
          {ui.menu === 'video' && (
            <>
              <h3 className="font-bold pr-12">Qualidade da imagem</h3>
              <div className="grid grid-cols-4 gap-1.5">{(['auto', 'baixa', 'media', 'alta'] as (Quality | 'auto')[]).map((q) => <Button key={q} size="sm" variant={savedQuality() === q ? 'gold' : 'secondary'} onClick={() => { w3?.setQuality(q); touch(); }}>{{ auto: 'Auto', baixa: 'Leve', media: 'Média', alta: 'Alta' }[q]}</Button>)}</div>
              <Settings />
              <p className="text-slate-300">Alta liga o brilho do fogo e a distorção de calor. Leve desliga as sombras. O chão fica nítido em todas.</p>
            </>
          )}
          {ui.menu === 'mais' && (
            <>
              <h3 className="font-bold pr-12">Comando</h3>
              {tipNow && <p className="rounded-xl bg-amber-900/30 border border-amber-500/40 p-2"><b>Conselheiro:</b> {tipNow}</p>}
              <div className="war-grid">
                {([['governo', <Landmark />, 'Governo'], ['gabinete', <Users />, 'Gabinete'], ['cidades', <Building2 />, 'Cidades'], ['bolsa', <TrendingUp />, 'Bolsa'], ['mundo', <Globe2 />, 'Mundo'], ['enciclopedia', <BookOpen />, 'Enciclopédia'], ['maravilhas', <Crown />, 'Maravilhas'], ['era', <Sparkles />, 'Era'], ['pesquisa', <Microscope />, 'Pesquisa'], ['missoes', <Target />, 'Missões'], ['placar', <Trophy />, 'Placar'], ['fala', <MessageCircle />, 'Falar'], ['video', <Gear />, 'Imagem'], ['sair', <LogOut />, 'Sair']] as ['governo' | 'gabinete' | 'cidades' | 'bolsa' | 'mundo' | 'enciclopedia' | 'maravilhas' | 'era' | 'pesquisa' | 'missoes' | 'placar' | 'fala' | 'video' | 'sair', React.ReactNode, string][]).map(([id, icon, name]) => <button key={id} className="war-item" onClick={() => patch({ menu: id })}>{icon}<b>{name}</b></button>)}
                <button className="war-item" onClick={() => patch({ ...initial, photo: true, groups: ui.groups })}><Camera /><b>Modo foto</b></button>
                {W.solo && <button className="war-item" onClick={() => { W.speed = W.speed >= 4 ? 1 : W.speed * 2; touch(); }}><FastForward /><b>Velocidade {W.speed}x</b></button>}
                <button className="war-item" onClick={() => { askPause(); close(); }}>{W.paused ? <Play /> : <Pause />}<b>{W.solo ? (W.paused ? 'Continuar' : 'Pausar') : `Pausa (${W.pauseVotes} pedem)`}</b></button>
              </div>
            </>
          )}
          {ui.menu === 'missoes' && (
            <>
              <h3 className="font-bold pr-12">Missões {me.quests.length}/{QUESTS.length}</h3>
              {QUESTS.map((q) => { const ok = me.quests.includes(q.id); return <div key={q.id} className={`rounded-xl border border-slate-700 p-2 ${ok ? 'opacity-50' : ''}`}><p className="flex justify-between gap-2"><b className="flex items-center gap-1.5"><Ico e={ok ? '✅' : q.icon} /> {q.text}</b><span className="text-amber-200 shrink-0"><Coins size={12} className="ico" /> {q.money} <Fuel size={12} className="ico" /> {q.fuel}</span></p>{!ok && <Bar value={questValue(w, W.me, q.stat) / q.n} color="bg-amber-500" />}</div>; })}
            </>
          )}
          {ui.menu === 'apoios' && <Supports patch={patch} />}
          {ui.menu === 'pesquisa' && <Research />}
          {ui.menu === 'placar' && <Score />}
          {ui.menu === 'fala' && (
            <>
              <h3 className="font-bold pr-12">Falar com todos</h3>
              <div className="grid grid-cols-2 gap-1.5">{PHRASES.map((p, i) => <Button key={p} size="sm" variant="secondary" onClick={() => { sayPhrase(i, team); close(); }}>{p}</Button>)}</div>
              <Button size="sm" variant={team ? 'gold' : 'outline'} fullWidth onClick={() => setTeam(!team)}>{team ? 'Só para aliados' : 'Para todos'}</Button>
              <Button size="sm" variant="gold" fullWidth onClick={() => { const c = w3?.center(); if (c) sendPing(c.x, c.z); close(); }}>Marcar o centro da tela no mapa</Button>
            </>
          )}
        </div>
      )}
      </div>
      <Modal isOpen={ui.menu === 'sair'} onClose={() => patch({ menu: '' })} maxWidth="sm" title="Sair da guerra?">
        <p className="text-sm text-slate-300">{W.solo ? 'A partida será encerrada.' : W.host ? 'Você criou a sala: se sair, a partida acaba para todos.' : 'Um robô vai comandar seu exército. Você pode voltar pela lista de salas.'}</p>
        <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => patch({ menu: '' })}>Ficar</Button><Button variant="danger" onClick={quitWar}>Sair</Button></div>
      </Modal>
      {W.news ? <News /> : !W.spec && me.n.dil && me.alive && !w.over ? <Dilemma /> : !W.spec && me.l.chapter && me.alive && !w.over ? <StoryCard /> : !W.spec && !panel && !sel.length && w.t < 600 && <Tutorial />}
      {w.over && !W.replay && <End />}
    </>
  );
};
const Tool: React.FC<{ icon: React.ReactNode; name: string; on?: boolean; onClick: () => void }> = ({ icon, name, on, onClick }) => (
  <button className={`war-tool ${on ? 'on' : ''}`} onClick={() => { sound.playClick(); onClick(); }}><span>{icon}</span><small>{name}</small></button>
);
const Cost: React.FC<{ v: [number, number] }> = ({ v: [m, f] }) => {
  const p = myPlayer();
  return <span className="text-[10px]"><span className={p.money < m ? 'text-rose-300' : 'text-amber-200'}><Coins size={11} className="ico" /> {m}</span>{f > 0 && <span className={p.fuel < f ? 'text-rose-300' : 'text-orange-200'}> <Fuel size={11} className="ico" /> {f}</span>}</span>;
};

const CityPanel: React.FC<{ id: number; patch: BattleProps['patch']; w3: World3D | null }> = ({ id, patch, w3 }) => {
  const w = W.world!;
  const s = cityAt(w, id);
  const c = CITY[id];
  const owner = w.players[s.owner];
  const own = s.owner === W.me;
  const [tab, setTab] = useState<'treinar' | 'construir' | 'obras'>('treinar');
  const [n, setN] = useState(1);
  const slots = slotsIn(w, s);
  const me = myPlayer();
  const block = annexBlock(w, W.me, s);
  const [am] = annexCost(c.level, citiesOf(w, W.me).length);
  const trainable = UNIT_IDS.filter((k) => k !== 'colosso' && me.era >= UNIT_ERA[k] && s.works.some((x) => x.k === UNITS[k].from && x.left <= 0));
  return (
    <>
      <div className="pr-12">
        <h3 className="font-bold text-base"><Ico e={LANDMARKS[id]?.icon ?? '🏙️'} size={18} /> {c.name}</h3>
        <p className="text-slate-300">{owner ? <span style={{ color: owner.color }}>{owner.emblem} {own ? 'Sua cidade' : owner.name}</span> : 'Neutra'} • {formatNumber(c.pop)} hab. • tamanho {c.level}</p>
        <p className="text-slate-300 flex gap-3"><span><Coins size={12} className="ico text-amber-300" /> +{(cityIncome(c.level) * (1 + s.dev * 0.5)).toFixed(1)}/s</span><span><Fuel size={12} className="ico text-orange-300" /> +{(cityFuel(c.level) * (1 + s.dev * 0.4)).toFixed(1)}/s</span><span>{[0, 1, 2].map((n) => <Star key={n} size={12} className={`ico ${s.dev > n ? 'text-amber-300 fill-amber-300' : 'text-slate-600'}`} />)}</span></p>
        {irradiated(w, c.x, c.z) && <p className="text-lime-300"><Ico e="☢️" size={13} /> Contaminada: não produz e fere as tropas.</p>}
        {LANDMARKS[id] && <p className="text-sky-200">{LANDMARKS[id].name}: {bonusText(LANDMARKS[id].bonus)}</p>}
      </div>
      <Bar value={s.hp / s.max} color={s.hp / s.max < 0.35 ? 'bg-rose-500' : 'bg-emerald-500'} />
      {own && synergyOf(s).map((y) => <p key={y[2]} className="text-emerald-300">{y[2]}: prédios combinados rendem mais</p>)}
      {own && <div className="grid grid-cols-2 gap-1.5"><Button size="sm" variant="secondary" disabled={me.l.fest > 0 || me.money < 250} onClick={() => order({ c: 'fest', city: id })}>{me.l.fest > 0 ? `Festa em ${Math.ceil(me.l.fest)}s` : 'Festival (250)'}</Button><Button size="sm" variant="secondary" disabled={me.l.evac > 0} onClick={() => order({ c: 'evac', city: id })}>{s.safe ? `Evacuada ${Math.ceil(s.safe)}s` : 'Evacuar'}</Button></div>}
      {own && <p className="flex items-center gap-2"><span className={s.mood < 30 ? 'text-rose-300' : s.mood < 55 ? 'text-amber-200' : 'text-emerald-300'}>Povo {s.mood < 30 ? 'revoltado' : s.mood < 55 ? 'inquieto' : s.mood < 80 ? 'contente' : 'feliz'} {Math.round(s.mood)}%</span><span className="text-slate-400">{moodTarget(w, s) >= s.mood ? 'melhorando' : 'piorando'}</span></p>}
      {s.ruin > 0.15 && <p className="text-orange-300"><Ico e="🏚️" size={13} /> {Math.round(s.ruin * 100)}% em ruínas. Reconstrói sozinha em paz.</p>}
      {!own && !owner && (s.deal
        ? <p className="text-sky-200"><Ico e="🤝" size={13} /> {w.players[s.deal.by].name} negocia: {Math.ceil(s.deal.left)}s</p>
        : <Button variant="gold" fullWidth disabled={!!block || me.money < am} onClick={() => order({ c: 'annex', city: id })}>{block || `Trazer por acordo: ${am} (${annexTime(c.level)}s)`}</Button>)}
      {!own && !owner && <p className="text-slate-300">Ou escolha tropas e toque na cidade para tomar à força: zere a defesa e deixe infantaria ou blindados no centro.</p>}
      {!own && owner && <p className="text-slate-300">Vocês estão em <b style={{ color: REL_COLOR[relOf(w, W.me, s.owner)] }}><Rich t={REL_NAME[relOf(w, W.me, s.owner)]} /></b>. Só dá para atacar em guerra.</p>}
      {own && (s.devLeft > 0
        ? <p className="text-emerald-300"><Ico e="🏗️" size={13} /> Evoluindo: {Math.ceil(s.devLeft)}s</p>
        : s.dev < MAX_DEV && <Button variant="gold" size="sm" fullWidth disabled={me.era < s.dev + 1 || me.money < devCost(c.level, s.dev)[0] || me.fuel < devCost(c.level, s.dev)[1]} onClick={() => order({ c: 'dev', city: id })}>{me.era < s.dev + 1 ? `Evoluir (Era ${s.dev + 1})` : `Evoluir cidade ${s.dev}/${MAX_DEV}: ${devCost(c.level, s.dev).filter(Boolean).join(' + ')}`}</Button>)}
      {own && (
        <>
          {s.q.length > 0 && <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">{s.q.map((q, i) => <span key={i} className="war-unit"><Pic k={q.u} e={UNITS[q.u].icon} />{i === 0 && <b>{Math.ceil(q.left)}s</b>}</span>)}<Button size="sm" variant="outline" onClick={() => order({ c: 'cancel', city: id })}>✕</Button></div>}
          <div className="grid grid-cols-3 gap-1">{(['treinar', 'construir', 'obras'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-lg py-2 font-bold capitalize ${tab === t ? 'bg-amber-600' : 'bg-slate-800'}`}>{t === 'obras' ? `Obras ${s.works.length}/${slots}` : t}</button>)}</div>
          {tab === 'treinar' && (trainable.length === 0 ? <p className="text-amber-200">Construa um Quartel para treinar tropas aqui.</p> : (
            <>
              <div className="grid grid-cols-3 gap-1">{[[1, '1 por toque'], [5, '5 por toque'], [0, 'Sem parar']].map(([v, t]) => <button key={v} onClick={() => setN(v as number)} className={`rounded-lg py-1.5 ${n === v ? 'bg-sky-700' : 'bg-slate-800'}`}>{t}</button>)}</div>
              <div className="war-grid">
                {trainable.map((k: UnitId) => <button key={k} className="war-item" title={UNITS[k].text} onClick={() => order(n ? { c: 'train', city: id, k, n } : { c: 'loop', city: id, k })} data-on={s.loop === k}><Pic big k={k} e={UNITS[k].icon} /><b>{UNITS[k].name}</b><small>{UNITS[k].text}</small><Cost v={unitPrice(w, W.me, k)} /></button>)}
              </div>
              <Button size="sm" variant="outline" fullWidth onClick={() => order({ c: 'merc', city: id, k: 'soldado' })}>Contratar mercenário na hora ({mercPrice(w, W.me, 'soldado')[0]})</Button>
              <div className="grid grid-cols-2 gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => patch({ rally: id, city: 0 })}>Ponto de encontro</Button>
                <Button size="sm" variant="secondary" onClick={() => patch({ city: 0, sel: w.units.filter((u) => u.o === W.me && Math.hypot(u.x - s.x, u.z - s.z) < 2).map((u) => u.i) })}>Tropas daqui</Button>
              </div>
            </>
          ))}
          {tab === 'construir' && (
            <div className="war-grid">
              {WORKS_IDS.map((k: WorksId) => <button key={k} className="war-item" disabled={c.level < WORKS[k].level || s.works.length >= slots || me.era < WORKS_ERA[k]} onClick={() => order({ c: 'build', city: id, k })}><Pic big k={`w-${k}`} e={WORKS[k].icon} /><b>{WORKS[k].name}</b><small>{me.era < WORKS_ERA[k] ? `Era ${WORKS_ERA[k]}` : c.level < WORKS[k].level ? `Só em cidade tamanho ${WORKS[k].level}` : WORKS[k].text}</small><Cost v={worksPrice(w, W.me, k)} /></button>)}
            </div>
          )}
          {tab === 'obras' && (s.works.length ? s.works.map((k, n) => (
            <div key={n} className="rounded-xl bg-white/5 p-2 flex items-center gap-2">
              <Pic k={`w-${k.k}`} e={WORKS[k.k].icon} /><span className="flex-1"><b>{WORKS[k.k].name}</b> {k.k !== 'comando' && <span className="text-amber-200">nível {k.lv ?? 1}</span>}<span className="block text-slate-300">{k.left > 0 ? `Em obras: ${Math.ceil(k.left)}s` : WORKS[k.k].text}</span></span>
              {k.k !== 'comando' && <span className="grid gap-1"><button className="rounded-lg bg-amber-700 px-2 py-1" disabled={(k.lv ?? 1) >= 3 || k.left > 0} onClick={() => order({ c: 'upgrade', city: id, n })}>{(k.lv ?? 1) >= 3 ? 'Máximo' : `Melhorar ${upgradeCost(k, 400)[0]}`}</button><span className="flex gap-1"><button className="flex-1 rounded-lg bg-white/10 px-2 py-1" onClick={() => { patch({ place: [id, n], city: 0 }); w3?.go(c.x, c.z, 6); }}>Mover</button><button className="flex-1 rounded-lg bg-white/10 px-2 py-1" onClick={() => order({ c: 'sell', city: id, n })}>Vender</button></span></span>}
            </div>
          )) : <p className="text-slate-400">Nada construído.</p>)}
        </>
      )}
      <Button size="sm" variant="outline" fullWidth onClick={() => w3?.go(c.x, c.z, 9)}>Ver no mapa</Button>
    </>
  );
};

const Supports: React.FC<{ patch: BattleProps['patch'] }> = ({ patch }) => {
  const w = W.world!;
  const p = myPlayer();
  const item = (k: PowerId) => {
    const cool = p.cool[k] ?? 0;
    const need = needOf(w, W.me, k);
    return <button key={k} className={`war-item ${NUKES[k] ? 'nuke' : ''}`} disabled={cool > 0 || !!need || p.money < POWERS[k].money} onClick={() => patch({ power: k, menu: '', sel: [] })}><span style={{ color: POWERS[k].color }}>{POWER_ICON[k]}</span><b>{POWERS[k].name}</b><small>{need || POWERS[k].text}</small>{cool > 0 ? <span className="text-sky-200">{Math.ceil(cool)}s</span> : <Cost v={[POWERS[k].money, 0]} />}</button>;
  };
  return (
    <>
      <h3 className="font-bold pr-12">Armas nucleares</h3>
      <div className="war-grid">{POWER_IDS.filter((k) => NUKES[k]).map(item)}</div>
      <p className="text-slate-300">1) Pesquise o Programa Nuclear. 2) Construa um Silo em cidade tamanho 5. Construa o Domo Antimíssil para se proteger.</p>
      <h3 className="font-bold">Apoios</h3>
      <div className="war-grid">{POWER_IDS.filter((k) => !NUKES[k]).map(item)}</div>
    </>
  );
};
/** Mapa pequeno: toque para ir */
const MiniMap: React.FC<{ w3: World3D | null }> = ({ w3 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const w = W.world!;
  useEffect(() => {
    const x = ref.current?.getContext('2d');
    if (!x) return;
    const { width, height } = x.canvas;
    const X = (v: number) => ((v - BOUNDS.x0) / BOUNDS.w) * width;
    const Z = (v: number) => ((v - BOUNDS.z0) / BOUNDS.h) * height;
    x.clearRect(0, 0, width, height);
    if (w3) {
      x.globalAlpha = 0.55;
      x.drawImage(w3.mask, 0, 0, width, height);
      x.globalAlpha = 1;
    }
    for (const c of w.cities) {
      x.fillStyle = c.owner >= 0 ? w.players[c.owner].color : '#94a3b8';
      const r = c.owner >= 0 ? 4 : 2;
      x.fillRect(X(c.x) - r / 2, Z(c.z) - r / 2, r, r);
    }
    x.fillStyle = '#fff';
    for (const u of w.units) if (allied(w, u.o, W.me)) x.fillRect(X(u.x), Z(u.z), 2, 2);
    for (const a of w.rads) {
      x.fillStyle = 'rgba(125,255,58,.5)';
      x.beginPath();
      x.arc(X(a.x), Z(a.z), (a.r / BOUNDS.w) * width + 1, 0, 7);
      x.fill();
    }
    for (const z of w.zones) if (NUKES[z.k]) {
      x.strokeStyle = '#ff2a1a';
      x.lineWidth = 2;
      x.beginPath();
      x.arc(X(z.x), Z(z.z), 6, 0, 7);
      x.stroke();
    }
    const c = w3?.center();
    if (c) {
      x.strokeStyle = '#fde047';
      x.lineWidth = 1.5;
      x.strokeRect(X(c.x) - 7, Z(c.z) - 7, 14, 14);
    }
  });
  return (
    <canvas ref={ref} width={150} height={Math.round((150 * BOUNDS.h) / BOUNDS.w)} aria-label="Mapa pequeno" className="war-mini"
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        w3?.go(BOUNDS.x0 + ((e.clientX - r.left) / r.width) * BOUNDS.w, BOUNDS.z0 + ((e.clientY - r.top) / r.height) * BOUNDS.h);
      }} />
  );
};
const Diplomacy: React.FC = () => {
  const w = W.world!;
  const me = myPlayer();
  const [spy, setSpy] = useState(-1);
  const dip = (to: number, k: 'guerra' | 'paz' | 'comercio' | 'alianca' | 'romper', ask?: boolean) => {
    order({ c: 'dip', to, k });
    if (ask) hooks.toast('Proposta enviada.', 'info');
  };
  return (
    <>
      <h3 className="font-bold pr-12">Acordos</h3>
      <p className="text-slate-300">Cada comércio ou aliança rende +{Math.round(tradeRate(w, W.me) * 100)}%. Agora: +{Math.round(tradesOf(w, W.me) * tradeRate(w, W.me) * 100)}%. Aliados dividem a visão.</p>
      <Button size="sm" variant="secondary" fullWidth disabled={me.l.help > 0} onClick={() => order({ c: 'help' })}>Pedir ajuda militar aos aliados</Button>
      {w.players.filter((p) => p.i !== W.me && !p.npc).map((p) => {
        const r = relOf(w, W.me, p.i);
        const ult = w.ult.find((u) => (u.a === p.i && u.b === W.me) || (u.b === p.i && u.a === W.me));
        const sent = w.offers.some((o) => o.a === W.me && o.b === p.i);
        return (
          <div key={p.i} className={`rounded-xl border p-2 space-y-1.5 ${p.alive ? '' : 'opacity-40'}`} style={{ borderColor: p.color }}>
            <p className="flex justify-between gap-2"><b>{p.emblem} {p.name}</b><b style={{ color: REL_COLOR[r] }}>{p.team === me.team ? 'Seu time' : ult ? `Guerra em ${Math.ceil(ult.left)}s` : <Rich t={REL_NAME[r]} />}</b></p>
            <p className="text-slate-300"><Ico e={ERAS[p.era - 1].icon} size={13} /> Era {p.era} • Cidades: {citiesOf(w, p.i).length} • Tropas: {armySize(w, p.i)} • Reputação: {Math.round(p.l.rep)}</p>
            {p.alive && p.team !== me.team && (
              <div className="grid grid-cols-2 gap-1.5">
                {r === REL.guerra ? <Button size="sm" variant="primary" disabled={sent} onClick={() => dip(p.i, 'paz', true)}>{sent ? 'Esperando...' : 'Propor paz'}</Button>
                  : r === REL.paz ? <Button size="sm" variant="primary" disabled={sent} onClick={() => dip(p.i, 'comercio', true)}>{sent ? 'Esperando...' : 'Propor comércio'}</Button>
                    : r === REL.comercio ? <Button size="sm" variant="primary" disabled={sent} onClick={() => dip(p.i, 'alianca', true)}>{sent ? 'Esperando...' : 'Propor aliança'}</Button>
                      : <Button size="sm" variant="outline" onClick={() => dip(p.i, 'romper')}>Romper aliança</Button>}
                {r !== REL.guerra && r !== REL.alianca && <Button size="sm" variant="danger" disabled={!!ult} onClick={() => dip(p.i, 'guerra')}>Declarar guerra</Button>}
                {r === REL.comercio && <Button size="sm" variant="outline" onClick={() => dip(p.i, 'romper')}>Romper comércio</Button>}
                {r !== REL.guerra && <Button size="sm" variant="secondary" disabled={sent || !!pactOf(w, W.me, p.i)} onClick={() => { order({ c: 'pact', to: p.i }); hooks.toast('Proposta enviada.', 'info'); }}>{pactOf(w, W.me, p.i) ? `Pacto ${Math.ceil(pactOf(w, W.me, p.i)!.left)}s` : 'Não agressão'}</Button>}
                <Button size="sm" variant="secondary" disabled={me.money < 500} onClick={() => order({ c: 'gift', to: p.i })}>Presentear 500</Button>
                {r < REL.comercio && <Button size="sm" variant="outline" onClick={() => order({ c: 'embargo', to: p.i })}>{w.x.embargo.some(([a, b]) => a === W.me && b === p.i) ? 'Fim do embargo' : 'Embargar'}</Button>}
                <Button size="sm" variant="secondary" onClick={() => setSpy(spy === p.i ? -1 : p.i)}>Espionar</Button>
              </div>
            )}
            {spy === p.i && (
              <div className="war-grid">
                {(Object.keys(SPIES) as SpyId[]).map((k) => <button key={k} className="war-item" disabled={me.n.spy > 0 || me.money < SPIES[k].money} onClick={() => order({ c: 'spy', to: p.i, k })}><Ico e={SPIES[k].icon} size={22} className="text-violet-300" /><b>{SPIES[k].name}</b><small>{me.n.spy > 0 ? `Espião volta em ${Math.ceil(me.n.spy)}s` : `${SPIES[k].text} (${Math.round(SPIES[k].chance * 100)}%)`}</small><Cost v={[SPIES[k].money, 0]} /></button>)}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};
const Government: React.FC = () => {
  const w = W.world!;
  const me = myPlayer();
  const n = me.n;
  const mine = citiesOf(w, W.me);
  const mood = mine.length ? Math.round(mine.reduce((s, c) => s + c.mood, 0) / mine.length) : 0;
  return (
    <>
      <h3 className="font-bold pr-12">Governo</h3>
      <div className="grid grid-cols-2 gap-2">
        <p className="rounded-xl bg-white/5 p-2">Humor do povo<b className={`block text-lg ${mood < 35 ? 'text-rose-300' : mood < 60 ? 'text-amber-200' : 'text-emerald-300'}`}>{mood}%</b></p>
        <p className="rounded-xl bg-white/5 p-2">Dívida<b className="block text-lg">{formatNumber(n.debt)}</b></p>
      </div>
      <b>Doutrina {n.doc ? '' : '(escolha uma, vale a partida toda)'}</b>
      {n.doc ? (() => { const d = DOCTRINES.find((x) => x.id === n.doc)!; return <p className="rounded-xl bg-white/5 p-2"><b><Ico e={d.icon} /> {d.name}</b><span className="block text-slate-300">{bonusText(d.bonus)}</span></p>; })()
        : <div className="war-grid">{DOCTRINES.map((d) => <button key={d.id} className="war-item" onClick={() => order({ c: 'doc', id: d.id })}><Ico e={d.icon} size={24} className="text-amber-300" /><b>{d.name}</b><small>{bonusText(d.bonus)}</small></button>)}</div>}
      <b>Impostos</b>
      <div className="grid grid-cols-3 gap-1.5">{([[-1, 'Baixos', 'Povo feliz'], [0, 'Normais', ''], [1, 'Altos', '+25% renda']] as const).map(([v, t, x]) => <button key={v} className={`rounded-xl p-2 ${n.tax === v ? 'bg-amber-600' : 'bg-white/10'}`} onClick={() => order({ c: 'tax', v })}><b>{t}</b><small className="block">{x}</small></button>)}</div>
      <b>Políticas {n.pol.length}/{policySlots(w, W.me)}</b>
      <div className="war-grid">{POLICIES.map((p) => <button key={p.id} className="war-item" data-on={n.pol.includes(p.id)} disabled={me.era < p.era} onClick={() => order({ c: 'pol', id: p.id })}><Ico e={p.icon} size={22} className="text-sky-300" /><b>{p.name}</b><small>{me.era < p.era ? `Era ${p.era}` : `${p.text}${Object.keys(p.bonus).length ? `: ${bonusText(p.bonus)}` : ''}`}</small></button>)}</div>
      <b>Mercado de combustível (100 unidades)</b>
      <div className="grid grid-cols-2 gap-1.5"><Button size="sm" variant="secondary" onClick={() => order({ c: 'market', buy: true })}>Comprar por {marketPrice(w, W.me)}</Button><Button size="sm" variant="secondary" onClick={() => order({ c: 'market', buy: false })}>Vender por {Math.round(marketPrice(w, W.me) * 0.7)}</Button></div>
      <Button size="sm" variant="outline" fullWidth onClick={() => order({ c: 'loan', pay: n.debt > 0 })}>{n.debt > 0 ? 'Pagar a dívida' : 'Pegar empréstimo de 1500 (juros de 25%)'}</Button>
      {w.mode === 'dominio' && <><b>Caminhos para vencer</b>{VICTORIES.map((v, i) => { const [a, b] = victoryOf(w, W.me)[i]; return <div key={v.id} className="rounded-xl bg-white/5 p-2 space-y-1"><p className="flex justify-between"><b><Ico e={v.icon} size={14} /> {v.name}</b><span className="text-slate-300">{v.text}</span></p><Bar value={a / b} color="bg-amber-500" /></div>; })}</>}
    </>
  );
};
const Wonders: React.FC = () => {
  const w = W.world!;
  const mine = citiesOf(w, W.me).sort((a, b) => CITY[b.id].pop - CITY[a.id].pop);
  return (
    <>
      <h3 className="font-bold pr-12">Maravilhas</h3>
      <p className="text-slate-300">Cada uma só pode existir uma vez. Quem toma a cidade fica com ela. São erguidas na sua maior cidade livre.</p>
      {WONDERS.map((d) => {
        const x = wonderOf(w, d.id);
        const spot = mine.find((c) => !wonderBlock(w, W.me, d.id, c));
        const no = spot ? '' : wonderBlock(w, W.me, d.id, mine[0] ?? null);
        return (
          <div key={d.id} className={`rounded-xl border p-2 space-y-1.5 ${x ? 'border-amber-500/60' : 'border-slate-700'}`}>
            <p className="flex justify-between gap-2"><b><Ico e={d.icon} /> {d.name}</b>{x ? <span style={{ color: w.players[x.o].color }}>{x.o === W.me ? 'Sua' : w.players[x.o].name}{x.left > 0 ? ` • ${Math.ceil(x.left)}s` : ''}</span> : <Cost v={[d.money, d.fuel]} />}</p>
            <p className="text-slate-300">{d.text}{Object.keys(d.bonus).length ? `: ${bonusText(d.bonus)}` : ''}{d.mood ? ` • povo +${d.mood}` : ''}</p>
            {!x && <Button size="sm" variant="gold" fullWidth disabled={!spot || myPlayer().money < d.money || myPlayer().fuel < d.fuel} onClick={() => spot && order({ c: 'wonder', id: d.id, city: spot.id })}>{spot ? `Construir em ${CITY[spot.id].name}` : no}</Button>}
          </div>
        );
      })}
    </>
  );
};
const StoryCard: React.FC = () => {
  const c = myPlayer().l.chapter!;
  return (
    <div className="war-dilemma" role="dialog" aria-label={c.title}>
      <p className="flex justify-between gap-2"><b className="text-base">{c.title}</b><span className="text-amber-200">{c.who}</span></p>
      <p className="text-slate-200">{c.text}</p>
      <div className="grid grid-cols-2 gap-2">{[c.a, c.b].map((o, n) => <button key={n} onClick={() => order({ c: 'story', n })}><b>{o[0]}</b><small>{gain(o[1])}</small></button>)}</div>
    </div>
  );
};
const gain = (e: { money?: number; fuel?: number; mood?: number; troops?: string; ruin?: number; research?: boolean }) =>
  [e.money && `${e.money > 0 ? '+' : ''}${e.money} dinheiro`, e.fuel && `${e.fuel > 0 ? '+' : ''}${e.fuel} combustível`, e.mood && `${e.mood > 0 ? '+' : ''}${e.mood} humor`, e.troops && '+2 tropas', e.research && '+1 pesquisa', e.ruin && 'estragos'].filter(Boolean).join(', ') || 'nada muda';
const Dilemma: React.FC = () => {
  const d = DILEMMAS[myPlayer().n.dil!.i];
  return (
    <div className="war-dilemma" role="dialog" aria-label={d.title}>
      <p className="flex justify-between gap-2"><b className="flex items-center gap-2 text-base"><Ico e={d.icon} size={20} className="text-amber-300" /> {d.title}</b><span className="text-slate-400">{Math.ceil(myPlayer().n.dil!.left)}s</span></p>
      <p className="text-slate-200">{d.text}</p>
      <div className="grid grid-cols-2 gap-2">{[d.a, d.b].map((o, n) => <button key={n} onClick={() => order({ c: 'choose', n })}><b>{o[0]}</b><small>{gain(o[1])}</small></button>)}</div>
    </div>
  );
};
const Research: React.FC = () => {
  const p = myPlayer();
  return (
    <>
      <h3 className="font-bold pr-12">Pesquisa</h3>
      <div className="war-grid">
        {RESEARCH.map((r) => {
          const lvl = p.res[r.id] ?? 0;
          return <button key={r.id} className="war-item" disabled={lvl >= 3 || !!p.l.lab || p.money < Math.round(researchCost(lvl) * studyFactor(W.world!, W.me))} onClick={() => order({ c: 'research', id: r.id })}><Ico e={r.icon} size={26} className="text-sky-300" /><b>{r.name} {lvl}/3</b><small>{lvl < 3 ? `${r.levels[lvl]}: ${bonusText(r.per)}` : 'Completa'}</small>{lvl < 3 && <Cost v={[Math.round(researchCost(lvl) * studyFactor(W.world!, W.me)), 0]} />}</button>;
        })}
      </div>
      <Lab />
    </>
  );
};
const Score: React.FC = () => {
  const w = W.world!;
  return (
    <>
      <h3 className="font-bold pr-12">{MODES.find((m) => m.id === w.mode)?.name}</h3>
      <p className="text-slate-300">{MODES.find((m) => m.id === w.mode)?.text}</p>
      {w.players.filter((p) => !p.npc).sort((a, b) => popOf(w, b.i) - popOf(w, a.i)).map((p) => (
        <div key={p.i} className={`rounded-xl border p-2 bg-slate-900/70 ${p.alive ? '' : 'opacity-40'}`} style={{ borderColor: p.color }}>
          <b>{p.emblem} {p.name}{!p.online && ' 📴'}</b>
          <span className="block text-slate-300">{citiesOf(w, p.i).length} cidades • {formatNumber(popOf(w, p.i))} hab. • {armySize(w, p.i)} tropas • {Math.round(p.stats.kills ?? 0)} abates</span>
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
    const best = w.players.filter((p) => !p.npc).sort((a, b) => (b.stats[m.stat] ?? 0) - (a.stats[m.stat] ?? 0))[0];
    return { ...m, who: best, n: Math.round(best.stats[m.stat] ?? 0) };
  }).filter((m) => m.n > 0);
  return (
    <Modal isOpen onClose={() => {}} showCloseButton={false} maxWidth="lg" title={w.over!.title} subtitle={`${won ? 'Vitória' : 'Derrota'} • ${clock(w.t)} de guerra`}>
      {w.over!.rank.map((i, n) => {
        const p = w.players[i];
        return <div key={i} className="podium flex items-center gap-2 text-sm rounded-xl border p-2" style={{ borderColor: p.color, animationDelay: `${n * 0.1}s` }}><b className="w-6">{n + 1}º</b><span className="flex-1 truncate">{p.emblem} {p.name}{i === W.me && ' (você)'}</span><span className="text-slate-300 text-xs">{citiesOf(w, i).length} cidades • {Math.round(p.stats.kills ?? 0)} abates</span></div>;
      })}
      <div className="grid grid-cols-2 gap-1.5 text-xs">{medals.map((m) => <p key={m.name} className="rounded-lg bg-slate-800/70 p-2"><Ico e={m.icon} size={14} /> <b>{m.name}</b><span className="block text-slate-300 truncate">{m.who.name}: {formatNumber(m.n)}</span></p>)}</div>
      <Report />
      {W.best && <Button variant="primary" fullWidth icon={<Play size={16} />} onClick={playReplay}>Ver a maior batalha</Button>}
      {W.host ? <Button variant="gold" size="lg" fullWidth onClick={backToLobby}>Jogar de novo</Button> : <p className="text-center text-slate-300 text-sm">Esperando quem criou a sala...</p>}
      <Button variant="outline" fullWidth onClick={quitWar}>Sair</Button>
    </Modal>
  );
};
