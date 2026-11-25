import React, { useState } from 'react';
import { EVENTS, NUKES, POWER_IDS, POWERS, PowerId, RESEARCH, UNITS, UNIT_IDS, WORKS, WORKS_IDS } from '../../war/data';
import { W, myHome, myPlayer, order, touch, useWar } from '../../war/match';
import { citiesOf, mods, spawn } from '../../war/sim';

type Mod = NonNullable<ReturnType<typeof mods.get>>;
type Tab = 'poderes' | 'nuclear' | 'tropas' | 'cidades' | 'rivais' | 'partida';
const TABS: Record<Tab, string> = { poderes: '⚡ Poderes', nuclear: '☢️ Nuclear', tropas: '🪖 Tropas', cidades: '🏙️ Cidades', rivais: '👹 Rivais', partida: '⏱️ Partida' };
const FLAGS: { icon: string; name: string; set: Partial<Mod> }[] = [
  { icon: '🛡️', name: 'Invencível', set: { god: 1 } },
  { icon: '💰', name: 'Tudo de graça e liberado', set: { free: 1 } },
  { icon: '⚡', name: 'Obras e treino na hora', set: { instant: 1 } },
  { icon: '🪖', name: 'Sem limite de tropas', set: { nocap: 1 } },
  { icon: '💥', name: 'Dano x10', set: { dmg: 9 } },
  { icon: '🏎️', name: 'Velocidade x3', set: { speed: 2 } },
  { icon: '🎯', name: 'Alcance x2', set: { range: 1 } },
  { icon: '👁️', name: 'Ver o mapa todo', set: { vision: 99 } },
  { icon: '📈', name: 'Renda x10', set: { income: 9 } },
  { icon: '⛽', name: 'Combustível x10', set: { fuel: 9 } },
  { icon: '🏰', name: 'Cidades de aço', set: { city: 20 } },
  { icon: '⏱️', name: 'Apoios rápidos', set: { power: 9 } },
];
const SEE = FLAGS.find((f) => f.set.vision)!;
const Btn: React.FC<React.PropsWithChildren<{ on?: boolean; onClick: () => void }>> = ({ on, onClick, children }) => (
  <button onClick={onClick} className={`rounded-lg border px-2 py-2 text-left ${on ? 'bg-fuchsia-700 border-fuchsia-300' : 'bg-[#1b0a26] border-fuchsia-900'}`}>{children}</button>
);
const Grid: React.FC<React.PropsWithChildren> = ({ children }) => <div className="grid grid-cols-2 gap-1.5">{children}</div>;

/** Mod menu da Guerra Ceará 2026. Quem cria a sala comanda o mundo, então só nele tudo funciona */
const WarMods: React.FC = () => {
  useWar();
  const [tab, setTab] = useState<Tab>('poderes');
  const [rival, setRival] = useState(-1);
  const w = W.world;
  if (!w || w.over) return <p className="text-slate-400 py-2">Entre em uma partida da Guerra Ceará 2026.</p>;
  const mine = mods.get(W.me) ?? {};
  const has = (s: Partial<Mod>) => Object.entries(s).every(([k, v]) => mine[k as keyof Mod] === v);
  const toggle = (s: Partial<Mod>) => {
    const next: Record<string, unknown> = { ...mine, ...s };
    if (has(s)) for (const k in s) delete next[k];
    mods.set(W.me, next as Mod);
    touch();
  };
  if (!W.host) {
    return (
      <div className="space-y-2">
        <Btn on={has(SEE.set)} onClick={() => toggle(SEE.set)}>{SEE.icon} {SEE.name}</Btn>
        <p className="text-slate-400">O resto só funciona na sala que você criar, porque é o aparelho do criador que comanda o mundo.</p>
      </div>
    );
  }
  const act = (fn: () => void) => () => {
    fn();
    touch();
  };
  const p = myPlayer();
  const own = citiesOf(w, W.me);
  const home = own[0] ?? myHome();
  const foes = w.players.filter((x) => x.team !== p.team);
  const foe = foes.find((x) => x.i === rival) ?? foes[0];
  const isFoe = (o: number) => o >= 0 && w.players[o].team !== p.team;
  /** Lança de graça, sem esperar */
  const launch = (k: PowerId, x: number, z: number) => act(() => {
    const before = mods.get(W.me);
    mods.set(W.me, { ...before, free: 1 });
    p.cool[k] = 0;
    order({ c: 'power', k, x, z });
    if (before) mods.set(W.me, before);
    else mods.delete(W.me);
  });
  return (
    <div className="space-y-2">
      <nav className="flex gap-1 overflow-x-auto no-scrollbar pb-1">{(Object.keys(TABS) as Tab[]).map((t) => <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-lg px-3 py-2 ${tab === t ? 'bg-fuchsia-700' : 'bg-[#1b0a26]'}`}>{TABS[t]}</button>)}</nav>
      {tab === 'poderes' && (
        <>
          <Grid>{FLAGS.map((f) => <Btn key={f.name} on={has(f.set)} onClick={() => toggle(f.set)}>{f.icon} {f.name}</Btn>)}</Grid>
          <Grid>
            <Btn onClick={act(() => mods.set(W.me, Object.assign({}, ...FLAGS.map((f) => f.set))))}>😈 Ligar tudo</Btn>
            <Btn onClick={act(() => mods.delete(W.me))}>⭕ Desligar tudo</Btn>
            <Btn onClick={act(() => { p.money += 10000; })}>💰 +10 mil</Btn>
            <Btn onClick={act(() => { p.fuel += 5000; })}>⛽ +5 mil</Btn>
            <Btn onClick={act(() => { for (const r of RESEARCH) p.res[r.id] = 3; })}>🔬 Toda a pesquisa</Btn>
            <Btn onClick={act(() => { for (const k of POWER_IDS) p.cool[k] = 0; })}>💥 Apoios prontos</Btn>
          </Grid>
        </>
      )}
      {tab === 'nuclear' && (
        <>
          <p className="mod-title">Alvo: {foe ? `${foe.emblem} ${foe.name}` : 'nenhum'}</p>
          <Grid>
            {foe && (Object.keys(NUKES) as PowerId[]).map((k) => { const c = citiesOf(w, foe.i)[0]; return c && <Btn key={k} onClick={launch(k, c.x, c.z)}>{POWERS[k].icon} {POWERS[k].name}</Btn>; })}
            <Btn onClick={act(() => { for (const f of foes) { const c = citiesOf(w, f.i)[0]; if (c) launch('balistico', c.x, c.z)(); } })}>🌋 Apocalipse: um míssil em cada rival</Btn>
            <Btn onClick={act(() => { w.rads = []; })}>🧹 Limpar radiação</Btn>
            <Btn onClick={act(() => { w.zones = w.zones.filter((z) => !NUKES[z.k] || z.o === W.me); })}>🔰 Derrubar mísseis inimigos</Btn>
            <Btn onClick={act(() => { for (const c of own) if (!c.works.some((k) => k.k === 'domo')) c.works.push({ k: 'domo', left: 0, cool: 0 }); })}>🔰 Domo em todas as cidades</Btn>
          </Grid>
        </>
      )}
      {tab === 'tropas' && (
        <>
          <p className="mod-title">Criar 5 na base</p>
          <div className="grid grid-cols-3 gap-1.5">{UNIT_IDS.map((k) => <Btn key={k} onClick={act(() => { for (let i = 0; i < 5; i++) spawn(w, k, W.me, home.x + Math.cos(i * 1.3), home.z + Math.sin(i * 1.3)); })}>{UNITS[k].icon} {UNITS[k].name}</Btn>)}</div>
          <Grid>
            <Btn onClick={act(() => { for (const u of w.units) if (u.o === W.me) u.hp = u.max; })}>❤️ Curar todas</Btn>
            <Btn onClick={act(() => { for (const u of w.units) if (u.o === W.me) u.star = 3; })}>⭐ Todas veteranas</Btn>
            <Btn onClick={act(() => { for (const u of w.units) if (u.o === W.me) Object.assign(u, { x: home.x + Math.random(), z: home.z + 1 + Math.random(), go: 0 }); })}>🌀 Teleportar para a base</Btn>
            <Btn onClick={act(() => { for (const u of w.units) if (isFoe(u.o)) u.hp = 0; })}>💀 Apagar tropas inimigas</Btn>
          </Grid>
        </>
      )}
      {tab === 'cidades' && (
        <>
          <Grid>
            <Btn onClick={act(() => { for (const c of own) c.hp = c.max; })}>❤️ Reparar minhas</Btn>
            <Btn onClick={act(() => { for (const c of own) for (const k of c.works) k.left = 0; })}>🏗️ Terminar obras</Btn>
            <Btn onClick={act(() => { for (const c of w.cities) if (c.owner < 0) c.hp = 1; })}>🏚️ Neutras fracas</Btn>
            <Btn onClick={act(() => { for (const c of w.cities) if (isFoe(c.owner)) c.hp = 1; })}>🏚️ Inimigas fracas</Btn>
            <Btn onClick={act(() => { for (const c of w.cities) if (c.owner < 0 && Math.hypot(c.x - home.x, c.z - home.z) < 9) c.owner = W.me; })}>🗺️ Tomar vizinhas</Btn>
            <Btn onClick={act(() => { for (const c of w.cities) if (c.owner < 0) c.owner = W.me; })}>🌎 Tomar todas as neutras</Btn>
          </Grid>
          <p className="mod-title">Construir na base, na hora</p>
          <div className="grid grid-cols-3 gap-1.5">{WORKS_IDS.map((k) => <Btn key={k} onClick={act(() => { home.works.push({ k, left: 0, cool: 0 }); })}>{WORKS[k].icon} {WORKS[k].name}</Btn>)}</div>
        </>
      )}
      {tab === 'rivais' && foe && (
        <>
          <select value={foe.i} onChange={(e) => setRival(Number(e.target.value))} aria-label="Rival" className="mod-select">{foes.map((f) => <option key={f.i} value={f.i}>{f.emblem} {f.name}{f.alive ? '' : ' (eliminado)'}</option>)}</select>
          <Grid>
            <Btn on={W.frozen} onClick={act(() => { W.frozen = !W.frozen; })}>🧊 Parar todos os robôs</Btn>
            <Btn onClick={act(() => { for (const u of w.units) if (u.o === foe.i) u.off = 30; })}>📴 Desligar tropas 30s</Btn>
            <Btn onClick={act(() => Object.assign(foe, { money: 0, fuel: 0 }))}>📉 Quebrar economia</Btn>
            <Btn onClick={act(() => { p.money += foe.money; p.fuel += foe.fuel; Object.assign(foe, { money: 0, fuel: 0 }); })}>🦹 Roubar tudo</Btn>
            <Btn onClick={act(() => { for (const u of w.units) if (u.o === foe.i) u.o = W.me; })}>🧲 Converter tropas</Btn>
            <Btn onClick={act(() => { for (const c of w.cities) if (c.owner === foe.i) Object.assign(c, { owner: W.me, q: [], loop: '' }); for (const u of w.units) if (u.o === foe.i) u.hp = 0; foe.alive = false; })}>🏳️ Eliminar e ficar com tudo</Btn>
            <Btn onClick={act(() => { foe.money += 5000; foe.fuel += 2000; })}>🎁 Dar recursos</Btn>
          </Grid>
        </>
      )}
      {tab === 'partida' && (
        <>
          <p className="mod-title">Velocidade do mundo</p>
          <div className="grid grid-cols-4 gap-1.5">{[0.5, 1, 2, 4].map((n) => <Btn key={n} on={W.speed === n} onClick={act(() => { W.speed = n; })}>{n}x</Btn>)}</div>
          <Grid>
            <Btn onClick={act(() => { w.left += 600; })}>⏱️ +10 minutos</Btn>
            <Btn onClick={act(() => { w.left = 0.1; })}>🏁 Encerrar agora</Btn>
          </Grid>
          <p className="mod-title">Disparar evento</p>
          <Grid>{EVENTS.filter((e) => e.seconds).map((e) => <Btn key={e.name} onClick={act(() => { w.event = { i: EVENTS.indexOf(e), left: e.seconds }; })}>{e.icon} {e.name}</Btn>)}</Grid>
        </>
      )}
    </div>
  );
};
export default WarMods;
