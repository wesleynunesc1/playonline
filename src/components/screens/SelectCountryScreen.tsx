import React, { useState } from 'react';
import { ArrowLeft, ChevronRight, Search } from 'lucide-react';
import { useApp } from '../../ui';
import { COUNTRIES, REGIONS, abilityOf, getDifficulty } from '../../data/countries';
import { RES_INFO, RIVALS, TERRAIN_INFO } from '../../data/content';
import { newGame, scenarioOf } from '../../engine/state';
import { Button } from '../common/Button';
import { Card, Row } from '../common/Kit';

const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export const SelectCountryScreen: React.FC = () => {
  const setScreen = useApp((s) => s.setScreen);
  const mode = useApp((s) => s.mode);
  const [id, setId] = useState('BR');
  const [query, setQuery] = useState('');
  const c = COUNTRIES[id];
  const diff = getDifficulty(id);
  const sc = scenarioOf(mode);
  const rival = RIVALS.find((r) => r.capital === id);
  const start = () => {
    newGame(id, mode);
    setScreen('game');
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#070a12] overflow-hidden">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 shrink-0">
        <button onClick={() => setScreen('home')} className="glass-btn h-10 px-3 gap-2 text-xs"><ArrowLeft size={16} /> Voltar</button>
        <h2 className="font-black">{sc ? `${sc.icon} ${sc.name}` : 'Escolha sua nação'}</h2>
      </header>
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4 p-4 max-w-6xl mx-auto w-full">
        <aside className="md:w-80 md:order-2 shrink-0 space-y-3">
          <Card title={<span className="text-xl">{c.flag} {c.name}</span>}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <Row label="Renda">$ {c.income}/s</Row>
              <Row label="Defesa">{c.defense}</Row>
              <Row label="Recurso">{RES_INFO[c.res].icon}</Row>
              <Row label="Terreno">{TERRAIN_INFO[c.terrain].icon}</Row>
            </div>
            <Row label="Dificuldade" tone={diff.color}>{diff.label}</Row>
            <p className="text-amber-200">★ {abilityOf(id).name}: {abilityOf(id).text}</p>
            {rival && <p className="text-slate-400">Você toma o lugar de {rival.icon} {rival.leader}.</p>}
          </Card>
          <Button size="lg" fullWidth onClick={start} icon={<ChevronRight size={18} />}>Liderar esta nação</Button>
        </aside>
        <div className="flex-1 min-h-0 flex flex-col gap-3">
          <label className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3">
            <Search size={16} className="text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar país" className="flex-1 bg-transparent py-2.5 text-sm outline-none" />
          </label>
          <div className="flex-1 overflow-y-auto space-y-4">
            {REGIONS.map((r) => {
              const list = Object.values(COUNTRIES).filter((x) => x.region === r && plain(x.name).includes(plain(query))).sort((a, b) => b.income - a.income);
              if (!list.length) return null;
              return (
                <section key={r}>
                  <h3 className="text-xs font-bold text-slate-400 mb-2">{r}</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {list.map((x) => (
                      <button key={x.id} onClick={() => setId(x.id)} className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs ${x.id === id ? 'bg-blue-950 border-blue-500' : 'bg-slate-900/60 border-slate-800 hover:border-slate-600'}`}>
                        <span className="text-lg">{x.flag}</span>
                        <span className="flex-1 truncate font-bold text-slate-100">{x.name}</span>
                        <span className="font-mono text-emerald-400">${x.income}</span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
