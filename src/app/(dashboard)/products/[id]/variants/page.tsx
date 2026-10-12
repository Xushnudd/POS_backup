'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {useAuth} from '@/context/AuthContext';
import {api} from '@/lib/api';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import DurableMutation from '@/components/forms/DurableMutation';
import PendingActions from '@/components/forms/PendingActions';
type Variant={id:string;name:string;sku:string;barcode:string;unit:string;salePrice:string;quantity:string;isActive:boolean;isDefault:boolean;options:Record<string,string>};
export default function VariantsPage(){const {id}=useParams<{id:string}>(),{organization,user,role}=useAuth();return organization&&user&&role?<Variants key={[organization.id,user.id,role,id].join(':')} id={id} manager={role!=='cashier'}/>:<p>Sessiya yuklanmoqda...</p>;}
function Variants({id,manager}:{id:string;manager:boolean}){
 const [rows,setRows]=useState<Variant[]>([]),[root,setRoot]=useState(''),[page,setPage]=useState(1),[pages,setPages]=useState(0),[revision,setRevision]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState(''),[selected,setSelected]=useState('');
 const [name,setName]=useState(''),[sku,setSku]=useState(''),[barcode,setBarcode]=useState(''),[price,setPrice]=useState(''),[reason,setReason]=useState(''),[options,setOptions]=useState([{name:'rang',value:''},{name:'o‘lcham',value:''}]);
 useUnsavedChanges(JSON.stringify(options)!==JSON.stringify([{name:'rang',value:''},{name:'o‘lcham',value:''}]));
 const returnPath='/products/'+id+'/variants',refresh=()=>setRevision(n=>n+1);
 useEffect(()=>{let live=true;void Promise.resolve().then(async()=>{if(!live)return;setBusy(true);setError('');try{const response=await api.request<Variant[]>(returnPath+'?page='+page+'&limit=20');if(live){setRows(response.data??[]);setPages(response.pagination?.totalPages??0);setRoot((response as typeof response&{root:{name:string}}).root.name);setError('');}}catch(e){if(live){setError(e instanceof Error?e.message:'Variantlar yuklanmadi');}}finally{if(live)setBusy(false);}});return()=>{live=false;};},[returnPath,page,revision]);
 const chosen=rows.find(r=>r.id===selected),body={name,sku,barcode,salePrice:price,reason,options:options.filter(o=>o.value.trim())};
 return <div className="space-y-4"><h1>Mahsulot variantlari: {root}</h1><Link href="/products">Mahsulotlarga qaytish</Link><p>Har variantning SKU, barkodi, narxi va qoldig‘i mustaqil. Eski mahsulot asl/default variant bo‘lib qoladi. Qoldiq faqat sizga ruxsat berilgan filiallar bo‘yicha. Variant yaratish omborga kirim qilmaydi; kirim alohida hujjat bilan bajariladi.</p>{error&&<p role="alert">{error} Oxirgi yuklangan variantlar va draft saqlanadi.</p>}{busy&&<p role="status">Variantlar yuklanmoqda...</p>}
 <PendingActions prefix="/products/" returnPath={returnPath} revision={revision} onDone={refresh}/>
 <Card title="Variantni tanlash"><table className="w-full text-sm"><thead><tr><th>Variant</th><th>Belgilar</th><th>SKU / barkod</th><th>Narx</th><th>Qoldiq</th><th>Tanlash</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.name}{r.isDefault?' (asl)':''}{!r.isActive?' (arxiv)':''}</td><td>{Object.entries(r.options).map(([k,v])=>k+': '+v).join(', ')||'Default'}</td><td>{r.sku} / {r.barcode}</td><td>{r.salePrice}</td><td>{r.quantity} {r.unit}</td><td><Button onClick={()=>setSelected(r.id)} disabled={!r.isActive}>Tanlash: {r.name}</Button></td></tr>)}</tbody></table>{chosen&&<p role="status">Tanlangan variant: {chosen.name} · SKU {chosen.sku} · barkod {chosen.barcode} · qoldiq {chosen.quantity} {chosen.unit}. Kassada aynan shu SKU yoki barkodni kiriting.</p>}<Pagination page={page} pages={pages} busy={busy} onPage={setPage} retry={refresh}/></Card>
 {manager&&<Card title="Yangi mustaqil variant"><DurableMutation canSubmit={!busy&&!error} returnPath={returnPath} path={returnPath} body={body} label="Mahsulot varianti" review={[name,'SKU: '+sku,'Barkod: '+barcode,'Narx: '+price,...body.options.map(o=>o.name+': '+o.value),reason,'Yangi variantning boshlang‘ich qoldig‘i 0.']} onDone={()=>{setName('');setSku('');setBarcode('');setPrice('');setReason('');setOptions([{name:'rang',value:''},{name:'o‘lcham',value:''}]);refresh()}}><Input label="Variant nomi" value={name} onChange={e=>setName(e.target.value)} maxLength={200}/><Input label="Variant SKU" value={sku} onChange={e=>setSku(e.target.value)} maxLength={100}/><Input label="Variant barkodi" value={barcode} onChange={e=>setBarcode(e.target.value)} maxLength={200}/><Input label="Variant narxi" value={price} onChange={e=>setPrice(e.target.value)} inputMode="decimal"/>{options.map((o,i)=><div className="flex gap-2" key={i}><Input label={'Variant belgisi '+(i+1)} value={o.name} onChange={e=>setOptions(v=>v.map((a,n)=>n===i?{...a,name:e.target.value}:a))} maxLength={40}/><Input label={'Variant qiymati '+(i+1)} value={o.value} onChange={e=>setOptions(v=>v.map((a,n)=>n===i?{...a,value:e.target.value}:a))} maxLength={80}/></div>)}<Button variant="outline" onClick={()=>setOptions(v=>v.length<8?[...v,{name:'',value:''}]:v)} disabled={options.length>=8}>Variant belgisi qo‘shish</Button><Input label="Variant yaratish sababi" value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000}/></DurableMutation></Card>}
 </div>;
}
