import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export type ButtonVariant =
  | 'primary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'secondary'
  | 'outline'
  | 'ghost';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  variant?: ButtonVariant;
  styleVariant?: 'default' | 'success' | 'danger'; // for backwards compatibility with previous Button.tsx
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs focus:ring-blue-500',
  success: 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs focus:ring-emerald-500',
  danger: 'bg-red-600 hover:bg-red-700 text-white shadow-xs focus:ring-red-500',
  warning: 'bg-amber-400 hover:bg-amber-500 text-slate-900 shadow-xs focus:ring-amber-400',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800 focus:ring-gray-300',
  outline: 'border border-gray-300 hover:bg-gray-50 text-gray-700 focus:ring-gray-300',
  ghost: 'hover:bg-gray-100 text-gray-600 focus:ring-gray-200',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2 text-sm rounded-xl gap-2 font-medium',
  lg: 'px-6 py-3 text-base rounded-xl gap-2.5 font-semibold',
  icon: 'p-2 text-sm rounded-xl aspect-square justify-center',
};

export default function Button({
  children,
  variant = 'primary',
  styleVariant,
  size = 'md',
  isLoading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  // Support previous legacy "style" prop mapping
  const finalVariant = styleVariant
    ? (styleVariant === 'default' ? 'outline' : styleVariant)
    : variant;

  return (
    <button
      disabled={disabled || isLoading}
      className={`min-h-11 min-w-11 inline-flex items-center justify-center transition-all duration-150 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${
        variantStyles[finalVariant]
      } ${sizeStyles[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {isLoading ? (
        <FontAwesomeIcon icon={faSpinner} className="animate-spin text-sm" />
      ) : (
        leftIcon && <span className="inline-flex">{leftIcon}</span>
      )}
      {children}
      {!isLoading && rightIcon && <span className="inline-flex">{rightIcon}</span>}
    </button>
  );
}
