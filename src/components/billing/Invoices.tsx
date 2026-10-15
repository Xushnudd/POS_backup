'use client'




import {useTranslation} from '@/context/LocaleContext';

import {useReadPage} from '@/hooks/useReadPage';
import ReadQueryNotice from '@/components/ui/ReadQueryNotice';
import {useEffect,useRef,useState} from 'react'
import {api} from '@/lib/api'
import DurableMutation from '@/components/forms/DurableMutation'
import PendingActions from '@/components/forms/PendingActions'
import {useAuth} from '@/context/AuthContext'
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges'
type Invoice={id:string;amount:string;currency:string;periodStart:string;periodEnd:string;state:string;planVersion:{name:string;version:number};payment:{id:string;channel:string;createdAt:string}|null}
type Plan={code:string;name:string;versionId:string;price:string;currency:string}
type Draft={cancelReason:string;paymentReason:string;proofReference:string}
const empty:Draft={cancelReason:'',paymentReason:'',proofReference:''}
export default function Invoices({plans,canManage,ready=true,revision=0}:{plans:Plan[];canManage:boolean;ready?:boolean;revision?:number}){const {role}=useAuth();return role==='owner'?<InvoiceList plans={plans} canManage={canManage} ready={ready} revision={revision}/>:null}
function InvoiceList({plans,canManage,ready,revision}:{plans:Plan[];canManage:boolean;ready:boolean;revision:number}){
 const {t:tr}=useTranslation();

 const {page,setPage,invalid,reset}=useReadPage('billing_invoices_');
 const [rows,setRows]=useState<Invoice[]>([]),[total,setTotal]=useState(0),[error,setError]=useState(''),[loading,setLoading]=useState(true),[posting,setPosting]=useState(false),[planCode,setPlanCode]=useState(plans[0]?.code??''),[localRevision,setLocalRevision]=useState(0),[drafts,setDrafts]=useState<Record<string,Draft>>({}),[message,setMessage]=useState('')
 const generation=useRef(0),confirmDiscard=useUnsavedChanges(Object.values(drafts).some(d=>Object.values(d).some(Boolean)),posting)
 const refresh=()=>{setLoading(true);setLocalRevision(value=>value+1)}
 useEffect(()=>{let live=true;const current=++generation.current;if(invalid)return;void Promise.resolve().then(()=>{if(live)setLoading(true);return api.request<{rows:Invoice[];total:number}>('/billing/invoices?page='+page)}).then(result=>{if(!result.data)throw new Error('Invoice ma’lumoti mavjud emas');if(live&&current===generation.current){setRows(result.data.rows);setTotal(result.data.total);setError('')}}).catch(e=>{if(live&&current===generation.current)setError(e instanceof Error?e.message:'Invoice yuklanmadi')}).finally(()=>{if(live&&current===generation.current)setLoading(false)});return()=>{live=false}},[page,revision,localRevision,invalid])
 const edit=(id:string,field:keyof Draft,value:string)=>{setMessage('');setDrafts(current=>({...current,[id]:{...(current[id]??empty),[field]:value}}))}
 const completed=(_result?:unknown,original?:Record<string,unknown>,path='/billing/invoices')=>{const cancelled=path.match(/^\/billing\/invoices\/([^/]+)\/cancel$/),invoiceId=cancelled?.[1]??(typeof original?.billingInvoiceId==='string'?original.billingInvoiceId:'');if(invoiceId){setDrafts(current=>{const draft=current[invoiceId]??empty;if(cancelled&&original?.reason===draft.cancelReason)return {...current,[invoiceId]:{...draft,cancelReason:''}};if(path==='/billing/payments'&&original?.reason===draft.paymentReason&&original?.proofReference===draft.proofReference)return {...current,[invoiceId]:{...draft,paymentReason:'',proofReference:''}};return current})}setMessage('Invoice amali serverda tasdiqlandi.');refresh()}
 const available=ready&&!loading&&!error&&!posting&&!invalid
 return <section aria-label={tr("Obuna invoicelari")} className="space-y-4"><h2>{tr("Obuna invoice va to‘lov tarixi")}</h2><ReadQueryNotice invalid={invalid} reset={reset}/>
 <button className="underline" disabled={loading||posting} onClick={refresh}>{tr("Invoicelarni yangilash")}</button><PendingActions prefix="/billing/invoices" returnPath="/billing" revision={localRevision+revision} onDone={completed}/><PendingActions exact prefix="/billing/payments" returnPath="/billing" revision={localRevision+revision} onDone={completed}/>
 {error&&<p role="alert">{error}{tr(". Oxirgi ro‘yxat va draftlar saqlangan.")}<button className="ml-3 underline" onClick={refresh}>{tr("Qayta urinish")}</button></p>}{message&&<p role="status">{message}</p>}
 {Object.values(drafts).some(d=>Object.values(d).some(Boolean))&&<button className="underline" disabled={posting} onClick={()=>{if(confirmDiscard())setDrafts({})}}>{tr("Invoice draftlarini tozalash")}</button>}
 <DurableMutation path="/billing/invoices" returnPath="/billing" canSubmit={available} onSavingChange={setPosting} body={{planCode,planVersionId:plans.find(p=>p.code===planCode)?.versionId??''}} label={tr("Oylik invoice yaratish")} review={[`Tanlangan tarif: ${plans.find(p=>p.code===planCode)?.name??planCode}, ${plans.find(p=>p.code===planCode)?.price??''} UZS/oy`,'Invoice yaratish pul yechmaydi. Narx va muddat server tomonidan original tarifdan olinadi.']} onDone={completed}>
 <label>{tr("Tarif")}<select aria-label={tr("Tarif")} className="ml-2 border" value={planCode} onChange={e=>setPlanCode(e.target.value)}>{plans.map(plan=><option value={plan.code} key={plan.code}>{plan.name}</option>)}</select></label></DurableMutation>
 {loading&&!invalid&&<p role="status">{tr("Invoice yuklanmoqda…")}</p>}{!loading&&!error&&!invalid&&rows.length===0&&<p>{tr("Invoice hali yaratilmagan.")}</p>}
 {rows.map(invoice=>{const draft=drafts[invoice.id]??empty;return <article key={invoice.id} className="rounded border p-4 space-y-2"><h3>{invoice.planVersion.name} — {invoice.amount} {invoice.currency}</h3><p>{tr("Invoice:")}{' '}{invoice.id}</p><p>{invoice.periodStart} — {invoice.periodEnd}</p><p>{tr("Holat:")}{' '}{invoice.state}</p>{invoice.payment&&<p>{tr("Qo‘lda tasdiqlangan bank to‘lovi:")}{' '}{invoice.payment.createdAt}{tr(". Real provider tasdig‘i emas.")}</p>}
 <DurableMutation path={'/billing/invoices/'+invoice.id+'/cancel'} returnPath="/billing" allowNew={invoice.state==='open'} canSubmit={available} onSavingChange={setPosting} body={{reason:draft.cancelReason}} label={tr("To‘lanmagan invoiceni bekor qilish")} review={[invoice.id,draft.cancelReason,'To‘langan muddat qisqarmaydi.']} onDone={(result,original)=>completed(result,original,'/billing/invoices/'+invoice.id+'/cancel')}>{invoice.state==='open'&&<label>{tr("Bekor qilish sababi")}<input className="ml-2 border" value={draft.cancelReason} onChange={e=>edit(invoice.id,'cancelReason',e.target.value)}/></label>}</DurableMutation>
 {canManage&&<DurableMutation path="/billing/payments" returnPath="/billing" allowNew={invoice.state==='open'} canSubmit={available} onSavingChange={setPosting} body={{billingInvoiceId:invoice.id,proofReference:draft.proofReference,reason:draft.paymentReason}} label={tr("Bank to‘lovini qo‘lda tasdiqlash")} review={[invoice.id,`${invoice.amount} ${invoice.currency}`,'Bankdagi original tushumni mustaqil tekshirdim. Bu Click API tasdig‘i emas.',draft.paymentReason]} onDone={(result,original)=>completed(result,original,'/billing/payments')}>{invoice.state==='open'&&<><label>{tr("Original bank dalili identifikatori")}<input className="ml-2 border" value={draft.proofReference} onChange={e=>edit(invoice.id,'proofReference',e.target.value)}/></label><label>{tr("Tasdiqlash sababi")}<input className="ml-2 border" value={draft.paymentReason} onChange={e=>edit(invoice.id,'paymentReason',e.target.value)}/></label></>}</DurableMutation>}
 </article>})}
 <div>{tr("Sahifa")}{' '}{page} {tr("· jami")}{' '}{total}<button className="ml-3 underline" disabled={loading||posting||invalid||!!error||page<=1} onClick={()=>{setLoading(true);setPage(page-1)}}>{tr("Oldingi")}</button><button className="ml-3 underline" disabled={loading||posting||invalid||!!error||page*20>=total} onClick={()=>{setLoading(true);setPage(page+1)}}>{tr("Keyingi")}</button></div></section>
}
