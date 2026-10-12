'use client';
import { useEffect,useState } from 'react';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import {useAcknowledgedMutation} from '@/hooks/useAcknowledgedMutation';
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
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[page,setPage]=useState(1),[pages,setPages]=useState(0),[status,setStatus]=useState('all'),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[retry,setRetry]=useState(0);
 const mutation=useAcknowledgedMutation(!loading&&!error),busy=mutation.saving;
 const refresh=()=>{setLoading(true);setRetry(x=>x+1);};
 const dirty=code!==(editing?.code??'')||name!==(editing?.name??'')||precision!==String(editing?.precision??0);
 const confirmDiscard=useUnsavedChanges(dirty,busy);
 useEffect(()=>{if(!organization||!role||role==='cashier')return;let cancelled=false;void Promise.resolve().then(async()=>{if(cancelled)return;setLoading(true);setError('');try{const response=await api.units.list({page:String(page),limit:'20',status,search});if(!cancelled){setUnits(response.data??[]);setPages(response.pagination?.totalPages??0);}}catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Birliklar yuklanmadi');}finally{if(!cancelled)setLoading(false);}});return()=>{cancelled=true;};},[organization,role,page,status,search,retry]);
 if(!role||role==='cashier')return <p>Birliklarni boshqarish uchun rahbar vakolati kerak.</p>;
 const reset=()=>{setEditing(null);setCode('');setName('');setPrecision('0');};
 return <div className="max-w-3xl space-y-4"><h1 className="text-xl font-bold">Mahsulot birliklari</h1><Link href="/products" className="text-blue-700 text-sm">Mahsulotlarga qaytish</Link><p className="text-sm">Aniqlik kasrdan keyingi raqamlar sonidir: dona — 0, kilogramm — 6 gacha. Mahsulotda ishlatilgan birlik aniqligi va faol holati o‘zgarmaydi. Quti boshqa birlikka avtomatik aylantirilmaydi.</p>{error&&<p role="alert" className="text-red-700">{error}. Oxirgi ro‘yxat va draft saqlangan.</p>}{mutation.error&&<p role="alert">{mutation.error}</p>}{busy&&<p role="status">Server tasdig‘i kutilmoqda…</p>}{mutation.state==='saved'&&<p role="status">Birlik serverda saqlandi.</p>}
 <Card title={editing?'Birlik nomini tahrirlash':'Yangi birlik'}><form className="space-y-3" onChangeCapture={mutation.edited} onSubmit={e=>{e.preventDefault();void mutation.execute(()=>editing?api.units.update(editing.id,{name,precision:Number(precision)}):api.units.create({code,name,precision:Number(precision)}),()=>{reset();refresh();});}}><Input label="Kod" value={code} onChange={e=>setCode(e.target.value)} disabled={!!editing||busy||loading||!!error} pattern="[a-z][a-z0-9_-]{0,31}" maxLength={32} required/><Input label="Nomi" value={name} onChange={e=>setName(e.target.value)} disabled={busy||loading||!!error} maxLength={100} required/><Input label="Kasr aniqligi" type="number" value={precision} onChange={e=>setPrecision(e.target.value)} disabled={busy||loading||!!error} min={0} max={6} step={1} required/><div className="flex gap-2"><Button type="submit" disabled={busy||loading||!!error}>Saqlash</Button>{(editing||dirty)&&<Button type="button" disabled={busy||loading||!!error} onClick={()=>{if(confirmDiscard())reset();}}>Bekor qilish</Button>}</div></form></Card>
 {dirty&&<p role="status">Saqlanmagan birlik o‘zgarishlari bor.</p>}
 <form className="flex items-end gap-3" onSubmit={e=>{e.preventDefault();if(query.trim()===search&&page===1)refresh();else{setLoading(true);setSearch(query.trim());setPage(1);}}}><Input label="Birlik qidirish" maxLength={200} value={query} onChange={e=>setQuery(e.target.value)}/><Select label="Birlik holati" value={status} options={[{value:'all',label:'Barchasi'},{value:'active',label:'Faol'},{value:'archived',label:'Arxivlangan'}]} onChange={e=>{setLoading(true);setStatus(e.target.value);setPage(1);}}/><Button type="submit" disabled={busy||loading}>Qidirish</Button></form><CsvExportButton path="/units" params={{status,search}}/>
 <Card title="Birliklar">{loading?<p>Yuklanmoqda...</p>:<><table className="w-full text-sm"><thead><tr><th>Kod</th><th>Nomi</th><th>Aniqlik</th><th>Amallar</th></tr></thead><tbody>{units.map(unit=><tr key={unit.id} className="border-t"><td className="p-2">{unit.code}</td><td>{unit.name}{unit.isActive?'':' (arxiv)'}</td><td>{unit.precision}</td><td><div className="flex gap-2"><Button disabled={busy||loading||!!error} onClick={()=>{if(!confirmDiscard())return;setEditing(unit);setCode(unit.code);setName(unit.name);setPrecision(String(unit.precision));}}>Tahrirlash</Button><Button disabled={busy||loading||!!error} onClick={()=>{if(editing?.id===unit.id&&!confirmDiscard())return;void mutation.execute(()=>api.units.update(unit.id,{isActive:!unit.isActive}),()=>{if(editing?.id===unit.id)reset();refresh();});}}>{unit.isActive?'Arxivlash':'Faollashtirish'}</Button></div></td></tr>)}</tbody></table>{!units.length&&<p>Birlik topilmadi.</p>}</>}<Pagination page={page} pages={pages} busy={busy||loading} onPage={value=>{setLoading(true);setPage(value);}} retry={refresh}/></Card></div>;
}
