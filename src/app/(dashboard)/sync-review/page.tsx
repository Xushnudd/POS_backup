'use client';


import {useTranslation} from '@/context/LocaleContext';

import {useListQuery} from '@/hooks/useListQuery';
import ListFilter from '@/components/ui/ListFilter';
import {useReadPage} from '@/hooks/useReadPage';
import ReadQueryNotice from '@/components/ui/ReadQueryNotice';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {api} from '@/lib/api';
import {operationHistory,deviceId,synchronize,acknowledge,type PendingOperation} from '@/lib/offline';
import {useAuth} from '@/context/AuthContext';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import DurableMutation from '@/components/forms/DurableMutation';
import PendingActions from '@/components/forms/PendingActions';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
type Review={id:string;operationId:string;commandType:string;code:string;state:string;reason?:string;payload:Record<string,unknown>;result?:unknown};
function returnPath(op:PendingOperation){
 const value=op.payload.returnPath;
 const pages=['/finance','/pos','/shifts','/purchases','/inventory','/inventory/counts','/inventory/transfers','/inventory/locations','/inventory/reservations','/inventory/dispositions','/replenishment','/incidents','/sync-review','/pos/offline','/settings/prices','/settings/support','/settings/taxes','/billing','/jobs','/onboarding','/support','/products/import','/customers/duplicates'];
 if(typeof value==='string'&&(pages.includes(value)||/^\/suppliers\/[0-9a-f-]{36}$/i.test(value)||/^\/customers\/[0-9a-f-]{36}\/history$/i.test(value)||/^\/sales\/[0-9a-f-]{36}\/exchange$/i.test(value)||/^\/products\/[0-9a-f-]{36}\/(?:variants|media|compliance|units)$/i.test(value)))return value;
 return String(op.payload.path??'').includes('/purchases')?'/purchases':'/finance';
}
export default function SyncReview(){const {organization,user,role}=useAuth();return organization&&user?<ReviewControls key={[organization.id,user.id,role].join(':')}/>:null;}
function ReviewControls(){
 const {t:tr}=useTranslation();

 const {page,setPage,invalid,reset}=useReadPage('review_');
 const localQuery=useListQuery(['newest','oldest'] as const,'newest','local_'),localPage=localQuery.query?.page??1,localLimit=localQuery.query?.limit??20,localSearch=localQuery.query?.search??'',localSort=localQuery.query?.sort??'newest',localStatus=localQuery.params.get('local_state')??'';
 const invalidLocal=!localQuery.query||!!localStatus&&!['pending','conflict','synced','rejected'].includes(localStatus);
 const {organization,user,role}=useAuth();const [local,setLocal]=useState<PendingOperation[]>([]),[reviews,setReviews]=useState<Review[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false),[working,setWorking]=useState(false),[message,setMessage]=useState(''),[reason,setReason]=useState(''),[pages,setPages]=useState(0),[revision,setRevision]=useState(0);
 const live=useRef(true),sequence=useRef(0),flight=useRef(false);
 useUnsavedChanges(Boolean(reason),working);
 const load=useCallback(async()=>{
  if(!organization||!user||invalid)return;
  const request=++sequence.current;if(live.current){setLoading(true);setError('');}
  try{
   const [history,result]=await Promise.all([operationHistory({organizationId:organization.id,userId:user.id,deviceId:deviceId()}),role!=='admin'?api.request<Review[]>('/sync/reviews?page='+page):Promise.resolve(null)]);
   if(live.current&&request===sequence.current){setLocal(history);setReviews(result?.data??[]);setPages(result?.pagination?.totalPages??0);}
  }catch(cause){if(live.current&&request===sequence.current)setError(cause instanceof Error?cause.message:'Navbat yuklanmadi');}
  finally{if(live.current&&request===sequence.current)setLoading(false);}
 },[organization,user,role,page,invalid]);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 useEffect(()=>{void Promise.resolve().then(()=>{if(live.current)return load();});},[load,revision]);
 const refresh=()=>setRevision(value=>value+1);
 const resolved=(_result?:unknown,original?:Record<string,unknown>)=>{const savedReason=original?.reason;if(typeof savedReason==='string')setReason(current=>current===savedReason?'':current);refresh();};
 async function sync(){
  if(flight.current||!organization||!user)return;flight.current=true;setWorking(true);setMessage('');setError('');
  try{await synchronize({organizationId:organization.id,userId:user.id,deviceId:deviceId()});if(live.current){setMessage('Sinxronlash tekshiruvi tugadi. Har bir amalning holatini tekshiring.');await load();}}
  catch(cause){if(live.current)setError(cause instanceof Error?cause.message:'Aloqani tiklang');}
  finally{flight.current=false;if(live.current)setWorking(false);}
 }
 async function saveProof(review:Review){
  if(flight.current)return;flight.current=true;setWorking(true);setMessage('');setError('');
  try{await acknowledge(review.operationId,'rejected',{reviewId:review.id,proof:review.result},'MANAGER_REVIEWED_TERMINAL_RESULT');if(live.current){setMessage('Rahbarning terminal natija dalili lokal navbatga saqlandi.');await load();}}
  catch(cause){if(live.current)setError(cause instanceof Error?cause.message:'Lokal tasdiq saqlanmadi');}
  finally{flight.current=false;if(live.current)setWorking(false);}
 }
 const localRows=local.filter(op=>(!localStatus||op.state===localStatus)&&(!localSearch||[op.id,op.type,op.code??''].some(value=>value.toLowerCase().includes(localSearch.toLowerCase())))).sort((a,b)=>(localSort==='oldest'?a.createdAt.localeCompare(b.createdAt):b.createdAt.localeCompare(a.createdAt))||a.id.localeCompare(b.id));
 return <div className="space-y-4"><ReadQueryNotice invalid={invalid} reset={reset}/><h1 className="text-2xl font-bold">{tr("Navbat va konfliktlar")}</h1>
  <p>{tr("Pending — javob kutilmoqda; conflict — qo‘lda tekshirish kerak; synced — server tasdiqlagan. Asl payload o‘zgartirilmaydi va konflikt o‘chirib yashirilmaydi. Owner server konfliktlarini ko‘radi. Faqat shu qurilmadagi lokal amallar quyida; boshqa qurilma lokal navbati cloud backup emas.")}</p>
  <Button disabled={loading||working} onClick={()=>void sync()}>{tr("Asl kalitlar bilan sinxronlash")}</Button>{loading&&!invalid&&<p role="status">{tr("Navbat yuklanmoqda…")}</p>}{working&&<p role="status">{tr("Original navbat natijasi tekshirilmoqda…")}</p>}{message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
  <Link prefetch={false} className="underline text-blue-800" href="/pwa/cash.html">{tr("Offline naqdning original navbati va server natijasi")}</Link><p>{tr("Imzolangan offline naqd amallari alohida shifrlangan savatda saqlanadi; yuqoridagi havola orqali ochib sinxronlang.")}</p>
  <h2 className="font-bold">{tr("Shu qurilma amallari")}</h2><ListFilter search={localSearch} sort={localSort} label={tr("Lokal amal kodi, turi yoki ID qidirish")} onChange={localQuery.changeQuery} reset={{state:''}} options={[{value:'newest',label:tr("Yangi → eski")},{value:'oldest',label:tr("Eski → yangi")}]}><label>{tr("Amal holati")}<select aria-label={tr("Lokal amal holati")} value={localStatus} onChange={event=>localQuery.changeQuery({state:event.target.value,page:'1'})}><option value="">{tr("Barcha holatlar")}</option>{['pending','conflict','synced','rejected'].map(state=><option key={state} value={state}>{state}</option>)}</select></label></ListFilter>{invalidLocal&&<p role="alert">{tr("Lokal tarixning URL filtri noto‘g‘ri. Filtrlarni tozalang.")}</p>}{!invalidLocal&&localRows.slice((localPage-1)*localLimit,localPage*localLimit).map(op=><article key={op.id} className="border p-3 bg-white"><p>{op.type} · {op.state} · {op.code??''}</p><p>{tr("Amal:")}{' '}{op.id}</p>{op.type==='finance.action'&&['pending','conflict'].includes(op.state)&&<Link prefetch={false} className="underline text-blue-800" href={returnPath(op)}>{tr("Original ichki hujjat amalini tekshirish")}</Link>}{op.type==='catalog.prices'&&['pending','conflict'].includes(op.state)&&<Link prefetch={false} className="underline text-blue-800" href="/products/prices">{tr("Original narx amalini tekshirish")}</Link>}{op.state==='conflict'&&<a className="underline text-blue-800" href="/drafts">{tr("Asl qoralamani tekshirish")}</a>}</article>)}{!loading&&!error&&!invalidLocal&&!localRows.length&&<p>{tr("Lokal amal yo‘q.")}</p>}<Pagination page={localPage} pages={Math.ceil(localRows.length/localLimit)} busy={loading||working} blocked={invalidLocal||!!error} onPage={value=>localQuery.changeQuery({page:String(value)})}/>
  <h2 className="font-bold">{tr("Serverdagi konfliktlar")}</h2><PendingActions prefix="/sync/reviews" returnPath="/sync-review" revision={revision} onDone={refresh}/>
  {role==='owner'&&<Input label={tr("Konflikt ko‘rib chiqish sababi")} value={reason} disabled={working} onChange={event=>setReason(event.target.value)} maxLength={1000}/>}{reason&&<p role="status">{tr("Saqlanmagan konflikt ko‘rib chiqish sababi bor.")}</p>}
  {reviews.map(review=><article key={review.id} className="border p-3 bg-white"><p>{review.commandType} · {review.state} · {review.code}</p><p>{tr("Amal:")}{' '}{review.operationId}</p><details><summary>{tr("Asl saqlangan ma’lumot")}</summary><pre className="whitespace-pre-wrap break-all">{JSON.stringify(review.payload,null,2)}</pre></details>{review.reason&&<p>{review.reason}</p>}
   {review.state==='resolved'&&local.some(op=>op.id===review.operationId&&op.type===review.commandType&&op.state==='conflict')&&<Button disabled={working||loading} onClick={()=>void saveProof(review)}>{tr("Rahbar dalilini lokal navbatga saqlash")}</Button>}
   {role==='owner'&&<DurableMutation path={'/sync/reviews/'+review.id} returnPath="/sync-review" allowNew={review.state==='conflict'} canSubmit={!working&&!loading&&reason.trim().length>=3} body={{reason}} label={tr("Terminal natija dalili bilan hal qilish")} review={['Original amal: '+review.operationId,'Konflikt: '+review.id,reason,'Serverdagi terminal natija dalili tekshiriladi. Asl payload yoki moliyaviy hisob o‘zgarmaydi.']} onDone={resolved}/>}
  </article>)}{role==='admin'&&<p>{tr("Server konfliktlari biznes egasi tomonidan ko‘rib chiqiladi; lokal navbatni asl hisobda tekshiring.")}</p>}
  <Pagination page={page} pages={pages} busy={loading&&!invalid||working} blocked={invalid||!!error} onPage={setPage} retry={refresh}/>
 </div>;
}
