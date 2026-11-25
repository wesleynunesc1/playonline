import React, { useState } from 'react';
import { BUILDS, BUILD_IDS, BuildId, CITIES, GRID, MAX_LEVEL, REGION_COLOR, SPELLS, SPELL_IDS, TROOPS, TROOP_IDS } from '../../ceara/content';
import { MODS, mod } from '../../ceara/mods';
import * as V from '../../ceara/village';
import { publish } from '../../ceara/online';

/** Aba do mod menu para a Guerra no Ceará (carregada só quando aberta) */
const v = () => V.me();
const conquer = (id: number) => {
  if (id !== v().city) v().conquered[id] = CITIES.find((c) => c.id === id)!.level;
};
type Act = [string, string, () => void];
const GROUPS: Record<string, Act[]> = {
  Recursos: [
    ['🪙', 'Encher moedas e farinha', () => { v().moedas = V.capOf('moedas'); v().farinha = V.capOf('farinha'); }],
    ['💰', '+1 milhão de tudo', () => { v().moedas += 1e6; v().farinha += 1e6; }],
    ['🍬', '+1.000 rapaduras', () => { v().rapadura += 1000; }],
  ],
  Vila: [
    ['🏗️', 'Terminar todas as obras', () => { for (const p of v().builds) if (p.done) p.done = 1; V.tick(); }],
    ['⬆️', 'Tudo no nível máximo', () => { for (const p of v().builds) Object.assign(p, { level: MAX_LEVEL, done: 0 }); }],
    ['⬇️', 'Voltar tudo ao nível 1', () => { for (const p of v().builds) Object.assign(p, { level: 1, done: 0 }); }],
    ['🧱', 'Cercar a vila de muros', () => {
      for (let i = 2; i < GRID - 2; i++) for (const [x, y] of [[i, 2], [i, GRID - 3], [2, i], [GRID - 3, i]]) if (V.fits('muro', x, y)) v().builds.push({ id: ++v().seq, b: 'muro', level: V.hall(), x, y, done: 0, since: 0 });
    }],
    ['🧹', 'Remover todos os muros', () => { v().builds = v().builds.filter((p) => p.b !== 'muro'); }],
    ['🛡️', 'Escudo de 12 horas', () => { v().shield = Date.now() + 12 * 3600e3; }],
    ['🚫', 'Tirar escudo', () => { v().shield = 0; }],
  ],
  Exército: [
    ['⏩', 'Concluir treino', () => { for (const q of v().training) q.ready = 1; V.tick(); }],
    ...TROOP_IDS.map((t): Act => [TROOPS[t].icon, `+20 ${TROOPS[t].name}`, () => { v().army[t] += 20; }]),
    ...SPELL_IDS.map((s): Act => [SPELLS[s].icon, `+10 ${SPELLS[s].name}`, () => { v().spells[s] += 10; }]),
    ['🗑️', 'Zerar exército', () => { v().army = V.emptySquad(); v().training = []; }],
  ],
  Conquista: [
    ['🚩', 'Conquistar o Ceará inteiro', () => CITIES.forEach((c) => conquer(c.id))],
    ...Object.keys(REGION_COLOR).map((r): Act => ['🗺️', `Conquistar ${r}`, () => CITIES.filter((c) => c.region === r).forEach((c) => conquer(c.id))]),
    ['🏳️', 'Perder todas as cidades', () => { v().conquered = {}; }],
    ['🏆', '+500 troféus', () => { v().trophies += 500; }],
    ['0️⃣', 'Zerar troféus', () => { v().trophies = 0; }],
    ['🎯', 'Refazer missões', () => { v().quests = []; }],
    ['🎁', 'Receber presente de novo', () => { v().gift = ''; V.dailyGift(); }],
  ],
};

const CearaMods: React.FC = () => {
  V.useVillage();
  const [city, setCity] = useState(CITIES[0].id);
  const [kind, setKind] = useState<BuildId>('canhao');
  const [open, setOpen] = useState('Recursos');
  if (!V.V) return <p className="text-slate-400 py-2">Funde sua vila na Guerra no Ceará para liberar esta aba.</p>;
  const run = (fn: () => void) => {
    fn();
    V.touch();
    publish();
  };
  return (
    <>
      {(['Ataque', 'Vila'] as const).map((g) => (
        <div key={g} className="space-y-1.5">
          <p className="mod-title pt-1">Chaves: {g}</p>
          {MODS.filter((m) => m.group === g).map((m) => (
            <button key={m.id} role="switch" aria-checked={mod[m.id]} className="mod-row" onClick={() => { mod[m.id] = !mod[m.id]; V.touch(false); }}>
              <span>{m.icon}</span><span className="flex-1 text-left">{m.name}</span><span className={`mod-switch ${mod[m.id] ? 'mod-switch-on' : ''}`} />
            </button>
          ))}
        </div>
      ))}
      <div className="grid grid-cols-2 gap-1.5">
        <button className="mod-btn" onClick={() => { for (const m of MODS) mod[m.id] = true; V.touch(false); }}>👼 Ligar tudo</button>
        <button className="mod-btn" onClick={() => { for (const m of MODS) mod[m.id] = false; V.touch(false); }}>🧼 Desligar tudo</button>
      </div>
      <div className="mod-box">
        <p className="mod-title">{v().name}: 🪙 {Math.floor(v().moedas)} 🌾 {Math.floor(v().farinha)} 🍬 {v().rapadura}</p>
        <div className="flex gap-2">
          <select value={city} onChange={(e) => setCity(Number(e.target.value))} aria-label="Cidade" className="mod-select">{CITIES.map((c) => <option key={c.id} value={c.id}>{v().conquered[c.id] ? '🚩 ' : ''}{c.name}</option>)}</select>
          <button className="mod-btn" onClick={() => run(() => (v().conquered[city] ? delete v().conquered[city] : conquer(city)))}>{v().conquered[city] ? 'Soltar' : 'Tomar'}</button>
        </div>
        <div className="flex gap-2">
          <select value={kind} onChange={(e) => setKind(e.target.value as BuildId)} aria-label="Construção" className="mod-select">{BUILD_IDS.map((b) => <option key={b} value={b}>{BUILDS[b].name}</option>)}</select>
          <button className="mod-btn" onClick={() => run(() => { const s = V.findSpot(kind); if (s) v().builds.push({ id: ++v().seq, b: kind, level: V.hall(), ...s, done: 0, since: Date.now() }); })}>Criar</button>
        </div>
      </div>
      {Object.entries(GROUPS).map(([g, acts]) => (
        <div key={g} className="space-y-1.5">
          <button className={`mod-btn w-full ${open === g ? 'mod-on' : ''}`} onClick={() => setOpen(open === g ? '' : g)}>{g} ({acts.length})</button>
          {open === g && acts.map(([icon, name, fn]) => <button key={name} className="mod-row" onClick={() => run(fn)}><span>{icon}</span><span className="flex-1 text-left">{name}</span><span className="text-fuchsia-400">▶</span></button>)}
        </div>
      ))}
    </>
  );
};
export default CearaMods;
