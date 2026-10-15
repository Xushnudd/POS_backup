'use client';



import {useTranslation} from '@/context/LocaleContext';

import {useReadPage} from '@/hooks/useReadPage';
import ReadQueryNotice from '@/components/ui/ReadQueryNotice';
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
 const {t:tr}=useTranslation();

 const {user,organization,refreshUser}=useAuth();
 const {page,setPage,invalid:invalidPage,params,changeQuery}=useReadPage('sessions_');
 const sessionView=params.get('sessions_view')??'active',invalid=invalidPage||!['active','all'].includes(sessionView);
 const router=useRouter();
 const [rows,setRows]=useState<AccountSessionRow[]>([]),[pages,setPages]=useState(0),[busy,setBusy]=useState(true),[revoking,setRevoking]=useState(''),[error,setError]=useState(''),[version,setVersion]=useState(0);

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
  if(!user?.id||invalid)return;let cancelled=false;
  void Promise.resolve().then(async()=>{
   if(cancelled)return;setBusy(true);setError('');
   try{const response=await api.sessions.list(page,sessionView as 'active'|'all');if(!response.data)throw new Error('Sessiyalar yuklanmadi');if(!cancelled){setRows(response.data);setPages(response.pagination?.totalPages??0);}}
   catch(error){if(!cancelled)setError(error instanceof Error?error.message:'Sessiyalar yuklanmadi');}
   finally{if(!cancelled)setBusy(false);}
  });return()=>{cancelled=true;};
 },[user?.id,page,version,sessionView,invalid]);
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
 const changeSessionView=(view:'active'|'all')=>{setRows([]);setPages(0);setBusy(true);changeQuery({view,page:'1'});};
 return <div className="space-y-4">{ack&&<p role="status">{ack}</p>}<CashierPin/><ContactVerification/><Totp key={organization?.id}/><ReadQueryNotice invalid={invalid} reset={()=>changeQuery({page:'',limit:'',sort:'',search:'',view:''})}/><h1 className="text-2xl font-bold">{sessionView==='active'?tr("Faol sessiyalar"):tr("Sessiyalar tarixi")}</h1><Card>
  <p className="text-sm mb-3">{tr("Bu ro‘yxat hisobingizning barcha bizneslardagi")}{' '}{sessionView==='active'?tr("faol sessiyalarini"):tr("saqlangan sessiyalarini, jumladan bekor qilingan va muddati tugagan kirishlarini")} {tr("ko‘rsatadi. Qurilma modeli yoki joylashuv taxmin qilinmaydi. Joriy sessiyadan chiqish uchun menyudagi Chiqish tugmasini ishlating.")}</p>
  {sessionView==='all'&&<p className="mb-3 text-sm text-gray-600">{tr("Sessiyalar tarixida oxirgi 90 kunda yaratilgan kirishlar ko‘rsatiladi.")}</p>}
  <div className="mb-3 flex flex-wrap gap-2"><Button size="sm" aria-pressed={sessionView==='active'} disabled={!!revoking||sessionView==='active'} onClick={()=>changeSessionView('active')}>{tr("Faol sessiyalar")}</Button><Button size="sm" aria-pressed={sessionView==='all'} disabled={!!revoking||sessionView==='all'} onClick={()=>changeSessionView('all')}>{tr("Sessiyalar tarixi")}</Button></div>
  {error&&<div role="alert">{error}<Button onClick={()=>{setBusy(true);setVersion(value=>value+1);}}>{tr("Qayta yuklash")}</Button></div>}
  {busy&&!invalid?<p role="status">{tr("Yuklanmoqda...")}</p>:rows.map(row=><article key={row.id} className="border-t py-3 space-y-1">
   <p className="font-semibold">{row.current?tr("Joriy sessiya"):tr("Boshqa sessiya")}</p><p className="text-sm">{tr("Holat:")}{' '}{row.status==='revoked'?tr("Bekor qilingan"):row.status==='expired'?tr("Muddati tugagan"):tr("Faol")}{tr("; kirish usuli:")}{' '}{row.authenticationMethod==='pin'?tr("Kassir PIN"):tr("Parol")}</p><p className="text-xs break-all">{tr("Sessiya ID:")}{' '}{row.id}</p>
   <p className="text-xs break-all">{tr("Biznes ID:")}{' '}{row.organizationId}</p><p className="text-sm">{tr("Yaratilgan:")}{' '}{date(row.createdAt)}</p><p className="text-sm">{tr("Amal qilish muddati:")}{' '}{date(row.expiresAt)}</p><p className="text-sm">{tr("Faolsizlik muddati:")}{' '}{date(row.idleExpiresAt)}</p>
   {row.revokedAt&&<p className="text-sm">{tr("Bekor qilingan:")}{' '}{date(row.revokedAt)}</p>}
   {!row.current&&row.status==='active'&&<Button disabled={!!revoking||changing||!!error} onClick={()=>revoke(row.id)}>{tr("Sessiyani bekor qilish")}</Button>}
  </article>)}
  {!busy&&!error&&!invalid&&rows.length===0&&<p>{tr("Sessiyalar topilmadi.")}</p>}
  <div className="flex items-center gap-3 mt-3"><Button disabled={busy||invalid||!!error||page<=1} onClick={()=>setPage(value=>value-1)}>{tr("Oldingi")}</Button><span>{page} / {Math.max(1,pages)}</span><Button disabled={busy||invalid||!!error||page>=pages} onClick={()=>setPage(value=>value+1)}>{tr("Keyingi")}</Button></div>
 </Card><Card title={tr("Parolni almashtirish")}><form onSubmit={changePassword} className="space-y-3">
  <p className="text-sm">{tr("Parol o‘zgargach barcha sessiyalar yopiladi va qayta kirish kerak bo‘ladi. Lokal saqlangan amallar o‘chirilmaydi.")}</p>
  <Input label={tr("Joriy parol")} type="password" autoComplete="current-password" required maxLength={72} disabled={changing||!!revoking} value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)}/>
  <Input label={tr("Yangi parol")} type="password" autoComplete="new-password" required minLength={8} maxLength={72} disabled={changing||!!revoking} value={newPassword} onChange={event=>setNewPassword(event.target.value)}/>
  <Input label={tr("Yangi parolni tasdiqlash")} type="password" autoComplete="new-password" required minLength={8} maxLength={72} disabled={changing||!!revoking} value={confirmation} onChange={event=>setConfirmation(event.target.value)}/>
  {passwordDirty&&<p role="status">{tr("Saqlanmagan parol o‘zgarishlari bor.")}</p>}{changing&&<p role="status">{tr("Hisob amali tekshirilmoqda…")}</p>}{passwordError&&<p role="alert">{passwordError}</p>}<Button type="submit" disabled={changing||!!revoking}>{tr("Parolni yangilash")}</Button>
 </form></Card><Card title={tr("Barcha sessiyalardan chiqish")}><p className="text-sm mb-3">{tr("Barcha bizneslardagi kirishlar, shu jumladan joriy sessiya ham yopiladi. Lokal amallar o‘chirilmaydi.")}</p><Button disabled={changing||!!revoking} onClick={logoutAll}>{tr("Barcha sessiyalardan chiqish")}</Button></Card><SecurityHistory/></div>;
}
