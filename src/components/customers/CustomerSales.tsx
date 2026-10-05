'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Sale } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/lib/format';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
export function CustomerSales({customerId,version=0}:{customerId:string;version?:number}) {
 const {organization}=useAuth();
 const [sales,setSales]=useState<Sale[]>([]),[page,setPage]=useState(1),[pages,setPages]=useState(0),[loading,setLoading]=useState(false),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{
  if(!organization?.id)return;
  let cancelled=false;
  void Promise.resolve().then(async()=>{
   if(cancelled)return;
   setLoading(true);setError('');setSales([]);
   try {
    const response=await api.sales.list({organizationId:organization.id,customerId,page,limit:20});
    if(!cancelled){setSales(response.data??[]);setPages(response.pagination?.totalPages??0);}
   }catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Savdolar yuklanmadi');}
   finally{if(!cancelled)setLoading(false);}
  });
  return ()=>{cancelled=true;};
 },[organization?.id,customerId,page,version,reload]);
 return <Card className="space-y-3"><h2 className="font-bold">Mijoz savdolari va qaytarishlari</h2>
  <p className="text-xs text-gray-600">Naqd va nasiya savdolari. Qaytarish summasi qaytarilgan tovar qiymati; uning hammasi naqd refund bo‘lmasligi mumkin. Faqat vakolatingizdagi savdolar ko‘rsatiladi.</p>
  {loading&&<p>Savdolar yuklanmoqda...</p>}
  {error&&<div role="alert"><p>{error}</p><Button onClick={()=>setReload(v=>v+1)}>Savdolarni qayta yuklash</Button></div>}
  {!loading&&!error&&!sales.length&&<p>Mijozga bog‘langan savdo yo‘q.</p>}
  <div className="overflow-auto"><table className="w-full text-xs"><thead><tr><th>Chek</th><th>Sana</th><th>Holat</th><th>Summa</th><th>To‘lovlar</th><th>Qaytarishlar</th></tr></thead><tbody>{sales.map(sale=><tr key={sale.id} className="border-t"><td className="p-2"><Link href={`/sales/${sale.id}`} className="text-blue-700 underline">{sale.receiptNo}</Link></td><td>{new Date(sale.createdAt).toLocaleString('uz-UZ',{timeZone:organization?.timezone})}</td><td>{sale.status}</td><td>{formatMoney(sale.totalAmount)}</td><td>{sale.payments?.map(payment=><div key={payment.id}>{payment.paymentType} ({payment.direction}): {formatMoney(payment.amount)}</div>)}</td><td>{sale.saleReturns?.map(item=><div key={item.id}>{item.returnReceiptNo}: {formatMoney(item.refundAmount)}</div>)}</td></tr>)}</tbody></table></div>
  <div className="flex gap-2"><Button variant="outline" disabled={loading||page<=1} onClick={()=>setPage(v=>v-1)}>Oldingi savdolar</Button><span>{page} / {Math.max(pages,1)}</span><Button variant="outline" disabled={loading||page>=pages} onClick={()=>setPage(v=>v+1)}>Keyingi savdolar</Button></div>
 </Card>;
}
