'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import DurableMutation from '@/components/forms/DurableMutation'
import { useAuth } from '@/context/AuthContext'
type Invoice = { id:string; amount:string; currency:string; periodStart:string; periodEnd:string; state:string;
  planVersion:{name:string;version:number}; payment:{id:string;channel:string;createdAt:string}|null }
export default function Invoices({plans,canManage}:{plans:{code:string;name:string;versionId:string;price:string;currency:string}[];canManage:boolean}) {
  const {role} = useAuth()
  return role === 'owner' ? <InvoiceList plans={plans} canManage={canManage} /> : null
}
function InvoiceList({plans,canManage}:{plans:{code:string;name:string;versionId:string;price:string;currency:string}[];canManage:boolean}) {
  const [rows,setRows]=useState<Invoice[]>([]),[page,setPage]=useState(1),[total,setTotal]=useState(0),[error,setError]=useState(''),[loading,setLoading]=useState(true),[planCode,setPlanCode]=useState(plans[0]?.code ?? '')
  const generation=useRef({value:0})
  const load=useCallback(async()=>{const current=++generation.current.value;try{const result=await api.request<{rows:Invoice[];total:number}>('/billing/invoices?page='+page);if(current===generation.current.value){setRows(result.data?.rows ?? []);setTotal(result.data?.total ?? 0);setError('')}}catch(e){if(current===generation.current.value)setError(e instanceof Error?e.message:'Invoice yuklanmadi')}finally{if(current===generation.current.value)setLoading(false)}},[page])
  useEffect(()=>{const tracking=generation.current,current=++tracking.value;void api.request<{rows:Invoice[];total:number}>('/billing/invoices?page='+page).then(result=>{if(current===tracking.value){setRows(result.data?.rows ?? []);setTotal(result.data?.total ?? 0);setError('')}}).catch(e=>{if(current===tracking.value)setError(e instanceof Error?e.message:'Invoice yuklanmadi')}).finally(()=>{if(current===tracking.value)setLoading(false)});return()=>{tracking.value++}},[page])
  return <section aria-label="Obuna invoicelari" className="space-y-4"><h2>Obuna invoice va to‘lov tarixi</h2>
    {error&&<p role="alert">{error}<button className="ml-3 underline" onClick={load}>Qayta urinish</button></p>}
    <DurableMutation path="/billing/invoices" returnPath="/billing" body={{planCode,planVersionId:plans.find(p=>p.code===planCode)?.versionId ?? ''}} label="Oylik invoice yaratish" review={[`Tanlangan tarif: ${plans.find(p=>p.code===planCode)?.name ?? planCode}, ${plans.find(p=>p.code===planCode)?.price ?? ''} UZS/oy`,'Invoice yaratish pul yechmaydi. Narx va muddat server tomonidan original tarifdan olinadi.']} onDone={()=>void load()}>
      <label>Tarif<select aria-label="Tarif" className="ml-2 border" value={planCode} onChange={e=>setPlanCode(e.target.value)}>{plans.map(plan=><option value={plan.code} key={plan.code}>{plan.name}</option>)}</select></label>
    </DurableMutation>
    {loading&&<p role="status">Invoice yuklanmoqda…</p>}
    {!loading&&rows.length===0&&<p>Invoice hali yaratilmagan.</p>}
    {rows.map(row=><InvoiceRow key={row.id} invoice={row} canManage={canManage} reload={()=>void load()}/>)}
    <div>Sahifa {page} · jami {total}<button className="ml-3 underline" disabled={loading||page<=1} onClick={()=>{setLoading(true);setPage(page-1)}}>Oldingi</button><button className="ml-3 underline" disabled={loading||page*20>=total} onClick={()=>{setLoading(true);setPage(page+1)}}>Keyingi</button></div>
  </section>
}
function InvoiceRow({invoice,canManage,reload}:{invoice:Invoice;canManage:boolean;reload:()=>void}) {
  const [reason,setReason]=useState(''),[proofReference,setProofReference]=useState('')
  return <article className="rounded border p-4 space-y-2"><h3>{invoice.planVersion.name} — {invoice.amount} {invoice.currency}</h3>
    <p>Invoice: {invoice.id}</p><p>{invoice.periodStart} — {invoice.periodEnd}</p><p>Holat: {invoice.state}</p>
    {invoice.payment&&<p>Qo‘lda tasdiqlangan bank to‘lovi: {invoice.payment.createdAt}. Real provider tasdig‘i emas.</p>}
    {invoice.state==='open'&&<><DurableMutation path={`/billing/invoices/${invoice.id}/cancel`} returnPath="/billing" body={{reason}} label="To‘lanmagan invoiceni bekor qilish" review={[invoice.id,reason,'To‘langan muddat qisqarmaydi.']} onDone={reload}>
      <label>Bekor qilish sababi<input className="ml-2 border" value={reason} onChange={e=>setReason(e.target.value)}/></label>
    </DurableMutation>{canManage&&<DurableMutation path="/billing/payments" returnPath="/billing" body={{billingInvoiceId:invoice.id,proofReference,reason}} label="Bank to‘lovini qo‘lda tasdiqlash" review={[invoice.id,`${invoice.amount} ${invoice.currency}`,'Bankdagi original tushumni mustaqil tekshirdim. Bu Click API tasdig‘i emas.',reason]} onDone={reload}>
      <label>Original bank dalili identifikatori<input className="ml-2 border" value={proofReference} onChange={e=>setProofReference(e.target.value)}/></label>
      <label>Tasdiqlash sababi<input className="ml-2 border" value={reason} onChange={e=>setReason(e.target.value)}/></label>
    </DurableMutation>}</>}
  </article>
}
