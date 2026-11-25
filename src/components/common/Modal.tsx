import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

const WIDTH = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg', xl: 'sm:max-w-3xl' };
const CLOSE_DRAG_PX = 110;

/** Janela central no computador; folha que sobe de baixo (e fecha arrastando) no celular */
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, subtitle, children, maxWidth = 'md', showCloseButton = true }) => {
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const end = () => {
    if (startY.current !== null && drag > CLOSE_DRAG_PX) onClose();
    startY.current = null;
    setDrag(0);
  };

  // Fora da árvore da tela, para nunca ficar atrás de barras
  return createPortal(
    <div className="fixed inset-0 z-50 text-slate-100 flex items-end sm:items-center justify-center sm:p-4 bg-black/75 animate-in">
      <div className="fixed inset-0 -z-10" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
        className={`modal-pop sheet relative w-full ${WIDTH[maxWidth]} bg-slate-900 border border-slate-600/80 rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col`}
      >
        {(title || showCloseButton) && (
          <div
            className={`relative flex items-center justify-between gap-2 px-4 sm:px-5 pt-5 pb-3 sm:py-4 border-b border-slate-800 bg-slate-950/60 ${showCloseButton ? 'touch-none' : ''}`}
            onPointerDown={(e) => {
              if (!showCloseButton || (e.target as Element).closest('button')) return;
              startY.current = e.clientY;
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => startY.current !== null && setDrag(Math.max(0, e.clientY - startY.current))}
            onPointerUp={end}
            onPointerCancel={end}
          >
            {showCloseButton && <span className="sm:hidden absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-slate-600" />}
            <div className="min-w-0">
              {title && <h3 className="text-lg font-bold text-slate-100 truncate">{title}</h3>}
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            {showCloseButton && (
              <button onClick={onClose} className="shrink-0 grid place-items-center w-11 h-11 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800" aria-label="Fechar">
                <X size={20} />
              </button>
            )}
          </div>
        )}
        <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-3 safe-bottom">{children}</div>
      </div>
    </div>,
    document.body
  );
};
