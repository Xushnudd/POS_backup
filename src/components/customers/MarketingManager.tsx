'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import {Suspense,useEffect,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {useOrganization} from '@/context/OrganizationContext';
import {useListQuery} from '@/hooks/useListQuery';
import {api} from '@/lib/api';
import {tashkentLocalToISO} from '@/lib/tashkent-time';
import type {LoyaltyPolicy} from '@/server/loyalty/calculations';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import ListFilter from '@/components/ui/ListFilter';
import DurableMutation from '@/components/forms/DurableMutation';
import PendingActions from '@/components/forms/PendingActions';
type Registry={id:string;code:string;revokedAt:string|null;expiresAt?:string|null;createdAt:string};
type Policy={id:string;configuration:LoyaltyPolicy};
type Page={rows:Registry[];pagination:{page:number;limit:number;total:number}};
export default function MarketingManager({customerId,policyRevision=0}:{customerId?:string;policyRevision?:number}){
 const {t:tr}=useTranslation();

 const {organization,user,role}=useAuth();return organization&&user&&role==='owner'?<Suspense fallback={<p role="status">{tr("Karta/promo jurnali yuklanmoqda…")}</p>}><Manager key={[organization.id,user.id,role,customerId??'campaigns'].join(':')} customerId={customerId} policyRevision={policyRevision}/></Suspense>:null;
}
function Manager({customerId,policyRevision}:{customerId?:string;policyRevision:number}){
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

 const kind=customerId?'card':'promotion',returnPath=customerId?'/customers/'+customerId:'/loyalty',{stores}=useOrganization();
 const {query,changeQuery}=useListQuery(['newest','oldest','code'] as const,'newest',kind+'_');
 const [data,setData]=useState<Page|null>(null),[policy,setPolicy]=useState<Policy|null>(null),[revision,setRevision]=useState(0),[busy,setBusy]=useState(true),[posting,setPosting]=useState(false),[error,setError]=useState('');
 const [code,setCode]=useState(''),[reason,setReason]=useState(''),[revokeId,setRevokeId]=useState(''),[revokeReason,setRevokeReason]=useState('');
 const [ruleKind,setRuleKind]=useState('percent'),[value,setValue]=useState(''),[minimum,setMinimum]=useState(''),[maximum,setMaximum]=useState(''),[maxUses,setMaxUses]=useState(''),[perCustomer,setPerCustomer]=useState(''),[starts,setStarts]=useState(''),[ends,setEnds]=useState(''),[storeIds,setStoreIds]=useState<string[]>([]);
 const page=query?.page,limit=query?.limit,search=query?.search,sort=query?.sort;
 useEffect(()=>{let cancelled=false;void Promise.resolve().then(async()=>{if(cancelled)return;setBusy(true);setError('');setData(null);
  if(page===undefined||limit===undefined||search===undefined||sort===undefined){setError('Karta/promo URL filtri noto‘g‘ri. Filtrlarni tozalang.');setBusy(false);return;}
  try{const [p,list]=await Promise.all([api.request<Policy|null>('/loyalty/policy'),api.request<Page>('/loyalty/marketing?'+new URLSearchParams({kind,page:String(page),limit:String(limit),search,sort,...(customerId?{customerId}:{})}))]);if(!cancelled){setPolicy(p.data??null);setData(list.data??null);}}
  catch(e){if(!cancelled)setError(displayErrorMessage(e,'Karta/promo jurnali yuklanmadi'));}finally{if(!cancelled)setBusy(false);}
 });return()=>{cancelled=true;};},[customerId,kind,page,limit,search,sort,revision,policyRevision]);
 let startsAt='',endsAt='';try{if(starts)startsAt=tashkentLocalToISO(starts);if(ends)endsAt=tashkentLocalToISO(ends);}catch{/* Field remains editable and no invalid date is submitted. */}
 const body=customerId?{action:'issue_card',policyVersionId:policy?.id??'',customerId,code,reason}:{action:'create_promotion',policyVersionId:policy?.id??'',code,reason,configuration:{enabled:true,kind:ruleKind,value,minEligibleNet:minimum,maxDiscount:maximum,maxUses:Number(maxUses),maxUsesPerCustomer:Number(perCustomer),storeIds,productIds:[],startsAt,endsAt}};
 const enabled=customerId?policy?.configuration.cards.enabled:policy?.configuration.promos.enabled;
 const valid=!!enabled&&/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(code)&&reason.trim().length>=3&&
  (customerId!==undefined||([value,minimum,maximum].every(text=>/^\d+(?:\.\d{1,2})?$/.test(text))&&/^\d+$/.test(maxUses)&&/^\d+$/.test(perCustomer)&&!!startsAt&&!!endsAt));
 const refresh=()=>setRevision(count=>count+1);
 return <Card className="space-y-3"><h2 className="font-bold">{customerId?tr("Mijoz chegirma kartasi"):tr("Promo-kod kampaniyalari")}</h2>
  <p>{customerId?tr("Karta shu mijozga biriktiriladi. Foiz amaldagi administrator siyosatidan olinadi; original muddat saqlanadi."):tr("Promo butun chek uchun. Filial, muddat, summa va global/mijoz foydalanish limitlari serverda tekshiriladi. Eski qoida o‘zgartirilmaydi; o‘zgarish uchun eski kampaniyani bekor qilib, yangi kod yarating.")}</p>
  {busy&&<p role="status">{tr("Karta/promo jurnali yuklanmoqda…")}</p>}{error&&<p role="alert">{uiMessage(error)}</p>}
  <PendingActions prefix="/loyalty/marketing" returnPath={returnPath} revision={revision} onDone={refresh}/>
  <ListFilter search={search??''} sort={sort??'newest'} label={customerId?tr("Karta kodi qidiruvi"):tr("Promo kodi qidiruvi")} options={[{value:'newest',label:tr("Yangilari avval")},{value:'oldest',label:tr("Eskilari avval")},{value:'code',label:tr("Kod bo‘yicha")}]} onChange={changeQuery} disabled={posting}/>
  {!enabled&&<p>{tr("Egasi avval shu xizmatni bonus siyosatida yoqsin.")}</p>}
  <DurableMutation path="/loyalty/marketing" returnPath={returnPath} body={body} label={customerId?tr("Chegirma kartasini chiqarish"):tr("Promo kampaniyasini yaratish")} review={[tr("Kod:")+" "+code,customerId?tr("Mijoz:")+" "+customerId:tr("Qoida:")+" "+ruleKind+' '+value,customerId?tr("Original muddat policy bo‘yicha"):tr("Chegara:")+" "+maximum+" "+tr("UZS · jami")+" "+maxUses+" "+tr("· mijozga")+" "+perCustomer,customerId?tr("Foiz:")+" "+(policy?.configuration.cards.discountPercent??''):tr("Toshkent:")+" "+starts+' — '+ends,reason]} canSubmit={!busy&&!posting&&!error} canReview={valid} onSavingChange={setPosting} onDone={refresh}>
   <Input label={customerId?tr("Yangi chegirma kartasi kodi"):tr("Yangi promo-kod")} value={code} maxLength={64} onChange={e=>setCode(e.target.value.toUpperCase())}/>
   {!customerId&&<><Select label={tr("Promo chegirma turi")} value={ruleKind} onChange={e=>setRuleKind(e.target.value)} options={[{value:'percent',label:tr("Foiz")},{value:'fixed',label:tr("UZS summasi")}]}/><Input label={tr("Promo chegirma qiymati")} inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)}/><Input label={tr("Promo uchun minimal chek bazasi (UZS)")} inputMode="decimal" value={minimum} onChange={e=>setMinimum(e.target.value)}/><Input label={tr("Promo maksimal chegirmasi (UZS)")} inputMode="decimal" value={maximum} onChange={e=>setMaximum(e.target.value)}/><Input label={tr("Promo jami foydalanish limiti")} inputMode="numeric" value={maxUses} onChange={e=>setMaxUses(e.target.value)}/><Input label={tr("Promo mijoz foydalanish limiti")} inputMode="numeric" value={perCustomer} onChange={e=>setPerCustomer(e.target.value)}/><Input label={tr("Promo boshlanishi (Toshkent vaqti)")} type="datetime-local" value={starts} onChange={e=>setStarts(e.target.value)}/><Input label={tr("Promo tugashi (Toshkent vaqti)")} type="datetime-local" value={ends} onChange={e=>setEnds(e.target.value)}/><fieldset><legend>{tr("Filiallar: tanlov bo‘sh bo‘lsa barcha filiallarda")}</legend>{stores.map(store=><label key={store.id} className="block"><input type="checkbox" checked={storeIds.includes(store.id)} onChange={e=>setStoreIds(ids=>e.target.checked?[...ids,store.id]:ids.filter(id=>id!==store.id))}/>{store.name}</label>)}</fieldset></>}
   <Input label={customerId?tr("Karta chiqarish sababi"):tr("Promo kampaniyasi sababi")} value={reason} onChange={e=>setReason(e.target.value)}/>
  </DurableMutation>
  <DurableMutation path="/loyalty/marketing" returnPath={returnPath} body={{action:'revoke',kind,id:revokeId,reason:revokeReason}} label={customerId?tr("Kartani bekor qilish"):tr("Promo kampaniyasini bekor qilish")} review={[tr("Kod:")+" "+(data?.rows.find(row=>row.id===revokeId)?.code??''),revokeReason]} canSubmit={!busy&&!posting&&!error} canReview={!!data?.rows.some(row=>row.id===revokeId&&!row.revokedAt)&&revokeReason.trim().length>=3} onSavingChange={setPosting} onDone={refresh}>
   <Select label={customerId?tr("Bekor qilinadigan karta"):tr("Bekor qilinadigan promo")} value={revokeId} onChange={e=>setRevokeId(e.target.value)} options={[{value:'',label:tr("Original yozuvni tanlang")},...(data?.rows??[]).filter(row=>!row.revokedAt).map(row=>({value:row.id,label:row.code}))]}/><Input label={tr("Karta/promo bekor qilish sababi")} value={revokeReason} onChange={e=>setRevokeReason(e.target.value)}/>
  </DurableMutation>
  {!busy&&!error&&data?.rows.length===0&&<p>{tr("Bu filtrda karta/promo yo‘q.")}</p>}
  {data&&<DataTable><thead><tr><th>{tr("Kod")}</th><th>{tr("Holat")}</th><th>{tr("Muddati")}</th></tr></thead><tbody>{data.rows.map(row=><tr key={row.id}><td>{row.code}</td><td>{row.revokedAt?tr("Bekor qilingan"):tr("Saqlangan")}</td><td>{row.expiresAt?new Intl.DateTimeFormat('uz-UZ',{timeZone:'Asia/Tashkent',dateStyle:'short'}).format(new Date(row.expiresAt)):tr("Kampaniya/administrator qoidasi")}</td></tr>)}</tbody></DataTable>}
  <Button disabled={busy||posting||(page??1)<=1} onClick={()=>changeQuery({page:String((page??1)-1)})}>{tr("Oldingi karta/promo yozuvlari")}</Button><span>{page??1}/{Math.max(1,Math.ceil((data?.pagination.total??0)/(limit??20)))}</span><Button disabled={busy||posting||(page??1)*(limit??20)>=(data?.pagination.total??0)} onClick={()=>changeQuery({page:String((page??1)+1)})}>{tr("Keyingi karta/promo yozuvlari")}</Button><Button disabled={busy||posting} onClick={refresh}>{tr("Karta/promo jurnalini yangilash")}</Button>
 </Card>;
}
