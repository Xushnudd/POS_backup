'use client'
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {localizeOwnedLabels} from '@/i18n/messages';

import {useTranslation} from '@/context/LocaleContext';

import { useEffect,useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import DurableMutation from '@/components/forms/DurableMutation'
import PendingActions from '@/components/forms/PendingActions'
import {confirmPageNavigation} from '@/lib/page-navigation'
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges'
export type TicketQuery={scope:'tenant'|'platform';page:number;state:string;severity:string;search:string}
export type Policy={id:string;version:number;timezone:string;weekdays:number[];opensMinute:number;closesMinute:number;firstResponseMinutes:number;escalationMinutes:number;status:string;emergencyContact:null}
type Ticket={id:string;title:string;severity:string;state:string;assigneeName:string|null;assigneeActive:boolean|null;metrics:{needsFirstResponse:boolean;needsEscalation:boolean};firstResponseDueAt:string}
const stateNames:Record<string,string>={open:'Ochiq',in_progress:'Ishlanmoqda',waiting_customer:'Mijoz javobi kutilmoqda',resolved:'Yechilgan',closed:'Yopilgan'}
const stateNamesSource=stateNames;
const severityNames:Record<string,string>={normal:'Oddiy',important:'Muhim',critical:'Kritik'}
const severityNamesSource=severityNames;
const days=['Du','Se','Ch','Pa','Ju','Sh','Ya']
const time=(minute:number)=>String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0')
export default function TicketList({query}:{query:TicketQuery}){const {organization,user}=useAuth();return organization&&user?<Tickets key={organization.id+':'+user.id} query={query}/>:null}
function Tickets({query}:{query:TicketQuery}){
 const {message:uiMessage}=useTranslation();

 const {locale:mapLocale}=useTranslation();

 const severityNames=localizeOwnedLabels(severityNamesSource,mapLocale);

 const stateNames=localizeOwnedLabels(stateNamesSource,mapLocale);

 const {t:tr}=useTranslation();

 const router=useRouter(),[data,setData]=useState<{rows:Ticket[];total:number;canOperate:boolean;canManagePolicy:boolean}|null>(null),[policy,setPolicy]=useState<Policy|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[version,setVersion]=useState(0)
 const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[severity,setSeverity]=useState('normal'),[requestId,setRequestId]=useState(''),[errorCode,setErrorCode]=useState(''),[created,setCreated]=useState('')
 const refresh=()=>{setLoading(true);setVersion(value=>value+1);}
 const navigate=(changes:Partial<TicketQuery>)=>{const next={...query,...changes};if(JSON.stringify(next)===JSON.stringify(query)||!confirmPageNavigation())return;setLoading(true);const params=new URLSearchParams({scope:next.scope,page:String(next.page),...(next.state?{state:next.state}:{}),...(next.severity?{severity:next.severity}:{}),...(next.search?{search:next.search}:{})});router.replace('/tickets?'+params)}
 useEffect(()=>{let live=true;void Promise.resolve().then(async()=>{if(!live)return;setLoading(true);try{const params=new URLSearchParams({scope:query.scope,page:String(query.page),...(query.state?{state:query.state}:{}),...(query.severity?{severity:query.severity}:{}),...(query.search?{search:query.search}:{})});const [list,current]=await Promise.all([api.request<{rows:Ticket[];total:number;canOperate:boolean;canManagePolicy:boolean}>('/support/tickets?'+params),api.request<Policy>('/support/policy')]);if(live){setData(list.data??null);setPolicy(current.data??null);setError('')}}catch(e){if(live){setError(displayErrorMessage(e,'Murojaatlar yuklanmadi'))}}finally{if(live)setLoading(false)}});return()=>{live=false}},[query.scope,query.page,query.state,query.severity,query.search,version])
 useEffect(()=>{if(created&&confirmPageNavigation())router.push('/tickets/'+encodeURIComponent(created));},[created,router]);
 return <div className="space-y-5 p-6"><h1 className="text-2xl font-bold">{tr("Yordam murojaatlari")}</h1><p>{tr("Murojaatni biznes egasi va vakolatli support operatorlari ko‘radi. Maxfiy kalit, token, parol yoki karta ma’lumotini kiritmang.")}</p>
 <button className="underline" disabled={loading} onClick={refresh}>{tr("Murojaatlar va tartibni yangilash")}</button>{created&&<p role="status">{tr("Murojaat serverda yaratildi.")}{' '}<Link href={'/tickets/'+encodeURIComponent(created)}>{tr("Yaratilgan murojaatni ochish")}</Link></p>}<PendingActions prefix="/support" returnPath="/tickets" revision={version} onDone={refresh}/>{error&&<p role="alert">{uiMessage(error)}<button className="ml-3 underline" onClick={refresh}>{tr("Qayta urinish")}</button></p>}
 {policy&&<section className="rounded border p-4"><h2>{tr("Ichki ish tartibi loyihasi")}</h2><p>{policy.weekdays.map(day=>days[day-1]).join(', ')} · {time(policy.opensMinute)}–{time(policy.closesMinute)} · {policy.timezone}</p><p>{tr("Birinchi javob uchun ichki maqsad:")}{' '}{policy.firstResponseMinutes} {tr("ish minuti. Eskalatsiya belgisi:")}{' '}{policy.escalationMinutes} {tr("ish minuti.")}</p><p>{tr("Bu rasmiy mijoz SLA yoki javob kafolati emas. Favqulodda telefon/Telegram hali tasdiqlanmagan; tashqi xabar yuborilmaydi.")}</p></section>}
 <fieldset disabled={loading} className="flex flex-wrap items-center gap-4"><label>{tr("Holat")}<select aria-label={tr("Murojaat holati")} value={query.state} onChange={e=>navigate({state:e.target.value,page:1})} className="ml-2 border p-2"><option value="">{tr("Barchasi")}</option>{Object.entries(stateNames).map(([value,name])=><option value={value} key={value}>{name}</option>)}</select></label><label>{tr("Daraja")}<select aria-label={tr("Murojaat darajasi")} value={query.severity} onChange={e=>navigate({severity:e.target.value,page:1})} className="ml-2 border p-2"><option value="">{tr("Barchasi")}</option>{Object.entries(severityNames).map(([value,name])=><option value={value} key={value}>{name}</option>)}</select></label>
 {data?.canOperate&&<label>{tr("Ko‘rish rejimi")}<select aria-label={tr("Ko‘rish rejimi")} value={query.scope} onChange={e=>navigate({scope:e.target.value as 'tenant'|'platform',page:1})} className="ml-2 border p-2"><option value="tenant">{tr("Biznes murojaatlari")}</option><option value="platform">{tr("Platforma navbati")}</option></select></label>}
 <form onSubmit={e=>{e.preventDefault();navigate({search:String(new FormData(e.currentTarget).get('search')??''),page:1})}}><label>{tr("Qidirish")}<input key={query.search} name="search" defaultValue={query.search} maxLength={100} className="ml-2 border p-2"/></label><button className="ml-2 underline">{tr("Qidirish")}</button></form></fieldset>
 {loading&&<p role="status">{tr("Yuklanmoqda…")}</p>}
 {data&&!loading&&<><p>{tr("Jami:")}{' '}{data.total}</p>{!data.rows.length&&<p>{tr("Bu filtrlarga mos murojaat yo‘q.")}</p>}{data.rows.map(row=><article className="rounded border p-4" key={row.id}><Link href={`/tickets/${row.id}?scope=${query.scope}`} className="font-semibold underline">{row.title}</Link><p>{severityNames[row.severity]} · {stateNames[row.state]} {tr("· Mas’ul:")}{' '}{row.assigneeName??tr("tayinlanmagan")}{row.assigneeActive===false?tr("(vakolati bekor qilingan)"):''}</p><p>{tr("Ichki birinchi javob maqsadi:")}{' '}{row.firstResponseDueAt}</p>{row.metrics.needsEscalation&&<p role="status">{tr("Eskalatsiya talab qilinadi; mas’ul navbatni ko‘rib chiqishi kerak.")}</p>}</article>)}<button className="underline" disabled={query.page<=1} onClick={()=>navigate({page:query.page-1})}>{tr("Oldingi")}</button><span className="mx-3">{tr("Sahifa")}{' '}{query.page}</span><button className="underline" disabled={query.page*20>=data.total} onClick={()=>navigate({page:query.page+1})}>{tr("Keyingi")}</button></>}
 <section aria-label={tr("Yangi murojaat")} className="space-y-3 rounded border p-4"><h2>{tr("Yangi murojaat yaratish")}</h2><DurableMutation path="/support/tickets" canSubmit={!loading&&!error} returnPath="/tickets" body={{title,description,severity,diagnostics:{...(requestId?{requestId}:{}),...(errorCode?{errorCode}:{})}}} label={tr("Murojaatni yuborish")} review={[title,severityNames[severity],description,tr("Biznes egasi va vakolatli support operatorlari ko‘radi. Rasmiy SLA tasdiqlanmagan.")]} onDone={result=>{if(result&&typeof result==='object'&&'id' in result&&typeof result.id==='string'){setTitle('');setDescription('');setSeverity('normal');setRequestId('');setErrorCode('');setCreated(result.id);}refresh()}}>
 <label className="block">{tr("Mavzu")}<input className="block w-full border p-2" value={title} maxLength={160} onChange={e=>setTitle(e.target.value)}/></label><label className="block">{tr("Muammo tavsifi")}<textarea aria-label={tr("Muammo tavsifi")} className="block w-full border p-2" value={description} maxLength={5000} onChange={e=>setDescription(e.target.value)}/></label><label className="block">{tr("Daraja")}<select aria-label={tr("Yangi murojaat darajasi")} className="ml-2 border p-2" value={severity} onChange={e=>setSeverity(e.target.value)}>{Object.entries(severityNames).map(([value,name])=><option value={value} key={value}>{name}</option>)}</select></label><label className="block">{tr("So‘rov raqami (ixtiyoriy)")}<input className="block w-full border p-2" value={requestId} onChange={e=>setRequestId(e.target.value)}/></label><label className="block">{tr("Xato kodi (ixtiyoriy)")}<input className="block w-full border p-2" value={errorCode} maxLength={80} onChange={e=>setErrorCode(e.target.value)}/></label>
 </DurableMutation></section>
 {data?.canManagePolicy&&policy&&<PolicyEditor policy={policy} ready={!loading&&!error} onDone={refresh}/>}
 </div>
}
function PolicyEditor({policy,onDone,ready}:{policy:Policy;onDone:()=>void;ready:boolean}){
 const {t:tr}=useTranslation();

 const [value,setValue]=useState(policy),[reason,setReason]=useState(''),[opening,setOpening]=useState(time(policy.opensMinute)),[closing,setClosing]=useState(time(policy.closesMinute))
 const [saving,setSaving]=useState(false),[baseline,setBaseline]=useState(()=>JSON.stringify([policy.timezone,policy.weekdays,time(policy.opensMinute),time(policy.closesMinute),policy.firstResponseMinutes,policy.escalationMinutes,'']))
 const current=JSON.stringify([value.timezone,value.weekdays,opening,closing,value.firstResponseMinutes,value.escalationMinutes,reason]),confirmDiscard=useUnsavedChanges(current!==baseline,saving)
 const load=(next:Policy)=>{setValue(next);setOpening(time(next.opensMinute));setClosing(time(next.closesMinute));setReason('');setBaseline(JSON.stringify([next.timezone,next.weekdays,time(next.opensMinute),time(next.closesMinute),next.firstResponseMinutes,next.escalationMinutes,'']));}
 const minute=(text:string)=>{if(!/^\d{2}:\d{2}$/.test(text))return NaN;const hours=Number(text.slice(0,2)),minutes=Number(text.slice(3));return minutes<60&&(hours<24||(hours===24&&minutes===0))?hours*60+minutes:NaN}
 const body={timezone:value.timezone,weekdays:value.weekdays,opensMinute:minute(opening),closesMinute:minute(closing),firstResponseMinutes:value.firstResponseMinutes,escalationMinutes:value.escalationMinutes,reason}
 return <section aria-label={tr("Support ish tartibini sozlash")} className="rounded border p-4"><h2>{tr("Yangi ichki tartib versiyasi")}</h2><p>{tr("Draft asosidagi versiya:")}{' '}{value.version}{tr("; joriy versiya:")}{' '}{policy.version}.</p>{current!==baseline&&<p role="status">{tr("Saqlanmagan ish tartibi o‘zgarishlari bor.")}</p>}{policy.id!==value.id&&<button className="underline" disabled={saving||!ready} onClick={()=>{if(confirmDiscard())load(policy);}}>{tr("Joriy ish tartibini draftga olish")}</button>}<DurableMutation path="/support/policy" canSubmit={ready} returnPath="/tickets" body={body} onSavingChange={setSaving} label={tr("Support tartibini saqlash")} review={[value.weekdays.map(day=>days[day-1]).join(', '),opening+'–'+closing,tr("{value1}/{value2} ish minuti",{value1:String(value.firstResponseMinutes),value2:String(value.escalationMinutes)}),tr("Faqat yangi ticketlar uchun; draft, rasmiy SLA emas."),reason]} onDone={(result,original)=>{if(JSON.stringify(original)===JSON.stringify(body)&&result&&typeof result==='object'&&'id' in result&&'version' in result)load(result as Policy);onDone();}}>
 <div>{days.map((name,index)=><label key={name} className="mr-3"><input type="checkbox" checked={value.weekdays.includes(index+1)} onChange={e=>setValue({...value,weekdays:e.target.checked?[...value.weekdays,index+1].sort((a,b)=>a-b):value.weekdays.filter(day=>day!==index+1)})}/>{name}</label>)}</div>
 <label className="block">{tr("Ochilish vaqti (HH:MM)")}<input value={opening} onChange={e=>setOpening(e.target.value)} className="ml-2 border p-2"/></label><label className="block">{tr("Yopilish vaqti (HH:MM)")}<input value={closing} onChange={e=>setClosing(e.target.value)} className="ml-2 border p-2"/></label>
 {(['firstResponseMinutes','escalationMinutes'] as const).map(field=><label className="block" key={field}>{({opensMinute:tr("Ochilish (00:00 dan minut)"),closesMinute:tr("Yopilish (00:00 dan minut)"),firstResponseMinutes:tr("Birinchi javob (ish minuti)"),escalationMinutes:tr("Eskalatsiya (ish minuti)")})[field]}<input type="number" value={value[field]} onChange={e=>setValue({...value,[field]:Number(e.target.value)})} className="ml-2 border p-2"/></label>)}<label className="block">{tr("Sabab")}<input value={reason} onChange={e=>setReason(e.target.value)} className="ml-2 border p-2"/></label>
 </DurableMutation></section>
}
