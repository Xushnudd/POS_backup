'use client';
import { useEffect,useState } from 'react';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { CatalogUnit } from '@/types';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import CsvExportButton from '@/components/ui/CsvExportButton';
export default function UnitsPage(){const {organization,user,role}=useAuth();return organization&&user&&role&&role!=='cashier'?<Units key={[organization.id,user.id,role].join(':')}/>:<p>Birliklarni boshqarish uchun rahbar vakolati kerak.</p>;}
function Units(){
 const {role,organization}=useAuth();
 const [units,setUnits]=useState<CatalogUnit[]>([]),[code,setCode]=useState(''),[name,setName]=useState(''),[precision,setPrecision]=useState('0'),[editing,setEditing]=useState<CatalogUnit|null>(null);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[page,setPage]=useState(1),[pages,setPages]=useState(0),[status,setStatus]=useState('all'),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[retry,setRetry]=useState(0);
 const dirty=code!==(editing?.code??'')||name!==(editing?.name??'')||precision!==String(editing?.precision??0);
 const confirmDiscard=useUnsavedChanges(dirty,busy);
 useEffect(()=>{if(!organization||!role||role==='cashier')return;let cancelled=false;void Promise.resolve().then(async()=>{if(cancelled)return;setLoading(true);setError('');try{const response=await api.units.list({page:String(page),limit:'20',status,search});if(!cancelled){setUnits(response.data??[]);setPages(response.pagination?.totalPages??0);}}catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Birliklar yuklanmadi');}finally{if(!cancelled)setLoading(false);}});return()=>{cancelled=true;};},[organization,role,page,status,search,retry]);
 if(!role||role==='cashier')return <p>Birliklarni boshqarish uchun rahbar vakolati kerak.</p>;
 const reset=()=>{setEditing(null);setCode('');setName('');setPrecision('0');};
 return <div className="max-w-3xl space-y-4"><h1 className="text-xl font-bold">Mahsulot birliklari</h1><Link href="/products" className="text-blue-700 text-sm">Mahsulotlarga qaytish</Link><p className="text-sm">Aniqlik kasrdan keyingi raqamlar sonidir: dona — 0, kilogramm — 6 gacha. Mahsulotda ishlatilgan birlik aniqligi va faol holati o‘zgarmaydi. Quti boshqa birlikka avtomatik aylantirilmaydi.</p>{error&&<p role="alert" className="text-red-700">{error}</p>}
 <Card title={editing?'Birlik nomini tahrirlash':'Yangi birlik'}><form className="space-y-3" onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{if(editing)await api.units.update(editing.id,{name,precision:Number(precision)});else await api.units.create({code,name,precision:Number(precision)});reset();setRetry(x=>x+1);}catch(error){setError(error instanceof Error?error.message:'Birlik saqlanmadi');}finally{setBusy(false);}}}><Input label="Kod" value={code} onChange={e=>setCode(e.target.value)} disabled={!!editing||busy} pattern="[a-z][a-z0-9_-]{0,31}" maxLength={32} required/><Input label="Nomi" value={name} onChange={e=>setName(e.target.value)} disabled={busy} maxLength={100} required/><Input label="Kasr aniqligi" type="number" value={precision} onChange={e=>setPrecision(e.target.value)} disabled={busy} min={0} max={6} step={1} required/><div className="flex gap-2"><Button type="submit" disabled={busy}>Saqlash</Button>{(editing||dirty)&&<Button type="button" disabled={busy} onClick={()=>{if(confirmDiscard())reset();}}>Bekor qilish</Button>}</div></form></Card>
 {dirty&&<p role="status">Saqlanmagan birlik o‘zgarishlari bor.</p>}
 <form className="flex items-end gap-3" onSubmit={e=>{e.preventDefault();setSearch(query.trim());setPage(1);}}><Input label="Birlik qidirish" maxLength={200} value={query} onChange={e=>setQuery(e.target.value)}/><Select label="Birlik holati" value={status} options={[{value:'all',label:'Barchasi'},{value:'active',label:'Faol'},{value:'archived',label:'Arxivlangan'}]} onChange={e=>{setStatus(e.target.value);setPage(1);}}/><Button type="submit" disabled={busy||loading}>Qidirish</Button></form><CsvExportButton path="/units" params={{status,search}}/>
 <Card title="Birliklar">{loading?<p>Yuklanmoqda...</p>:<><table className="w-full text-sm"><thead><tr><th>Kod</th><th>Nomi</th><th>Aniqlik</th><th>Amallar</th></tr></thead><tbody>{units.map(unit=><tr key={unit.id} className="border-t"><td className="p-2">{unit.code}</td><td>{unit.name}{unit.isActive?'':' (arxiv)'}</td><td>{unit.precision}</td><td><div className="flex gap-2"><Button disabled={busy} onClick={()=>{if(!confirmDiscard())return;setEditing(unit);setCode(unit.code);setName(unit.name);setPrecision(String(unit.precision));}}>Tahrirlash</Button><Button disabled={busy} onClick={async()=>{if(editing?.id===unit.id&&!confirmDiscard())return;setBusy(true);setError('');try{await api.units.update(unit.id,{isActive:!unit.isActive});if(editing?.id===unit.id)reset();setRetry(x=>x+1);}catch(error){setError(error instanceof Error?error.message:'Holat o‘zgarmadi');}finally{setBusy(false);}}}>{unit.isActive?'Arxivlash':'Faollashtirish'}</Button></div></td></tr>)}</tbody></table>{!units.length&&<p>Birlik topilmadi.</p>}</>}<Pagination page={page} pages={pages} busy={busy||loading} onPage={setPage} retry={()=>setRetry(x=>x+1)}/></Card></div>;
}
