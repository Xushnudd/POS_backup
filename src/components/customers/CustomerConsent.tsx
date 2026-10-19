'use client';
import {useCallback,useEffect,useState} from 'react';
import {api} from '@/lib/api';
import {errorMessage} from '@/i18n/errors';
import {useTranslation} from '@/context/LocaleContext';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import DurableMutation from '@/components/forms/DurableMutation';
type Event={id:string;revision:number;purpose:string;channel:string;granted:boolean;source:string;evidenceRef:string;policyVersion:string;createdAt:string};
type History={revision:number;rows:Event[];nextBefore:number|null};
export default function CustomerConsent({customerId}:{customerId:string}){
 const {t:tr,formatDate}=useTranslation();
 const [history,setHistory]=useState<History|null>(null),[before,setBefore]=useState<number|undefined>(),[version,setVersion]=useState(0);
 const [busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const [purpose,setPurpose]=useState('electronic_receipt'),[channel,setChannel]=useState('sms'),[source,setSource]=useState('in_person');
 const [granted,setGranted]=useState(false),[evidenceRef,setEvidenceRef]=useState(''),[policyVersion,setPolicyVersion]=useState('');
 const refresh=useCallback(()=>setVersion(v=>v+1),[]);
 useEffect(()=>{
  let live=true;
  void Promise.resolve().then(async()=>{
   if(!live)return;setBusy(true);setError('');
   try{const response=await api.request<History>(`/customers/${customerId}/consents${before?'?before='+before:''}`);if(!response.data)throw Error('CONSENT_READ_FAILED');if(live)setHistory(response.data)}
   catch(cause){if(live){setHistory(null);setError(errorMessage(cause))}}
   finally{if(live)setBusy(false)}
  });return()=>{live=false};
 },[customerId,before,version]);
 const purposes=[{value:'electronic_receipt',label:tr('Elektron chek roziligi')},{value:'service_reminder',label:tr('Xizmat eslatmasi roziligi')},{value:'marketing',label:tr('Reklama roziligi')}];
 const sources=[{value:'in_person',label:tr('Shaxsan qayd etilgan')},{value:'written',label:tr('Yozma rozilik')},{value:'customer_request',label:tr('Mijoz so‘rovi')}];
 return <Card title={tr('Aloqa uchun roziliklar')}>
  <p>{tr('Har bir maqsad va kanal uchun alohida rozilik kerak. Bu yerda qayd etish xabar yubormaydi.')}</p>
  <p>{tr('Mijoz kartasi o‘zgarsa, yuborishdan oldin rozilik qayta olinadi. Dalil maydoniga telefon, token yoki hujjat matnini yozmang.')}</p>
  {error&&<p role="alert">{error}</p>}
  <Button onClick={refresh} disabled={busy||saving}>{tr('Yangilash')}</Button>
  <DurableMutation path={`/customers/${customerId}/consents`} returnPath={`/customers/${customerId}`}
   label={tr('Rozilik qarorini saqlash')} onSavingChange={setSaving}
   body={{expectedRevision:history?.revision??0,purpose,channel,granted,source,evidenceRef,policyVersion}}
   review={[purposes.find(p=>p.value===purpose)?.label??purpose,channel,granted?tr('Rozilik berildi'):tr('Rozilik bekor qilindi'),evidenceRef,policyVersion]}
   canReview={!busy&&!error&&!!history} canEdit={!busy&&!error&&!!history} canSubmit={!busy&&!error&&!!history&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,159}$/.test(evidenceRef)&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(policyVersion)}
   onRejected={()=>{setBefore(undefined);refresh()}}
   onDone={()=>{setEvidenceRef('');setPolicyVersion('');setBefore(undefined);refresh()}}>
   <Select label={tr('Rozilik maqsadi')} value={purpose} onChange={e=>{setPurpose(e.target.value);if(channel==='in_person'&&e.target.value!=='service_reminder')setChannel('sms');}} options={purposes}/>
   <Select label={tr('Aloqa kanali')} value={channel} onChange={e=>setChannel(e.target.value)} options={[{value:'sms',label:'SMS'},{value:'email',label:'E-mail'},{value:'telegram',label:'Telegram'},...(purpose==='service_reminder'?[{value:'in_person',label:tr('Shaxsan taqdim etish')}]:[])]}/>
   <Select label={tr('Rozilik manbasi')} value={source} onChange={e=>setSource(e.target.value)} options={sources}/>
   <Select label={tr('Rozilik qarori')} value={granted?'grant':'withdraw'} onChange={e=>setGranted(e.target.value==='grant')} options={[{value:'withdraw',label:tr('Rozilik bekor qilindi')},{value:'grant',label:tr('Rozilik berildi')}]}/>
   <Input label={tr('Rozilik dalilining identifikatori')} value={evidenceRef} onChange={e=>setEvidenceRef(e.target.value)} maxLength={160}/>
   <Input label={tr('Rozilik matni versiyasi')} value={policyVersion} onChange={e=>setPolicyVersion(e.target.value)} maxLength={80}/>
  </DurableMutation>
  {!busy&&!error&&history?.rows.length===0&&<p>{tr('Hozircha rozilik qaydi yo‘q. Xabar yuborishga ruxsat berilmagan.')}</p>}
  {!busy&&!error&&history?.rows.map(event=><article className="border p-2 my-2" key={event.id}>
   <p>{event.revision} · {purposes.find(p=>p.value===event.purpose)?.label} · {event.channel}</p>
   <p>{event.granted?tr('Rozilik berildi'):tr('Rozilik bekor qilindi')} · {formatDate(event.createdAt,true)}</p>
   <p>{sources.find(s=>s.value===event.source)?.label} · {event.evidenceRef} · {event.policyVersion}</p>
  </article>)}
  <Button disabled={busy||saving||before===undefined} onClick={()=>setBefore(undefined)}>{tr('Eng yangi roziliklar')}</Button>
  <Button disabled={busy||saving||!history?.nextBefore} onClick={()=>{if(history?.nextBefore)setBefore(history.nextBefore)}}>{tr('Oldingi roziliklar')}</Button>
 </Card>;
}
