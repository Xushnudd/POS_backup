'use client';

import React, { InputHTMLAttributes, forwardRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      type = 'text',
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const actualType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-gray-700">
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-gray-400">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            type={actualType}
            className={`w-full bg-white text-gray-900 border text-sm rounded-xl transition-all focus:outline-hidden focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed ${
              leftIcon ? 'pl-10' : 'pl-3.5'
            } ${rightIcon || isPassword ? 'pr-10' : 'pr-3.5'} py-2.5 ${
              error
                ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                : 'border-gray-200 hover:border-gray-300 focus:border-blue-500 focus:ring-blue-100'
            } ${className}`}
            {...props}
          />

          {isPassword ? (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 flex items-center text-gray-400 hover:text-gray-600 focus:outline-hidden"
              tabIndex={-1}
            >
              <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} className="text-sm" />
            </button>
          ) : (
            rightIcon && (
              <div className="absolute right-3.5 flex items-center pointer-events-none text-gray-400">
                {rightIcon}
              </div>
            )
          )}
        </div>

        {error ? (
          <p className="text-xs text-red-500 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-gray-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
