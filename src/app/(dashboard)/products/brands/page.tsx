'use client';
import {Suspense,useEffect,useState} from 'react';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import Link from 'next/link';
import {useAuth} from '@/context/AuthContext';
import {api} from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import DurableMutation from '@/components/forms/DurableMutation';
import PendingActions from '@/components/forms/PendingActions';
import {useListQuery} from '@/hooks/useListQuery';
import {namedListSorts} from '@/lib/list-query';
import ListFilter from '@/components/ui/ListFilter';
import DataTable from '@/components/ui/DataTable';
import Select from '@/components/ui/Select';
type Brand={id:string;name:string;isActive:boolean};
export default function BrandsPage(){const {organization,user,role}=useAuth();return organization&&user&&role&&role!=='cashier'?<Suspense fallback={<p>Yuklanmoqda...</p>}><Brands key={[organization.id,user.id,role].join(':')}/></Suspense>:<p>Brendlar uchun rahbar vakolati kerak.</p>;}
function Brands(){
 const [rows,setRows]=useState<Brand[]>([]),[name,setName]=useState(''),[editing,setEditing]=useState(''),[originalName,setOriginalName]=useState(''),[pages,setPages]=useState(0),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[posting,setPosting]=useState(false),[error,setError]=useState('');
 const {query,params,changeQuery}=useListQuery(namedListSorts,'name_asc');
 const page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'name_asc',search=query?.search??'',status=params.get('status')??'all',invalidQuery=!query;
 const dirty=name!==originalName,confirmDiscard=useUnsavedChanges(dirty,posting),path='/brands'+(editing?'/'+editing:'');
 const refresh=()=>{setLoading(true);setRevision(n=>n+1);};
 const completed=(_result?:unknown,original?:Record<string,unknown>,savedPath=path)=>{if(savedPath===path&&original?.name===name){setName('');setOriginalName('');setEditing('');}refresh();};
 useEffect(()=>{if(invalidQuery)return;let live=true;void Promise.resolve().then(()=>{if(live)setLoading(true)});void api.request<Brand[]>('/brands?'+new URLSearchParams({page:String(page),limit:String(limit),status,search,sort})).then(r=>{if(live){setRows(r.data??[]);setPages(r.pagination?.totalPages??0);setError('');}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Brendlar yuklanmadi');}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[page,limit,status,search,sort,revision,invalidQuery]);
 return <div className="space-y-3"><h1>Mahsulot brendlari</h1><Link href="/products">Mahsulotlarga qaytish</Link>{loading&&<p role="status">Brendlar yuklanmoqda…</p>}{error&&<p role="alert">{error}. Oxirgi yuklangan brendlar va draft saqlangan.</p>}
 <PendingActions prefix="/brands" returnPath="/products/brands" revision={revision} onDone={completed}/>
 <DurableMutation direct method={editing?'PUT':'POST'} path={path} returnPath="/products/brands" body={{name}} label="Brendni saqlash" canSubmit={!loading&&!error&&!posting&&!invalidQuery} review={[name]} onSavingChange={setPosting} onDone={completed}><Input label="Brend nomi" value={name} maxLength={200} onChange={e=>setName(e.target.value)}/></DurableMutation>
 {dirty&&<p role="status">Saqlanmagan brend o‘zgarishlari bor.</p>}{(editing||dirty)&&<Button disabled={posting} onClick={()=>{if(confirmDiscard()){setEditing('');setName('');setOriginalName('');}}}>Bekor qilish</Button>}
 <ListFilter search={search} sort={sort} label="Brend qidirish" disabled={posting} onChange={changeQuery} reset={{status:''}} options={[{value:'name_asc',label:'Nom: A–Z'},{value:'name_desc',label:'Nom: Z–A'},{value:'newest',label:'Eng yangi'},{value:'oldest',label:'Eng eski'}]}><Select label="Brend holati" value={status} options={[{value:'all',label:'Barchasi'},{value:'active',label:'Faol'},{value:'archived',label:'Arxivlangan'}]} disabled={posting} onChange={e=>changeQuery({status:e.target.value,page:'1'})}/></ListFilter>
 {invalidQuery?<p role="alert">URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.</p>:!loading&&!error&&<><DataTable><thead><tr><th>Nomi / holati</th><th>Amallar</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><p>{r.name} · {r.isActive?'Faol':'Arxiv'}</p></td><td><Button disabled={loading||posting||!!error} onClick={()=>{if(!confirmDiscard())return;setEditing(r.id);setName(r.name);setOriginalName(r.name);}}>Brendni tahrirlash: {r.name}</Button><DurableMutation direct method="PUT" path={'/brands/'+r.id} returnPath="/products/brands" body={{isActive:!r.isActive}} label={'Brend holati: '+r.name} review={[r.name,r.isActive?'Arxivlash':'Faollashtirish']} canSubmit={!loading&&!error&&!posting&&!invalidQuery} onSavingChange={setPosting} onDone={refresh}/></td></tr>)}</tbody></DataTable>{!rows.length&&<p>Brend topilmadi.</p>}</>}
 <Pagination page={page} pages={pages} busy={loading||posting} blocked={invalidQuery||!!error} onPage={value=>changeQuery({page:String(value)})} retry={refresh}/>{!invalidQuery&&page>Math.max(1,pages)&&<Button onClick={()=>changeQuery({page:'1'})}>Birinchi sahifaga qaytish</Button>}</div>;
}
