'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import {useCallback,useEffect,useRef,useState} from 'react';
import {api} from '@/lib/api';
import {useAuth} from '@/context/AuthContext';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import {confirmPageNavigation,commitPageNavigation} from '@/lib/page-navigation';
import Button from '@/components/ui/Button';
type RequestRow={id:string;incoming:boolean;expiresAt:string};
export default function OwnershipRequests({organizationId}:{organizationId?:string}){
 const {organization,user,role}=useAuth();
 return organization&&user?<RequestControls key={[organization.id,user.id,role,organizationId].join(':')}/>:null;
}
function RequestControls(){
 const {formatDate}=useTranslation();

 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

 const [rows,setRows]=useState<RequestRow[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const live=useRef(true),flight=useRef(false),readSequence=useRef(0);
 useUnsavedChanges(false,busy);
 const load=useCallback(async()=>{
  const sequence=++readSequence.current;
  if(live.current)setLoading(true);
  try{const result=await api.ownership.list();if(live.current&&sequence===readSequence.current){setRows(result.data??[]);setError('');}}
  catch(cause){if(live.current&&sequence===readSequence.current)setError(displayErrorMessage(cause,'Egalik so‘rovlari yuklanmadi'));}
  finally{if(live.current&&sequence===readSequence.current)setLoading(false);}
 },[]);
 useEffect(()=>{live.current=true;void Promise.resolve().then(()=>{if(live.current)return load();});const timer=setInterval(()=>{if(!flight.current)void load();},30000);return()=>{live.current=false;clearInterval(timer);};},[load]);
 async function respond(row:RequestRow,action:'accept'|'cancel'){
  if(flight.current)return;
  if(action==='accept'&&(!confirmPageNavigation()||!window.confirm('Biznes egaligini qabul qilasizmi? Joriy egasi administrator bo‘ladi.')))return;
  flight.current=true;setBusy(true);setError('');
  try{
   await api.ownership.respond(row.id,action);
   if(live.current){
    if(action==='accept'){commitPageNavigation();window.location.assign(new URL('/pos',window.location.origin).toString());}
    else{setRows(previous=>previous.filter(item=>item.id!==row.id));}
   }
  }catch(cause){if(live.current)setError(displayErrorMessage(cause,'Egalik amali tasdiqlanmadi; holatni qayta tekshiring'));}
  finally{flight.current=false;if(live.current)setBusy(false);}
 }
 if(!rows.length&&!error)return null;
 return <section aria-label={tr("Egalik so‘rovlari")} className="text-xs space-y-2">
  {error&&<p role="alert">{uiMessage(error)} <Button size="sm" disabled={busy||loading} onClick={()=>void load()}>{tr("Egalik so‘rovlarini qayta tekshirish")}</Button></p>}
  {busy&&<p role="status">{tr("Egalik amali uchun server tasdig‘i kutilmoqda…")}</p>}
  {loading&&<p role="status">{tr("Egalik so‘rovlari yuklanmoqda…")}</p>}
  {rows.map(row=><div key={row.id}>{tr("Egalikni topshirish so‘rovi (")}{formatDate(row.expiresAt,true)}) {row.incoming&&<Button size="sm" disabled={busy||loading} onClick={()=>void respond(row,'accept')}>{tr("Qabul qilish")}</Button>} <Button size="sm" disabled={busy||loading} onClick={()=>void respond(row,'cancel')}>{tr("Bekor qilish")}</Button></div>)}
 </section>;
}
