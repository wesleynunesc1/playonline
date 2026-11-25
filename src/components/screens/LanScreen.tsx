import React, { useEffect, useState } from 'react';
import { ArrowLeft, Share2, Wifi } from 'lucide-react';
import { useApp } from '../../ui';
import { COUNTRIES, abilityOf } from '../../data/countries';
import { EMBLEMS, MAX_PLAYERS, MODES, RULES } from '../../lan/content';
import { RoomInfo, listRooms } from '../../lan/net';
import { L, canStart, colorOf, createRoom, enterRoom, hasRule, kick, myEmblem, myName, myself, quit, saveProfile, setMine, setOptions, startMatch, teamOf } from '../../lan/match';
import { G, M, bump, hooks, loadSave, useGame } from '../../engine/state';
import { HelpButton } from '../panels/HelpModal';
import { Button } from '../common/Button';
import { Action, Card } from '../common/Kit';

const LIST_MS = 3000;

/** Salas do mesmo Wi-Fi e preparação da partida */
export const LanScreen: React.FC = () => {
  useGame();
  const setScreen = useApp((s) => s.setScreen);
  useEffect(() => {
    if (L.phase === 'play' && G) setScreen('game');
  });
  const back = () => {
    quit();
    setScreen('home');
  };
  return (
    <div className="w-full h-full flex flex-col bg-[radial-gradient(ellipse_at_top,#10264d,#05070f_70%)] overflow-hidden">
      <header className="safe-top flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
        <button onClick={back} className="glass-btn h-11 px-3 gap-2 text-xs"><ArrowLeft size={16} /> Sair</button>
        <h2 className="font-black flex items-center gap-2"><Wifi size={18} /> Jogar no Wi-Fi</h2>
        <span className="ml-auto" />
        {L.phase === 'lobby' && <span className="font-mono font-bold text-amber-300 tracking-widest">{L.code}</span>}
        <HelpButton />
      </header>
      <div className="flex-1 overflow-y-auto overscroll-contain p-4 safe-bottom">
        <div className="max-w-3xl mx-auto space-y-4">{L.phase === 'lobby' ? <Lobby /> : <Finder />}</div>
      </div>
    </div>
  );
};

const Finder: React.FC = () => {
  const [name, setName] = useState(myName());
  const [emblem, setEmblem] = useState(myEmblem());
  const [code, setCode] = useState('');
  const [rooms, setRooms] = useState<RoomInfo[] | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () =>
      listRooms().then((r) => { if (alive) { setRooms(r); setOffline(false); } }, () => alive && setOffline(true));
    load();
    const t = setInterval(() => document.hidden || load(), LIST_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const go = (fn: () => void) => {
    if (name.trim().length < 2) return hooks.toast('Escreva seu apelido primeiro.', 'danger');
    saveProfile(name.trim(), emblem);
    fn();
  };
  const busy = L.phase === 'joining';
  return (
    <>
      {L.error && <p className="rounded-xl border border-rose-500 bg-rose-950/60 p-3 text-sm text-rose-200">{L.error}</p>}
      <Card title="Quem é você?">
        <input value={name} maxLength={14} onChange={(e) => setName(e.target.value)} placeholder="Seu apelido" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-base outline-none focus:border-blue-500" />
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
          {EMBLEMS.map((e) => <button key={e} onClick={() => setEmblem(e)} aria-label={`Emblema ${e}`} className={`h-11 rounded-xl text-2xl ${e === emblem ? 'bg-blue-600' : 'bg-slate-800'}`}>{e}</button>)}
        </div>
        {!!M.lan?.played && <p className="text-slate-400">{M.lan.wins} vitórias em {M.lan.played} partidas</p>}
      </Card>
      <Button size="lg" fullWidth disabled={busy} onClick={() => go(createRoom)}>Criar sala</Button>
      <Card title={<span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Salas neste Wi-Fi</span>}>
        {offline && <p className="text-amber-300">Sem conexão com a internet.</p>}
        {rooms?.length === 0 && <p className="text-slate-400">Nenhuma sala ainda. Crie uma e peça para entrarem neste mesmo site.</p>}
        {rooms?.map((r) => (
          <Action key={r.code} icon="🎮" title={r.name} text={`${r.code} • ${r.players}/${MAX_PLAYERS} jogadores${r.started ? ' • em andamento' : ''}`} button={busy ? '...' : 'Entrar'} variant="primary"
            disabled={busy || r.started || r.players >= MAX_PLAYERS} onClick={() => go(() => enterRoom(r.code))} />
        ))}
      </Card>
      <Card title="Não apareceu? Use o código">
        <div className="flex gap-2">
          <input value={code} maxLength={4} autoCapitalize="characters" onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))} placeholder="ABCD" className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-base font-mono tracking-[0.4em] text-center outline-none focus:border-blue-500" />
          <Button disabled={code.length !== 4 || busy} onClick={() => go(() => enterRoom(code))}>{busy ? 'Conectando...' : 'Entrar'}</Button>
        </div>
      </Card>
      {loadSave() && <p className="text-xs text-slate-400 text-center">Sua partida solo salva não é afetada.</p>}
    </>
  );
};

const Lobby: React.FC = () => {
  const me = myself();
  const [query, setQuery] = useState('');
  if (!me) return null;
  const taken = new Set(L.players.filter((p) => p !== me).map((p) => p.country));
  const share = async () => {
    const text = `Entra na minha sala do World Empire! Código ${L.code}: ${location.origin}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        hooks.toast('Convite copiado!', 'success');
      }
    } catch { /* cancelado */ }
  };
  const toggleRule = (id: string) => setOptions(L.mode, hasRule(id) ? L.rules.filter((r) => r !== id) : [...L.rules, id]);
  const list = Object.values(COUNTRIES).filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.income - a.income);
  return (
    <>
      <Card title={`Jogadores ${L.players.length}/${MAX_PLAYERS}`}>
        {L.players.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl bg-slate-900/80 border border-slate-800 p-2.5">
            <span className="text-2xl w-10 h-10 grid place-items-center rounded-full" style={{ background: colorOf(p.id) }}>{p.emblem}</span>
            <span className="flex-1 min-w-0">
              <b className="block truncate text-slate-100">{p.name}{p.id === 'h0' && ' 👑'}{p.id === L.me && ' (você)'}</b>
              <span className="text-slate-400">{COUNTRIES[p.country].flag} {COUNTRIES[p.country].name}{L.mode === 'equipes' && ` • Time ${teamOf(p.id) ? 'B' : 'A'}`}</span>
            </span>
            <span className={p.ready ? 'text-emerald-300 font-bold' : 'text-slate-500'}>{p.ready ? 'Pronto' : 'Escolhendo'}</span>
            {L.host && p.id !== L.me && <button onClick={() => kick(p.id)} aria-label={`Remover ${p.name}`} className="glass-btn w-9 h-9">✕</button>}
          </div>
        ))}
        <Button size="sm" variant="outline" fullWidth icon={<Share2 size={14} />} onClick={share}>Convidar (código {L.code})</Button>
      </Card>

      <Card title="Modo">
        <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
          {MODES.map((m) => (
            <button key={m.id} disabled={!L.host} onClick={() => setOptions(m.id, L.rules)} className={`text-left rounded-xl border p-2.5 ${L.mode === m.id ? 'border-amber-400 bg-amber-950/40' : 'border-slate-800 bg-slate-900/60'} ${!L.host && L.mode !== m.id ? 'hidden' : ''}`}>
              <b className="text-slate-100">{m.icon} {m.name}</b> <span className="text-slate-400">{m.minutes} min</span>
              <span className="block text-slate-300">{m.text}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card title={`Regras extras ${L.rules.length ? `(${L.rules.length})` : ''}`}>
        <div className="flex flex-wrap gap-1.5">
          {RULES.filter((r) => L.host || hasRule(r.id)).map((r) => (
            <button key={r.id} disabled={!L.host} title={r.text} onClick={() => toggleRule(r.id)} className={`rounded-full px-3 py-2 border text-left ${hasRule(r.id) ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'}`}>
              {r.icon} {r.name}{hasRule(r.id) && <span className="block text-[10px] text-blue-100">{r.text}</span>}
            </button>
          ))}
          {!L.host && !L.rules.length && <span className="text-slate-400">Nenhuma</span>}
        </div>
      </Card>
      <Card title={`Sua nação: ${COUNTRIES[me.country].flag} ${COUNTRIES[me.country].name}`}>
        <p className="text-amber-200">★ {abilityOf(me.country).name}: {abilityOf(me.country).text}</p>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar país" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-base outline-none" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto overscroll-contain">
          {list.map((c) => (
            <button key={c.id} disabled={taken.has(c.id)} onClick={() => setMine({ country: c.id })} className={`flex items-center gap-2 rounded-xl border p-2.5 text-left disabled:opacity-30 ${c.id === me.country ? 'bg-blue-950 border-blue-500' : 'bg-slate-900/60 border-slate-800'}`}>
              <span>{c.flag}</span><span className="flex-1 truncate">{c.name}</span><span className="text-emerald-400 font-mono">${c.income}</span>
            </button>
          ))}
        </div>
      </Card>
      <div className="sticky bottom-0 pt-2 bg-gradient-to-t from-[#05070f] to-transparent">
        {L.host
          ? <Button size="lg" variant="gold" fullWidth disabled={!canStart()} onClick={() => { startMatch(); bump(); }}>{L.players.length < 2 ? 'Esperando jogadores...' : canStart() ? 'Começar partida!' : 'Esperando todos ficarem prontos'}</Button>
          : <Button size="lg" variant={me.ready ? 'secondary' : 'gold'} fullWidth onClick={() => setMine({ ready: !me.ready })}>{me.ready ? 'Cancelar' : 'Estou pronto!'}</Button>}
      </div>
    </>
  );
};
