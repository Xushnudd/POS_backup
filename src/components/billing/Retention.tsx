'use client'
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {localizeOwnedLabels} from '@/i18n/messages';

import {useTranslation} from '@/context/LocaleContext';

import {useEffect,useRef,useState} from 'react'
import { api } from '@/lib/api'
import DurableMutation from '@/components/forms/DurableMutation'
import PendingActions from '@/components/forms/PendingActions'
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges'
type Policy={id:string;version:number;expiredSubscriptionDays:number;closureCancellationDays:number;auditRetentionDays:number|null;technicalLogRetentionDays:number|null;backupRetentionDays:number|null;proposedFinancialRetentionYears:number}
type Status={policy:Policy;canManage:boolean;plannedReviewAt:string|null;reviewDue:boolean;subscriptionState:string;automaticDeletionEnabled:false;legalPolicyStatus:'review_required';closureAvailable:boolean}
const labels={expiredSubscriptionDays:'Obuna tugagandan keyingi saqlash reja kunlari',closureCancellationDays:'Yopish so‘rovini bekor qilish kunlari',auditRetentionDays:'Audit uchun reja kunlari',technicalLogRetentionDays:'Texnik loglar uchun reja kunlari',backupRetentionDays:'Backup uchun reja kunlari',proposedFinancialRetentionYears:'Moliyaviy hujjatlar uchun taklif yillari'}
const labelsSource=labels;
export default function Retention(){
 const {message:uiMessage}=useTranslation();

 const {locale:mapLocale}=useTranslation();

 const labels=localizeOwnedLabels(labelsSource,mapLocale);

 const {t:tr}=useTranslation();

 const [data,setData]=useState<Status|null>(null),[draft,setDraft]=useState<Policy|null>(null),[reason,setReason]=useState(''),[error,setError]=useState('')
 const [loading,setLoading]=useState(true),[posting,setPosting]=useState(false),[revision,setRevision]=useState(0),[baseline,setBaseline]=useState('')
 const initialized=useRef(false)
 const body=draft?{expectedVersionId:draft.id,...Object.fromEntries(Object.keys(labelsSource).map(key=>[key,draft[key as keyof typeof labels]])),reason}:{}
 const confirmDiscard=useUnsavedChanges(!!draft&&JSON.stringify(body)!==baseline,posting)
 const refresh=()=>{setLoading(true);setRevision(value=>value+1)}
 const loadPolicyDraft=(next:Policy)=>{setDraft(next);setReason('');setBaseline(JSON.stringify({expectedVersionId:next.id,...Object.fromEntries(Object.keys(labelsSource).map(key=>[key,next[key as keyof typeof labels]])),reason:''}))}
 const completed=(result?:unknown,original?:Record<string,unknown>)=>{if(JSON.stringify(original)===JSON.stringify(body)&&result&&typeof result==='object'&&'id' in result&&'version' in result)loadPolicyDraft(result as Policy);refresh()}
 useEffect(()=>{let live=true;void api.request<Status>('/billing/retention').then(result=>{if(!result.data)throw new Error('Saqlash siyosati mavjud emas');if(live){setData(result.data);setError('');if(!initialized.current){initialized.current=true;setDraft(result.data.policy);setBaseline(JSON.stringify({expectedVersionId:result.data.policy.id,...Object.fromEntries(Object.keys(labelsSource).map(key=>[key,result.data!.policy[key as keyof typeof labels]])),reason:''}));}}}).catch(e=>{if(live)setError(displayErrorMessage(e,'Saqlash siyosati yuklanmadi'))}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[revision])
 return <section aria-label={tr("Ma’lumotlarni saqlash siyosati")} className="space-y-3 rounded border p-4"><h2 className="font-semibold">{tr("Ma’lumotlarni saqlash siyosati")}</h2>
 <button className="underline" disabled={loading||posting} onClick={refresh}>{tr("Saqlash siyosatini yangilash")}</button><PendingActions exact prefix="/billing/retention" returnPath="/billing" revision={revision} onDone={completed}/>{error&&<div role="alert">{uiMessage(error)}<button className="ml-2 underline" onClick={refresh}>{tr("Qayta yuklash")}</button></div>}
 {loading&&<p role="status">{tr("Saqlash siyosati yuklanmoqda…")}</p>}
 {data&&<><p>{tr("Siyosat versiyasi:")}{' '}{data.policy.version}</p><p>{tr("Obuna tugagan sanadan")}{' '}{data.policy.expiredSubscriptionDays} {tr("kunlik saqlash rejasi. Bu muddat tugashi avtomatik o‘chirishga ruxsat bermaydi.")}</p><p>{tr("Yopish so‘rovi uchun rejalangan bekor qilish oynasi:")}{' '}{data.policy.closureCancellationDays} {tr("kun.")}</p>
 {data.plannedReviewAt&&<p>{tr("Saqlashni ko‘rib chiqish sanasi:")}{' '}{data.plannedReviewAt}{data.reviewDue?tr("— ko‘rib chiqish vaqti yetgan"):''}</p>}
 <p>{tr("Moliyaviy hujjatlar bo‘yicha taklif:")}{' '}{data.policy.proposedFinancialRetentionYears} {tr("yil. Huquqiy toifalar va muddatlar yakuniy tasdiqlanmagan.")}</p>
 <p>{tr("Audit:")}{' '}{data.policy.auditRetentionDays??tr("tasdiqlanmagan")}{tr("; texnik log:")}{' '}{data.policy.technicalLogRetentionDays??tr("tasdiqlanmagan")}{tr("; backup:")}{' '}{data.policy.backupRetentionDays??tr("tasdiqlanmagan")} {tr("kun.")}</p>
 <p>{tr("Avtomatik o‘chirish yoqilmagan.")}{' '}{data.closureAvailable?tr("Tashkilot egasi pastdagi yopish panelidan foydalanishi mumkin."):tr("Yopish so‘rovini faqat tashkilot egasi yuborishi mumkin.")}</p>
 {data.canManage&&draft&&<><p>{tr("Draft asosidagi siyosat:")}{' '}{draft.version}.</p>{draft.id!==data.policy.id&&<button disabled={loading||posting} className="underline" onClick={()=>{if(confirmDiscard())loadPolicyDraft(data.policy)}}>{tr("Joriy saqlash siyosatini draftga olish")}</button>}<DurableMutation allowNew={data.canManage} canSubmit={!loading&&!error&&!posting} onSavingChange={setPosting} path="/billing/retention" returnPath="/billing" label={tr("Saqlash siyosatini saqlash")} body={body}
 review={[tr("Obuna: {value1} kun; bekor qilish: {value2} kun",{value1:String(draft.expiredSubscriptionDays),value2:String(draft.closureCancellationDays)}),tr("Moliyaviy taklif: {value1} yil; huquqiy tasdiq talab qilinadi",{value1:String(draft.proposedFinancialRetentionYears)}),tr("Bu amal ma’lumotlarni o‘chirmaydi."),reason]} onDone={completed}>
 {Object.entries(labels).map(([key,label])=>{const field=key as keyof typeof labels,nullable=['auditRetentionDays','technicalLogRetentionDays','backupRetentionDays'].includes(key);return <label key={key} className="block">{label}<input className="ml-2 border" type="number" min={field==='proposedFinancialRetentionYears'?5:1} max={field==='closureCancellationDays'?365:field==='proposedFinancialRetentionYears'?100:3650} value={draft[field]??''} onChange={e=>setDraft({...draft,[field]:nullable&&e.target.value===''?null:Number(e.target.value)})}/></label>})}
 <label className="block">{tr("Saqlash siyosati o‘zgartirish sababi")}<input className="ml-2 border" value={reason} maxLength={2000} onChange={e=>setReason(e.target.value)}/></label>
 </DurableMutation></>}
 </>}
 </section>
}
