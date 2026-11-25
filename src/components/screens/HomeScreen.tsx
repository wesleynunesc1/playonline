import React, { useEffect, useState } from 'react';
import { BookOpen, ChevronRight, Gamepad2, Globe2, Map, Maximize, RefreshCw, RotateCcw, Volume2, VolumeX, Wifi } from 'lucide-react';
import { useApp } from '../../ui';
import { COUNTRIES } from '../../data/countries';
import { CAMPAIGN, SCENARIOS, Scenario } from '../../data/content';
import { M, PLAYER, hooks, levelOf, loadSave, newGame, scenarioOf, titleOf, useGame, xpFor } from '../../engine/state';
import { refreshCalendar, seasonName } from '../../engine/meta';
import { continueGame } from '../../engine/tick';
import { toggleFullscreen } from '../../hooks/useDevice';
import { checkNow, isInstalled, useUpdate } from '../../hooks/useUpdate';
import { sound } from '../../utils/audio';
import { formatDuration } from '../../utils/formatters';
import { Button } from '../common/Button';
import { Globe } from '../common/Globe';
import { Modal } from '../common/Modal';
import { Action, Bar } from '../common/Kit';
import { AdminLogin } from '../panels/AdminPanel';

const Item: React.FC<{ icon: React.ReactNode; title: string; text: string; i: number; hot?: boolean; onClick: () => void }> = ({ icon, title, text, i, hot, onClick }) => (
  <button onClick={() => { sound.playClick(); onClick(); }} style={{ animationDelay: `${0.15 + i * 0.07}s` }} className={`menu-item ${hot ? 'menu-hot' : ''}`}>
    <span className="menu-icon">{icon}</span>
    <span className="flex-1 min-w-0 text-left">
      <b className="block text-[15px] tracking-wide">{title}</b>
      <span className="block text-xs text-slate-300 truncate">{text}</span>
    </span>
    <ChevronRight size={18} className="menu-arrow" />
  </button>
);

export const HomeScreen: React.FC = () => {
  useGame();
  const { setScreen, soundEnabled, toggleSound } = useApp();
  const [saved] = useState(loadSave);
  const [list, setList] = useState<'' | 'campanha' | 'cenarios'>('');
  const [pending, setPending] = useState<Scenario | 'livre' | null>(null);
  const updating = useUpdate((s) => s.busy);
  const [login, setLogin] = useState(false);

  useEffect(() => {
    const chests = refreshCalendar();
    if (chests) hooks.toast(`🔥 Dia ${M.streak} de comando! +${chests} baú`, 'success');
  }, []);

  const begin = (what: Scenario | 'livre') => {
    const sc = what === 'livre' ? null : what;
    if (sc?.country) {
      newGame(sc.country, sc.id);
      return setScreen('game');
    }
    useApp.setState({ mode: sc?.id ?? 'livre' });
    setScreen('country_select');
  };
  const choose = (what: Scenario | 'livre') => (saved ? setPending(what) : begin(what));
  const level = levelOf(M.xp);
  const lands = saved ? Object.values(saved.countries).filter((c) => c.owner === PLAYER).length : 0;

  return (
    <div className="relative w-full h-full overflow-x-hidden overflow-y-auto bg-black">
      <Globe />
      <div className="menu-shade" />
      <div className="relative z-10 min-h-full flex flex-col p-5 sm:p-10 safe-top">
        <header className="flex items-center gap-3 text-xs">
          <div className="glass-panel rounded-2xl px-3 py-2 w-44">
            <p className="flex justify-between font-bold"><span className="truncate">{titleOf(level)}</span><span className="text-amber-300">{level}</span></p>
            <Bar value={(M.xp - xpFor(level)) / (xpFor(level + 1) - xpFor(level))} color="bg-amber-400" />
          </div>
          <span className="glass-panel rounded-2xl px-3 py-2 hidden xs:inline">🔥 {M.streak}</span>
          <span className="glass-panel rounded-2xl px-3 py-2 hidden xs:inline">🎁 {M.chests}</span>
          <span className="ml-auto flex gap-2">
            {isInstalled && <button onClick={checkNow} disabled={updating} className="glass-btn w-11 h-11" aria-label="Atualizar o jogo" title="Atualizar o jogo"><RefreshCw size={18} className={updating ? 'animate-spin' : ''} /></button>}
            <button onClick={toggleFullscreen} className="glass-btn w-11 h-11" aria-label="Tela cheia"><Maximize size={18} /></button>
            <button onClick={toggleSound} className="glass-btn w-11 h-11" aria-label={soundEnabled ? 'Desligar som' : 'Ligar som'}>{soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          </span>
        </header>

        <main className="flex-1 flex flex-col justify-end sm:justify-center w-full max-w-md mx-auto sm:mx-0 pt-[32vh] sm:pt-8 pb-4">
          <p className="menu-kicker">Temporada {seasonName()}</p>
          <h1 className="menu-title">WORLD<br />EMPIRE</h1>
          <div className="mt-5 space-y-2">
            {saved && <Item i={0} hot icon={<RotateCcw size={20} />} title="CONTINUAR" text={`${COUNTRIES[saved.capital].name} • ${lands} países • ${formatDuration(saved.time)}`} onClick={() => { if (continueGame()) setScreen('game'); }} />}
            <Item i={1} hot={!saved} icon={<Globe2 size={20} />} title="PARTIDA LIVRE" text="172 países, 6 impérios rivais" onClick={() => choose('livre')} />
            <Item i={2} icon={<Wifi size={20} />} title="JOGAR NO WI-FI" text="2 a 6 jogadores na mesma rede" onClick={() => setScreen('lan')} />
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
              <Item i={3} icon={<BookOpen size={20} />} title="CAMPANHA" text={`${M.campaign}/${CAMPAIGN.length} capítulos`} onClick={() => setList('campanha')} />
              <Item i={4} icon={<Map size={20} />} title="CENÁRIOS" text="Zumbis, aliens e mais" onClick={() => setList('cenarios')} />
            </div>
            <Item i={5} icon={<Gamepad2 size={20} />} title="JOGO DA COBRA" text="Partida rápida" onClick={() => setScreen('snake')} />
          </div>
        </main>
        <footer className="text-[11px] text-slate-400">
          Líderes fictícios • imagens: NASA Blue Marble
          <button onClick={() => setLogin(true)} aria-label="Administrador" className="p-3 -my-3 opacity-50">🔒</button>
        </footer>
      </div>

      {login && <AdminLogin onClose={() => setLogin(false)} />}
      <Modal isOpen={!!list && !pending} onClose={() => setList('')} maxWidth="md" title={list === 'campanha' ? '📖 Campanha' : '🗺️ Cenários'}>
        {(list === 'campanha' ? CAMPAIGN : SCENARIOS).map((s, i) => {
          const locked = list === 'campanha' && i > M.campaign;
          return (
            <Action key={s.id} icon={locked ? '🔒' : s.icon} title={s.name} text={s.id === 'ondas' && M.waveRecord ? `${s.text} Recorde: onda ${M.waveRecord}` : s.text}
              button={list === 'campanha' && i < M.campaign ? 'Rejogar' : 'Jogar'} disabled={locked} variant="primary" onClick={() => choose(s)} />
          );
        })}
      </Modal>
      <Modal isOpen={!!pending} onClose={() => setPending(null)} maxWidth="sm" title="Começar nova partida?">
        <p className="text-sm text-slate-300">A partida salva ({saved && (scenarioOf(saved.mode)?.name ?? 'Partida livre')}) será substituída. Seus generais, baús e nível continuam.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setPending(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => pending && begin(pending)}>Começar</Button>
        </div>
      </Modal>
    </div>
  );
};
