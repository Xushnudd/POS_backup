'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useAuth} from '@/context/AuthContext';
import {api} from '@/lib/api';
type Overview={drafts:number;openShifts:number;pendingClose:number;incidents:number|null;conflicts:number|null;fiscalStatus:string};
export default function OperationalAlerts(){
 const {t:tr}=useTranslation();

 const {organization}=useAuth(),pathname=usePathname();const [data,setData]=useState<Overview|null>(null),[error,setError]=useState('');
 useEffect(()=>{let cancelled=false;const load=async()=>{try{const response=await api.request<Overview>('/operations/overview');if(!cancelled){setData(response.data??null);setError('');}}catch(e){if(!cancelled){setData(null);setError(displayErrorMessage(e,'Ogohlantirishlar tekshirilmadi'));}}};void load();const timer=setInterval(load,60000);return()=>{cancelled=true;clearInterval(timer);};},[organization?.id,pathname]);
 return <aside aria-label={tr("Muhim holatlar")} className="flex flex-wrap gap-3 mb-4 text-sm text-slate-800">{error&&<p role="alert">{tr("Holatlar yuklanmadi.")}{' '}<Link href="/help#internet">{tr("Aloqani tekshiring")}</Link></p>}{data&&<><Link prefetch={false} href="/drafts">{tr("Server qoralamalari:")}{' '}{data.drafts}</Link><Link prefetch={false} href="/shifts">{tr("Ochiq smenalar:")}{' '}{data.openShifts} {tr("· tasdiq kutmoqda:")}{' '}{data.pendingClose}</Link>{data.incidents!==null&&<Link prefetch={false} href="/incidents">{tr("Hisob tafovutlari:")}{' '}{data.incidents}</Link>}{data.conflicts!==null&&<Link prefetch={false} href="/sync-review">{tr("Sync konfliktlari:")}{' '}{data.conflicts}</Link>}<span>{tr("Fiskal integratsiya ulanmagan")}</span></>}</aside>;
}
