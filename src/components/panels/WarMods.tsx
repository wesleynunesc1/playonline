import React from 'react';
import { CITIES, POWER_IDS, RESEARCH, UNITS, UNIT_IDS, WORKS } from '../../war/data';
import { W, myHome, myPlayer, touch, useWar } from '../../war/match';
import { citiesOf, mods, spawn } from '../../war/sim';

type Mod = NonNullable<ReturnType<typeof mods.get>>;
const FLAGS: { icon: string; name: string; set: Partial<Mod> }[] = [
  { icon: '🛡️', name: 'Invencível', set: { god: 1 } },
  { icon: '💰', name: 'Tudo de graça', set: { free: 1 } },
  { icon: '⚡', name: 'Construção e treino na hora', set: { instant: 1 } },
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
const Btn: React.FC<React.PropsWithChildren<{ on?: boolean; onClick: () => void }>> = ({ on, onClick, children }) => (
  <button onClick={onClick} className={`rounded-lg border px-2 py-2 text-left ${on ? 'bg-fuchsia-700 border-fuchsia-300' : 'bg-[#1b0a26] border-fuchsia-900'}`}>{children}</button>
);

/** Aba do mod menu para a Guerra Ceará 2026 (vale para quem comanda a partida) */
const WarMods: React.FC = () => {
  useWar();
  const w = W.world;
  if (!w || w.over) return <p className="text-slate-400 py-2">Entre em uma partida da Guerra Ceará 2026.</p>;
  if (!W.host) return <p className="text-slate-400 py-2">Na sala de outra pessoa quem manda é o aparelho que criou a sala. Crie você a sala para usar.</p>;
  const mine = mods.get(W.me) ?? {};
  const has = (s: Partial<Mod>) => Object.entries(s).every(([k, v]) => mine[k as keyof Mod] === v);
  const toggle = (s: Partial<Mod>) => {
    const next: Record<string, unknown> = { ...mine, ...s };
    if (has(s)) for (const k in s) delete next[k];
    mods.set(W.me, next as Mod);
    touch();
  };
  const act = (fn: () => void) => () => {
    fn();
    touch();
  };
  const p = myPlayer();
  const home = citiesOf(w, W.me)[0] ?? myHome();
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">{FLAGS.map((f) => <Btn key={f.name} on={has(f.set)} onClick={() => toggle(f.set)}>{f.icon} {f.name}</Btn>)}</div>
      <p className="mod-title">Ações</p>
      <div className="grid grid-cols-2 gap-1.5">
        <Btn onClick={act(() => { p.money += 10000; })}>💰 +10 mil</Btn>
        <Btn onClick={act(() => { p.fuel += 5000; })}>⛽ +5 mil</Btn>
        <Btn onClick={act(() => { for (const r of RESEARCH) p.res[r.id] = 3; })}>🔬 Toda a pesquisa</Btn>
        <Btn onClick={act(() => { for (const k of POWER_IDS) p.cool[k] = 0; })}>💥 Apoios prontos</Btn>
        <Btn onClick={act(() => { for (const u of w.units) if (u.o === W.me) u.hp = u.max; for (const c of citiesOf(w, W.me)) c.hp = c.max; })}>❤️ Reparar tudo</Btn>
        <Btn onClick={act(() => { for (const c of citiesOf(w, W.me)) for (const k of c.works) k.left = 0; })}>🏗️ Terminar obras</Btn>
        <Btn onClick={act(() => { for (const c of w.cities) if (c.owner < 0) Object.assign(c, { hp: 1 }); })}>🏚️ Neutras fracas</Btn>
        <Btn onClick={act(() => { for (const c of w.cities) if (c.owner < 0 && Math.hypot(c.x - home.x, c.z - home.z) < 9) c.owner = W.me; })}>🗺️ Tomar vizinhas</Btn>
        <Btn onClick={act(() => { for (const u of w.units) if (w.players[u.o].team !== p.team) u.off = 30; })}>🥶 Congelar inimigos 30s</Btn>
        <Btn onClick={act(() => { for (const u of w.units) if (w.players[u.o].team !== p.team) u.hp = Math.min(u.hp, 1); })}>💀 Inimigos com 1 de vida</Btn>
        <Btn onClick={act(() => { home.works.push(...(['fabrica', 'drones', 'aeroporto', 'silo'] as const).filter((k) => !home.works.some((x) => x.k === k)).map((k) => ({ k, left: 0, cool: 0 }))); })}>{WORKS.silo.icon} Base completa</Btn>
        <Btn onClick={act(() => { w.left += 600; })}>⏱️ +10 minutos</Btn>
        <Btn onClick={act(() => { w.left = 0.1; })}>🏁 Encerrar agora</Btn>
        <Btn onClick={act(() => { for (const c of CITIES) { const s = w.cities.find((x) => x.id === c.id)!; s.owner = W.me; } })}>🌎 Tomar o Ceará</Btn>
      </div>
      <p className="mod-title">Criar tropas na base (5)</p>
      <div className="grid grid-cols-3 gap-1.5">
        {UNIT_IDS.map((k) => <Btn key={k} onClick={act(() => { for (let i = 0; i < 5; i++) spawn(w, k, W.me, home.x + Math.cos(i * 1.3), home.z + Math.sin(i * 1.3)); })}>{UNITS[k].icon} {UNITS[k].name}</Btn>)}
      </div>
    </div>
  );
};
export default WarMods;
