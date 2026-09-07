import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullPage?: boolean;
}

const sizeClasses = {
  sm: 'text-base',
  md: 'text-2xl',
  lg: 'text-4xl',
};

export default function LoadingSpinner({
  size = 'md',
  text,
  fullPage = false,
}: LoadingSpinnerProps) {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3 text-blue-600">
      <FontAwesomeIcon
        icon={faSpinner}
        className={`animate-spin ${sizeClasses[size]}`}
      />
      {text && <p className="text-sm font-medium text-gray-600">{text}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center w-full">
        {content}
      </div>
    );
  }

  return content;
}
