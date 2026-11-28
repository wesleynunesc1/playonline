import React, { useEffect, useRef, useState } from 'react';
import { Maximize, RefreshCw, Volume2, VolumeX, X } from 'lucide-react';
import { BUDGETS, CITIES, EVENTS, GUESTS, LOAN_RATE, RIVALS, STAFF, ZONE, ZONES, rivalMembers } from '../gym/data';
import {
  C, DECO_MAX, F, RECEP_MAX, S, U, affordable, beaten, borrow, buyMachine, canRent, dateText, decoCost, decorate, flow, guestsOpen, guide, hire, load, loanLimit,
  money, need, openUnit, people, persist, plotCost, plotRent, quest, rank, recepCost, rentPlot, repay, setActive, setBudget, setPrice, setZone, targetSlots, tick,
  toggleTarget, useGym, wipe,
} from '../gym/sim';
import { GymScene } from '../gym/scene';
import { toggleFullscreen, useWakeLock } from '../hooks/useDevice';
import { checkNow, isInstalled, useUpdate } from '../hooks/useUpdate';
import { sound } from '../utils/audio';
import { Button } from './common/Button';
import { Modal } from './common/Modal';
import { Action, Bar, Row } from './common/Kit';
import { AdminLogin, useAdmin } from './GymMods';
import { BackupModal } from './BackupModal';

type Panel = 'marketing' | 'equipe' | 'academia' | 'financas' | 'rede' | 'mais' | 'ajuda' | null;
const NAV: [Exclude<Panel, null>, string, string][] = [
  ['marketing', '📣', 'Marketing'], ['equipe', '🧑‍🏫', 'Equipe'], ['academia', '🏢', 'Academia'], ['financas', '💰', 'Finanças'], ['rede', '🗺️', 'Rede'], ['mais', '☰', 'Mais'],
];
const HQ_KEY = 'PLAY_ONLINE_ACADEMIA_HQ';
const hqDefault = () => (localStorage.getItem(HQ_KEY) ? localStorage.getItem(HQ_KEY) === '1' : !matchMedia('(pointer: coarse)').matches);
const stars = (r: number) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));

export const GymScreen: React.FC = () => {
  useGym((s) => s.v);
  useWakeLock();
  const { offline, toast, won } = useGym();
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const view = useRef<GymScene | null>(null);
  const [plot, setPlot] = useState<number | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [hq, setHq] = useState(hqDefault);
  const [soundOn, setSoundOn] = useState(sound.enabled);

  useEffect(() => {
    load();
    const v = new GymScene(canvas.current!, overlay.current!, (i) => {
      setPlot(i);
      if (i !== null) sound.playClick();
    }, hq);
    view.current = v;
    let acc = 0;
    v.onFrame = (dt) => {
      tick(dt);
      if ((acc += dt) > 0.25) {
        acc = 0;
        v.texts();
      }
    };
    // Volta do segundo plano: os dias que passaram são simulados
    const vis = () => {
      if (document.hidden) persist();
      else {
        load();
        v.build();
      }
    };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', persist);
    return () => {
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('pagehide', persist);
      persist();
      v.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => view.current?.setQuality(hq), [hq]);
  useEffect(() => view.current?.select(plot), [plot]);

  /** Seta do guia: leva até o salão ou abre o painel certo */
  const goGuide = () => {
    const g = guide();
    sound.playClick();
    if (g.startsWith('p:')) return setPanel(g.slice(2) as Panel);
    const i = Number(g);
    if (i >= 0) {
      view.current?.focus(i);
      setPlot(i);
    }
  };
  const u = U();
  const f = F();
  const k = quest();
  const ev = C.event;
  const req = C.request;
  const profit = S.profit;

  return (
    <div className="cz relative w-full h-full overflow-hidden">
      <canvas ref={canvas} className="absolute inset-0 w-full h-full touch-none" />
      <div ref={overlay} className="absolute inset-0 pointer-events-none overflow-hidden" />

      <header className="absolute top-2 inset-x-2 flex items-start gap-2 pointer-events-none">
        <button onClick={() => setPanel('rede')} className="cz-pill flex-col !items-start pointer-events-auto">
          <span className="text-[10px] text-amber-200/90 font-bold tracking-wider">{CITIES[u.city].name.toUpperCase()}</span>
          <span className="text-[11px] text-slate-200 leading-none">{dateText()}</span>
        </button>
        <div className="cz-pill cz-money flex-1 justify-center min-w-0">
          <span className={`text-lg font-black truncate ${C.money < 0 ? 'text-rose-300' : ''}`}>{money(C.money)}</span>
          <span className={`text-[11px] font-bold shrink-0 ${profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{profit >= 0 ? '+' : ''}{money(profit)}/mês</span>
        </div>
        <button onClick={() => setPanel('academia')} className="cz-pill flex-col pointer-events-auto">
          <span className="font-black text-sm">👥 {people(u.members)}</span>
          <span className="text-amber-300 text-[11px] leading-none">{stars(u.rep)}</span>
        </button>
      </header>

      {(ev || req) && (
        <div className="absolute top-[3.8rem] inset-x-0 flex flex-col items-center gap-1 pointer-events-none">
          {ev && <span className="cz-event">{EVENTS[ev.id].icon} <b>{EVENTS[ev.id].name}</b> · {CITIES[C.units[ev.unit]?.city ?? 0].name} · {Math.ceil(ev.left)} dia{ev.left > 1 ? 's' : ''}</span>}
          {req && C.units[req.unit] && (
            <button onClick={() => { setActive(req.unit); view.current?.focus(req.space); setPlot(req.space); }} className="cz-event cz-req pointer-events-auto">
              📣 <b>Pedido dos alunos:</b> {ZONE[C.units[req.unit].spaces[req.space]?.zone ?? 'musculacao'].name} com {req.target} · {req.left} dias
            </button>
          )}
        </div>
      )}

      <footer className="absolute bottom-2 inset-x-2 flex flex-col gap-2 items-center">
        {plot === null && k && (
          <button onClick={goGuide} className="cz-quest">
            <span className="text-lg">🎯</span>
            <span className="flex-1 min-w-0 text-left">
              <b className="block truncate">{k.text}</b>
              <Bar value={Math.min(1, k.get() / k.need)} color="bg-amber-400" />
            </span>
            <span className="cz-go">Ir 👉</span>
          </button>
        )}
        {plot !== null ? <PlotCard i={plot} onClose={() => setPlot(null)} /> : (
          <div className="cz-nav">
            {NAV.map(([id, icon, label]) => (
              <button key={id} onClick={() => { sound.playClick(); setPanel(id); }}>
                <span className="text-xl leading-none">{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </footer>

      {toast && <p role="status" className="cz-toast toast-in">{toast}</p>}
      {f.why.length > 0 && plot === null && <button onClick={() => setPanel('equipe')} className="cz-warn">⚠️ {f.why[0]}</button>}

      <Modal isOpen={!!offline} onClose={() => useGym.setState({ offline: null })} maxWidth="sm" title={`🌙 ${offline?.month} sem você`}>
        <p className="text-sm text-slate-300">A rede continuou funcionando enquanto o app estava fechado.</p>
        <Row label="Saldo mudou" tone={(offline?.profit ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{money(offline?.profit ?? 0)}</Row>
        <Row label="Alunos">{(offline?.joins ?? 0) >= 0 ? '+' : ''}{people(offline?.joins ?? 0)}</Row>
        <Button fullWidth onClick={() => useGym.setState({ offline: null })}>Continuar</Button>
      </Modal>
      <Modal isOpen={won} onClose={() => useGym.setState({ won: false })} maxWidth="sm" title="🏆 Você zerou o Magnata Fitness!">
        <p className="text-sm text-slate-300">Da academia de bairro em Fortaleza à maior rede do Ceará: número 1 nas {CITIES.length} cidades.</p>
        <Row label="Alunos na rede">{people(S.members)}</Row>
        <Row label="Faturamento total">{money(C.earned)}</Row>
        <Button fullWidth variant="gold" onClick={() => useGym.setState({ won: false })}>Continuar crescendo</Button>
      </Modal>
      <Panels panel={panel} setPanel={setPanel} hq={hq} setHq={(v) => { localStorage.setItem(HQ_KEY, v ? '1' : '0'); setHq(v); }} soundOn={soundOn} setSoundOn={setSoundOn}
        onCity={() => { setPlot(null); view.current?.build(); }} />
    </div>
  );
};

/** Ficha do salão tocado: alugar, escolher o que montar ou comprar aparelhos */
const PlotCard: React.FC<{ i: number; onClose: () => void }> = ({ i, onClose }) => {
  const [step, setStep] = useState<1 | 5 | 0>(1);
  const u = U();
  const sp = u.spaces[i];
  const f = flow(u);
  const head = (icon: string, title: string, text: string) => (
    <header className="flex items-center gap-2">
      <span className="text-3xl">{icon}</span>
      <div className="flex-1 min-w-0">
        <b className="block text-base leading-tight">{title}</b>
        <span className="text-xs text-slate-300">{text}</span>
      </div>
      <button onClick={onClose} aria-label="Fechar" className="w-10 h-10 grid place-items-center rounded-xl bg-white/10"><X size={18} /></button>
    </header>
  );
  if (!sp) return (
    <section className="cz-card animate-in">
      {head('🔑', 'Salão vizinho', 'Espaço de 10 x 8 m colado no galpão')}
      {canRent(i) ? <>
        <Row label="Reforma e entrada (uma vez)">{money(plotCost(i))}</Row>
        <Row label="Aluguel" tone="text-rose-300">+{money(plotRent(i))}/mês</Row>
        <p className="text-[11px] text-slate-400">Depois de alugar, você escolhe o que montar nele. Salão vazio só dá despesa.</p>
        <Button variant="gold" disabled={C.money < plotCost(i)} onClick={() => rentPlot(i)}>Alugar · {money(plotCost(i))}</Button>
      </> : <p className="text-sm text-slate-300">Só dá para alugar salões colados no que você já tem.</p>}
    </section>
  );
  if (!sp.zone) return (
    <section className="cz-card animate-in max-h-[60dvh] overflow-y-auto">
      {head('➕', 'O que montar aqui?', 'Escolha pensando nos seus alunos')}
      {C.money < 15_000 && <p className="text-[11px] text-amber-200">Sem dinheiro? Espere o lucro dos próximos meses ou pegue um empréstimo em Finanças.</p>}
      <div className="grid grid-cols-2 gap-1.5">
        {ZONES.filter((d) => d.id !== 'recepcao').map((d) => {
          const cost = d.build + d.unit;
          return (
            <button key={d.id} disabled={C.money < cost} onClick={() => setZone(i, d.id)} className="cz-zone">
              <b>{d.icon} {d.name}</b>
              <span>{money(cost)}</span>
              <small>{d.train ? `+${d.per} alunos por ${d.unitName}` : d.sale ? `${money(d.sale)} por aluno/mês` : `banho para ${d.per} alunos por box`}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
  const d = ZONE[sp.zone];
  if (sp.zone === 'recepcao') return (
    <section className="cz-card animate-in">
      {head(d.icon, 'Recepção e fachada', `Nível ${u.recep} de ${RECEP_MAX}`)}
      <p className="text-xs text-slate-300">Fachada iluminada, catracas e balcão maiores fazem mais gente da rua entrar para conhecer.</p>
      {u.recep < RECEP_MAX && <Button variant="gold" disabled={C.money < recepCost(u.recep + 1)} onClick={() => buyMachine(i)}>Reformar · {money(recepCost(u.recep + 1))}</Button>}
    </section>
  );
  const n = step === 0 ? affordable(i) : Math.min(step, d.max - sp.n);
  return (
    <section className="cz-card animate-in">
      {head(d.icon, d.name, `${sp.n} de ${d.max} ${d.unitName}${d.max > 1 ? 's' : ''}`)}
      <div className="grid gap-1 text-xs">
        {d.train ? <>
          <Row label="Este salão atende">{people(sp.n * d.per)} alunos</Row>
          <div className="flex items-center gap-2"><span className="text-slate-400 shrink-0">Lotação da academia</span><Bar value={f.crowd} color={f.crowd > 0.9 ? 'bg-rose-400' : 'bg-emerald-400'} /></div>
          <p className={f.crowd > 0.9 ? 'text-rose-300' : 'text-slate-400'}>{f.crowd > 0.9 ? 'Lotada! Cada aparelho novo cabe mais alunos.' : 'Tem lugar: chame mais alunos no Marketing e na Recepção.'}</p>
        </> : <Row label="Vende por mês" tone="text-emerald-300">{money(Math.min(u.members, sp.n * d.per) * d.sale)}</Row>}
        <Row label={`Luz de cada ${d.unitName}`} tone="text-rose-300">{money(d.power)}/mês</Row>
        <p className="text-slate-400">{d.text}</p>
      </div>
      {sp.n < d.max ? (
        <div className="flex gap-2">
          <div className="cz-steps">{([1, 5, 0] as const).map((s) => <button key={s} className={step === s ? 'on' : ''} onClick={() => setStep(s)}>{s === 0 ? 'MÁX' : `x${s}`}</button>)}</div>
          <Button className="flex-1" variant="gold" disabled={C.money < d.unit} onClick={() => buyMachine(i, n)}>Comprar {n} · {money(d.unit * n)}</Button>
        </div>
      ) : <p className="text-xs text-emerald-300">Salão completo. Para crescer, alugue outro salão.</p>}
    </section>
  );
};

const Panels: React.FC<{ panel: Panel; setPanel: (p: Panel) => void; hq: boolean; setHq: (v: boolean) => void; soundOn: boolean; setSoundOn: (v: boolean) => void; onCity: () => void }> = ({ panel, setPanel, hq, setHq, soundOn, setSoundOn, onCity }) => {
  const [backup, setBackup] = useState(false);
  const [login, setLogin] = useState(false);
  const [sure, setSure] = useState(false);
  const admin = useAdmin((s) => s.on);
  const updating = useUpdate((s) => s.busy);
  const close = () => { setPanel(null); setSure(false); };
  const u = U();
  const f = F();
  const open = guestsOpen().map((g) => g.id);
  const rep = C.last;
  const list = [...RIVALS.map((r, i) => ({ name: r.name, icon: r.icon, members: rivalMembers(i, u.city), me: false })), { name: 'Sua academia', icon: '💪', members: u.members, me: true }].sort((a, b) => b.members - a.members);
  return (
    <>
      <Modal isOpen={panel === 'marketing'} onClose={close} maxWidth="lg" title="📣 Marketing" subtitle={`${CITIES[u.city].name} · verba por mês`}>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {BUDGETS.map((b, i) => <button key={b} onClick={() => setBudget(i)} className={`cz-chip ${u.budget === i ? 'on' : ''}`}>{b ? money(b) : 'Nada'}</button>)}
        </div>
        <Row label="Chegam por mês">{people(f.joins)} alunos</Row>
        <Row label="Saem por mês">{people(f.quits)} alunos</Row>
        <p className="text-xs text-slate-400">Com verba, dá para mirar a campanha num público ({targetSlots()} de 3): ele passa a vir três vezes mais.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {GUESTS.map((g) => {
            const on = u.targets.includes(g.id), ok = open.includes(g.id);
            return (
              <button key={g.id} disabled={!ok} onClick={() => toggleTarget(g.id)} className={`cz-guest ${on ? 'on' : ''}`} style={{ ['--c' as string]: g.color }}>
                <span className="text-3xl">{ok ? g.icon : '🔒'}</span>
                <b>{g.name}</b>
                <span className="text-[10px] text-slate-300">{ok ? g.text : `Precisa de: ${g.likes.map((x) => ZONE[x].name).join(' ou ')}`}</span>
                <span className="text-[11px]">💳 {money(u.price * g.plan)}/mês</span>
                {ok && <span className="text-[10px] text-amber-200">{Math.round((u.mix[g.id] ?? 0) * 100)}% dos alunos</span>}
              </button>
            );
          })}
        </div>
      </Modal>
      <Modal isOpen={panel === 'equipe'} onClose={close} maxWidth="md" title="🧑‍🏫 Equipe" subtitle={`${CITIES[u.city].name} · salários entram nos custos do mês`}>
        {STAFF.map((st) => {
          const want = need(u, st.id);
          const short = st.ratio && u.staff[st.id] < want;
          return (
            <div key={st.id} className="flex items-center gap-2 bg-slate-900/70 border border-slate-800 rounded-xl p-2.5 text-xs">
              <span className="text-xl">{st.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold">{st.name}: {u.staff[st.id]}{st.ratio ? <span className={short ? 'text-rose-300' : 'text-emerald-300'}> (precisa {want})</span> : null}</p>
                <p className="text-slate-400">{st.text} Salário {money(st.salary)}.</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => hire(st.id, -1)}>−</Button>
              <Button size="sm" variant="gold" onClick={() => hire(st.id, 1)}>+</Button>
            </div>
          );
        })}
        <Row label="Satisfação dos alunos" tone={f.sat >= 0.7 ? 'text-emerald-300' : 'text-amber-300'}>{Math.round(f.sat * 100)}%</Row>
        {f.why.map((w) => <p key={w} className="text-xs text-rose-300">⚠️ {w}</p>)}
      </Modal>
      <Modal isOpen={panel === 'academia'} onClose={close} maxWidth="md" title={`🏢 Academia de ${CITIES[u.city].name}`} subtitle={`${stars(u.rep)} · ${people(u.members)} alunos`}>
        <div className="grid gap-1">
          <Row label={`Mensalidade básica: ${money(u.price)}`} tone="text-slate-300">{u.price <= 79 ? 'barata' : u.price <= 119 ? 'na média' : 'cara'}</Row>
          <input type="range" min={59} max={249} step={5} value={u.price} onChange={(e) => setPrice(Number(e.target.value))} aria-label="Mensalidade" />
          <p className="text-[11px] text-slate-400">Mais cara rende mais por aluno, mas chega menos gente e alguns ficam insatisfeitos.</p>
        </div>
        <Row label="Capacidade">{people(f.cap)} alunos</Row>
        <div className="flex items-center gap-2 text-xs"><span className="text-slate-400 shrink-0">Lotação</span><Bar value={f.crowd} color={f.crowd > 0.9 ? 'bg-rose-400' : 'bg-emerald-400'} /></div>
        <Action icon="❄️" title={`Estrutura nível ${u.deco}`} text="Ar-condicionado, som, iluminação e plantas: alunos mais satisfeitos." button={u.deco >= DECO_MAX ? 'Máximo' : money(decoCost(u.deco))} variant="gold"
          disabled={u.deco >= DECO_MAX || C.money < decoCost(u.deco)} onClick={decorate} />
        <p className="text-[11px] text-slate-400">Alugue salões vizinhos tocando nas áreas com 🔑 no mapa.</p>
      </Modal>
      <Modal isOpen={panel === 'financas'} onClose={close} maxWidth="md" title="💰 Finanças da rede" subtitle={`Saldo: ${money(C.money)}`}>
        <h4 className="font-bold text-sm">Este mês, por mês (estimativa)</h4>
        <Row label="Mensalidades" tone="text-emerald-300">{money(S.flows.reduce((s, x) => s + x.plans, 0))}</Row>
        <Row label="Vendas e serviços" tone="text-emerald-300">{money(S.flows.reduce((s, x) => s + x.sales + x.personal, 0))}</Row>
        {Object.keys(f.costs).map((key) => <Row key={key} label={key} tone="text-rose-300">-{money(S.flows.reduce((s, x) => s + x.costs[key], 0))}</Row>)}
        {S.interest > 0 && <Row label="Juros" tone="text-rose-300">-{money(S.interest)}</Row>}
        <Row label="Lucro" tone={S.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{money(S.profit)}</Row>
        {rep && <>
          <h4 className="font-bold text-sm pt-2">Fechamento de {rep.month}</h4>
          <Row label="Entrou" tone="text-emerald-300">{money(rep.revenue)}</Row>
          <Row label="Saiu" tone="text-rose-300">{money(rep.revenue - rep.profit)}</Row>
          <Row label="Lucro" tone={rep.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{money(rep.profit)}</Row>
          <Row label="Alunos">+{people(rep.joins)} / −{people(rep.quits)}</Row>
        </>}
        <h4 className="font-bold text-sm pt-2">🏦 Empréstimo ({(LOAN_RATE * 100).toFixed(1).replace('.', ',')}% ao mês)</h4>
        <Row label="Você deve">{money(C.loan)}</Row>
        <Row label="O banco libera até">{money(loanLimit())}</Row>
        <div className="grid grid-cols-3 gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => borrow(20_000)}>Pegar 20 mil</Button>
          <Button size="sm" variant="secondary" onClick={() => borrow(100_000)}>Pegar 100 mil</Button>
          <Button size="sm" variant="gold" disabled={!C.loan} onClick={() => repay(Math.min(C.loan, Math.max(0, C.money)))}>Pagar</Button>
        </div>
        <p className="text-[11px] text-slate-400">Saldo negativo vira cheque especial, com juros de 8% ao mês.</p>
      </Modal>
      <Modal isOpen={panel === 'rede'} onClose={close} maxWidth="md" title="🗺️ Sua rede de academias" subtitle={`${C.units.length} de ${CITIES.length} cidades · ${people(S.members)} alunos`}>
        {CITIES.map((city, ci) => {
          const idx = C.units.findIndex((x) => x.city === ci);
          const un = C.units[idx];
          return un ? (
            <button key={city.name} onClick={() => { setActive(idx); onCity(); close(); }} className={`flex items-center gap-2 w-full rounded-xl p-2.5 text-xs text-left ${idx === C.active ? 'bg-cyan-400/20 border border-cyan-300' : 'bg-white/5'}`}>
              <span className="text-xl">💪</span>
              <span className="flex-1"><b>{city.name}</b> · {people(un.members)} alunos · {rank(un)}º lugar</span>
              <span className={`font-mono ${S.flows[idx]?.profit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{money(S.flows[idx]?.profit ?? 0)}/mês</span>
            </button>
          ) : (
            <Action key={city.name} icon="🔒" title={city.name} text={`${people(city.pop)} habitantes · aluguel ${Math.round(city.rent * 100)}% de Fortaleza`} button={`Abrir · ${money(city.open)}`} variant="gold" disabled={C.money < city.open} onClick={() => { openUnit(ci); onCity(); close(); }} />
          );
        })}
        <h4 className="font-bold text-sm pt-1">🏆 Academias de {CITIES[u.city].name} (por alunos)</h4>
        {list.map((x, i) => (
          <div key={x.name} className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs ${x.me ? 'bg-amber-400/20 border border-amber-400' : 'bg-white/5'}`}>
            <b className="w-6">{i + 1}º</b><span className="text-lg">{x.icon}</span><span className="flex-1">{x.name}</span><span className="font-mono">{people(x.members)}</span>
          </div>
        ))}
        <p className="text-[11px] text-slate-400">Para zerar: seja a número 1 nas {CITIES.length} cidades. Você já passou {beaten(u)} de {RIVALS.length} aqui.</p>
      </Modal>
      <Modal isOpen={panel === 'mais'} onClose={close} maxWidth="sm" title="☰ Mais">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setPanel('ajuda')}>❓ Como jogar</Button>
          <Button variant="secondary" onClick={() => setHq(!hq)}>{hq ? '✨ Imagem: alta' : '🔋 Imagem: leve'}</Button>
          <Button variant="secondary" onClick={() => { sound.enabled = !sound.enabled; setSoundOn(sound.enabled); }}>{soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />} Som</Button>
          <Button variant="secondary" onClick={toggleFullscreen}><Maximize size={16} /> Tela cheia</Button>
          {isInstalled && <Button variant="secondary" disabled={updating} onClick={checkNow}><RefreshCw size={16} className={updating ? 'animate-spin' : ''} /> Atualizar</Button>}
          <Button variant="secondary" onClick={() => setBackup(true)}>💾 Levar progresso</Button>
        </div>
        <Row label="Tempo de jogo">{Math.floor(C.played / 3600)}h {Math.floor((C.played % 3600) / 60)}min</Row>
        <Row label="Faturamento total">{money(C.earned)}</Row>
        <Button fullWidth variant={sure ? 'danger' : 'outline'} onClick={() => { if (!sure) return setSure(true); wipe(); close(); }}>{sure ? 'Apaga tudo. Toque de novo' : 'Recomeçar do zero'}</Button>
        {!admin && <button onClick={() => setLogin(true)} aria-label="Administrador" className="block mx-auto p-2 opacity-40">🔒</button>}
      </Modal>
      <Modal isOpen={panel === 'ajuda'} onClose={close} maxWidth="md" title="❓ Como jogar">
        {[
          ['🏚️', 'Você começa com uma academia de bairro em Fortaleza: recepção, um salão de musculação e o vestiário. O dinheiro é em reais, como na vida real.'],
          ['💳', 'Entra dinheiro das mensalidades e das vendas (lanchonete, loja, nutri...). Sai aluguel, salários, luz, manutenção, marketing, impostos e juros.'],
          ['🔑', 'Para crescer, alugue o salão vizinho (as áreas com 🔑) e escolha o que montar: máquinas, peso livre, cardio, lutas, piscina...'],
          ['🏋️', 'Cada aparelho atende uns 30 alunos. Academia lotada perde aluno: compre aparelhos antes de lotar.'],
          ['🧑‍🏫', 'Contrate professores, recepção e limpeza conforme a academia cresce. Faltando gente, os alunos reclamam e cancelam.'],
          ['📣', 'Marketing traz gente nova. Janeiro é o mês mais cheio (promessa de ano novo); junho e julho são fracos.'],
          ['🏦', 'Sem dinheiro? Pegue empréstimo em Finanças, mas cuidado com os juros.'],
          ['🗺️', 'Abra academias em outras cidades do Ceará. Seja a número 1 nas 8 cidades para zerar.'],
        ].map(([i, t]) => <p key={t} className="flex gap-2 text-sm"><span className="text-xl">{i}</span><span>{t}</span></p>)}
        <p className="text-[11px] text-slate-500">Valores de referência aproximados. Jogo de simulação, sem compras.</p>
      </Modal>
      {backup && <BackupModal onClose={() => setBackup(false)} />}
      {login && <AdminLogin onClose={() => setLogin(false)} />}
    </>
  );
};
