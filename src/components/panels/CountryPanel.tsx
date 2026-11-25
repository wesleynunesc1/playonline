import React, { useState } from 'react';
import { Swords } from 'lucide-react';
import { useApp } from '../../ui';
import { COUNTRIES } from '../../data/countries';
import { BUILDINGS, Building, ERAS, GENERALS, MAX_BUILDING, POWERS, Power, RARITY, RES_INFO, TERRAIN_INFO, UNITS, UNIT_INFO, WONDERS, describeMods } from '../../data/content';
import { Army, M, emptyArmy, game, ownerName, useGame } from '../../engine/state';
import { SHIP_CAPACITY, attackPower, buildCost, countryIncome, defensePower, enemyMix, landTroops, reach, spyChance, upgradeCost, winChance } from '../../engine/calc';
import { attackBlock, garrison, startAttack, suggestArmy, toggleSiege, usePower } from '../../engine/war';
import { OP_INFO, SPY_COST, SpyOp, build, buildWonder, buyCountry, buyPrice, spyOp, toggleRoute, ultimatum, upgradeCountry, vassalize } from '../../engine/realm';
import { formatMoney, formatNumber } from '../../utils/formatters';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Action, Bar, Card, Row } from '../common/Kit';

const REACH_TEXT = { terra: '🛣️ Por terra', mar: '🚢 Por mar', ar: '🪂 Pelo ar' };

export const CountryPanel: React.FC = () => {
  const id = useApp((s) => s.selected);
  if (!id) return null;
  return <Content key={id} id={id} />;
};

const Content: React.FC<{ id: string }> = ({ id }) => {
  useGame();
  const g = game();
  const select = useApp((s) => s.select);
  const base = COUNTRIES[id];
  const c = g.countries[id];
  const terrain = TERRAIN_INFO[base.terrain];
  const mine = c.owner === 'P';

  return (
    <Modal
      isOpen
      onClose={() => select('')}
      maxWidth="md"
      title={<>{base.flag} {base.name}{g.capital === id && ' 👑'}</>}
      subtitle={`${base.region} • ${c.vassal ? 'Seu vassalo' : ownerName(c.owner)}`}
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <Row label="Renda">$ {Math.round(countryIncome(id))}/s</Row>
        <Row label="Produz">{RES_INFO[base.res].icon} {RES_INFO[base.res].name}</Row>
        <Row label="Terreno">{terrain.icon} {terrain.name}</Row>
        <Row label={mine ? 'Guarnição' : 'Defesa'}>{formatNumber(mine ? c.def : defensePower(id))}</Row>
      </div>
      {mine ? <Mine id={id} /> : <Foreign id={id} />}
    </Modal>
  );
};

const Mine: React.FC<{ id: string }> = ({ id }) => {
  const g = game();
  const c = g.countries[id];
  const [wonders, setWonders] = useState(false);
  return (
    <>
      <Card>
        <Row label="Felicidade" tone={c.happy < 30 ? 'text-rose-400' : 'text-emerald-300'}>{Math.round(c.happy)}%</Row>
        <Bar value={c.happy / 100} color={c.happy < 30 ? 'bg-rose-500' : 'bg-emerald-500'} />
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="secondary" onClick={() => garrison(id, 10)}>+10 guarnição</Button>
          <Button size="sm" variant="secondary" onClick={() => garrison(id, -10)}>-10 guarnição</Button>
        </div>
      </Card>
      <Action icon="📈" title={`Economia nível ${c.level}`} text="+40% da renda básica" button={formatMoney(upgradeCost(id))} disabled={g.money < upgradeCost(id)} variant="primary" onClick={() => upgradeCountry(id)} />
      {(Object.keys(BUILDINGS) as Building[]).filter((b) => b !== 'porto' || COUNTRIES[id].coastal).map((b) => {
        const max = c.b[b] >= MAX_BUILDING;
        return (
          <Action key={b} icon={BUILDINGS[b].icon} title={`${BUILDINGS[b].name} ${c.b[b]}/${MAX_BUILDING}`} text={BUILDINGS[b].text}
            button={max ? 'Máx.' : formatMoney(buildCost(id, b))} disabled={max || g.money < buildCost(id, b)} onClick={() => build(id, b)} />
        );
      })}
      <Button size="sm" variant="outline" fullWidth onClick={() => setWonders(!wonders)}>🏛️ Maravilhas ({Object.keys(g.wonders).length}/{WONDERS.length})</Button>
      {wonders && WONDERS.map((w) => (
        <Action key={w.id} icon={w.icon} title={w.name} text={`${describeMods(w.mods)} • ${w.iron} ferro`}
          button={g.wonders[w.id] ? COUNTRIES[g.wonders[w.id]].flag : formatMoney(w.cost)}
          disabled={!!g.wonders[w.id] || g.money < w.cost || g.res.iron < w.iron} onClick={() => buildWonder(w.id, id)} />
      ))}
    </>
  );
};

const Foreign: React.FC<{ id: string }> = ({ id }) => {
  const g = game();
  const c = g.countries[id];
  const [tab, setTab] = useState<'guerra' | 'diplomacia' | 'espioes'>('guerra');
  const tabs = { guerra: '⚔️ Guerra', diplomacia: '🤝 Diplomacia', espioes: '🕵️ Espiões' };
  return (
    <>
      <div className="grid grid-cols-3 gap-1">
        {(Object.keys(tabs) as (keyof typeof tabs)[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`py-2 rounded-lg text-xs font-bold ${tab === t ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>{tabs[t]}</button>
        ))}
      </div>
      {tab === 'guerra' && <War id={id} />}
      {tab === 'diplomacia' && (
        c.owner ? (
          <Card>
            <p className="text-slate-300">Este país pertence a {ownerName(c.owner)}. Negocie com o líder na aba Diplomacia.</p>
            <Button size="sm" onClick={() => useApp.getState().setPanel('diplomacia')}>Abrir Diplomacia</Button>
          </Card>
        ) : (
          <>
            <Action icon="🚛" title="Rota comercial" text={`+$ ${Math.round(4 + COUNTRIES[id].income * 0.25)}/s. Pode ser saqueada`} button={c.route ? 'Encerrar' : '$ 300'} disabled={c.vassal} onClick={() => toggleRoute(id)} />
            <Action icon="📣" title="Ultimato" text="Rende-se sem luta se seu exército for muito maior" button="Ameaçar" onClick={() => ultimatum(id)} />
            <Action icon="🤲" title="Vassalagem" text="Paga metade da renda como tributo" button={formatMoney(buyPrice(id) * 0.2)} disabled={c.vassal} onClick={() => vassalize(id)} />
            <Action icon="🧾" title="Comprar país" text="Anexa sem guerra nem má fama" button={formatMoney(buyPrice(id))} disabled={g.money < buyPrice(id)} variant="gold" onClick={() => buyCountry(id)} />
          </>
        )
      )}
      {tab === 'espioes' && (Object.keys(OP_INFO) as SpyOp[]).map((op) => {
        const rival = g.rivals[c.owner];
        const blocked = (OP_INFO[op].rivalOnly && !rival) || (op === 'roubar' && !rival?.spy) || c.vassal;
        return (
          <Action key={op} icon={OP_INFO[op].icon} title={`${OP_INFO[op].name} (${spyChance(OP_INFO[op].bonus + (rival?.spy ? 10 : 0))}%)`} text={OP_INFO[op].text}
            button={formatMoney(SPY_COST[op])} disabled={blocked || g.money < SPY_COST[op]} onClick={() => spyOp(op, id)} />
        );
      })}
    </>
  );
};

const War: React.FC<{ id: string }> = ({ id }) => {
  const g = game();
  const c = g.countries[id];
  const select = useApp((s) => s.select);
  const free = Object.keys(M.generals).filter((x) => !M.generals[x].captor);
  const [general, setGeneral] = useState(M.staff.find((x) => free.includes(x)) ?? free[0] ?? '');
  const [army, setArmy] = useState<Army>(() => suggestArmy(id, general));
  const block = attackBlock(id);
  const way = reach(id);
  const mix = enemyMix(id);
  const sent = Object.fromEntries(UNITS.map((u) => [u, Math.min(army[u], Math.floor(g.army[u]))])) as Army;
  const power = attackPower(sent, id, general);
  const defense = defensePower(id);
  const chance = Math.round(winChance(power, defense) * 100);
  const crowded = way === 'mar' && landTroops(sent) > sent.navy * SHIP_CAPACITY;

  return (
    <>
      <Card>
        <Row label="Alcance" tone={way ? 'text-emerald-300' : 'text-rose-400'}>{way ? REACH_TEXT[way] : 'Fora de alcance'}</Row>
        <Row label="Exército inimigo">{UNITS.filter((u) => mix[u] > 0).map((u) => `${UNIT_INFO[u].icon}${Math.round(mix[u] * 100)}%`).join(' ')}</Row>
        {block && <p className="text-amber-300">{block}</p>}
        {UNITS.map((u) => (
          <label key={u} className="flex items-center gap-2">
            <span className="w-32 truncate text-slate-200" title={UNIT_INFO[u].beats}>{UNIT_INFO[u].icon} {ERAS[g.era].units[u]}</span>
            <input type="range" min={0} max={Math.floor(g.army[u])} value={sent[u]} onChange={(e) => setArmy({ ...sent, [u]: Number(e.target.value) })} className="flex-1 accent-blue-500" aria-label={ERAS[g.era].units[u]} />
            <span className="w-16 text-right font-mono text-slate-100">{sent[u]}/{Math.floor(g.army[u])}</span>
          </label>
        ))}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setArmy(suggestArmy(id, general))}>Sugerir</Button>
          <Button size="sm" variant="outline" onClick={() => setArmy({ ...g.army })}>Tudo</Button>
          <Button size="sm" variant="outline" onClick={() => setArmy(emptyArmy())}>Zerar</Button>
        </div>
        <label className="flex items-center gap-2">
          <span className="text-slate-400">General</span>
          <select value={general} onChange={(e) => setGeneral(e.target.value)} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100">
            <option value="">Nenhum</option>
            {free.map((x) => {
              const d = GENERALS.find((y) => y.id === x)!;
              return <option key={x} value={x}>{d.icon} {d.name} Nv.{M.generals[x].lvl} ({RARITY[d.rarity].name})</option>;
            })}
          </select>
        </label>
        <Row label={`⚔️ ${formatNumber(power)} contra 🛡️ ${formatNumber(defense)}`} tone={chance >= 70 ? 'text-emerald-300' : chance >= 40 ? 'text-amber-300' : 'text-rose-400'}>{chance}%</Row>
        <Bar value={chance / 100} color={chance >= 70 ? 'bg-emerald-500' : chance >= 40 ? 'bg-amber-500' : 'bg-rose-500'} />
        {crowded && <p className="text-amber-300">Cada navio leva {SHIP_CAPACITY} tropas: envie mais navios.</p>}
      </Card>
      <Button variant="danger" size="lg" fullWidth disabled={!!block || !way || crowded || power <= 0} icon={<Swords size={18} />}
        onClick={() => { if (startAttack(id, sent, general)) select(''); }}>
        Atacar
      </Button>
      <div className="grid grid-cols-3 gap-2">
        <Button size="sm" variant="secondary" disabled={!c.siege && (!!block || way !== 'terra')} onClick={() => toggleSiege(id)}>{c.siege ? 'Suspender cerco' : '⛓️ Cercar'}</Button>
        {(['bombardeio', 'nuclear'] as Power[]).map((p) => (
          <Button key={p} size="sm" variant="secondary" disabled={!!block || g.powers[p] > 0 || (p === 'nuclear' && (g.era < 3 || g.res.uranium < 20))} title={POWERS[p].text}
            onClick={() => { if (usePower(p, id)) select(''); }}>
            {POWERS[p].icon} {g.powers[p] > 0 ? `${Math.ceil(g.powers[p])}s` : POWERS[p].name}
          </Button>
        ))}
      </div>
    </>
  );
};
