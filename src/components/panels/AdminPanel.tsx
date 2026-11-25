import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useApp } from '../../ui';
import { COUNTRIES, REGIONS } from '../../data/countries';
import { ERAS, RESOURCES, RES_INFO, UNITS, UNIT_INFO } from '../../data/content';
import { GEOPOLITICAL_EVENTS } from '../../data/events';
import { G, M, bump, cheat, hooks, isHuman, ownerName, rivalDef, save, useGame } from '../../engine/state';
import * as C from '../../engine/cheats';
import { forceStrike } from '../../engine/war';
import { CARDS, WORLD_EVENTS } from '../../lan/content';
import { L, applyEffect } from '../../lan/match';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';

export const AdminLogin: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const enter = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      useApp.setState({ admin: true });
      hooks.toast('Mod menu liberado.', 'success');
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Sem conexão.');
      setPin('');
    }
    setBusy(false);
  };
  return (
    <Modal isOpen onClose={onClose} maxWidth="sm" title="🔒 Administrador">
      <form onSubmit={enter} className="space-y-3">
        <input type="password" inputMode="numeric" autoComplete="off" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Senha" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-base text-center tracking-[0.5em] outline-none" />
        {error && <p role="alert" className="text-sm text-rose-300 text-center">{error}</p>}
        <Button type="submit" fullWidth disabled={!pin || busy}>{busy ? 'Verificando...' : 'Entrar'}</Button>
      </form>
    </Modal>
  );
};

// ===== Catálogo do menu =====
type Tab = 'jogador' | 'guerra' | 'mundo' | 'rivais' | 'wifi' | 'progresso' | 'visual';
const TABS: Record<Tab, string> = { jogador: '👤 Jogador', guerra: '⚔️ Guerra', mundo: '🌍 Mundo', rivais: '👹 Rivais', wifi: '📶 Wi-Fi', progresso: '🏆 Progresso', visual: '🎬 Efeitos' };
const WarMods = lazy(() => import('./WarMods'));
type Entry =
  | { tab: Tab; name: string; icon: string; toggle: keyof typeof cheat }
  | { tab: Tab; name: string; icon: string; run: () => void; game?: boolean; solo?: boolean }
  | { tab: Tab; name: string; icon: string; get: () => number; set: (n: number) => void; max: number; game?: boolean };

const FLAG_TAB: Record<string, Tab> = { god: 'guerra', win: 'guerra', reach: 'guerra', free: 'guerra', power: 'guerra', army: 'jogador', rich: 'jogador', calm: 'jogador', freeze: 'rivais', see: 'rivais', snake: 'progresso', snakeSlow: 'progresso', cards: 'wifi' };
const g = () => G!;
const act = (tab: Tab, icon: string, name: string, run: () => void, extra: { game?: boolean; solo?: boolean } = { game: true }): Entry => ({ tab, icon, name, run, ...extra });
const num = (tab: Tab, icon: string, name: string, get: () => number, set: (n: number) => void, max: number, inGame = true): Entry => ({ tab, icon, name, get, set, max, game: inGame });

const ENTRIES: Entry[] = [
  ...C.FLAGS.map((f): Entry => ({ tab: FLAG_TAB[f.id], name: f.name, icon: f.icon, toggle: f.id })),
  num('jogador', '💰', 'Dinheiro', () => g().money, (n) => { g().money = n; }, 1e9),
  num('jogador', '🔬', 'Ciência', () => g().science, (n) => { g().science = n; }, 1e6),
  ...RESOURCES.map((r) => num('jogador', RES_INFO[r].icon, RES_INFO[r].name, () => g().res[r], (n) => { g().res[r] = n; }, 1e5)),
  ...UNITS.map((u) => num('jogador', UNIT_INFO[u].icon, { inf: 'Infantaria', tank: 'Blindados', air: 'Aéreo', navy: 'Naval' }[u], () => g().army[u], (n) => { g().army[u] = n; }, 1e6)),
  num('jogador', '🔥', 'Moral (%)', () => g().morale * 100, (n) => { g().morale = n / 100; }, 300),
  num('jogador', '🎖️', 'Veteranos', () => g().vet, (n) => { g().vet = n; }, 400),
  num('jogador', '😠', 'Má fama', () => g().infamy, (n) => { g().infamy = n; }, 100),
  num('jogador', '🏦', 'Dívida', () => g().debt, (n) => { g().debt = n; }, 1e7),
  num('jogador', '⏳', `Era (0 a ${ERAS.length - 1})`, () => g().era, (n) => { g().era = Math.round(n); }, ERAS.length - 1),
  num('jogador', '📈', 'Renda extra por segundo', () => g().bonusIncome, (n) => { g().bonusIncome = n; }, 1e6),
  act('jogador', '🧠', 'Toda tecnologia e eras', C.maxTech),
  act('jogador', '🏗️', 'Obras no máximo', C.maxBuildings),
  act('jogador', '🏛️', 'Todas as maravilhas', C.allWonders),
  act('jogador', '🚀', 'Lua e Marte', C.goMars),
  act('jogador', '🎉', 'Povo 100% feliz', C.happyPeople),
  act('guerra', '🛡️', 'Escudo e paraquedas prontos', () => { g().shield = true; g().para = true; }),
  act('guerra', '🧱', 'Guarnição +500 em tudo', () => C.fortify(500)),
  act('guerra', '🎯', 'Inimigos com defesa 5', C.weakenAll),
  act('guerra', '🏁', 'Vencer batalha atual', C.winBattle),
  act('guerra', '🚫', 'Cancelar invasão', () => { g().threat = null; }),
  ...REGIONS.map((r) => act('guerra', '🗺️', `Tomar ${r}`, () => C.takeContinent(r))),
  act('guerra', '🌍', 'Tomar o mundo inteiro', C.takeWorld),
  num('mundo', '⏩', 'Velocidade do mundo (solo)', () => cheat.speed, (n) => { cheat.speed = Math.max(1, n); }, 100),
  act('mundo', '⏱️', 'Pular 1 minuto', () => C.skip(60), { game: true, solo: true }),
  act('mundo', '⏱️', 'Pular 10 minutos', () => C.skip(600), { game: true, solo: true }),
  act('mundo', '🌞', 'Próxima estação', C.nextSeason),
  act('mundo', '🌙', 'Dia / noite', C.toggleNight),
  act('mundo', '💹', 'Mercado em alta (x3)', () => C.market(3)),
  act('mundo', '📉', 'Mercado em baixa', () => C.market(0.35)),
  act('mundo', '🗳️', 'Votação da ONU', C.forceVote, { game: true, solo: true }),
  act('mundo', '🧟', 'Soltar zumbis', C.spawnZombies),
  act('mundo', '🔥', 'Guerra mundial', C.worldWar),
  act('mundo', '🕊️', 'Paz mundial', C.worldPeace),
  act('mundo', '🤝', 'Todos viram aliados', C.befriendAll),
  act('mundo', '🔄', 'Libertar todos os países rivais', C.freeWorld),
  ...GEOPOLITICAL_EVENTS.map((e) => act('mundo', '⚠️', `Crise: ${e.title}`, () => { g().crisis = e.id; }, { game: true, solo: true })),
  act('mundo', '👑', 'Vencer agora', () => C.forceEnd(true), { game: true, solo: true }),
  act('mundo', '💀', 'Perder agora', () => C.forceEnd(false), { game: true, solo: true }),
  num('wifi', '⏱️', 'Minutos restantes (criador)', () => L.left / 60, (n) => { if (L.host) L.left = n * 60; }, 120),
  act('wifi', '🃏', 'Trocar a mão de cartas', () => { L.hand = Array.from({ length: 4 }, () => CARDS[Math.floor(Math.random() * CARDS.length)].id); }),
  ...CARDS.map((c) => act('wifi', c.icon, `Carta: ${c.name}`, () => { L.hand = [...L.hand, c.id].slice(-4); })),
  ...WORLD_EVENTS.map((e) => act('wifi', e.icon, `Efeito em mim: ${e.name}`, () => applyEffect(e.fx))),
  num('progresso', '⭐', 'Experiência', () => M.xp, (n) => { M.xp = n; }, 1e6, false),
  num('progresso', '🎁', 'Baús', () => M.chests, (n) => { M.chests = Math.round(n); }, 999, false),
  num('progresso', '✨', 'Legado', () => M.legacy, (n) => { M.legacy = Math.round(n); }, 999, false),
  num('progresso', '🔥', 'Sequência de dias', () => M.streak, (n) => { M.streak = Math.round(n); }, 999, false),
  num('progresso', '🗓️', 'Pontos de temporada', () => M.season.pts, (n) => { M.season.pts = n; }, 9999, false),
  act('progresso', '🎖️', 'Todos os generais no máximo', C.unlockGenerals, {}),
  act('progresso', '🗡️', 'Todos os equipamentos', C.allItems, {}),
  act('progresso', '💠', 'Prestígio no máximo', C.maxPerks, {}),
  act('progresso', '🎯', 'Cumprir missões', C.finishMissions, {}),
  act('progresso', '📖', 'Liberar campanha', C.unlockCampaign, {}),
  act('progresso', '🦖', 'Reviver chefão semanal', () => { M.bossWeek = ''; }, {}),
  act('visual', '☢️', 'Assistir explosão nuclear', () => hooks.nuke(useApp.getState().selected || 'BR')),
  act('visual', '🧹', 'Limpar marcas de guerra', () => { g().scars = []; }),
  act('visual', '🪶', 'Efeitos leves liga/desliga', () => { document.documentElement.classList.toggle('lite'); }, {}),
];

const PRESETS: { name: string; icon: string; on: (keyof typeof cheat)[] }[] = [
  { name: 'Deus', icon: '👼', on: ['god', 'win', 'rich', 'army', 'reach', 'free', 'power', 'calm', 'see'] },
  { name: 'Conquistador', icon: '⚔️', on: ['win', 'army', 'reach', 'free'] },
  { name: 'Magnata', icon: '💰', on: ['rich', 'calm'] },
  { name: 'Desligar tudo', icon: '🧼', on: [] },
];

const Btn: React.FC<React.PropsWithChildren<{ onClick: () => void; on?: boolean; className?: string }>> = ({ onClick, on, className = '', children }) => (
  <button onClick={onClick} className={`mod-btn ${on ? 'mod-on' : ''} ${className}`}>{children}</button>
);

const EntryRow: React.FC<{ e: Entry }> = ({ e }) => {
  const [text, setText] = useState('');
  const apply = (n: number) => {
    if (!('set' in e) || !Number.isFinite(n)) return;
    e.set(Math.max(0, Math.min(e.max, n)));
    setText('');
    save();
    bump();
  };
  if ('toggle' in e) {
    const on = !!cheat[e.toggle];
    return (
      <button role="switch" aria-checked={on} onClick={() => { (cheat[e.toggle] as boolean) = !on; bump(); }} className="mod-row">
        <span>{e.icon}</span><span className="flex-1 text-left">{e.name}</span>
        <span className={`mod-switch ${on ? 'mod-switch-on' : ''}`} />
      </button>
    );
  }
  if ('set' in e) {
    const now = e.get();
    return (
      <div className="mod-row">
        <span>{e.icon}</span><span className="flex-1 min-w-0 truncate">{e.name}</span>
        <Btn className="hidden xs:block" onClick={() => apply(now / 2)}>÷2</Btn>
        <input inputMode="decimal" aria-label={e.name} value={text} placeholder={String(Math.round(now))} onChange={(x) => setText(x.target.value.replace(',', '.'))} onKeyDown={(x) => x.key === 'Enter' && apply(Number(text))} onBlur={() => text && apply(Number(text))} className="w-20 min-w-0 bg-black/60 border border-fuchsia-900 rounded px-2 py-1.5 font-mono text-right outline-none focus:border-fuchsia-400" />
        <Btn className="hidden xs:block" onClick={() => apply(Math.max(1, now) * 2)}>x2</Btn>
        <Btn onClick={() => apply(e.max)}>MÁX</Btn>
      </div>
    );
  }
  return (
    <button onClick={() => { e.run(); save(); bump(); hooks.sound('tech'); }} className="mod-row">
      <span>{e.icon}</span><span className="flex-1 text-left">{e.name}</span><span className="text-fuchsia-400">▶</span>
    </button>
  );
};

const available = (e: Entry) => !('game' in e && e.game && !G) && !('solo' in e && e.solo && G?.mode === 'lan') && !(e.tab === 'wifi' && G?.mode !== 'lan' && !('toggle' in e));

/** Edita qualquer país: dono, defesa, ataques */
const CountryEditor: React.FC = () => {
  const selected = useApp((s) => s.selected);
  const [id, setId] = useState(selected || 'US');
  const c = g().countries[id];
  const owners = ['P', '', ...Object.keys(g().rivals).filter((r) => G?.mode !== 'lan' || !isHuman(r)), ...(G?.mode === 'lan' ? [] : ['Z'])];
  const strike = (kind: 'bomba' | 'nuclear') => {
    if (forceStrike(kind, id)) useApp.setState({ panel: null, selected: '' });
  };
  return (
    <div className="mod-box">
      <p className="mod-title">Editor de país</p>
      <select value={id} onChange={(e) => setId(e.target.value)} aria-label="País" className="mod-select">
        {Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name)).map((x) => <option key={x.id} value={x.id}>{x.name}: {ownerName(g().countries[x.id].owner)}</option>)}
      </select>
      <label className="flex items-center gap-2"><span className="w-16">Dono</span>
        <select value={c.owner} onChange={(e) => C.setOwner(id, e.target.value)} className="mod-select">{owners.map((o) => <option key={o} value={o}>{ownerName(o)}</option>)}</select>
      </label>
      <EntryRow key={`d${id}`} e={num('guerra', '🛡️', 'Defesa', () => c.def, (n) => { c.def = n; }, 1e6)} />
      <EntryRow key={`l${id}`} e={num('guerra', '📈', 'Economia', () => c.level, (n) => { c.level = Math.max(1, Math.round(n)); }, 50)} />
      <div className="grid grid-cols-2 gap-1.5">
        <Btn onClick={() => strike('bomba')}>💣 Bombardear</Btn>
        <Btn onClick={() => strike('nuclear')}>☢️ Nuclear</Btn>
        {c.owner === 'P' && <Btn onClick={() => { g().capital = id; bump(); }}>👑 Virar capital</Btn>}
        <Btn onClick={() => useApp.getState().select(id)}>🔎 Abrir país</Btn>
      </div>
    </div>
  );
};

const RivalEditor: React.FC = () => {
  const list = Object.values(g().rivals).filter((r) => !isHuman(r.id));
  const [id, setId] = useState(list[0]?.id ?? '');
  const r = g().rivals[id];
  if (!r) return <p className="text-slate-400">Sem rivais da máquina.</p>;
  return (
    <div className="mod-box">
      <p className="mod-title">Editor de rival</p>
      <select value={id} onChange={(e) => setId(e.target.value)} aria-label="Rival" className="mod-select">{list.map((x) => <option key={x.id} value={x.id}>{rivalDef(x.id).icon} {rivalDef(x.id).leader} {x.alive ? '' : '(derrotado)'}</option>)}</select>
      <EntryRow key={`p${id}`} e={num('rivais', '⚔️', 'Poder', () => r.power, (n) => { r.power = n; }, 1e6)} />
      <EntryRow key={`r${id}`} e={num('rivais', '🤝', 'Relação (0 a 200, meio 100)', () => r.rel + 100, (n) => { r.rel = n - 100; }, 200)} />
      <div className="grid grid-cols-2 gap-1.5">
        <Btn on={r.ally} onClick={() => { r.ally = !r.ally; bump(); }}>Aliado</Btn>
        <Btn on={r.trade} onClick={() => { r.trade = !r.trade; bump(); }}>Tratado</Btn>
        <Btn onClick={() => { r.truce = 600; bump(); }}>🕊️ Trégua 10 min</Btn>
        <Btn onClick={() => { r.sanction = 600; r.cyber = 600; bump(); }}>📉 Quebrar economia</Btn>
        <Btn onClick={() => C.annexRival(id)}>🏳️ Anexar tudo</Btn>
        <Btn onClick={() => C.destroyRival(id)}>💥 Destruir</Btn>
        {!r.alive && <Btn onClick={() => C.reviveRival(id)}>♻️ Reviver</Btn>}
        <Btn onClick={() => C.attackMe(id)}>😈 Mandar me atacar</Btn>
      </div>
    </div>
  );
};

/** Botão arrastável e mod menu, só para quem entrou com a senha. F2 abre e fecha */
export const AdminMenu: React.FC = () => {
  useGame();
  const admin = useApp((s) => s.admin);
  const [open, setOpen] = useState(false);
  const screen = useApp((s) => s.screen);
  const [tab, setTab] = useState<Tab>('jogador');
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState({ x: -1, y: 220 });
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  useEffect(() => {
    if (!admin) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'F2') return;
      e.preventDefault();
      setOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [admin]);

  // Abre já na aba do jogo em que a pessoa está
  useEffect(() => {
    if (screen === 'game') setTab('jogador');
  }, [screen]);

  if (!admin) return null;
  const active = C.FLAGS.filter((f) => cheat[f.id]).length;
  const list = ENTRIES.filter((e) => available(e) && (query ? e.name.toLowerCase().includes(query.toLowerCase()) : e.tab === tab));
  const x = pos.x < 0 ? window.innerWidth - 54 : Math.min(pos.x, window.innerWidth - 50);

  return (
    <>
      {!open && <button
        aria-label="Mod menu"
        className="mod-fab"
        style={{ left: x, top: Math.max(20, Math.min(pos.y, window.innerHeight - 70)) }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { dx: e.clientX - x, dy: e.clientY - pos.y, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const nx = e.clientX - d.dx;
          const ny = e.clientY - d.dy;
          if (!d.moved && Math.hypot(nx - x, ny - pos.y) < 6) return;
          d.moved = true;
          setPos({ x: Math.max(4, nx), y: Math.max(4, ny) });
        }}
        onPointerUp={() => { drag.current = drag.current?.moved ? { ...drag.current } : null; }}
        onClick={() => {
          const moved = drag.current?.moved;
          drag.current = null;
          if (!moved) setOpen(!open);
        }}
      >
        🛠️{active > 0 && <b className="absolute -top-1 -right-1 bg-fuchsia-600 rounded-full text-[10px] px-1">{active}</b>}
      </button>}
      {open && (
        <div role="dialog" aria-label="Mod menu" className="mod-menu">
          <header className="mod-head">
            <b className="mod-logo">{screen === 'war' ? 'MOD CEARÁ 2026' : 'MOD MENU'}</b>
            <span className="text-[10px] text-fuchsia-300">{screen === 'war' ? '' : `${active} ativos • `}F2</span>
            <button onClick={() => setOpen(false)} aria-label="Fechar mod menu" className="ml-auto w-10 h-10 grid place-items-center"><X size={18} /></button>
          </header>
          {screen === 'war' ? <div className="flex-1 overflow-y-auto overscroll-contain p-3"><Suspense fallback={<p>Carregando...</p>}><WarMods /></Suspense></div> : <>
          <div className="grid grid-cols-4 gap-1.5 px-3 pt-2">
            {PRESETS.map((p) => (
              <Btn key={p.name} onClick={() => { for (const f of C.FLAGS) cheat[f.id] = p.on.includes(f.id); if (!p.on.length) cheat.speed = 1; bump(); }}>{p.icon} <span className="block text-[10px] leading-tight">{p.name}</span></Btn>
            ))}
          </div>
          <label className="mod-search"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Buscar em ${ENTRIES.length} funções`} className="flex-1 min-w-0 bg-transparent outline-none" /></label>
          {!query && (
            <nav className="flex gap-1 px-3 pb-2 overflow-x-auto no-scrollbar">
              {(Object.keys(TABS) as Tab[]).map((t) => <Btn key={t} on={tab === t} onClick={() => setTab(t)} className="shrink-0 whitespace-nowrap">{TABS[t]}</Btn>)}
            </nav>
          )}
          <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-4 space-y-1.5">
            {!G && !query && tab !== 'progresso' && <p className="text-slate-400 py-2">Entre em uma partida para liberar o resto desta aba.</p>}
            {G && !query && tab === 'guerra' && <CountryEditor />}
            {G && !query && tab === 'rivais' && <RivalEditor />}
            {list.map((e) => <EntryRow key={e.tab + e.name} e={e} />)}
            {!query && tab === 'progresso' && <Btn className="w-full" onClick={() => { for (const f of C.FLAGS) cheat[f.id] = false; cheat.speed = 1; useApp.setState({ admin: false }); import('../../war/sim').then(({ mods }) => mods.clear()); setOpen(false); bump(); }}>🚪 Sair do modo administrador</Btn>}
          </div></>}
        </div>
      )}
    </>
  );
};
