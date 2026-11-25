import React, { useState } from 'react';
import { Panel, updateMusic, useApp } from '../../ui';
import { BY_REGION, REGIONS, TOTAL_COUNTRIES, abilityOf } from '../../data/countries';
import {
  BRANCHES, COMBOS, ERAS, GENERALS, ITEMS, MOD_LABEL, ModKey, PERKS, POWERS, Power, RARITY, REGIMES, RESOURCES, RES_INFO, SEASON_STEP,
  SEASON_TIERS, SKILLS, SPACE, Skill, TECH_COST, UNITS, UNIT_INFO, describeMods,
} from '../../data/content';
import { ACHIEVEMENTS } from '../../data/achievements';
import { M, Mission, bump, game, isHuman, levelOf, owned, rivalDef, save, scenarioOf, titleOf, useGame, xpFor } from '../../engine/state';
import { SEASON_NAMES, TAX_INFO, armyPower, budget, continentsOwned, hasMonopoly, mods, monopolyShare, production, recruitCost, revealed, scienceRate, seasonNow } from '../../engine/calc';
import { BOSS, bossPower, fightBoss, recruit, usePower } from '../../engine/war';
import {
  advanceEra, betray, callAlly, declareWar, gift, giftCost, loanLimit, payLoan, proposeAlliance, proposeTrade, proposeTruce, reachSpace,
  regimeCost, research, routeLimit, setRegime, setTax, takeLoan, techBlock, techCost, trade,
} from '../../engine/realm';
import { Loot, buyPerk, claimSeason, doPrestige, equip, finishGame, learnSkill, openChest, prestigeGain, ransom, ransomCost, seasonName, toggleStaff, weekKey } from '../../engine/meta';
import { VICTORIES, victoryProgress } from '../../engine/tick';
import { formatDuration, formatMoney, formatNumber } from '../../utils/formatters';
import { HelpButton } from './HelpModal';
import { HumanActions } from './LanHud';
import { L, modeOf, quit } from '../../lan/match';
import { checkNow, isInstalled } from '../../hooks/useUpdate';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Action, Bar, Card, Row } from '../common/Kit';

const TITLES: Record<Exclude<Panel, null>, string> = {
  imperio: '🏛️ Império', exercito: '⚔️ Exército', generais: '🎖️ Generais', diplomacia: '🤝 Diplomacia',
  ciencia: '🔬 Ciência', missoes: '🎯 Missões', mundo: '🌍 Mundo', menu: '☰ Menu',
};
const signed = (n: number) => `${n >= 0 ? '+' : '-'}$ ${formatNumber(Math.abs(n))}/s`;

export const Panels: React.FC = () => {
  useGame();
  const panel = useApp((s) => s.panel);
  const setPanel = useApp((s) => s.setPanel);
  if (!panel || !game()) return null;
  const Body = { imperio: Empire, exercito: ArmyPanel, generais: Generals, diplomacia: Diplomacy, ciencia: Science, missoes: Missions, mundo: World, menu: Menu }[panel];
  return (
    <Modal isOpen onClose={() => setPanel(null)} maxWidth="lg" title={TITLES[panel]}>
      <Body />
    </Modal>
  );
};

const Empire: React.FC = () => {
  const g = game();
  const b = budget();
  const prod = production();
  const lines: [string, number][] = [['Impostos', b.taxes], ['Rotas e tratados', b.routes], ['Vassalos', b.vassals], ['Colônias espaciais', b.space], ['Outros', b.bonus], ['Exército', -b.upkeep], ['Cercos', -b.siege], ['Juros', -b.interest]];
  return (
    <>
      <Card title="Orçamento">
        {lines.filter(([, v]) => v).map(([l, v]) => <Row key={l} label={l} tone={v < 0 ? 'text-rose-300' : 'text-emerald-300'}>{signed(v)}</Row>)}
        <Row label="Total">{signed(b.total)}</Row>
      </Card>
      <Card title="Impostos">
        <div className="grid grid-cols-4 gap-1">
          {TAX_INFO.map((t, i) => (
            <button key={t.name} onClick={() => setTax(i as 0)} className={`py-2 rounded-lg font-bold ${g.tax === i ? 'bg-blue-600' : 'bg-slate-800 text-slate-300'}`}>{t.name}</button>
          ))}
        </div>
        <p className="text-slate-400">Renda x{TAX_INFO[g.tax].income} • felicidade {TAX_INFO[g.tax].happy >= 0 ? '+' : ''}{TAX_INFO[g.tax].happy}. Abaixo de 25% há revoltas.</p>
      </Card>
      <Card title="Mercado mundial">
        {RESOURCES.map((r) => (
          <div key={r} className="flex items-center gap-2">
            <span className="flex-1">{RES_INFO[r].icon} {RES_INFO[r].name} <b className="font-mono">{formatNumber(g.res[r])}</b> <span className="text-slate-400">+{prod[r].toFixed(2)}/s</span></span>
            <span className={`font-mono ${g.prices[r] > RES_INFO[r].price ? 'text-rose-300' : 'text-emerald-300'}`}>$ {Math.round(g.prices[r])} {g.prices[r] > RES_INFO[r].price ? '▲' : '▼'}</span>
            <Button size="sm" variant="secondary" onClick={() => trade(r, 10)}>+10</Button>
            <Button size="sm" variant="secondary" disabled={g.res[r] < 10} onClick={() => trade(r, -10)}>-10</Button>
          </div>
        ))}
      </Card>
      <Card title="Monopólios e continentes">
        {RESOURCES.map((r) => <Row key={r} label={`${RES_INFO[r].icon} ${RES_INFO[r].name}`} tone={hasMonopoly(r) ? 'text-amber-300' : undefined}>{hasMonopoly(r) ? 'MONOPÓLIO' : `${Math.round(monopolyShare(r) * 100)}% de 60%`}</Row>)}
        {REGIONS.map((r) => <Row key={r} label={r} tone={continentsOwned().includes(r) ? 'text-amber-300' : undefined}>{BY_REGION[r].filter((id) => g.countries[id].owner === 'P').length}/{BY_REGION[r].length}</Row>)}
        <p className="text-slate-400">Continente completo: +25% renda. Monopólio: produção dobrada e +10% renda.</p>
      </Card>
      <Action icon="🏦" title={`Dívida: ${formatMoney(g.debt)}`} text={`Limite ${formatMoney(loanLimit())}. Estourar leva à falência`} button="Empréstimo" onClick={takeLoan} />
      {g.debt > 0 && <Action icon="💸" title="Pagar dívida" text={`Juros: ${signed(-b.interest)}`} button="Pagar" onClick={payLoan} />}
      <Card title="Regime de governo">
        {REGIMES.map((r) => <Action key={r.id} icon={r.icon} title={r.name} text={describeMods(r.mods)} button={g.regime === r.id ? 'Atual' : formatMoney(regimeCost())} disabled={g.regime === r.id} onClick={() => setRegime(r.id)} />)}
      </Card>
      <p className="text-xs text-slate-400">Rotas comerciais: {Object.values(g.countries).filter((c) => c.route).length}/{routeLimit()} (toque em um país independente)</p>
    </>
  );
};

const ArmyPanel: React.FC = () => {
  const g = game();
  const active = (Object.entries(mods()) as [ModKey, number][]).filter(([, v]) => v);
  return (
    <>
      <Card>
        <Row label="Poder total">{formatNumber(armyPower(g.army))}</Row>
        <Row label="Moral" tone={g.morale >= 1 ? 'text-emerald-300' : 'text-rose-300'}>{Math.round(g.morale * 100)}%</Row>
        <Row label="Veteranos (bônus de ataque)">+{Math.round(g.vet / 4)}%</Row>
        <Row label="Estação">{SEASON_NAMES[seasonNow()]}</Row>
      </Card>
      {UNITS.map((u) => {
        const need = Object.entries(UNIT_INFO[u].cost).map(([r, n]) => `${RES_INFO[r as 'oil'].icon}${n! * 10}`).join(' ');
        return (
          <Card key={u} title={<>{UNIT_INFO[u].icon} {ERAS[g.era].units[u]}: {formatNumber(g.army[u])}</>}>
            <p className="text-slate-400">Poder {UNIT_INFO[u].power} • {UNIT_INFO[u].beats} • 10 custam {need}</p>
            <div className="grid grid-cols-3 gap-2">
              {[10, 50, 200].map((n) => <Button key={n} size="sm" variant="secondary" disabled={g.money < recruitCost(u, n)} onClick={() => recruit(u, n)}>+{n} ({formatMoney(recruitCost(u, n))})</Button>)}
            </div>
          </Card>
        );
      })}
      <Card title="Poderes">
        {(Object.keys(POWERS) as Power[]).map((p) => (
          <Action key={p} icon={POWERS[p].icon} title={POWERS[p].name} text={POWERS[p].text}
            button={g.powers[p] > 0 ? `${Math.ceil(g.powers[p])}s` : POWERS[p].needsTarget ? 'No mapa' : (p === 'escudo' && g.shield) || (p === 'paraquedas' && g.para) ? 'Pronto' : 'Usar'}
            disabled={g.powers[p] > 0 || POWERS[p].needsTarget} onClick={() => usePower(p)} />
        ))}
      </Card>
      <Action icon={BOSS.icon} title={`Chefão semanal: ${BOSS.name}`} text={`Poder ${formatNumber(bossPower())} • prêmio: Garra do Titã e 3 baús`} variant="danger"
        button={M.bossWeek === weekKey() ? 'Derrotado' : 'Enfrentar'} disabled={M.bossWeek === weekKey()} onClick={() => { if (fightBoss(M.staff[0] ?? '')) useApp.getState().setPanel(null); }} />
      <Card title="Bônus ativos">
        <p className="text-slate-300">{active.map(([k, v]) => `${k === 'happy' || k === 'spy' ? Math.round(v) : `${Math.round(v * 100)}%`} ${MOD_LABEL[k]}`).join(' • ') || 'Nenhum'}</p>
        <p className="text-slate-400">{abilityOf(g.origin).name}: {abilityOf(g.origin).text}</p>
      </Card>
    </>
  );
};

const Generals: React.FC = () => {
  const [loot, setLoot] = useState<Loot | null>(null);
  const [open, setOpen] = useState('');
  return (
    <>
      <Card title={`🎁 Baús: ${M.chests}`}>
        {loot && (
          <div key={loot.title + M.chests} className="chest-pop text-center py-2">
            <p className="text-4xl">{loot.icon}</p>
            <p className={`font-bold ${RARITY[loot.rarity].color}`}>{loot.title} ({RARITY[loot.rarity].name})</p>
            <p className="text-slate-300">{loot.text}</p>
          </div>
        )}
        <Button variant="gold" fullWidth disabled={!M.chests} onClick={() => setLoot(openChest())}>Abrir baú</Button>
      </Card>
      <p className="text-xs text-slate-400">Estado-maior: {M.staff.length}/3. Os 3 ativam combinações; qualquer general pode liderar ataques.</p>
      {GENERALS.map((d) => {
        const s = M.generals[d.id];
        if (!s) return <div key={d.id} className="text-xs text-slate-500 px-2">❔ {d.name} • <span className={RARITY[d.rarity].color}>{RARITY[d.rarity].name}</span></div>;
        return (
          <Card key={d.id}>
            <button className="w-full flex items-center gap-3 text-left" onClick={() => setOpen(open === d.id ? '' : d.id)}>
              <span className="text-2xl">{d.icon}</span>
              <span className="flex-1">
                <b className={RARITY[d.rarity].color}>{d.name}</b> Nv.{s.lvl}{s.pts > 0 && <span className="text-amber-300"> • {s.pts} ponto(s)</span>}
                <span className="block text-slate-400">{s.captor ? '⛓️ Capturado!' : `“${d.quote}” • especialista ${UNIT_INFO[d.unit].icon}`}</span>
              </span>
              {M.staff.includes(d.id) && <span title="Estado-maior">⭐</span>}
            </button>
            <Bar value={s.xp / (s.lvl * 40)} color="bg-amber-500" />
            {s.captor && (
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="gold" onClick={() => ransom(d.id, 'dinheiro')}>Resgatar {formatMoney(ransomCost(d.id))}</Button>
                <Button size="sm" variant="secondary" onClick={() => ransom(d.id, 'troca')}>Trocar 40⛏️ 40🛢️</Button>
              </div>
            )}
            {open === d.id && (
              <div className="space-y-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => toggleStaff(d.id)}>{M.staff.includes(d.id) ? 'Tirar do estado-maior' : 'Pôr no estado-maior'}</Button>
                {(Object.keys(SKILLS) as Skill[]).map((k) => (
                  <Action key={k} title={`${SKILLS[k].name} ${s.skills[k]}/5`} text={SKILLS[k].text} button="+1" disabled={!s.pts || s.skills[k] >= 5} onClick={() => learnSkill(d.id, k)} />
                ))}
                <select value={s.item} onChange={(e) => equip(d.id, e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2" aria-label="Equipamento">
                  <option value="">Sem equipamento</option>
                  {ITEMS.filter((i) => i.id === s.item || M.items[i.id] > 0).map((i) => <option key={i.id} value={i.id}>{i.icon} {i.name} (+{Math.round(i.attack * 100)}% ataque, -{Math.round(i.casualty * 100)}% baixas)</option>)}
                </select>
              </div>
            )}
          </Card>
        );
      })}
      <Card title="Combinações">
        {COMBOS.map((c) => (
          <Row key={c.name} label={`${c.ids.map((id) => GENERALS.find((x) => x.id === id)!.icon).join('+')} ${c.name}`} tone={c.ids.every((id) => M.staff.includes(id)) ? 'text-amber-300' : 'text-slate-400'}>{describeMods(c.mods)}</Row>
        ))}
      </Card>
    </>
  );
};

const PERSONALITY = { agressivo: '😡 Agressivo', traidor: '🎭 Traidor', comerciante: '🤑 Comerciante', pacifico: '☮️ Pacífico' };
const Diplomacy: React.FC = () => {
  const g = game();
  const live = Object.values(g.rivals).filter((r) => r.alive);
  const [open, setOpen] = useState('');
  return (
    <>
      <Card>
        <Row label="Má fama (65 forma coalizão)" tone={g.infamy > 45 ? 'text-rose-400' : 'text-slate-100'}>{Math.round(g.infamy)}</Row>
        <Bar value={g.infamy / 100} color="bg-rose-500" />
        {g.coalition && <p className="text-rose-300 font-bold">🚨 Coalizão mundial contra você!</p>}
        {g.sanction > 0 && <p className="text-amber-300">Sanções da ONU: {Math.ceil(g.sanction)}s</p>}
      </Card>
      {Object.values(g.rivals).map((r) => {
        const d = rivalDef(r.id);
        return (
          <Card key={r.id} className={r.alive ? '' : 'opacity-60'}>
            <button className="w-full flex items-center gap-3 text-left" onClick={() => setOpen(open === r.id ? '' : r.id)}>
              <span className="text-2xl">{d.icon}</span>
              <span className="flex-1">
                <b style={{ color: d.color }}>{d.leader}</b> <span className="text-slate-400">{d.title}</span>
                <span className="block text-slate-300">
                  {r.alive ? (isHuman(r.id) ? '🎮 Jogador' : PERSONALITY[d.personality]) : r.returnIn > 0 ? '😈 Derrotado, jurou vingança' : '☠️ Derrotado'}
                  {r.ally && ' • 🤝 Aliado'}{r.trade && ' • 📜 Tratado'}{r.truce > 0 && ` • 🕊️ ${Math.ceil(r.truce)}s`}{r.war && ` • ⚔️ ${rivalDef(r.war).icon}`}{r.nemesis && ' • 😈'}
                </span>
              </span>
              <span className={`font-mono font-bold ${r.rel < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>{Math.round(r.rel)}</span>
            </button>
            {r.alive && open === r.id && (
              <div className="space-y-2">
                <Row label="Países">{owned(r.id).length}</Row>
                <Row label="Poder militar">{revealed(r.id) ? formatNumber(r.power) : '??? (infiltre um espião)'}</Row>
                {revealed(r.id) && <Row label="Plano">{g.threat?.by === r.id ? 'Atacando você!' : r.war ? `Guerra com ${rivalDef(r.war).title}` : r.rel < -15 && !r.ally ? 'Preparando ataque a você' : 'Expandir território'}</Row>}
                {r.memory.length > 0 && <p className="text-slate-400">Lembra: {r.memory.slice(0, 3).join(' ')}</p>}
                {isHuman(r.id) ? <HumanActions r={r} /> : <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" variant="secondary" onClick={() => gift(r.id)}>🎁 {formatMoney(giftCost())}</Button>
                  <Button size="sm" variant="secondary" disabled={r.trade} onClick={() => proposeTrade(r.id)}>📜 Tratado</Button>
                  <Button size="sm" variant="secondary" disabled={r.truce > 0} onClick={() => proposeTruce(r.id)}>🕊️ Trégua</Button>
                  <Button size="sm" variant="secondary" disabled={r.ally} onClick={() => proposeAlliance(r.id)}>🤝 Aliança</Button>
                  <Button size="sm" variant="danger" onClick={() => (r.ally ? betray(r.id) : declareWar(r.id))}>{r.ally ? '🗡️ Trair' : '⚔️ Declarar guerra'}</Button>
                </div>}
                {r.ally && !isHuman(r.id) && live.filter((o) => o.id !== r.id && !o.ally && !isHuman(o.id)).map((o) => (
                  <Button key={o.id} size="sm" variant="outline" onClick={() => callAlly(r.id, o.id)}>Pedir guerra contra {rivalDef(o.id).icon} {rivalDef(o.id).title}</Button>
                ))}
              </div>
            )}
          </Card>
        );
      })}
      {!Object.keys(g.rivals).length && <p className="text-sm text-slate-400">Não há impérios rivais neste modo.</p>}
    </>
  );
};

const Science: React.FC = () => {
  const g = game();
  const era = ERAS[g.era + 1];
  const space = SPACE[g.space];
  return (
    <>
      <Card>
        <Row label="Ciência">{formatNumber(g.science)} (+{scienceRate().toFixed(2)}/s)</Row>
        <Row label="Era atual">{ERAS[g.era].name}</Row>
      </Card>
      {era && <Action icon="⏳" title={`Avançar: Era ${era.name}`} text={`${formatMoney(era.money)} e ${era.science} ciência • +${Math.round((era.bonus - ERAS[g.era].bonus) * 100)}% ataque e defesa`} button="Avançar" variant="primary" disabled={g.money < era.money || g.science < era.science} onClick={advanceEra} />}
      {BRANCHES.map((b) => {
        const lvl = g.techs[b.id] ?? 0;
        const block = techBlock(b.id);
        return (
          <Action key={b.id} icon={b.icon} title={`${b.name} ${lvl}/${TECH_COST.length}`}
            text={<>{lvl < 5 ? `Próxima: ${b.levels[lvl]} • ` : ''}{describeMods(b.mods)} por nível{b.rival && lvl < 5 && <span className="block text-amber-300/80">{block || `Do nível 3 em diante exclui ${BRANCHES.find((x) => x.id === b.rival)!.name}`}</span>}</>}
            button={lvl >= 5 ? 'Completo' : `${techCost(b.id)} 🔬`} disabled={!!block || g.science < techCost(b.id)} onClick={() => research(b.id)} />
        );
      })}
      <Card title="🚀 Conquista espacial">
        {space
          ? <Action icon={space.icon} title={`Missão: ${space.name}`} text={`${formatMoney(space.money)} e ${space.science} ciência • +$ ${space.income}/s • exige Era Espacial`} button="Lançar" disabled={g.era < 5 || g.money < space.money || g.science < space.science} onClick={reachSpace} />
          : <p className="text-amber-300">Lua e Marte são seus!</p>}
      </Card>
    </>
  );
};

const MissionList: React.FC<{ list: Mission[] }> = ({ list }) => (
  <>
    {list.map((m) => (
      <div key={m.stat} className="space-y-1">
        <Row label={<span className={m.done ? 'line-through text-emerald-300' : 'text-slate-200'}>{m.text}</span>}>{m.done ? '✔' : `${formatNumber(m.have)}/${formatNumber(m.n)}`}</Row>
        <Bar value={m.have / m.n} color="bg-emerald-500" />
      </div>
    ))}
  </>
);
const Missions: React.FC = () => {
  const level = levelOf(M.xp);
  const g = game();
  return (
    <>
      <Card title={`${titleOf(level)} • nível ${level}`}>
        <Bar value={(M.xp - xpFor(level)) / (xpFor(level + 1) - xpFor(level))} color="bg-amber-500" />
        <Row label="Sequência de dias (pausa se faltar, não zera)">🔥 {M.streak}</Row>
      </Card>
      <Card title="Missões de hoje (1 baú cada)"><MissionList list={M.daily} /></Card>
      <Card title="Missões da semana (3 baús cada)"><MissionList list={M.weekly} /></Card>
      <Card title={`Temporada: ${seasonName()}`}>
        <Row label={`Prêmio ${Math.min(SEASON_TIERS, M.season.claimed + 1)} de ${SEASON_TIERS}`}>{M.season.pts}/{(M.season.claimed + 1) * SEASON_STEP}</Row>
        <Bar value={M.season.pts / ((M.season.claimed + 1) * SEASON_STEP)} color="bg-fuchsia-500" />
        <Button size="sm" variant="gold" disabled={M.season.claimed >= SEASON_TIERS || M.season.pts < (M.season.claimed + 1) * SEASON_STEP} onClick={claimSeason}>Receber</Button>
      </Card>
      <Card title={`✨ Prestígio: ${M.legacy} de legado • Nova Era ${M.prestige}`}>
        <p className="text-slate-400">Recomece com bônus permanentes em um mundo 20% mais duro.</p>
        {PERKS.map((p) => {
          const lvl = M.perks[p.id] ?? 0;
          return <Action key={p.id} icon={p.icon} title={`${p.name} ${lvl}/${p.max}`} text={`${describeMods(p.mods)} por nível`} button={lvl >= p.max ? 'Máx.' : `${lvl + 1} ✨`} disabled={lvl >= p.max || M.legacy < lvl + 1} onClick={() => buyPerk(p.id)} />;
        })}
        <Confirm label={`Iniciar Nova Era (+${prestigeGain()} legado)`} disabled={!prestigeGain() || g.mode !== 'livre'} onConfirm={() => { if (doPrestige()) useApp.getState().setScreen('home'); }} />
      </Card>
      <Card title={`🏆 Conquistas ${g.achievements.length}/${ACHIEVEMENTS.length}`}>
        {ACHIEVEMENTS.map((a) => <Row key={a.id} label={`${g.achievements.includes(a.id) ? '✔' : '○'} ${a.title}: ${a.description}`}>{formatMoney(a.rewardMoney)}</Row>)}
      </Card>
    </>
  );
};

const World: React.FC = () => {
  const g = game();
  const board = [
    { key: 'P', name: 'Você', color: '#60a5fa', n: owned().length, power: formatNumber(armyPower(g.army)) },
    ...Object.values(g.rivals).filter((r) => r.alive).map((r) => ({ key: r.id, name: `${rivalDef(r.id).icon} ${rivalDef(r.id).title}`, color: rivalDef(r.id).color, n: owned(r.id).length, power: revealed(r.id) ? formatNumber(r.power) : '???' })),
  ].sort((a, b) => b.n - a.n);
  return (
    <>
      <Card title="Placar de potências">
        {board.map((x, i) => <Row key={x.key} label={<span style={{ color: x.color }}>{i + 1}. {x.name}</span>}>{x.n} países • ⚔️ {x.power}</Row>)}
        <p className="text-slate-400">{TOTAL_COUNTRIES} países no mundo • {formatDuration(g.time)} de campanha</p>
      </Card>
      {g.mode === 'livre' && (
        <Card title="Caminhos da vitória">
          {VICTORIES.map((v) => (
            <div key={v.id} className="space-y-1">
              <Row label={`${v.icon} ${v.name}: ${v.text}`}>{g.victories.includes(v.id) ? '👑' : `${Math.floor(Math.min(1, Math.max(0, victoryProgress(v.id))) * 100)}%`}</Row>
              <Bar value={victoryProgress(v.id)} color="bg-amber-500" />
            </div>
          ))}
        </Card>
      )}
      <Card title="Notícias">{g.news.map((n) => <p key={n.id} className="text-slate-300">{n.text}</p>)}</Card>
    </>
  );
};

const Menu: React.FC = () => {
  const g = game();
  const { setScreen, soundEnabled, toggleSound, setPanel } = useApp();
  const toggle = (k: 'music' | 'voice') => {
    M[k] = !M[k];
    save();
    updateMusic();
    bump();
  };
  const lan = g.mode === 'lan';
  const leaveLan = () => {
    quit();
    setScreen('home');
  };
  return (
    <>
      <p className="text-xs text-slate-400">{lan ? `Wi-Fi • ${modeOf().name} • sala ${L.code}` : scenarioOf(g.mode)?.name ?? 'Partida livre'}{!lan && ' • salvamento automático'}</p>
      <Button fullWidth onClick={() => setPanel(null)}>Continuar</Button>
      <HelpButton label="Como jogar" className="glass-btn w-full h-11 text-sm font-semibold text-amber-300" />
      <Button fullWidth variant="secondary" onClick={toggleSound}>Som: {soundEnabled ? 'ligado' : 'desligado'}</Button>
      <Button fullWidth variant="secondary" onClick={() => toggle('music')}>Música: {M.music ? 'ligada' : 'desligada'}</Button>
      <Button fullWidth variant="secondary" onClick={() => toggle('voice')}>Locutor de notícias: {M.voice ? 'ligado' : 'desligado'}</Button>
      {isInstalled && !lan && <Button fullWidth variant="secondary" onClick={checkNow}>🔄 Atualizar o jogo</Button>}
      {lan && <Confirm label={L.host ? 'Encerrar a sala para todos' : 'Sair da partida'} onConfirm={leaveLan} />}
      {!lan && <Button fullWidth variant="outline" onClick={() => setScreen('home')}>Salvar e voltar ao menu</Button>}
      {!lan && <Confirm label="Abandonar partida" onConfirm={() => { finishGame(); setScreen('home'); }} />}
    </>
  );
};

/** Botão perigoso que pede um segundo toque */
const Confirm: React.FC<{ label: string; disabled?: boolean; onConfirm: () => void }> = ({ label, disabled, onConfirm }) => {
  const [sure, setSure] = useState(false);
  return (
    <Button fullWidth variant={sure ? 'danger' : 'outline'} disabled={disabled} onClick={() => (sure ? onConfirm() : setSure(true))}>
      {sure ? 'Tem certeza? Toque de novo' : label}
    </Button>
  );
};
