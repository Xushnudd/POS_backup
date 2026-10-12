'use client';
import {useEffect,useState} from 'react';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import Link from 'next/link';
import {useAuth} from '@/context/AuthContext';
import {api} from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import DurableMutation from '@/components/forms/DurableMutation';
import PendingActions from '@/components/forms/PendingActions';
type Brand={id:string;name:string;isActive:boolean};
export default function BrandsPage(){const {organization,user,role}=useAuth();return organization&&user&&role&&role!=='cashier'?<Brands key={[organization.id,user.id,role].join(':')}/>:<p>Brendlar uchun rahbar vakolati kerak.</p>;}
function Brands(){
 const [rows,setRows]=useState<Brand[]>([]),[name,setName]=useState(''),[editing,setEditing]=useState(''),[originalName,setOriginalName]=useState(''),[page,setPage]=useState(1),[pages,setPages]=useState(0),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[posting,setPosting]=useState(false),[error,setError]=useState('');
 const dirty=name!==originalName,confirmDiscard=useUnsavedChanges(dirty,posting),path='/brands'+(editing?'/'+editing:'');
 const refresh=()=>{setLoading(true);setRevision(n=>n+1);};
 const completed=(_result?:unknown,original?:Record<string,unknown>,savedPath=path)=>{if(savedPath===path&&original?.name===name){setName('');setOriginalName('');setEditing('');}refresh();};
 useEffect(()=>{let live=true;void api.request<Brand[]>('/brands?status=all&page='+page).then(r=>{if(live){setRows(r.data??[]);setPages(r.pagination?.totalPages??0);setError('');}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Brendlar yuklanmadi');}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[page,revision]);
 return <div className="space-y-3"><h1>Mahsulot brendlari</h1><Link href="/products">Mahsulotlarga qaytish</Link>{loading&&<p role="status">Brendlar yuklanmoqda…</p>}{error&&<p role="alert">{error}. Oxirgi yuklangan brendlar va draft saqlangan.</p>}
 <PendingActions prefix="/brands" returnPath="/products/brands" revision={revision} onDone={completed}/>
 <DurableMutation direct method={editing?'PUT':'POST'} path={path} returnPath="/products/brands" body={{name}} label="Brendni saqlash" canSubmit={!loading&&!error&&!posting} review={[name]} onSavingChange={setPosting} onDone={completed}><Input label="Brend nomi" value={name} maxLength={200} onChange={e=>setName(e.target.value)}/></DurableMutation>
 {dirty&&<p role="status">Saqlanmagan brend o‘zgarishlari bor.</p>}{(editing||dirty)&&<Button disabled={posting} onClick={()=>{if(confirmDiscard()){setEditing('');setName('');setOriginalName('');}}}>Bekor qilish</Button>}
 {rows.map(r=><div key={r.id}><p>{r.name} · {r.isActive?'Faol':'Arxiv'}</p><Button disabled={loading||posting||!!error} onClick={()=>{if(!confirmDiscard())return;setEditing(r.id);setName(r.name);setOriginalName(r.name);}}>Brendni tahrirlash: {r.name}</Button><DurableMutation direct method="PUT" path={'/brands/'+r.id} returnPath="/products/brands" body={{isActive:!r.isActive}} label={'Brend holati: '+r.name} review={[r.name,r.isActive?'Arxivlash':'Faollashtirish']} canSubmit={!loading&&!error&&!posting} onSavingChange={setPosting} onDone={refresh}/></div>)}
 <Pagination page={page} pages={pages} busy={loading||posting} onPage={value=>{setLoading(true);setPage(value);}} retry={refresh}/></div>;
}
