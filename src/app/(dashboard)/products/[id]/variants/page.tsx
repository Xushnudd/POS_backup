'use client';




import {useTranslation} from '@/context/LocaleContext';

import {Suspense,useEffect,useState} from 'react';
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
import {useListQuery} from '@/hooks/useListQuery';
import {variantListSorts} from '@/lib/list-query';
import ListFilter from '@/components/ui/ListFilter';
import DataTable from '@/components/ui/DataTable';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Select from '@/components/ui/Select';
type Variant={id:string;name:string;sku:string;barcode:string;unit:string;salePrice:string;quantity:string;isActive:boolean;isDefault:boolean;options:Record<string,string>};
export default function VariantsPage(){
 const {t:tr}=useTranslation();
const {id}=useParams<{id:string}>(),{organization,user,role}=useAuth();return organization&&user&&role?<Suspense fallback={<LoadingSpinner/>}><Variants key={[organization.id,user.id,role,id].join(':')} id={id} manager={role!=='cashier'}/></Suspense>:<p>{tr("Sessiya yuklanmoqda...")}</p>;}
function Variants({id,manager}:{id:string;manager:boolean}){
 const {t:tr}=useTranslation();

 const {query,params,changeQuery}=useListQuery(variantListSorts,'source');
 const page=query?.page??1,limit=query?.limit??20,search=query?.search??'',sort=query?.sort??'source',status=params.get('status')??'all',invalidQuery=!query||!['all','active','archived'].includes(status);
 const [rows,setRows]=useState<Variant[]>([]),[root,setRoot]=useState(''),[pages,setPages]=useState(0),[revision,setRevision]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState(''),[selected,setSelected]=useState('');
 const [name,setName]=useState(''),[sku,setSku]=useState(''),[barcode,setBarcode]=useState(''),[price,setPrice]=useState(''),[reason,setReason]=useState(''),[options,setOptions]=useState([{name:'rang',value:''},{name:'o‘lcham',value:''}]);
 useUnsavedChanges(JSON.stringify(options)!==JSON.stringify([{name:'rang',value:''},{name:'o‘lcham',value:''}]));
 const returnPath='/products/'+id+'/variants',refresh=()=>setRevision(n=>n+1);
 useEffect(()=>{let live=true;void Promise.resolve().then(async()=>{if(!live||invalidQuery)return;setBusy(true);setError('');try{const response=await api.request<Variant[]>(returnPath+'?'+new URLSearchParams({page:String(page),limit:String(limit),sort,search,status}));if(live){setRows(response.data??[]);setPages(response.pagination?.totalPages??0);setRoot((response as typeof response&{root:{name:string}}).root.name);setError('');}}catch(e){if(live){setError(e instanceof Error?e.message:'Variantlar yuklanmadi');}}finally{if(live)setBusy(false);}});return()=>{live=false;};},[returnPath,page,limit,sort,search,status,invalidQuery,revision]);
 const chosen=rows.find(r=>r.id===selected),body={name,sku,barcode,salePrice:price,reason,options:options.filter(o=>o.value.trim())};
 return <div className="space-y-4"><h1>{tr("Mahsulot variantlari:")}{' '}{root}</h1><Link href="/products">{tr("Mahsulotlarga qaytish")}</Link><p>{tr("Har variantning SKU, barkodi, narxi va qoldig‘i mustaqil. Eski mahsulot asl/default variant bo‘lib qoladi. Qoldiq faqat sizga ruxsat berilgan filiallar bo‘yicha. Variant yaratish omborga kirim qilmaydi; kirim alohida hujjat bilan bajariladi.")}</p>{error&&<p role="alert">{error} {tr("Oxirgi yuklangan variantlar va draft saqlanadi.")}</p>}{busy&&!invalidQuery&&<p role="status">{tr("Variantlar yuklanmoqda...")}</p>}
 <PendingActions prefix="/products/" returnPath={returnPath} revision={revision} onDone={refresh}/>
 <Card title={tr("Variantni tanlash")}><ListFilter search={search} sort={sort} label={tr("Variant nomi, SKU yoki barkod qidirish")} onChange={changeQuery} reset={{status:''}} options={[{value:'source',label:tr("Asl ketma-ketlik")},{value:'name_asc',label:tr("Nom A → Z")},{value:'name_desc',label:tr("Nom Z → A")},{value:'price_asc',label:tr("Narx: o‘sish")},{value:'price_desc',label:tr("Narx: kamayish")}]}><Select label={tr("Variant holati")} value={status} options={[{value:'all',label:tr("Barcha variantlar")},{value:'active',label:tr("Faol")},{value:'archived',label:tr("Arxiv")}]} onChange={e=>changeQuery({status:e.target.value,page:'1'})}/></ListFilter>{invalidQuery&&<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>}{!invalidQuery&&!busy&&!error&&!rows.length&&<p>{tr("Variant topilmadi.")}</p>}<DataTable className="w-full text-sm"><thead><tr><th>{tr("Variant")}</th><th>{tr("Belgilar")}</th><th>{tr("SKU / barkod")}</th><th>{tr("Narx")}</th><th>{tr("Qoldiq")}</th><th>{tr("Tanlash")}</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.name}{r.isDefault?tr("(asl)"):''}{!r.isActive?tr("(arxiv)"):''}</td><td>{Object.entries(r.options).map(([k,v])=>k+': '+v).join(', ')||tr("Default")}</td><td>{r.sku} / {r.barcode}</td><td>{r.salePrice}</td><td>{r.quantity} {r.unit}</td><td><Button onClick={()=>setSelected(r.id)} disabled={!r.isActive}>{tr("Tanlash:")}{' '}{r.name}</Button></td></tr>)}</tbody></DataTable>{chosen&&<p role="status">{tr("Tanlangan variant:")}{' '}{chosen.name} {tr("· SKU")}{' '}{chosen.sku} {tr("· barkod")}{' '}{chosen.barcode} {tr("· qoldiq")}{' '}{chosen.quantity} {chosen.unit}{tr(". Kassada aynan shu SKU yoki barkodni kiriting.")}</p>}<Pagination page={page} pages={pages} busy={busy&&!invalidQuery} blocked={invalidQuery||!!error} onPage={value=>changeQuery({page:String(value)})} retry={refresh}/></Card>
 {manager&&<Card title={tr("Yangi mustaqil variant")}><DurableMutation canSubmit={!busy&&!error&&!invalidQuery} returnPath={returnPath} path={returnPath} body={body} label={tr("Mahsulot varianti")} review={[name,'SKU: '+sku,'Barkod: '+barcode,'Narx: '+price,...body.options.map(o=>o.name+': '+o.value),reason,'Yangi variantning boshlang‘ich qoldig‘i 0.']} onDone={()=>{setName('');setSku('');setBarcode('');setPrice('');setReason('');setOptions([{name:'rang',value:''},{name:'o‘lcham',value:''}]);refresh()}}><Input label={tr("Variant nomi")} value={name} onChange={e=>setName(e.target.value)} maxLength={200}/><Input label={tr("Variant SKU")} value={sku} onChange={e=>setSku(e.target.value)} maxLength={100}/><Input label={tr("Variant barkodi")} value={barcode} onChange={e=>setBarcode(e.target.value)} maxLength={200}/><Input label={tr("Variant narxi")} value={price} onChange={e=>setPrice(e.target.value)} inputMode="decimal"/>{options.map((o,i)=><div className="flex gap-2" key={i}><Input label={'Variant belgisi '+(i+1)} value={o.name} onChange={e=>setOptions(v=>v.map((a,n)=>n===i?{...a,name:e.target.value}:a))} maxLength={40}/><Input label={'Variant qiymati '+(i+1)} value={o.value} onChange={e=>setOptions(v=>v.map((a,n)=>n===i?{...a,value:e.target.value}:a))} maxLength={80}/></div>)}<Button variant="outline" onClick={()=>setOptions(v=>v.length<8?[...v,{name:'',value:''}]:v)} disabled={options.length>=8}>{tr("Variant belgisi qo‘shish")}</Button><Input label={tr("Variant yaratish sababi")} value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000}/></DurableMutation></Card>}
 </div>;
}
