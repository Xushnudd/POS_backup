'use client';

import React, { useEffect, useId, useRef, ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  full: 'max-w-5xl',
};

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const dialogRef=useRef<HTMLDivElement>(null);
  const titleId=useId();
  useEffect(()=>{
    if(!isOpen)return;
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const selectable=()=>Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')??[]).filter(element=>element.getClientRects().length>0);
    const frame=requestAnimationFrame(()=>{(selectable()[0]??dialogRef.current)?.focus();});
    const trap=(event:KeyboardEvent)=>{
      if(event.key!=='Tab')return;
      const elements=selectable(),first=elements[0],last=elements.at(-1);
      if(!first){event.preventDefault();dialogRef.current?.focus();return;}
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    const dialog=dialogRef.current;dialog?.addEventListener('keydown',trap);
    return ()=>{cancelAnimationFrame(frame);dialog?.removeEventListener('keydown',trap);if(previous?.isConnected)previous.focus();};
  },[isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={title?titleId:undefined} tabIndex={-1}
        className={`relative w-full ${sizeClasses[size]} bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden z-10 animate-in zoom-in-95 duration-150`}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 id={titleId} className="text-lg font-bold text-gray-900">{title}</h3>
            <button
              aria-label="Oynani yopish"
              onClick={onClose}
              className="p-1.5 text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition"
            >
              <FontAwesomeIcon icon={faTimes} className="text-base" />
            </button>
          </div>
        )}

        <div className="p-6 overflow-y-auto flex-1">{children}</div>

        {footer && (
          <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
