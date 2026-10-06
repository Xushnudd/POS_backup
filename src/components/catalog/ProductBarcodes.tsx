'use client';
import { useEffect,useState } from 'react';
import { api } from '@/lib/api';
import type { ProductBarcode } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import CsvExportButton from '@/components/ui/CsvExportButton';
export default function ProductBarcodes({productId,readOnly=false}:{productId:string;readOnly?:boolean}){
 const [rows,setRows]=useState<ProductBarcode[]>([]),[value,setValue]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[page,setPage]=useState(1),[pages,setPages]=useState(0),[retry,setRetry]=useState(0),[query,setQuery]=useState(''),[search,setSearch]=useState('');
 useEffect(()=>{let cancelled=false;void Promise.resolve().then(async()=>{if(cancelled)return;setLoading(true);setError('');try{const response=await api.barcodes.list(productId,{page:String(page),limit:'50',search});if(!cancelled){setRows(response.data??[]);setPages(response.pagination?.totalPages??0);}}catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Barkodlar yuklanmadi');}finally{if(!cancelled)setLoading(false);}});return()=>{cancelled=true;};},[productId,page,search,retry]);
 return <Card title="Mahsulot barkodlari">{error&&<p role="alert" className="text-red-700 text-sm mb-2">{error}</p>}
 <form className="flex gap-2 items-end mb-3" onSubmit={e=>{e.preventDefault();setPage(1);setSearch(query.trim());}}><Input label="Barkod qidirish" value={query} maxLength={200} onChange={e=>setQuery(e.target.value)}/><Button type="submit" disabled={loading||busy}>Qidirish</Button></form>
 {!readOnly&&<CsvExportButton path={`/products/${productId}/barcodes`} params={{search}} label="Barkodlarni CSV yuklash"/>}
 {loading?<p>Yuklanmoqda...</p>:<ul className="space-y-2 mt-3">{rows.map(row=><li key={row.id} className="flex items-center justify-between gap-2"><span className="font-mono text-sm">{row.value}{row.isPrimary?' (asosiy)':''}</span>{!readOnly&&!row.isPrimary&&<Button size="sm" variant="outline" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await api.barcodes.remove(productId,row.id);if(rows.length===1&&page>1)setPage(x=>x-1);else setRetry(x=>x+1);}catch(error){setError(error instanceof Error?error.message:'Barkod o‘chirilmadi');}finally{setBusy(false);}}}>O‘chirish</Button>}</li>)}{!rows.length&&<li>Barkod topilmadi.</li>}</ul>}
 <Pagination page={page} pages={pages} busy={loading||busy} onPage={setPage} retry={()=>setRetry(x=>x+1)}/>
 {!readOnly&&<form className="flex gap-2 items-end mt-4" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await api.barcodes.add(productId,value.trim());setValue('');setRetry(x=>x+1);}catch(error){setError(error instanceof Error?error.message:'Barkod qo‘shilmadi');}finally{setBusy(false);}}}><Input label="Qo‘shimcha barkod" value={value} disabled={busy} onChange={e=>setValue(e.target.value)} minLength={2} maxLength={200} required/><Button type="submit" disabled={busy}>Qo‘shish</Button></form>}</Card>;
}
