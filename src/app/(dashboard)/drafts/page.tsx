'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {api} from '@/lib/api';
import {useAuth} from '@/context/AuthContext';
import {useListQuery} from '@/hooks/useListQuery';
import {financialListSorts} from '@/lib/list-query';
import type {Sale} from '@/types';
import Button from '@/components/ui/Button';
import ListFilter from '@/components/ui/ListFilter';
import Pagination from '@/components/ui/Pagination';
export default function Drafts(){const {organization,role,user}=useAuth();return organization&&user?<DraftList key={[organization.id,user.id,role].join(':')}/>:null;}
function DraftList(){
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

 const {organization,role,user}=useAuth(),{query,changeQuery}=useListQuery(financialListSorts,'newest');
 const page=query?.page??1,limit=query?.limit??20,search=query?.search??'',sort=query?.sort??'newest',invalid=!query;
 const [rows,setRows]=useState<Sale[]>([]),[pages,setPages]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(true);
 const sequence=useRef({value:0});
 const load=useCallback(async()=>{if(!organization||invalid)return;const request=++sequence.current.value;setBusy(true);setError('');try{const response=await api.sales.list({organizationId:organization.id,status:'draft',page,limit,search,sort});if(request===sequence.current.value){setRows(response.data??[]);setPages(response.pagination?.totalPages??0);}}catch(error){if(request===sequence.current.value)setError(displayErrorMessage(error,'Qoralamalar yuklanmadi'));}finally{if(request===sequence.current.value)setBusy(false);}},[organization,page,limit,search,sort,invalid]);
 useEffect(()=>{const requests=sequence.current;let live=true;void Promise.resolve().then(()=>{if(live)return load()});return()=>{live=false;requests.value++}},[load]);
 return <div className="space-y-4"><h1 className="text-2xl font-bold">{tr("Server qoralamalari")}</h1><p>{tr("Faqat serverga yetgan qoralamalar. Boshqa qurilmadagi faqat lokal savat bu ro‘yxatda yo‘q. O‘z qoralamangizni ayni kassa va faol smenada davom ettiring. Natijasi noma’lum savdoni yangidan yaratmang.")}</p><Link href="/help#device">{tr("Qurilma ishdan chiqsa yordam")}</Link><Button onClick={()=>{void load()}} disabled={busy&&!invalid}>{tr("Yangilash")}</Button>
 <ListFilter search={search} sort={sort} label={tr("Server qoralamasi cheki yoki mijoz qidirish")} onChange={changeQuery} options={[{value:'newest',label:tr("Yangi → eski")},{value:'oldest',label:tr("Eski → yangi")},{value:'amount_asc',label:tr("Summa: o‘sish")},{value:'amount_desc',label:tr("Summa: kamayish")}]}/>
 {invalid?<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>:busy?<p role="status">{tr("Yuklanmoqda…")}</p>:error?<p role="alert">{uiMessage(error)}</p>:<>{!rows.length&&<p>{tr("Serverda qoralama yo‘q.")}</p>}{rows.map(row=><article key={row.id} className="p-4 bg-white border rounded space-y-2"><h2 className="font-bold">{row.receiptNo}</h2><p>{row.totalAmount} {tr("so‘m ·")}{' '}{row.createdAt} · {row.items?.length} {tr("qator")}</p>{row.cashierId===user?.id&&<Link className="underline text-blue-800" href={'/pos?draft='+row.id}>{tr("Qoralamani ochish")}</Link>}{role!=='cashier'&&<Button variant="danger" disabled={busy||!!error} onClick={async()=>{if(!confirm("Faqat ushbu qoralamani bekor qilasizmi?"))return;setBusy(true);try{await api.sales.void(row.id);await load();}catch(error){setError(displayErrorMessage(error,'Bekor qilinmadi'));setBusy(false);}}}>{tr("Qoralamani bekor qilish")}</Button>}</article>)}</>}
 <Pagination page={page} pages={pages} busy={busy&&!invalid} blocked={invalid||!!error} onPage={value=>changeQuery({page:String(value)})} retry={()=>{void load()}}/>
 </div>
}
