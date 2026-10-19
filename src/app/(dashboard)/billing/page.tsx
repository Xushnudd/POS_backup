'use client'
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {localizeOwnedLabels} from '@/i18n/messages';

import {useTranslation} from '@/context/LocaleContext';

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import PendingActions from '@/components/forms/PendingActions'
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges'
import DurableMutation from '@/components/forms/DurableMutation'
import Invoices from '@/components/billing/Invoices'
import Costs from '@/components/billing/Costs'
import Retention from '@/components/billing/Retention'
import Closure from '@/components/billing/Closure'
type Version = { id:string; code: string; name: string; version: number; monthlyPrice: string; currency: string; branchLimit: number; registerLimit: number; staffLimit: number; trialDays: number; graceDays: number }
type Status = { state: string; newSalesAllowed: boolean; businessWritesAllowed:boolean; canManagePlans: boolean; plans: { code: string; currentVersion: Version }[];
  usage: { branches: number; registers: number; staff: number }; subscription: { trialEndsAt: string; paidThrough: string | null; cancelAtPeriodEnd:boolean; planVersion: Version } | null; graceEndsAt?: string }
const names: Record<string,string> = { trial: 'Sinov davri', active: 'Faol obuna', grace: 'Imtiyozli muddat', expired: 'Obuna muddati tugagan', legacy_unmanaged: 'Administrator tarifga ko‘chirishi kutilmoqda' }
const namesSource=names;
export default function BillingPage() {
  const { organization,user,role } = useAuth()
  return organization ? <Billing key={`${organization.id}:${user?.id}:${role}`} organizationId={organization.id}/> : null
}
function Billing({organizationId}:{organizationId:string}) {
 const {message:uiMessage}=useTranslation();

 const {locale:mapLocale}=useTranslation();

 const names=localizeOwnedLabels(namesSource,mapLocale);

 const {t:tr,formatMoney}=useTranslation();

  const {role}=useAuth()
  const [data,setData] = useState<Status | null>(null), [error,setError] = useState(''), [version,setVersion] = useState<Version | null>(null), [reason,setReason] = useState('')
  const [targetOrganizationId,setTargetOrganizationId]=useState(organizationId),[planCode,setPlanCode]=useState(''),[assignmentReason,setAssignmentReason]=useState(''),[cancellationReason,setCancellationReason]=useState('')
  const [loading,setLoading]=useState(true),[posting,setPosting]=useState(false),[revision,setRevision]=useState(0),[message,setMessage]=useState('')
  const [baseline,setBaseline]=useState(''),[rawNumbers,setRawNumbers]=useState<Record<string,string>>({})
  const confirmDiscard=useUnsavedChanges(!!reason||!!assignmentReason||!!cancellationReason||!!version&&(JSON.stringify(version)!==baseline||Object.entries(rawNumbers).some(([field,value])=>value!==String(version[field as keyof Version]))),posting)
  const load=()=>{setLoading(true);setRevision(value=>value+1)}
  useEffect(()=>{let live=true;void api.request<Status>('/billing').then(result=>{if(!result.data)throw new Error("Obuna holati mavjud emas");if(live){setData(result.data);setError('')}}).catch(e=>{if(live)setError(displayErrorMessage(e,'Obuna yuklanmadi'))}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[revision])
  const ready=!loading&&!error&&!posting
  const completed=(_result?:unknown,original?:Record<string,unknown>,path='')=>{
    if(path==='/billing/assign'&&original?.targetOrganizationId===targetOrganizationId&&original?.planCode===planCode&&original?.reason===assignmentReason)setAssignmentReason('')
    if(path==='/billing/cancel'&&original?.reason===cancellationReason)setCancellationReason('')
    if(path==='/billing/plans'&&version&&original?.code===version.code&&original?.name===version.name&&original?.monthlyPrice===version.monthlyPrice&&original?.reason===reason&&['branchLimit','registerLimit','staffLimit','trialDays','graceDays'].every(field=>original[field]===Number(rawNumbers[field]))){setVersion(null);setReason('');setBaseline('')}
    setMessage("Original obuna amali serverda tasdiqlandi.");load()
  }
  const numericFields = ['branchLimit','registerLimit','staffLimit','trialDays','graceDays'] as const
  const labels = localizeOwnedLabels({ branchLimit: 'Filial limiti', registerLimit: 'Kassa limiti', staffLimit: 'Xodim limiti', trialDays: 'Trial kunlari', graceDays: 'Grace kunlari' },mapLocale)
  return <div className="space-y-6 p-6"><h1 className="text-2xl font-bold">{tr("Tarif va obuna")}</h1>
    {message&&<p role="status">{uiMessage(message)}</p>}{loading&&<p role="status">{tr("Obuna holati yuklanmoqda…")}</p>}
    {['/billing/plans','/billing/assign','/billing/cancel'].map(path=><PendingActions key={path} prefix={path} exact returnPath="/billing" revision={revision} onDone={(result,original)=>completed(result,original,path)}/>)}
    <button className="underline" disabled={loading||posting} onClick={load}>{tr("Obuna holatini yangilash")}</button>
    {error && <div role="alert">{uiMessage(error)}<button disabled={loading||posting} onClick={load} className="ml-3 underline">{tr("Qayta urinish")}</button></div>}
    {!data && !error && <p role="status">{tr("Yuklanmoqda…")}</p>}
    {data && <><section aria-label={tr("Obuna holati")}><h2>{names[data.state] ?? data.state}</h2>
      {!data.businessWritesAllowed && <p role="alert">{tr("Tashkilot faqat o‘qish rejimida. Savdo, kirim, qaytarish, to‘lov va biznes sozlamalarini o‘zgartirish yopilgan. Mavjud ma’lumotlar va eksport saqlanadi; ma’lumotlar o‘chirilmaydi.")}</p>}
      {data.state === 'grace' && <p role="status">{tr("Imtiyozli muddatda amaldagi imkoniyatlar ishlaydi. Muddat tugashidan oldin obunani yangilang.")}</p>}
      {data.subscription && <><p>{tr("Amaldagi tarif:")}{' '}{data.subscription.planVersion.name}</p><p>{tr("Trial yakuni:")}{' '}{data.subscription.trialEndsAt}</p><p>{tr("To‘langan muddat:")}{' '}{data.subscription.paidThrough ?? tr("To‘lov qayd etilmagan")}</p><p>{tr("Grace yakuni:")}{' '}{data.graceEndsAt}</p></>}
      <p>{tr("Jami:")}{' '}{data.usage.branches} {tr("filial,")}{' '}{data.usage.registers} {tr("kassa,")}{' '}{data.usage.staff} {tr("xodim.")}</p>
      <p>{tr("Limitda arxivlangan obyektlar ham hisoblanadi. Limit pasaysa mavjud ma’lumot o‘chmaydi.")}</p>
    </section><section aria-label={tr("Tariflar")} className="grid gap-4 md:grid-cols-3">{data.plans.map(plan => <article key={plan.code} className="rounded border p-4"><h2>{plan.currentVersion.name}</h2><p>{plan.currentVersion.currency==='UZS'?formatMoney(plan.currentVersion.monthlyPrice):plan.currentVersion.monthlyPrice+' '+plan.currentVersion.currency}{tr('/oy')}</p><p>{plan.currentVersion.branchLimit} {tr("filial /")}{' '}{plan.currentVersion.registerLimit} {tr("kassa /")}{' '}{plan.currentVersion.staffLimit} {tr("xodim")}</p>
      {data.canManagePlans && <button className="underline" disabled={!ready} onClick={() => { if(confirmDiscard()){setVersion(plan.currentVersion);setBaseline(JSON.stringify(plan.currentVersion));setRawNumbers(Object.fromEntries(numericFields.map(field=>[field,String(plan.currentVersion[field])])));setReason('')} }}>{tr("Tarifni tahrirlash")}</button>}</article>)}</section>
      <Invoices plans={data.plans.map(plan=>({code:plan.code,name:plan.currentVersion.name,versionId:plan.currentVersion.id,price:plan.currentVersion.monthlyPrice,currency:plan.currentVersion.currency}))} canManage={data.canManagePlans} ready={ready} revision={revision}/>
      {role==='owner'&&data.subscription&&<DurableMutation path="/billing/cancel" returnPath="/billing" body={{cancelAtPeriodEnd:!data.subscription.cancelAtPeriodEnd,reason:cancellationReason}}
        label={data.subscription.cancelAtPeriodEnd?tr("Yangilash niyatini tiklash"):tr("Muddat oxirida obunani bekor qilish")} review={[tr("To‘langan muddat saqlanadi. Avtomatik charge mavjud emas."),cancellationReason]} canSubmit={ready} onSavingChange={setPosting} onDone={(result,original)=>completed(result,original,'/billing/cancel')}>
        <label>{tr("Sabab")}<input className="ml-2 border" value={cancellationReason} onChange={e=>setCancellationReason(e.target.value)}/></label>
      </DurableMutation>}
      <p>{tr("Real Click to‘lovi hali ulanmagan. To‘lov tasdiqlanishi haqida administratorga murojaat qiling.")}</p>
    </>}
    {data?.canManagePlans&&<section aria-label={tr("Tashkilotni tarifga ko‘chirish")}><h2>{tr("Tashkilot tarifini alohida tasdiqlash")}</h2>
      <DurableMutation path="/billing/assign" returnPath="/billing" body={{targetOrganizationId,planCode,reason:assignmentReason}} label={tr("Tarifga ko‘chirish")} review={[targetOrganizationId,planCode,tr("Mavjud ma’lumotlar saqlanadi. Oldingi trial qayta boshlanmaydi. Legacy tashkilotda faqat grace beriladi, to‘lov yaratilmaydi."),assignmentReason]} canSubmit={ready} onSavingChange={setPosting} onDone={(result,original)=>completed(result,original,'/billing/assign')}>
        <label className="block">{tr("Tashkilot ID")}<input className="ml-2 border" value={targetOrganizationId} onChange={e=>setTargetOrganizationId(e.target.value)}/></label>
        <label className="block">{tr("Tarif")}<select className="ml-2 border" value={planCode} onChange={e=>setPlanCode(e.target.value)}><option value="">{tr("Tarifni tanlang")}</option>{data.plans.map(plan=><option key={plan.code} value={plan.code}>{plan.currentVersion.name}</option>)}</select></label>
        <label className="block">{tr("Sabab")}<input className="ml-2 border" value={assignmentReason} onChange={e=>setAssignmentReason(e.target.value)}/></label>
      </DurableMutation>
    </section>}
    {data?.canManagePlans && version && <section aria-label={tr("Tarifni boshqarish")}><h2>{tr("Yangi tarif versiyasi:")}{' '}{version.code}</h2>
      <DurableMutation path="/billing/plans" returnPath="/billing" body={{ code: version.code, name: version.name, monthlyPrice: version.monthlyPrice, currency: 'UZS', ...Object.fromEntries(numericFields.map(field => [field,Number(rawNumbers[field])])), reason }}
        label={tr("Tarif versiyasini saqlash")} review={[tr("{value1}: {value2} UZS/oy",{value1:String(version.name),value2:String(version.monthlyPrice)}), tr("{value1} filial / {value2} kassa / {value3} xodim; trial {value4}, grace {value5} kun",{value1:String(rawNumbers.branchLimit),value2:String(rawNumbers.registerLimit),value3:String(rawNumbers.staffLimit),value4:String(rawNumbers.trialDays),value5:String(rawNumbers.graceDays)}), tr("Mavjud tashkilotlarning amaldagi tarif versiyasi avtomatik almashtirilmaydi."), reason]} canSubmit={ready} onSavingChange={setPosting} onDone={(result,original)=>completed(result,original,'/billing/plans')}>
        <label className="block">{tr("Tarif nomi")}<input className="ml-2 border" value={version.name} onChange={e => setVersion({ ...version, name: e.target.value })} /></label>
        <label className="block">{tr("Oylik narx (UZS)")}<input className="ml-2 border" inputMode="decimal" value={version.monthlyPrice} onChange={e => setVersion({ ...version, monthlyPrice: e.target.value })} /></label>
        {numericFields.map(field => <label key={field} className="block">{labels[field]}<input className="ml-2 border" type="number" min={field === 'graceDays' ? 0 : 1} value={rawNumbers[field]??String(version[field])} onChange={e => setRawNumbers(current=>({...current,[field]:e.target.value}))} /></label>)}
        <label className="block">{tr("O‘zgartirish sababi")}<input className="ml-2 border" value={reason} onChange={e => setReason(e.target.value)} /></label>
      </DurableMutation>
    </section>}
    {data?.canManagePlans&&<Costs organizationId={organizationId}/>}
    {data&&(role==='owner'||data.canManagePlans)&&<Retention/>}
    {data&&role==='owner'&&organizationId&&<Closure key={organizationId} organizationId={organizationId}/>}
  </div>
}
