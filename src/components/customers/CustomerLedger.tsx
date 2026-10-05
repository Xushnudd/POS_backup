'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { deviceId, pendingOperations, enqueue, acknowledge } from '@/lib/offline';
import { fixed } from '@/lib/money';
import { api, ApiError } from '@/lib/api';
import type { CustomerDebtDocumentInput, CustomerStatement } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { dateBoundary } from '@/server/reports/dates';
import { formatMoney } from '@/lib/format';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
const names:Record<string,string>={sale:'Nasiya savdo',collection:'Qarz undirish',return:'Qaytarish qarz tuzatishi',opening_debt:'Boshlang‘ich qarz',debt_adjustment:'Qarz tuzatishi',write_off:'Qarzni hisobdan chiqarish',write_off_reversal:'Qaytarishdagi write-off tuzatishi'};
export function CustomerLedger({customerId,onChanged,version=0}:{customerId:string;onChanged:()=>Promise<void>;version?:number}){
 const {organization,user}=useAuth(),{notifyError,notifySuccess}=useNotification();
 const [statement,setStatement]=useState<CustomerStatement|null>(null),[page,setPage]=useState(1),[from,setFrom]=useState(''),[to,setTo]=useState('');
 const [kind,setKind]=useState<CustomerDebtDocumentInput['kind']>('opening'),[amount,setAmount]=useState(''),[reason,setReason]=useState(''),[saleId,setSaleId]=useState('');
 const [effective,setEffective]=useState(''),[due,setDue]=useState(''),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false);
 const attempt=useRef<CustomerDebtDocumentInput|null>(null);
 const [localReady,setLocalReady]=useState(false),[localError,setLocalError]=useState(''),[recovery,setRecovery]=useState(0);
 useEffect(()=>{
  if(!organization?.id||!user?.id)return;
  let cancelled=false;
  void Promise.resolve().then(async()=>{
   if(cancelled)return;
   setLocalReady(false);setLocalError('');attempt.current=null;setUnknown(false);
   try{
    const operations=await pendingOperations({organizationId:organization.id,userId:user.id,deviceId:deviceId()});
    const saved=operations.find(operation=>operation.type==='debt.document'&&operation.payload.customerId===customerId);
    if(!cancelled&&saved){
     const {customerId:storedCustomer,...document}=saved.payload;
     if(storedCustomer!==customerId||document.operationId!==saved.id)throw new Error('Saqlangan qarz hujjati mos emas');
     const payload=document as unknown as CustomerDebtDocumentInput;
     const date=(timestamp?:string)=>{
      if(!timestamp)return '';
      const parts=new Intl.DateTimeFormat('en',{timeZone:organization.timezone??'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(timestamp));
      const part=(name:string)=>parts.find(value=>value.type===name)?.value;
      return `${part('year')}-${part('month')}-${part('day')}`;
     };
     attempt.current=payload;setKind(payload.kind);setAmount(String(payload.amount));setReason(payload.reason);setSaleId(payload.saleId??'');setEffective(date(payload.effectiveAt));setDue(date(payload.dueAt));setUnknown(true);
    }
    if(!cancelled)setLocalReady(true);
   }catch(error){if(!cancelled)setLocalError(error instanceof Error?error.message:'Lokal hujjatlar yuklanmadi');}
  });
  return ()=>{cancelled=true;};
 },[organization?.id,organization?.timezone,user?.id,customerId,recovery]);

 const refresh=useCallback(async()=>{try{const response=await api.customers.statement(customerId,{page,from:from||undefined,to:to||undefined});setStatement(response.data??null);}catch(error){notifyError(error instanceof Error?error.message:'Ko‘chirma yuklanmadi');}},[customerId,page,from,to,notifyError]);
 useEffect(()=>{void Promise.resolve().then(refresh);},[refresh,version]);
 const [exporting,setExporting]=useState(false);
 const exportCsv=async(format:'csv'|'commercial-csv'|'html'='csv')=>{
  setExporting(true);
  try{
   const response=await api.customers.exportStatement(customerId,{format,from:from||undefined,to:to||undefined});
   if(!response.data)throw new Error('Eksport natijasi kelmadi');
   const url=URL.createObjectURL(new Blob([response.data.content],{type:format==='html'?'text/html;charset=utf-8':'text/csv;charset=utf-8'}));
   const link=document.createElement('a');link.href=url;link.download=response.data.filename;document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){notifyError(error instanceof Error?error.message:'Eksport bajarilmadi');}
  finally{setExporting(false);}
 };
 const post=async()=>{
  if(!localReady||!organization?.id||!user?.id||busy)return;
  const wasRetry=!!attempt.current;
  if(!attempt.current){
   if(!/^\d+(\.\d{1,2})?$/.test(amount.trim())||fixed(amount.trim())<=BigInt(0)||reason.trim().length<3){notifyError('Summa va kamida 3 belgili sabab kiriting');return;}
   try{
    const zone=organization?.timezone??'Asia/Tashkent';
    attempt.current={operationId:crypto.randomUUID(),kind,amount:amount.trim(),reason:reason.trim(),...(kind==='write_off'&&saleId.trim()?{saleId:saleId.trim()}:{}),...(kind==='opening'&&effective?{effectiveAt:dateBoundary(effective,zone).toISOString()}:{}),...(kind==='opening'&&due?{dueAt:new Date(dateBoundary(due,zone,true).getTime()-1).toISOString()}: {})};
   }catch(error){notifyError(error instanceof Error?error.message:'Sana noto‘g‘ri');return;}
  }
  setBusy(true);
  try{
   await enqueue({id:attempt.current.operationId,scope:{organizationId:organization.id,userId:user.id,deviceId:deviceId()},type:'debt.document',payload:{customerId,...attempt.current},state:'pending',createdAt:new Date().toISOString()});
   const response=await api.customers.postDebtDocument(customerId,attempt.current);
   await acknowledge(attempt.current.operationId,'synced',response.data);
   attempt.current=null;setUnknown(false);setAmount('');setReason('');setRecovery(value=>value+1);
   notifySuccess('Qarz hujjati saqlandi; pul to‘lovi yaratilmagan');await refresh();await onChanged();
  }
  catch(error){
   setUnknown(true);
   if(!wasRetry&&attempt.current&&error instanceof ApiError&&['VALIDATION_ERROR','INVALID_DOCUMENT_DATE','DEBT_REDUCTION_EXCEEDED','CUSTOMER_NOT_FOUND','SALE_NOT_FOUND'].includes(error.code??'')){
    try{await acknowledge(attempt.current.operationId,'rejected',undefined,error.code);attempt.current=null;setUnknown(false);}catch{notifyError('Lokal hujjat holati saqlanmadi; asl kalitni qayta tekshiring');}
   }
   notifyError(error instanceof Error?error.message:'Natija noaniq; shu amalni qayta tekshiring');
  }
  finally{setBusy(false);}
 };
 return <Card className="space-y-4">
  <h2 className="font-bold">Mijoz qarz ko‘chirmasi</h2>
  <Button variant="outline" onClick={()=>exportCsv()} disabled={exporting}>Qarz ko‘chirmasini CSV yuklash</Button>
  <Button variant="outline" onClick={()=>exportCsv('commercial-csv')} disabled={exporting}>To‘liq mijoz ko‘chirmasini CSV yuklash</Button>
  <Button variant="outline" onClick={()=>exportCsv('html')} disabled={exporting}>Qarz ko‘chirmasini chop etish fayli</Button>
  <div className="flex gap-3"><Input type="date" label="Davr boshlanishi" value={from} onChange={event=>{setFrom(event.target.value);setPage(1);}}/><Input type="date" label="Davr oxiri" value={to} onChange={event=>{setTo(event.target.value);setPage(1);}}/></div>
  {statement&&<><div className="grid grid-cols-2 gap-2 text-sm"><p>Davr boshidagi qarz: {formatMoney(statement.summary.openingBalance)}</p><p>Davr oxiridagi qarz: {formatMoney(statement.summary.closingBalance)}</p><p>Joriy qarz: {formatMoney(statement.summary.currentBalance)}</p><p>Yozuvlar: {statement.pagination.total}</p></div>
   <div className="grid grid-cols-2 gap-2 text-sm"><p>Muddati o‘tgan qarz: {formatMoney(statement.aging.overdue)}</p><p>Muddati kelmagan qarz: {formatMoney(statement.aging.upcoming)}</p><p>Muddat belgilanmagan savdo qarzi: {formatMoney(statement.aging.noDueDate)}</p><p>Hujjatlarga taqsimlanmagan qarz: {formatMoney(statement.aging.unallocated)}</p></div>
   <p className="text-xs text-gray-600">Muddat guruhlari joriy qoldiq uchun, tanlangan davr uchun emas. Boshlang‘ich/umumiy qarzlar hujjatlarga aniq ajratilmaguncha muddati o‘tgan deb hisoblanmaydi.</p>
   {statement.aging.requiresReconciliation&&<p role="alert" className="text-amber-700">Eski taqsimlanmagan to‘lov yoki manfiy qarz guruhi bor. Muddat bo‘yicha taxminiy qoldiq chiqarilmadi; tarixni yarashtirish kerak.</p>}
   <div className="overflow-auto"><table className="text-xs w-full"><thead><tr><th>Sana</th><th>Hujjat / chek</th><th>Summa</th><th>Qoldiq</th><th>Muddat / sabab / xodim</th></tr></thead><tbody>{statement.entries.map(entry=><tr key={entry.id} className="border-t"><td className="p-2">{new Date(entry.effectiveAt).toLocaleString('uz-UZ',{timeZone:organization?.timezone})}</td><td>{names[entry.sourceType]??entry.sourceType}<div>{entry.receiptNo??entry.sourceId}</div></td><td>{formatMoney(entry.amount)}</td><td>{formatMoney(entry.balance)}</td><td>{entry.dueAt?new Date(entry.dueAt).toLocaleDateString('uz-UZ',{timeZone:organization?.timezone}):'Muddat belgilanmagan'}<div>{entry.note}</div><div>{entry.actorName??'Eski yozuv: xodim belgilanmagan'}</div></td></tr>)}</tbody></table></div>
   <div className="flex gap-2"><Button variant="outline" disabled={page<=1} onClick={()=>setPage(value=>value-1)}>Oldingi</Button><span>{page} / {Math.max(statement.pagination.totalPages,1)}</span><Button variant="outline" disabled={page>=statement.pagination.totalPages} onClick={()=>setPage(value=>value+1)}>Keyingi</Button></div></>}
  {localError&&<div role="alert"><p>Lokal qarz hujjatlarini tekshirishda xato: {localError}. Yangi hujjat bloklangan.</p><Button onClick={()=>setRecovery(value=>value+1)}>Lokal hujjatlarni qayta tekshirish</Button></div>}
  <h3 className="font-bold">Qarz hujjati</h3><p className="text-sm text-gray-600">Bu amallar naqd yoki bank to‘lovi emas. Eski qarz o‘zgartirilmaydi; yangi tuzatish yozuvi saqlanadi. Savdo qarzini hisobdan chiqarishda ko‘chirmadagi chekni tanlang; boshqa tuzatishlar boshlang‘ich/umumiy qarzga qo‘llanadi.</p>
  <Select label="Qarz hujjati turi" value={kind} onChange={event=>setKind(event.target.value as CustomerDebtDocumentInput['kind'])} disabled={busy||unknown||!localReady} options={[{value:'opening',label:'Boshlang‘ich qarz'},{value:'increase',label:'Umumiy qarzni oshirish'},{value:'decrease',label:'Umumiy qarzni kamaytirish'},{value:'write_off',label:'Qarzni hisobdan chiqarish'}]}/>
  {kind==='write_off'&&<Select label="Hisobdan chiqariladigan qarz" value={saleId} onChange={event=>setSaleId(event.target.value)} disabled={busy||unknown||!localReady} options={[{value:"",label:"Umumiy / boshlang‘ich qarz"},...Array.from(new Map((statement?.entries??[]).filter(entry=>entry.saleId).map(entry=>[entry.saleId!,{value:entry.saleId!,label:"Chek: "+(entry.receiptNo??entry.saleId!)}])).values())]}/>}
  {kind==='opening'&&<div className="flex gap-3"><Input type="date" label="Boshlang‘ich qarz sanasi" value={effective} onChange={event=>setEffective(event.target.value)} disabled={busy||unknown||!localReady}/><Input type="date" label="Qarz to‘lash muddati" value={due} onChange={event=>setDue(event.target.value)} disabled={busy||unknown||!localReady}/></div>}
  <Input label="Qarz hujjati summasi" inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)} disabled={busy||unknown||!localReady}/>
  <Input label="Qarz hujjati sababi" value={reason} maxLength={2000} onChange={event=>setReason(event.target.value)} disabled={busy||unknown||!localReady}/>
  {unknown&&<p className="text-amber-700">Javob noaniq. Summa, sabab va amal kaliti saqlangan; shu amalni qayta tekshiring.</p>}
  <Button onClick={post} disabled={busy||!localReady}>{unknown?'Oldingi qarz hujjatini tekshirish':'Qarz hujjatini saqlash'}</Button>
 </Card>;
}
