'use client'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import DurableMutation from '@/components/forms/DurableMutation'
import Invoices from '@/components/billing/Invoices'
import Costs from '@/components/billing/Costs'
import Retention from '@/components/billing/Retention'
import Closure from '@/components/billing/Closure'
type Version = { id:string; code: string; name: string; version: number; monthlyPrice: string; currency: string; branchLimit: number; registerLimit: number; staffLimit: number; trialDays: number; graceDays: number }
type Status = { state: string; newSalesAllowed: boolean; businessWritesAllowed:boolean; canManagePlans: boolean; plans: { code: string; currentVersion: Version }[];
  usage: { branches: number; registers: number; staff: number }; subscription: { trialEndsAt: string; paidThrough: string | null; cancelAtPeriodEnd:boolean; planVersion: Version } | null; graceEndsAt?: string }
const names: Record<string,string> = { trial: 'Sinov davri', active: 'Faol obuna', grace: 'Imtiyozli muddat', expired: 'Obuna muddati tugagan', legacy_unmanaged: 'Administrator tarifga ko‘chirishi kutilmoqda' }
export default function BillingPage() {
  const { organization } = useAuth()
  return organization ? <Billing key={organization.id} organizationId={organization.id}/> : null
}
function Billing({organizationId}:{organizationId:string}) {
  const {role}=useAuth()
  const [data,setData] = useState<Status | null>(null), [error,setError] = useState(''), [version,setVersion] = useState<Version | null>(null), [reason,setReason] = useState('')
  const [targetOrganizationId,setTargetOrganizationId]=useState(organizationId),[planCode,setPlanCode]=useState(''),[assignmentReason,setAssignmentReason]=useState(''),[cancellationReason,setCancellationReason]=useState('')
  const load = useCallback(async () => { try { const result = await api.request<Status>('/billing'); setData(result.data ?? null); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'Obuna yuklanmadi') } }, [])
  useEffect(() => { let active = true; void api.request<Status>('/billing').then(result => { if (active) setData(result.data ?? null) }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Obuna yuklanmadi') }); return () => { active = false } }, [])
  const numericFields = ['branchLimit','registerLimit','staffLimit','trialDays','graceDays'] as const
  const labels = { branchLimit: 'Filial limiti', registerLimit: 'Kassa limiti', staffLimit: 'Xodim limiti', trialDays: 'Trial kunlari', graceDays: 'Grace kunlari' }
  return <div className="space-y-6 p-6"><h1 className="text-2xl font-bold">Tarif va obuna</h1>
    {error && <div role="alert">{error}<button onClick={load} className="ml-3 underline">Qayta urinish</button></div>}
    {!data && !error && <p role="status">Yuklanmoqda…</p>}
    {data && <><section aria-label="Obuna holati"><h2>{names[data.state] ?? data.state}</h2>
      {!data.businessWritesAllowed && <p role="alert">Tashkilot faqat o‘qish rejimida. Savdo, kirim, qaytarish, to‘lov va biznes sozlamalarini o‘zgartirish yopilgan. Mavjud ma’lumotlar va eksport saqlanadi; ma’lumotlar o‘chirilmaydi.</p>}
      {data.state === 'grace' && <p role="status">Imtiyozli muddatda amaldagi imkoniyatlar ishlaydi. Muddat tugashidan oldin obunani yangilang.</p>}
      {data.subscription && <><p>Amaldagi tarif: {data.subscription.planVersion.name}</p><p>Trial yakuni: {data.subscription.trialEndsAt}</p><p>To‘langan muddat: {data.subscription.paidThrough ?? 'To‘lov qayd etilmagan'}</p><p>Grace yakuni: {data.graceEndsAt}</p></>}
      <p>Jami: {data.usage.branches} filial, {data.usage.registers} kassa, {data.usage.staff} xodim.</p>
      <p>Limitda arxivlangan obyektlar ham hisoblanadi. Limit pasaysa mavjud ma’lumot o‘chmaydi.</p>
    </section><section aria-label="Tariflar" className="grid gap-4 md:grid-cols-3">{data.plans.map(plan => <article key={plan.code} className="rounded border p-4"><h2>{plan.currentVersion.name}</h2><p>{plan.currentVersion.monthlyPrice} {plan.currentVersion.currency}/oy</p><p>{plan.currentVersion.branchLimit} filial / {plan.currentVersion.registerLimit} kassa / {plan.currentVersion.staffLimit} xodim</p>
      {data.canManagePlans && <button className="underline" onClick={() => { setVersion(plan.currentVersion); setReason('') }}>Tarifni tahrirlash</button>}</article>)}</section>
      <Invoices plans={data.plans.map(plan=>({code:plan.code,name:plan.currentVersion.name,versionId:plan.currentVersion.id,price:plan.currentVersion.monthlyPrice,currency:plan.currentVersion.currency}))} canManage={data.canManagePlans}/>
      {role==='owner'&&data.subscription&&<DurableMutation path="/billing/cancel" returnPath="/billing" body={{cancelAtPeriodEnd:!data.subscription.cancelAtPeriodEnd,reason:cancellationReason}}
        label={data.subscription.cancelAtPeriodEnd?'Yangilash niyatini tiklash':'Muddat oxirida obunani bekor qilish'} review={['To‘langan muddat saqlanadi. Avtomatik charge mavjud emas.',cancellationReason]} onDone={()=>void load()}>
        <label>Sabab<input className="ml-2 border" value={cancellationReason} onChange={e=>setCancellationReason(e.target.value)}/></label>
      </DurableMutation>}
      <p>Real Click to‘lovi hali ulanmagan. To‘lov tasdiqlanishi haqida administratorga murojaat qiling.</p>
    </>}
    {data?.canManagePlans&&<section aria-label="Tashkilotni tarifga ko‘chirish"><h2>Tashkilot tarifini alohida tasdiqlash</h2>
      <DurableMutation path="/billing/assign" returnPath="/billing" body={{targetOrganizationId,planCode,reason:assignmentReason}} label="Tarifga ko‘chirish" review={[targetOrganizationId,planCode,'Mavjud ma’lumotlar saqlanadi. Oldingi trial qayta boshlanmaydi. Legacy tashkilotda faqat grace beriladi, to‘lov yaratilmaydi.',assignmentReason]} onDone={()=>void load()}>
        <label className="block">Tashkilot ID<input className="ml-2 border" value={targetOrganizationId} onChange={e=>setTargetOrganizationId(e.target.value)}/></label>
        <label className="block">Tarif<select className="ml-2 border" value={planCode} onChange={e=>setPlanCode(e.target.value)}><option value="">Tarifni tanlang</option>{data.plans.map(plan=><option key={plan.code} value={plan.code}>{plan.currentVersion.name}</option>)}</select></label>
        <label className="block">Sabab<input className="ml-2 border" value={assignmentReason} onChange={e=>setAssignmentReason(e.target.value)}/></label>
      </DurableMutation>
    </section>}
    {data?.canManagePlans && version && <section aria-label="Tarifni boshqarish"><h2>Yangi tarif versiyasi: {version.code}</h2>
      <DurableMutation path="/billing/plans" returnPath="/billing" body={{ code: version.code, name: version.name, monthlyPrice: version.monthlyPrice, currency: 'UZS', ...Object.fromEntries(numericFields.map(field => [field,version[field]])), reason }}
        label="Tarif versiyasini saqlash" review={[`${version.name}: ${version.monthlyPrice} UZS/oy`, `${version.branchLimit} filial / ${version.registerLimit} kassa / ${version.staffLimit} xodim`, 'Mavjud tashkilotlarning amaldagi tarif versiyasi avtomatik almashtirilmaydi.', reason]} onDone={() => { setVersion(null); void load() }}>
        <label className="block">Tarif nomi<input className="ml-2 border" value={version.name} onChange={e => setVersion({ ...version, name: e.target.value })} /></label>
        <label className="block">Oylik narx (UZS)<input className="ml-2 border" inputMode="decimal" value={version.monthlyPrice} onChange={e => setVersion({ ...version, monthlyPrice: e.target.value })} /></label>
        {numericFields.map(field => <label key={field} className="block">{labels[field]}<input className="ml-2 border" type="number" min={field === 'graceDays' ? 0 : 1} value={version[field]} onChange={e => setVersion({ ...version, [field]: Number(e.target.value) })} /></label>)}
        <label className="block">O‘zgartirish sababi<input className="ml-2 border" value={reason} onChange={e => setReason(e.target.value)} /></label>
      </DurableMutation>
    </section>}
    {data?.canManagePlans&&<Costs organizationId={organizationId}/>}
    {data&&(role==='owner'||data.canManagePlans)&&<Retention/>}
    {data&&role==='owner'&&organizationId&&<Closure key={organizationId} organizationId={organizationId}/>}
  </div>
}
