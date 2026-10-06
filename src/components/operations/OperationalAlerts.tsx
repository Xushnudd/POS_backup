'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useAuth} from '@/context/AuthContext';
import {api} from '@/lib/api';
type Overview={drafts:number;openShifts:number;pendingClose:number;incidents:number|null;conflicts:number|null;fiscalStatus:string};
export default function OperationalAlerts(){
 const {organization}=useAuth(),pathname=usePathname();const [data,setData]=useState<Overview|null>(null),[error,setError]=useState('');
 useEffect(()=>{let cancelled=false;const load=async()=>{try{const response=await api.request<Overview>('/operations/overview');if(!cancelled){setData(response.data??null);setError('');}}catch(e){if(!cancelled){setData(null);setError(e instanceof Error?e.message:'Ogohlantirishlar tekshirilmadi');}}};void load();const timer=setInterval(load,60000);return()=>{cancelled=true;clearInterval(timer);};},[organization?.id,pathname]);
 return <aside aria-label="Muhim holatlar" className="flex flex-wrap gap-3 mb-4 text-sm text-slate-800">{error&&<p role="alert">Holatlar yuklanmadi. <Link href="/help#internet">Aloqani tekshiring</Link></p>}{data&&<><Link prefetch={false} href="/drafts">Server qoralamalari: {data.drafts}</Link><Link prefetch={false} href="/shifts">Ochiq smenalar: {data.openShifts} · tasdiq kutmoqda: {data.pendingClose}</Link>{data.incidents!==null&&<Link prefetch={false} href="/incidents">Hisob tafovutlari: {data.incidents}</Link>}{data.conflicts!==null&&<Link prefetch={false} href="/sync-review">Sync konfliktlari: {data.conflicts}</Link>}<span>Fiskal integratsiya ulanmagan</span></>}</aside>;
}
