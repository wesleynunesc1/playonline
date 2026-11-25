import React, { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useApp } from '../../ui';
import { applyUpdate, useUpdate, useUpdateCheck } from '../../hooks/useUpdate';
import { Button } from './Button';

/** Aviso de versão nova no app instalado; nunca aparece durante uma partida */
export const UpdateBanner: React.FC = () => {
  useUpdateCheck();
  const { available, busy } = useUpdate();
  const screen = useApp((s) => s.screen);
  const [hidden, setHidden] = useState(false);
  if (!available || hidden || screen !== 'home') return null;
  return (
    <div role="status" className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-md glass-panel !border-amber-400 rounded-2xl p-3 flex items-center gap-3 text-sm animate-in">
      <RefreshCw size={20} className={`text-amber-300 shrink-0 ${busy ? 'animate-spin' : ''}`} />
      <span className="flex-1">Nova versão disponível!</span>
      <Button size="sm" variant="gold" disabled={busy} onClick={applyUpdate}>Atualizar</Button>
      <button onClick={() => setHidden(true)} aria-label="Agora não" className="w-9 h-9 grid place-items-center"><X size={16} /></button>
    </div>
  );
};
