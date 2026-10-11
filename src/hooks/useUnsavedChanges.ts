'use client';
import {useCallback,useEffect,useRef} from 'react';
import {PAGE_NAVIGATION_REQUEST,PAGE_NAVIGATION_COMMITTED} from '@/lib/page-navigation';
const message='Saqlanmagan o‘zgarishlar bor. Ularni tashlab ketishni tasdiqlaysizmi?';
export function confirmUnsavedChanges(dirty:boolean,saving=false,warning=message){return !saving&&(!dirty||window.confirm(warning));}
/** One guard per editable page. Only boolean state is retained; no form values,
 * passwords or pending operation payloads are copied into browser storage.
 * Call confirmDiscard for programmatic resets/navigation as well. */
export function useUnsavedChanges(dirty:boolean,saving=false,warning=message){
 const committed=useRef(false);
 const confirmDiscard=useCallback(()=>confirmUnsavedChanges(dirty,saving,warning),[dirty,saving,warning]);
 useEffect(()=>{
  committed.current=false;
  if(!dirty&&!saving)return;
  const unload=(event:BeforeUnloadEvent)=>{if(!committed.current){event.preventDefault();event.returnValue='';}};
  const request=(event:Event)=>{if(!confirmDiscard())event.preventDefault();};
  const commit=()=>{committed.current=true;};
  const navigate=(event:MouseEvent)=>{
   if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
   const link=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href]'):null;
   if(!link||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
   const destination=new URL(link.href,window.location.href);
   if(!['http:','https:'].includes(destination.protocol))return;
   if(destination.origin===location.origin&&destination.pathname===location.pathname&&destination.search===location.search)return;
   if(!confirmDiscard()){event.preventDefault();event.stopImmediatePropagation();}
  };
  window.addEventListener('beforeunload',unload);
  window.addEventListener(PAGE_NAVIGATION_REQUEST,request);
  window.addEventListener(PAGE_NAVIGATION_COMMITTED,commit);
  document.addEventListener('click',navigate,true);
  return()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener(PAGE_NAVIGATION_REQUEST,request);window.removeEventListener(PAGE_NAVIGATION_COMMITTED,commit);document.removeEventListener('click',navigate,true);};
 },[dirty,saving,confirmDiscard]);
 return confirmDiscard;
}
