'use client';

import type {MessageKey} from '@/i18n/messages';
import {useTranslation} from '@/context/LocaleContext';
import React, { SelectHTMLAttributes, forwardRef,useId } from 'react';

export interface SelectOption {
  value: string | number;
  label: string;
  labelKey?:MessageKey;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className = '', id, ...props }, ref) => {
 const {message:uiMessage,t:tr}=useTranslation();

    const generatedId=useId();const selectId=id??generatedId;

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-xs font-semibold text-gray-700">
            {label}
          </label>
        )}

        <select
          id={selectId}
          ref={ref}
          aria-invalid={Boolean(error)}
          aria-describedby={error?selectId+'-error':undefined}
          className={`w-full bg-white text-gray-900 border text-sm rounded-xl px-3.5 py-2.5 transition-all focus:outline-hidden focus:ring-2 disabled:bg-gray-100 disabled:cursor-not-allowed ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
              : 'border-gray-200 hover:border-gray-300 focus:border-blue-500 focus:ring-blue-100'
          } ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.labelKey?tr(opt.labelKey):opt.label}
            </option>
          ))}
        </select>

        {error && <p id={selectId+'-error'} role="alert" className="text-xs text-red-700 font-medium">{uiMessage(error)}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
export default Select;
