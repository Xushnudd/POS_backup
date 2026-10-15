'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import {useEffect,useRef,useState} from 'react';
import {api} from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
export type BatchChoice={entryId:string;quantity:string};
type SourceRow={entryId:string;code:string;expiresOn:string;remainingQuantity:string};
export default function BatchRestorePicker({kind,sourceId,productId,label,value,onChange,onReady,disabled=false}:{kind:'sale'|'transfer_out';sourceId:string;productId:string;label:string;value:BatchChoice[];onChange:(rows:BatchChoice[])=>void;onReady?:(ready:boolean)=>void;disabled?:boolean}){
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

 const [rows,setRows]=useState<SourceRow[]>([]),[revision,setRevision]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const readiness=useRef(onReady);useEffect(()=>{readiness.current=onReady},[onReady]);
 useEffect(()=>{
  let live=true;const controller=new AbortController();
  void(async()=>{setBusy(true);setError('');readiness.current?.(false);try{const response=await api.request<SourceRow[]>('/inventory/batches/sources?'+new URLSearchParams({kind,id:sourceId,productId}),{cache:'no-store',signal:controller.signal});if(!response.data)throw Error('Original partiya ro‘yxati kelmadi');if(live){setRows(response.data);readiness.current?.(true)}}catch(error){if(live){setError(displayErrorMessage(error,'Original partiyalar yuklanmadi'));readiness.current?.(false)}}finally{if(live)setBusy(false)}})();return()=>{live=false;controller.abort()};
 },[kind,sourceId,productId,revision]);
 return <fieldset disabled={disabled} className="border p-3 space-y-2"><legend>{label}</legend><p>{tr("Haqiqiy qaytarilayotgan/qabul qilinayotgan original partiyalarni tanlang. Miqdor asosiy birlikda; tanlov jami operatsiya miqdoriga teng bo‘lsin.")}</p>{error&&<p role="alert">{uiMessage(error)}{tr(". Tanlov saqlandi.")}</p>}{busy&&<p role="status">{tr("Original partiyalar yuklanmoqda…")}</p>}{rows.map(row=><div key={row.entryId}><p>{row.code}{tr(": original qoldiq")}{' '}{row.remainingQuantity}{tr("; yaroqlilik")}{' '}{row.expiresOn}</p><Input label={label+': '+row.code} inputMode="decimal" value={value.find(item=>item.entryId===row.entryId)?.quantity??''} onChange={event=>{const next=value.filter(item=>item.entryId!==row.entryId);if(event.target.value.trim())next.push({entryId:row.entryId,quantity:event.target.value});onChange(next)}}/></div>)}<Button disabled={busy} onClick={()=>{setBusy(true);readiness.current?.(false);setRevision(value=>value+1)}}>{tr("Original partiyalarni qayta yuklash")}</Button></fieldset>
}
