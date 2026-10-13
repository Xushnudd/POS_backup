'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useAuth} from '@/context/AuthContext';
import {useOrganization} from '@/context/OrganizationContext';
import {api} from '@/lib/api';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import CsvExportButton from '@/components/ui/CsvExportButton';
import BatchCount from '@/components/inventory/BatchCount';
import PendingActions from '@/components/forms/PendingActions';
import {confirmPageNavigation} from '@/lib/page-navigation';
import DurableMutation from '@/components/forms/DurableMutation';
import type {Product} from '@/types';
type Row={id:string;productId:string;productName:string;code:string;quantity:string;unit:string;receivedOn:string;expiresOn:string;state:string;alertDays:number};
type Result={rows:Row[];total:number;page:number;today:string};
const states={all:'Barchasi',expired:'Muddati o‘tgan',due_soon:'Muddati yaqin',valid:'Yaroqli'};
export default function BatchesPage(){
 const {organization,user,role}=useAuth(),{activeStore}=useOrganization();
 return organization&&user&&activeStore?<Editor key={[organization.id,user.id,activeStore.id,role].join(':')} storeId={activeStore.id} organizationId={organization.id} owner={role==='owner'} manager={role==='owner'||role==='admin'}/>:<p>Filial tanlang.</p>
}
function Editor({storeId,organizationId,owner,manager}:{storeId:string;organizationId:string;owner:boolean;manager:boolean}){
 const [countProduct,setCountProduct]=useState('');
 const [search,setSearch]=useState(''),[state,setState]=useState('all'),[page,setPage]=useState(1),[revision,setRevision]=useState(0),[result,setResult]=useState<Result|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true);
 const [productSearch,setProductSearch]=useState(''),[productPage,setProductPage]=useState(1),[products,setProducts]=useState<Product[]>([]),[productPages,setProductPages]=useState(0),[productError,setProductError]=useState(''),[productBusy,setProductBusy]=useState(true),[selected,setSelected]=useState<Product|null>(null),[alertDays,setAlertDays]=useState('30'),[reason,setReason]=useState(''),[posting,setPosting]=useState(false);
 useUnsavedChanges(Boolean(selected||reason||alertDays!=='30'),posting);
 useEffect(()=>{
  let live=true;const controller=new AbortController();
  void(async()=>{setBusy(true);setError('');try{const response=await api.request<Result>('/inventory/batches?'+new URLSearchParams({storeId,search,state,page:String(page)}),{cache:'no-store',signal:controller.signal});if(!response.data)throw Error('Partiya natijasi kelmadi');if(live)setResult(response.data)}catch(error){if(live)setError(error instanceof Error?error.message:'Partiya hisoboti yuklanmadi')}finally{if(live)setBusy(false)}})();
  return()=>{live=false;controller.abort()};
 },[storeId,search,state,page,revision]);
 useEffect(()=>{
  if(!owner)return;let live=true;const controller=new AbortController();
  void(async()=>{setProductBusy(true);setProductError('');try{const response=await api.request<Product[]>('/products?'+new URLSearchParams({organizationId,search:productSearch,page:String(productPage),limit:'20'}),{cache:'no-store',signal:controller.signal});if(!response.data)throw Error('Mahsulotlar kelmadi');if(live){setProducts(response.data);setProductPages(response.pagination?.totalPages??0)}}catch(error){if(live)setProductError(error instanceof Error?error.message:'Mahsulotlar yuklanmadi')}finally{if(live)setProductBusy(false)}})();return()=>{live=false;controller.abort()};
 },[owner,organizationId,productSearch,productPage,revision]);
 const refresh=()=>{setBusy(true);setProductBusy(true);setRevision(value=>value+1)};
 const daysValid=/^\d{1,4}$/.test(alertDays)&&Number(alertDays)<=3650;
 return <main className="space-y-5"><h1 className="text-2xl font-bold text-gray-900">Partiyalar va yaroqlilik</h1><PendingActions prefix="/inventory/batches" returnPath="/inventory/batches" revision={revision} onDone={()=>refresh()}/><Link href="/inventory">Omborga qaytish</Link><p>Kirim va tuzatish hujjatida partiya kodi va sanalarini kiriting. Kassada yaroqli partiyalar FEFO bo‘yicha tanlanadi. Muddati o‘tgan qoldiq savdo va transfer jo‘natish uchun yopiq.</p>
 <Input label="Partiya yoki mahsulot qidirish" value={search} onChange={event=>{setBusy(true);setPage(1);setSearch(event.target.value)}}/><Select label="Yaroqlilik holati" value={state} options={Object.entries(states).map(([value,label])=>({value,label}))} onChange={event=>{setBusy(true);setPage(1);setState(event.target.value)}}/>
 {error&&<p role="alert">{error}. Oldingi natija saqlandi; qayta yuklang.</p>}{busy&&<p role="status">Hisobot yuklanmoqda…</p>}{result&&<><p>Biznes kuni: {result.today}. Natijalar: {result.total}</p><div className="overflow-x-auto"><table className="min-w-full text-sm text-left"><thead className="bg-gray-50 text-gray-700"><tr>{['Mahsulot','Partiya','Qoldiq','Kirim','Yaroqlilik','Holat'].map(label=><th className="px-4 py-3 font-semibold whitespace-nowrap" key={label}>{label}</th>)}</tr></thead><tbody>{result.rows.map(row=><tr className="border-b border-gray-100" key={row.id}><td className="px-4 py-3 align-top whitespace-nowrap">{row.productName}{manager&&<Button disabled={posting} onClick={()=>{if(confirmPageNavigation())setCountProduct(row.productId)}}>Shu mahsulot partiyalarini sanash</Button>}</td><td className="px-4 py-3 align-top whitespace-nowrap">{row.code}</td><td className="px-4 py-3 align-top whitespace-nowrap">{row.quantity} {row.unit}</td><td className="px-4 py-3 align-top whitespace-nowrap">{row.receivedOn}</td><td className="px-4 py-3 align-top whitespace-nowrap">{row.expiresOn}</td><td className="px-4 py-3 align-top whitespace-nowrap">{states[row.state as keyof typeof states]??row.state}</td></tr>)}</tbody></table>{!result.rows.length&&<p>Tanlangan filtrda partiya topilmadi.</p>}</div></>}
 <Pagination page={page} pages={Math.ceil((result?.total??0)/50)} busy={busy||posting} onPage={value=>{setBusy(true);setPage(value)}} retry={refresh}/>{manager&&!busy&&!error&&<CsvExportButton path="/inventory/batches" params={{storeId,search,state}}/>}
 {manager&&countProduct&&<BatchCount key={countProduct} productId={countProduct} storeId={storeId} onDone={refresh}/>}
 {owner&&<section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4" aria-label="Partiya nazoratini sozlash"><h2 className="text-lg font-semibold">Mahsulot uchun nazorat</h2><p>Yoqish faqat ombor/savdo/transfer tarixi yo‘q mahsulot uchun mumkin; mavjud tarix taxminiy partiyalarga bo‘linmaydi. Yoqilgandan keyin nazorat o‘chirilmaydi.</p><Input label="Nazorat mahsulotini qidirish" value={productSearch} onChange={event=>{setProductBusy(true);setProductPage(1);setProductSearch(event.target.value)}}/>{productError&&<p role="alert">{productError}. Tanlov va sabab saqlandi.</p>}
 <DurableMutation path="/inventory/batches/policy" returnPath="/inventory/batches" label="Partiya nazoratini saqlash" body={{productId:selected?.id,expiryAlertDays:daysValid?Number(alertDays):alertDays,reason:reason.trim()}} review={['Mahsulot: '+(selected?.name??''),'Ogohlantirish: '+alertDays+' kun','Sabab: '+reason]} canSubmit={!productBusy&&!productError} allowNew={Boolean(selected&&daysValid&&reason.trim().length>=3)} onSavingChange={setPosting} onDone={(_result,original)=>{if(original&&selected&&original.productId===selected.id&&original.reason===reason.trim()&&original.expiryAlertDays===(daysValid?Number(alertDays):alertDays)){setSelected(null);setReason('');setAlertDays('30')}refresh()}}>
 <div className="flex flex-wrap gap-2">{products.map(product=><Button key={product.id} onClick={()=>setSelected(product)}>{product.name}{product.batchTracking?' — nazorat yoqilgan':''}</Button>)}</div><p>Tanlangan: {selected?.name??'—'}</p><Input label="Muddati yaqin ogohlantirish kunlari" inputMode="numeric" value={alertDays} onChange={event=>setAlertDays(event.target.value)}/><Input label="Partiya nazorati sababi" value={reason} onChange={event=>setReason(event.target.value)}/>
 </DurableMutation><Pagination page={productPage} pages={productPages} busy={productBusy||posting} onPage={value=>{setProductBusy(true);setProductPage(value)}} retry={refresh}/></section>}
 </main>
}
