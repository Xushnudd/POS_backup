'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { DebtAllocationTarget } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatMoney } from '@/lib/format';

type Allocation={saleId:string|null;amount:string};
export function DebtAllocationPicker({customerId,disabled,value,onChange}:{customerId:string;disabled:boolean;value:Allocation[];onChange:(value:Allocation[])=>void}) {
 const [page,setPage]=useState(1),[targets,setTargets]=useState<DebtAllocationTarget[]>([]);
 const [hasMore,setHasMore]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{
  let cancelled=false;
  void Promise.resolve().then(async()=>{
   if(cancelled)return;
   setLoading(true);setError('');setTargets([]);
   try {
    const response=await api.customers.getDebt(customerId,page);
    if(!cancelled){setTargets(response.data?.allocationTargets?.items??[]);setHasMore(response.data?.allocationTargets?.hasMore??false);}
   }catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Qarzlar yuklanmadi');}
   finally{if(!cancelled)setLoading(false);}
  });
  return ()=>{cancelled=true;};
 },[customerId,page,reload]);
 return <div className="space-y-3">
  <p className="text-xs text-gray-600">Tanlangan qarzlarga summalarni kiriting. Ularning jami to‘lov summasiga teng bo‘lsin. Boshqa sahifadagi tanlovlar ham saqlanadi. Umumiy qarz alohida boshlang‘ich hujjatga taqsimot emas.</p>
  {loading&&<p>Qarzlar yuklanmoqda...</p>}
  {error&&<div role="alert"><p>{error}</p><Button type="button" disabled={disabled} onClick={()=>setReload(v=>v+1)}>Qarzlarni qayta yuklash</Button></div>}
  {!loading&&!error&&!targets.length&&<p>Bu sahifada ochiq qarz yo‘q.</p>}
  {targets.map(target=>{
   const label=target.saleId?'Chek: '+(target.receiptNo??target.saleId):'Umumiy / boshlang‘ich qarz';
   return <Input key={target.saleId??'general'} label={label+' — ajratiladigan summa'} inputMode="decimal" disabled={disabled} value={value.find(item=>item.saleId===target.saleId)?.amount??''} onChange={event=>{
    const next=value.filter(item=>item.saleId!==target.saleId);
    if(event.target.value.trim())next.push({saleId:target.saleId,amount:event.target.value});
    onChange(next);
   }} helperText={'Ochiq qoldiq: '+formatMoney(target.balance)}/>;
  })}
  <p className="text-xs">Tanlangan qarzlar: {value.length}</p>
  <div className="flex gap-2"><Button type="button" variant="outline" disabled={disabled||loading||page<=1} onClick={()=>setPage(v=>v-1)}>Oldingi qarzlar</Button><span>{page}</span><Button type="button" variant="outline" disabled={disabled||loading||!hasMore} onClick={()=>setPage(v=>v+1)}>Keyingi qarzlar</Button></div>
 </div>;
}
