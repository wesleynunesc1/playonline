import React from 'react';
import { useApp } from '../../ui';

const TONE = { success: 'border-emerald-500 text-emerald-200', danger: 'border-rose-500 text-rose-200', info: 'border-sky-500 text-sky-200' };
export const Toast: React.FC = () => {
  const toast = useApp((s) => s.toast);
  if (!toast) return null;
  return (
    <div key={toast.id} className="toast-in fixed bottom-32 left-1/2 -translate-x-1/2 z-[60] max-w-sm w-[90%] pointer-events-none">
      <p role="status" className={`px-4 py-3 rounded-xl border bg-slate-900 shadow-xl text-sm text-center ${TONE[toast.type]}`}>{toast.text}</p>
    </div>
  );
};
