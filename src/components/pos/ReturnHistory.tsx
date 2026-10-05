'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { SaleReturnHistory } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
const labels:Record<string,string>={sellable:'Sotiladigan qoldiqqa qaytarilgan',damaged:'Brak — sotiladigan qoldiqqa qo‘shilmagan',write_off:'Hisobdan chiqarilgan'};
export default function ReturnHistory({saleId,timezone,version}:{saleId:string;timezone:string;version:number}){
 const [page,setPage]=useState(1),[rows,setRows]=useState<SaleReturnHistory[]>([]),[pages,setPages]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let cancelled=false;
  void Promise.resolve().then(async()=>{
   if(cancelled)return;
   setBusy(true);setError('');
   try{const response=await api.sales.returnHistory(saleId,page);if(!cancelled){setRows(response.data??[]);setPages(response.pagination?.totalPages??0);}}
   catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Tarix yuklanmadi');}
   finally{if(!cancelled)setBusy(false);}
  });
  return()=>{cancelled=true;};
 },[saleId,page,version,retry]);
 return <Card title="Qaytarishlar tarixi">
  <p className="text-xs text-slate-500 mb-3">Qiymat qaytarilgan tovar summasi; uning hammasi naqd refund degani emas.</p>
  {busy?<p>Yuklanmoqda...</p>:error?<div role="alert">{error} <Button onClick={()=>setRetry(value=>value+1)}>Qayta yuklash</Button></div>:rows.length===0?<p>Qaytarish qayd etilmagan.</p>:rows.map(row=><article key={row.id} className="border-t py-3 space-y-2">
   <p className="font-semibold">{row.returnReceiptNo} — {formatMoney(row.refundAmount)}</p>
   <p className="text-xs">{new Date(row.returnedAt).toLocaleString('uz-UZ',{timeZone:timezone})} · {row.processor.fullName} · {row.status}</p>
   <p className="text-sm whitespace-pre-wrap">Sabab: {row.reason??'—'}</p>
   <ul className="text-sm space-y-1">{row.items.map(item=><li key={item.id}>{item.saleItem.productName} ({item.saleItem.sku}) — {item.quantity} {item.saleItem.unit??''}; {formatMoney(item.lineTotal)}; {labels[item.disposition]??item.disposition}</li>)}</ul>
  </article>)}
  {pages>1&&<div className="flex gap-3 items-center mt-3"><Button disabled={busy||page<=1} onClick={()=>setPage(value=>value-1)}>Oldingi</Button><span>{page} / {pages}</span><Button disabled={busy||page>=pages} onClick={()=>setPage(value=>value+1)}>Keyingi</Button></div>}
 </Card>;
}
