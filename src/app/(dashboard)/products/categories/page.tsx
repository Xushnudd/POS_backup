'use client';
import { useEffect,useState } from 'react';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import {useAcknowledgedMutation} from '@/hooks/useAcknowledgedMutation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import type { Category } from '@/types';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import CsvExportButton from '@/components/ui/CsvExportButton';
export default function CategoriesPage(){const {organization,user,role}=useAuth();return organization&&user&&role&&role!=='cashier'?<Categories key={[organization.id,user.id,role].join(':')}/>:<p>Kategoriyalarni boshqarish uchun rahbar vakolati kerak.</p>;}
function Categories(){
 const {organization,role}=useAuth();
 const [rows,setRows]=useState<Category[]>([]),[page,setPage]=useState(1),[pages,setPages]=useState(0),[status,setStatus]=useState('active'),[draftSearch,setDraftSearch]=useState(''),[search,setSearch]=useState(''),[retry,setRetry]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const [editing,setEditing]=useState<Category|null>(null),[name,setName]=useState(''),[sortOrder,setSortOrder]=useState('0'),[parentId,setParentId]=useState('');
 const mutation=useAcknowledgedMutation(!busy&&!error),saving=mutation.saving;
 const refresh=()=>{setBusy(true);setRetry(x=>x+1);};
 const dirty=name!==(editing?.name??'')||sortOrder!==String(editing?.sortOrder??0)||parentId!==(editing?.parentId??'');
 const confirmDiscard=useUnsavedChanges(dirty,saving);
 useEffect(()=>{if(!organization||!role||role==='cashier')return;let cancelled=false;void Promise.resolve().then(async()=>{if(cancelled)return;setBusy(true);setError('');try{const response=await api.categories.list(organization.id,{page:String(page),limit:'20',status,search});if(!cancelled){setRows(response.data??[]);setPages(response.pagination?.totalPages??0);}}catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Kategoriyalar yuklanmadi');}finally{if(!cancelled)setBusy(false);}});return()=>{cancelled=true;};},[organization,role,page,status,search,retry]);
 if(!organization||!role||role==='cashier')return <p>Kategoriyalarni boshqarish uchun rahbar vakolati kerak.</p>;
 const reset=()=>{setEditing(null);setName('');setSortOrder('0');setParentId('');};
 return <div className="max-w-4xl space-y-4"><h1 className="text-2xl font-bold">Kategoriyalar</h1><Link href="/products" className="text-blue-700">Mahsulotlarga qaytish</Link><p>Tartib kichikdan kattaga. Arxivlash mahsulot va savdo tarixini o‘zgartirmaydi.</p>{error&&<p role="alert">{error}. Oxirgi ro‘yxat va draft saqlangan.</p>}{mutation.error&&<p role="alert">{mutation.error}</p>}{saving&&<p role="status">Server tasdig‘i kutilmoqda…</p>}{mutation.state==='saved'&&<p role="status">Kategoriya serverda saqlandi.</p>}
 <Card title={editing?'Kategoriyani tahrirlash':'Yangi kategoriya'}><form className="flex flex-wrap items-end gap-3" onChangeCapture={mutation.edited} onSubmit={e=>{e.preventDefault();const data={name,sortOrder:Number(sortOrder),parentId:parentId||null};void mutation.execute(()=>editing?api.categories.update(editing.id,data):api.categories.create({organizationId:organization.id,...data}),()=>{reset();refresh();});}}><Input label="Kategoriya nomi" minLength={2} maxLength={200} value={name} disabled={saving||busy||!!error} required onChange={e=>setName(e.target.value)}/><Input label="Tartib raqami" type="number" step="1" min={-2147483648} max={2147483647} value={sortOrder} disabled={saving||busy||!!error} required onChange={e=>setSortOrder(e.target.value)}/><Select label="Ota kategoriya" value={parentId} disabled={saving||busy||!!error} onChange={e=>setParentId(e.target.value)} options={[{value:'',label:'Asosiy kategoriya'},...(parentId&&!rows.some(r=>r.id===parentId)?[{value:parentId,label:editing?.parent?.name||'Joriy ota kategoriya'}]:[]),...rows.filter(r=>r.id!==editing?.id).map(r=>({value:r.id,label:r.name}))]}/><Button type="submit" disabled={saving||busy||!!error}>Saqlash</Button>{(editing||dirty)&&<Button type="button" disabled={saving||busy||!!error} onClick={()=>{if(confirmDiscard())reset();}}>Bekor qilish</Button>}</form></Card>
 {dirty&&<p role="status">Saqlanmagan kategoriya o‘zgarishlari bor.</p>}
 <form className="flex items-end gap-3" onSubmit={e=>{e.preventDefault();if(draftSearch.trim()===search&&page===1)refresh();else{setBusy(true);setSearch(draftSearch.trim());setPage(1);}}}><Input label="Kategoriya qidirish" value={draftSearch} maxLength={200} onChange={e=>setDraftSearch(e.target.value)}/><Select label="Kategoriya holati" value={status} options={[{value:'active',label:'Faol'},{value:'archived',label:'Arxivlangan'},{value:'all',label:'Barchasi'}]} onChange={e=>{setBusy(true);setStatus(e.target.value);setPage(1);}}/><Button type="submit" disabled={busy||saving}>Qidirish</Button></form>
 <CsvExportButton path="/categories" params={{organizationId:organization.id,status,search}}/>
 <Card>{busy?<p>Yuklanmoqda...</p>:<><table className="w-full text-sm"><thead><tr><th>Nomi</th><th>Tartib</th><th>Holat</th><th>Amallar</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t"><td className="p-2">{row.name}<p className="text-xs">Ota: {row.parent?.name||'Asosiy'}</p></td><td>{row.sortOrder}</td><td>{row.isActive?'Faol':'Arxivlangan'}</td><td><div className="flex gap-2"><Button disabled={saving||busy||!!error} onClick={()=>{if(!confirmDiscard())return;setEditing(row);setName(row.name);setSortOrder(String(row.sortOrder));setParentId(row.parentId??'');}}>Tahrirlash</Button><Button disabled={saving||busy||!!error} onClick={()=>{if(editing?.id===row.id&&!confirmDiscard())return;void mutation.execute(()=>api.categories.update(row.id,{isActive:!row.isActive}),()=>{if(editing?.id===row.id)reset();refresh();});}}>{row.isActive?'Arxivlash':'Tiklash'}</Button></div></td></tr>)}</tbody></table>{!rows.length&&<p>Kategoriya topilmadi.</p>}</>}<Pagination page={page} pages={pages} busy={busy||saving} onPage={value=>{setBusy(true);setPage(value);}} retry={refresh}/></Card></div>;
}
