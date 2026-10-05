'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import type { AuditSummary } from '@/types';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
export default function AuditPage(){
 const {role,organization}=useAuth();
 const [rows,setRows]=useState<AuditSummary[]>([]),[page,setPage]=useState(1),[pages,setPages]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const [draft,setDraft]=useState({from:'',to:'',entityType:'',entityId:'',actorId:'',action:''}),[filters,setFilters]=useState<Record<string,string>>({}),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(role!=='owner'||!organization?.id)return;
  let cancelled=false;
  void Promise.resolve().then(async()=>{
   if(cancelled)return;setBusy(true);setError('');
   try{const result=await api.auditSummary({...filters,page:String(page)});if(!cancelled){setRows(result.data??[]);setPages(result.pagination?.totalPages??0);}}
   catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Tarix yuklanmadi');}
   finally{if(!cancelled)setBusy(false);}
  });return()=>{cancelled=true;};
 },[role,organization?.id,page,filters,retry]);
 if(role!=='owner')return <p>Audit tarixini ko‘rish uchun biznes egasi vakolati kerak.</p>;
 return <div className="space-y-4"><h1 className="text-2xl font-bold">Audit tarixi</h1>
  <Card><form className="grid sm:grid-cols-2 gap-3" onSubmit={event=>{event.preventDefault();setPage(1);setFilters(Object.fromEntries(Object.entries(draft).filter(([,value])=>value.trim()).map(([key,value])=>[key,value.trim()])));}}>
   <Input label="Davr boshi" type="date" value={draft.from} onChange={event=>setDraft({...draft,from:event.target.value})}/><Input label="Davr oxiri" type="date" value={draft.to} onChange={event=>setDraft({...draft,to:event.target.value})}/>
   <Input label="Resurs turi (masalan SaleReturn)" maxLength={100} value={draft.entityType} onChange={event=>setDraft({...draft,entityType:event.target.value})}/><Input label="Amal (masalan returned)" maxLength={100} value={draft.action} onChange={event=>setDraft({...draft,action:event.target.value})}/>
   <Input label="Resurs ID" value={draft.entityId} onChange={event=>setDraft({...draft,entityId:event.target.value})}/><Input label="Xodim ID" value={draft.actorId} onChange={event=>setDraft({...draft,actorId:event.target.value})}/>
   <Button type="submit" disabled={busy}>Filtrlash</Button>
  </form></Card>
  <Card><p className="text-xs text-slate-500 mb-3">Sanalar tashkilot vaqt zonasida. Ushbu ekran yozilgan audit hodisalarini ko‘rsatadi; tafsilot payloadlari va IP manzillar chiqarilmaydi.</p>
   {busy?<p>Yuklanmoqda...</p>:error?<div role="alert">{error}<Button onClick={()=>setRetry(value=>value+1)}>Qayta yuklash</Button></div>:<div className="overflow-auto"><table className="w-full text-sm"><thead><tr><th>Sana</th><th>Xodim</th><th>Resurs</th><th>Amal</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t"><td className="p-2">{new Date(row.createdAt).toLocaleString('uz-UZ',{timeZone:organization?.timezone})}</td><td>{row.actor?.fullName??'Tizim / xodim mavjud emas'}<div className="text-xs">{row.actorId}</div></td><td>{row.entityType}<div className="text-xs break-all">{row.entityId}</div></td><td>{row.action}</td></tr>)}</tbody></table>{rows.length===0&&<p>Hodisa topilmadi.</p>}</div>}
   <div className="flex items-center gap-3 mt-3"><Button disabled={busy||page<=1} onClick={()=>setPage(value=>value-1)}>Oldingi</Button><span>{page} / {Math.max(1,pages)}</span><Button disabled={busy||page>=pages} onClick={()=>setPage(value=>value+1)}>Keyingi</Button></div>
  </Card></div>;
}
