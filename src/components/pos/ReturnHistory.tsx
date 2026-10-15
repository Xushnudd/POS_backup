'use client';
import {localizeOwnedLabels} from '@/i18n/messages';

import {useTranslation} from '@/context/LocaleContext';

import {useReadPage} from '@/hooks/useReadPage';
import ReadQueryNotice from '@/components/ui/ReadQueryNotice';
import Pagination from '@/components/ui/Pagination';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {formatMoney} from '@/lib/format';
import type { SaleReturnHistory } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
const labels:Record<string,string>={sellable:'Sotiladigan qoldiqqa qaytarilgan',damaged:'Brak — sotiladigan qoldiqqa qo‘shilmagan',write_off:'Hisobdan chiqarilgan'};
const labelsSource=labels;
export default function ReturnHistory({saleId,timezone,version}:{saleId:string;timezone:string;version:number}){
 const {formatMoney}=useTranslation();

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
   catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Tarix yuklanmadi');}
   finally{if(!cancelled)setBusy(false);}
  });
  return()=>{cancelled=true;};
 },[saleId,page,version,retry,invalid]);
 return <Card title={tr("Qaytarishlar tarixi")}>
  <p className="text-xs text-slate-500 mb-3">{tr("Qiymat qaytarilgan tovar summasi; uning hammasi naqd refund degani emas.")}</p>
  <ReadQueryNotice invalid={invalid} reset={reset}/>{invalid?null:busy?<p role="status">{tr("Yuklanmoqda...")}</p>:error?<div role="alert">{error} <Button onClick={()=>setRetry(value=>value+1)}>{tr("Qayta yuklash")}</Button></div>:rows.length===0?<p>{tr("Qaytarish qayd etilmagan.")}</p>:rows.map(row=><article key={row.id} className="border-t py-3 space-y-2">
   <p className="font-semibold">{row.returnReceiptNo} — {formatMoney(row.refundAmount)}</p>
   <p className="text-xs">{new Date(row.returnedAt).toLocaleString('uz-UZ',{timeZone:timezone})} · {row.processor.fullName} · {row.status}</p>
   <p className="text-xs">{row.approvedAt?`Tasdiq: ${row.processor.fullName} (${row.approvedRole}), ${new Date(row.approvedAt).toLocaleString('uz-UZ',{timeZone:timezone})}`:tr("Eski hujjat: tasdiq ma’lumoti qayd etilmagan")}</p>
   <Button variant="outline" onClick={()=>downloadReturnReceipt(row,saleId,timezone)}>{tr("Qaytarma chek HTML yuklash")}</Button>
   <p className="text-sm whitespace-pre-wrap">{tr("Sabab:")}{' '}{row.reason??'—'}</p>
   <ul className="text-sm space-y-1">{row.items.map(item=><li key={item.id}>{item.saleItem.productName} ({item.saleItem.sku}) — {item.quantity} {item.saleItem.unit??''}; {formatMoney(item.lineTotal)}; {labels[item.disposition]??item.disposition}</li>)}</ul>
  </article>)}
  <Pagination page={page} pages={pages} busy={busy&&!invalid} blocked={invalid||!!error} onPage={setPage} retry={()=>setRetry(value=>value+1)}/>

 </Card>;
}

function downloadReturnReceipt(row:SaleReturnHistory,saleId:string,timezone:string){
 const text=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
 const content=`<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Qaytarma chek</title><style>@page{size:80mm 297mm;margin:4mm}body{font:12px system-ui;width:72mm;margin:auto;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}td{border-bottom:1px dashed #999;padding:5px}h1{font-size:16px}</style></head><body><h1>QAYTARMA CHEK — NUSXA</h1><p>FISKAL EMAS. Brauzerda Ctrl+P orqali chop etish/PDF saqlash.</p><p>${text(row.returnReceiptNo)}</p><p>Original savdo: ${text(saleId)}</p><p>${text(new Date(row.returnedAt).toLocaleString('uz-UZ',{timeZone:timezone}))} (${text(timezone)})</p><p>Xodim: ${text(row.processor.fullName)}; tasdiq: ${text(row.approvedRole??'eski hujjatda noma’lum')}</p><p>Sabab: ${text(row.reason)}</p><table>${row.items.map(item=>`<tr><td>${text(item.saleItem.productName)}<br>${text(item.quantity)} ${text(item.saleItem.unit)}<br>${text(labels[item.disposition])}</td><td>${text(formatMoney(item.lineTotal))}</td></tr>`).join('')}</table><p>Qaytarilgan tovar qiymati: ${text(formatMoney(row.refundAmount))}</p><p>Bu qiymatning hammasi naqd refund degani emas; nasiya qismi qarzni kamaytirishi mumkin.</p></body></html>`;
 const url=URL.createObjectURL(new Blob([content],{type:'text/html;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='return-'+row.id+'.html';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
