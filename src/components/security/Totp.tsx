'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges'
import {commitPageNavigation} from '@/lib/page-navigation'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { deviceId, pendingOperations } from '@/lib/offline'
type Status={available:boolean;recoveryAvailable?:boolean;enabled?:boolean;factorId?:string|null;enrollmentExpiresAt?:string|null;recoveryCodesRemaining?:number;passwordRebindRequired?:boolean}
type Enrollment={factorId:string;expiresAt:string;provisioningUri:string}
export default function Totp(){
 const {user,organization,refreshUser}=useAuth(),router=useRouter()
 const [status,setStatus]=useState<Status|null>(null),[setup,setSetup]=useState<Enrollment|null>(null),[backups,setBackups]=useState<string[]>([])
 const [password,setPassword]=useState(''),[code,setCode]=useState(''),[recoveryCode,setRecoveryCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[version,setVersion]=useState(0)
 useUnsavedChanges(Boolean(password||code||recoveryCode||setup||backups.length),busy,'Authenticatorning saqlanmagan maydonlari yoki faqat shu oynada ko‘rinadigan kalit/kodlari bor. Chiqishni tasdiqlaysizmi?')
 const busyRef=useRef(false)
 useEffect(()=>{let live=true;void api.request<Status>('/auth/totp').then(result=>{if(live){setStatus(result.data??null);if(result.data?.enabled)setSetup(null)}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Authenticator holati yuklanmadi')});return()=>{live=false}},[version])
 const perform=async(action:()=>Promise<void>)=>{if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');try{await action()}catch(e){setError(e instanceof Error?e.message:'Natija noaniq. Holatni qayta tekshiring.')}finally{setPassword('');setCode('');setRecoveryCode('');setBusy(false);busyRef.current=false}}
 const start=()=>perform(async()=>{const response=await api.request<Enrollment>('/auth/totp/enroll',{method:'POST',body:JSON.stringify({password})});if(!response.data?.provisioningUri)throw new Error('Ulash kaliti olinmadi; holatni tekshiring');setSetup(response.data);setBackups([]);setVersion(v=>v+1)})
 const confirm=()=>perform(async()=>{if(!setup)return;const response=await api.request<{enabled:boolean;recoveryCodes:string[]}>('/auth/totp/confirm',{method:'POST',body:JSON.stringify({factorId:setup.factorId,code})});setSetup(null);setBackups(response.data?.recoveryCodes??[]);setVersion(v=>v+1)})
 const rotate=()=>perform(async()=>{const response=await api.request<{recoveryCodes:string[]}>('/auth/totp/rotate',{method:'POST',body:JSON.stringify({password,code})});setBackups(response.data?.recoveryCodes??[]);setVersion(v=>v+1)})
 const recover=()=>perform(async()=>{
  if(!user||!organization||!status?.factorId)return
  if((await pendingOperations({organizationId:organization.id,userId:user.id,deviceId:deviceId()})).length)throw new Error('Sinxronlanmagan amallar bor; avval ularning natijasini tekshiring')
  await api.request('/auth/totp/recover',{method:'POST',body:JSON.stringify({password,factorId:status.factorId,recoveryCode})})
  setSetup(null);setBackups([]);commitPageNavigation();await refreshUser();router.replace('/login')
 })
 const seed=(()=>{try{return setup?new URL(setup.provisioningUri).searchParams.get('secret'):null}catch{return null}})()
 return <section aria-label="Authenticator" className="space-y-3 rounded border p-4"><h2>Authenticator</h2>
 <p>Authenticator kodlarini ulash. Hozir bu kirishda majburiy ikkinchi faktor sifatida ishlatilmaydi.</p>
 {error&&<p role="alert">{error}</p>}
 <button disabled={busy} className="underline" onClick={()=>{setError('');setVersion(v=>v+1)}}>Authenticator holatini tekshirish</button>
 {!status&&!error&&<p role="status">Yuklanmoqda…</p>}
 {status&&!status.available&&<p>Authenticator hozir mavjud emas.{status.recoveryAvailable?' Mavjud ulanishni zaxira kod bilan bekor qilish mumkin.':''}</p>}
 {status&&(status.available||status.recoveryAvailable)&&<fieldset disabled={busy} className="space-y-3">
 <p role="status">{status.enabled?'Authenticator ulangan':'Authenticator ulanmagan'}</p>
 {status.passwordRebindRequired&&<p>Parol o‘zgargan. Zaxira kod bilan eski ulanishni bekor qiling, keyin qayta ulang.</p>}
 {backups.length>0&&<div aria-label="Zaxira kodlar" className="rounded border p-3"><p>Bu zaxira kodlar faqat shu oynada ko‘rsatiladi. Har biri bir marta ishlaydi va bir yil amal qiladi. Xavfsiz joyga yozib oling; hech kimga yubormang.</p><ul>{backups.map(value=><li key={value}><code>{value}</code></li>)}</ul><button className="underline" onClick={()=>setBackups([])}>Kodlarni saqladim — oynadan tozalash</button></div>}
 {!status.enabled&&status.available&&<><label>Joriy parol<input aria-label="Authenticator uchun joriy parol" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="ml-2 border p-2"/></label><button className="ml-3 underline" disabled={!password} onClick={start}>{setup?'Yangi ulash kalitini olish':'Authenticator ulash'}</button>
 {!setup&&status.enrollmentExpiresAt&&<p>Oldingi ulash kaliti qayta ko‘rsatilmaydi. Yangi ulashni boshlang.</p>}
 {setup&&<div><p>Authenticator ilovasida yangi hisob oching: nomi POS, vaqtga asoslangan kod, kalit:</p><code aria-label="Authenticator ulash kaliti">{seed}</code><p>Ulash muddati: {setup.expiresAt}. Kalitni hech kimga yubormang.</p><label>Authenticator kodi<input aria-label="Authenticator tasdiqlash kodi" type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value)} className="ml-2 border p-2"/></label><button className="ml-3 underline" disabled={!/^\d{6}$/.test(code)} onClick={confirm}>Authenticatorni tasdiqlash</button></div>}</>}
 {status.enabled&&<><p>Amaldagi zaxira kodlar: {status.recoveryCodesRemaining??0}. Kodlarni saqlamagan bo‘lsangiz, yangi Authenticator kodi bilan almashtiring.</p>
 <label>Joriy parol<input aria-label="Authenticator uchun joriy parol" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="ml-2 border p-2"/></label>
 <div><label>Yangi Authenticator kodi<input aria-label="Zaxira kodlarni yangilash uchun Authenticator kodi" type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value)} className="ml-2 border p-2"/></label><button className="ml-3 underline" disabled={!status.available||!password||!/^\d{6}$/.test(code)||status.passwordRebindRequired} onClick={rotate}>Zaxira kodlarni yangilash</button></div>
 <div><p>Ulanishni bekor qilish barcha qurilmalardan chiqaradi. Yangi kirishdan keyin qayta ulash mumkin.</p><label>Zaxira kod<input aria-label="Authenticatorni tiklash uchun zaxira kod" type="password" autoComplete="off" maxLength={32} value={recoveryCode} onChange={e=>setRecoveryCode(e.target.value)} className="ml-2 border p-2"/></label><button className="ml-3 underline" disabled={!password||!/^[0-9a-f]{32}$/.test(recoveryCode)} onClick={recover}>Zaxira kod bilan ulanishni bekor qilish</button></div></>}
 </fieldset>}
 </section>
}
