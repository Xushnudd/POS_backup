'use client';
import {useTranslation} from '@/context/LocaleContext';


import React, { useEffect, useLayoutEffect, useId, useRef, ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  layer?: 'normal'|'critical';
}
const dialogStack:HTMLDivElement[]=[];
let previousOverflow='';
const activeDialog=()=>dialogStack.findLast(dialog=>dialog.dataset.modalLayer==='critical')??dialogStack.at(-1);
function refreshDialogs(){
 const top=activeDialog();
 for(const dialog of dialogStack){dialog.inert=dialog!==top;dialog.setAttribute('aria-modal',String(dialog===top));}
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
  layer = 'normal',
}: ModalProps) {
 const {t:tr}=useTranslation();

  const dialogRef=useRef<HTMLDivElement>(null);
  const restoreFrame=useRef<number|null>(null);
  const titleId=useId();
  useLayoutEffect(()=>{
    if(!isOpen)return;
    if(restoreFrame.current!==null){cancelAnimationFrame(restoreFrame.current);restoreFrame.current=null;}
    const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const dialog=dialogRef.current;
    if(dialog){
      if(!dialogStack.length)previousOverflow=document.body.style.overflow;
      dialogStack.push(dialog);refreshDialogs();document.body.style.overflow='hidden';
    }
    const previousId=previous?.id,focusKey=previous?.dataset.focusKey;
    const selectable=()=>Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')??[]).filter(element=>element.getClientRects().length>0);
    if(activeDialog()===dialog)(selectable()[0]??dialogRef.current)?.focus();
    const trap=(event:KeyboardEvent)=>{
      if(event.key!=='Tab')return;
      const elements=selectable(),first=elements[0],last=elements.at(-1);
      if(!first){event.preventDefault();dialogRef.current?.focus();return;}
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    dialog?.addEventListener('keydown',trap);
    return ()=>{
      dialog?.removeEventListener('keydown',trap);
      if(dialog){const index=dialogStack.indexOf(dialog);if(index>=0)dialogStack.splice(index,1);refreshDialogs();}
      if(!dialogStack.length)document.body.style.overflow=previousOverflow;
      // A catalog refresh may replace the original element while the dialog is open.
      // Find its stable replacement after the closing commit; respect another modal.
      restoreFrame.current=requestAnimationFrame(()=>{
        restoreFrame.current=null;
        const active=activeDialog();
        const target=previous?.isConnected?previous:focusKey?document.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(focusKey)}"]`):previousId?document.getElementById(previousId):null;
        if(target&&(!active||active.contains(target)))target.focus();
      });
    };
  },[isOpen,layer]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && activeDialog()===dialogRef.current) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div style={{zIndex:layer==='critical'?70:50}} className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div ref={dialogRef} data-modal-layer={layer} role="dialog" aria-modal="true" aria-labelledby={title?titleId:undefined} tabIndex={-1}
        className={`relative w-full ${sizeClasses[size]} bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden z-10 animate-in zoom-in-95 duration-150`}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 id={titleId} className="text-lg font-bold text-gray-900">{title}</h3>
            <button
              aria-label={tr("Oynani yopish")}
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
