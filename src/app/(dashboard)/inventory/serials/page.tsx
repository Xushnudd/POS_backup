'use client'
import {useEffect,useState} from 'react'
import SerialHistory from '@/components/inventory/SerialHistory'
import Link from 'next/link'
import {api} from '@/lib/api'
import {useAuth} from '@/context/AuthContext'
import {useOrganization} from '@/context/OrganizationContext'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import CatalogFilter from '@/components/reports/CatalogFilter'
import DurableMutation from '@/components/forms/DurableMutation'
import PendingActions from '@/components/forms/PendingActions'
import Pagination from '@/components/ui/Pagination'
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges'
type Service={id:string;status:string;note:string;createdAt:string}
type Warranty={id:string;startedAt:string;endsAt:string;terms:string;services:Service[]}
type Row={id:string;code:string;state:string;product:{name:string};events:{id:string;kind:string;sourceId:string;createdAt:string}[];warranties:Warranty[]}
const labels:Record<string,string>={available:'Sotuvga tayyor',sold:'Sotilgan',transit:'Yo‘lda',damaged:'Brak',retired:'Hisobdan chiqarilgan'}
export default function SerialPage(){
 const {organization,user,role}=useAuth(),{activeStore}=useOrganization()
 if(!organization||!user||!activeStore)return <p>Avval filialni tanlang.</p>
 return <SerialWorkspace key={[organization.id,user.id,role,activeStore.id].join(':')} role={role??''} storeId={activeStore.id}/>
}
function SerialWorkspace({role,storeId}:{role:string;storeId:string}){ 
 const [search,setSearch]=useState(''),[state,setState]=useState(''),[page,setPage]=useState(1),[pages,setPages]=useState(0),[rows,setRows]=useState<Row[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0)
 const [productId,setProduct]=useState(''),[days,setDays]=useState('0'),[terms,setTerms]=useState(''),[reason,setReason]=useState(''),[posting,setPosting]=useState(false)
 const [warranty,setWarranty]=useState<Warranty|null>(null),[status,setStatus]=useState('opened'),[note,setNote]=useState('')
 useUnsavedChanges(Boolean(productId||terms||reason||note),posting)
 const refresh=()=>setRevision(r=>r+1)
 useEffect(()=>{
  if(!storeId)return;let live=true;const controller=new AbortController()
  void(async()=>{setBusy(true);setError('');try{const result=await api.request<Row[]>('/inventory/serials?'+new URLSearchParams({storeId,search,page:String(page),...(state?{state}:{})}),{cache:'no-store',signal:controller.signal});if(!result.data)throw Error('Serial natijasi kelmadi');if(live){setRows(result.data);setPages(result.pagination?.totalPages??0)}}catch(e){if(live)setError(e instanceof Error?e.message:'Seriallar yuklanmadi')}finally{if(live)setBusy(false)}})();return()=>{live=false;controller.abort()}
 },[storeId,search,state,page,revision])
 if(!storeId)return <p>Avval filialni tanlang.</p>
 return <main className="space-y-5"><h1 className="text-2xl font-bold">Seriya raqamlari va kafolat</h1><Link href="/inventory">Omborga qaytish</Link><p>Har birlik original kirim, savdo, qaytarish va kafolatga bog‘lanadi. Seriallar yuqori registrda saqlanadi; eski qoldiqqa taxminiy serial qo‘shilmaydi.</p><PendingActions prefix="/inventory/serials" returnPath="/inventory/serials" revision={revision} onDone={refresh}/>
 <Input label="Seriya raqamini qidirish" value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/><Select label="Serial holati" value={state} onChange={e=>{setState(e.target.value);setPage(1)}} options={[{value:'',label:'Barchasi'},...Object.entries(labels).map(([value,label])=>({value,label}))]}/>
 {busy&&<p role="status">Seriallar yuklanmoqda…</p>}{error&&<p role="alert">{error}. Oldingi natija saqlangan.</p>}<div className="overflow-x-auto"><table className="min-w-full text-left"><thead><tr>{['Mahsulot','Serial','Holat','Original iz va kafolat'].map(s=><th key={s} className="p-3">{s}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-b"><td className="p-3">{row.product.name}</td><td className="p-3">{row.code}</td><td className="p-3">{labels[row.state]}</td><td className="p-3">{role!=='cashier'&&<SerialHistory id={row.id}/>}<details><summary>Eng so‘nggi20 birlik amali</summary>{row.events?.map(e=><p key={e.id}>{e.createdAt} · {e.kind} · manba {e.sourceId}</p>)}</details>{row.warranties?.map(w=><div key={w.id}><p>Kafolat: {w.startedAt} — {w.endsAt}</p><p>{w.terms||'Qo‘shimcha shart kiritilmagan'}</p>{w.services.map(event=><p key={event.id}>{event.createdAt} · {event.status}: {event.note}</p>)}{role!=='cashier'&&row.state==='sold'&&<button type="button" disabled={posting||Boolean(note)} onClick={()=>setWarranty(w)}>Shu kafolat bo‘yicha servis</button>}</div>)}</td></tr>)}</tbody></table>{!busy&&!rows.length&&<p>Tanlangan filtrda serial yo‘q.</p>}</div><Pagination page={page} pages={pages} busy={busy||posting} onPage={setPage} retry={refresh}/>
 {role==='owner'&&<section aria-label="Serial nazoratini sozlash"><h2>Mahsulot serial nazorati</h2><p>Faqat butun birlik va tarixi yo‘q SKUda yoqiladi. Keyingi shart o‘zgarishi eski kafolat snapshotiga tegmaydi.</p><DurableMutation path="/inventory/serials/policy" returnPath="/inventory/serials" label="Serial nazoratini saqlash" body={{productId,warrantyDays:/^\d{1,5}$/.test(days)?Number(days):days,warrantyTerms:terms,reason}} review={['Mahsulot: '+productId,'Kafolat: '+days+' kun',terms,reason]} allowNew={Boolean(productId&&/^\d{1,5}$/.test(days)&&Number(days)<=36500&&reason.trim().length>=3)} onSavingChange={setPosting} onDone={(_result,original)=>{if(original?.productId===productId&&original?.reason===reason&&original?.warrantyTerms===terms){setProduct('');setDays('0');setTerms('');setReason('')}refresh()}}><CatalogFilter kind="product" value={productId} onChange={setProduct}/><Input label="Kafolat kunlari" value={days} onChange={e=>setDays(e.target.value)}/><Input label="Kafolat shartlari" value={terms} onChange={e=>setTerms(e.target.value)} maxLength={4000}/><Input label="Serial nazorati sababi" value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000}/></DurableMutation></section>}
 {warranty&&<section aria-label="Kafolat servis jurnali"><h2>Original kafolat bo‘yicha servis</h2><p>{warranty.terms}</p><DurableMutation path="/inventory/serials/service" returnPath="/inventory/serials" label="Servis holatini yozish" body={{warrantyId:warranty.id,status,note}} review={[warranty.id,status,note,'Servis pul yoki ombor harakati yaratmaydi.']} allowNew={note.trim().length>=3} onSavingChange={setPosting} onDone={(_result,original)=>{if(original?.note===note&&original?.warrantyId===warranty.id){setNote('');setWarranty(null)}refresh()}}><Select label="Servis holati" value={status} onChange={e=>setStatus(e.target.value)} options={[{value:'opened',label:'Yangi murojaat'},{value:'in_progress',label:'Jarayonda'},{value:'resolved',label:'Hal qilindi'},{value:'rejected',label:'Rad etildi'}]}/><Input label="Servis izohi" value={note} onChange={e=>setNote(e.target.value)} maxLength={2000}/></DurableMutation></section>}
 </main>
}
