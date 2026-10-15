'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {localizeOwnedLabels} from '@/i18n/messages';

import {useTranslation} from '@/context/LocaleContext';

import {Suspense,useCallback,useEffect,useRef,useState} from 'react';
import {api} from '@/lib/api';
import {useAuth} from '@/context/AuthContext';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import DurableMutation from '@/components/forms/DurableMutation';
import PendingActions from '@/components/forms/PendingActions';
import Input from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import {useListQuery} from '@/hooks/useListQuery';
import {journalListSorts} from '@/lib/list-query';
import ListFilter from '@/components/ui/ListFilter';
import Select from '@/components/ui/Select';
const kindNames:Record<string,string>={inventory:'Ombor qoldig‘i',sales:'Savdo va to‘lov',returns:'Qaytarish',shifts:'Smena hisobi'};
const kindNamesSource=kindNames;
const evidenceNames:Record<string,string>={productName:'Mahsulot',expected:'Kutilgan',actual:'Haqiqiy',difference:'Farq',itemAmount:'Qatorlar summasi',paymentAmount:'To‘lovlar summasi',receiptNo:'Chek',returnReceiptNo:'Qaytarish cheki'};
const evidenceNamesSource=evidenceNames;
type Incident={id:string;kind:string;severity:string;state:string;evidence:Record<string,string>;resolutionReason?:string;lastSeenAt:string};
export default function Incidents(){
 const {t:tr}=useTranslation();
const {role,organization,user}=useAuth();return organization&&user?<Suspense fallback={<p>{tr("Yuklanmoqda...")}</p>}><IncidentControls key={[organization.id,user.id,role].join(':')}/></Suspense>:null;}
function IncidentControls(){
 const {message:uiMessage}=useTranslation();

 const {locale:mapLocale}=useTranslation();

 const evidenceNames=localizeOwnedLabels(evidenceNamesSource,mapLocale);

 const kindNames=localizeOwnedLabels(kindNamesSource,mapLocale);

 const {t:tr}=useTranslation();

 const {role}=useAuth();const [rows,setRows]=useState<Incident[]>([]),[pages,setPages]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState(''),[reason,setReason]=useState(''),[revision,setRevision]=useState(0);
 const {query,params,changeQuery}=useListQuery(journalListSorts,'newest');
 const page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'newest',search=query?.search??'',state=params.get('state')??'open',invalidQuery=!query;
 const live=useRef(true),sequence=useRef(0);
 useUnsavedChanges(Boolean(reason));
 const load=useCallback(async()=>{
  if(invalidQuery)return;const request=++sequence.current;if(live.current){setBusy(true);setError('');}
  try{const result=await api.request<Incident[]>('/incidents?'+new URLSearchParams({page:String(page),limit:String(limit),state,sort,search}));if(live.current&&request===sequence.current){setRows(result.data??[]);setPages(result.pagination?.totalPages??0);}}
  catch(cause){if(live.current&&request===sequence.current)setError(displayErrorMessage(cause,'Tafovutlar yuklanmadi'));}
  finally{if(live.current&&request===sequence.current)setBusy(false);}
 },[page,limit,state,sort,search,invalidQuery]);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 useEffect(()=>{if(role&&role!=='cashier')void Promise.resolve().then(()=>{if(live.current)return load();});},[load,role,revision]);
 const refresh=()=>setRevision(value=>value+1);
 const resolved=(_result?:unknown,original?:Record<string,unknown>)=>{const savedReason=original?.reason;if(typeof savedReason==='string')setReason(current=>current===savedReason?'':current);refresh();};
 if(role==='cashier')return <p role="alert">{tr("Bu hisobot rahbarlar uchun. Kassada savdo holatini tekshiring.")}</p>;
 return <div className="space-y-4"><h1 className="text-2xl font-bold">{tr("Hisob tafovutlari")}</h1>
  <p>{tr("Mas’ul: biznes egasi va tegishli filial rahbari. Savdo/to‘lov, ombor jurnali, qaytarish va smena mosligi tekshiriladi. Balans avtomatik tuzatilmaydi. Farq bor ekan incidentni yopib bo‘lmaydi.")}</p>
  <PendingActions prefix="/incidents" returnPath="/incidents" revision={revision} onDone={refresh}/>
  <DurableMutation path="/incidents" returnPath="/incidents" body={{}} label={tr("Hisoblarni solishtirish")} review={[tr("Faqat tafovutlar va tekshiruv jurnali yoziladi. Savdo, pul yoki ombor balansi o‘zgarmaydi.")]} onDone={refresh}/>
  <ListFilter search={search} sort={sort} label={tr("Tafovut manbasi yoki turi qidirish")} onChange={changeQuery} reset={{state:''}} options={[{value:'newest',label:tr("Eng yangi")},{value:'oldest',label:tr("Eng eski")}]}><Select label={tr("Tafovut holati")} value={state} options={[{value:'open',label:tr("Ochiq")},{value:'resolved',label:tr("Yopilgan")}]} onChange={e=>changeQuery({state:e.target.value,page:'1'})}/></ListFilter>{invalidQuery&&<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>}
  <Input label={tr("Yopish sababi")} value={reason} maxLength={1000} onChange={event=>setReason(event.target.value)}/>
  {reason&&<p role="status">{tr("Saqlanmagan tafovut yopish sababi bor.")}</p>}{busy&&<p role="status">{tr("Tafovutlar yuklanmoqda…")}</p>}{error&&<p role="alert">{uiMessage(error)} {rows.length>0&&tr("Oxirgi yuklangan ro‘yxat ko‘rsatilmoqda.")}</p>}
  {!busy&&!error&&!invalidQuery&&!rows.length&&<p>{tr("Ushbu holatda tafovut yo‘q. Tekshiruv vaqti serverdagi oxirgi yurishga bog‘liq.")}</p>}
  {!busy&&!error&&!invalidQuery&&rows.map(row=><article key={row.id} className="border p-4 bg-white rounded"><h2>{kindNames[row.kind]??row.kind} · {row.severity==='critical'?tr("Jiddiy"):tr("Ogohlantirish")} · {row.state==='open'?tr("Ochiq"):tr("Yopilgan")}</h2><p>{tr("Oxirgi aniqlanish:")}{' '}{row.lastSeenAt}</p>
   <dl>{Object.entries(row.evidence).filter(([key])=>key in evidenceNames).map(([key,value])=><div key={key}><dt className="font-semibold inline">{evidenceNames[key]}: </dt><dd className="inline">{String(value)}</dd></div>)}</dl>{row.resolutionReason&&<p>{row.resolutionReason}</p>}
   <DurableMutation path={'/incidents/'+row.id} returnPath="/incidents" allowNew={row.state==='open'} canSubmit={!busy&&!error&&!invalidQuery&&reason.trim().length>=3} body={{reason}} label={tr("Tuzatilganini tekshirib yopish")} review={[kindNames[row.kind]??row.kind,tr("Incident:")+" "+row.id,reason,tr("Server farq yo‘qligini tasdiqlamaguncha incident yopilmaydi; balans tuzatilmaydi.")]} onDone={resolved}/>
  </article>)}<Pagination page={page} pages={pages} busy={busy} blocked={invalidQuery||!!error} onPage={value=>changeQuery({page:String(value)})} retry={refresh}/>
 </div>;
}
