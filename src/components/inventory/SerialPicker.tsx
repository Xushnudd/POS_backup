'use client'
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import {useEffect,useState} from 'react'
import {api} from '@/lib/api'
export default function SerialPicker({storeId,productId,label,value,onChange,disabled=false,state='available',saleItemId,transferId,receiptId}:{storeId:string;productId:string;label:string;value:string[];onChange:(ids:string[])=>void;disabled?:boolean;state?:string;saleItemId?:string;transferId?:string;receiptId?:string}){
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

 const [rows,setRows]=useState<{id:string;code:string}[]>([]),[error,setError]=useState(''),[page,setPage]=useState(1),[total,setTotal]=useState(0),[busy,setBusy]=useState(true),[revision,setRevision]=useState(0)
 useEffect(()=>{
  let live=true;const controller=new AbortController()
  void(async()=>{setBusy(true);setError('');try{const response=await api.request<{id:string;code:string}[]>('/inventory/serials?'+new URLSearchParams({storeId,productId,state,page:String(page),...(saleItemId?{saleItemId}:{}),...(transferId?{transferId}:{}),...(receiptId?{receiptId}:{})}),{cache:'no-store',signal:controller.signal});if(!response.data)throw Error('Serial ro‘yxati kelmadi');if(live){setRows(response.data);setTotal(response.pagination?.total??0)}}catch(e){if(live)setError(displayErrorMessage(e,'Seriallar yuklanmadi'))}finally{if(live)setBusy(false)}})();return()=>{live=false;controller.abort()}
 },[storeId,productId,state,page,revision,saleItemId,transferId,receiptId])
 return <fieldset disabled={disabled} className="border rounded p-3" aria-label={label}><legend>{label}</legend>{busy&&<p role="status">{tr("Seriallar yuklanmoqda…")}</p>}{error&&<p role="alert">{uiMessage(error)}{tr(". Tanlov saqlangan.")}</p>}<p>{tr("Tanlangan birliklar:")}{' '}{value.length}</p>{rows.map(row=><label key={row.id} className="block"><input type="checkbox" disabled={busy||Boolean(error)} checked={value.includes(row.id)} onChange={e=>onChange(e.target.checked?[...value,row.id]:value.filter(id=>id!==row.id))}/>{row.code}</label>)}{!busy&&!error&&!rows.length&&<p>{tr("Original seriallar topilmadi.")}</p>}<button type="button" disabled={busy||page<=1} onClick={()=>setPage(p=>p-1)}>{tr("Oldingi seriallar")}</button><span> {page} / {Math.max(1,Math.ceil(total/50))} </span><button type="button" disabled={busy||page*50>=total} onClick={()=>setPage(p=>p+1)}>{tr("Keyingi seriallar")}</button><button type="button" disabled={busy} onClick={()=>setRevision(r=>r+1)}>{tr("Seriallarni qayta yuklash")}</button></fieldset>
}
