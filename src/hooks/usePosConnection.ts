'use client';
import {useEffect,useState,useCallback,useRef} from 'react';
// Only GET readiness probes retry automatically. Economic POSTs need an
// explicit action with the original durable operation key.
export function usePosConnection(){
 const [state,setState]=useState<'checking'|'online'|'offline'>('checking');
 const failures=useRef(0);
 const [version,setVersion]=useState(0);
 useEffect(()=>{
  let stopped=false,timer:ReturnType<typeof setTimeout>|undefined;
  const controller=new AbortController();let running=false;
  const probe=async()=>{
   if(stopped||running)return;running=true;
   const timeout=setTimeout(()=>controller.abort(),5000);
   try{if(!navigator.onLine)throw new Error('Offline');const response=await fetch('/api/health/ready',{cache:'no-store',credentials:'same-origin',signal:controller.signal});const body=await response.json();if(!response.ok||body.status!=='ready')throw new Error('Unavailable');if(!stopped){setState('online');failures.current=0}}
   catch{if(!stopped){setState('offline');failures.current++}}
   finally{clearTimeout(timeout);running=false;if(!stopped)timer=setTimeout(()=>{setVersion(v=>v+1)},failures.current?Math.min(30000,1000*2**Math.min(failures.current,5)):30000)}
  };
  const wake=()=>{if(timer)clearTimeout(timer);setVersion(v=>v+1)};
  window.addEventListener('online',wake);window.addEventListener('offline',wake);void probe();
  return()=>{stopped=true;controller.abort();if(timer)clearTimeout(timer);window.removeEventListener('online',wake);window.removeEventListener('offline',wake)};
 },[version]);
 return {state,recheck:useCallback(()=>setVersion(v=>v+1),[])};
}
