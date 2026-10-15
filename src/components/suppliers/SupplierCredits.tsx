'use client';


import {useTranslation} from '@/context/LocaleContext';

import {useReadPage} from '@/hooks/useReadPage';
import ReadQueryNotice from '@/components/ui/ReadQueryNotice';
import SerialPicker from '@/components/inventory/SerialPicker';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {api} from '@/lib/api';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import DurableMutation from '@/components/forms/DurableMutation';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
type Detail={id:string;storeId:string;stockDocumentId:string;netAmount:string;items:{id:string;productId:string;quantity:string;remainingQuantity:string;unitCost:string;creditedAmount:string;product:{name:string;unit:string;serialTracking?:boolean}}[]};
type Body={kind:string;reason:string;items:({stockDocumentItemId:string;quantity:string;serialIds?:string[]}|{stockDocumentItemId:string;amount:string})[]};
type Quote={amount:string;invoiceNet:string;items:{productName:string;quantity:string;amount:string;unit:string}[]};
type Credit={id:string;kind:string;amount:string;reason:string;createdAt:string;items:{quantity:string;amount:string}[]};
export default function SupplierCredits({supplierId,invoices,revision,onDone}:{supplierId:string;invoices:{id:string;referenceNo:string}[];revision:number;onDone:()=>void}){
 const {t:tr}=useTranslation();

 const [serialChoices,setSerialChoices]=useState<Record<string,string[]>>({});
 const [id,setId]=useState(''),[detail,setDetail]=useState<Detail|null>(null),[kind,setKind]=useState('goods_return'),[reason,setReason]=useState(''),[values,setValues]=useState<Record<string,string>>({});
 const [error,setError]=useState(''),[loading,setLoading]=useState(false),[previewing,setPreviewing]=useState(false),[ready,setReady]=useState(false),[retry,setRetry]=useState(0);
 const {page,setPage,invalid,reset}=useReadPage('supplier_credits_');
 const [review,setReview]=useState<{body:Body;quote:Quote}|null>(null),[pages,setPages]=useState(0),[history,setHistory]=useState<Credit[]>([]);
 const flight=useRef(false),live=useRef(true),busy=loading||previewing;
 const discard=useUnsavedChanges(Boolean(reason||Object.values(values).some(value=>value)||review),busy);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 useEffect(()=>{
  let cancelled=false;const controller=new AbortController();
  void Promise.resolve().then(async()=>{
   if(cancelled)return;
   if(!id||invalid){setDetail(null);setHistory([]);setReady(false);return;}
   setLoading(true);setReady(false);setError('');
   try{
    const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]);
    const [original,credits]=await Promise.all([api.request<Detail>('/supplier-invoices/'+id,{signal}),api.request<Credit[]>('/supplier-invoices/'+id+'/credits?page='+page+'&limit=20',{signal})]);
    if(!cancelled){if(!original.data||original.data.id!==id)throw new Error('Original invoice javobi olinmadi');setDetail(original.data);setHistory(credits.data??[]);setPages(credits.pagination?.totalPages??0);setReady(true);}
   }catch(cause){if(!cancelled)setError(cause instanceof Error?cause.message:'Original invoice yuklanmadi');}
   finally{if(!cancelled)setLoading(false);}
  });
  return()=>{cancelled=true;controller.abort();};
 },[id,page,revision,invalid,retry]);
 async function preview(event:FormEvent){
  event.preventDefault();if(flight.current||busy||!ready||!detail)return;
  const body:Body={kind,reason,items:detail.items.filter(item=>values[item.id]?.trim()).map(item=>kind==='goods_return'?{stockDocumentItemId:item.id,quantity:values[item.id],...(item.product.serialTracking?{serialIds:serialChoices[item.id]??[]}:{})}:{stockDocumentItemId:item.id,amount:values[item.id]})};
  flight.current=true;setPreviewing(true);setError('');
  try{
   const response=await api.request<Quote>('/supplier-invoices/'+id+'/credits',{method:'POST',signal:AbortSignal.timeout(15000),body:JSON.stringify({...body,operationId:crypto.randomUUID(),preview:true})});
   if(!response.data)throw new Error('Preview kelmadi');
   if(live.current)setReview({body,quote:response.data});
  }catch(cause){if(live.current)setError(cause instanceof Error?cause.message:'Original qoldiqni tekshiring');}
  finally{flight.current=false;if(live.current)setPreviewing(false);}
 }
 return <Card><h3>{tr("Supplierga qaytarish va narx tuzatish")}</h3>
  <p>{tr("Original qabul miqdori va qiymatidan oshib bo‘lmaydi. To‘langan qism avansga qaytadi; supplierdan haqiqiy pul qaytimi bu amal bilan qayd etilmaydi. Narx credit hujjati qarzni tuzatadi; tarixiy savdo tannarxi o‘zgarmaydi.")}</p>
  {error&&<p role="alert">{error} {!ready&&detail&&tr("Oxirgi invoice holati ko‘rsatilmoqda; yangi preview bloklangan.")} {id&&<Button disabled={busy} onClick={()=>setRetry(value=>value+1)}>{tr("Original invoiceni qayta tekshirish")}</Button>}</p>}
  {loading&&<p role="status">{tr("Original invoice va credit tarixi yuklanmoqda…")}</p>}
  {previewing&&<p role="status">{tr("Supplier credit server hisobini kutish…")}</p>}
  {!busy&&!review&&(reason||Object.values(values).some(value=>value))&&<p role="status">{tr("Saqlanmagan supplier credit o‘zgarishlari bor.")}</p>}
  {!review?<><Select label={tr("Supplier qaytarish invoice")} value={id} disabled={busy} onChange={event=>{if(event.target.value===id||!discard())return;setId(event.target.value);setDetail(null);setHistory([]);setReady(false);setPage(1);setValues({});setReason('');}} options={[{value:'',label:tr("Original invoice tanlang")},...invoices.map(invoice=>({value:invoice.id,label:invoice.referenceNo}))]}/>
   {detail&&<form className="space-y-3" onSubmit={preview}><fieldset disabled={busy||!ready} className="space-y-3">
    <Select label={tr("Supplier credit turi")} value={kind} onChange={event=>{if(event.target.value===kind||!discard())return;setKind(event.target.value);setValues({});}} options={[{value:'goods_return',label:tr("Original mahsulotni qaytarish")},{value:'price_correction',label:tr("Kelishilgan narx kamayishi")}]}/>
    {detail.items.map((item,index)=><div key={item.id}><p>{item.product.name}{tr(": original")}{' '}{item.quantity}{tr(", qaytarish mumkin")}{' '}{item.remainingQuantity} {item.product.unit}{tr("; narx")}{' '}{item.unitCost}{tr("; credit")}{' '}{item.creditedAmount}</p><Input label={(kind==='goods_return'?'Supplier qaytarish miqdori ':'Supplier narx credit summasi ')+(index+1)} inputMode="decimal" value={values[item.id]??''} onChange={event=>setValues(previous=>({...previous,[item.id]:event.target.value}))}/>{kind==='goods_return'&&item.product.serialTracking&&<SerialPicker storeId={detail.storeId} receiptId={detail.stockDocumentId} productId={item.productId} label={item.product.name+' supplierga qaytariladigan seriallar'} value={serialChoices[item.id]??[]} onChange={ids=>setSerialChoices(previous=>({...previous,[item.id]:ids}))}/>}</div>)}
    <Input label={tr("Supplier credit sababi")} value={reason} onChange={event=>setReason(event.target.value)} maxLength={2000}/><Button type="submit" disabled={busy||!ready}>{tr("Supplier credit server preview")}</Button>
   </fieldset></form>}
  </>:<DurableMutation returnPath={'/suppliers/'+supplierId} path={'/supplier-invoices/'+id+'/credits'} body={{...review.body,expectedAmount:review.quote.amount,expectedInvoiceNet:review.quote.invoiceNet}} label={tr("Supplier credit")} review={['Original invoice: '+(invoices.find(invoice=>invoice.id===id)?.referenceNo??id),'Invoice sof qiymati: '+review.quote.invoiceNet,'Credit: '+review.quote.amount,review.body.reason,...review.quote.items.map(item=>item.productName+': '+item.quantity+' '+item.unit+'; credit '+item.amount),'Yangi cash refund yozilmaydi.']} onDone={()=>{setReview(null);setValues({});setReason('');onDone();}}><Button variant="outline" onClick={()=>setReview(null)}>{tr("Credit tahririga qaytish")}</Button></DurableMutation>}
  {id&&<><h3>{tr("Original credit tarixi")}</h3><ReadQueryNotice invalid={invalid} reset={reset}/>{history.map(credit=><p key={credit.id}>{credit.kind} · {credit.amount} · {credit.reason} · {credit.items.map(item=>item.quantity+' / '+item.amount).join('; ')}</p>)}<Pagination page={page} pages={pages} busy={busy&&!invalid} blocked={invalid||!!error} onPage={setPage} retry={()=>setRetry(value=>value+1)}/></>}
 </Card>;
}
