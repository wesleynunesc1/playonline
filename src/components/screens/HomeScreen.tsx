import React, { useEffect, useState } from 'react';
import { BookOpen, Gamepad2, Map, Maximize, Play, RotateCcw, Volume2, VolumeX, Wifi } from 'lucide-react';
import { useApp } from '../../ui';
import { CAMPAIGN, SCENARIOS, Scenario } from '../../data/content';
import { M, hooks, levelOf, loadSave, newGame, scenarioOf, titleOf, useGame } from '../../engine/state';
import { refreshCalendar } from '../../engine/meta';
import { continueGame } from '../../engine/tick';
import { toggleFullscreen } from '../../hooks/useDevice';
import { AdminLogin } from '../panels/AdminPanel';
import { Button } from '../common/Button';
import { Globe } from '../common/Globe';
import { Modal } from '../common/Modal';
import { Action } from '../common/Kit';

export const HomeScreen: React.FC = () => {
  useGame();
  const { setScreen, soundEnabled, toggleSound } = useApp();
  const [saved] = useState(loadSave);
  const [list, setList] = useState<'' | 'campanha' | 'cenarios'>('');
  const [pending, setPending] = useState<Scenario | 'livre' | null>(null);

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
  const [login, setLogin] = useState(false);
  const level = levelOf(M.xp);
  const scenarios = list === 'campanha' ? CAMPAIGN : SCENARIOS;

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-5 sm:p-8 safe-top overflow-x-hidden overflow-y-auto bg-[#05070f]">
      <Globe />
      <div className="relative z-10 w-full flex items-center justify-between text-xs text-slate-300">
        <span>👑 {titleOf(level)} nível {level} • 🔥 {M.streak} • 🎁 {M.chests}</span>
        <span className="flex gap-2">
        <button onClick={toggleFullscreen} className="glass-btn w-11 h-11" aria-label="Tela cheia"><Maximize size={18} /></button>
        <button onClick={toggleSound} className="glass-btn w-11 h-11" aria-label={soundEnabled ? 'Desligar som' : 'Ligar som'}>
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        </span>
      </div>
      <div className="relative z-10 flex flex-col items-center text-center my-auto py-6 gap-6 w-full max-w-xs">
        <div>
          <h1 className="title-glow whitespace-nowrap text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 tracking-tight">WORLD EMPIRE</h1>
          <p className="mt-2 text-slate-300">Construa. Domine. Conquiste.</p>
        </div>
        <div className="w-full space-y-3">
          {saved && (
            <Button size="lg" variant="gold" fullWidth icon={<RotateCcw size={20} />} onClick={() => { if (continueGame()) setScreen('game'); }}>
              Continuar ({scenarioOf(saved.mode)?.name ?? 'Partida livre'})
            </Button>
          )}
          <Button size="lg" fullWidth icon={<Play size={20} />} onClick={() => choose('livre')}>Partida livre</Button>
          <Button size="lg" fullWidth variant="danger" icon={<Wifi size={20} />} onClick={() => setScreen('lan')}>Jogar no Wi-Fi</Button>
          <Button fullWidth variant="secondary" icon={<BookOpen size={18} />} onClick={() => setList('campanha')}>Campanha ({M.campaign}/{CAMPAIGN.length})</Button>
          <Button fullWidth variant="secondary" icon={<Map size={18} />} onClick={() => setList('cenarios')}>Cenários e sobrevivência</Button>
          <Button fullWidth variant="outline" icon={<Gamepad2 size={18} />} onClick={() => setScreen('snake')}>🐍 Jogo da Cobra</Button>
        </div>
      </div>
      <p className="relative z-10 text-center text-xs text-slate-400">Líderes fictícios • progresso salvo neste navegador <button onClick={() => setLogin(true)} aria-label="Administrador" className="p-3 -m-2 opacity-50">🔒</button></p>
      {login && <AdminLogin onClose={() => setLogin(false)} />}

      <Modal isOpen={!!list && !pending} onClose={() => setList('')} maxWidth="md" title={list === 'campanha' ? '📖 Campanha' : '🗺️ Cenários'}>
        {scenarios.map((s, i) => {
          const locked = list === 'campanha' && i > M.campaign;
          return (
            <Action key={s.id} icon={locked ? '🔒' : s.icon} title={s.name} text={s.id === 'ondas' && M.waveRecord ? `${s.text} Recorde: onda ${M.waveRecord}` : s.text}
              button={list === 'campanha' && i < M.campaign ? 'Rejogar' : 'Jogar'} disabled={locked} variant="primary" onClick={() => choose(s)} />
          );
        })}
      </Modal>
      <Modal isOpen={!!pending} onClose={() => setPending(null)} maxWidth="sm" title="Começar nova partida?">
        <p className="text-sm text-slate-300">A partida salva será substituída. Seus generais, baús e nível continuam.</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setPending(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => pending && begin(pending)}>Começar</Button>
        </div>
      </Modal>
    </div>
  );
};
