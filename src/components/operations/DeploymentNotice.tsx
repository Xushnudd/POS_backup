'use client';
import {useTranslation} from '@/context/LocaleContext';

import {useEffect,useState} from 'react';
type State={maintenance:boolean;message:string;release:string;expectedEndAt?:string;configurationValid:boolean};
export default function DeploymentNotice(){
 const {t:tr}=useTranslation();

 const [state,setState]=useState<State|null>(null),[changed,setChanged]=useState(false),[unavailable,setUnavailable]=useState(false);
 useEffect(()=>{let live=true,firstRelease:string|undefined,controller:AbortController|undefined;
  async function refresh(){controller?.abort();controller=new AbortController();const timeout=setTimeout(()=>controller?.abort(),10000);try{const response=await fetch('/api/deployment/status',{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error('Unavailable');const value=(await response.json()).data as State;if(typeof value.maintenance!=='boolean'||typeof value.message!=='string'||typeof value.release!=='string')throw new Error('Invalid response');if(live){if(firstRelease&&firstRelease!==value.release)setChanged(true);firstRelease??=value.release;setState(value);setUnavailable(false)}}catch{if(live)setUnavailable(true)}finally{clearTimeout(timeout)}}
  void refresh();const timer=setInterval(()=>void refresh(),30000);window.addEventListener('online',refresh);return()=>{live=false;controller?.abort();clearInterval(timer);window.removeEventListener('online',refresh)}
 },[]);
 if(!state?.maintenance&&!changed&&!unavailable)return null;
 return <aside role="status" className="mb-3 border border-amber-500 bg-amber-50 p-3 text-amber-950">{state?.maintenance&&<p>{state.message}</p>}{state?.expectedEndAt&&state.maintenance&&<p>{tr("Rejalashtirilgan tugash:")}{' '}{state.expectedEndAt}{tr(". Bu taxminiy vaqt.")}</p>}{changed&&<p>{tr("Server versiyasi yangilandi. Savat va kutilayotgan amallarni tekshirib, POS oynasini qayta oching.")}</p>}{unavailable&&<p>{tr("Serverning texnik xizmat holati olinmadi. Natijasi noaniq amallarni yangi kalit bilan takrorlamang.")}</p>}<p>{tr("Savat va lokal navbatni o‘chirmang. Yozilgan amalni original kalit bilan tekshiring; texnik xizmat tugagach qolgan amallarni davom ettiring.")}</p></aside>
}
