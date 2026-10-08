'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api} from '@/lib/api';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
export default function TaxProfilePicker({value,name,onChange,disabled}:{value:string;name?:string;onChange:(id:string)=>void;disabled?:boolean}){const [rows,setRows]=useState<{id:string;name:string}[]>([]),[search,setSearch]=useState(''),[page,setPage]=useState(1),[pages,setPages]=useState(0),[revision,setRevision]=useState(0),[error,setError]=useState('');useEffect(()=>{let live=true;void api.request<{id:string;name:string}[]>('/taxes?search='+encodeURIComponent(search)+'&page='+page+'&limit=20').then(r=>{if(live){setRows(r.data??[]);setPages(r.pagination?.totalPages??0);setError('');}}).catch(e=>{if(live)setError(String(e));});return()=>{live=false;};},[page,search,revision]);return <div><Link href="/settings/taxes">Soliq siyosati va tarix</Link><Input label="Soliq profili qidirish" value={search} maxLength={200} onChange={e=>{setSearch(e.target.value);setPage(1);}}/><Select label="Mahsulot soliq profili" value={value} disabled={disabled} options={[{value:'',label:'Soliq siyosati belgilanmagan'},...(value&&!rows.some(r=>r.id===value)?[{value,label:name||'Joriy profil'}]:[]),...rows.map(r=>({value:r.id,label:r.name}))]} onChange={e=>onChange(e.target.value)}/>{error&&<p role="alert">{error}</p>}<Pagination page={page} pages={pages} busy={!!disabled} onPage={setPage} retry={()=>setRevision(n=>n+1)}/></div>;}
