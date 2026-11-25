import React from 'react';
import { Button } from './Button';

/** Peças pequenas usadas em todos os painéis. */
export const Card: React.FC<React.PropsWithChildren<{ title?: React.ReactNode; className?: string }>> = ({ title, className = '', children }) => (
  <section className={`bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2 text-xs ${className}`}>
    {title && <h4 className="font-bold text-sm text-slate-100">{title}</h4>}
    {children}
  </section>
);

export const Row: React.FC<React.PropsWithChildren<{ label: React.ReactNode; tone?: string }>> = ({ label, tone = 'text-slate-100', children }) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-slate-400">{label}</span>
    <span className={`font-mono font-bold text-right ${tone}`}>{children}</span>
  </div>
);

export const Bar: React.FC<{ value: number; color?: string }> = ({ value, color = 'bg-blue-500' }) => (
  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
    <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
  </div>
);

/** Linha de ação: ícone, texto e botão */
export const Action: React.FC<{
  icon?: React.ReactNode;
  title: React.ReactNode;
  text?: React.ReactNode;
  button: React.ReactNode;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'gold' | 'outline';
  onClick: () => void;
}> = ({ icon, title, text, button, disabled, variant = 'secondary', onClick }) => (
  <div className="flex items-center gap-3 bg-slate-900/70 border border-slate-800 rounded-xl p-2.5 text-xs">
    {icon && <span className="text-xl shrink-0">{icon}</span>}
    <div className="flex-1 min-w-0">
      <p className="font-bold text-slate-100">{title}</p>
      {text && <p className="text-slate-400">{text}</p>}
    </div>
    <Button size="sm" variant={variant} disabled={disabled} onClick={onClick} className="shrink-0">
      {button}
    </Button>
  </div>
);
