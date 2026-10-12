'use client'
import {useEffect,useState} from 'react'
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges'
import {useAcknowledgedMutation} from '@/hooks/useAcknowledgedMutation'
import {api} from '@/lib/api'
type Status={sms:boolean;email:boolean;totp:boolean;phoneVerified:boolean;emailVerified:boolean;hasEmail:boolean}
type Challenge={challengeId:string;expiresAt:string}
export default function ContactVerification(){
 const [data,setData]=useState<Status|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[channel,setChannel]=useState<'sms'|'email'>('sms'),[challenge,setChallenge]=useState<Challenge|null>(null),[code,setCode]=useState(''),[version,setVersion]=useState(0)
 const mutation=useAcknowledgedMutation(!loading&&!error),busy=mutation.saving,confirmDiscard=useUnsavedChanges(Boolean(code),busy)
 const refresh=()=>{setLoading(true);setVersion(value=>value+1)}
 useEffect(()=>{let live=true;void api.request<Status>('/auth/delivery').then(result=>{if(live){setData(result.data??null);setError(result.data?'':'Tasdiqlash holati mavjud emas')}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Tasdiqlash holati yuklanmadi')}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[version])
 return <section aria-label="Aloqani tasdiqlash" className="space-y-3 rounded border p-4"><h2>Telefon va e-mail tasdig‘i</h2>
 <button className="underline" disabled={loading||busy} onClick={refresh}>Holatni qayta tekshirish</button>{error&&<p role="alert">{error}. Oxirgi holat va kod drafti saqlangan.</p>}{mutation.error&&<p role="alert">{mutation.error}</p>}
 {loading&&<p role="status">Tasdiqlash holati yuklanmoqda…</p>}{busy&&<p role="status">Server tasdig‘i kutilmoqda…</p>}{mutation.state==='saved'&&<p role="status">Tasdiqlash amali serverda qabul qilindi.</p>}
 {data&&<><p>Telefon: {data.phoneVerified?'tasdiqlangan':'tasdiqlanmagan'}; e-mail: {data.emailVerified?'tasdiqlangan':'tasdiqlanmagan'}.</p><p>SMS: {data.sms?'sozlangan':'mavjud emas'}; e-mail: {data.email?'sozlangan':'mavjud emas'}. {data.totp?'Authenticator sozlamalari quyida.':'Authenticator ulanishi hozir mavjud emas.'} Akkaunt avtomatik tasdiqlanmaydi.</p>
 <fieldset disabled={busy||loading||!!error} className="space-y-3"><label>Kanal<select aria-label="Tasdiqlash kanali" value={channel} onChange={event=>{if(!confirmDiscard())return;mutation.edited();setChannel(event.target.value as 'sms'|'email');setChallenge(null);setCode('')}} className="ml-2 border p-2"><option value="sms">Telefon</option><option value="email">E-mail</option></select></label>
 <button className="ml-3 underline" disabled={!data[channel]||(channel==='email'?(!data.hasEmail||data.emailVerified):data.phoneVerified)} onClick={()=>{if(!confirmDiscard())return;let issued:Challenge|null=null;void mutation.execute(async()=>{const result=await api.request<Challenge>('/auth/challenges',{method:'POST',body:JSON.stringify({kind:channel==='sms'?'verify_phone':'verify_email',channel})});if(!result.data?.challengeId||!result.data.expiresAt)throw new Error('Kod so‘rovi tasdiqlanmadi');issued=result.data},()=>{setChallenge(issued);setCode('')})}}>Tasdiqlash kodini so‘rash</button>
 {challenge&&<form onChangeCapture={mutation.edited} onSubmit={event=>{event.preventDefault();void mutation.execute(async()=>{const result=await api.request<{verified:boolean}>('/auth/challenges/verify',{method:'POST',body:JSON.stringify({challengeId:challenge.challengeId,code})});if(result.data?.verified!==true)throw new Error('Tasdiqlash natijasi mavjud emas')},()=>{setChallenge(null);setCode('');refresh()})}}><p>Kod muddati: {challenge.expiresAt}. Qayta so‘rash cheklangan; yetkazilmagan kod ishlamaydi.</p><label>Kod<input type="password" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={event=>setCode(event.target.value)} className="ml-2 border p-2"/></label><button type="submit" className="ml-3 underline">Kodni tekshirish</button></form>}</fieldset></>}
 </section>
}
