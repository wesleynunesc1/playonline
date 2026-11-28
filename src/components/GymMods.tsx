import React, { useState } from 'react';
import { create } from 'zustand';
import { X } from 'lucide-react';
import { PLOTS, STAFF, ZONE } from '../gym/data';
import { DECO_MAX, RECEP_MAX, U, cheat, mod, money, need, say, skipDays, useGym } from '../gym/sim';
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
                {[100_000, 1_000_000, 10_000_000].map((n) => <Btn key={n} onClick={() => cheat((c) => { c.money += n; })}>+ {money(n)}</Btn>)}
                <Btn onClick={() => cheat((c) => { c.loan = 0; })}>Quitar empréstimo</Btn>
                <Btn on={mod.free} onClick={() => flip(() => { mod.free = !mod.free; })}>🆓 Tudo de graça</Btn>
              </div>
            </section>
            <section className="mod-box">
              <b className="mod-title">🏗️ Academia atual</b>
              <div className="grid grid-cols-2 gap-1.5">
                <Btn onClick={() => cheat(() => { const u = U(); PLOTS.forEach((_, i) => { u.spaces[i] ??= { zone: '', n: 0 }; }); })}>Alugar o galpão inteiro</Btn>
                <Btn onClick={() => cheat(() => { for (const sp of U().spaces) if (sp?.zone && sp.zone !== 'recepcao') sp.n = ZONE[sp.zone].max; })}>Encher os salões de aparelhos</Btn>
                <Btn onClick={() => cheat(() => { const u = U(); for (const st of STAFF) if (st.ratio) u.staff[st.id] = need(u, st.id); })}>Equipe completa</Btn>
                <Btn onClick={() => cheat(() => { const u = U(); u.members += 500; })}>+500 alunos</Btn>
                <Btn onClick={() => cheat(() => { const u = U(); u.rep = 5; u.deco = DECO_MAX; u.recep = RECEP_MAX; })}>Fama e estrutura no máximo</Btn>
                <Btn onClick={() => skipDays(30)}>⏩ Passar 1 mês</Btn>
              </div>
            </section>
          </div>
        </div>
      )}
    </>
  );
};
