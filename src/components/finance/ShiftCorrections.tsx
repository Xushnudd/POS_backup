'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Shift } from '@/types';
import { api, ApiError } from '@/lib/api';
import { acknowledge, deviceId, enqueue, pendingOperations } from '@/lib/offline';
import { useAuth } from '@/context/AuthContext';
import { formatMoney } from '@/lib/format';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
type InputData=Parameters<typeof api.shifts.correct>[1];
type Entry=NonNullable<Awaited<ReturnType<typeof api.shifts.corrections>>['data']>[number];
export default function ShiftCorrections({shifts,activeShiftId,onChanged}:{shifts:Shift[];activeShiftId?:string;onChanged:()=>Promise<void>}){
 const {organization,user}=useAuth();
 const [original,setOriginal]=useState(''),[amount,setAmount]=useState(''),[reason,setReason]=useState(''),[direction,setDirection]=useState<'cash_in'|'cash_out'>('cash_in');
 const [ready,setReady]=useState(false),[unknown,setUnknown]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[page,setPage]=useState(1),[pages,setPages]=useState(0),[rows,setRows]=useState<Entry[]>([]),[version,setVersion]=useState(0);
 const attempt=useRef<{originalShiftId:string;input:InputData}|null>(null);
 useEffect(()=>{
  let cancelled=false;
  void Promise.resolve().then(async()=>{
   if(!organization||!user)return;
   setReady(false);setError('');attempt.current=null;setUnknown(false);
   try{
    const saved=(await pendingOperations({organizationId:organization.id,userId:user.id,deviceId:deviceId()})).find(op=>op.type==='shift.correct');
    if(cancelled)return;
    if(saved){const {originalShiftId,...input}=saved.payload;attempt.current={originalShiftId:String(originalShiftId),input:input as InputData};setOriginal(String(originalShiftId));setAmount(String(input.amount));setReason(String(input.reason));setDirection(input.direction as 'cash_in'|'cash_out');setUnknown(true);}
    setReady(true);
   }catch(err){if(!cancelled)setError(err instanceof Error?err.message:'Lokal amal o‘qilmadi');}
  });
  return()=>{cancelled=true;};
 },[organization,user]);
 useEffect(()=>{
  let cancelled=false;
  void Promise.resolve().then(async()=>{
   if(!original){setRows([]);setPages(0);return;}
   try{const result=await api.shifts.corrections(original,page);if(!cancelled){setRows(result.data??[]);setPages(result.pagination?.totalPages??0);}}
   catch(err){if(!cancelled){setRows([]);setPages(0);setError(err instanceof Error?err.message:'Tuzatish tarixi yuklanmadi');}}
  });
  return()=>{cancelled=true;};
 },[original,page,version]);
 const submit=useCallback(async()=>{
  if(!organization||!user||!ready||busy)return;
  const wasRetry=!!attempt.current;
  if(!attempt.current){
   if(!activeShiftId||!original){setError('Yopilgan original va ochiq posting smenasini tanlang');return;}
   if(!/^\d+(\.\d{1,2})?$/.test(amount)||reason.trim().length<3){setError('Musbat summa (2 kasr) va kamida 3 belgili sabab kiriting');return;}
   attempt.current={originalShiftId:original,input:{postingShiftId:activeShiftId,direction,amount,reason:reason.trim(),operationId:crypto.randomUUID()}};
  }
  const saved=attempt.current;setBusy(true);setUnknown(true);setError('');
  try{
   await enqueue({id:saved.input.operationId,scope:{organizationId:organization.id,userId:user.id,deviceId:deviceId()},type:'shift.correct',payload:{originalShiftId:saved.originalShiftId,...saved.input},state:'pending',createdAt:new Date().toISOString()});
   const result=await api.shifts.correct(saved.originalShiftId,saved.input);
   await acknowledge(saved.input.operationId,'synced',result.data);attempt.current=null;setUnknown(false);setAmount('');setReason('');setVersion(value=>value+1);await onChanged();
  }catch(err){
   setError(err instanceof Error?err.message:'Natija noma’lum; asl amalni tekshiring');
   if(!wasRetry&&err instanceof ApiError&&['VALIDATION_ERROR','SHIFT_NOT_CLOSED','INVALID_SHIFT','INVALID_RELATION','MANAGER_REQUIRED','NOT_FOUND'].includes(err.code??'')){
    try{await acknowledge(saved.input.operationId,'rejected',undefined,err.code);attempt.current=null;setUnknown(false);}catch{setError('Rad natijasi lokal saqlanmadi; asl amalni tekshiring');}
   }
  }finally{setBusy(false);}
 },[organization,user,ready,busy,activeShiftId,original,amount,reason,direction,onChanged]);
 return <Card title="Yopilgan smena tuzatishlari">
  <p className="text-sm mb-3">Original smena o‘zgarmaydi. Tuzatish shu filialdagi ochiq smenada alohida naqd harakat sifatida yoziladi; savdo daromadi hisoblanmaydi.</p>
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  {unknown&&<p role="status">Asl amal natijasi tekshirilishi kerak; summa va kalit o‘zgartirilmaydi.</p>}
  <div className="grid sm:grid-cols-2 gap-3">
   <label>Original yopilgan smena<select aria-label="Original yopilgan smena" value={original} disabled={busy||unknown||!ready} onChange={e=>{setOriginal(e.target.value);setPage(1);}} className="block w-full border p-2"><option value="">Tanlang</option>{shifts.filter(s=>s.status==='closed').map(s=><option key={s.id} value={s.id}>{s.register?.name} · {s.closedAt} · {s.id.slice(0,8)}</option>)}</select></label>
   <label>Tuzatish yo‘nalishi<select aria-label="Tuzatish yo‘nalishi" value={direction} disabled={busy||unknown||!ready} onChange={e=>setDirection(e.target.value as typeof direction)} className="block border p-2"><option value="cash_in">Naqd qo‘shish</option><option value="cash_out">Naqd ayirish</option></select></label>
   <Input label="Tuzatish summasi" value={amount} onChange={e=>setAmount(e.target.value)} disabled={busy||unknown||!ready}/>
   <Input label="Tuzatish sababi" value={reason} onChange={e=>setReason(e.target.value)} disabled={busy||unknown||!ready}/>
  </div>
  <Button disabled={busy||!ready||(!unknown&&(!activeShiftId||!original))} onClick={submit}>{unknown?'Tuzatish natijasini tekshirish':'Tuzatishni yozish'}</Button>
  <ul className="mt-3 space-y-2">{rows.map(row=><li key={row.id}>{formatMoney(row.amount)} · {row.reason} · {row.creator.fullName} · {row.createdAt}<br/><span className="text-xs">Posting smena: {row.postingShiftId}; hujjat: {row.id}</span></li>)}</ul>
  {pages>1&&<div className="flex gap-3"><Button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Oldingi tuzatishlar</Button><span>{page} / {pages}</span><Button disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Keyingi tuzatishlar</Button></div>}
 </Card>;
}
