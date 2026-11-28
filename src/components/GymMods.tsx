import React, { useState } from 'react';
import { create } from 'zustand';
import { X } from 'lucide-react';
import { EVENTS, EventId, FLOORS, RIVALS, ROOMS, STAFF, STAFF_MAX } from '../gym/data';
import { ROOM_MAX, S, UPG_MAX, cheat, mod, say, startEvent, useGym } from '../gym/sim';
import { Modal } from './common/Modal';
import { Button } from './common/Button';

/** Dono do jogo: senha conferida no servidor (variável ADMIN_PIN), nunca no código */
export const useAdmin = create<{ on: boolean }>(() => ({ on: false }));

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
      useAdmin.setState({ on: true });
      say('🛠️ Mod menu liberado');
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

const Btn: React.FC<React.PropsWithChildren<{ on?: boolean; onClick: () => void }>> = ({ on, onClick, children }) => (
  <button onClick={onClick} className={`mod-btn text-left ${on ? 'mod-on' : ''}`}>{children}</button>
);

/** Mod menu da academia */
export const GymMods: React.FC = () => {
  useGym((s) => s.v);
  const on = useAdmin((s) => s.on);
  const [open, setOpen] = useState(false);
  const [, re] = useState(0);
  if (!on) return null;
  const flip = (f: () => void) => { f(); re((n) => n + 1); };
  return (
    <>
      {!open && <button aria-label="Mod menu" className="mod-fab" style={{ right: 8, top: 120 }} onClick={() => setOpen(true)}>🛠️</button>}
      {open && (
        <div role="dialog" aria-label="Mod menu" className="mod-menu">
          <header className="mod-head">
            <b className="mod-logo">MOD ACADEMIA</b>
            <button onClick={() => setOpen(false)} aria-label="Fechar mod menu" className="ml-auto w-10 h-10 grid place-items-center"><X size={18} /></button>
          </header>
          <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-3">
            <section className="mod-box">
              <b className="mod-title">💰 Dinheiro</b>
              <div className="grid grid-cols-2 gap-1.5">
                {[1e6, 1e9, 1e12, 1e15].map((n) => <Btn key={n} onClick={() => cheat((c) => { c.money += n; })}>+ {n.toExponential(0).replace('e+', 'e')}</Btn>)}
                <Btn onClick={() => cheat((c) => { c.gems += 100; })}>+100 🏅</Btn>
                <Btn on={mod.free} onClick={() => flip(() => { mod.free = !mod.free; })}>🆓 Tudo de graça</Btn>
                <Btn on={mod.income > 1} onClick={() => flip(() => { mod.income = mod.income > 1 ? 1 : 10; })}>📈 Lucro x10</Btn>
                <Btn onClick={() => cheat((c) => { c.dobro += 3600; })}>⚡ 1h de dobro</Btn>
              </div>
            </section>
            <section className="mod-box">
              <b className="mod-title">🏗️ Academia</b>
              <div className="grid grid-cols-2 gap-1.5">
                <Btn onClick={() => cheat((c) => { c.floors = FLOORS.length; })}>Abrir todos os andares</Btn>
                <Btn onClick={() => cheat((c) => { for (const d of ROOMS) if (d.floor < c.floors) c.rooms[d.id] = { lv: Math.min(ROOM_MAX, (c.rooms[d.id]?.lv ?? 0) + 10), cash: c.rooms[d.id]?.cash ?? 0, mgr: c.rooms[d.id]?.mgr ?? false }; })}>Salas +10 níveis</Btn>
                <Btn onClick={() => cheat((c) => { for (const id in c.rooms) c.rooms[id].mgr = true; })}>Gerente em tudo</Btn>
                <Btn onClick={() => cheat((c) => { for (const s of STAFF) c.staff[s.id] = STAFF_MAX; c.deco = UPG_MAX; c.mkt = UPG_MAX; })}>Equipe, decoração e marketing no máximo</Btn>
                <Btn onClick={() => cheat((c) => { c.beaten = RIVALS.length; })}>Passar todos os rivais</Btn>
                <Btn onClick={() => cheat((c) => { c.units.push({ city: c.units.length + c.city + 1, income: S.income }); })}>+1 academia na rede</Btn>
                <Btn onClick={() => cheat((c) => { c.money += S.income * 3600; c.earned += S.income * 3600; })}>Receber 1 hora de lucro</Btn>
              </div>
            </section>
            <section className="mod-box">
              <b className="mod-title">🎉 Eventos</b>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(EVENTS) as EventId[]).map((id) => <Btn key={id} onClick={() => startEvent(id)}>{EVENTS[id].icon} {EVENTS[id].name}</Btn>)}
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
};
