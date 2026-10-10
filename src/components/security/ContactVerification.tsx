'use client'
import { useEffect,useState } from 'react'
import { api } from '@/lib/api'
type Status={sms:boolean;email:boolean;totp:boolean;phoneVerified:boolean;emailVerified:boolean;hasEmail:boolean}
export default function ContactVerification(){
 const [data,setData]=useState<Status|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[channel,setChannel]=useState<'sms'|'email'>('sms'),[challenge,setChallenge]=useState<{challengeId:string;expiresAt:string}|null>(null),[code,setCode]=useState(''),[version,setVersion]=useState(0)
 useEffect(()=>{let live=true;void api.request<Status>('/auth/delivery').then(result=>{if(live){setData(result.data??null);setError('')}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Tasdiqlash holati yuklanmadi')});return()=>{live=false}},[version])
 return <section aria-label="Aloqani tasdiqlash" className="space-y-3 rounded border p-4"><h2>Telefon va e-mail tasdig‘i</h2>
 {error&&<p role="alert">{error}<button className="ml-2 underline" onClick={()=>setVersion(value=>value+1)}>Holatni qayta tekshirish</button></p>}
 {!data&&!error&&<p role="status">Yuklanmoqda…</p>}
 {data&&<><p>Telefon: {data.phoneVerified?'tasdiqlangan':'tasdiqlanmagan'}; e-mail: {data.emailVerified?'tasdiqlangan':'tasdiqlanmagan'}.</p><p>SMS: {data.sms?'sozlangan':'mavjud emas'}; e-mail: {data.email?'sozlangan':'mavjud emas'}. TOTP ulanishi hali mavjud emas. Akkaunt avtomatik tasdiqlanmaydi.</p>
 <fieldset disabled={busy} className="space-y-3"><label>Kanal<select aria-label="Tasdiqlash kanali" value={channel} onChange={event=>{setChannel(event.target.value as 'sms'|'email');setChallenge(null);setCode('')}} className="ml-2 border p-2"><option value="sms">Telefon</option><option value="email">E-mail</option></select></label>
 <button className="ml-3 underline" disabled={!data[channel]||channel==='email'&&!data.hasEmail} onClick={async()=>{if(busy)return;setBusy(true);setError('');try{const result=await api.request<{challengeId:string;expiresAt:string}>('/auth/challenges',{method:'POST',body:JSON.stringify({kind:channel==='sms'?'verify_phone':'verify_email',channel})});setChallenge(result.data??null);setCode('')}catch(e){setError(e instanceof Error?e.message:'Kod so‘rovi yuborilmadi')}finally{setBusy(false)}}}>Tasdiqlash kodini so‘rash</button>
 {challenge&&<form onSubmit={async event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');try{await api.request('/auth/challenges/verify',{method:'POST',body:JSON.stringify({challengeId:challenge.challengeId,code})});setChallenge(null);setCode('');setVersion(value=>value+1)}catch(e){setError(e instanceof Error?e.message:'Kod tasdiqlanmadi')}finally{setBusy(false)}}}><p>Kod muddati: {challenge.expiresAt}. Qayta so‘rash cheklangan; yetkazilmagan kod ishlamaydi.</p><label>Kod<input type="password" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={event=>setCode(event.target.value)} className="ml-2 border p-2"/></label><button type="submit" className="ml-3 underline">Kodni tekshirish</button></form>}</fieldset></>}
 </section>
}
