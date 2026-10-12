'use client';
import {useCallback,useEffect,useRef} from 'react';
import {PAGE_NAVIGATION_REQUEST,PAGE_NAVIGATION_COMMITTED} from '@/lib/page-navigation';
import {NavigationGuards} from '@/lib/navigation-guards';
const message='Saqlanmagan o‘zgarishlar bor. Ularni tashlab ketishni tasdiqlaysizmi?';
export function confirmUnsavedChanges(dirty:boolean,saving=false,warning=message){return !saving&&(!dirty||window.confirm(warning));}
const guards = new NavigationGuards();
let registrations = 0, committed = false;
type HistoryNavigationEvent=Event&{navigationType:string;destination:{sameDocument:boolean}};
type BrowserNavigation={addEventListener:(type:'navigate',listener:(event:HistoryNavigationEvent)=>void)=>void;removeEventListener:(type:'navigate',listener:(event:HistoryNavigationEvent)=>void)=>void};
function installListeners() {
 const admit = () => guards.admit(warning => window.confirm(warning));
 const unload=(event:BeforeUnloadEvent)=>{if(guards.active&&!committed){event.preventDefault();event.returnValue='';}};
 const request=(event:Event)=>{if(!admit())event.preventDefault();};
 const commit=()=>{committed=true;};
 const navigation=(window as Window&{navigation?:BrowserNavigation}).navigation;
 const traverse=(event:HistoryNavigationEvent)=>{if(event.navigationType==='traverse'&&event.destination.sameDocument&&event.cancelable&&!admit())event.preventDefault();};
 const navigate=(event:MouseEvent)=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target instanceof Element?event.target.closest<HTMLAnchorElement>('a[href]'):null;
  if(!link||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
  const destination=new URL(link.href,window.location.href);
  if(!['http:','https:'].includes(destination.protocol))return;
  if(destination.origin===location.origin&&destination.pathname===location.pathname&&destination.search===location.search)return;
  if(!admit()){event.preventDefault();event.stopImmediatePropagation();}
 };
 window.addEventListener('beforeunload',unload);
 window.addEventListener(PAGE_NAVIGATION_REQUEST,request);
 window.addEventListener(PAGE_NAVIGATION_COMMITTED,commit);
 document.addEventListener('click',navigate,true);
 navigation?.addEventListener('navigate',traverse);
 return()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener(PAGE_NAVIGATION_REQUEST,request);window.removeEventListener(PAGE_NAVIGATION_COMMITTED,commit);document.removeEventListener('click',navigate,true);navigation?.removeEventListener('navigate',traverse);};
}
let removeListeners: (() => void) | undefined;
/** One admission decision for all editable forms. Only flags are retained; no form values,
 * passwords or pending operation payloads are copied into browser storage.
 * Call confirmDiscard for programmatic resets/navigation as well. */
export function useUnsavedChanges(dirty:boolean,saving=false,warning=message){
 const id=useRef(Symbol('editor'));
 const confirmDiscard=useCallback(()=>confirmUnsavedChanges(dirty,saving,warning),[dirty,saving,warning]);
 useEffect(()=>{
  const identity=id.current;
  guards.set(identity,{dirty,saving,warning});
  if(registrations++===0)removeListeners=installListeners();
  return()=>{guards.delete(identity);if(--registrations===0){removeListeners?.();removeListeners=undefined;committed=false;}};
 },[dirty,saving,warning]);
 return confirmDiscard;
}
