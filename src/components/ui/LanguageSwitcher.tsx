'use client';
import {usePathname} from 'next/navigation';
import {useTranslation} from '@/context/LocaleContext';
export default function LanguageSwitcher({compact=false}:{compact?:boolean}){
 const {locale,setLocale,t}=useTranslation();
 return <label className="flex items-center gap-2 text-xs"><span className={compact?'sr-only':''}>{t('Til')}</span><select aria-label={t('Til')} value={locale} onChange={event=>setLocale(event.target.value==='ru'?'ru':'uz')} className={(compact?'w-16':'max-w-28')+' rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-900'}><option value="uz" lang="uz" aria-label="O‘zbekcha">{compact?'UZ':'O‘zbekcha'}</option><option value="ru" lang="ru" aria-label="Русский">{compact?'RU':'Русский'}</option></select></label>;
}
export function PublicLanguageSwitcher(){
 const path=usePathname();
 return path==='/'||['/login','/register','/forgot-password','/reset-password','/invite'].includes(path)?<div className="absolute top-3 right-4 z-40"><LanguageSwitcher/></div>:null;
}
