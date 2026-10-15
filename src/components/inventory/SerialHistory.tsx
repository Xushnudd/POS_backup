'use client'
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import {useReadPage} from '@/hooks/useReadPage'
import ReadQueryNotice from '@/components/ui/ReadQueryNotice'
import {useEffect,useState} from 'react'
import {api} from '@/lib/api'
import Pagination from '@/components/ui/Pagination'
type History={serial:{code:string};events:{id:string;kind:string;sourceId:string;createdAt:string}[];warranties:{id:string;saleItemId:string;terms:string;startedAt:string;endsAt:string}[];services:{id:string;warrantyId:string;status:string;note:string;createdAt:string}[];totalPages:number;eventTotal:number;warrantyTotal:number;serviceTotal:number}
export default function SerialHistory({id}:{id:string}){
 const {status:codeLabel}=useTranslation();

 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

 const {page,setPage,invalid,reset}=useReadPage('serial_history_'+id+'_',50)
 const [open,setOpen]=useState(false),[revision,setRevision]=useState(0),[data,setData]=useState<History|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{
  if(!open||invalid)return;let live=true;const controller=new AbortController()
  void(async()=>{setBusy(true);setError('');try{const response=await api.request<History>('/inventory/serials/'+id+'/history?page='+page,{cache:'no-store',signal:controller.signal});if(!response.data)throw Error('Original tarix kelmadi');if(live)setData(response.data)}catch(e){if(live)setError(displayErrorMessage(e,'Tarix yuklanmadi'))}finally{if(live)setBusy(false)}})();return()=>{live=false;controller.abort()}
 },[id,open,page,revision,invalid])
 return <section aria-label={tr("Original serial tarixi")}><button type="button" onClick={()=>setOpen(v=>!v)}>{open?tr("Tarixni yopish"):tr("Barcha original serial tarixini ochish")}</button>{open&&<><ReadQueryNotice invalid={invalid} reset={reset}/>{busy&&!invalid&&<p role="status">{tr("Tarix yuklanmoqda…")}</p>}{error&&<p role="alert">{uiMessage(error)}</p>}{data&&<><p>{data.serial.code}: {data.eventTotal} {tr("birlik amali,")}{' '}{data.warrantyTotal} {tr("original kafolat,")}{' '}{data.serviceTotal} {tr("servis yozuvi.")}</p>{data.events.map(row=><p key={row.id}>{row.createdAt} · {row.kind} {tr("· original manba")}{' '}{row.sourceId}</p>)}{data.warranties.map(w=><p key={w.id}>{tr("Kafolat")}{' '}{w.id}{tr(", original savdo qatori")}{' '}{w.saleItemId}: {w.startedAt} — {w.endsAt}; {w.terms}</p>)}{data.services.map(row=><p key={row.id}>{row.createdAt} {tr("· kafolat")}{' '}{row.warrantyId} · {codeLabel(row.status)}: {row.note}</p>)}</>}<Pagination page={page} pages={data?.totalPages??0} busy={busy&&!invalid} blocked={invalid||!!error} onPage={setPage} retry={()=>setRevision(r=>r+1)}/></>}</section>
}
