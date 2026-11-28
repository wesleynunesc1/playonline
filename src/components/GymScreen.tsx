import React, { useEffect, useRef, useState } from 'react';
import { Maximize, RefreshCw, Volume2, VolumeX, X } from 'lucide-react';
import { CASH_SECONDS, CITIES, EVENTS, FLOORS, FRANCHISE, GUESTS, RIVALS, ROOM, ROOMS, SHOP, STAFF, STAFF_MAX, cityMult, cityName } from '../gym/data';
import {
  C, ROOM_MAX, S, UPG_MAX, advertise, affordable, buy, claimQuest, claimVip, collect, collectAll, costN, decoCost, decorate, equip, floorCost, guestsOpen,
  hire, load, lv, mgrCost, mktCost, money, moveCity, openFloor, persist, quest, rivalFame, staffCost, stars, takeOffline, targetSlots, tick, toggleTarget, train, upgrade, useGym, wipe,
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

type Panel = 'marketing' | 'equipe' | 'decoracao' | 'rede' | 'loja' | 'mais' | 'ajuda' | null;
const NAV: [Exclude<Panel, null>, string, string][] = [
  ['marketing', '📣', 'Marketing'], ['equipe', '🧑‍🏫', 'Equipe'], ['decoracao', '🛠️', 'Estrutura'], ['rede', '🗺️', 'Rede'], ['loja', '🏅', 'Loja'], ['mais', '☰', 'Mais'],
];
const HQ_KEY = 'PLAY_ONLINE_ACADEMIA_HQ';
const hqDefault = () => localStorage.getItem(HQ_KEY) ? localStorage.getItem(HQ_KEY) === '1' : !matchMedia('(pointer: coarse)').matches;
const starsText = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

export const GymScreen: React.FC = () => {
  useGym((s) => s.v);
  useWakeLock();
  const { offline, toast, quest: questReady, won } = useGym();
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const view = useRef<GymScene | null>(null);
  const [room, setRoom] = useState<string | null>(null);
  const [floorAsk, setFloorAsk] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [hq, setHq] = useState(hqDefault);
  const [floor, setFloor] = useState(0);
  const [soundOn, setSoundOn] = useState(sound.enabled);

  useEffect(() => {
    load();
    const v = new GymScene(canvas.current!, overlay.current!, (id, f) => {
      if (f !== undefined) return setFloorAsk(true);
      setRoom(id);
      if (id) sound.playClick();
    }, hq);
    view.current = v;
    let acc = 0;
    v.onFrame = (dt) => {
      tick(dt);
      if ((acc += dt) > 0.25) {
        acc = 0;
        v.texts();
        setFloor((f) => (f === v.floorAt ? f : v.floorAt));
      }
    };
    // Volta do segundo plano: paga o tempo fora como se o app estivesse fechado
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

  const go = (f: number) => {
    view.current?.focus(f);
    setFloor(f);
  };
  const q = quest();
  const qv = Math.min(q.need, q.get());
  const ev = C.event;
  const unclaimed = ROOMS.reduce((s, d) => s + (C.rooms[d.id] && !C.rooms[d.id].mgr ? C.rooms[d.id].cash : 0), 0);

  return (
    <div className="cz relative w-full h-full overflow-hidden">
      <canvas ref={canvas} className="absolute inset-0 w-full h-full touch-none" />
      <div ref={overlay} className="absolute inset-0 pointer-events-none overflow-hidden" />

      {/* Topo: dinheiro, diamantes e estrelas */}
      <header className="absolute top-2 inset-x-2 flex items-start gap-2 pointer-events-none">
        <div className="cz-pill flex-col !items-start">
          <span className="text-[10px] text-amber-200/90 font-bold tracking-wider">{cityName(C.city).toUpperCase()}</span>
          <span className="text-amber-300 text-sm leading-none">{starsText(stars())}</span>
        </div>
        <div className="cz-pill cz-money flex-1 justify-center min-w-0">
          <span className="text-lg font-black truncate">{money(C.money)}</span>
          <span className="text-[11px] text-emerald-300 font-bold shrink-0">+{money(S.income)}/s</span>
        </div>
        <button onClick={() => setPanel('loja')} className="cz-pill pointer-events-auto font-black text-sm">🏅 {Math.floor(C.gems)}</button>
      </header>

      {(ev || C.dobro > 0) && (
        <div className="absolute top-[3.6rem] inset-x-0 flex flex-col items-center gap-1 pointer-events-none">
          {ev && (
            <button onClick={() => ev.id === 'famoso' && claimVip()} className={`cz-event pointer-events-auto ${ev.id === 'famoso' ? 'cz-pulse' : ''}`}>
              {EVENTS[ev.id].icon} <b>{EVENTS[ev.id].name}{ev.room ? ` de ${ROOM[ev.room].name}` : ''}</b> · {EVENTS[ev.id].text} · {Math.ceil(ev.left)}s
            </button>
          )}
          {C.dobro > 0 && <span className="cz-event">⚡ Lucro em dobro · {Math.ceil(C.dobro / 60)} min</span>}
        </div>
      )}

      {/* Andares */}
      <nav className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col-reverse gap-1.5">
        {FLOORS.slice(0, Math.min(FLOORS.length, C.floors + 1)).map((f, i) => (
          <button key={f.name} onClick={() => (i >= C.floors ? setFloorAsk(true) : go(i))} aria-label={f.name}
            className={`cz-floor ${floor === i ? 'on' : ''}`} style={{ ['--n' as string]: f.neon }}>
            {i >= C.floors ? '🔒' : i + 1}
          </button>
        ))}
      </nav>

      {unclaimed >= 1 && !room && (
        <button onClick={() => collectAll()} className="cz-collect absolute left-2 top-1/2 -translate-y-1/2">💵<span>{money(unclaimed)}</span></button>
      )}

      {/* Base: missão e menu */}
      <footer className="absolute bottom-2 inset-x-2 flex flex-col gap-2 items-center">
        {!room && (
          <button onClick={claimQuest} disabled={!questReady} className={`cz-quest ${questReady ? 'ready' : ''}`}>
            <span className="text-lg">🎯</span>
            <span className="flex-1 min-w-0 text-left">
              <b className="block truncate">{q.text}</b>
              <Bar value={qv / q.need} color={questReady ? 'bg-emerald-400' : 'bg-amber-400'} />
            </span>
            <span className="text-xs font-black shrink-0">{questReady ? `Pegar +${q.gems}🏅` : `${q.need > 999 ? money(qv) : qv}/${q.need > 999 ? money(q.need) : q.need}`}</span>
          </button>
        )}
        {room ? <RoomCard id={room} onClose={() => setRoom(null)} /> : (
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

      <Modal isOpen={offline > 0} onClose={() => takeOffline(false)} maxWidth="sm" title="🌙 Enquanto você esteve fora">
        <p className="text-sm text-slate-300">Seus gerentes e a rede de academias lucraram:</p>
        <p className="text-4xl font-black text-center text-emerald-300 py-2">{money(offline)}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => takeOffline(false)}>Receber</Button>
          <Button variant="gold" disabled={C.gems < 6} onClick={() => takeOffline(true)}>Dobrar (6 🏅)</Button>
        </div>
        <p className="text-[11px] text-slate-500 text-center">Rende até 4 horas fora. Salas sem gerente só enchem o caixa.</p>
      </Modal>

      <Modal isOpen={won} onClose={() => useGym.setState({ won: false })} maxWidth="sm" title="🏆 Você zerou o Magnata Fitness!">
        <p className="text-sm text-slate-300">Da academia pequena de Fortaleza até a maior rede do Ceará, com academias em {CITIES.length} cidades.</p>
        <Row label="Lucro total">{money(C.earned)}</Row>
        <Row label="Tempo de jogo">{Math.floor(C.played / 3600)}h {Math.floor((C.played % 3600) / 60)}min</Row>
        <Button fullWidth variant="gold" onClick={() => useGym.setState({ won: false })}>Continuar crescendo</Button>
      </Modal>

      <Modal isOpen={floorAsk} onClose={() => setFloorAsk(false)} maxWidth="sm" title={C.floors < FLOORS.length ? `🏗️ ${FLOORS[C.floors].name}` : 'Prédio completo'}>
        {C.floors < FLOORS.length && <>
          <p className="text-sm text-slate-300">Um andar novo com {ROOMS.filter((d) => d.floor === C.floors).map((d) => d.icon + ' ' + d.name).join(', ')}.</p>
          <Button fullWidth variant="gold" disabled={C.money < floorCost(C.floors)} onClick={() => { openFloor(); setFloorAsk(false); go(C.floors - 1); }}>Abrir por {money(floorCost(C.floors))}</Button>
        </>}
      </Modal>

      <Panels panel={panel} setPanel={setPanel} hq={hq} setHq={(v) => { localStorage.setItem(HQ_KEY, v ? '1' : '0'); setHq(v); }} soundOn={soundOn} setSoundOn={setSoundOn} />
    </div>
  );
};

/** Ficha da sala tocada: melhorar, gerente e caixa */
const RoomCard: React.FC<{ id: string; onClose: () => void }> = ({ id, onClose }) => {
  const [step, setStep] = useState<1 | 10 | 0>(1);
  const d = ROOM[id];
  const l = lv(id);
  const r = C.rooms[id];
  const st = S.rooms[id];
  const locked = d.floor >= C.floors;
  const n = step === 0 ? Math.max(1, affordable(id)) : Math.min(step, ROOM_MAX - l);
  const cost = costN(d, l, n);
  const next25 = (Math.floor(l / 25) + 1) * 25;
  const nextEq = equip(d, l) < d.max ? (Math.floor(l / 5) + 1) * 5 : 0;
  return (
    <section className="cz-card animate-in">
      <header className="flex items-center gap-2">
        <span className="text-3xl">{d.icon}</span>
        <div className="flex-1 min-w-0">
          <b className="block text-base leading-tight">{d.name}</b>
          <span className="text-xs text-slate-300">{l ? `Nível ${l}/${ROOM_MAX}` : d.text}</span>
        </div>
        <button onClick={onClose} aria-label="Fechar" className="w-10 h-10 grid place-items-center rounded-xl bg-white/10"><X size={18} /></button>
      </header>
      {locked ? <p className="text-sm text-slate-300">Abra o andar {FLOORS[d.floor].name} primeiro.</p> : <>
        {l > 0 && d.kind === 'lobby' && (
          <div className="grid gap-1 text-xs">
            <Row label="Alunos chegando">{(S.arrivals * 60).toFixed(0)}/min</Row>
            <Row label="Satisfação" tone={S.sat >= 1 ? 'text-emerald-300' : 'text-amber-300'}>{Math.round(S.sat * 100)}%</Row>
            <p className="text-slate-400">Cada nível traz 20% mais alunos. Salas vazias? Melhore aqui.</p>
          </div>
        )}
        {l > 0 && st && (
          <div className="grid gap-1 text-xs">
            <Row label="Lucro" tone="text-emerald-300">{money(st.income)}/s</Row>
            <Row label={d.game ? 'Aparelhos' : 'Lugares'}>{equip(d, l)}/{d.max}{nextEq ? ` · mais no nível ${nextEq}` : ''}</Row>
            <div className="flex items-center gap-2"><span className="text-slate-400 shrink-0">Ocupação</span><Bar value={st.served / Math.max(1e-9, st.cap)} color={st.demand > st.cap ? 'bg-rose-400' : 'bg-emerald-400'} /></div>
            <p className={st.demand > st.cap ? 'text-rose-300' : 'text-slate-400'}>
              {st.demand > st.cap ? `Lotado! ${Math.round((1 - st.cap / st.demand) * 100)}% dos alunos vão embora. Melhore para caber mais gente.` : 'Tem lugar sobrando: chame mais alunos na Recepção, no Marketing e na Estrutura.'}
            </p>
            {l < ROOM_MAX && <p className="text-amber-200">⭐ Nível {next25}: lucro em dobro</p>}
          </div>
        )}
        {l > 0 && d.kind !== 'lobby' && !r?.mgr && (
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="secondary" disabled={!r || r.cash < 1} onClick={() => collect(id)}>💵 Recolher {money(r?.cash ?? 0)}</Button>
            <Button size="sm" variant="secondary" disabled={C.money < mgrCost(d)} onClick={() => hire(id)}>🧑‍💼 Gerente {money(mgrCost(d))}</Button>
          </div>
        )}
        {r?.mgr && d.kind !== 'lobby' && <p className="text-[11px] text-emerald-300">🧑‍💼 O gerente recolhe sozinho, até com o app fechado.</p>}
        {!r?.mgr && l > 0 && d.kind !== 'lobby' && <p className="text-[11px] text-slate-400">Sem gerente, o caixa enche em {Math.round(CASH_SECONDS / 60 * 10) / 10} min e para.</p>}
        {l < ROOM_MAX && (
          <div className="flex gap-2">
            {l > 0 && <div className="cz-steps">{([1, 10, 0] as const).map((s) => <button key={s} className={step === s ? 'on' : ''} onClick={() => setStep(s)}>{s === 0 ? 'MÁX' : `x${s}`}</button>)}</div>}
            <Button className="flex-1" variant="gold" disabled={C.money < cost} onClick={() => upgrade(id, l ? n : 1)}>
              {l ? `Melhorar +${n}` : 'Construir'} · {money(l ? cost : costN(d, 0, 1))}
            </Button>
          </div>
        )}
      </>}
    </section>
  );
};

const Panels: React.FC<{ panel: Panel; setPanel: (p: Panel) => void; hq: boolean; setHq: (v: boolean) => void; soundOn: boolean; setSoundOn: (v: boolean) => void }> = ({ panel, setPanel, hq, setHq, soundOn, setSoundOn }) => {
  const [backup, setBackup] = useState(false);
  const [login, setLogin] = useState(false);
  const [sure, setSure] = useState(false);
  const admin = useAdmin((s) => s.on);
  const updating = useUpdate((s) => s.busy);
  const close = () => { setPanel(null); setSure(false); };
  const open = guestsOpen().map((g) => g.id);
  const fame = S.income;
  const list = [...RIVALS.map((r, i) => ({ name: r.name, icon: r.icon, fame: rivalFame(i), me: false })), { name: 'Sua academia', icon: '💪', fame, me: true }].sort((a, b) => b.fame - a.fame);
  return (
    <>
      <Modal isOpen={panel === 'marketing'} onClose={close} maxWidth="lg" title="📣 Marketing" subtitle="Escolha quem você quer atrair">
        <Action icon="📺" title={`Propaganda nível ${C.mkt}`} text={`+6% de alunos por nível · ${targetSlots()} de 3 campanhas`} button={C.mkt >= UPG_MAX ? 'Máximo' : money(mktCost(C.mkt))} variant="gold" disabled={C.mkt >= UPG_MAX || C.money < mktCost(C.mkt)} onClick={advertise} />
        <p className="text-xs text-slate-400">Campanha triplica a chegada daquele tipo de aluno. Vagas: nível 1, 8 e 20.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {GUESTS.map((g) => {
            const on = C.targets.includes(g.id), ok = open.includes(g.id);
            return (
              <button key={g.id} disabled={!ok} onClick={() => toggleTarget(g.id)} className={`cz-guest ${on ? 'on' : ''}`} style={{ ['--c' as string]: g.color }}>
                <span className="text-3xl">{ok ? g.icon : '🔒'}</span>
                <b>{g.name}</b>
                <span className="text-[10px] text-slate-300">{ok ? g.text : `Precisa de ${g.stars + 1} estrelas`}</span>
                <span className="text-[11px]">💰 gasta {g.spend}x</span>
                <span className="text-sm">{g.likes.map((x) => ROOM[x].icon).join(' ')}</span>
                {ok && <span className="text-[10px] text-amber-200">{Math.round((S.mix[g.id] ?? 0) * 100)}% dos alunos</span>}
              </button>
            );
          })}
        </div>
      </Modal>
      <Modal isOpen={panel === 'equipe'} onClose={close} maxWidth="md" title="🤵 Equipe" subtitle="Treine para lucrar mais e agradar">
        {STAFF.map((s) => (
          <Action key={s.id} icon={s.icon} title={`${s.name} · nível ${C.staff[s.id]}`} text={s.text} button={C.staff[s.id] >= STAFF_MAX ? 'Máximo' : money(staffCost(s.id, C.staff[s.id]))} variant="gold"
            disabled={C.staff[s.id] >= STAFF_MAX || C.money < staffCost(s.id, C.staff[s.id])} onClick={() => train(s.id)} />
        ))}
        <Row label="Satisfação dos alunos" tone={S.sat >= 1 ? 'text-emerald-300' : 'text-amber-300'}>{Math.round(S.sat * 100)}%</Row>
      </Modal>
      <Modal isOpen={panel === 'decoracao'} onClose={close} maxWidth="md" title="🛠️ Estrutura" subtitle="Ar-condicionado, som, plantas e estátuas">
        <Action icon="❄️" title={`Estrutura nível ${C.deco}`} text="+5% de alunos e +1% de satisfação por nível. Aparece no prédio." button={C.deco >= UPG_MAX ? 'Máximo' : money(decoCost(C.deco))} variant="gold"
          disabled={C.deco >= UPG_MAX || C.money < decoCost(C.deco)} onClick={decorate} />
      </Modal>
      <Modal isOpen={panel === 'rede'} onClose={close} maxWidth="md" title="🗺️ Sua rede de academias" subtitle={`${C.units.length + 1} de ${CITIES.length} cidades do Ceará`}>
        <div className="grid grid-cols-4 gap-1.5">
          {CITIES.map((c, i) => {
            const u = C.units.find((x) => x.city % CITIES.length === i && x.city < CITIES.length);
            const here = C.city === i;
            return <div key={c} className={`rounded-xl p-1.5 text-center text-[10px] leading-tight ${here ? 'bg-cyan-400/25 border border-cyan-300' : u ? 'bg-emerald-500/20 border border-emerald-400/60' : 'bg-white/5 opacity-60'}`}>
              <span className="block text-lg">{here ? '🏗️' : u ? '💪' : '🔒'}</span>{c}{u && <span className="block text-emerald-300 font-bold">{money(u.income)}/s</span>}
            </div>;
          })}
        </div>
        {C.units.length > 0 && <Row label="As outras unidades mandam" tone="text-emerald-300">{money(S.network)}/s</Row>}
        <h4 className="font-bold pt-1">🏆 Ranking de {cityName(C.city)}</h4>
        {list.map((x, i) => (
          <div key={x.name} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${x.me ? 'bg-amber-400/20 border border-amber-400' : 'bg-white/5'}`}>
            <b className="w-6">{i + 1}º</b><span className="text-xl">{x.icon}</span><span className="flex-1">{x.name}</span><span className="font-mono text-xs">{money(x.fame)}/s</span>
          </div>
        ))}
        <p className="text-xs text-slate-400">A fama é o lucro por segundo. Passar cada rival dá medalhas. Passe todos para abrir uma academia nova em outra cidade: lá tudo rende {cityMult(C.city + 1)}x, e esta continua mandando {Math.round(FRANCHISE * 100)}% do lucro dela para você, para sempre.</p>
        <Button fullWidth variant="gold" disabled={C.beaten < RIVALS.length} onClick={() => { moveCity(); close(); }}>🏗️ Abrir academia em {cityName(C.city + 1)}</Button>
      </Modal>
      <Modal isOpen={panel === 'loja'} onClose={close} maxWidth="md" title="🏅 Loja de medalhas" subtitle="Medalhas vêm de missões, rivais, campeonatos e do prêmio diário">
        {SHOP.map((s) => <Action key={s.id} icon={s.icon} title={s.name} text={s.text} button={`${s.gems} 🏅`} variant="gold" disabled={C.gems < s.gems} onClick={() => buy(s.id)} />)}
        <p className="text-[11px] text-slate-500 text-center">Nada aqui custa dinheiro de verdade.</p>
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
        <Row label="Lucro total">{money(C.earned)}</Row>
        <Row label="Dias seguidos">🔥 {C.streak}</Row>
        <Button fullWidth variant={sure ? 'danger' : 'outline'} onClick={() => { if (!sure) return setSure(true); wipe(); close(); }}>{sure ? 'Apaga tudo. Toque de novo' : 'Recomeçar do zero'}</Button>
        {!admin && <button onClick={() => setLogin(true)} aria-label="Administrador" className="block mx-auto p-2 opacity-40">🔒</button>}
      </Modal>
      <Modal isOpen={panel === 'ajuda'} onClose={close} maxWidth="md" title="❓ Como jogar">
        {[
          ['💪', 'Você começa com uma academia pequena em Fortaleza. Cada sala dá lucro sozinha enquanto tem aluno treinando.'],
          ['👆', 'Toque numa sala para melhorar. Nível maior = mais lucro e mais mesas. A cada 25 níveis o lucro dobra.'],
          ['💵', 'Salas sem gerente guardam o dinheiro no caixa: toque no 💵 para recolher. Com gerente, entra sozinho, até com o app fechado.'],
          ['🛎️', 'A Recepção traz alunos. Se as salas têm lugar sobrando, melhore a Recepção, o Marketing ou a Estrutura.'],
          ['🔴', 'Barra vermelha na sala = lotada. Melhore a sala para caber mais gente.'],
          ['📣', 'No Marketing, escolha quem atrair. Cada tipo de aluno gosta de certas salas e paga diferente.'],
          ['🏗️', 'Abra andares novos pelo cadeado do lado direito. Arraste a tela para subir e descer, e use dois dedos para aproximar.'],
          ['🗺️', 'Na Rede, passe as academias rivais e abra unidades em outras cidades. As antigas continuam rendendo. Leve a rede às 8 cidades para zerar o jogo.'],
          ['🎯', 'Siga a missão de baixo: ela sempre mostra o próximo passo e dá diamantes.'],
        ].map(([i, t]) => <p key={t} className="flex gap-2 text-sm"><span className="text-xl">{i}</span><span>{t}</span></p>)}
        <p className="text-[11px] text-slate-500">Jogo de gerenciamento com dinheiro fictício. Não há compras.</p>
      </Modal>
      {backup && <BackupModal onClose={() => setBackup(false)} />}
      {login && <AdminLogin onClose={() => setLogin(false)} />}
    </>
  );
};
