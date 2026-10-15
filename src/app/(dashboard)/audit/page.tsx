'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import type { AuditSummary } from '@/types';
import CsvExportButton from '@/components/ui/CsvExportButton';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import {useListQuery} from '@/hooks/useListQuery';
import {journalListSorts} from '@/lib/list-query';
import ListFilter from '@/components/ui/ListFilter';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
export default function AuditPage(){
 const {t:tr}=useTranslation();
const {role,organization,user}=useAuth();return role==='owner'&&organization&&user?<Suspense fallback={<p>{tr("Yuklanmoqda...")}</p>}><Audit key={[organization.id,user.id,role].join(':')}/></Suspense>:<p>{tr("Audit tarixini ko‘rish uchun biznes egasi vakolati kerak.")}</p>;}
function Audit(){
 const {formatDate}=useTranslation();

 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

 const {role,organization}=useAuth();
 const [rows,setRows]=useState<AuditSummary[]>([]),[pages,setPages]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const {query,params,changeQuery}=useListQuery(journalListSorts,'newest');
 const page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'newest',search=query?.search??'',invalidQuery=!query;
 const filters=Object.fromEntries(['from','to','entityType','entityId','actorId','action'].map(key=>[key,params.get(key)??'']).filter(([,value])=>value));
 const filterKey=JSON.stringify(filters);
 const [draft,setDraft]=useState({from:params.get('from')??'',to:params.get('to')??'',entityType:params.get('entityType')??'',entityId:params.get('entityId')??'',actorId:params.get('actorId')??'',action:params.get('action')??''}),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;void Promise.resolve().then(()=>{if(live)setDraft({from:'',to:'',entityType:'',entityId:'',actorId:'',action:'',...JSON.parse(filterKey)});});return()=>{live=false;};},[filterKey]);
 useEffect(()=>{
  if(role!=='owner'||!organization?.id||invalidQuery)return;
  let cancelled=false;
  void Promise.resolve().then(async()=>{
   if(cancelled)return;setBusy(true);setError('');
   try{const result=await api.auditSummary({...JSON.parse(filterKey),page:String(page),limit:String(limit),sort,search});if(!cancelled){setRows(result.data??[]);setPages(result.pagination?.totalPages??0);}}
   catch(error){if(!cancelled)setError(displayErrorMessage(error,'Tarix yuklanmadi'));}
   finally{if(!cancelled)setBusy(false);}
  });return()=>{cancelled=true;};
 },[role,organization?.id,page,limit,sort,search,filterKey,retry,invalidQuery]);
 if(role!=='owner')return <p>{tr("Audit tarixini ko‘rish uchun biznes egasi vakolati kerak.")}</p>;
 return <div className="space-y-4"><h1 className="text-2xl font-bold">{tr("Audit tarixi")}</h1>
  <CsvExportButton path="/audit" params={{...filters,sort,search,view:'summary'}}/>
  <ListFilter search={search} sort={sort} label={tr("Resurs yoki amal qidirish")} disabled={false} onChange={changeQuery} reset={{from:'',to:'',entityType:'',entityId:'',actorId:'',action:''}} options={[{value:'newest',label:tr("Eng yangi")},{value:'oldest',label:tr("Eng eski")}]}/>
  <Card><form className="grid sm:grid-cols-2 gap-3" onSubmit={event=>{event.preventDefault();changeQuery({...Object.fromEntries(Object.entries(draft).map(([key,value])=>[key,value.trim()])),page:'1'});}}>
   <Input label={tr("Davr boshi")} type="date" value={draft.from} onChange={event=>setDraft({...draft,from:event.target.value})}/><Input label={tr("Davr oxiri")} type="date" value={draft.to} onChange={event=>setDraft({...draft,to:event.target.value})}/>
   <Input label={tr("Resurs turi (masalan SaleReturn)")} maxLength={100} value={draft.entityType} onChange={event=>setDraft({...draft,entityType:event.target.value})}/><Input label={tr("Amal (masalan returned)")} maxLength={100} value={draft.action} onChange={event=>setDraft({...draft,action:event.target.value})}/>
   <Input label={tr("Resurs ID")} value={draft.entityId} onChange={event=>setDraft({...draft,entityId:event.target.value})}/><Input label={tr("Xodim ID")} value={draft.actorId} onChange={event=>setDraft({...draft,actorId:event.target.value})}/>
   <Button type="submit" disabled={busy}>{tr("Filtrlash")}</Button>
  </form></Card>
  <Card><p className="text-xs text-slate-500 mb-3">{tr("Sanalar tashkilot vaqt zonasida. Ushbu ekran yozilgan audit hodisalarini ko‘rsatadi; tafsilot payloadlari va IP manzillar chiqarilmaydi.")}</p>
   {invalidQuery?<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>:busy?<p>{tr("Yuklanmoqda...")}</p>:error?<div role="alert">{uiMessage(error)}<Button onClick={()=>setRetry(value=>value+1)}>{tr("Qayta yuklash")}</Button></div>:<div className="overflow-auto"><DataTable className="text-sm"><thead><tr><th>{tr("Sana")}</th><th>{tr("Xodim")}</th><th>{tr("Resurs")}</th><th>{tr("Amal")}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t"><td className="p-2">{formatDate(row.createdAt,true,organization?.timezone)}</td><td>{row.actor?.fullName??tr("Tizim / xodim mavjud emas")}<div className="text-xs">{row.actorId}</div></td><td>{row.entityType}<div className="text-xs break-all">{row.entityId}</div></td><td>{row.action}</td></tr>)}</tbody></DataTable>{rows.length===0&&<p>{tr("Hodisa topilmadi.")}</p>}</div>}
   <Pagination page={page} pages={pages} busy={busy} blocked={invalidQuery||!!error} onPage={value=>changeQuery({page:String(value)})} retry={()=>setRetry(value=>value+1)}/>{!invalidQuery&&page>Math.max(1,pages)&&<Button onClick={()=>changeQuery({page:'1'})}>{tr("Birinchi sahifaga qaytish")}</Button>}
  </Card></div>;
}
