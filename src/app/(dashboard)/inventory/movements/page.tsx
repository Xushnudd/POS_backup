'use client';
import { useEffect,useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import CsvExportButton from '@/components/ui/CsvExportButton';
type Row={id:string;occurredAt:string;movementType:string;quantityDelta:string;unitCost:string;sourceType:string;sourceId:string;note?:string;product:{name:string;unit:string};store:{name:string};creator?:{fullName:string}};
export default function MovementsPage(){
 const {organization,role}=useAuth();
 const [rows,setRows]=useState<Row[]>([]),[page,setPage]=useState(1),[pages,setPages]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [draft,setDraft]=useState({from:'',to:'',storeId:'',productId:'',movementType:'',sourceType:'',sourceId:''}),[filters,setFilters]=useState<Record<string,string>>({});
 useEffect(()=>{if(!organization||!role||role==='cashier')return;let cancelled=false;void Promise.resolve().then(async()=>{if(cancelled)return;setBusy(true);setError('');try{const res=await api.inventory.movements({organizationId:organization.id,...filters,page,limit:20});if(!cancelled){setRows(res.data as unknown as Row[]??[]);setPages(res.pagination?.totalPages??0);}}catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Jurnal yuklanmadi');}finally{if(!cancelled)setBusy(false);}});return()=>{cancelled=true;};},[organization,role,filters,page,retry]);
 if(!organization||!role||role==='cashier')return <p>Ombor jurnalini ko‘rish uchun rahbar vakolati kerak.</p>;
 return <div className="space-y-4"><h1 className="text-2xl font-bold">Ombor harakati jurnali</h1><p className="text-sm">Musbat miqdor kirim, manfiy miqdor chiqim. Sanalar tashkilot vaqt zonasida; mahsulot nomi va birligi joriy katalogdan ko‘rsatiladi.</p><CsvExportButton path="/inventory/movements" params={{organizationId:organization.id,...filters}}/>
 <Card><form className="grid sm:grid-cols-2 gap-3" onSubmit={e=>{e.preventDefault();setPage(1);setFilters(Object.fromEntries(Object.entries(draft).filter(([,v])=>v.trim()).map(([k,v])=>[k,v.trim()])));}}>{(Object.keys(draft) as (keyof typeof draft)[]).map(key=><Input key={key} label={{from:'Davr boshi',to:'Davr oxiri',storeId:'Filial ID',productId:'Mahsulot ID',movementType:'Harakat turi',sourceType:'Manba turi',sourceId:'Manba ID'}[key]} type={key==='from'||key==='to'?'date':'text'} maxLength={100} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/>)}<Button type="submit" disabled={busy}>Filtrlash</Button></form></Card>
 {error&&<p role="alert">{error}</p>}
 <Card>{busy?<p>Yuklanmoqda...</p>:<div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th>Sana / filial</th><th>Mahsulot</th><th>Harakat</th><th>Miqdor</th><th>Birlik tannarxi</th><th>Manba / xodim</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t"><td className="p-2">{new Date(row.occurredAt).toLocaleString('uz-UZ',{timeZone:organization.timezone})}<p>{row.store.name}</p></td><td>{row.product.name}<p>{row.product.unit}</p></td><td>{row.movementType}</td><td>{row.quantityDelta}</td><td>{row.unitCost}</td><td>{row.sourceType}<p className="text-xs break-all">{row.sourceId}</p><p>{row.creator?.fullName}</p><p>{row.note}</p></td></tr>)}</tbody></table>{!rows.length&&<p>Harakat topilmadi.</p>}</div>}
 <div className="flex gap-3 mt-3"><Button disabled={busy||page<=1} onClick={()=>setPage(x=>x-1)}>Oldingi</Button><span>{page} / {Math.max(1,pages)}</span><Button disabled={busy||page>=pages} onClick={()=>setPage(x=>x+1)}>Keyingi</Button><Button disabled={busy} onClick={()=>setRetry(x=>x+1)}>Qayta yuklash</Button></div></Card></div>;
}
