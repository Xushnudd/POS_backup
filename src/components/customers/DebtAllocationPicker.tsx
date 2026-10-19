'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { DebtAllocationTarget } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type Allocation={saleId:string|null;debtOriginId?:string;amount:string};
const targetKey=(item:{saleId:string|null;debtOriginId?:string|null})=>item.saleId??item.debtOriginId??'general';
export function DebtAllocationPicker({customerId,disabled,value,onChange}:{customerId:string;disabled:boolean;value:Allocation[];onChange:(value:Allocation[])=>void}) {
 const {message:uiMessage}=useTranslation();

 const {formatMoney}=useTranslation();

 const {t:tr}=useTranslation();

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
   }catch(error){if(!cancelled)setError(displayErrorMessage(error,'Qarzlar yuklanmadi'));}
   finally{if(!cancelled)setLoading(false);}
  });
  return ()=>{cancelled=true;};
 },[customerId,page,reload]);
 return <div className="space-y-3">
  <p className="text-xs text-gray-600">{tr("Tanlangan qarzlarga summalarni kiriting. Ularning jami to‘lov summasiga teng bo‘lsin. Boshqa sahifadagi tanlovlar ham saqlanadi. Boshlang‘ich hujjatlar alohida tanlanadi. Eski bog‘lanmagan umumiy qarz hujjatlarga taxminan ajratilmaydi.")}</p>
  {loading&&<p>{tr("Qarzlar yuklanmoqda...")}</p>}
  {error&&<div role="alert"><p>{uiMessage(error)}</p><Button type="button" disabled={disabled} onClick={()=>setReload(v=>v+1)}>{tr("Qarzlarni qayta yuklash")}</Button></div>}
  {!loading&&!error&&!targets.length&&<p>{tr("Bu sahifada ochiq qarz yo‘q.")}</p>}
  {targets.map(target=>{
   const label=target.saleId?tr("Chek:")+" "+(target.receiptNo??target.saleId):target.debtOriginId?tr("Boshlang‘ich hujjat:")+" "+target.debtOriginId:tr("Eski umumiy qarz (taqsimot noma’lum)");
   return <Input key={targetKey(target)} label={label+" "+tr("— ajratiladigan summa")} inputMode="decimal" disabled={disabled} value={value.find(item=>targetKey(item)===targetKey(target))?.amount??''} onChange={event=>{
    const next=value.filter(item=>targetKey(item)!==targetKey(target));
    if(event.target.value.trim())next.push({saleId:target.saleId,...(target.debtOriginId?{debtOriginId:target.debtOriginId}:{}),amount:event.target.value});
    onChange(next);
   }} helperText={tr("Ochiq qoldiq:")+" "+formatMoney(target.balance)}/>;
  })}
  <p className="text-xs">{tr("Tanlangan qarzlar:")}{' '}{value.length}</p>
  <div className="flex gap-2"><Button type="button" variant="outline" disabled={disabled||loading||page<=1} onClick={()=>setPage(v=>v-1)}>{tr("Oldingi qarzlar")}</Button><span>{page}</span><Button type="button" variant="outline" disabled={disabled||loading||!hasMore} onClick={()=>setPage(v=>v+1)}>{tr("Keyingi qarzlar")}</Button></div>
 </div>;
}
