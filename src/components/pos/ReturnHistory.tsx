'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {localizeOwnedLabels} from '@/i18n/messages';

import {useTranslation} from '@/context/LocaleContext';

import {useReadPage} from '@/hooks/useReadPage';
import ReadQueryNotice from '@/components/ui/ReadQueryNotice';
import Pagination from '@/components/ui/Pagination';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {returnReceiptHtml} from '@/i18n/return-receipt';
import type {Locale} from '@/i18n/locale';
import type { SaleReturnHistory } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
const labels:Record<string,string>={sellable:'Sotiladigan qoldiqqa qaytarilgan',damaged:'Brak — sotiladigan qoldiqqa qo‘shilmagan',write_off:'Hisobdan chiqarilgan'};
const labelsSource=labels;
export default function ReturnHistory({saleId,timezone,version}:{saleId:string;timezone:string;version:number}){
 const {status:codeLabel}=useTranslation();

 const {message:uiMessage}=useTranslation();

 const {formatMoney,formatDate}=useTranslation();

 const {locale:mapLocale}=useTranslation();

 const labels=localizeOwnedLabels(labelsSource,mapLocale);

 const {t:tr}=useTranslation();

 const {page,setPage,invalid,reset}=useReadPage('returns_');
 const [rows,setRows]=useState<SaleReturnHistory[]>([]),[pages,setPages]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  let cancelled=false;
  void Promise.resolve().then(async()=>{
   if(cancelled||invalid)return;
   setBusy(true);setError('');
   try{const response=await api.sales.returnHistory(saleId,page);if(!cancelled){setRows(response.data??[]);setPages(response.pagination?.totalPages??0);}}
   catch(error){if(!cancelled)setError(displayErrorMessage(error,'Tarix yuklanmadi'));}
   finally{if(!cancelled)setBusy(false);}
  });
  return()=>{cancelled=true;};
 },[saleId,page,version,retry,invalid]);
 return <Card title={tr("Qaytarishlar tarixi")}>
  <p className="text-xs text-slate-500 mb-3">{tr("Qiymat qaytarilgan tovar summasi; uning hammasi naqd refund degani emas.")}</p>
  <ReadQueryNotice invalid={invalid} reset={reset}/>{invalid?null:busy?<p role="status">{tr("Yuklanmoqda...")}</p>:error?<div role="alert">{uiMessage(error)} <Button onClick={()=>setRetry(value=>value+1)}>{tr("Qayta yuklash")}</Button></div>:rows.length===0?<p>{tr("Qaytarish qayd etilmagan.")}</p>:rows.map(row=><article key={row.id} className="border-t py-3 space-y-2">
   <p className="font-semibold">{row.returnReceiptNo} — {formatMoney(row.refundAmount)}</p>
   <p className="text-xs">{formatDate(row.returnedAt,true,timezone)} · {row.processor.fullName} · {codeLabel(row.status)}</p>
   <p className="text-xs">{row.approvedAt?tr("Tasdiq: {value1} ({value2}), {value3}",{value1:String(row.processor.fullName),value2:String(row.approvedRole),value3:String(formatDate(row.approvedAt,true,timezone))}):tr("Eski hujjat: tasdiq ma’lumoti qayd etilmagan")}</p>
   <Button variant="outline" onClick={()=>downloadReturnReceipt(row,saleId,timezone,mapLocale)}>{tr("Qaytarma chek HTML yuklash")}</Button>
   <p className="text-sm whitespace-pre-wrap">{tr("Sabab:")}{' '}{row.reason??'—'}</p>
   <ul className="text-sm space-y-1">{row.items.map(item=><li key={item.id}>{item.saleItem.productName} ({item.saleItem.sku}) — {item.quantity} {item.saleItem.unit??''}; {formatMoney(item.lineTotal)}; {labels[item.disposition]??item.disposition}</li>)}</ul>
  </article>)}
  <Pagination page={page} pages={pages} busy={busy&&!invalid} blocked={invalid||!!error} onPage={setPage} retry={()=>setRetry(value=>value+1)}/>

 </Card>;
}

function downloadReturnReceipt(row:SaleReturnHistory,saleId:string,timezone:string,locale:Locale){
 const content=returnReceiptHtml(row,saleId,timezone,locale);
 const url=URL.createObjectURL(new Blob([content],{type:'text/html;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='return-'+row.id+'.html';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
