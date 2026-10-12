'use client'
import {useEffect,useRef,useState} from 'react'
import { api } from '@/lib/api'
import DurableMutation from '@/components/forms/DurableMutation'
import PendingActions from '@/components/forms/PendingActions'
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges'
type Policy={id:string;version:number;expiredSubscriptionDays:number;closureCancellationDays:number;auditRetentionDays:number|null;technicalLogRetentionDays:number|null;backupRetentionDays:number|null;proposedFinancialRetentionYears:number}
type Status={policy:Policy;canManage:boolean;plannedReviewAt:string|null;reviewDue:boolean;subscriptionState:string;automaticDeletionEnabled:false;legalPolicyStatus:'review_required';closureAvailable:boolean}
const labels={expiredSubscriptionDays:'Obuna tugagandan keyingi saqlash reja kunlari',closureCancellationDays:'Yopish so‘rovini bekor qilish kunlari',auditRetentionDays:'Audit uchun reja kunlari',technicalLogRetentionDays:'Texnik loglar uchun reja kunlari',backupRetentionDays:'Backup uchun reja kunlari',proposedFinancialRetentionYears:'Moliyaviy hujjatlar uchun taklif yillari'}
export default function Retention(){
 const [data,setData]=useState<Status|null>(null),[draft,setDraft]=useState<Policy|null>(null),[reason,setReason]=useState(''),[error,setError]=useState('')
 const [loading,setLoading]=useState(true),[posting,setPosting]=useState(false),[revision,setRevision]=useState(0),[baseline,setBaseline]=useState('')
 const initialized=useRef(false)
 const body=draft?{expectedVersionId:draft.id,...Object.fromEntries(Object.keys(labels).map(key=>[key,draft[key as keyof typeof labels]])),reason}:{}
 const confirmDiscard=useUnsavedChanges(!!draft&&JSON.stringify(body)!==baseline,posting)
 const refresh=()=>{setLoading(true);setRevision(value=>value+1)}
 const loadPolicyDraft=(next:Policy)=>{setDraft(next);setReason('');setBaseline(JSON.stringify({expectedVersionId:next.id,...Object.fromEntries(Object.keys(labels).map(key=>[key,next[key as keyof typeof labels]])),reason:''}))}
 const completed=(result?:unknown,original?:Record<string,unknown>)=>{if(JSON.stringify(original)===JSON.stringify(body)&&result&&typeof result==='object'&&'id' in result&&'version' in result)loadPolicyDraft(result as Policy);refresh()}
 useEffect(()=>{let live=true;void api.request<Status>('/billing/retention').then(result=>{if(!result.data)throw new Error('Saqlash siyosati mavjud emas');if(live){setData(result.data);setError('');if(!initialized.current){initialized.current=true;setDraft(result.data.policy);setBaseline(JSON.stringify({expectedVersionId:result.data.policy.id,...Object.fromEntries(Object.keys(labels).map(key=>[key,result.data!.policy[key as keyof typeof labels]])),reason:''}));}}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Saqlash siyosati yuklanmadi')}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[revision])
 return <section aria-label="Ma’lumotlarni saqlash siyosati" className="space-y-3 rounded border p-4"><h2 className="font-semibold">Ma’lumotlarni saqlash siyosati</h2>
 <button className="underline" disabled={loading||posting} onClick={refresh}>Saqlash siyosatini yangilash</button><PendingActions exact prefix="/billing/retention" returnPath="/billing" revision={revision} onDone={completed}/>{error&&<div role="alert">{error}<button className="ml-2 underline" onClick={refresh}>Qayta yuklash</button></div>}
 {loading&&<p role="status">Saqlash siyosati yuklanmoqda…</p>}
 {data&&<><p>Siyosat versiyasi: {data.policy.version}</p><p>Obuna tugagan sanadan {data.policy.expiredSubscriptionDays} kunlik saqlash rejasi. Bu muddat tugashi avtomatik o‘chirishga ruxsat bermaydi.</p><p>Yopish so‘rovi uchun rejalangan bekor qilish oynasi: {data.policy.closureCancellationDays} kun.</p>
 {data.plannedReviewAt&&<p>Saqlashni ko‘rib chiqish sanasi: {data.plannedReviewAt}{data.reviewDue?' — ko‘rib chiqish vaqti yetgan':''}</p>}
 <p>Moliyaviy hujjatlar bo‘yicha taklif: {data.policy.proposedFinancialRetentionYears} yil. Huquqiy toifalar va muddatlar yakuniy tasdiqlanmagan.</p>
 <p>Audit: {data.policy.auditRetentionDays??'tasdiqlanmagan'}; texnik log: {data.policy.technicalLogRetentionDays??'tasdiqlanmagan'}; backup: {data.policy.backupRetentionDays??'tasdiqlanmagan'} kun.</p>
 <p>Avtomatik o‘chirish yoqilmagan. {data.closureAvailable?'Tashkilot egasi pastdagi yopish panelidan foydalanishi mumkin.':'Yopish so‘rovini faqat tashkilot egasi yuborishi mumkin.'}</p>
 {data.canManage&&draft&&<><p>Draft asosidagi siyosat: {draft.version}.</p>{draft.id!==data.policy.id&&<button disabled={loading||posting} className="underline" onClick={()=>{if(confirmDiscard())loadPolicyDraft(data.policy)}}>Joriy saqlash siyosatini draftga olish</button>}<DurableMutation allowNew={data.canManage} canSubmit={!loading&&!error&&!posting} onSavingChange={setPosting} path="/billing/retention" returnPath="/billing" label="Saqlash siyosatini saqlash" body={body}
 review={[`Obuna: ${draft.expiredSubscriptionDays} kun; bekor qilish: ${draft.closureCancellationDays} kun`,`Moliyaviy taklif: ${draft.proposedFinancialRetentionYears} yil; huquqiy tasdiq talab qilinadi`,'Bu amal ma’lumotlarni o‘chirmaydi.',reason]} onDone={completed}>
 {Object.entries(labels).map(([key,label])=>{const field=key as keyof typeof labels,nullable=['auditRetentionDays','technicalLogRetentionDays','backupRetentionDays'].includes(key);return <label key={key} className="block">{label}<input className="ml-2 border" type="number" min={field==='proposedFinancialRetentionYears'?5:1} max={field==='closureCancellationDays'?365:field==='proposedFinancialRetentionYears'?100:3650} value={draft[field]??''} onChange={e=>setDraft({...draft,[field]:nullable&&e.target.value===''?null:Number(e.target.value)})}/></label>})}
 <label className="block">Saqlash siyosati o‘zgartirish sababi<input className="ml-2 border" value={reason} maxLength={2000} onChange={e=>setReason(e.target.value)}/></label>
 </DurableMutation></>}
 </>}
 </section>
}
