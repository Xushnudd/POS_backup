'use client';
import {useEffect,useRef,useState} from 'react';
import type {ElectronicReceipt} from '@/server/sales/receipt-links';
import {useTranslation} from '@/context/LocaleContext';
function receiptPrintCss(width:58|80){return `@page{size:${width}mm 297mm;margin:2mm}@media print{body{background:white!important}#electronic-receipt{width:${width-4}mm!important;margin:0;padding:0;font:11px monospace}main{margin:0!important;padding:0!important}}`}
export default function ElectronicReceiptView(){
 const {t:tr}=useTranslation(),fragment=useRef<string|null>(null);
 const [receipt,setReceipt]=useState<ElectronicReceipt|null>(null),[failed,setFailed]=useState(false),[width,setWidth]=useState<58|80>(80);
 useEffect(()=>{let live=true;const value=fragment.current??location.hash.slice(1);fragment.current=value;
  const [organizationId,operationId,capability,...extra]=value.split('.');
  if(extra.length||!organizationId||!operationId||!capability){void Promise.resolve().then(()=>{if(live)setFailed(true);});return()=>{live=false;};}
  fetch('/api/receipt-view',{method:'POST',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:{'content-type':'application/json'},body:JSON.stringify({organizationId,operationId,capability})}).then(async response=>{if(!response.ok)throw new Error('DOCUMENT_UNAVAILABLE');const body=await response.json();if(live)setReceipt(body.data);}).catch(()=>{if(live)setFailed(true);});return()=>{live=false;};
 },[]);
 if(failed)return <main className="p-8"><h1>{tr('Elektron chek mavjud emas yoki muddati tugagan.')}</h1></main>;
 if(!receipt)return <main className="p-8" role="status">{tr('Yuklanmoqda...')}</main>;
 return <main className="mx-auto p-4" style={{maxWidth:420}}>
  <div className="print:hidden space-x-3"><label>{tr('Chek qog‘ozi eni')}{' '}<select aria-label={tr('Chek qog‘ozi eni')} value={width} onChange={event=>setWidth(event.target.value==='58'?58:80)}><option value="58">58 mm</option><option value="80">80 mm</option></select></label><button onClick={()=>window.print()}>{tr('Chekni chop etish')}</button></div>
  <style>{receiptPrintCss(width)}</style>
  <article id="electronic-receipt" className="space-y-3 mt-4 font-mono text-sm">
   <h1>{tr('Elektron chek')}</h1><p>{tr('CHEK NUSXASI')}</p><p>{tr('Bu fiskal chek emas.')}</p>
   <h2>{receipt.organizationName??tr('Original rekvizitlar saqlanmagan')}</h2><p>{receipt.storeName}</p><p>{receipt.receiptNo}</p><p>{receipt.completedAt}</p>
   {receipt.items.map((item,index)=><div key={index} className="border-b"><p>{item.name}</p><p>{item.quantity} {item.unit} × {item.unitPrice} = {item.totalPrice}</p><p>{tr('Chegirma: -')}{item.discountAmount}</p></div>)}
   <p>{tr('Oraliq summa:')}{' '}{receipt.subtotal}</p><p>{tr('Umumiy chegirma:')}{' '}{receipt.discountAmount}</p><strong data-receipt-total={receipt.totalAmount}>{tr("JAMI TO'LOV:")}{' '}{receipt.totalAmount} {receipt.currency}</strong>
   {receipt.taxAmount!==null&&<p>{tr('Jami ichidagi soliq qismi:')}{' '}{receipt.taxAmount}</p>}
   {receipt.payments.map((payment,index)=><p key={index}>{payment.paymentType}: {payment.amount}</p>)}
  </article>
 </main>;
}
