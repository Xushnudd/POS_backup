'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotification } from '@/context/NotificationContext';
import { api, ApiError } from '@/lib/api';
import type { ApiResponse, Product, StockCount } from '@/types';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

const labels={counting:'Sanash davom etmoqda',review:'Tekshirish va qayta sanash',approved:'Tasdiqlangan',cancelled:'Bekor qilingan'};
export default function StockCountsPage(){
 const {organization}=useAuth(),{activeStore}=useOrganization(),{notifyError,notifySuccess}=useNotification();
 const [counts,setCounts]=useState<StockCount[]>([]),[current,setCurrent]=useState<StockCount|null>(null);
 const [countPage,setCountPage]=useState(1),[totalPages,setTotalPages]=useState(1),[allCounts,setAllCounts]=useState(false);
 const [scope,setScope]=useState<'full'|'partial'>('full'),[blind,setBlind]=useState(true);
 const [products,setProducts]=useState<Product[]>([]),[selected,setSelected]=useState<string[]>([]),[search,setSearch]=useState('');
 const [inputs,setInputs]=useState<Record<string,string>>({}),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false);
 const attempt=useRef<null|{name:string;run:()=>Promise<ApiResponse<StockCount>>}>(null);
 const refresh=useCallback(async()=>{try{const response=await api.stockCounts.list(countPage,allCounts?'all':'active');setCounts(response.data??[]);setTotalPages(response.pagination?.totalPages??1);}catch(error){notifyError(error instanceof Error?error.message:'Sanashlar yuklanmadi');}},[notifyError,countPage,allCounts]);
 useEffect(()=>{void Promise.resolve().then(refresh);},[refresh]);
 const loadProducts=async()=>{if(!organization)return;try{const response=await api.products.list({organizationId:organization.id,search,limit:200});setProducts(response.data??[]);}catch(error){notifyError(error instanceof Error?error.message:'Katalog yuklanmadi');}};
 const openCount=async(id:string)=>{try{const response=await api.stockCounts.get(id);setCurrent(response.data??null);setInputs({});setReason('');}catch(error){notifyError(error instanceof Error?error.message:'Sanash topilmadi');}};
 const execute=async(name:string,run:()=>Promise<ApiResponse<StockCount>>)=>{
  if(attempt.current&&attempt.current.name!==name){notifyError('Avval oldingi amal natijasini tekshiring');return;}
  if(!attempt.current)attempt.current={name,run};
  setBusy(true);
  try{
   const response=await attempt.current.run();setCurrent(response.data??null);setInputs({});attempt.current=null;setUnknown(false);notifySuccess('Sanash holati saqlandi');await refresh();
  }catch(error){
   if(error instanceof ApiError&&error.status&&error.status>=400&&error.status<500){attempt.current=null;setUnknown(false);}
   else setUnknown(true);
   notifyError(error instanceof Error?error.message:'Natija noaniq. Shu amalni qayta tekshiring');
  }finally{setBusy(false);}
 };
 const start=()=>{
  if(!organization||!activeStore){notifyError('Do‘kon tanlang');return;}
  const data={operationId:crypto.randomUUID(),organizationId:organization.id,storeId:activeStore.id,scope,blind,...(scope==='partial'?{productIds:selected}:{})};
  void execute('start',()=>api.stockCounts.start(data));
 };
 const record=()=>{
  if(!current)return;
  const items=Object.entries(inputs).filter(([,quantity])=>quantity.trim()!=='').map(([lineId,quantity])=>({lineId,quantity:quantity.trim()}));
  if(!items.length){notifyError('Kamida bitta sanalgan miqdorni kiriting');return;}
  const id=current.id,data={operationId:crypto.randomUUID(),items};void execute('record',()=>api.stockCounts.record(id,data));
 };
 const decide=(action:'approve'|'cancel')=>{
  if(!current||reason.trim().length<3){notifyError('Kamida 3 belgili sabab kiriting');return;}
  const id=current.id,data={operationId:crypto.randomUUID(),reason:reason.trim()};void execute(action,()=>api.stockCounts.decide(id,action,data));
 };
 const active=current&&['counting','review'].includes(current.status);
 return <div className="space-y-5">
  <div className="flex items-center gap-3"><Link href="/inventory"><Button variant="outline">Omborga qaytish</Button></Link><h1 className="text-2xl font-bold">Inventarizatsiya</h1></div>
  <p className="text-sm text-gray-600">Tanlangan mahsulotlar sanash tugaguncha savdo, kirim va transfer uchun bloklanadi. Sanashni tez yakunlang yoki bekor qiling. Farq bo‘lsa qayta sanash va manager tasdig‘i talab qilinadi.</p>
  {unknown&&<Card><p>Oldingi javob noaniq. Ma’lumot va amal kaliti saqlangan.</p><Button disabled={busy} onClick={()=>{if(attempt.current)void execute(attempt.current.name,attempt.current.run);}}>Oldingi amalni qayta tekshirish</Button></Card>}
  <Card className="space-y-3">
   <h2 className="font-bold">Yangi sanash — {activeStore?.name??'do‘kon tanlanmagan'}</h2>
   <Select label="Sanash doirasi" value={scope} disabled={busy||unknown} onChange={event=>setScope(event.target.value as 'full'|'partial')} options={[{value:'full',label:'To‘liq katalog (2000 tagacha)'},{value:'partial',label:'Tanlangan mahsulotlar'}]}/>
   <label className="flex gap-2"><input type="checkbox" checked={blind} disabled={busy||unknown} onChange={event=>setBlind(event.target.checked)}/>Kutilgan qoldiqni sanash paytida yashirish</label>
   {scope==='partial'&&<div className="space-y-2"><Input label="Mahsulot qidirish" value={search} onChange={event=>setSearch(event.target.value)} disabled={busy||unknown}/><Button onClick={loadProducts} disabled={busy||unknown}>Mahsulotlarni topish</Button><p>{selected.length} mahsulot tanlangan; qidiruvda 200 tagacha natija.</p><div className="max-h-48 overflow-auto">{products.map(product=><label key={product.id} className="flex gap-2"><input type="checkbox" checked={selected.includes(product.id)} disabled={busy||unknown} onChange={event=>setSelected(values=>event.target.checked?[...values,product.id]:values.filter(id=>id!==product.id))}/>{product.name} ({product.sku})</label>)}</div></div>}
   <Button disabled={busy||unknown||!activeStore||(scope==='partial'&&!selected.length)} onClick={start}>Sanashni boshlash</Button>
  </Card>
  <Card><h2 className="font-bold mb-3">Sanashlar</h2><label className="flex gap-2 mb-3"><input type="checkbox" checked={allCounts} disabled={busy||unknown} onChange={event=>{setAllCounts(event.target.checked);setCountPage(1);}}/>Yakunlangan sanashlarni ham ko‘rsatish</label><div className="flex flex-wrap gap-2">{counts.map(count=><Button variant="outline" key={count.id} disabled={busy||unknown} onClick={()=>openCount(count.id)}>{count.store?.name} — {labels[count.status]} — {count.id.slice(0,8)}</Button>)}</div><div className="flex gap-2 mt-3"><Button variant="outline" disabled={busy||unknown||countPage<=1} onClick={()=>setCountPage(page=>page-1)}>Oldingi</Button><span>{countPage} / {Math.max(totalPages,1)}</span><Button variant="outline" disabled={busy||unknown||countPage>=totalPages} onClick={()=>setCountPage(page=>page+1)}>Keyingi</Button></div></Card>
  {current&&<Card className="space-y-4">
   <h2 className="font-bold">{labels[current.status]} — {current.id.slice(0,8)}</h2>
   {current.status==='counting'&&current.blind&&<p>Kutilgan qoldiq birinchi sanash davomida yashirilgan.</p>}
   <div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th>Mahsulot</th><th>Kutilgan</th><th>Sanash tarixi</th><th>Yangi miqdor</th></tr></thead><tbody>{current.lines?.map(line=><tr key={line.id} className="border-t"><td className="p-2">{line.productName} ({line.sku}) — {line.unit}</td><td>{line.expectedQuantity??'Yashirilgan'}</td><td>{line.readings.map(reading=><div key={reading.id}>{reading.round}-sanash: {String(reading.quantity)} — {new Date(reading.countedAt).toLocaleString('uz-UZ')}</div>)}</td><td>{active&&<Input aria-label={`${line.sku} sanalgan miqdor`} inputMode="decimal" value={inputs[line.id]??''} onChange={event=>setInputs(values=>({...values,[line.id]:event.target.value}))} disabled={busy||unknown}/>}</td></tr>)}</tbody></table></div>
   {active&&<><Button onClick={record} disabled={busy||unknown}>Sanalgan miqdorlarni saqlash</Button>{current.status==='counting'&&<Button disabled={busy||unknown} onClick={()=>{const id=current.id;void execute('submit',()=>api.stockCounts.submit(id));}}>Tekshirishga yuborish</Button>}<Input label="Tasdiqlash yoki bekor qilish sababi" value={reason} maxLength={2000} disabled={busy||unknown} onChange={event=>setReason(event.target.value)}/><div className="flex gap-2">{current.status==='review'&&<Button disabled={busy||unknown} onClick={()=>decide('approve')}>Farqni tasdiqlash</Button>}<Button variant="outline" disabled={busy||unknown} onClick={()=>decide('cancel')}>Sanashni bekor qilish</Button></div></>}
   {current.adjustmentId&&<p>Farq hujjati: {current.adjustmentId}</p>}
   {current.approvedBy&&<p>Tasdiqlovchi: {current.approvedBy}; sabab: {current.reason}</p>}
  </Card>}
 </div>;
}
