'use client';
import { Suspense,useEffect,useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import CsvExportButton from '@/components/ui/CsvExportButton';
import {useListFilters} from '@/hooks/useListFilters';
import {journalListSorts} from '@/lib/list-query';
import ListFilter from '@/components/ui/ListFilter';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
type Row={id:string;occurredAt:string;movementType:string;quantityDelta:string;unitCost:string;sourceType:string;sourceId:string;note?:string;product:{name:string;unit:string};store:{name:string};creator?:{fullName:string}};
export default function MovementsPage(){const {organization,user,role}=useAuth();return <Suspense fallback={<p>Yuklanmoqda...</p>}><Movements key={[organization?.id,user?.id,role].join(':')}/></Suspense>;}
function Movements(){
 const {organization,role}=useAuth();
 const [rows,setRows]=useState<Row[]>([]),[pages,setPages]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const {query,params,filters,changeQuery}=useListFilters(journalListSorts,'newest',['from','to','storeId','productId','movementType','sourceType','sourceId']);
 const page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'newest',search=query?.search??'',invalidQuery=!query;
 const [draft,setDraft]=useState({from:params.get('from')??'',to:params.get('to')??'',storeId:params.get('storeId')??'',productId:params.get('productId')??'',movementType:params.get('movementType')??'',sourceType:params.get('sourceType')??'',sourceId:params.get('sourceId')??''});
 const filterKey=JSON.stringify(filters);
 useEffect(()=>{let live=true;void Promise.resolve().then(()=>{if(live)setDraft({from:'',to:'',storeId:'',productId:'',movementType:'',sourceType:'',sourceId:'',...JSON.parse(filterKey)});});return()=>{live=false;};},[filterKey]);
 useEffect(()=>{if(!organization||!role||role==='cashier'||invalidQuery)return;let cancelled=false;void Promise.resolve().then(async()=>{if(cancelled)return;setBusy(true);setError('');try{const res=await api.inventory.movements({organizationId:organization.id,...filters,page,limit,sort,search});if(!cancelled){setRows(res.data as unknown as Row[]??[]);setPages(res.pagination?.totalPages??0);}}catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Jurnal yuklanmadi');}finally{if(!cancelled)setBusy(false);}});return()=>{cancelled=true;};},[organization,role,filters,page,limit,sort,search,retry,invalidQuery]);
 if(!organization||!role||role==='cashier')return <p>Ombor jurnalini ko‘rish uchun rahbar vakolati kerak.</p>;
 return <div className="space-y-4"><h1 className="text-2xl font-bold">Ombor harakati jurnali</h1><p className="text-sm">Musbat miqdor kirim, manfiy miqdor chiqim. Sanalar tashkilot vaqt zonasida; mahsulot nomi va birligi joriy katalogdan ko‘rsatiladi.</p><CsvExportButton path="/inventory/movements" params={{organizationId:organization.id,...filters,search,sort}}/>
 <ListFilter search={search} sort={sort} label="Mahsulot, SKU yoki jurnal izohi qidirish" onChange={changeQuery} reset={{from:'',to:'',storeId:'',productId:'',movementType:'',sourceType:'',sourceId:''}} options={[{value:'newest',label:'Eng yangi'},{value:'oldest',label:'Eng eski'}]}/>
 <Card><form className="grid sm:grid-cols-2 gap-3" onSubmit={e=>{e.preventDefault();changeQuery({...Object.fromEntries(Object.entries(draft).map(([k,v])=>[k,v.trim()])),page:'1'});}}>{(Object.keys(draft) as (keyof typeof draft)[]).map(key=><Input key={key} label={{from:'Davr boshi',to:'Davr oxiri',storeId:'Filial ID',productId:'Mahsulot ID',movementType:'Harakat turi',sourceType:'Manba turi',sourceId:'Manba ID'}[key]} type={key==='from'||key==='to'?'date':'text'} maxLength={100} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/>)}<Button type="submit" disabled={busy}>Filtrlash</Button></form></Card>
 {error&&<p role="alert">{error}</p>}
 <Card>{invalidQuery?<p role="alert">URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.</p>:error?<p>Jurnal yuklanmadi; qayta yuklang.</p>:busy?<p>Yuklanmoqda...</p>:<div className="overflow-auto"><DataTable className="text-sm"><thead><tr><th>Sana / filial</th><th>Mahsulot</th><th>Harakat</th><th>Miqdor</th><th>Birlik tannarxi</th><th>Manba / xodim</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t"><td className="p-2">{new Date(row.occurredAt).toLocaleString('uz-UZ',{timeZone:organization.timezone})}<p>{row.store.name}</p></td><td>{row.product.name}<p>{row.product.unit}</p></td><td>{row.movementType}</td><td>{row.quantityDelta}</td><td>{row.unitCost}</td><td>{row.sourceType}<p className="text-xs break-all">{row.sourceId}</p><p>{row.creator?.fullName}</p><p>{row.note}</p></td></tr>)}</tbody></DataTable>{!rows.length&&<p>Harakat topilmadi.</p>}</div>}
 <Pagination page={page} pages={pages} busy={busy&&!invalidQuery} blocked={invalidQuery||!!error} onPage={value=>changeQuery({page:String(value)})} retry={()=>setRetry(x=>x+1)}/>{!invalidQuery&&page>Math.max(1,pages)&&<Button onClick={()=>changeQuery({page:'1'})}>Birinchi sahifaga qaytish</Button>}</Card></div>;
}
