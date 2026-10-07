import React from 'react';
import { sound } from '../../utils/audio';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'gold' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  className = '',
  onClick,
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 select-none shadow-sm';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 min-h-[34px]',
    md: 'text-sm px-4 py-2.5 gap-2 min-h-[44px]',
    lg: 'text-base px-6 py-3.5 gap-2.5 min-h-[52px]',
  }[size];

  const variantStyles = {
    primary:
      'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30 border border-blue-500/40 hover:shadow-blue-600/30',
    secondary:
      'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/80 shadow-slate-900/40',
    danger:
      'bg-red-600 hover:bg-red-500 text-white border border-red-500/40 shadow-red-900/30',
    gold:
      'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border border-amber-300 shadow-amber-900/20',
    outline:
      'bg-transparent hover:bg-slate-800/60 text-slate-200 border border-slate-700',
    ghost:
      'bg-transparent hover:bg-slate-800/40 text-slate-300 border-none shadow-none',
  }[variant];

  const widthStyle = fullWidth ? 'w-full' : '';

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) {
      sound.playClick();
      onClick?.(e);
    }
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles} ${variantStyles} ${widthStyle} ${className}`}
      disabled={disabled}
      onClick={handleClick}
      {...props}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
