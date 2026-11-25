import React, { useState } from 'react';
import { useApp } from '../../ui';
import { COUNTRIES, REGIONS } from '../../data/countries';
import { G, M, bump, cheat, hooks, rivalDef, useGame } from '../../engine/state';
import * as C from '../../engine/cheats';
import { CARDS } from '../../lan/content';
import { L } from '../../lan/match';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Action, Card } from '../common/Kit';

const SPEEDS = [1, 5, 20, 60];

export const AdminLogin: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const enter = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch('/api/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      useApp.setState({ admin: true });
      hooks.toast('Modo administrador liberado.', 'success');
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Sem conexão.');
      setPin('');
    }
    setBusy(false);
  };
  return (
    <Modal isOpen onClose={onClose} maxWidth="sm" title="🔒 Administrador">
      <form onSubmit={enter} className="space-y-3">
        <input type="password" inputMode="numeric" autoComplete="off" autoFocus value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Senha" className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-base text-center tracking-[0.5em] outline-none" />
        {error && <p role="alert" className="text-sm text-rose-300 text-center">{error}</p>}
        <Button type="submit" fullWidth disabled={!pin || busy}>{busy ? 'Verificando...' : 'Entrar'}</Button>
      </form>
    </Modal>
  );
};

/** Botão flutuante e menu de trapaças, só para quem entrou com a senha */
export const AdminMenu: React.FC = () => {
  useGame();
  const admin = useApp((s) => s.admin);
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState('BR');
  if (!admin) return null;
  const grid = (items: [string, () => void][]) => (
    <div className="grid grid-cols-2 gap-1.5">{items.map(([n, fn]) => <Button key={n} size="sm" variant="secondary" onClick={fn}>{n}</Button>)}</div>
  );
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Menu do administrador" className="fixed right-2 top-1/2 z-40 glass-btn w-11 h-11 text-xl !border-amber-400">🛠️</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} maxWidth="lg" title="🛠️ Administrador">
        <Card title="Chaves">
          {C.FLAGS.map((f) => (
            <Action key={f.id} icon={f.icon} title={f.name} text={f.text} button={cheat[f.id] ? 'Ligado' : 'Desligado'} variant={cheat[f.id] ? 'gold' : 'outline'}
              onClick={() => { cheat[f.id] = !cheat[f.id]; bump(); }} />
          ))}
          <p className="text-slate-400">Velocidade do mundo (solo)</p>
          <div className="grid grid-cols-4 gap-1.5">{SPEEDS.map((s) => <Button key={s} size="sm" variant={cheat.speed === s ? 'gold' : 'secondary'} onClick={() => { cheat.speed = s; bump(); }}>{s}x</Button>)}</div>
        </Card>
        {G ? (
          <>
            <Card title="Recursos">{grid([['+$ 100 mil', () => C.addMoney(1e5)], ['+$ 10 milhões', () => C.addMoney(1e7)], ['+5.000 ciência', () => C.addScience(5000)], ['+500 de cada recurso', () => C.addResources(500)], ['+500 de cada tropa', () => C.addArmy(500)], ['+10 mil de cada tropa', () => C.addArmy(10000)]])}</Card>
            <Card title="Império">{grid([['Toda tecnologia e eras', C.maxTech], ['Obras no máximo', C.maxBuildings], ['Todas as maravilhas', C.allWonders], ['Lua e Marte', C.goMars], ['Todos viram aliados', C.befriendAll], ['Enfraquecer o mundo', C.weakenAll]])}</Card>
            <Card title="Território">
              <div className="flex gap-2">
                <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="País" className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-base">
                  {Object.values(COUNTRIES).sort((a, b) => a.name.localeCompare(b.name)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Button size="sm" onClick={() => C.take(country)}>Tomar</Button>
              </div>
              {grid([...REGIONS.map((r): [string, () => void] => [r, () => C.takeContinent(r)]), ['🌍 Mundo inteiro', C.takeWorld]])}
            </Card>
            {Object.values(G.rivals).some((r) => r.alive) && (
              <Card title="Destruir rival">{grid(Object.values(G.rivals).filter((r) => r.alive && !/^h/.test(r.id)).map((r): [string, () => void] => [`${rivalDef(r.id).icon} ${rivalDef(r.id).title}`, () => C.destroyRival(r.id)]))}</Card>
            )}
            {G.mode === 'lan' ? (
              <Card title="Wi-Fi">
                {grid([['4 cartas novas', () => { L.hand = Array.from({ length: 4 }, () => CARDS[Math.floor(Math.random() * CARDS.length)].id); bump(); }], ...(L.host ? ([['+5 minutos', () => { L.left += 300; bump(); }], ['Encerrar agora', () => { L.left = 0; bump(); }]] as [string, () => void][]) : [])])}
                <div className="flex flex-wrap gap-1">{CARDS.map((c) => <button key={c.id} title={c.text} aria-label={c.name} onClick={() => { L.hand = [...L.hand, c.id].slice(-4); bump(); }} className="w-10 h-10 rounded-lg bg-slate-800 text-lg">{c.icon}</button>)}</div>
              </Card>
            ) : <Card title="Partida">{grid([['Vencer agora', () => C.forceEnd(true)], ['Perder agora', () => C.forceEnd(false)]])}</Card>}
          </>
        ) : <p className="text-xs text-slate-400">Entre em uma partida para ver as opções de império, território e rivais.</p>}
        <Card title={`Progresso permanente (nível, ${M.chests} baús)`}>{grid([['Todos os generais no máximo', C.unlockGenerals], ['Todos os equipamentos', C.allItems], ['+50 baús', () => C.addChests(50)], ['+5.000 experiência', () => C.addXpCheat(5000)], ['+50 legado', () => C.addLegacy(50)], ['Bônus de prestígio no máximo', C.maxPerks], ['Cumprir missões', C.finishMissions], ['Liberar campanha', C.unlockCampaign]])}</Card>
        <Button variant="outline" fullWidth onClick={() => { for (const f of C.FLAGS) cheat[f.id] = false; cheat.speed = 1; useApp.setState({ admin: false }); setOpen(false); bump(); }}>Sair do modo administrador</Button>
      </Modal>
    </>
  );
};
