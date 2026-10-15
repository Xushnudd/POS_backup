'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {LOCALE_COOKIE,normalizeLocale,type Locale} from '@/i18n/locale';
import {translate,translateKnownLabel,type MessageKey,type MessageValues} from '@/i18n/messages';
import {formatLocaleDate,formatLocaleMoney,formatLocaleNumber} from '@/i18n/format';
const Context=createContext<{locale:Locale;setLocale:(locale:Locale)=>void}|null>(null);
export function LocaleProvider({initialLocale,children}:{initialLocale:Locale;children:ReactNode}){
 const [locale,setState]=useState(initialLocale);
 const setLocale=useCallback((selected:Locale)=>{
  const next=normalizeLocale(selected);
  // Preference only. Never navigate, remount a workspace, touch financial
  // IndexedDB or rewrite a pending command when the display language changes.
  document.documentElement.lang=next;
  document.cookie=`${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol==='https:'?'; Secure':''}`;
  try{localStorage.setItem(LOCALE_COOKIE,next)}catch{/* The cookie still persists the preference. */}
  setState(next);
 },[]);
 useEffect(()=>{
  const changed=(event:StorageEvent)=>{if(event.key!==LOCALE_COOKIE||event.newValue===null)return;const next=normalizeLocale(event.newValue);document.documentElement.lang=next;setState(next)};
  window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);
 },[]);
 return <Context.Provider value={{locale,setLocale}}>{children}</Context.Provider>;
}
export function useTranslation(){
 const context=useContext(Context);if(!context)throw Error('LOCALE_PROVIDER_REQUIRED');
 // Render functions track locale explicitly so React Compiler can invalidate
 // memoized labels. Server closures remain request-local; no mutable server
 // locale exists. Financial bodies/reviews are never changed by this context.
 const bound=useMemo(()=>{
  const locale=context.locale;
  return {
   t:(key:MessageKey,values?:MessageValues)=>translate(key,locale,values),
   label:(value:string)=>translateKnownLabel(value,locale),
   formatMoney:(value:number|string|null|undefined)=>formatLocaleMoney(value,locale),
   formatNumber:(value:number|string|null|undefined)=>formatLocaleNumber(value,locale),
   formatDate:(value?:string|Date|null,includeTime=false,timeZone?:string)=>formatLocaleDate(value,locale,includeTime,timeZone),
  };
 },[context.locale]);
 return {...context,...bound};
}
