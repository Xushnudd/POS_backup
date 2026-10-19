'use client'
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {localizeOwnedLabels} from '@/i18n/messages';

import {useTranslation} from '@/context/LocaleContext';

import { useEffect,useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import DurableMutation from '@/components/forms/DurableMutation'
import PendingActions from '@/components/forms/PendingActions'
type Detail={id:string;title:string;description:string;severity:string;state:string;requestedBy:string;assignedTo:string|null;firstRespondedAt:string|null;firstResolvedAt:string|null;resolvedAt:string|null;policy:{status:string};total:number;metrics:{firstResponseBusinessMinutes:number|null;firstResolutionBusinessMinutes:number|null;needsEscalation:boolean};events:{id:string;kind:string;message:string;createdAt:string;actor:{fullName:string}}[]}
type Operator={userId:string;role:string;user:{fullName:string}}
const states:Record<string,string>={open:'Ochiq',in_progress:'Ishlanmoqda',waiting_customer:'Mijoz javobi kutilmoqda',resolved:'Yechilgan',closed:'Yopilgan'}
const statesSource=states;
const severities:Record<string,string>={normal:'Oddiy',important:'Muhim',critical:'Kritik'}
const severitiesSource=severities;
export default function TicketDetail({id,scope}:{id:string;scope:'tenant'|'platform'}){const {organization,user}=useAuth();return organization&&user?<Ticket key={organization.id+':'+user.id+':'+id+':'+scope} id={id} scope={scope}/>:null}
function Ticket({id,scope}:{id:string;scope:'tenant'|'platform'}){
 const {status:codeLabel}=useTranslation();

 const {message:uiMessage}=useTranslation();

 const {locale:mapLocale}=useTranslation();
 const severities=localizeOwnedLabels(severitiesSource,mapLocale);

 const states=localizeOwnedLabels(statesSource,mapLocale);

 const {t:tr}=useTranslation();

 const [data,setData]=useState<Detail|null>(null),[operators,setOperators]=useState<Operator[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[version,setVersion]=useState(0),[page,setPage]=useState(1)
 const [operatorLoading,setOperatorLoading]=useState(scope==='platform'),[operatorError,setOperatorError]=useState('')
 const [selectedAction,setSelectedAction]=useState('reply'),[message,setMessage]=useState(''),[selectedState,setSelectedState]=useState('resolved'),[severity,setSeverity]=useState('normal'),[assigned,setAssigned]=useState('')
 useEffect(()=>{let live=true;void Promise.resolve().then(async()=>{if(!live)return;setLoading(true);try{const response=await api.request<Detail>(`/support/tickets/${encodeURIComponent(id)}?scope=${scope}&page=${page}`);if(live){setData(response.data??null);setError('')}}catch(e){if(live){setError(displayErrorMessage(e,'Murojaat yuklanmadi'))}}finally{if(live)setLoading(false)}});return()=>{live=false}},[id,scope,page,version])
 useEffect(()=>{if(scope!=='platform')return;let live=true;void api.request<Operator[]>('/support/tickets/operators').then(response=>{if(live){setOperators(response.data??[]);setOperatorError('');}}).catch(e=>{if(live)setOperatorError(displayErrorMessage(e,'Support mas’ullari yuklanmadi'));}).finally(()=>{if(live)setOperatorLoading(false);});return()=>{live=false}},[scope,version])
 const terminal=!!data&&['resolved','closed'].includes(data.state),action=terminal&&selectedAction==='reply'?'state':selectedAction
 const stateOptions=terminal?(data?.state==='resolved'?['open','closed']:['open']):scope==='platform'?['in_progress','waiting_customer','resolved']:['resolved']
 const targetState=stateOptions.includes(selectedState)?selectedState:stateOptions[0]
 const body={scope,action,message,...(action==='state'?{state:targetState}:{}),...(action==='severity'?{severity}:{}),...(action==='assignment'?{assignedTo:assigned||null}:{})}
 return <div className="space-y-5 p-6"><Link href={'/tickets?scope='+scope} className="underline">{tr("Murojaatlar ro‘yxati")}</Link>
 <button className="underline" disabled={loading||operatorLoading} onClick={()=>{setLoading(true);if(scope==='platform')setOperatorLoading(true);setVersion(value=>value+1);}}>{tr("Murojaatni yangilash")}</button><PendingActions prefix={`/support/tickets/${id}/commands`} returnPath={`/tickets/${id}`} revision={version} onDone={(_result,original)=>{if(JSON.stringify(original)===JSON.stringify(body))setMessage('');setLoading(true);if(scope==='platform')setOperatorLoading(true);setVersion(value=>value+1)}}/>{operatorLoading&&<p role="status">{tr("Support mas’ullari yuklanmoqda…")}</p>}{operatorError&&<p role="alert">{uiMessage(operatorError)}{tr(". Oxirgi ro‘yxat va draft saqlangan; mas’ul biriktirishdan oldin ma’lumotni yangilang.")}</p>}{loading&&<p role="status">{tr("Yuklanmoqda…")}</p>}{error&&<p role="alert">{uiMessage(error)}<button className="ml-3 underline" onClick={()=>setVersion(value=>value+1)}>{tr("Qayta urinish")}</button></p>}
 {data&&<><h1 className="text-2xl font-bold">{data.title}</h1><p>{severities[data.severity]} · {states[data.state]}</p><p className="whitespace-pre-wrap">{data.description}</p><p>{tr("Ichki tartib: draft, rasmiy SLA emas. Favqulodda telefon/Telegram va tashqi yetkazish tasdiqlanmagan.")}</p><p>{tr("Supportning birinchi javobi:")}{' '}{data.firstRespondedAt??tr("hali javob yo‘q")}{tr("; ish minuti:")}{' '}{data.metrics.firstResponseBusinessMinutes?.toFixed(1)??'—'}.</p><p>{tr("Birinchi yechim:")}{' '}{data.firstResolvedAt??tr("hali yechilmagan")}{tr("; ish minuti:")}{' '}{data.metrics.firstResolutionBusinessMinutes?.toFixed(1)??'—'}{tr(". Joriy yechim:")}{' '}{data.resolvedAt??tr("ochiq")}.</p>{data.metrics.needsEscalation&&<p role="status">{tr("Ichki eskalatsiya talab qilinadi. Tashqi aloqa kanali orqali xabar yuborilmadi.")}</p>}
 <section aria-label={tr("Murojaat amali")} className="rounded border p-4"><h2>{tr("Javob yoki holatni o‘zgartirish")}</h2><DurableMutation path={`/support/tickets/${id}/commands`} returnPath={`/tickets/${id}`} body={body} canSubmit={!loading&&!error&&(action!=='assignment'||(!operatorLoading&&!operatorError))} label={tr("Murojaat amalini bajarish")} review={[action==='reply'?tr("Javob"):action==='state'?states[targetState]:action==='severity'?severities[severity]:operators.find(op=>op.userId===assigned)?.user.fullName??tr("Mas’ulni olib tashlash"),message,tr("Tarix saqlanadi; tashqi xabar yoki iqtisodiy posting yo‘q.")]} onDone={(_result,original)=>{if(JSON.stringify(original)===JSON.stringify(body))setMessage('');setPage(1);setLoading(true);if(scope==='platform')setOperatorLoading(true);setVersion(value=>value+1)}}>
 <label className="block">{tr("Amal")}<select aria-label={tr("Murojaat amali")} value={action} onChange={e=>setSelectedAction(e.target.value)} className="ml-2 border p-2">{!terminal&&<option value="reply">{tr("Javob")}</option>}<option value="state">{tr("Holat")}</option><option value="severity">{tr("Daraja")}</option>{scope==='platform'&&<option value="assignment" disabled={operatorLoading||!!operatorError}>{tr("Mas’ul")}</option>}</select></label>
 {action==='state'&&<label className="block">{tr("Yangi holat")}<select aria-label={tr("Yangi holat")} value={targetState} onChange={e=>setSelectedState(e.target.value)} className="ml-2 border p-2">{stateOptions.map(state=><option value={state} key={state}>{states[state]}</option>)}</select></label>}
 {action==='severity'&&<label className="block">{tr("Yangi daraja")}<select aria-label={tr("Yangi daraja")} value={severity} onChange={e=>setSeverity(e.target.value)} className="ml-2 border p-2">{Object.entries(severities).map(([value,name])=><option value={value} key={value}>{name}</option>)}</select></label>}
 {action==='assignment'&&<label className="block">{tr("Mas’ul")}<select aria-label={tr("Mas’ul")} value={assigned} onChange={e=>setAssigned(e.target.value)} className="ml-2 border p-2"><option value="">{tr("Biriktirmaslik")}</option>{operators.map(op=><option key={op.userId} value={op.userId}>{op.user.fullName} ({codeLabel(op.role)})</option>)}</select></label>}
 <label className="block">{tr("Javob yoki sabab")}<textarea aria-label={tr("Javob yoki sabab")} className="block w-full border p-2" maxLength={5000} value={uiMessage(message)} onChange={e=>setMessage(e.target.value)}/></label><p>{tr("Maxfiy kalit/token/parol/karta ma’lumotini yubormang. Mas’ulni biriktirishning o‘zi support javobi hisoblanmaydi.")}</p>
 </DurableMutation></section>
 <section aria-label={tr("Murojaat tarixi")} className="space-y-3"><h2>{tr("Tarix — yangidan eskiga")}</h2>{data.events.map(event=><article className="rounded border p-3" key={event.id}><p>{event.actor.fullName} · {event.kind} · {event.createdAt}</p><p className="whitespace-pre-wrap">{event.message}</p></article>)}<button className="underline" disabled={loading||page<=1} onClick={()=>setPage(value=>value-1)}>{tr("Oldingi")}</button><span className="mx-3">{tr("Sahifa")}{' '}{page}{tr(", jami")}{' '}{data.total} {tr("voqea")}</span><button className="underline" disabled={loading||page*20>=data.total} onClick={()=>setPage(value=>value+1)}>{tr("Keyingi")}</button></section>
 </>}
 </div>
}
