'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotification } from '@/context/NotificationContext';
import { api, ApiError } from '@/lib/api';
import {useUnsavedChanges,confirmUnsavedChanges} from '@/hooks/useUnsavedChanges';
import {deviceId,pendingOperations,enqueue,acknowledge,type PendingOperation} from '@/lib/offline';
import type { Product, StockCount } from '@/types';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

const labels={counting:'Sanash davom etmoqda',review:'Tekshirish va qayta sanash',approved:'Tasdiqlangan',cancelled:'Bekor qilingan'};
export default function StockCountsPage(){const {organization,user,role}=useAuth();const {activeStore}=useOrganization();return organization&&user?<CountControls key={[organization.id,user.id,role,activeStore?.id].join(':')}/>:null;}
function CountControls(){
 const {organization,user}=useAuth(),{activeStore}=useOrganization(),{notifyError,notifySuccess}=useNotification();
 const [counts,setCounts]=useState<StockCount[]>([]),[current,setCurrent]=useState<StockCount|null>(null);
 const [countPage,setCountPage]=useState(1),[totalPages,setTotalPages]=useState(1),[allCounts,setAllCounts]=useState(false);
 const [scope,setScope]=useState<'full'|'partial'>('full'),[blind,setBlind]=useState(true);
 const [products,setProducts]=useState<Product[]>([]),[selected,setSelected]=useState<string[]>([]),[search,setSearch]=useState('');
 const [inputs,setInputs]=useState<Record<string,string>>({}),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false);
 const attempt=useRef<PendingOperation|null>(null),flight=useRef(false),live=useRef(true);
 const organizationId=organization?.id,userId=user?.id;
 const [ready,setReady]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[localRevision,setLocalRevision]=useState(0),[pendingView,setPendingView]=useState<PendingOperation|null>(null);
 useEffect(()=>{let cancelled=false;live.current=true;void(async()=>{try{if(!organizationId||!userId)return;const rows=await pendingOperations({organizationId,userId,deviceId:deviceId()});if(!cancelled){attempt.current=rows.find(row=>row.type==='finance.action'&&row.payload.returnPath==='/inventory/counts'&&String(row.payload.path).startsWith('/stock-counts'))??null;setPendingView(attempt.current);setUnknown(Boolean(attempt.current));setReady(true);}}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Lokal amal tekshirilmadi');}})();return()=>{cancelled=true;live.current=false;};},[organizationId,userId,localRevision]);
 const countDirty=Boolean(scope!=='full'||!blind||selected.length>0||Object.values(inputs).some(value=>value.length>0)||reason||unknown);
 const discardCount=useUnsavedChanges(countDirty,busy,unknown?'Sanash amalining natijasi noma’lum. Avval original amalni tekshiring. Sahifadan chiqishni tasdiqlaysizmi?':undefined);

 const refresh=useCallback(async()=>{try{const response=await api.stockCounts.list(countPage,allCounts?'all':'active');setCounts(response.data??[]);setTotalPages(response.pagination?.totalPages??1);}catch(error){notifyError(error instanceof Error?error.message:'Sanashlar yuklanmadi');}},[notifyError,countPage,allCounts]);
 useEffect(()=>{void Promise.resolve().then(refresh);},[refresh]);
 const loadProducts=async()=>{if(!organization)return;try{const response=await api.products.list({organizationId:organization.id,search,limit:200});setProducts(response.data??[]);}catch(error){notifyError(error instanceof Error?error.message:'Katalog yuklanmadi');}};
 const openCount=async(id:string)=>{if(!ready||attempt.current||!discardCount())return;try{const response=await api.stockCounts.get(id);setCurrent(response.data??null);setInputs({});setReason('');}catch(error){notifyError(error instanceof Error?error.message:'Sanash topilmadi');}};
 const execute=async(name:string,path?:string,body?:Record<string,unknown>)=>{
  if(flight.current||!ready||!organization||!user)return;
  if(attempt.current&&path){notifyError('Avval original amal natijasini tekshiring');return;}
  flight.current=true;setBusy(true);setError('');setSaved(false);const retrying=Boolean(attempt.current);
  let op=attempt.current;
  try{
   if(!op){
    if(!path||!body)throw new Error('Amal ma’lumoti topilmadi');
    const id=typeof body.operationId==='string'?body.operationId:crypto.randomUUID();
    op=await enqueue({id,scope:{organizationId:organization.id,userId:user.id,deviceId:deviceId()},type:'finance.action',payload:{path,returnPath:'/inventory/counts',label:name,body:JSON.parse(JSON.stringify({...body,operationId:id})),review:[`Filial: ${activeStore?.name??''}`,`Sanash: ${current?.id??'yangi'}`,`Amal: ${name}`, ...(typeof body.reason==='string'?[`Sabab: ${body.reason}`]:[]),...(Array.isArray(body.items)?body.items.map(row=>`${row.lineId}: ${row.quantity}`):[])]},state:'pending',createdAt:new Date().toISOString()});
    attempt.current=op;if(live.current)setPendingView(op);
   }
   const target=String(op.payload.path);
   if(!/^\/stock-counts(?:\/[0-9a-f-]{36}(?:\/(?:submit|approve|cancel))?)?$/.test(target))throw new Error('Original sanash manzili noto‘g‘ri');
   const response=await api.request<StockCount>(target,{method:'POST',body:JSON.stringify(op.payload.body)});
   await acknowledge(op.id,'synced',response.data);
   if(live.current){setCurrent(response.data??null);if(target==='/stock-counts'){setScope('full');setBlind(true);setSelected([]);setInputs({});setReason('');}else if(/\/(approve|cancel)$/.test(target)){setInputs({});setReason('');}else if(!target.endsWith('/submit')){setInputs({});}attempt.current=null;setPendingView(null);setUnknown(false);setSaved(true);notifySuccess('Sanash amali serverda saqlandi');if(response.data?.id){try{const actual=await api.stockCounts.get(response.data.id);if(live.current)setCurrent(actual.data??null);}catch{if(live.current){setCurrent(null);setError('Amal saqlandi, lekin sanash holati yuklanmadi. Ro‘yxatdan qayta oching.');}}}await refresh();}
  }catch(e){
   if(!retrying&&op&&e instanceof ApiError&&([400,403,404,413,415].includes(e.status??0)||['COUNT_ALREADY_ACTIVE','COUNT_INCOMPLETE','COUNT_STOCK_CHANGED','COUNT_UNIT_CHANGED','INVALID_STATUS','READING_LIMIT','RECOUNT_REQUIRED','UNRESOLVED_OFFLINE_STOCK'].includes(e.code??''))){await acknowledge(op.id,'rejected',undefined,e.code);attempt.current=null;if(live.current)setPendingView(null);}
   if(live.current){setUnknown(Boolean(attempt.current));setError(e instanceof Error?e.message:'Natija noaniq; original kalit saqlangan');}
  }finally{flight.current=false;if(live.current)setBusy(false);}
 };
 const start=()=>{
  if(!organization||!activeStore){notifyError('Do‘kon tanlang');return;}
  if(!confirmUnsavedChanges(Boolean(Object.values(inputs).some(value=>value.trim())||reason),busy))return;
 const data={operationId:crypto.randomUUID(),organizationId:organization.id,storeId:activeStore.id,scope,blind,...(scope==='partial'?{productIds:selected}:{})};
  void execute('Sanashni boshlash','/stock-counts',data);
 };
 const record=()=>{
  if(!current)return;
  const items=Object.entries(inputs).filter(([,quantity])=>quantity.trim()!=='').map(([lineId,quantity])=>({lineId,quantity:quantity.trim()}));
  if(!items.length){notifyError('Kamida bitta sanalgan miqdorni kiriting');return;}
  const id=current.id,data={operationId:crypto.randomUUID(),items};void execute('Miqdorlarni saqlash',`/stock-counts/${id}`,data);
 };
 const decide=(action:'approve'|'cancel')=>{
  if(!current||reason.trim().length<3){notifyError('Kamida 3 belgili sabab kiriting');return;}
  if(!confirmUnsavedChanges(Object.values(inputs).some(value=>Boolean(value.trim())),busy))return;
  const id=current.id,data={operationId:crypto.randomUUID(),reason:reason.trim()};void execute(action==='approve'?'Farqni tasdiqlash':'Sanashni bekor qilish',`/stock-counts/${id}/${action}`,data);
 };
 const active=current&&['counting','review'].includes(current.status);
 return <div className="space-y-5">
  <div className="flex items-center gap-3"><Link href="/inventory"><Button variant="outline">Omborga qaytish</Button></Link><h1 className="text-2xl font-bold">Inventarizatsiya</h1></div>
  <p className="text-sm text-gray-600">Tanlangan mahsulotlar sanash tugaguncha savdo, kirim va transfer uchun bloklanadi. Sanashni tez yakunlang yoki bekor qiling. Farq bo‘lsa qayta sanash va manager tasdig‘i talab qilinadi.</p>
  {!ready&&!error&&<p role="status">Lokal sanash navbati tekshirilmoqda…</p>}
  {busy&&<p role="status">Server tasdig‘i kutilmoqda…</p>}
  {!busy&&countDirty&&!unknown&&<p role="status">Saqlanmagan sanash o‘zgarishlari bor.</p>}
  {saved&&!busy&&<p role="status">Sanash serverda saqlandi.</p>}
  {error&&<p role="alert">{error}{!ready&&<button type="button" className="underline ml-2" onClick={()=>setLocalRevision(value=>value+1)}>Lokal navbatni qayta tekshirish</button>}</p>}
  {unknown&&<Card><p>Oldingi javob noaniq. Ma’lumot va amal kaliti saqlangan.</p>{(Array.isArray(pendingView?.payload.review)?pendingView.payload.review:[]).map((line,index)=><p key={index}>{String(line)}</p>)}<Button disabled={busy} onClick={()=>{if(attempt.current)void execute(String(attempt.current.payload.label??'Original sanash'));}}>Oldingi amalni qayta tekshirish</Button></Card>}
  <Card className="space-y-3">
   <h2 className="font-bold">Yangi sanash — {activeStore?.name??'do‘kon tanlanmagan'}</h2>
   <Select label="Sanash doirasi" value={scope} disabled={!ready||busy||unknown} onChange={event=>setScope(event.target.value as 'full'|'partial')} options={[{value:'full',label:'To‘liq katalog (2000 tagacha)'},{value:'partial',label:'Tanlangan mahsulotlar'}]}/>
   <label className="flex gap-2"><input type="checkbox" checked={blind} disabled={!ready||busy||unknown} onChange={event=>setBlind(event.target.checked)}/>Kutilgan qoldiqni sanash paytida yashirish</label>
   {scope==='partial'&&<div className="space-y-2"><Input label="Mahsulot qidirish" value={search} onChange={event=>setSearch(event.target.value)} disabled={!ready||busy||unknown}/><Button onClick={loadProducts} disabled={!ready||busy||unknown}>Mahsulotlarni topish</Button><p>{selected.length} mahsulot tanlangan; qidiruvda 200 tagacha natija.</p><div className="max-h-48 overflow-auto">{products.map(product=><label key={product.id} className="flex gap-2"><input type="checkbox" checked={selected.includes(product.id)} disabled={!ready||busy||unknown} onChange={event=>setSelected(values=>event.target.checked?[...values,product.id]:values.filter(id=>id!==product.id))}/>{product.name} ({product.sku})</label>)}</div></div>}
   <Button disabled={!ready||busy||unknown||!activeStore||(scope==='partial'&&!selected.length)} onClick={start}>Sanashni boshlash</Button>
  </Card>
  <Card><h2 className="font-bold mb-3">Sanashlar</h2><label className="flex gap-2 mb-3"><input type="checkbox" checked={allCounts} disabled={!ready||busy||unknown} onChange={event=>{setAllCounts(event.target.checked);setCountPage(1);}}/>Yakunlangan sanashlarni ham ko‘rsatish</label><div className="flex flex-wrap gap-2">{counts.map(count=><Button variant="outline" key={count.id} disabled={!ready||busy||unknown} onClick={()=>openCount(count.id)}>{count.store?.name} — {labels[count.status]} — {count.id.slice(0,8)}</Button>)}</div><div className="flex gap-2 mt-3"><Button variant="outline" disabled={!ready||busy||unknown||countPage<=1} onClick={()=>setCountPage(page=>page-1)}>Oldingi</Button><span>{countPage} / {Math.max(totalPages,1)}</span><Button variant="outline" disabled={!ready||busy||unknown||countPage>=totalPages} onClick={()=>setCountPage(page=>page+1)}>Keyingi</Button></div></Card>
  {current&&<Card className="space-y-4">
   <h2 className="font-bold">{labels[current.status]} — {current.id.slice(0,8)}</h2>
   {current.status==='counting'&&current.blind&&<p>Kutilgan qoldiq birinchi sanash davomida yashirilgan.</p>}
   <div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th>Mahsulot</th><th>Kutilgan</th><th>Sanash tarixi</th><th>Yangi miqdor</th></tr></thead><tbody>{current.lines?.map(line=><tr key={line.id} className="border-t"><td className="p-2">{line.productName} ({line.sku}) — {line.unit}</td><td>{line.expectedQuantity??'Yashirilgan'}</td><td>{line.readings.map(reading=><div key={reading.id}>{reading.round}-sanash: {String(reading.quantity)} — {new Date(reading.countedAt).toLocaleString('uz-UZ')}</div>)}</td><td>{active&&<Input aria-label={`${line.sku} sanalgan miqdor`} inputMode="decimal" value={inputs[line.id]??''} onChange={event=>setInputs(values=>({...values,[line.id]:event.target.value}))} disabled={!ready||busy||unknown}/>}</td></tr>)}</tbody></table></div>
   {active&&<><Button onClick={record} disabled={!ready||busy||unknown}>Sanalgan miqdorlarni saqlash</Button>{current.status==='counting'&&<Button disabled={!ready||busy||unknown} onClick={()=>{if(Object.values(inputs).some(value=>value.trim())){notifyError('Avval kiritilgan miqdorlarni saqlang');return;}const id=current.id;void execute('Tekshirishga yuborish',`/stock-counts/${id}/submit`,{});}}>Tekshirishga yuborish</Button>}<Input label="Tasdiqlash yoki bekor qilish sababi" value={reason} maxLength={2000} disabled={!ready||busy||unknown} onChange={event=>setReason(event.target.value)}/><div className="flex gap-2">{current.status==='review'&&<Button disabled={!ready||busy||unknown} onClick={()=>decide('approve')}>Farqni tasdiqlash</Button>}<Button variant="outline" disabled={!ready||busy||unknown} onClick={()=>decide('cancel')}>Sanashni bekor qilish</Button></div></>}
   {current.adjustmentId&&<p>Farq hujjati: {current.adjustmentId}</p>}
   {current.approvedBy&&<p>Tasdiqlovchi: {current.approvedBy}; sabab: {current.reason}</p>}
  </Card>}
 </div>;
}
