'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import { Suspense,useEffect,useState } from 'react';
import {useListQuery} from '@/hooks/useListQuery';
import {categoryListSorts} from '@/lib/list-query';
import ListFilter from '@/components/ui/ListFilter';
import DataTable from '@/components/ui/DataTable';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import {useAcknowledgedMutation} from '@/hooks/useAcknowledgedMutation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import type { Category } from '@/types';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import CsvExportButton from '@/components/ui/CsvExportButton';
export default function CategoriesPage(){
 const {t:tr}=useTranslation();
const {organization,user,role}=useAuth();return organization&&user&&role&&role!=='cashier'?<Suspense fallback={<p>{tr("Yuklanmoqda...")}</p>}><Categories key={[organization.id,user.id,role].join(':')}/></Suspense>:<p>{tr("Kategoriyalarni boshqarish uchun rahbar vakolati kerak.")}</p>;}
function Categories(){
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

 const {organization,role}=useAuth();
 const [rows,setRows]=useState<Category[]>([]),[pages,setPages]=useState(0),[retry,setRetry]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const {query,params,changeQuery}=useListQuery(categoryListSorts,'order');
 const page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'order',search=query?.search??'',status=params.get('status')??'active',invalidQuery=!query;
 const [editing,setEditing]=useState<Category|null>(null),[name,setName]=useState(''),[sortOrder,setSortOrder]=useState('0'),[parentId,setParentId]=useState('');
 const mutation=useAcknowledgedMutation(!busy&&!error&&!invalidQuery),saving=mutation.saving;
 const refresh=()=>{setBusy(true);setRetry(x=>x+1);};
 const dirty=name!==(editing?.name??'')||sortOrder!==String(editing?.sortOrder??0)||parentId!==(editing?.parentId??'');
 const confirmDiscard=useUnsavedChanges(dirty,saving);
 useEffect(()=>{if(!organization||!role||role==='cashier'||invalidQuery)return;let cancelled=false;void Promise.resolve().then(async()=>{if(cancelled)return;setBusy(true);setError('');try{const response=await api.categories.list(organization.id,{page:String(page),limit:String(limit),status,search,sort});if(!cancelled){setRows(response.data??[]);setPages(response.pagination?.totalPages??0);}}catch(error){if(!cancelled)setError(displayErrorMessage(error,'Kategoriyalar yuklanmadi'));}finally{if(!cancelled)setBusy(false);}});return()=>{cancelled=true;};},[organization,role,page,limit,status,search,sort,retry,invalidQuery]);
 if(!organization||!role||role==='cashier')return <p>{tr("Kategoriyalarni boshqarish uchun rahbar vakolati kerak.")}</p>;
 const reset=()=>{setEditing(null);setName('');setSortOrder('0');setParentId('');};
 return <div className="max-w-4xl space-y-4"><h1 className="text-2xl font-bold">{tr("Kategoriyalar")}</h1><Link href="/products" className="text-blue-700">{tr("Mahsulotlarga qaytish")}</Link><p>{tr("Tartib kichikdan kattaga. Arxivlash mahsulot va savdo tarixini o‘zgartirmaydi.")}</p>{error&&<p role="alert">{uiMessage(error)}{tr(". Oxirgi ro‘yxat va draft saqlangan.")}</p>}{mutation.error&&<p role="alert">{uiMessage(mutation.error)}</p>}{saving&&<p role="status">{tr("Server tasdig‘i kutilmoqda…")}</p>}{mutation.state==='saved'&&<p role="status">{tr("Kategoriya serverda saqlandi.")}</p>}
 <Card title={editing?tr("Kategoriyani tahrirlash"):tr("Yangi kategoriya")}><form className="flex flex-wrap items-end gap-3" onChangeCapture={mutation.edited} onSubmit={e=>{e.preventDefault();const data={name,sortOrder:Number(sortOrder),parentId:parentId||null};void mutation.execute(()=>editing?api.categories.update(editing.id,data):api.categories.create({organizationId:organization.id,...data}),()=>{reset();refresh();});}}><Input label={tr("Kategoriya nomi")} minLength={2} maxLength={200} value={name} disabled={saving||busy||!!error} required onChange={e=>setName(e.target.value)}/><Input label={tr("Tartib raqami")} type="number" step="1" min={-2147483648} max={2147483647} value={sortOrder} disabled={saving||busy||!!error} required onChange={e=>setSortOrder(e.target.value)}/><Select label={tr("Ota kategoriya")} value={parentId} disabled={saving||busy||!!error} onChange={e=>setParentId(e.target.value)} options={[{value:'',label:tr("Asosiy kategoriya")},...(parentId&&!rows.some(r=>r.id===parentId)?[{value:parentId,label:editing?.parent?.name||tr("Joriy ota kategoriya")}]:[]),...rows.filter(r=>r.id!==editing?.id).map(r=>({value:r.id,label:r.name}))]}/><Button type="submit" disabled={saving||busy||!!error}>{tr("Saqlash")}</Button>{(editing||dirty)&&<Button type="button" disabled={saving||busy||!!error} onClick={()=>{if(confirmDiscard())reset();}}>{tr("Bekor qilish")}</Button>}</form></Card>
 {dirty&&<p role="status">{tr("Saqlanmagan kategoriya o‘zgarishlari bor.")}</p>}
 <ListFilter search={search} sort={sort} label={tr("Kategoriya qidirish")} disabled={saving} onChange={changeQuery} reset={{status:''}}
   options={[{value:'order',label:tr("Tartib raqami bo‘yicha")},{value:'name_asc',label:tr("Nom: A–Z")},{value:'name_desc',label:tr("Nom: Z–A")}]}>
   <Select label={tr("Kategoriya holati")} value={status} disabled={saving} options={[{value:'active',label:tr("Faol")},{value:'archived',label:tr("Arxivlangan")},{value:'all',label:tr("Barchasi")}]} onChange={e=>changeQuery({status:e.target.value,page:'1'})}/>
 </ListFilter>
 <CsvExportButton path="/categories" params={{organizationId:organization.id,status,search,sort}}/>
 <Card>{invalidQuery?<p role="alert">{tr("URL dagi filtr yoki sahifa noto‘g‘ri. Filtrlarni tozalang.")}</p>:error?<p>{tr("Ro‘yxat yuklanmadi; qayta yuklang.")}</p>:busy?<p>{tr("Yuklanmoqda...")}</p>:<><DataTable className="text-sm"><thead><tr><th>{tr("Nomi")}</th><th>{tr("Tartib")}</th><th>{tr("Holat")}</th><th>{tr("Amallar")}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t"><td className="p-2">{row.name}<p className="text-xs">{tr("Ota:")}{' '}{row.parent?.name||tr("Asosiy")}</p></td><td>{row.sortOrder}</td><td>{row.isActive?tr("Faol"):tr("Arxivlangan")}</td><td><div className="flex gap-2"><Button disabled={saving||busy||!!error} onClick={()=>{if(!confirmDiscard())return;setEditing(row);setName(row.name);setSortOrder(String(row.sortOrder));setParentId(row.parentId??'');}}>{tr("Tahrirlash")}</Button><Button disabled={saving||busy||!!error} onClick={()=>{if(editing?.id===row.id&&!confirmDiscard())return;void mutation.execute(()=>api.categories.update(row.id,{isActive:!row.isActive}),()=>{if(editing?.id===row.id)reset();refresh();});}}>{row.isActive?tr("Arxivlash"):tr("Tiklash")}</Button></div></td></tr>)}</tbody></DataTable>{!rows.length&&<p>{tr("Kategoriya topilmadi.")}</p>}</>}<Pagination page={page} pages={pages} busy={busy||saving} blocked={invalidQuery||!!error} onPage={value=>changeQuery({page:String(value)})} retry={refresh}/>{!invalidQuery&&page>Math.max(1,pages)&&<Button onClick={()=>changeQuery({page:'1'})}>{tr("Birinchi sahifaga qaytish")}</Button>}</Card></div>;
}
