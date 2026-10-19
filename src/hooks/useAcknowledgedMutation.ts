'use client';
import {errorMessage} from '@/i18n/errors';

import {useEffect,useRef,useState} from 'react';
import {ApiError} from '@/lib/api';
/** Legacy catalogue writes have no operation key. Protect a single in-flight
 * request and describe missing ACK truthfully; never retry them automatically. */
export function useAcknowledgedMutation(ready:boolean){
 const flight=useRef(false),live=useRef(true);
 const [state,setState]=useState<'idle'|'saving'|'saved'|'failed'|'unknown'>('idle'),[error,setError]=useState('');
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const execute=async(work:()=>Promise<unknown>,onAck:()=>void)=>{
  if(flight.current)return;
  if(!ready){setError('Ma’lumotni qayta yuklang; amal yuborilmadi.');return;}
  flight.current=true;setState('saving');setError('');
  try{
   await work();
   if(live.current){setState('saved');onAck();}
  }catch(cause){
   if(live.current){const definite=cause instanceof ApiError&&[400,401,403,404,409,413,415,422,429].includes(cause.status??0);setState(definite?'failed':'unknown');setError(definite?(errorMessage(cause,'Amal rad etildi')):'Server natijasi tasdiqlanmadi. Ro‘yxatni yangilab natijani tekshiring; qayta yuborish avtomatik bajarilmaydi.');}
  }finally{flight.current=false;}
 };
 return {state,error,saving:state==='saving',execute,edited:()=>{if(!flight.current)setState('idle');}};
}
