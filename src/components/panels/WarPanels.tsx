import React, { useState } from 'react';
import { Coins, Fuel } from 'lucide-react';
import { hooks } from '../../engine/state';
import { formatNumber } from '../../utils/formatters';
import { CITIES, CITY, RESEARCH, UNITS, UNIT_ERA, UNIT_IDS, UnitId, WORKS, WORKS_ERA, WORKS_IDS, bonusText } from '../../war/data';
import { Ico, Rich } from '../../war/icons';
import { CAMPAIGN, FEATS, W, career, careerLevel, dailyChallenge, myPlayer, order, prefs, setPref, startMission, startSurvival, today, touch } from '../../war/match';
import { GOALS, LAWS, MINISTERS, MOTIONS, OFFERS, SCIENTISTS, SECRETS, SPECS, STOCKS, clues, inflation, seasonOf } from '../../war/realm';
import { World, armySize, citiesOf, goalValue, hostile, incomeOf } from '../../war/sim';
import { thumbs } from '../../war/thumbs';
import { Button } from '../common/Button';
import { Bar } from '../common/Kit';
import { Modal } from '../common/Modal';

/** Painéis avançados da guerra: gabinete, bolsa, assembleia, listas, enciclopédia, conselheiro, carreira e modos. */
export const CostTag: React.FC<{ v: [number, number] }> = ({ v: [m, f] }) => <span className="text-[10px] text-amber-200"><Coins size={11} className="ico" /> {m}{f > 0 && <> <Fuel size={11} className="ico" /> {f}</>}</span>;

export const Cabinet: React.FC = () => {
  const w = W.world!;
  const me = myPlayer();
  const l = me.l;
  const owner = (id: string) => w.players.find((p) => p.l.mins.includes(id));
  return (
    <>
      <h3 className="pr-12">Gabinete</h3>
      <div className="grid grid-cols-3 gap-2 text-center">
        <p className="rounded-xl bg-white/5 p-2">Reputação<b className="block text-lg">{Math.round(l.rep)}</b></p>
        <p className="rounded-xl bg-white/5 p-2">Eleição em<b className="block text-lg">{Math.ceil(l.elect)}s</b></p>
        <p className="rounded-xl bg-white/5 p-2">Inflação<b className="block text-lg">{Math.round((inflation(w, W.me) - 1) * 100)}%</b></p>
      </div>
      <b>Ministros {l.mins.length}/2</b>
      <div className="war-grid">{MINISTERS.map((m) => { const o = owner(m.id); return <button key={m.id} className="war-item" data-on={l.mins.includes(m.id)} disabled={!!o && o.i !== W.me} onClick={() => order({ c: 'min', id: m.id })}><Ico e={m.icon} size={22} className="text-amber-300" /><b>{m.name}</b><small>{o && o.i !== W.me ? `Trabalha para ${o.name}` : `${m.text}. ${bonusText(m.bonus)}${m.mood ? ` • humor ${m.mood > 0 ? '+' : ''}${m.mood}` : ''}`}</small></button>; })}</div>
      <b>Constituição {l.laws.length}/{me.era >= 4 ? 2 : me.era >= 2 ? 1 : 0} (permanente)</b>
      <div className="war-grid">{LAWS.map((m) => <button key={m.id} className="war-item" data-on={l.laws.includes(m.id)} onClick={() => order({ c: 'law', id: m.id })}><Ico e={m.icon} size={22} className="text-sky-300" /><b>{m.name}</b><small>{m.text}. {bonusText(m.bonus)}</small></button>)}</div>
      <b>Objetivo secreto</b>
      <p className="rounded-xl bg-white/5 p-2"><Ico e={GOALS[l.goal].icon} /> {GOALS[l.goal].text} {l.goalDone ? '• cumprido' : '• prêmio: 2000'}</p>
    </>
  );
};
export const Lab: React.FC = () => {
  const me = myPlayer();
  const l = me.l;
  return (
    <>
      {l.lab && <div className="rounded-xl bg-sky-900/40 p-2 space-y-1"><b>Pesquisando {RESEARCH.find((r) => r.id === l.lab!.id)?.name}: {Math.ceil(l.lab.left)}s</b><Bar value={1 - l.lab.left / 24} color="bg-sky-400" /></div>}
      <p className="text-slate-300">Cientistas: {l.sci.length ? l.sci.join(', ') : 'nenhum'} • cada um barateia 10% e traz invenções</p>
      <Button size="sm" variant="secondary" fullWidth disabled={l.sci.length >= 2 || me.money < 1500} onClick={() => order({ c: 'scientist' })}>Contratar 1 dos {SCIENTISTS.length} cientistas (1500)</Button>
      <b>Especialização (cada par só aceita um lado)</b>
      {SPECS.map(([id, a, b]) => { const got = l.spec.find((s) => s.startsWith(id)); return <div key={id} className="grid grid-cols-2 gap-2">{[a, b].map((o, n) => <button key={n} className="war-item" data-on={got === `${id}${n}`} disabled={!!got || l.spec.length >= me.era - 1} onClick={() => order({ c: 'spec', id, n: n as 0 | 1 })}><Ico e={o.icon} size={20} className="text-violet-300" /><b>{o.name}</b><small>{bonusText(o.bonus)}</small>{!got && <CostTag v={[900, 0]} />}</button>)}</div>; })}
      <b>Projeto secreto (Era 4, só um)</b>
      <div className="war-grid">{SECRETS.map((s) => <button key={s.id} className="war-item" data-on={l.secret === s.id} disabled={!!l.secret || me.era < 4} onClick={() => order({ c: 'secret', id: s.id })}><Ico e={s.icon} size={22} className="text-rose-300" /><b>{s.name}</b><small>{s.text}</small><CostTag v={[s.money, 1500]} /></button>)}</div>
    </>
  );
};
export const Exchange: React.FC = () => {
  const w = W.world!;
  const l = myPlayer().l;
  return (
    <>
      <h3 className="pr-12">Bolsa do Ceará</h3>
      <p className="text-slate-300">Compre na baixa, venda na alta.</p>
      {STOCKS.map((s, n) => (
        <div key={s.name} className="rounded-xl bg-white/5 p-2 flex items-center gap-2"><Ico e={s.icon} size={20} className="text-emerald-300" /><span className="flex-1"><b className="block">{s.name}</b><span className={w.x.stk[n] >= 100 ? 'text-emerald-300' : 'text-rose-300'}>{Math.round(w.x.stk[n])}</span> • você tem {l.stk[n]}</span><Button size="sm" variant="primary" onClick={() => order({ c: 'stock', n, buy: true })}>Comprar</Button><Button size="sm" variant="secondary" disabled={!l.stk[n]} onClick={() => order({ c: 'stock', n, buy: false })}>Vender</Button></div>
      ))}
    </>
  );
};
export const VoteBar: React.FC = () => {
  const v = W.world!.x.vote;
  if (!v) return null;
  const m = MOTIONS.find((k) => k.id === v.id)!;
  const mine = v.yes.includes(W.me) ? 'sim' : v.no.includes(W.me) ? 'não' : '';
  return <div className="war-offer pointer-events-auto"><span><Ico e={m.icon} size={14} /> Assembleia: <b>{m.name}</b> ({Math.ceil(v.left)}s)<small className="block opacity-75">{m.text} • {v.yes.length} sim, {v.no.length} não</small></span><span className="flex gap-1.5"><button onClick={() => order({ c: 'vote', yes: true })}>Sim{mine === 'sim' ? ' ✓' : ''}</button><button onClick={() => order({ c: 'vote', yes: false })}>Não{mine === 'não' ? ' ✓' : ''}</button></span></div>;
};
export const Merchant: React.FC<{ go: (x: number, z: number) => void }> = ({ go }) => {
  const w = W.world!;
  const m = w.x.merchant;
  return (
    <>
      <h3 className="pr-12">Mundo</h3>
      <p className="text-slate-300">Estação: {seasonOf(w.t) > 0.4 ? 'chuvosa (renda +5%, estradas lentas)' : seasonOf(w.t) < -0.4 ? 'seca (renda -4%, estradas rápidas)' : 'amena'}{w.x.special ? ` • ${w.x.special}: renda +10%` : ''}{w.x.winter > 0 ? ` • inverno nuclear por ${Math.ceil(w.x.winter)}s` : ''}</p>
      {m ? <><div className="flex items-center justify-between"><b>Mercador viajante ({Math.ceil(m.left)}s)</b><Button size="sm" variant="secondary" onClick={() => go(m.x, m.z)}>Ver</Button></div>
        <div className="war-grid">{OFFERS.map((o, n) => <button key={o.name} className="war-item" disabled={myPlayer().money < o.money} onClick={() => order({ c: 'deal', n })}><Ico e={o.icon} size={22} className="text-amber-300" /><b>{o.name}</b><small>{o.text}</small><CostTag v={[o.money, 0]} /></button>)}</div></>
        : <p className="text-slate-400">Nenhum mercador na estrada agora.</p>}
      <b>Tesouro perdido {w.x.treasure.done ? '(já encontrado)' : '(prêmio: 3000)'}</b>
      {!w.x.treasure.done && clues(w).map((c) => <p key={c} className="rounded-xl bg-white/5 p-2">{c}</p>)}
      <p className="text-slate-300">Ruínas descobertas: {w.x.ruins.filter((r) => r.done).length} de {w.x.ruins.length}</p>
      {myPlayer().l.spyMsg > 0 && w.x.ruins[myPlayer().l.spyMsg - 1] && <Button size="sm" variant="gold" fullWidth onClick={() => { const r = w.x.ruins[myPlayer().l.spyMsg - 1]; go(r.x, r.z); }}>Ver a ruína do mapa antigo</Button>}
    </>
  );
};
export const CityList: React.FC<{ open: (id: number) => void }> = ({ open }) => {
  const w = W.world!;
  const [q, setQ] = useState('');
  const [by, setBy] = useState<'minhas' | 'todas'>('minhas');
  const list = w.cities.filter((c) => (by === 'todas' || c.owner === W.me) && CITY[c.id].name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.mood - b.mood).slice(0, 60);
  return (
    <>
      <h3 className="pr-12">Cidades</h3>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cidade" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 outline-none" />
      <div className="grid grid-cols-2 gap-1.5">{(['minhas', 'todas'] as const).map((k) => <button key={k} onClick={() => setBy(k)} className={`rounded-lg py-2 ${by === k ? 'bg-amber-600' : 'bg-white/10'}`}>{k === 'minhas' ? `Minhas (${citiesOf(w, W.me).length})` : 'Todas'}</button>)}</div>
      {list.map((c) => <button key={c.id} className="w-full flex items-center gap-2 rounded-xl bg-white/5 p-2 text-left" onClick={() => open(c.id)}><span className="w-2.5 h-2.5 rounded-full" style={{ background: w.players[c.owner]?.color ?? '#64748b' }} /><b className="flex-1">{CITY[c.id].name}</b>{c.hit > 0 && <span className="text-rose-300">sob ataque</span>}{c.owner === W.me && <span className={c.mood < 35 ? 'text-rose-300' : 'text-slate-300'}>{Math.round(c.mood)}%</span>}<span className="text-slate-400">{formatNumber(CITY[c.id].pop)}</span></button>)}
    </>
  );
};
const stats = (k: UnitId) => { const d = UNITS[k]; return [['Vida', d.hp], ['Contra infantaria', d.dmg[0]], ['Contra veículos', d.dmg[1]], ['Contra aéreos', d.dmg[2]], ['Alcance', d.range], ['Visão', d.vision], ['Velocidade', d.speed], ['Custo', d.money], ['Combustível', d.fuel], ['Era', UNIT_ERA[k]]] as [string, number][]; };
export const Encyclopedia: React.FC = () => {
  const [a, setA] = useState<UnitId>('tanque');
  const [b, setB] = useState<UnitId | ''>('antitanque');
  const list = UNIT_IDS.filter((k) => k !== 'colosso');
  return (
    <>
      <h3 className="pr-12">Enciclopédia</h3>
      <div className="grid grid-cols-2 gap-2">{[a, b].map((v, n) => <select key={n} value={v} aria-label={`Tropa ${n + 1}`} onChange={(e) => (n ? setB(e.target.value as UnitId) : setA(e.target.value as UnitId))} className="bg-slate-800 rounded-xl p-2">{n === 1 && <option value="">Não comparar</option>}{list.map((k) => <option key={k} value={k}>{UNITS[k].name}</option>)}</select>)}</div>
      <div className="rounded-xl bg-white/5 p-2 space-y-1">
        <div className="grid grid-cols-2 text-center">{[a, b].map((k, n) => k && <span key={n}>{thumbs()[k] && <img src={thumbs()[k]} alt="" className="war-pic big mx-auto" />}<small className="block text-slate-300">{UNITS[k].text}</small></span>)}</div>
        {stats(a).map(([t, v], n) => { const o = b ? stats(b)[n][1] : null; const less = n >= 7; const best = o === null || v === o ? 0 : (v > o) !== less ? 1 : 2; return <p key={t} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center"><b className={`text-right ${best === 1 ? 'text-emerald-300' : ''}`}>{v}</b><span className="text-slate-400 text-center w-32">{t}</span><b className={best === 2 ? 'text-emerald-300' : ''}>{o ?? ''}</b></p>; })}
      </div>
      <b>Construções</b>
      {WORKS_IDS.map((k) => <p key={k} className="rounded-xl bg-white/5 p-2 flex items-center gap-2">{thumbs()[`w-${k}`] && <img src={thumbs()[`w-${k}`]} alt="" className="war-pic" />}<span className="flex-1"><b>{WORKS[k].name}</b><span className="block text-slate-300">{WORKS[k].text}</span></span><span className="text-slate-400">Era {WORKS_ERA[k]}</span></p>)}
    </>
  );
};
/** Próximo passo sugerido, olhando o que falta */
export function advise(w: World, i: number): string {
  const p = w.players[i];
  const mine = citiesOf(w, i);
  const [m, f] = incomeOf(w, i);
  const has = (k: string) => mine.some((c) => c.works.some((x) => x.k === k));
  if (!mine.length) return '';
  if (!p.n.doc) return 'Escolha uma doutrina em Mais > Governo.';
  if (mine.some((c) => c.mood < 30)) return 'Povo revoltado: baixe impostos ou faça uma festa.';
  if (w.players.some((q) => q.alive && hostile(w, i, q.i)) && armySize(w, i) < 6) return 'Você está em guerra com poucas tropas. Treine mais.';
  if (!has('refinaria') && f < 2) return 'Construa uma Refinaria para ter combustível.';
  if (!has('quartel')) return 'Construa um Quartel para poder treinar.';
  if (p.money > 300 && mine.length < 4) return 'Traga uma cidade vizinha por acordo.';
  if (!mine.some((c) => c.dev) && p.money > 400) return 'Evolua sua cidade principal.';
  if (!p.l.lab && p.money > 900) return 'O laboratório está parado. Comece uma pesquisa.';
  if (!p.l.mins.length) return 'Nomeie ministros em Mais > Gabinete.';
  if (w.players.filter((q) => q.alive && q.i !== i && w.rel[i * w.players.length + q.i] >= 2).length === 0) return 'Proponha comércio a um vizinho.';
  if (p.money > 6000 && p.era >= 2) return 'Dinheiro sobrando: pense em uma maravilha.';
  return m < 20 ? 'Construa mais comércio para aumentar a renda.' : 'Tudo em ordem. Junte recursos para a próxima era.';
}
// ===== Tutorial =====
const STEPS = [
  ['Bem-vindo!', 'Esta é a sua cidade. Arraste para andar pelo mapa e use dois dedos para aproximar.'], ['Cidade', 'Toque na sua cidade. Ali você constrói, treina e evolui.'], ['Dinheiro', 'No topo ficam a era, o dinheiro, o combustível e as tropas.'],
  ['Crescer', 'Toque em uma cidade vizinha sem dono e use Trazer por acordo. Não precisa de guerra.'], ['Governar', 'Em Mais estão Governo, Gabinete, Maravilhas, Bolsa e tudo o que decide o rumo do seu povo.'], ['Tropas', 'Toque em uma tropa e depois no chão para mandar. Em Área você seleciona várias.'], ['É com você', 'Ninguém ataca sem declarar guerra antes. Cresça no seu ritmo!'],
];
export const Tutorial: React.FC = () => {
  const n = prefs.tutorial;
  if (n >= STEPS.length) return null;
  return <div className="war-dilemma war-tutor"><p className="flex justify-between"><b className="text-base">{STEPS[n][0]}</b><span className="text-slate-400">{n + 1}/{STEPS.length}</span></p><p>{STEPS[n][1]}</p><div className="grid grid-cols-2 gap-2"><button onClick={() => setPref({ tutorial: 99 })}><b>Pular</b></button><button onClick={() => setPref({ tutorial: n + 1 })}><b>{n + 1 === STEPS.length ? 'Jogar' : 'Próximo'}</b></button></div></div>;
};
export const TIPS = ['Antitanque e drone FPV acabam com blindados.', 'Cidade contente rende até 20% mais.', 'Um General dá +20% de dano a quem está perto.', 'Atacar por trás causa 25% mais dano.', 'Infantaria dentro da cidade leva menos dano.', 'Mercado e Banco na mesma cidade rendem mais.', 'Paz longa traz turismo: até +15% de renda.', 'Quebrar acordos derruba a sua reputação.', 'Trincheiras seguram infantaria como nada mais.', 'Submarinos só aparecem bem de perto.', 'Dinheiro parado demais gera inflação.', 'Radar e espiões mostram o que está escuro.'];
export const Settings: React.FC = () => (
  <>
    <b>Som e conforto</b>
    {([['voice', 'Narrador'], ['music', 'Música conforme a situação'], ['vibe', 'Vibrar nas explosões'], ['safe', 'Cores para daltônicos'], ['intro', 'Filme de abertura']] as const).map(([k, t]) => <button key={k} className="w-full flex items-center justify-between rounded-xl bg-white/5 p-2.5" onClick={() => setPref({ [k]: !prefs[k] })}><span>{t}</span><b className={prefs[k] ? 'text-emerald-300' : 'text-slate-400'}>{prefs[k] ? 'Ligado' : 'Desligado'}</b></button>)}
    <Button size="sm" variant="secondary" fullWidth onClick={() => setPref({ tutorial: 0 })}>Ver o tutorial de novo</Button>
    <p className="text-slate-400">Atalhos no computador: H base, A todas, Q área, B arsenal, G governo, C cidades, Espaço pausa, Esc fecha, 1 a 3 grupos.</p>
  </>
);
// ===== Menu: modos e carreira =====
export const Modes: React.FC<{ go: (fn: () => void) => void }> = ({ go }) => {
  const [open, setOpen] = useState<'' | 'campanha'>('');
  const c = career();
  const d = dailyChallenge();
  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <button className="war-item" onClick={() => setOpen('campanha')}><Ico e="🚩" size={22} className="text-amber-300" /><b>Campanha</b><small>{c.camp}/{CAMPAIGN.length} missões</small></button>
        <button className="war-item" onClick={() => go(() => startMission('dia'))}><Ico e="🎯" size={22} className="text-sky-300" /><b>Desafio do dia</b><small>{c.daily === today() ? `Feito! ${c.streak} seguidos` : d.goal.text}</small></button>
        <button className="war-item" onClick={() => go(startSurvival)}><Ico e="⚠️" size={22} className="text-rose-300" /><b>Sobrevivência</b><small>Recorde: onda {c.wave}</small></button>
      </div>
      <Modal isOpen={!!open} onClose={() => setOpen('')} maxWidth="md" title="Campanha">
        {CAMPAIGN.map((m, n) => <div key={m.name} className={`rounded-xl border p-3 flex items-center gap-3 ${n > c.camp ? 'opacity-40 border-slate-800' : 'border-slate-600'}`}><b className="text-xl w-6">{n + 1}</b><span className="flex-1 text-sm"><b className="block">{m.name}</b><span className="text-slate-300">{m.text} {m.goal.text} em {m.minutes} min.</span></span><Button size="sm" variant="gold" disabled={n > c.camp} onClick={() => go(() => startMission(`c${n}`))}>{n < c.camp ? 'Rejogar' : 'Jogar'}</Button></div>)}
      </Modal>
    </>
  );
};
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const CareerModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const c = career();
  const lv = careerLevel(c);
  const [tab, setTab] = useState<'conquistas' | 'coleção' | 'museu' | 'temporada'>('conquistas');
  const regions = [...new Set(CITIES.map((x) => x.region))];
  return (
    <Modal isOpen onClose={onClose} maxWidth="lg" title={`${lv.title} • nível ${lv.level}`} subtitle={`${c.wins} vitórias em ${c.played} partidas`}>
      <div className="grid grid-cols-4 gap-1 text-xs">{(['conquistas', 'coleção', 'museu', 'temporada'] as const).map((t) => <button key={t} className={`rounded-lg py-2 capitalize ${tab === t ? 'bg-amber-600' : 'bg-slate-800'}`} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === 'conquistas' && <div className="grid grid-cols-2 gap-2 text-xs">{FEATS.map((x) => { const ok = x.ok(c); return <div key={x.name} className={`rounded-xl border p-2 ${ok ? 'border-amber-400 bg-amber-950/30' : 'border-slate-700 opacity-50'}`}><b className="flex items-center gap-1.5"><Ico e={x.icon} /> {x.name}</b><span className="text-slate-300">{x.text}</span></div>; })}</div>}
      {tab === 'coleção' && <><p className="text-sm">Cidades governadas no fim de alguma partida: <b>{c.cards.length}/184</b></p>{regions.map((r) => { const all = CITIES.filter((x) => x.region === r); const got = all.filter((x) => c.cards.includes(x.id)); return <div key={r} className="space-y-1 text-xs"><p className="flex justify-between"><b>{r}</b><span>{got.length}/{all.length}</span></p><Bar value={got.length / all.length} color="bg-emerald-500" /><p className="text-slate-400">{got.map((x) => x.name).join(', ') || 'Nenhuma ainda'}</p></div>; })}</>}
      {tab === 'museu' && (c.log.length ? c.log.map((x, n) => <div key={n} className={`rounded-xl border p-2 text-xs ${x.win ? 'border-amber-400' : 'border-slate-700'}`}><b>{x.title}</b><span className="block text-slate-300">{x.d.split('-').reverse().join('/')} • {x.min} min • {x.cities} cidades</span></div>) : <p className="text-sm text-slate-400">Suas partidas terminadas aparecem aqui.</p>)}
      {tab === 'temporada' && <div className="text-sm space-y-2"><b>Temporada de {MONTHS[new Date().getMonth()]}</b><p>{c.season === today().slice(0, 7) ? c.seasonXp : 0} pontos</p><Bar value={((c.season === today().slice(0, 7) ? c.seasonXp : 0) % 500) / 500} color="bg-violet-500" /><p className="text-slate-400">Nível da temporada: {Math.floor((c.season === today().slice(0, 7) ? c.seasonXp : 0) / 500) + 1}. Recomeça todo mês.</p></div>}
    </Modal>
  );
};
// ===== Fim de partida =====
export const Report: React.FC = () => {
  const w = W.world!;
  const h = W.hist;
  if (h.length < 2) return null;
  const players = w.players.filter((p) => !p.npc);
  const max = Math.max(1, ...h.flatMap((x) => x.pop));
  const end = h[h.length - 1].t || 1;
  const text = `Guerra Ceará 2026: ${w.over?.title}. ${players.map((p) => `${p.name}: ${citiesOf(w, p.i).length} cidades`).join(', ')}.`;
  return (
    <div className="space-y-2">
      <b className="text-sm">População governada ao longo da partida</b>
      <svg viewBox="0 0 300 90" className="w-full rounded-xl bg-slate-950/60" role="img" aria-label="Gráfico de população">{players.map((p) => <polyline key={p.i} fill="none" stroke={p.color} strokeWidth="2" points={h.map((x) => `${(x.t / end) * 296 + 2},${86 - ((x.pop[p.i] ?? 0) / max) * 80}`).join(' ')} />)}</svg>
      <p className="flex flex-wrap gap-x-3 text-xs">{players.map((p) => <span key={p.i}><i className="inline-block w-3 h-0.5 align-middle mr-1" style={{ background: p.color }} />{p.name}</span>)}</p>
      <Button size="sm" variant="outline" fullWidth onClick={() => navigator.clipboard?.writeText(text).then(() => hooks.toast('Relatório copiado.', 'success'), () => {})}>Copiar relatório</Button>
    </div>
  );
};
export const GoalBar: React.FC = () => {
  const w = W.world!;
  if (!w.goal) return null;
  return <span className="text-amber-100"><Ico e="🎯" size={14} /> {w.goal.text} <b>{formatNumber(Math.min(w.goal.n, Math.floor(goalValue(w))))}/{formatNumber(w.goal.n)}</b></span>;
};
/** O que mudou: aparece ao continuar uma partida salva */
export const News: React.FC = () => {
  const w = W.world!;
  if (!W.news) return null;
  const me = myPlayer();
  return <div className="war-dilemma"><b className="text-base">De volta ao governo</b><p>Era {me.era}, {citiesOf(w, W.me).length} cidades, {armySize(w, W.me)} tropas, renda +{Math.round(incomeOf(w, W.me)[0])}/s.</p>{w.log.slice(0, 4).map((l, i) => <p key={i} className="text-slate-300"><Rich t={l.t} /></p>)}<button onClick={() => { W.news = false; touch(); }}><b>Continuar</b></button></div>;
};
