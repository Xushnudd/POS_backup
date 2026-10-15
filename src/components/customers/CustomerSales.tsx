'use client';

import {useTranslation} from '@/context/LocaleContext';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {useListQuery} from '@/hooks/useListQuery';
import ListFilter from '@/components/ui/ListFilter';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import type { Sale } from '@/types';
import { useAuth } from '@/context/AuthContext';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
const sorts=['newest','oldest','amount_asc','amount_desc'] as const;
export function CustomerSales({customerId,version=0}:{customerId:string;version?:number}) {
 const {formatMoney}=useTranslation();

 const {t:tr}=useTranslation();

 const {organization}=useAuth();
 const {query,changeQuery}=useListQuery(sorts,'newest','customer_sales_');
 const page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'newest',search=query?.search??'',invalidQuery=!query;
 const [sales,setSales]=useState<Sale[]>([]),[pages,setPages]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{
  if(!organization?.id||invalidQuery)return;
  let cancelled=false;
  void Promise.resolve().then(async()=>{
   if(cancelled)return;
   setLoading(true);setError('');setSales([]);
   try {
    const response=await api.sales.list({organizationId:organization.id,customerId,page,limit,sort,search});
    if(!cancelled){setSales(response.data??[]);setPages(response.pagination?.totalPages??0);}
   }catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Savdolar yuklanmadi');}
   finally{if(!cancelled)setLoading(false);}
  });
  return ()=>{cancelled=true;};
 },[organization?.id,customerId,page,limit,sort,search,invalidQuery,version,reload]);
 return <Card className="space-y-3"><h2 className="font-bold">{tr("Mijoz savdolari va qaytarishlari")}</h2>
  <p className="text-xs text-gray-600">{tr("Naqd va nasiya savdolari. Qaytarish summasi qaytarilgan tovar qiymati; uning hammasi naqd refund bo‘lmasligi mumkin. Faqat vakolatingizdagi savdolar ko‘rsatiladi.")}</p>
  <ListFilter search={search} sort={sort} label={tr("Mijozning cheki qidirish")} onChange={changeQuery} options={[{value:'newest',label:tr("Yangi → eski")},{value:'oldest',label:tr("Eski → yangi")},{value:'amount_asc',label:tr("Summa: o‘sish")},{value:'amount_desc',label:tr("Summa: kamayish")}]}/>{invalidQuery&&<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>}
  {loading&&!invalidQuery&&<p role="status">{tr("Savdolar yuklanmoqda...")}</p>}
  {error&&<div role="alert"><p>{error}</p><Button onClick={()=>setReload(v=>v+1)}>{tr("Savdolarni qayta yuklash")}</Button></div>}
  {!loading&&!error&&!invalidQuery&&!sales.length&&<p>{tr("Mijozga bog‘langan savdo yo‘q.")}</p>}
  <div className="overflow-auto"><DataTable className="w-full text-xs"><thead><tr><th>{tr("Chek")}</th><th>{tr("Sana")}</th><th>{tr("Holat")}</th><th>{tr("Summa")}</th><th>{tr("To‘lovlar")}</th><th>{tr("Qaytarishlar")}</th></tr></thead><tbody>{sales.map(sale=><tr key={sale.id} className="border-t"><td className="p-2"><Link href={`/sales/${sale.id}`} className="text-blue-700 underline">{sale.receiptNo}</Link></td><td>{new Date(sale.createdAt).toLocaleString('uz-UZ',{timeZone:organization?.timezone})}</td><td>{sale.status}</td><td>{formatMoney(sale.totalAmount)}</td><td>{sale.payments?.map(payment=><div key={payment.id}>{payment.paymentType} ({payment.direction}): {formatMoney(payment.amount)}</div>)}</td><td>{sale.saleReturns?.map(item=><div key={item.id}>{item.returnReceiptNo}: {formatMoney(item.refundAmount)}</div>)}</td></tr>)}</tbody></DataTable></div>
  <Pagination page={page} pages={pages} busy={loading&&!invalidQuery} blocked={invalidQuery||!!error} onPage={value=>changeQuery({page:String(value)})} retry={()=>setReload(value=>value+1)}/>

 </Card>;
}
