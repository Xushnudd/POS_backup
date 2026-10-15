'use client';

import {useTranslation} from '@/context/LocaleContext';

import {useEffect,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {api} from '@/lib/api';
import type {Sale} from '@/types';
import type {LoyaltyPolicy} from '@/server/loyalty/calculations';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import DurableMutation from '@/components/forms/DurableMutation';
import PendingActions from '@/components/forms/PendingActions';
type Info={policy:{id:string;configuration:LoyaltyPolicy}|null;selection:{id:string;state:string;discountAmount:string;cardId:string|null;promotionId:string|null}|null;cards:{id:string;code:string;expiresAt:string|null}[];promotions:{id:string;code:string;kind:string;value:string;endsAt:string}[];pagination:{cards:{total:number};promotions:{total:number}}};
export default function SaleBenefits({sale,onChanged}:{sale:Sale;onChanged:(sale:Sale)=>void}){
 const {organization,user,role}=useAuth();if(!organization||!user||!sale.customerId)return null;
 const key=[organization.id,user.id,role,sale.id,sale.customerId].join(':');
 return sale.status==='draft'?<Editor key={key} sale={sale} onChanged={onChanged}/>:<PendingActions key={key} prefix={'/sales/'+sale.id+'/benefits'} returnPath={'/sales/'+sale.id} revision={0} onDone={result=>onChanged((result as {sale:Sale}).sale)}/>;
}
function Editor({sale,onChanged}:{sale:Sale;onChanged:(sale:Sale)=>void}){
 const {t:tr}=useTranslation();

 const [info,setInfo]=useState<Info|null>(null),[cardPage,setCardPage]=useState(1),[promotionPage,setPromotionPage]=useState(1),[search,setSearch]=useState(''),[filter,setFilter]=useState(''),[cardId,setCardId]=useState(''),[promotionId,setPromotionId]=useState(''),[reason,setReason]=useState(''),[consent,setConsent]=useState(false),[revision,setRevision]=useState(0),[busy,setBusy]=useState(true),[posting,setPosting]=useState(false),[error,setError]=useState('');
 const path='/sales/'+sale.id+'/benefits',returnPath='/sales/'+sale.id;
 useEffect(()=>{let live=true;void Promise.resolve().then(async()=>{if(!live)return;setBusy(true);setError('');setInfo(null);try{const response=await api.request<Info>(path+'?'+new URLSearchParams({cardPage:String(cardPage),promotionPage:String(promotionPage),search:filter}));if(live)setInfo(response.data??null);}catch(e){if(live)setError(e instanceof Error?e.message:'Karta/promo tanlovi yuklanmadi');}finally{if(live)setBusy(false);}});return()=>{live=false;};},[path,cardPage,promotionPage,filter,revision]);
 const body={policyVersionId:info?.policy?.id??'',cardId:cardId||null,promotionId:promotionId||null,reason,customerConsent:consent};
 const valid=!!info?.policy&&consent&&reason.trim().length>=3&&(!!cardId||!!promotionId)&&(!cardId||info.cards.some(row=>row.id===cardId))&&(!promotionId||info.promotions.some(row=>row.id===promotionId));
 function done(result?:unknown){onChanged((result as {sale:Sale}).sale);setRevision(value=>value+1);}
 return <Card className="space-y-3"><h2 className="font-bold">{tr("Karta va promo tanlovi")}</h2><p>{tr("Karta/promo avval tanlanadi, ball keyin. Tahrirlash yoki bekor qilishdan oldin ball tanlovini bekor qiling. Chek yakunlanganda muddat va foydalanish limiti yana tekshiriladi.")}</p>
  {busy&&<p role="status">{tr("Karta/promo tanlovi yuklanmoqda…")}</p>}{error&&<p role="alert">{error}</p>}
  <PendingActions prefix={path} returnPath={returnPath} revision={revision} onDone={done}/>
  <form onSubmit={event=>{event.preventDefault();setFilter(search.trim());setCardPage(1);setPromotionPage(1);}}><Input label={tr("Savdo karta/promo kodi qidiruvi")} value={search} maxLength={200} onChange={e=>setSearch(e.target.value)}/><Button type="submit" disabled={posting}>{tr("Karta/promo kodini qidirish")}</Button></form>
  {info?.selection?<><p>{tr("Original tanlov:")}{' '}{info.selection.discountAmount} {tr("UZS ·")}{' '}{info.selection.state}</p><DurableMutation path={path+'/cancel'} returnPath={returnPath} body={{reason}} label={tr("Karta/promo tanlovini bekor qilish")} review={['Original tanlov: '+info.selection.id,reason]} canSubmit={!busy&&!posting&&!error} canReview={reason.trim().length>=3&&info.selection.state==='prepared'} onSavingChange={setPosting} onDone={done}><Input label={tr("Karta/promo tanlovini bekor qilish sababi")} value={reason} onChange={e=>setReason(e.target.value)}/></DurableMutation></>:<DurableMutation path={path} returnPath={returnPath} body={body} label={tr("Karta/promo chegirmasini tanlash")} review={['Karta: '+(info?.cards.find(row=>row.id===cardId)?.code??'tanlanmagan'),'Promo: '+(info?.promotions.find(row=>row.id===promotionId)?.code??'tanlanmagan'),reason]} canSubmit={!busy&&!posting&&!error} canReview={valid} onSavingChange={setPosting} onDone={done}>
   <Select label={tr("Savdo chegirma kartasi")} value={cardId} onChange={e=>setCardId(e.target.value)} options={[{value:'',label:tr("Kartasiz")},...(info?.cards??[]).map(row=>({value:row.id,label:row.code}))]}/><Select label={tr("Savdo promo-kodi")} value={promotionId} onChange={e=>setPromotionId(e.target.value)} options={[{value:'',label:tr("Promosiz")},...(info?.promotions??[]).map(row=>({value:row.id,label:row.code+' · '+row.value+(row.kind==='percent'?'%':' UZS')}))]}/><Input label={tr("Karta/promo tanlash sababi")} value={reason} onChange={e=>setReason(e.target.value)}/><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> {tr("Mijoz karta/promo qo‘llashga rozi")}</label>
  </DurableMutation>}
  {!busy&&!error&&info&&!info.cards.length&&!info.promotions.length&&<p>{tr("Ushbu mijoz, filial va muddat uchun karta/promo topilmadi.")}</p>}
  <Button disabled={busy||posting||cardPage<=1} onClick={()=>setCardPage(value=>value-1)}>{tr("Oldingi savdo kartalari")}</Button><Button disabled={busy||posting||cardPage*20>=(info?.pagination.cards.total??0)} onClick={()=>setCardPage(value=>value+1)}>{tr("Keyingi savdo kartalari")}</Button><Button disabled={busy||posting||promotionPage<=1} onClick={()=>setPromotionPage(value=>value-1)}>{tr("Oldingi savdo promolari")}</Button><Button disabled={busy||posting||promotionPage*20>=(info?.pagination.promotions.total??0)} onClick={()=>setPromotionPage(value=>value+1)}>{tr("Keyingi savdo promolari")}</Button><Button disabled={busy||posting} onClick={()=>setRevision(value=>value+1)}>{tr("Karta/promo tanlovini yangilash")}</Button>
 </Card>;
}
