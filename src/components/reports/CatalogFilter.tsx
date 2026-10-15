'use client';
import {useTranslation} from '@/context/LocaleContext';

import {useEffect,useState} from 'react';
import {api} from '@/lib/api';
import {useAuth} from '@/context/AuthContext';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
export default function CatalogFilter({kind,value,onChange}:{kind:'supplier'|'product';value:string;onChange:(value:string)=>void}){
 const {t:tr}=useTranslation();

 const {organization}=useAuth();const label=kind==='supplier'?'Yetkazib beruvchi':'Mahsulot';
 const [query,setQuery]=useState(''),[rows,setRows]=useState<Array<{id:string;name:string}>>([]),[selected,setSelected]=useState<{id:string;name:string}|null>(null),[page,setPage]=useState(1),[pages,setPages]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let cancelled=false;const timer=setTimeout(async()=>{if(!organization)return;setBusy(true);setError('');try{const response=kind==='supplier'?await api.suppliers.list(organization.id,{search:query,page:String(page),limit:'20',status:'all'}):await api.products.list({organizationId:organization.id,search:query,page,limit:20,status:'all'});if(!cancelled){setRows(response.data??[]);setPages(response.pagination?.totalPages??0);}}catch(error){if(!cancelled){setRows([]);setError(error instanceof Error?error.message:'Qidirish amalga oshmadi');}}finally{if(!cancelled)setBusy(false);}},200);return()=>{cancelled=true;clearTimeout(timer);};},[organization,kind,query,page,retry]);
 const options=selected&&selected.id===value&&!rows.some(row=>row.id===value)?[selected,...rows]:rows;
 return <div><Input label={label+' qidirish'} maxLength={200} value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/><Select label={label} value={value} disabled={busy} onChange={e=>{setSelected(options.find(row=>row.id===e.target.value)??null);onChange(e.target.value);}} options={[{value:'',label:tr("Barchasi")},...options.map(row=>({value:row.id,label:row.name}))]}/>{error&&<p role="alert">{error}</p>}<Pagination page={page} pages={pages} busy={busy} onPage={setPage} retry={()=>setRetry(x=>x+1)}/></div>;
}
