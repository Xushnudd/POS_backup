'use client';
import CashierPin from '@/components/security/CashierPin';
import SecurityHistory from '@/components/security/SecurityHistory';
import ContactVerification from '@/components/security/ContactVerification';
import Totp from '@/components/security/Totp';
import { useEffect, useState, useRef } from 'react';
import { api,type AccountSessionRow } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { deviceId, pendingOperations } from '@/lib/offline';
import { useRouter } from 'next/navigation';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import {commitPageNavigation} from '@/lib/page-navigation';
export default function SecurityPage(){
 const {user}=useAuth();
 return user?<AccountSecurityPage key={user.id}/>:null;
}
function AccountSecurityPage(){
 const {user,organization,refreshUser}=useAuth();
 const router=useRouter();
 const [rows,setRows]=useState<AccountSessionRow[]>([]),[page,setPage]=useState(1),[pages,setPages]=useState(0),[busy,setBusy]=useState(true),[revoking,setRevoking]=useState(''),[error,setError]=useState(''),[version,setVersion]=useState(0);
 const [sessionView,setSessionView]=useState<'active'|'all'>('active');
 const [currentPassword,setCurrentPassword]=useState(''),[newPassword,setNewPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[changing,setChanging]=useState(false),[passwordError,setPasswordError]=useState('');
 const accountFlight=useRef(false),revokeFlight=useRef(false),live=useRef(true);
 const [ack,setAck]=useState('');
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 useUnsavedChanges(false,Boolean(revoking));
 const passwordDirty=Boolean(currentPassword||newPassword||confirmation);
 const confirmPasswordDiscard=useUnsavedChanges(passwordDirty,changing);
 const changePassword=async(event:React.FormEvent)=>{
  event.preventDefault();if(accountFlight.current||revokeFlight.current||!user||!organization)return;
  setPasswordError('');
  if(newPassword!==confirmation){setPasswordError('Yangi parollar bir xil emas');return;}
  if(new TextEncoder().encode(newPassword).length>72){setPasswordError('Parol UTF-8 bo‘yicha 72 baytdan oshmasin');return;}
  accountFlight.current=true;setChanging(true);setAck('');
  try{
   if((await pendingOperations({organizationId:organization.id,userId:user.id,deviceId:deviceId()})).length)throw new Error('Sinxronlanmagan amallar bor; avval ularning natijasini tekshiring');
   await api.auth.changePassword(currentPassword,newPassword);
   if(!live.current)return;setAck('Parol serverda yangilandi. Qayta kiring.');setCurrentPassword('');setNewPassword('');setConfirmation('');commitPageNavigation();
   try{await refreshUser();}catch{/* A confirmed password change is not undone by a failed profile read. */}finally{if(live.current)router.replace('/login');}
  }catch(error){if(live.current)setPasswordError(error instanceof Error?error.message:'Natija noaniq. Qayta kirishda yangi parolni tekshiring.');}
  finally{accountFlight.current=false;if(live.current)setChanging(false);}
 };
 useEffect(()=>{
  if(!user?.id)return;let cancelled=false;
  void Promise.resolve().then(async()=>{
   if(cancelled)return;setBusy(true);setError('');
   try{const response=await api.sessions.list(page,sessionView);if(!response.data)throw new Error('Sessiyalar yuklanmadi');if(!cancelled){setRows(response.data);setPages(response.pagination?.totalPages??0);}}
   catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Sessiyalar yuklanmadi');}
   finally{if(!cancelled)setBusy(false);}
  });return()=>{cancelled=true;};
 },[user?.id,page,version,sessionView]);
 const revoke=async(id:string)=>{
  if(revokeFlight.current||accountFlight.current||busy||error)return;revokeFlight.current=true;setRevoking(id);setAck('');
  try{await api.sessions.revoke(id);if(live.current){setAck('Sessiya serverda bekor qilindi.');setBusy(true);setVersion(value=>value+1);}}
  catch(error){if(live.current)setError(error instanceof Error?error.message:'Sessiya natijasi tasdiqlanmadi; holatni yangilang');}
  finally{revokeFlight.current=false;if(live.current)setRevoking('');}
 };
 const date=(value:string)=>new Date(value).toLocaleString('uz-UZ',{timeZone:organization?.timezone});
 const logoutAll=async()=>{
  if(accountFlight.current||revokeFlight.current||!user||!organization||!confirmPasswordDiscard())return;
  accountFlight.current=true;setChanging(true);setPasswordError('');setAck('');
  try{
   if((await pendingOperations({organizationId:organization.id,userId:user.id,deviceId:deviceId()})).length)throw new Error('Sinxronlanmagan amallar bor; avval ularning natijasini tekshiring');
   await api.auth.logoutAll();if(!live.current)return;setAck('Barcha sessiyalar serverda yopildi.');setCurrentPassword('');setNewPassword('');setConfirmation('');commitPageNavigation();
   try{await refreshUser();}catch{/* Logout ACK stays valid when the profile read fails. */}finally{if(live.current)router.replace('/login');}
  }catch(error){if(live.current)setPasswordError(error instanceof Error?error.message:'Chiqish amalga oshmadi');}
  finally{accountFlight.current=false;if(live.current)setChanging(false);}
 };
 const changeSessionView=(view:'active'|'all')=>{setRows([]);setPage(1);setPages(0);setBusy(true);setSessionView(view);};
 return <div className="space-y-4">{ack&&<p role="status">{ack}</p>}<CashierPin/><ContactVerification/><Totp key={organization?.id}/><h1 className="text-2xl font-bold">{sessionView==='active'?'Faol sessiyalar':'Sessiyalar tarixi'}</h1><Card>
  <p className="text-sm mb-3">Bu ro‘yxat hisobingizning barcha bizneslardagi {sessionView==='active'?'faol sessiyalarini':'saqlangan sessiyalarini, jumladan bekor qilingan va muddati tugagan kirishlarini'} ko‘rsatadi. Qurilma modeli yoki joylashuv taxmin qilinmaydi. Joriy sessiyadan chiqish uchun menyudagi Chiqish tugmasini ishlating.</p>
  {sessionView==='all'&&<p className="mb-3 text-sm text-gray-600">Sessiyalar tarixida oxirgi 90 kunda yaratilgan kirishlar ko‘rsatiladi.</p>}
  <div className="mb-3 flex flex-wrap gap-2"><Button size="sm" aria-pressed={sessionView==='active'} disabled={!!revoking||sessionView==='active'} onClick={()=>changeSessionView('active')}>Faol sessiyalar</Button><Button size="sm" aria-pressed={sessionView==='all'} disabled={!!revoking||sessionView==='all'} onClick={()=>changeSessionView('all')}>Sessiyalar tarixi</Button></div>
  {error&&<div role="alert">{error}<Button onClick={()=>{setBusy(true);setVersion(value=>value+1);}}>Qayta yuklash</Button></div>}
  {busy?<p>Yuklanmoqda...</p>:rows.map(row=><article key={row.id} className="border-t py-3 space-y-1">
   <p className="font-semibold">{row.current?'Joriy sessiya':'Boshqa sessiya'}</p><p className="text-sm">Holat: {row.status==='revoked'?'Bekor qilingan':row.status==='expired'?'Muddati tugagan':'Faol'}; kirish usuli: {row.authenticationMethod==='pin'?'Kassir PIN':'Parol'}</p><p className="text-xs break-all">Sessiya ID: {row.id}</p>
   <p className="text-xs break-all">Biznes ID: {row.organizationId}</p><p className="text-sm">Yaratilgan: {date(row.createdAt)}</p><p className="text-sm">Amal qilish muddati: {date(row.expiresAt)}</p><p className="text-sm">Faolsizlik muddati: {date(row.idleExpiresAt)}</p>
   {row.revokedAt&&<p className="text-sm">Bekor qilingan: {date(row.revokedAt)}</p>}
   {!row.current&&row.status==='active'&&<Button disabled={!!revoking||changing||!!error} onClick={()=>revoke(row.id)}>Sessiyani bekor qilish</Button>}
  </article>)}
  {!busy&&!error&&rows.length===0&&<p>Sessiyalar topilmadi.</p>}
  <div className="flex items-center gap-3 mt-3"><Button disabled={busy||page<=1} onClick={()=>setPage(value=>value-1)}>Oldingi</Button><span>{page} / {Math.max(1,pages)}</span><Button disabled={busy||page>=pages} onClick={()=>setPage(value=>value+1)}>Keyingi</Button></div>
 </Card><Card title="Parolni almashtirish"><form onSubmit={changePassword} className="space-y-3">
  <p className="text-sm">Parol o‘zgargach barcha sessiyalar yopiladi va qayta kirish kerak bo‘ladi. Lokal saqlangan amallar o‘chirilmaydi.</p>
  <Input label="Joriy parol" type="password" autoComplete="current-password" required maxLength={72} disabled={changing||!!revoking} value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)}/>
  <Input label="Yangi parol" type="password" autoComplete="new-password" required minLength={8} maxLength={72} disabled={changing||!!revoking} value={newPassword} onChange={event=>setNewPassword(event.target.value)}/>
  <Input label="Yangi parolni tasdiqlash" type="password" autoComplete="new-password" required minLength={8} maxLength={72} disabled={changing||!!revoking} value={confirmation} onChange={event=>setConfirmation(event.target.value)}/>
  {passwordDirty&&<p role="status">Saqlanmagan parol o‘zgarishlari bor.</p>}{changing&&<p role="status">Hisob amali tekshirilmoqda…</p>}{passwordError&&<p role="alert">{passwordError}</p>}<Button type="submit" disabled={changing||!!revoking}>Parolni yangilash</Button>
 </form></Card><Card title="Barcha sessiyalardan chiqish"><p className="text-sm mb-3">Barcha bizneslardagi kirishlar, shu jumladan joriy sessiya ham yopiladi. Lokal amallar o‘chirilmaydi.</p><Button disabled={changing||!!revoking} onClick={logoutAll}>Barcha sessiyalardan chiqish</Button></Card><SecurityHistory/></div>;
}
