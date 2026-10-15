'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import {useEffect,useState,useRef} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {useAuth} from '@/context/AuthContext';
import {api} from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import type {Product} from '@/types';
import DurableMutation from '@/components/forms/DurableMutation';
import TaxProfilePicker from '@/components/forms/TaxProfilePicker';
import PendingActions from '@/components/forms/PendingActions';
import {useUnsavedChanges,confirmUnsavedChanges} from '@/hooks/useUnsavedChanges';
type Asset={id:string;url:string;name:string;size:number;expiresAt:string|null;deletedAt:string|null};
export default function ProductMediaPage(){
 const {t:tr}=useTranslation();
const {id}=useParams<{id:string}>(),{organization,user,role}=useAuth();return organization&&user&&role&&role!=='cashier'?<Editor key={[organization.id,user.id,role,id].join(':')} id={id}/>:<p>{tr("Katalogni boshqarish uchun rahbar vakolati kerak.")}</p>;}
function Editor({id}:{id:string}){
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

 const [product,setProduct]=useState<Product|null>(null),[assets,setAssets]=useState<Asset[]>([]),[description,setDescription]=useState(''),[taxProfileId,setTaxProfileId]=useState(''),[brandId,setBrandId]=useState(''),[brands,setBrands]=useState<{id:string;name:string}[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[page,setPage]=useState(1),[pages,setPages]=useState(0),[quota,setQuota]=useState(''),[brandSearch,setBrandSearch]=useState(''),[brandPage,setBrandPage]=useState(1),[brandPages,setBrandPages]=useState(0);const dirty=useRef(false),flight=useRef(false),fileFlight=useRef(false),live=useRef(true);
 const [metadataDirty,setMetadataDirty]=useState(false),[loading,setLoading]=useState(true),[brandsLoading,setBrandsLoading]=useState(true),[brandError,setBrandError]=useState(''),[reading,setReading]=useState(false),[assetSaving,setAssetSaving]=useState(false),[saved,setSaved]=useState(false);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);

 const [intent,setIntent]=useState<{productId:string;name:string;base64:string}|null>(null);const refresh=()=>setRevision(n=>n+1);
 useUnsavedChanges(metadataDirty||!!intent,busy||reading||assetSaving);
 const changed=()=>{dirty.current=true;setMetadataDirty(true);setSaved(false);};
 const ready=!loading&&!brandsLoading&&!error&&!brandError;
 useEffect(()=>{let live=true;void Promise.resolve().then(async()=>{if(!live)return;setLoading(true);setError('');try{const [p,f]=await Promise.all([api.request<Product>('/products/'+id),api.request<Asset[],{usedBytes:number;quotaBytes:number}>('/files?productId='+id+'&page='+page)]);if(live){setProduct(p.data??null);if(!dirty.current){setDescription(p.data?.description??'');setBrandId(p.data?.brandId??'');setTaxProfileId(p.data?.taxProfileId??'');}setAssets(f.data??[]);setPages(f.pagination?.totalPages??0);setQuota((f.summary?.usedBytes??0)+' / '+(f.summary?.quotaBytes??0));}}catch(e){if(live)setError(displayErrorMessage(e,'Katalog yuklanmadi'));}finally{if(live)setLoading(false);}});return()=>{live=false;};},[id,page,revision]);
 useEffect(()=>{let live=true;void Promise.resolve().then(async()=>{if(!live)return;setBrandsLoading(true);setBrandError('');try{const b=await api.request<{id:string;name:string}[]>('/brands?search='+encodeURIComponent(brandSearch)+'&page='+brandPage+'&limit=20');if(live){setBrands(b.data??[]);setBrandPages(b.pagination?.totalPages??0);}}catch(e){if(live)setBrandError(displayErrorMessage(e,'Brendlar yuklanmadi'));}finally{if(live)setBrandsLoading(false);}});return()=>{live=false;};},[brandSearch,brandPage,revision]);
 async function saveMetadata(){
  if(flight.current||!ready||assetSaving||reading)return;
  flight.current=true;setBusy(true);setError('');setSaved(false);
  try{const result=await api.request<Product>('/products/'+id,{method:'PUT',body:JSON.stringify({brandId:brandId||null,taxProfileId:taxProfileId||null,description})});
   if(!result.data||result.data.id!==id)throw new Error('Server tasdig‘i olinmadi; ma’lumotni qayta tekshiring');
   if(live.current){dirty.current=false;setMetadataDirty(false);setSaved(true);setProduct(result.data);refresh();}
  }catch(e){if(live.current)setError(displayErrorMessage(e,'Metadata saqlanmadi'));}finally{flight.current=false;if(live.current)setBusy(false);}
 }
 return <div className="space-y-4"><h1>{tr("Katalog tavsifi va rasmlari:")}{' '}{product?.name}</h1><Link href="/products">{tr("Mahsulotlarga qaytish")}</Link>{(loading||brandsLoading)&&<p role="status">{tr("Katalog yuklanmoqda…")}</p>}{error&&<p role="alert">{uiMessage(error)}</p>}{brandError&&<p role="alert">{uiMessage(brandError)}</p>}{(error||brandError)&&<Button onClick={refresh}>{tr("Katalogni qayta yuklash")}</Button>}{saved&&<p role="status">{tr("Katalog metama’lumotlari serverda saqlandi.")}</p>}{busy&&<p role="status">{tr("Server tasdig‘i kutilmoqda…")}</p>}<Card title={tr("Brend va tavsif")}><Link href="/products/brands">{tr("Brendlarni boshqarish")}</Link><fieldset disabled={busy||assetSaving||reading} className="space-y-3"><Input label={tr("Brend qidirish")} value={brandSearch} maxLength={200} onChange={e=>{setBrandSearch(e.target.value);setBrandPage(1);}}/><Select label={tr("Mahsulot brendi")} value={brandId} disabled={busy} options={[{value:'',label:tr("Brendsiz")},...(brandId&&!brands.some(b=>b.id===brandId)?[{value:brandId,label:product?.brand?.name||tr("Joriy brend")}]:[]),...brands.map(b=>({value:b.id,label:b.name}))]} onChange={e=>{changed();setBrandId(e.target.value);}}/><TaxProfilePicker value={taxProfileId} name={product?.taxProfile?.name} disabled={busy} onChange={id=>{changed();setTaxProfileId(id);}}/><Input label={tr("Mahsulot tavsifi")} value={description} onChange={e=>{changed();setDescription(e.target.value);}} maxLength={4000}/><Button disabled={!ready} onClick={saveMetadata}>{tr("Katalog metama’lumotlarini saqlash")}</Button><Pagination page={brandPage} pages={brandPages} busy={busy} onPage={setBrandPage} retry={refresh}/></fieldset></Card>
 <PendingActions prefix="/files" returnPath={'/products/'+id+'/media'} revision={revision} onDone={(_result,original,path)=>{if(path==='/files'&&intent&&original?.base64===intent.base64&&original?.name===intent.name&&original?.productId===id)setIntent(null);refresh();}}/><Card title={tr("Vakolatli mahsulot rasmlari")}><p>{tr("Faqat PNG/JPEG/WebP, max512 KiB. Server rasmni static WebPga qayta kodlaydi; umumiy public papkaga saqlanmaydi. Kvota baytda:")}{' '}{quota}.</p><input aria-label={tr("Mahsulot rasm fayli")} type="file" accept="image/png,image/jpeg,image/webp" disabled={!ready||busy||assetSaving||reading||!!intent} onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file||fileFlight.current)return;if(file.size>524288){setError('Rasm 512 KiBdan katta');return;}fileFlight.current=true;setReading(true);try{const bytes=new Uint8Array(await file.arrayBuffer());let raw='';for(const byte of bytes)raw+=String.fromCharCode(byte);if(live.current)setIntent({productId:id,name:file.name,base64:btoa(raw)});}catch(e){if(live.current)setError(displayErrorMessage(e,'Rasm o‘qilmadi'));}finally{fileFlight.current=false;if(live.current)setReading(false);}}}/>{intent&&<DurableMutation returnPath={'/products/'+id+'/media'} path="/files" canSubmit={ready&&!busy&&!reading} onSavingChange={setAssetSaving} body={intent} label={tr("Mahsulot rasmi")} review={[intent.name,tr("Faqat ushbu mahsulotning rasmiga bog‘lanadi; stock yoki pul yozilmaydi.")]} onDone={()=>{setIntent(null);refresh();}}><Button variant="outline" onClick={()=>{if(confirmUnsavedChanges(true,assetSaving))setIntent(null);}}>{tr("Rasm tanlovini bekor qilish")}</Button></DurableMutation>}{product?.imageUrl&&!assets.some(a=>a.url===product.imageUrl&&a.deletedAt)&&<Image unoptimized src={product.imageUrl} alt={product.name} width={160} height={160}/>}
 {assets.map(a=><div key={a.id}><p>{a.name} · {a.size} {tr("bayt ·")}{' '}{a.deletedAt?tr("O‘chirilgan"):a.expiresAt?tr("Muddati:")+" "+a.expiresAt:tr("Doimiy")}</p><DurableMutation method="DELETE" path={'/files/'+a.id} returnPath={'/products/'+id+'/media'} body={{reason:'Operator removed product image'}} label={tr("Rasmni o‘chirish:")+" "+a.name} review={[a.name,tr("Rasm tarkibi o‘chiriladi; audit tarixi saqlanadi.")]} allowNew={!a.deletedAt} canSubmit={ready&&!busy&&!reading&&!assetSaving} onSavingChange={setAssetSaving} onDone={refresh}/></div>)}<Pagination page={page} pages={pages} busy={busy} onPage={setPage} retry={refresh}/></Card></div>;
}
