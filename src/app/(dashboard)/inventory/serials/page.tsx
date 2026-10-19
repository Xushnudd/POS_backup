'use client'
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {localizeOwnedLabels} from '@/i18n/messages';

import {useTranslation} from '@/context/LocaleContext';

import {Suspense,useEffect,useState} from 'react'
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
import {useListQuery} from '@/hooks/useListQuery'
import {serialListSorts} from '@/lib/list-query'
import ListFilter from '@/components/ui/ListFilter'
import DataTable from '@/components/ui/DataTable'
type Service={id:string;status:string;note:string;createdAt:string}
type Warranty={id:string;startedAt:string;endsAt:string;terms:string;services:Service[]}
type Row={id:string;code:string;state:string;product:{name:string};events:{id:string;kind:string;sourceId:string;createdAt:string}[];warranties:Warranty[]}
const labels:Record<string,string>={available:'Sotuvga tayyor',sold:'Sotilgan',transit:'Yo‘lda',damaged:'Brak',retired:'Hisobdan chiqarilgan'}
const labelsSource=labels;
export default function SerialPage(){
 const {t:tr}=useTranslation();

 const {organization,user,role}=useAuth(),{activeStore}=useOrganization()
 if(!organization||!user||!activeStore)return <p>{tr("Avval filialni tanlang.")}</p>
 return <Suspense fallback={<p>{tr("Yuklanmoqda...")}</p>}><SerialWorkspace key={[organization.id,user.id,role,activeStore.id].join(':')} role={role??''} storeId={activeStore.id}/></Suspense>
}
function SerialWorkspace({role,storeId}:{role:string;storeId:string}){
 const {status:codeLabel}=useTranslation();

 const {message:uiMessage}=useTranslation();

 const {locale:mapLocale}=useTranslation();

 const labels=localizeOwnedLabels(labelsSource,mapLocale);

 const {t:tr}=useTranslation();
 
 const {query,params,changeQuery}=useListQuery(serialListSorts,'code_asc')
 const page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'code_asc',search=query?.search??'',state=params.get('state')??'',invalidQuery=!query
 const [pages,setPages]=useState(0),[rows,setRows]=useState<Row[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0)
 const [productId,setProduct]=useState(''),[days,setDays]=useState('0'),[terms,setTerms]=useState(''),[reason,setReason]=useState(''),[posting,setPosting]=useState(false)
 const [warranty,setWarranty]=useState<Warranty|null>(null),[status,setStatus]=useState('opened'),[note,setNote]=useState('')
 useUnsavedChanges(Boolean(productId||terms||reason||note),posting)
 const refresh=()=>setRevision(r=>r+1)
 useEffect(()=>{
  if(!storeId||invalidQuery)return;let live=true;const controller=new AbortController()
  void(async()=>{setBusy(true);setError('');try{const result=await api.request<Row[]>('/inventory/serials?'+new URLSearchParams({storeId,search,page:String(page),limit:String(limit),sort,...(state?{state}:{})}),{cache:'no-store',signal:controller.signal});if(!result.data)throw Error('Serial natijasi kelmadi');if(live){setRows(result.data);setPages(result.pagination?.totalPages??0)}}catch(e){if(live)setError(displayErrorMessage(e,'Seriallar yuklanmadi'))}finally{if(live)setBusy(false)}})();return()=>{live=false;controller.abort()}
 },[storeId,search,state,page,limit,sort,revision,invalidQuery])
 if(!storeId)return <p>{tr("Avval filialni tanlang.")}</p>
 return <main className="space-y-5"><h1 className="text-2xl font-bold">{tr("Seriya raqamlari va kafolat")}</h1><Link href="/inventory">{tr("Omborga qaytish")}</Link><p>{tr("Har birlik original kirim, savdo, qaytarish va kafolatga bog‘lanadi. Seriallar yuqori registrda saqlanadi; eski qoldiqqa taxminiy serial qo‘shilmaydi.")}</p><PendingActions prefix="/inventory/serials" returnPath="/inventory/serials" revision={revision} onDone={refresh}/>
 <ListFilter search={search} sort={sort} label={tr("Seriya raqamini qidirish")} maxLength={100} disabled={posting} onChange={changeQuery} reset={{state:''}} options={[{value:'code_asc',label:tr("Kod: A–Z")},{value:'code_desc',label:tr("Kod: Z–A")},{value:'newest',label:tr("Eng yangi")},{value:'oldest',label:tr("Eng eski")}]}><Select label={tr("Serial holati")} value={state} onChange={e=>changeQuery({state:e.target.value,page:'1'})} options={[{value:'',label:tr("Barchasi")},...Object.entries(labels).map(([value,label])=>({value,label}))]}/></ListFilter>{invalidQuery&&<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>}
 {busy&&<p role="status">{tr("Seriallar yuklanmoqda…")}</p>}{error&&<p role="alert">{uiMessage(error)}{tr(". Oldingi natija saqlangan.")}</p>}{!busy&&!error&&!invalidQuery&&<div className="overflow-x-auto"><DataTable><thead><tr>{[tr("Mahsulot"),tr("Serial"),tr("Holat"),tr("Original iz va kafolat")].map(s=><th key={s} className="p-3">{s}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-b"><td className="p-3">{row.product.name}</td><td className="p-3">{row.code}</td><td className="p-3">{labels[row.state]}</td><td className="p-3">{role!=='cashier'&&<SerialHistory id={row.id}/>}<details><summary>{tr("Eng so‘nggi20 birlik amali")}</summary>{row.events?.map(e=><p key={e.id}>{e.createdAt} · {e.kind} {tr("· manba")}{' '}{e.sourceId}</p>)}</details>{row.warranties?.map(w=><div key={w.id}><p>{tr("Kafolat:")}{' '}{w.startedAt} — {w.endsAt}</p><p>{w.terms||tr("Qo‘shimcha shart kiritilmagan")}</p>{w.services.map(event=><p key={event.id}>{event.createdAt} · {codeLabel(event.status)}: {event.note}</p>)}{role!=='cashier'&&row.state==='sold'&&<button type="button" disabled={posting||Boolean(note)} onClick={()=>setWarranty(w)}>{tr("Shu kafolat bo‘yicha servis")}</button>}</div>)}</td></tr>)}</tbody></DataTable>{!busy&&!rows.length&&<p>{tr("Tanlangan filtrda serial yo‘q.")}</p>}</div>}<Pagination page={page} pages={pages} busy={busy&&!invalidQuery||posting} blocked={invalidQuery||!!error} onPage={value=>changeQuery({page:String(value)})} retry={refresh}/>
 {role==='owner'&&<section aria-label={tr("Serial nazoratini sozlash")}><h2>{tr("Mahsulot serial nazorati")}</h2><p>{tr("Faqat butun birlik va tarixi yo‘q SKUda yoqiladi. Keyingi shart o‘zgarishi eski kafolat snapshotiga tegmaydi.")}</p><DurableMutation path="/inventory/serials/policy" returnPath="/inventory/serials" label={tr("Serial nazoratini saqlash")} body={{productId,warrantyDays:/^\d{1,5}$/.test(days)?Number(days):days,warrantyTerms:terms,reason}} review={[tr("Mahsulot:")+" "+productId,tr("Kafolat:")+" "+days+" "+tr("kun"),terms,reason]} allowNew={Boolean(productId&&/^\d{1,5}$/.test(days)&&Number(days)<=36500&&reason.trim().length>=3)} onSavingChange={setPosting} onDone={(_result,original)=>{if(original?.productId===productId&&original?.reason===reason&&original?.warrantyTerms===terms){setProduct('');setDays('0');setTerms('');setReason('')}refresh()}}><CatalogFilter kind="product" value={productId} onChange={setProduct}/><Input label={tr("Kafolat kunlari")} value={days} onChange={e=>setDays(e.target.value)}/><Input label={tr("Kafolat shartlari")} value={terms} onChange={e=>setTerms(e.target.value)} maxLength={4000}/><Input label={tr("Serial nazorati sababi")} value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000}/></DurableMutation></section>}
 {warranty&&<section aria-label={tr("Kafolat servis jurnali")}><h2>{tr("Original kafolat bo‘yicha servis")}</h2><p>{warranty.terms}</p><DurableMutation path="/inventory/serials/service" returnPath="/inventory/serials" label={tr("Servis holatini yozish")} body={{warrantyId:warranty.id,status,note}} review={[warranty.id,status,note,tr("Servis pul yoki ombor harakati yaratmaydi.")]} allowNew={note.trim().length>=3} onSavingChange={setPosting} onDone={(_result,original)=>{if(original?.note===note&&original?.warrantyId===warranty.id){setNote('');setWarranty(null)}refresh()}}><Select label={tr("Servis holati")} value={status} onChange={e=>setStatus(e.target.value)} options={[{value:'opened',label:tr("Yangi murojaat")},{value:'in_progress',label:tr("Jarayonda")},{value:'resolved',label:tr("Hal qilindi")},{value:'rejected',label:tr("Rad etildi")}]}/><Input label={tr("Servis izohi")} value={note} onChange={e=>setNote(e.target.value)} maxLength={2000}/></DurableMutation></section>}
 </main>
}
