'use client';
import {startTransition,useEffect} from 'react';
import {LocaleProvider,useTranslation} from '@/context/LocaleContext';
import {localeFromCookie} from '@/i18n/locale';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import './globals.css';
export default function GlobalError({retry}:{error:Error&{digest?:string};retry:()=>void}){
 return <html lang="uz"><body><LocaleProvider initialLocale="uz"><Failure retry={retry}/></LocaleProvider></body></html>;
}
function Failure({retry}:{retry:()=>void}){
 const {t,setLocale}=useTranslation();
 useEffect(()=>{setLocale(localeFromCookie(document.cookie))},[setLocale]);
 return <main role="alert" className="mx-auto max-w-xl space-y-4 p-8"><LanguageSwitcher/><h1 className="text-2xl font-bold">{t('Sahifa ochilmadi')}</h1><p>{t('Sahifani qayta yuklab ko‘ring. Javobi olinmagan savdo yoki to‘lov bo‘lsa, avval uning original natijasini tekshiring.')}</p><button className="rounded border px-4 py-2" onClick={()=>startTransition(retry)}>{t('Sahifani qayta ochish')}</button><a className="block underline" href="/sync-review">{t('Saqlangan amallarni tekshirish')}</a></main>;
}
