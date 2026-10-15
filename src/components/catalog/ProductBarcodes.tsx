'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import {useListQuery} from '@/hooks/useListQuery';
import ListFilter from '@/components/ui/ListFilter';
import ReadQueryNotice from '@/components/ui/ReadQueryNotice';
import { useEffect,useState,useRef } from 'react';
import { api } from '@/lib/api';
import { downloadHtml } from '@/lib/download';
import type { ProductBarcode } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import CsvExportButton from '@/components/ui/CsvExportButton';
export default function ProductBarcodes({productId,readOnly=false,disabled=false,revision=0,onEditStateChange}:{productId:string;readOnly?:boolean;disabled?:boolean;revision?:number;onEditStateChange?:(state:{dirty:boolean;busy:boolean})=>void}){
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

 const {query:list,changeQuery}=useListQuery(['source'] as const,'source','barcodes_',50);
 const page=list?.page??1,limit=list?.limit??50,search=list?.search??'',invalid=!list;
 const setPage=(value:number|((page:number)=>number))=>changeQuery({page:String(typeof value==='function'?value(page):value)});
 const generationKey=useRef<string|null>(null),flight=useRef(false);
 const [copies,setCopies]=useState('1'),[readError,setReadError]=useState(''),[message,setMessage]=useState(''),[generationPending,setGenerationPending]=useState(false);
 const [rows,setRows]=useState<ProductBarcode[]>([]),[value,setValue]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[pages,setPages]=useState(0),[retry,setRetry]=useState(0);
 useEffect(()=>{onEditStateChange?.({dirty:!readOnly&&value.length>0,busy});},[value,busy,readOnly,onEditStateChange]);
 useEffect(()=>()=>onEditStateChange?.({dirty:false,busy:false}),[onEditStateChange]);
 useEffect(()=>{let cancelled=false;void Promise.resolve().then(async()=>{if(cancelled||invalid)return;setLoading(true);try{const response=await api.barcodes.list(productId,{page:String(page),limit:String(limit),search});if(!cancelled){if(!response.data)throw new Error('Barkod ro‘yxati mavjud emas');setReadError('');setRows(response.data);setPages(response.pagination?.totalPages??0);}}catch(error){if(!cancelled)setReadError(displayErrorMessage(error,'Barkodlar yuklanmadi'));}finally{if(!cancelled)setLoading(false);}});return()=>{cancelled=true;};},[productId,page,limit,search,retry,revision,invalid]);
 return <Card title={tr("Mahsulot barkodlari")}>{readError&&<p role="alert">{uiMessage(readError)}{tr(". Yangi amal oldidan ro‘yxatni qayta yuklang.")}</p>}{message&&<p role="status">{uiMessage(message)}</p>}{error&&<p role="alert" className="text-red-700 text-sm mb-2">{uiMessage(error)}</p>}
 {!readOnly&&value.length>0&&<p role="status">{tr("Saqlanmagan qo‘shimcha barkod bor.")}</p>}
 <ReadQueryNotice invalid={invalid} reset={()=>changeQuery({page:'',limit:'',search:'',sort:''})}/><ListFilter search={search} sort="source" label={tr("Barkod qidirish")} disabled={busy||disabled} onChange={changeQuery} options={[{value:'source',label:tr("Asosiy, keyin asl ketma-ketlik")}]}/>

 {!readOnly&&<CsvExportButton path={`/products/${productId}/barcodes`} params={{search}} label={tr("Barkodlarni CSV yuklash")}/>}
 {!readOnly&&<div className="flex items-end gap-2 mt-3"><Input label={tr("Etiketka soni")} disabled={busy||disabled||loading||!!readError} type="number" min="1" max="100" value={copies} onChange={e=>setCopies(e.target.value)}/><Button disabled={busy||disabled||((loading||!!readError)&&!generationPending)} onClick={async()=>{if(flight.current||disabled||((loading||readError)&&!generationKey.current))return;flight.current=true;setBusy(true);setError('');generationKey.current??=crypto.randomUUID();setGenerationPending(true);try{await api.barcodes.generate(productId,generationKey.current);generationKey.current=null;setGenerationPending(false);setMessage('Ichki barkod serverda yaratildi.');setRetry(x=>x+1);}catch(error){setError(displayErrorMessage(error,'Barkod yaratilmadi'));}finally{flight.current=false;setBusy(false);}}}>{generationPending?tr("Original barkod yaratish amalini tekshirish"):tr("Ichki barkod yaratish")}</Button></div>}
 {loading&&!invalid?<p role="status">{tr("Yuklanmoqda...")}</p>:<ul className="space-y-2 mt-3">{rows.map(row=><li key={row.id} className="flex items-center justify-between gap-2"><span className="font-mono text-sm">{row.value}{row.isPrimary?tr("(asosiy)"):''}</span>{!readOnly&&<Button size="sm" variant="outline" disabled={busy||disabled||loading||!!readError} onClick={async()=>{if(flight.current||disabled||loading||readError)return;const count=Number(copies);if(!Number.isInteger(count)||count<1||count>100){setError('Etiketka soni 1–100 bo‘lishi kerak');return;}flight.current=true;setBusy(true);setError('');try{const response=await api.barcodes.labels(productId,row.id,count);if(!response.data)throw new Error('Etiketka kelmadi');downloadHtml(response.data);}catch(error){setError(displayErrorMessage(error,'Etiketka tayyorlanmadi'));}finally{flight.current=false;setBusy(false);}}}>{tr("Etiketka")}</Button>}{!readOnly&&!row.isPrimary&&<Button size="sm" variant="outline" disabled={busy||disabled||loading||!!readError} onClick={async()=>{if(flight.current||disabled||loading||readError)return;flight.current=true;setBusy(true);setError('');try{await api.barcodes.remove(productId,row.id);setMessage('Barkod serverda o‘chirildi.');if(rows.length===1&&page>1)setPage(x=>x-1);else setRetry(x=>x+1);}catch(error){setError(displayErrorMessage(error,'Barkod o‘chirilmadi'));}finally{flight.current=false;setBusy(false);}}}>{tr("O‘chirish")}</Button>}</li>)}{!rows.length&&<li>{tr("Barkod topilmadi.")}</li>}</ul>}
 {!loading&&!readError&&!invalid&&!rows.length&&<p>{tr("Barkod topilmadi.")}</p>}<Pagination page={page} pages={pages} busy={loading&&!invalid||busy} blocked={invalid||!!readError} onPage={setPage} retry={()=>setRetry(x=>x+1)}/>
 {!readOnly&&<form className="flex gap-2 items-end mt-4" onSubmit={async e=>{e.preventDefault();if(flight.current||disabled||loading||readError)return;flight.current=true;setBusy(true);setError('');try{await api.barcodes.add(productId,value.trim());setMessage('Barkod serverda qo‘shildi.');setValue('');setRetry(x=>x+1);}catch(error){setError(displayErrorMessage(error,'Barkod qo‘shilmadi'));}finally{flight.current=false;setBusy(false);}}}><Input label={tr("Qo‘shimcha barkod")} value={value} disabled={busy||disabled||loading||!!readError} onChange={e=>{setValue(e.target.value);setMessage('')}} minLength={2} maxLength={200} required/><Button type="submit" disabled={busy||disabled||loading||!!readError}>{tr("Qo‘shish")}</Button></form>}</Card>;
}
