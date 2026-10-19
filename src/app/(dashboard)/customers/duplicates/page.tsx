'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import {Suspense,useEffect,useState} from 'react';
import Link from 'next/link';
import {useAuth} from '@/context/AuthContext';
import {api} from '@/lib/api';
import {useListFilters} from '@/hooks/useListFilters';
import {duplicateListSorts} from '@/lib/list-query';
import Input from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import ListFilter from '@/components/ui/ListFilter';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
const fields=['phone'] as const;
type Duplicate={id:string;fullName:string;phone:string;key:string;duplicates:number};
export default function CustomerDuplicatesPage(){
 const {t:tr}=useTranslation();
const {organization,user,role}=useAuth();return organization&&user&&role==='owner'?<Suspense fallback={<LoadingSpinner/>}><List key={organization.id+':'+user.id}/></Suspense>:<p>{tr("Mijoz identity tekshiruvi egasi vakolatida.")}</p>}
function List(){
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

 const {query,filters,changeQuery}=useListFilters(duplicateListSorts,'source',fields);
 const page=query?.page??1,limit=query?.limit??20,search=query?.search??'',sort=query?.sort??'source',invalidQuery=!query;
 const [rows,setRows]=useState<Duplicate[]>([]),[pages,setPages]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{let live=true;void Promise.resolve().then(async()=>{if(!live||invalidQuery)return;setBusy(true);setError('');try{const response=await api.request<Duplicate[]>('/customer-merges?'+new URLSearchParams({page:String(page),limit:String(limit),sort,search,...filters}));if(live){setRows(response.data??[]);setPages(response.pagination?.totalPages??0)}}catch(error){if(live)setError(displayErrorMessage(error,'Dublikatlar yuklanmadi'))}finally{if(live)setBusy(false)}});return()=>{live=false}},[page,limit,sort,search,filters,invalidQuery,revision]);
 return <div className="space-y-4"><h1>{tr("Legacy telefon dublikatlari")}</h1><Link href="/customers">{tr("Mijozlar")}</Link><p>{tr("Avvalgi kartalar avtomatik birlashtirilmaydi. Bir xil raqam bir shaxs ekanini o‘zingiz tekshiring; kerak bo‘lsa telefonni tuzating yoki original qarz/qoralamalar yopilgach merge qiling. Yangi valid duplicate karta yaratilmaydi.")}</p>
 <ListFilter search={search} sort={sort} label={tr("Dublikat karta nomi qidirish")} onChange={changeQuery} reset={{phone:''}} fields={fields} options={[{value:'source',label:tr("Asl ketma-ketlik")},{value:'name_asc',label:tr("Nom A → Z")},{value:'name_desc',label:tr("Nom Z → A")}]}><Input key={filters.phone??''} name="phone" label={tr("Dublikatning to‘liq telefoni (ixtiyoriy)")} maxLength={40} defaultValue={filters.phone??''}/></ListFilter>
 {invalidQuery?<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>:error?<p role="alert">{uiMessage(error)}</p>:busy?<p role="status">{tr("Dublikatlar yuklanmoqda…")}</p>:<>{rows.map(r=><article key={r.id}><p>{r.fullName} {tr("· Original")}{' '}{r.phone} {tr("· Normal")}{' '}{r.key} · {r.duplicates} {tr("karta")}</p><Link href={'/customers/'+r.id+'/history'}>{tr("Original tarixni ko‘rish va merge")}</Link></article>)}{!rows.length&&<p>{tr("Faol valid telefon dublikati topilmadi.")}</p>}</>}
 <Pagination page={page} pages={pages} busy={busy&&!invalidQuery} blocked={invalidQuery||!!error} onPage={value=>changeQuery({page:String(value)})} retry={()=>setRevision(n=>n+1)}/></div>
}
