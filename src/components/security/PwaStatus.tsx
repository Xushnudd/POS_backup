'use client';
import {useTranslation} from '@/context/LocaleContext';

import {useEffect,useState} from 'react';
export default function PwaStatus(){
 const {t:tr}=useTranslation();

 const [waiting,setWaiting]=useState(false);
 useEffect(()=>{
  if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
  let stopped=false;
  void navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(registration=>{
   const refresh=()=>{if(!stopped)setWaiting(Boolean(registration.waiting))};refresh();
   registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',refresh));
   void registration.update().catch(()=>undefined);
  }).catch(()=>undefined);
  return()=>{stopped=true};
 },[]);
 return waiting?<p role="status" className="bg-blue-50 p-2 text-blue-950">{tr("Yangi ilova versiyasi tayyor. Savat va amallarni saqlab, barcha POS oynalarini yopib qayta oching.")}</p>:null;
}
