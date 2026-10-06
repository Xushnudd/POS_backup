'use client';
import { useEffect,useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Card from '@/components/ui/Card';
type Kind='products'|'customers'|'categories';
type Row={id:string;name?:string;fullName?:string;isActive:boolean};
export default function ArchivePage(){
 const {organization,role}=useAuth();
 const [kind,setKind]=useState<Kind>('products'),[status,setStatus]=useState('archived'),[page,setPage]=useState(1),[pages,setPages]=useState(0),[rows,setRows]=useState<Row[]>([]),[busy,setBusy]=useState(true),[saving,setSaving]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!organization||!role||role==='cashier')return;
  let cancelled=false;
  void Promise.resolve().then(async()=>{if(cancelled)return;setBusy(true);setError('');try{const res=await api.archive.list(kind,{organizationId:organization.id,status,page:String(page),limit:'20'});if(!cancelled){setRows(res.data??[]);setPages(res.pagination?.totalPages??0);}}catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Arxiv yuklanmadi');}finally{if(!cancelled)setBusy(false);}});
  return()=>{cancelled=true;};
 },[organization,role,kind,status,page,retry]);
 if(!role||role==='cashier')return <p>Arxivni boshqarish uchun rahbar vakolati kerak.</p>;
 return <div className="space-y-4"><h1 className="text-2xl font-bold">Arxiv</h1><p>Arxivlash tarixiy savdo va ombor yozuvlarini saqlaydi. Qarz yoki avans qoldig‘i bor mijozni arxivlab bo‘lmaydi. Kategoriyani arxivlash mahsulotlarini arxivlamaydi.</p>
 <div className="flex gap-3"><Select label="Arxiv turi" value={kind} disabled={!!saving} options={[{value:'products',label:'Mahsulotlar'},{value:'customers',label:'Mijozlar'},{value:'categories',label:'Kategoriyalar'}]} onChange={e=>{setKind(e.target.value as Kind);setPage(1);}}/><Select label="Holat" value={status} disabled={!!saving} options={[{value:'archived',label:'Arxivlangan'},{value:'active',label:'Faol'},{value:'all',label:'Barchasi'}]} onChange={e=>{setStatus(e.target.value);setPage(1);}}/></div>
 {error&&<p role="alert">{error}</p>}
 <Card>{busy?<p>Yuklanmoqda...</p>:<><table className="w-full text-sm"><thead><tr><th>Nomi</th><th>Holat</th><th>Amal</th></tr></thead><tbody>{rows.map(row=><tr className="border-t" key={row.id}><td className="p-2">{row.name??row.fullName}</td><td>{row.isActive?'Faol':'Arxivlangan'}</td><td><Button disabled={!!saving} onClick={async()=>{setSaving(row.id);setError('');try{await api.archive.setActive(kind,row.id,!row.isActive);setRetry(x=>x+1);}catch(error){setError(error instanceof Error?error.message:'Amal bajarilmadi');}finally{setSaving('');}}}>{row.isActive?'Arxivlash':'Tiklash'}</Button></td></tr>)}</tbody></table>{!rows.length&&<p>Yozuv topilmadi.</p>}</>}
 <div className="flex gap-3 mt-3"><Button disabled={busy||!!saving||page<=1} onClick={()=>setPage(x=>x-1)}>Oldingi</Button><span>{page} / {Math.max(1,pages)}</span><Button disabled={busy||!!saving||page>=pages} onClick={()=>setPage(x=>x+1)}>Keyingi</Button><Button disabled={busy||!!saving} onClick={()=>setRetry(x=>x+1)}>Qayta yuklash</Button></div></Card></div>;
}
