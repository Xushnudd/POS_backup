'use client'
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import {useCallback,useEffect,useRef,useState} from 'react'
import {api,ApiError} from '@/lib/api'
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges'
type Status={current:{id:string;cancellationEndsAt:string;reason:string}|null;phase:{state:string;cancellationAllowed:boolean};policyVersionId:string;cancellationDays:number}
type Intent={method:'POST'|'PATCH';body:{operationId:string;reason:string;expectedPolicyVersionId?:string;exportJobId?:string;closureId?:string}}
export default function Closure({organizationId}:{organizationId:string}){
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

 const [data,setData]=useState<Status|null>(null),[error,setError]=useState(''),[reason,setReason]=useState(''),[exportJobId,setExportJobId]=useState(''),[password,setPassword]=useState(''),[intent,setIntent]=useState<Intent|null>(null),[busy,setBusy]=useState(false),[review,setReview]=useState(false)
 const flight=useRef(false)
 useUnsavedChanges(Boolean(reason||exportJobId||password||intent||review),busy)
 const storageKey='pos-closure-intent:'+organizationId
 const load=useCallback(async()=>{try{setData((await api.request<Status>('/billing/closure')).data??null)}catch(e){setError(displayErrorMessage(e,'Yopish holati yuklanmadi'))}},[])
 useEffect(()=>{
  let live=true
  void api.request<Status>('/billing/closure').then(r=>{if(live)setData(r.data??null)}).catch(e=>{if(live)setError(displayErrorMessage(e,'Yopish holati yuklanmadi'))})
  void Promise.resolve().then(()=>{if(!live)return;try{const saved=localStorage.getItem(storageKey);if(saved){const value=JSON.parse(saved) as Intent;if((value.method==='POST'||value.method==='PATCH')&&typeof value.body?.operationId==='string'&&typeof value.body.reason==='string'){setIntent(value);setReview(true)}}}catch{setError('Saqlangan amalni o‘qib bo‘lmadi. Holatni tekshiring.')}})
  return()=>{live=false}
 },[storageKey])
 async function submit(){
  if(!data||!password||flight.current)return
  const next=intent??{method:data.current?'PATCH' as const:'POST' as const,body:{operationId:crypto.randomUUID(),reason,...(data.current?{closureId:data.current.id}:{expectedPolicyVersionId:data.policyVersionId,exportJobId})}}
  try{localStorage.setItem(storageKey,JSON.stringify(next))}catch{setError('Amal kalitini xavfsiz saqlab bo‘lmadi; so‘rov yuborilmadi.');return}
  flight.current=true;setIntent(next);setBusy(true);setError('')
  try{
   await api.request('/billing/closure',{method:next.method,body:JSON.stringify({...next.body,password})})
   localStorage.removeItem(storageKey);setIntent(null);setReview(false);setReason('');setExportJobId('');await load()
  }catch(e){
   if(e instanceof ApiError&&e.code==='RETENTION_POLICY_CHANGED'){localStorage.removeItem(storageKey);setIntent(null);setReview(false);await load()}
   setError(displayErrorMessage(e,'Amal tasdig‘i olinmadi; aynan shu kalit bilan qayta tekshiring'))
  }
  finally{flight.current=false;setPassword('');setBusy(false)}
 }
 return <section aria-label={tr("Tashkilotni yopish")} className="space-y-3 rounded border p-4"><h2 className="font-semibold">{tr("Tashkilotni yopish")}</h2>
 {busy&&<p role="status">{tr("Server tasdig‘i kutilmoqda…")}</p>}{!busy&&(reason||exportJobId||password||intent||review)&&<p role="status">{tr("Yopish formasida saqlanmagan yoki natijasi tekshiriladigan amal bor.")}</p>}
 {error&&<p role="alert">{uiMessage(error)}<button disabled={busy} onClick={()=>void load()} className="ml-2 underline">{tr("Holatni tekshirish")}</button></p>}
 {!data&&!error&&<p role="status">{tr("Yuklanmoqda…")}</p>}
 {data&&<><p>{tr("Bu jarayon ma’lumotlarni o‘chirmaydi. Faol so‘rov yangi biznes amallarini to‘xtatadi; ko‘rish va eksport ochiq qoladi.")}</p>
 {data.current?<><p>{tr("Faol so‘rov:")}{' '}{data.current.id}</p><p>{tr("Bekor qilish muddati:")}{' '}{data.current.cancellationEndsAt}</p>{!data.phase.cancellationAllowed&&<p>{tr("Bekor qilish muddati tugagan. Huquqiy ko‘rib chiqish talab qilinadi; avtomatik o‘chirish yo‘q.")}</p>}</>:<><p>{tr("So‘rovni")}{' '}{data.cancellationDays} {tr("kun ichida bekor qilish mumkin. Avval ochiq smenalar va amallarni hal qiling.")}</p><a className="underline" href="/jobs">{tr("Biznes eksportini tayyorlash va yuklab olish")}</a></>}
 {(intent||!data.current||data.phase.cancellationAllowed)&&<>
 {!data.current&&!intent&&<label className="block">{tr("Yuklab olingan biznes eksportining job IDsi")}<input className="ml-2 border" value={exportJobId} disabled={review||busy} onChange={e=>setExportJobId(e.target.value)}/></label>}
 <label className="block">{tr("Yopish yoki bekor qilish sababi")}<input className="ml-2 border" value={intent?.body.reason??reason} disabled={!!intent||review||busy} maxLength={2000} onChange={e=>setReason(e.target.value)}/></label>
 {!review?<button disabled={reason.trim().length<3||(!data.current&&!exportJobId)} onClick={()=>setReview(true)}>{tr("Amalni ko‘rib chiqish")}</button>:<>
 <p>{intent?tr("Saqlangan {value1} amali aynan oldingi kalit bilan tekshiriladi.",{value1:String(intent.method==='POST'?'yopish':'bekor qilish')}):data.current?tr("Yopish so‘rovi bekor qilinadi. Obuna cheklovlari saqlanadi."):tr("Yangi biznes amallari to‘xtatiladi. Bekor qilish oynasi: {value1} kun.",{value1:String(data.cancellationDays)})}</p>
 <label className="block">{tr("Joriy parol bilan tasdiqlash")}<input className="ml-2 border" type="password" autoComplete="current-password" value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/></label>
 <button disabled={busy||!password} onClick={()=>void submit()}>{busy?tr("Tekshirilmoqda…"):intent?tr("Oldingi amalni qayta tekshirish"):tr("Yopish amalini tasdiqlash")}</button>
 {!intent&&<button disabled={busy} onClick={()=>{setReview(false);setPassword('')}} className="ml-3">{tr("Tahrirlash")}</button>}
 </>}
 </>}
 </>}
 </section>
}
