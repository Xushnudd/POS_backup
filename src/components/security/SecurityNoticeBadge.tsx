'use client';
import {useTranslation} from '@/context/LocaleContext';


import {useEffect,useState} from 'react';
import Link from 'next/link';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faShieldHalved} from '@fortawesome/free-solid-svg-icons';
import {useAuth} from '@/context/AuthContext';
import {api} from '@/lib/api';

export default function SecurityNoticeBadge(){
  const {user}=useAuth();
  return user?<AccountBadge key={user.id}/>:null;
}

function AccountBadge(){
 const {t:tr}=useTranslation();

  const [unread,setUnread]=useState<number|null>(null);
  const [failed,setFailed]=useState(false);

  useEffect(()=>{
    let live=true,inFlight=false,requested=false;
    const load=async()=>{
      if(!live||document.visibilityState!=='visible')return;
      if(inFlight){requested=true;return;}
      inFlight=true;
      try{
        const response=await api.security.list();
        if(!response.data)throw new Error('Xavfsizlik bildirishnomalari yuklanmadi');
        if(live){setUnread(response.data.unread);setFailed(false);}
      }catch{
        // A failed read is unknown, never an authoritative zero.
        if(live)setFailed(true);
      }finally{
        inFlight=false;
        if(requested&&live){requested=false;void load();}
      }
    };
    const refresh=()=>{void load();};
    refresh();
    const timer=setInterval(refresh,60_000);
    document.addEventListener('visibilitychange',refresh);
    window.addEventListener('pos-security-notices',refresh);
    return()=>{
      live=false;clearInterval(timer);
      document.removeEventListener('visibilitychange',refresh);
      window.removeEventListener('pos-security-notices',refresh);
    };
  },[]);

  const label=failed?tr("Xavfsizlik bildirishnomalari: hisob tekshirilmadi"):unread===null?tr("Xavfsizlik bildirishnomalari: yuklanmoqda"):tr("Xavfsizlik bildirishnomalari: {count} ta o‘qilmagan",{count:unread});
  return <Link href="/security" prefetch={false} aria-label={label} title={label} className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 p-2 text-xs text-gray-600 hover:bg-gray-100">
    <FontAwesomeIcon icon={faShieldHalved} aria-hidden="true"/>
    <span className="hidden xl:inline">{tr("Xavfsizlik")}</span>
    <span aria-hidden="true" className={failed?'font-bold text-amber-700':unread?'font-bold text-red-700':''}>{failed?'?':unread===null?'…':unread}</span>
  </Link>;
}
