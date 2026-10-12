'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import {useAcknowledgedMutation} from '@/hooks/useAcknowledgedMutation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import type { Supplier } from '@/types';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import CsvExportButton from '@/components/ui/CsvExportButton';
const empty={name:'',phone:'',tin:'',address:'',note:'',bankName:'',bankAccount:'',paymentTerms:''};
export default function SuppliersPage(){const {organization,user,role}=useAuth();return organization&&user&&role&&role!=='cashier'?<Suppliers key={[organization.id,user.id,role].join(':')}/>:<p>Yetkazib beruvchilarni boshqarish uchun rahbar vakolati kerak.</p>;}
function Suppliers(){
 const {organization,role}=useAuth();
 const [rows,setRows]=useState<Supplier[]>([]),[page,setPage]=useState(1),[pages,setPages]=useState(0),[status,setStatus]=useState('active'),[search,setSearch]=useState(''),[query,setQuery]=useState(''),[busy,setBusy]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [editing,setEditing]=useState<Supplier|null>(null),[open,setOpen]=useState(false),[draft,setDraft]=useState(empty);
 const mutation=useAcknowledgedMutation(!busy&&!error),saving=mutation.saving;
 const refresh=()=>{setBusy(true);setRetry(x=>x+1);};
 const dirty=open&&(Object.keys(empty) as (keyof typeof empty)[]).some(key=>draft[key]!==String(editing?.[key]??''));
 const confirmDiscard=useUnsavedChanges(dirty,saving);
 useEffect(()=>{if(!organization||!role||role==='cashier')return;let cancelled=false;void Promise.resolve().then(async()=>{if(cancelled)return;setBusy(true);setError('');try{const res=await api.suppliers.list(organization.id,{status,search:query,page:String(page),limit:'20'});if(!cancelled){setRows(res.data??[]);setPages(res.pagination?.totalPages??0);}}catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Ro‘yxat yuklanmadi');}finally{if(!cancelled)setBusy(false);}});return()=>{cancelled=true;};},[organization,role,page,status,query,retry]);
 if(!organization||!role||role==='cashier')return <p>Yetkazib beruvchilarni boshqarish uchun rahbar vakolati kerak.</p>;
 return <div className="space-y-4"><h1 className="text-2xl font-bold">Yetkazib beruvchilar</h1><div className="flex gap-3"><Button disabled={saving||busy||!!error} onClick={()=>{if(!confirmDiscard())return;setEditing(null);setDraft(empty);setOpen(true);}}>Yangi yetkazib beruvchi</Button><CsvExportButton path="/suppliers" params={{organizationId:organization.id,status,search:query}}/></div>
 <form className="flex items-end gap-3" onSubmit={e=>{e.preventDefault();if(search.trim()===query&&page===1)refresh();else{setBusy(true);setQuery(search.trim());setPage(1);}}}><Input label="Nomi, telefon yoki STIR" maxLength={200} value={search} onChange={e=>setSearch(e.target.value)}/><Select label="Holat" value={status} disabled={saving||busy||!!error} options={[{value:'active',label:'Faol'},{value:'archived',label:'Arxivlangan'},{value:'all',label:'Barchasi'}]} onChange={e=>{setBusy(true);setStatus(e.target.value);setPage(1);}}/><Button type="submit" disabled={busy||saving}>Qidirish</Button></form>
 {error&&<p role="alert">{error}. Oxirgi ro‘yxat va draft saqlangan.</p>}{mutation.error&&<p role="alert">{mutation.error}</p>}{saving&&<p role="status">Server tasdig‘i kutilmoqda…</p>}{mutation.state==='saved'&&<p role="status">Yetkazib beruvchi serverda saqlandi.</p>}
 <Card>{busy?<p>Yuklanmoqda...</p>:<><table className="w-full text-sm"><thead><tr><th>Nomi</th><th>Telefon / STIR</th><th>Manzil</th><th>Holat / amal</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t"><td className="p-2"><Link href={`/suppliers/${row.id}`} className="text-blue-700 underline">{row.name}</Link><p className="text-xs whitespace-pre-wrap">{row.note}</p></td><td>{row.phone}<p>{row.tin}</p></td><td>{row.address}</td><td>{row.isActive?'Faol':'Arxivlangan'}<div className="flex gap-2"><Button disabled={saving||busy||!!error} onClick={()=>{if(!confirmDiscard())return;setEditing(row);setDraft({name:row.name,phone:row.phone??'',tin:row.tin??'',address:row.address??'',note:row.note??'',bankName:row.bankName??'',bankAccount:row.bankAccount??'',paymentTerms:row.paymentTerms??''});setOpen(true);}}>Tahrirlash</Button><Button disabled={saving||busy||!!error} onClick={()=>void mutation.execute(()=>api.suppliers.update(row.id,{isActive:!row.isActive}),refresh)}>{row.isActive?'Arxivlash':'Tiklash'}</Button></div></td></tr>)}</tbody></table>{!rows.length&&<p>Yetkazib beruvchi topilmadi.</p>}</>}
 <div className="flex gap-3 mt-3"><Button disabled={busy||saving||page<=1} onClick={()=>{setBusy(true);setPage(x=>x-1);}}>Oldingi</Button><span>{page} / {Math.max(1,pages)}</span><Button disabled={busy||saving||page>=pages} onClick={()=>{setBusy(true);setPage(x=>x+1);}}>Keyingi</Button><Button disabled={busy||saving} onClick={refresh}>Qayta yuklash</Button></div></Card>
 <Modal isOpen={open} onClose={()=>{if(confirmDiscard())setOpen(false);}} title={editing?'Yetkazib beruvchini tahrirlash':'Yangi yetkazib beruvchi'}><form className="space-y-3" onChangeCapture={mutation.edited} onSubmit={e=>{e.preventDefault();void mutation.execute(()=>editing?api.suppliers.update(editing.id,draft):api.suppliers.create({...draft,organizationId:organization.id}),()=>{setOpen(false);refresh();});}}>{(Object.keys(empty) as (keyof typeof empty)[]).map(key=><Input key={key} label={{name:'Nomi',phone:'Telefon',tin:'STIR',address:'Manzil',note:'Izoh',bankName:'Bank nomi',bankAccount:'Bank hisob raqami',paymentTerms:'To‘lov va yetkazish shartlari'}[key]} required={key==='name'} minLength={key==='name'?2:undefined} maxLength={{name:200,phone:64,tin:64,address:500,note:2000,bankName:200,bankAccount:128,paymentTerms:2000}[key]} value={draft[key]} disabled={saving||busy||!!error} onChange={e=>setDraft({...draft,[key]:e.target.value})}/>)}{error&&<p role="alert">{error}</p>}{mutation.error&&<p role="alert">{mutation.error}</p>}<Button type="submit" disabled={saving||busy||!!error}>Saqlash</Button>{dirty&&<p role="status">Saqlanmagan yetkazib beruvchi o‘zgarishlari bor.</p>}</form></Modal></div>;
}
