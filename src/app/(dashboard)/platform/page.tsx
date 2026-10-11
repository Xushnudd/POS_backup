'use client'
import {useRef,useState} from 'react'
import Link from 'next/link'
import {api} from '@/lib/api'
import {useAuth} from '@/context/AuthContext'
type Overview={organizations:{id:string;name:string;state:string;closurePending:boolean;businessWritesAllowed:boolean;plan:{code:string;name:string;version:number}|null;openIncidents:number}[];total:number;page:number;pageSize:number;plans:{code:string;isActive:boolean;currentVersion:{name:string;version:number;monthlyPrice:string;currency:string;branchLimit:number;registerLimit:number;staffLimit:number}}[];incidents:{id:string;organizationId:string;kind:string;severity:string;lastSeenAt:string}[];now:string;health:{database:string};integrations:{authenticationDelivery:{sms:boolean;email:boolean;totp:boolean}}}
const states:Record<string,string>={trial:'Sinov davri',active:'Faol',grace:'Imtiyozli muddat',expired:'Faqat o‘qish',legacy_unmanaged:'Tarifga ko‘chirish kutilmoqda'}
export default function PlatformPage(){
 const {user,organization,role}=useAuth()
 return user&&organization?<OverviewPanel key={`${user.id}:${organization.id}:${role}`}/>:null
}
function OverviewPanel(){
 const [search,setSearch]=useState(''),[data,setData]=useState<Overview|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const flight=useRef(false)
 const load=async(page=1)=>{
  if(flight.current)return
  flight.current=true;setBusy(true);setError('');setData(null)
  try{const result=await api.request<Overview>('/platform/overview',{method:'POST',body:JSON.stringify({operationId:crypto.randomUUID(),page,search})});setData(result.data??null)}
  catch(failure){setError(failure instanceof Error?failure.message:'Platforma paneli yuklanmadi')}
  finally{flight.current=false;setBusy(false)}
 }
 return <div className="space-y-5"><h1 className="text-2xl font-bold">Platforma boshqaruvi</h1>
  <p>Faqat tayinlangan platforma administratorlari. Har bir so‘rov ikkinchi faktor bilan tasdiqlanadi va audit qilinadi.</p>
  <form onSubmit={event=>{event.preventDefault();void load()}} className="flex flex-wrap gap-3 items-end">
   <label>Tashkilot nomi<input value={search} maxLength={100} disabled={busy} onChange={event=>setSearch(event.target.value)} className="block border rounded p-2"/></label>
   <button disabled={busy} className="bg-blue-700 text-white rounded p-2">{busy?'Yuklanmoqda…':'Platforma ma’lumotlarini ko‘rish'}</button>
  </form>
  {error&&<p role="alert">{error}</p>}
  {busy&&<p role="status">Vakolat va ma’lumotlar tekshirilmoqda…</p>}
  {data&&<><section aria-label="Platforma xizmat holati" className="border rounded p-4 space-y-2"><h2 className="font-semibold">Xizmat holati</h2>
   <p>Baza: ushbu so‘rovda ulanish muvaffaqiyatli. Bu butun hosting holatining kafolati emas.</p><p>Tekshirilgan vaqt: {data.now}</p>
   <p>Click tanlangan; real to‘lov, fiskal va hardware adapterlari hozir ulanmagan.</p>
   <p>SMS: {data.integrations.authenticationDelivery.sms?'Sozlangan':'Sozlanmagan'}; e-mail: {data.integrations.authenticationDelivery.email?'Sozlangan':'Sozlanmagan'}; authenticator: {data.integrations.authenticationDelivery.totp?'Mavjud':'Mavjud emas'}.</p>
  </section><section aria-label="Platforma tashkilotlari"><h2 className="font-semibold">Tashkilotlar — jami {data.total}</h2>
   {data.organizations.length===0?<p>Qidiruvga mos tashkilot topilmadi.</p>:<div className="overflow-x-auto"><table className="w-full text-left"><thead><tr>{['Tashkilot','Tarif','Holat','Ochiq hodisalar'].map(label=><th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{data.organizations.map(row=><tr key={row.id}><td className="p-2">{row.name}</td><td className="p-2">{row.plan?.name??'Belgilanmagan'}</td><td className="p-2">{states[row.state]??'Holatni tekshiring'}{row.closurePending?' — yopish so‘rovi mavjud':''}; {row.businessWritesAllowed?'Faol amallar ochiq':'Faol amallar yopiq'}</td><td className="p-2">{row.openIncidents}</td></tr>)}</tbody></table></div>}
   <div className="flex gap-3 py-3"><button disabled={busy||data.page===1} onClick={()=>void load(data.page-1)}>Oldingi sahifa</button><span>Sahifa {data.page}</span><button disabled={busy||data.page*data.pageSize>=data.total} onClick={()=>void load(data.page+1)}>Keyingi sahifa</button></div>
  </section><section aria-label="Platforma tariflari"><h2 className="font-semibold">Tariflar</h2><ul>{data.plans.map(plan=><li key={plan.code}>{plan.currentVersion.name}: {plan.currentVersion.monthlyPrice} {plan.currentVersion.currency}/oy; {plan.currentVersion.branchLimit} filial, {plan.currentVersion.registerLimit} kassa, {plan.currentVersion.staffLimit} xodim. {plan.isActive?'Faol':'Nofaol'}.</li>)}</ul><Link href="/billing" className="underline">Tarif va obuna boshqaruvi</Link></section>
  <section aria-label="Platforma hodisalari"><h2 className="font-semibold">Eng so‘nggi 20 ochiq hodisa</h2>{data.incidents.length===0?<p>Ochiq hodisa yo‘q.</p>:<ul>{data.incidents.map(row=><li key={row.id}>Tashkilot {row.organizationId}; {row.kind}; {row.severity}; oxirgi kuzatuv {row.lastSeenAt}.</li>)}</ul>}<p>Mijoz rekvizitlari va hodisaning ichki dalillari ushbu umumiy panelga chiqarilmaydi.</p></section></>}
 </div>
}
