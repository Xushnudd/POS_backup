'use client';




import {useTranslation} from '@/context/LocaleContext';

import { Suspense,useEffect,useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Card from '@/components/ui/Card';
import {useListQuery} from '@/hooks/useListQuery';
import ListFilter from '@/components/ui/ListFilter';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
const sorts=['name_asc','name_desc'] as const;
type Kind='products'|'customers'|'categories';
type Row={id:string;name?:string;fullName?:string;isActive:boolean};
export default function ArchivePage(){
 const {t:tr}=useTranslation();
const {organization,user,role}=useAuth();return <Suspense fallback={<p>{tr("Yuklanmoqda...")}</p>}><Archive key={[organization?.id,user?.id,role].join(':')}/></Suspense>;}
function Archive(){
 const {t:tr}=useTranslation();

 const {organization,role}=useAuth();
 const {query,params,changeQuery}=useListQuery(sorts,'name_asc');
 const page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'name_asc',search=query?.search??'',kind=(params.get('kind')??'products') as Kind,status=params.get('status')??'archived',invalidQuery=!query||!['products','customers','categories'].includes(kind);
 const [pages,setPages]=useState(0),[rows,setRows]=useState<Row[]>([]),[busy,setBusy]=useState(true),[saving,setSaving]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!organization||!role||role==='cashier'||invalidQuery)return;
  let cancelled=false;
  void Promise.resolve().then(async()=>{if(cancelled)return;setBusy(true);setError('');try{const res=await api.archive.list(kind,{organizationId:organization.id,status,page:String(page),limit:String(limit),sort,search});if(!cancelled){setRows(res.data??[]);setPages(res.pagination?.totalPages??0);}}catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Arxiv yuklanmadi');}finally{if(!cancelled)setBusy(false);}});
  return()=>{cancelled=true;};
 },[organization,role,kind,status,page,limit,sort,search,retry,invalidQuery]);
 if(!role||role==='cashier')return <p>{tr("Arxivni boshqarish uchun rahbar vakolati kerak.")}</p>;
 return <div className="space-y-4"><h1 className="text-2xl font-bold">{tr("Arxiv")}</h1><p>{tr("Arxivlash tarixiy savdo va ombor yozuvlarini saqlaydi. Qarz yoki avans qoldig‘i bor mijozni arxivlab bo‘lmaydi. Kategoriyani arxivlash mahsulotlarini arxivlamaydi.")}</p>
 <ListFilter search={search} sort={sort} label={tr("Arxiv nomi qidirish")} disabled={!!saving} onChange={changeQuery} reset={{kind:'',status:''}} options={[{value:'name_asc',label:tr("Nom: A–Z")},{value:'name_desc',label:tr("Nom: Z–A")}]}><Select label={tr("Arxiv turi")} value={kind} disabled={!!saving} options={[{value:'products',label:tr("Mahsulotlar")},{value:'customers',label:tr("Mijozlar")},{value:'categories',label:tr("Kategoriyalar")}]} onChange={e=>changeQuery({kind:e.target.value,page:'1'})}/><Select label={tr("Holat")} value={status} disabled={!!saving} options={[{value:'archived',label:tr("Arxivlangan")},{value:'active',label:tr("Faol")},{value:'all',label:tr("Barchasi")}]} onChange={e=>changeQuery({status:e.target.value,page:'1'})}/></ListFilter>
 {error&&<p role="alert">{error}</p>}
 <Card>{invalidQuery?<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>:error?<p>{tr("Arxiv yuklanmadi; qayta yuklang.")}</p>:busy?<p>{tr("Yuklanmoqda...")}</p>:<><DataTable className="text-sm"><thead><tr><th>{tr("Nomi")}</th><th>{tr("Holat")}</th><th>{tr("Amal")}</th></tr></thead><tbody>{rows.map(row=><tr className="border-t" key={row.id}><td className="p-2">{row.name??row.fullName}</td><td>{row.isActive?tr("Faol"):tr("Arxivlangan")}</td><td><Button disabled={!!saving} onClick={async()=>{setSaving(row.id);setError('');try{await api.archive.setActive(kind,row.id,!row.isActive);setRetry(x=>x+1);}catch(error){setError(error instanceof Error?error.message:'Amal bajarilmadi');}finally{setSaving('');}}}>{row.isActive?tr("Arxivlash"):tr("Tiklash")}</Button></td></tr>)}</tbody></DataTable>{!rows.length&&<p>{tr("Yozuv topilmadi.")}</p>}</>}
 <Pagination page={page} pages={pages} busy={busy&&!invalidQuery||!!saving} blocked={invalidQuery||!!error} onPage={value=>changeQuery({page:String(value)})} retry={()=>setRetry(x=>x+1)}/>{!invalidQuery&&page>Math.max(1,pages)&&<Button onClick={()=>changeQuery({page:'1'})}>{tr("Birinchi sahifaga qaytish")}</Button>}</Card></div>;
}
