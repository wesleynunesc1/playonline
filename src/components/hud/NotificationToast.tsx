import React from 'react';
import { useGameStore } from '../../stores/useGameStore';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const NotificationToast: React.FC = () => {
  const notification = useGameStore((state) => state.notification);

  if (!notification) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    danger: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-sky-400 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-500/40 bg-slate-900/95 text-emerald-200',
    danger: 'border-rose-500/40 bg-slate-900/95 text-rose-200',
    info: 'border-sky-500/40 bg-slate-900/95 text-sky-200',
  };

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%] pointer-events-none transition-all duration-300">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl shadow-black/60 backdrop-blur-md text-xs sm:text-sm font-medium ${borders[notification.type]}`}
      >
        {icons[notification.type]}
        <div className="flex-1 leading-snug">{notification.message}</div>
      </div>
    </div>
  );
};
