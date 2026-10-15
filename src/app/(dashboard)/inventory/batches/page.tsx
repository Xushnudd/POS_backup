'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {localizeOwnedLabels} from '@/i18n/messages';

import {useTranslation} from '@/context/LocaleContext';

import {Suspense,useEffect,useState} from 'react';
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
import {useListQuery} from '@/hooks/useListQuery';
import {batchListSorts} from '@/lib/list-query';
import ListFilter from '@/components/ui/ListFilter';
import DataTable from '@/components/ui/DataTable';
type Row={id:string;productId:string;productName:string;code:string;quantity:string;unit:string;receivedOn:string;expiresOn:string;state:string;alertDays:number};
type Result={rows:Row[];total:number;page:number;limit:number;today:string};
const states={all:'Barchasi',expired:'Muddati o‘tgan',due_soon:'Muddati yaqin',valid:'Yaroqli'};
const statesSource=states;
export default function BatchesPage(){
 const {t:tr}=useTranslation();

 const {organization,user,role}=useAuth(),{activeStore}=useOrganization();
 return organization&&user&&activeStore?<Suspense fallback={<p>{tr("Yuklanmoqda...")}</p>}><Editor key={[organization.id,user.id,activeStore.id,role].join(':')} storeId={activeStore.id} organizationId={organization.id} owner={role==='owner'} manager={role==='owner'||role==='admin'}/></Suspense>:<p>{tr("Filial tanlang.")}</p>
}
function Editor({storeId,organizationId,owner,manager}:{storeId:string;organizationId:string;owner:boolean;manager:boolean}){
 const {message:uiMessage}=useTranslation();

 const {locale:mapLocale}=useTranslation();

 const states=localizeOwnedLabels(statesSource,mapLocale);

 const {t:tr}=useTranslation();

 const [countProduct,setCountProduct]=useState('');
 const {query,params,changeQuery}=useListQuery(batchListSorts,'expiry_asc');
 const page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'expiry_asc',search=query?.search??'',state=params.get('state')??'all',invalidQuery=!query;
 const [revision,setRevision]=useState(0),[result,setResult]=useState<Result|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true);
 const [productSearch,setProductSearch]=useState(''),[productPage,setProductPage]=useState(1),[products,setProducts]=useState<Product[]>([]),[productPages,setProductPages]=useState(0),[productError,setProductError]=useState(''),[productBusy,setProductBusy]=useState(true),[selected,setSelected]=useState<Product|null>(null),[alertDays,setAlertDays]=useState('30'),[reason,setReason]=useState(''),[posting,setPosting]=useState(false);
 useUnsavedChanges(Boolean(selected||reason||alertDays!=='30'),posting);
 useEffect(()=>{
  if(invalidQuery)return;let live=true;const controller=new AbortController();
  void(async()=>{setBusy(true);setError('');try{const response=await api.request<Result>('/inventory/batches?'+new URLSearchParams({storeId,search,state,page:String(page),limit:String(limit),sort}),{cache:'no-store',signal:controller.signal});if(!response.data)throw Error('Partiya natijasi kelmadi');if(live)setResult(response.data)}catch(error){if(live)setError(displayErrorMessage(error,'Partiya hisoboti yuklanmadi'))}finally{if(live)setBusy(false)}})();
  return()=>{live=false;controller.abort()};
 },[storeId,search,state,page,limit,sort,revision,invalidQuery]);
 useEffect(()=>{
  if(!owner)return;let live=true;const controller=new AbortController();
  void(async()=>{setProductBusy(true);setProductError('');try{const response=await api.request<Product[]>('/products?'+new URLSearchParams({organizationId,search:productSearch,page:String(productPage),limit:'20'}),{cache:'no-store',signal:controller.signal});if(!response.data)throw Error('Mahsulotlar kelmadi');if(live){setProducts(response.data);setProductPages(response.pagination?.totalPages??0)}}catch(error){if(live)setProductError(displayErrorMessage(error,'Mahsulotlar yuklanmadi'))}finally{if(live)setProductBusy(false)}})();return()=>{live=false;controller.abort()};
 },[owner,organizationId,productSearch,productPage,revision]);
 const refresh=()=>{setBusy(true);setProductBusy(true);setRevision(value=>value+1)};
 const daysValid=/^\d{1,4}$/.test(alertDays)&&Number(alertDays)<=3650;
 return <main className="space-y-5"><h1 className="text-2xl font-bold text-gray-900">{tr("Partiyalar va yaroqlilik")}</h1><PendingActions prefix="/inventory/batches" returnPath="/inventory/batches" revision={revision} onDone={()=>refresh()}/><Link href="/inventory">{tr("Omborga qaytish")}</Link><p>{tr("Kirim va tuzatish hujjatida partiya kodi va sanalarini kiriting. Kassada yaroqli partiyalar FEFO bo‘yicha tanlanadi. Muddati o‘tgan qoldiq savdo va transfer jo‘natish uchun yopiq.")}</p>
 <ListFilter search={search} sort={sort} label={tr("Partiya yoki mahsulot qidirish")} disabled={posting} onChange={changeQuery} reset={{state:''}} options={[{value:'expiry_asc',label:tr("Yaroqlilik: avval tugaydigan")},{value:'expiry_desc',label:tr("Yaroqlilik: keyin tugaydigan")},{value:'code',label:tr("Kod bo‘yicha")}]}><Select label={tr("Yaroqlilik holati")} value={state} options={Object.entries(states).map(([value,label])=>({value,label}))} onChange={event=>changeQuery({state:event.target.value,page:'1'})}/></ListFilter>{invalidQuery&&<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>}
 {error&&<p role="alert">{uiMessage(error)}{tr(". Oldingi natija saqlandi; qayta yuklang.")}</p>}{busy&&<p role="status">{tr("Hisobot yuklanmoqda…")}</p>}{!busy&&!error&&!invalidQuery&&result&&<><p>{tr("Biznes kuni:")}{' '}{result.today}{tr(". Natijalar:")}{' '}{result.total}</p><div className="overflow-x-auto"><DataTable className="min-w-full text-sm text-left"><thead className="bg-gray-50 text-gray-700"><tr>{[tr("Mahsulot"),tr("Partiya"),tr("Qoldiq"),tr("Kirim"),tr("Yaroqlilik"),tr("Holat")].map(label=><th className="px-4 py-3 font-semibold whitespace-nowrap" key={label}>{label}</th>)}</tr></thead><tbody>{result.rows.map(row=><tr className="border-b border-gray-100" key={row.id}><td className="px-4 py-3 align-top whitespace-nowrap">{row.productName}{manager&&<Button disabled={posting} onClick={()=>{if(confirmPageNavigation())setCountProduct(row.productId)}}>{tr("Shu mahsulot partiyalarini sanash")}</Button>}</td><td className="px-4 py-3 align-top whitespace-nowrap">{row.code}</td><td className="px-4 py-3 align-top whitespace-nowrap">{row.quantity} {row.unit}</td><td className="px-4 py-3 align-top whitespace-nowrap">{row.receivedOn}</td><td className="px-4 py-3 align-top whitespace-nowrap">{row.expiresOn}</td><td className="px-4 py-3 align-top whitespace-nowrap">{states[row.state as keyof typeof states]??row.state}</td></tr>)}</tbody></DataTable>{!result.rows.length&&<p>{tr("Tanlangan filtrda partiya topilmadi.")}</p>}</div></>}
 <Pagination page={page} pages={Math.ceil((result?.total??0)/limit)} busy={busy&&!invalidQuery||posting} blocked={invalidQuery||!!error} onPage={value=>changeQuery({page:String(value)})} retry={refresh}/>{manager&&!busy&&!error&&<CsvExportButton path="/inventory/batches" params={{storeId,search,state,sort}}/>}
 {manager&&countProduct&&<BatchCount key={countProduct} productId={countProduct} storeId={storeId} onDone={refresh}/>}
 {owner&&<section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4" aria-label={tr("Partiya nazoratini sozlash")}><h2 className="text-lg font-semibold">{tr("Mahsulot uchun nazorat")}</h2><p>{tr("Yoqish faqat ombor/savdo/transfer tarixi yo‘q mahsulot uchun mumkin; mavjud tarix taxminiy partiyalarga bo‘linmaydi. Yoqilgandan keyin nazorat o‘chirilmaydi.")}</p><Input label={tr("Nazorat mahsulotini qidirish")} value={productSearch} onChange={event=>{setProductBusy(true);setProductPage(1);setProductSearch(event.target.value)}}/>{productError&&<p role="alert">{uiMessage(productError)}{tr(". Tanlov va sabab saqlandi.")}</p>}
 <DurableMutation path="/inventory/batches/policy" returnPath="/inventory/batches" label={tr("Partiya nazoratini saqlash")} body={{productId:selected?.id,expiryAlertDays:daysValid?Number(alertDays):alertDays,reason:reason.trim()}} review={[tr("Mahsulot:")+" "+(selected?.name??''),tr("Ogohlantirish:")+" "+alertDays+" "+tr("kun"),tr("Sabab:")+" "+reason]} canSubmit={!productBusy&&!productError} allowNew={Boolean(selected&&daysValid&&reason.trim().length>=3)} onSavingChange={setPosting} onDone={(_result,original)=>{if(original&&selected&&original.productId===selected.id&&original.reason===reason.trim()&&original.expiryAlertDays===(daysValid?Number(alertDays):alertDays)){setSelected(null);setReason('');setAlertDays('30')}refresh()}}>
 <div className="flex flex-wrap gap-2">{products.map(product=><Button key={product.id} onClick={()=>setSelected(product)}>{product.name}{product.batchTracking?tr("— nazorat yoqilgan"):''}</Button>)}</div><p>{tr("Tanlangan:")}{' '}{selected?.name??'—'}</p><Input label={tr("Muddati yaqin ogohlantirish kunlari")} inputMode="numeric" value={alertDays} onChange={event=>setAlertDays(event.target.value)}/><Input label={tr("Partiya nazorati sababi")} value={reason} onChange={event=>setReason(event.target.value)}/>
 </DurableMutation><Pagination page={productPage} pages={productPages} busy={productBusy||posting} onPage={value=>{setProductBusy(true);setProductPage(value)}} retry={refresh}/></section>}
 </main>
}
