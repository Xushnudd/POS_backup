'use client'
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {localizeOwnedLabels} from '@/i18n/messages';

import {useTranslation} from '@/context/LocaleContext';

import {useEffect,useRef,useState} from 'react'
import {useListQuery} from '@/hooks/useListQuery'
import ReadQueryNotice from '@/components/ui/ReadQueryNotice'
import Link from 'next/link'
import {api} from '@/lib/api'
import {useAuth} from '@/context/AuthContext'
type Overview={organizations:{id:string;name:string;state:string;closurePending:boolean;businessWritesAllowed:boolean;plan:{code:string;name:string;version:number}|null;openIncidents:number}[];total:number;page:number;pageSize:number;plans:{code:string;isActive:boolean;currentVersion:{name:string;version:number;monthlyPrice:string;currency:string;branchLimit:number;registerLimit:number;staffLimit:number}}[];incidents:{id:string;organizationId:string;kind:string;severity:string;lastSeenAt:string}[];now:string;health:{database:string};integrations:{authenticationDelivery:{sms:boolean;email:boolean;totp:boolean}}}
const states:Record<string,string>={trial:'Sinov davri',active:'Faol',grace:'Imtiyozli muddat',expired:'Faqat o‘qish',legacy_unmanaged:'Tarifga ko‘chirish kutilmoqda'}
const statesSource=states;
export default function PlatformPage(){
 const {user,organization,role}=useAuth()
 return user&&organization?<OverviewPanel key={`${user.id}:${organization.id}:${role}`}/>:null
}
function OverviewPanel(){
 const {message:uiMessage}=useTranslation();

 const {locale:mapLocale}=useTranslation();

 const states=localizeOwnedLabels(statesSource,mapLocale);

 const {t:tr}=useTranslation();

 const {query,changeQuery}=useListQuery(['source'] as const,'source');
 const queryPage=query?.page??1,querySearch=query?.search??'',invalid=!query||query.limit!==20||querySearch.length>100||queryPage>10000;
 const [loadedKey,setLoadedKey]=useState('');
 const [search,setSearch]=useState(querySearch),[result,setData]=useState<Overview|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const data=loadedKey===JSON.stringify([queryPage,querySearch])?result:null;
 useEffect(()=>{void Promise.resolve().then(()=>setSearch(querySearch))},[querySearch]);
 const flight=useRef(false)
 const load=async(page=1,selectedSearch=search)=>{
  if(flight.current||invalid)return
  flight.current=true;setBusy(true);setError('');setData(null)
  try{const result=await api.request<Overview>('/platform/overview',{method:'POST',body:JSON.stringify({operationId:crypto.randomUUID(),page,search:selectedSearch.trim()})});setData(result.data??null);setLoadedKey(JSON.stringify([page,selectedSearch.trim()]));changeQuery({page:String(page),search:selectedSearch.trim()})}
  catch(failure){setError(displayErrorMessage(failure,'Platforma paneli yuklanmadi'))}
  finally{flight.current=false;setBusy(false)}
 }
 return <div className="space-y-5"><h1 className="text-2xl font-bold">{tr("Platforma boshqaruvi")}</h1><ReadQueryNotice invalid={invalid} reset={()=>changeQuery({page:'',limit:'',search:'',sort:''})}/>
  <p>{tr("Faqat tayinlangan platforma administratorlari. Har bir so‘rov ikkinchi faktor bilan tasdiqlanadi va audit qilinadi.")}</p>
  <form onSubmit={event=>{event.preventDefault();void load(search.trim()===querySearch?queryPage:1)}} className="flex flex-wrap gap-3 items-end">
   <label>{tr("Tashkilot nomi")}<input value={search} maxLength={100} disabled={busy} onChange={event=>setSearch(event.target.value)} className="block border rounded p-2"/></label>
   <button disabled={busy||invalid} className="bg-blue-700 text-white rounded p-2">{busy?tr("Yuklanmoqda…"):tr("Platforma ma’lumotlarini ko‘rish")}</button>
  </form>
  {!data&&!busy&&!error&&!invalid&&<p>{tr("Saqlangan filtr bo‘yicha ma’lumotni ko‘rish uchun tasdiqlang. Har bir ko‘rish vakolat bilan qayta tekshiriladi.")}</p>}
  {error&&<p role="alert">{uiMessage(error)}</p>}
  {busy&&<p role="status">{tr("Vakolat va ma’lumotlar tekshirilmoqda…")}</p>}
  {data&&<><section aria-label={tr("Platforma xizmat holati")} className="border rounded p-4 space-y-2"><h2 className="font-semibold">{tr("Xizmat holati")}</h2>
   <p>{tr("Baza: ushbu so‘rovda ulanish muvaffaqiyatli. Bu butun hosting holatining kafolati emas.")}</p><p>{tr("Tekshirilgan vaqt:")}{' '}{data.now}</p>
   <p>{tr("Click tanlangan; real to‘lov, fiskal va hardware adapterlari hozir ulanmagan.")}</p>
   <p>{tr("SMS:")}{' '}{data.integrations.authenticationDelivery.sms?tr("Sozlangan"):tr("Sozlanmagan")}{tr("; e-mail:")}{' '}{data.integrations.authenticationDelivery.email?tr("Sozlangan"):tr("Sozlanmagan")}{tr("; authenticator:")}{' '}{data.integrations.authenticationDelivery.totp?tr("Mavjud"):tr("Mavjud emas")}.</p>
  </section><section aria-label={tr("Platforma tashkilotlari")}><h2 className="font-semibold">{tr("Tashkilotlar — jami")}{' '}{data.total}</h2>
   {data.organizations.length===0?<p>{tr("Qidiruvga mos tashkilot topilmadi.")}</p>:<div className="overflow-x-auto"><table className="w-full text-left"><thead><tr>{[tr("Tashkilot"),tr("Tarif"),tr("Holat"),tr("Ochiq hodisalar")].map(label=><th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{data.organizations.map(row=><tr key={row.id}><td className="p-2">{row.name}</td><td className="p-2">{row.plan?.name??tr("Belgilanmagan")}</td><td className="p-2">{states[row.state]??tr("Holatni tekshiring")}{row.closurePending?tr("— yopish so‘rovi mavjud"):''}; {row.businessWritesAllowed?tr("Faol amallar ochiq"):tr("Faol amallar yopiq")}</td><td className="p-2">{row.openIncidents}</td></tr>)}</tbody></table></div>}
   <div className="flex gap-3 py-3"><button disabled={busy||data.page===1} onClick={()=>void load(data.page-1,querySearch)}>{tr("Oldingi sahifa")}</button><span>{tr("Sahifa")}{' '}{data.page}</span><button disabled={busy||data.page*data.pageSize>=data.total} onClick={()=>void load(data.page+1,querySearch)}>{tr("Keyingi sahifa")}</button></div>
  </section><section aria-label={tr("Platforma tariflari")}><h2 className="font-semibold">{tr("Tariflar")}</h2><ul>{data.plans.map(plan=><li key={plan.code}>{plan.currentVersion.name}: {plan.currentVersion.monthlyPrice} {plan.currentVersion.currency}/oy; {plan.currentVersion.branchLimit} {tr("filial,")}{' '}{plan.currentVersion.registerLimit} {tr("kassa,")}{' '}{plan.currentVersion.staffLimit} {tr("xodim.")}{' '}{plan.isActive?tr("Faol"):tr("Nofaol")}.</li>)}</ul><Link href="/billing" className="underline">{tr("Tarif va obuna boshqaruvi")}</Link></section>
  <section aria-label={tr("Platforma hodisalari")}><h2 className="font-semibold">{tr("Eng so‘nggi 20 ochiq hodisa")}</h2>{data.incidents.length===0?<p>{tr("Ochiq hodisa yo‘q.")}</p>:<ul>{data.incidents.map(row=><li key={row.id}>{tr("Tashkilot")}{' '}{row.organizationId}; {row.kind}; {row.severity}{tr("; oxirgi kuzatuv")}{' '}{row.lastSeenAt}.</li>)}</ul>}<p>{tr("Mijoz rekvizitlari va hodisaning ichki dalillari ushbu umumiy panelga chiqarilmaydi.")}</p></section></>}
 </div>
}
