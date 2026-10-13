'use client'
import {useEffect,useState} from 'react'
import {api} from '@/lib/api'
import Pagination from '@/components/ui/Pagination'
type History={serial:{code:string};events:{id:string;kind:string;sourceId:string;createdAt:string}[];warranties:{id:string;saleItemId:string;terms:string;startedAt:string;endsAt:string}[];services:{id:string;warrantyId:string;status:string;note:string;createdAt:string}[];totalPages:number;eventTotal:number;warrantyTotal:number;serviceTotal:number}
export default function SerialHistory({id}:{id:string}){
 const [open,setOpen]=useState(false),[page,setPage]=useState(1),[revision,setRevision]=useState(0),[data,setData]=useState<History|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{
  if(!open)return;let live=true;const controller=new AbortController()
  void(async()=>{setBusy(true);setError('');try{const response=await api.request<History>('/inventory/serials/'+id+'/history?page='+page,{cache:'no-store',signal:controller.signal});if(!response.data)throw Error('Original tarix kelmadi');if(live)setData(response.data)}catch(e){if(live)setError(e instanceof Error?e.message:'Tarix yuklanmadi')}finally{if(live)setBusy(false)}})();return()=>{live=false;controller.abort()}
 },[id,open,page,revision])
 return <section aria-label="Original serial tarixi"><button type="button" onClick={()=>setOpen(v=>!v)}>{open?'Tarixni yopish':'Barcha original serial tarixini ochish'}</button>{open&&<>{busy&&<p role="status">Tarix yuklanmoqda…</p>}{error&&<p role="alert">{error}</p>}{data&&<><p>{data.serial.code}: {data.eventTotal} birlik amali, {data.warrantyTotal} original kafolat, {data.serviceTotal} servis yozuvi.</p>{data.events.map(row=><p key={row.id}>{row.createdAt} · {row.kind} · original manba {row.sourceId}</p>)}{data.warranties.map(w=><p key={w.id}>Kafolat {w.id}, original savdo qatori {w.saleItemId}: {w.startedAt} — {w.endsAt}; {w.terms}</p>)}{data.services.map(row=><p key={row.id}>{row.createdAt} · kafolat {row.warrantyId} · {row.status}: {row.note}</p>)}</>}<Pagination page={page} pages={data?.totalPages??0} busy={busy} onPage={setPage} retry={()=>setRevision(r=>r+1)}/></>}</section>
}
