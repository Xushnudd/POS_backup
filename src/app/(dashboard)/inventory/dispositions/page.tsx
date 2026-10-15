'use client';




import {useTranslation} from '@/context/LocaleContext';

import {Suspense,useEffect,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {api} from '@/lib/api';
import type {ApiResponse} from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import CsvExportButton from '@/components/ui/CsvExportButton';
import {useListFilters} from '@/hooks/useListFilters';
import {inventoryListSorts} from '@/lib/list-query';
import ListFilter from '@/components/ui/ListFilter';
import DataTable from '@/components/ui/DataTable';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
type Row={id:string;storeId:string;productId:string;returnItemId:string;productName:string;sku:string;unit:string|null;quantity:string;unitCost:string;disposition:string;createdAt:string;location:{id:string;name:string}|null};
type Balance={storeId:string;productId:string;disposition:string;locationId:string|null;_sum:{quantity:string|null}};
export default function DispositionsPage(){
 const {t:tr}=useTranslation();

 const {organization,user,role}=useAuth();
 return !organization||!role||role==='cashier'?<p>{tr("Rahbar vakolati kerak.")}</p>:<Suspense fallback={<p>{tr("Yuklanmoqda...")}</p>}><Journal key={organization.id+':'+user?.id+':'+role} organizationId={organization.id}/></Suspense>;
}
function Journal({organizationId}:{organizationId:string}){
 const {t:tr}=useTranslation();

 const [rows,setRows]=useState<Row[]>([]),[balances,setBalances]=useState<Balance[]>([]),[pages,setPages]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const {query,params,filters,changeQuery}=useListFilters(inventoryListSorts,'newest',['storeId','disposition']);
 const page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'newest',search=query?.search??'',store=params.get('storeId')??'',disposition=params.get('disposition')??'',invalidQuery=!query;
 useEffect(()=>{if(invalidQuery)return;let cancelled=false;void Promise.resolve().then(async()=>{if(cancelled)return;setBusy(true);setError('');try{const response=await api.request<Row[]>(`/inventory/dispositions?${new URLSearchParams({organizationId,...filters,page:String(page),limit:String(limit),sort,search})}`) as ApiResponse<Row[]>&{summary:Balance[]};if(!cancelled){setRows(response.data??[]);setBalances(response.summary??[]);setPages(response.pagination?.totalPages??1);}}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Jurnal yuklanmadi');}finally{if(!cancelled)setBusy(false);}});return()=>{cancelled=true;};},[organizationId,filters,page,limit,sort,search,retry,invalidQuery]);
 return <div className="space-y-4"><h1 className="text-2xl font-bold">{tr("Brak va hisobdan chiqarish")}</h1><p>{tr("Brak har bir filialning alohida joylashuvida saqlanadi. Hisobdan chiqarilgan qaytarmalar saqlash qoldig‘i emas. Ikkalasi ham sotiladigan ombor qoldig‘ini oshirmaydi. Tannarx va mahsulot ma’lumotlari original chekdan olinadi.")}</p><CsvExportButton path="/inventory/dispositions" params={{organizationId,...filters,sort,search}}/><ListFilter key={store} fields={['storeId']} search={search} sort={sort} label={tr("Original mahsulot yoki SKU qidirish")} onChange={changeQuery} reset={{storeId:'',disposition:''}} options={[{value:'newest',label:tr("Eng yangi")},{value:'oldest',label:tr("Eng eski")},{value:'name_asc',label:tr("Nom: A–Z")},{value:'name_desc',label:tr("Nom: Z–A")},{value:'quantity_asc',label:tr("Miqdor: o‘sish")},{value:'quantity_desc',label:tr("Miqdor: kamayish")}]}><Input label={tr("Filial ID")} name="storeId" defaultValue={store} maxLength={36}/><Select label={tr("Yo‘nalish")} value={disposition} onChange={e=>changeQuery({disposition:e.target.value,page:'1'})} options={[{value:'',label:tr("Barchasi")},{value:'damaged',label:tr("Brak joylashuviga")},{value:'write_off',label:tr("Hisobdan chiqarish")}]}/></ListFilter>{invalidQuery&&<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>}{error&&<p role="alert">{error}</p>}<Card><h2>{tr("Sahifadagi mahsulotlar bo‘yicha yig‘ma hisob")}</h2><p>{tr("Har bir ko‘rsatilgan mahsulot/filial juftligi uchun barcha mos qaytarmalar yig‘indisi. Boshqa mahsulotlar keyingi sahifalarda.")}</p>{!busy&&!error&&!invalidQuery&&balances.map(b=><p key={[b.storeId,b.productId,b.disposition].join(':')}>{rows.find(r=>r.storeId===b.storeId&&r.productId===b.productId)?.productName} / {b.storeId}: {b.disposition==='damaged'?tr("Brak qoldig‘i"):tr("Hisobdan chiqarilgan miqdor")} {b._sum.quantity}</p>)}</Card><Card>{invalidQuery||error?<p>{tr("Jurnal yuklanmadi; qayta yuklang.")}</p>:busy?<p>{tr("Yuklanmoqda...")}</p>:<div className="overflow-auto"><DataTable><thead><tr><th>{tr("Original mahsulot")}</th><th>{tr("Filial / yo‘nalish / joy")}</th><th>{tr("Miqdor / tannarx")}</th><th>{tr("Original return item / UTC")}</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t"><td className="p-2">{r.productName}<p>{r.sku}</p></td><td>{r.storeId}<p>{r.disposition==='damaged'?tr("Brak"):tr("Hisobdan chiqarish")}</p><p>{r.location?.name??tr("Saqlanmaydi")}</p></td><td>{r.quantity} {r.unit}<p>{r.unitCost}</p></td><td>{r.returnItemId}<p>{r.createdAt}</p></td></tr>)}</tbody></DataTable>{!rows.length&&<p>{tr("Yozuv topilmadi.")}</p>}</div>}<Pagination page={page} pages={pages} busy={busy&&!invalidQuery} blocked={invalidQuery||!!error} onPage={value=>changeQuery({page:String(value)})} retry={()=>setRetry(n=>n+1)}/>{!invalidQuery&&page>Math.max(1,pages)&&<Button onClick={()=>changeQuery({page:'1'})}>{tr("Birinchi sahifaga qaytish")}</Button>}</Card></div>;
}
