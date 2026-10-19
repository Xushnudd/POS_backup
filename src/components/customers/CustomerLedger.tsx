'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {localizeOwnedLabels} from '@/i18n/messages';

import {useTranslation} from '@/context/LocaleContext';

import { useCallback, useEffect, useRef, useState } from 'react';
import { deviceId, pendingOperations, enqueue, acknowledge } from '@/lib/offline';
import {useReadPage} from '@/hooks/useReadPage';
import ReadQueryNotice from '@/components/ui/ReadQueryNotice';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import { fixed } from '@/lib/money';
import { api, ApiError } from '@/lib/api';
import type { CustomerDebtDocumentInput, CustomerStatement } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { dateBoundary } from '@/server/reports/dates';

import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
const names:Record<string,string>={advance_allocation:'Avansdan qarzni yopish',sale:'Nasiya savdo',collection:'Qarz undirish',return:'Qaytarish qarz tuzatishi',opening_debt:'Boshlang‘ich qarz',debt_adjustment:'Qarz tuzatishi',write_off:'Qarzni hisobdan chiqarish',write_off_reversal:'Qaytarishdagi write-off tuzatishi'};
const namesSource=names;
export function CustomerLedger({customerId,onChanged,version=0}:{customerId:string;onChanged:()=>Promise<void>;version?:number}){
 const {formatDate}=useTranslation();

 const {message:uiMessage}=useTranslation();

 const {formatMoney}=useTranslation();

 const {locale:mapLocale}=useTranslation();

 const names=localizeOwnedLabels(namesSource,mapLocale);

 const {t:tr}=useTranslation();

 const {organization,user}=useAuth(),{notifyError,notifySuccess}=useNotification();
 const {page,setPage,invalid,reset,params,changeQuery}=useReadPage('ledger_');
 const from=params.get('ledger_from')??'',to=params.get('ledger_to')??'';
 const [statement,setStatement]=useState<CustomerStatement|null>(null),[readBusy,setReadBusy]=useState(true),[readError,setReadError]=useState('');
 const readSequence=useRef({value:0});
 const [kind,setKind]=useState<CustomerDebtDocumentInput['kind']>('opening'),[amount,setAmount]=useState(''),[reason,setReason]=useState(''),[saleId,setSaleId]=useState('');
 const [debtOriginId,setDebtOriginId]=useState('');
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
     attempt.current=payload;setKind(payload.kind);setAmount(String(payload.amount));setReason(payload.reason);setSaleId(payload.saleId??'');setDebtOriginId(payload.debtOriginId??'');setEffective(date(payload.effectiveAt));setDue(date(payload.dueAt));setUnknown(true);
    }
    if(!cancelled)setLocalReady(true);
   }catch(error){if(!cancelled)setLocalError(displayErrorMessage(error,'Lokal hujjatlar yuklanmadi'));}
  });
  return ()=>{cancelled=true;};
 },[organization?.id,organization?.timezone,user?.id,customerId,recovery]);

 const refresh=useCallback(async()=>{if(invalid)return;const request=++readSequence.current.value;setReadBusy(true);setReadError('');try{const response=await api.customers.statement(customerId,{page,limit:20,from:from||undefined,to:to||undefined});if(request===readSequence.current.value)setStatement(response.data??null);}catch(error){if(request===readSequence.current.value){const message=displayErrorMessage(error,'Ko‘chirma yuklanmadi');setReadError(message);notifyError(message);}}finally{if(request===readSequence.current.value)setReadBusy(false)}},[customerId,page,from,to,notifyError,invalid]);
 useEffect(()=>{const requests=readSequence.current;let live=true;void Promise.resolve().then(()=>{if(live)return refresh()});return()=>{live=false;requests.value++}},[refresh,version]);
 const [exporting,setExporting]=useState(false);
 const exportCsv=async(format:'csv'|'commercial-csv'|'html'='csv')=>{
  setExporting(true);
  try{
   const response=await api.customers.exportStatement(customerId,{format,from:from||undefined,to:to||undefined});
   if(!response.data)throw new Error('Eksport natijasi kelmadi');
   const url=URL.createObjectURL(new Blob([response.data.content],{type:format==='html'?'text/html;charset=utf-8':'text/csv;charset=utf-8'}));
   const link=document.createElement('a');link.href=url;link.download=response.data.filename;document.body.append(link);link.click();link.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){notifyError(displayErrorMessage(error,'Eksport bajarilmadi'));}
  finally{setExporting(false);}
 };
 const post=async()=>{
  if(!localReady||!organization?.id||!user?.id||busy)return;
  const wasRetry=!!attempt.current;
  if(!attempt.current){
   if(!/^\d+(\.\d{1,2})?$/.test(amount.trim())||fixed(amount.trim())<=BigInt(0)||reason.trim().length<3){notifyError('Summa va kamida 3 belgili sabab kiriting');return;}
   try{
    const zone=organization?.timezone??'Asia/Tashkent';
    attempt.current={operationId:crypto.randomUUID(),kind,amount:amount.trim(),reason:reason.trim(),...(kind==='write_off'&&saleId.trim()?{saleId:saleId.trim()}:{}),...(['decrease','write_off'].includes(kind)&&!saleId&&debtOriginId?{debtOriginId}:{}),...(kind==='opening'&&effective?{effectiveAt:dateBoundary(effective,zone).toISOString()}:{}),...(kind==='opening'&&due?{dueAt:new Date(dateBoundary(due,zone,true).getTime()-1).toISOString()}: {})};
   }catch(error){notifyError(displayErrorMessage(error,'Sana noto‘g‘ri'));return;}
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
   if(!wasRetry&&attempt.current&&error instanceof ApiError&&['VALIDATION_ERROR','INVALID_DOCUMENT_DATE','DEBT_REDUCTION_EXCEEDED','CUSTOMER_NOT_FOUND','SALE_NOT_FOUND','DEBT_TARGET_REQUIRED'].includes(error.code??'')){
    try{await acknowledge(attempt.current.operationId,'rejected',undefined,error.code);attempt.current=null;setUnknown(false);}catch{notifyError('Lokal hujjat holati saqlanmadi; asl kalitni qayta tekshiring');}
   }
   notifyError(displayErrorMessage(error,'Natija noaniq; shu amalni qayta tekshiring'));
  }
  finally{setBusy(false);}
 };
 return <Card className="space-y-4">
  <h2 className="font-bold">{tr("Mijoz qarz ko‘chirmasi")}</h2>
  <Button variant="outline" onClick={()=>exportCsv()} disabled={exporting||readBusy||!!readError||invalid}>{tr("Qarz ko‘chirmasini CSV yuklash")}</Button>
  <Button variant="outline" onClick={()=>exportCsv('commercial-csv')} disabled={exporting||readBusy||!!readError||invalid}>{tr("To‘liq mijoz ko‘chirmasini CSV yuklash")}</Button>
  <Button variant="outline" onClick={()=>exportCsv('html')} disabled={exporting||readBusy||!!readError||invalid}>{tr("Qarz ko‘chirmasini chop etish fayli")}</Button>
  <div className="flex gap-3"><Input type="date" label={tr("Davr boshlanishi")} value={from} onChange={event=>{changeQuery({from:event.target.value,page:'1'});}}/><Input type="date" label={tr("Davr oxiri")} value={to} onChange={event=>{changeQuery({to:event.target.value,page:'1'});}}/></div>
  <ReadQueryNotice invalid={invalid} reset={reset}/>{readBusy&&!invalid&&<p role="status">{tr("Ko‘chirma yuklanmoqda…")}</p>}{readError&&<p role="alert">{uiMessage(readError)}{tr(". Oxirgi ko‘chirma va hujjat drafti saqlanadi.")}</p>}
  {statement&&<><div className="grid grid-cols-2 gap-2 text-sm"><p>{tr("Davr boshidagi qarz:")}{' '}{formatMoney(statement.summary.openingBalance)}</p><p>{tr("Davr oxiridagi qarz:")}{' '}{formatMoney(statement.summary.closingBalance)}</p><p>{tr("Joriy qarz:")}{' '}{formatMoney(statement.summary.currentBalance)}</p><p>{tr("Yozuvlar:")}{' '}{statement.pagination.total}</p></div>
   <div className="grid grid-cols-2 gap-2 text-sm"><p>{tr("Muddati o‘tgan qarz:")}{' '}{formatMoney(statement.aging.overdue)}</p><p>{tr("Muddati kelmagan qarz:")}{' '}{formatMoney(statement.aging.upcoming)}</p><p>{tr("Muddat belgilanmagan qarz:")}{' '}{formatMoney(statement.aging.noDueDate)}</p><p>{tr("Hujjatlarga taqsimlanmagan qarz:")}{' '}{formatMoney(statement.aging.unallocated)}</p></div>
   <p className="text-xs text-gray-600">{tr("Muddat guruhlari joriy qoldiq uchun, tanlangan davr uchun emas. Boshlang‘ich hujjatlarning muddati ham hisoblanadi. Eski bog‘lanmagan to‘lovli umumiy qarz hujjatlarga taxminan taqsimlanmaydi.")}</p>
   {statement.aging.requiresReconciliation&&<p role="alert" className="text-amber-700">{tr("Eski taqsimlanmagan to‘lov yoki manfiy qarz guruhi bor. Muddat bo‘yicha taxminiy qoldiq chiqarilmadi; tarixni yarashtirish kerak.")}</p>}
   <div className="overflow-auto"><DataTable className="text-xs w-full"><thead><tr><th>{tr("Sana")}</th><th>{tr("Hujjat / chek")}</th><th>{tr("Summa")}</th><th>{tr("Qoldiq")}</th><th>{tr("Muddat / sabab / xodim")}</th></tr></thead><tbody>{statement.entries.map(entry=><tr key={entry.id} className="border-t"><td className="p-2">{formatDate(entry.effectiveAt,true,organization?.timezone)}</td><td>{names[entry.sourceType]??entry.sourceType}<div>{entry.receiptNo??entry.sourceId}</div>{entry.debtOriginId&&<div>{tr("Boshlang‘ich hujjat:")}{' '}{entry.debtOriginId}</div>}</td><td>{formatMoney(entry.amount)}</td><td>{formatMoney(entry.balance)}</td><td>{entry.dueAt?formatDate(entry.dueAt,false,organization?.timezone):tr("Muddat belgilanmagan")}<div>{entry.note}</div><div>{entry.actorName??tr("Eski yozuv: xodim belgilanmagan")}</div></td></tr>)}</tbody></DataTable></div>
   {!readBusy&&!readError&&!invalid&&!statement.entries.length&&<p>{tr("Bu davrda qarz yozuvi yo‘q.")}</p>}</>}
   <Pagination page={page} pages={statement?.pagination.totalPages??0} busy={readBusy&&!invalid} blocked={invalid||!!readError} onPage={setPage} retry={()=>{void refresh()}}/>

  {localError&&<div role="alert"><p>{tr("Lokal qarz hujjatlarini tekshirishda xato:")}{' '}{uiMessage(localError)}{tr(". Yangi hujjat bloklangan.")}</p><Button onClick={()=>setRecovery(value=>value+1)}>{tr("Lokal hujjatlarni qayta tekshirish")}</Button></div>}
  <h3 className="font-bold">{tr("Qarz hujjati")}</h3><p className="text-sm text-gray-600">{tr("Bu amallar naqd yoki bank to‘lovi emas. Eski qarz o‘zgartirilmaydi; yangi tuzatish yozuvi saqlanadi. Savdo qarzini hisobdan chiqarishda ko‘chirmadagi chekni tanlang; boshqa tuzatishlar boshlang‘ich/umumiy qarzga qo‘llanadi.")}</p>
  <Select label={tr("Qarz hujjati turi")} value={kind} onChange={event=>{setKind(event.target.value as CustomerDebtDocumentInput['kind']);setSaleId('');setDebtOriginId('');}} disabled={busy||unknown||!localReady} options={[{value:'opening',label:tr("Boshlang‘ich qarz")},{value:'increase',label:tr("Umumiy qarzni oshirish")},{value:'decrease',label:tr("Umumiy qarzni kamaytirish")},{value:'write_off',label:tr("Qarzni hisobdan chiqarish")}]}/>
  {kind==='write_off'&&<Select label={tr("Hisobdan chiqariladigan qarz")} value={saleId} onChange={event=>setSaleId(event.target.value)} disabled={busy||unknown||!localReady} options={[{value:"",label:tr("Umumiy / boshlang‘ich qarz")},...Array.from(new Map((statement?.entries??[]).filter(entry=>entry.saleId).map(entry=>[entry.saleId!,{value:entry.saleId!,label:tr("Chek:")+" "+(entry.receiptNo??entry.saleId!)}])).values())]}/>}
  {['decrease','write_off'].includes(kind)&&!saleId&&<Select label={tr("Kamaytiriladigan boshlang‘ich hujjat")} value={debtOriginId} onChange={event=>setDebtOriginId(event.target.value)} disabled={busy||unknown||!localReady} options={[{value:'',label:tr("Bitta ochiq hujjat bo‘lsa avtomatik; aks holda tanlang")},...(statement?.entries??[]).filter(entry=>!entry.saleId&&['opening_debt','debt_adjustment'].includes(entry.sourceType)&&Number(entry.amount)>0).map(entry=>({value:entry.id,label:(names[entry.sourceType]??entry.sourceType)+' · '+entry.sourceId+' · '+formatMoney(entry.amount)}))]}/>}
  {kind==='opening'&&<div className="flex gap-3"><Input type="date" label={tr("Boshlang‘ich qarz sanasi")} value={effective} onChange={event=>setEffective(event.target.value)} disabled={busy||unknown||!localReady}/><Input type="date" label={tr("Qarz to‘lash muddati")} value={due} onChange={event=>setDue(event.target.value)} disabled={busy||unknown||!localReady}/></div>}
  <Input label={tr("Qarz hujjati summasi")} inputMode="decimal" value={amount} onChange={event=>setAmount(event.target.value)} disabled={busy||unknown||!localReady}/>
  <Input label={tr("Qarz hujjati sababi")} value={reason} maxLength={2000} onChange={event=>setReason(event.target.value)} disabled={busy||unknown||!localReady}/>
  {unknown&&<p className="text-amber-700">{tr("Javob noaniq. Summa, sabab va amal kaliti saqlangan; shu amalni qayta tekshiring.")}</p>}
  <Button onClick={post} disabled={busy||!localReady}>{unknown?tr("Oldingi qarz hujjatini tekshirish"):tr("Qarz hujjatini saqlash")}</Button>
 </Card>;
}
