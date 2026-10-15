'use client';


import {useTranslation} from '@/context/LocaleContext';

import {useEffect,useRef,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {api} from '@/lib/api';
import type {Sale} from '@/types';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import DurableMutation from '@/components/forms/DurableMutation';
import PendingActions from '@/components/forms/PendingActions';
type Wallet={availablePoints:string;recoveryDebtPoints:string;asOf:string;redemptionPolicy:{id:string;enabled:boolean;redeemMoneyPerPoint:string;maxRedeemPercent:string;currency:string}|null};
type Choice={id:string;state:string;points:string;discountAmount:string;policyVersionId:string};
export default function SalePoints({sale,onChanged}:{sale:Sale;onChanged:(sale:Sale)=>void}){const {organization,user,role}=useAuth();return sale.customerId&&organization&&user?<Points key={[organization.id,user.id,role,sale.id,sale.customerId].join(':')} sale={sale} onChanged={onChanged}/>:null;}
function Points({sale,onChanged}:{sale:Sale;onChanged:(sale:Sale)=>void}){
 const {t:tr}=useTranslation();

 const [wallet,setWallet]=useState<Wallet|null>(null),[choice,setChoice]=useState<Choice|null>(null),[revision,setRevision]=useState(0),[busy,setBusy]=useState(true),[posting,setPosting]=useState(false),[error,setError]=useState(''),[points,setPoints]=useState(''),[reason,setReason]=useState(''),[consent,setConsent]=useState(false);
 const version=useRef(0),path='/sales/'+sale.id+'/points',returnPath='/sales/'+sale.id;
 useEffect(()=>{const request=++version.current;let cancelled=false;void Promise.resolve().then(async()=>{setBusy(true);setError('');try{const [balance,selected]=await Promise.all([api.request<Wallet>('/customers/'+sale.customerId+'/points',{cache:'no-store'}),api.request<Choice|null>(path,{cache:'no-store'})]);if(!cancelled&&request===version.current){setWallet(balance.data??null);setChoice(selected.data??null);}}catch(e){if(!cancelled&&request===version.current)setError(e instanceof Error?e.message:'Ball ma’lumotlari yuklanmadi');}finally{if(!cancelled&&request===version.current)setBusy(false);}});return()=>{cancelled=true;};},[sale.customerId,path,revision]);
 function refresh(){setRevision(value=>value+1);}
 function saved(result?:unknown){if(result&&typeof result==='object'&&'sale'in result)onChanged((result as {sale:Sale}).sale);refresh();}
 const policy=wallet?.redemptionPolicy,mutable=sale.status==='draft',available=!!policy?.enabled&&!choice;
 return <Card title={tr("Mijoz bonus ballari")}><div className="space-y-3">
  <PendingActions prefix={path} returnPath={returnPath} revision={revision} onDone={saved}/>
  {error&&<p role="alert">{error}</p>}{busy?<p role="status">{tr("Ball qoldig‘i yuklanmoqda…")}</p>:wallet&&<><p>{tr("Sarflash mumkin:")}{' '}{wallet.availablePoints} {tr("ball. Qaytarishda qoplanishi kerak:")}{' '}{wallet.recoveryDebtPoints} {tr("ball.")}</p>{policy&&<p>{tr("1 ball =")}{' '}{policy.redeemMoneyPerPoint} {policy.currency}{tr("; sarflash chegarasi")}{' '}{policy.maxRedeemPercent}{tr("%. Kassa xodimining chegirma vakolati ham qo‘llanadi.")}</p>}</>}
  <Button disabled={busy||posting} onClick={refresh}>{tr("Ball holatini yangilash")}</Button>
  {!busy&&!error&&!policy?.enabled&&!choice&&<p>{tr("Bonus sarflash siyosati yoqilmagan.")}</p>}
  {choice&&<p>{tr("Original tanlov:")}{' '}{choice.points} {tr("ball,")}{' '}{choice.discountAmount} {policy?.currency??'UZS'}. {choice.state==='posted'?tr("Savdoda sarflangan."):tr("Yakunlashda qoldiq qayta tekshiriladi.")}</p>}
  {mutable&&available&&<DurableMutation path={path} returnPath={returnPath} body={{policyVersionId:policy!.id,points,customerConsent:consent,reason}} label={tr("Ball chegirmasini tanlash")} review={[points+' ball','Mijoz roziligi tasdiqlangan',reason]} canSubmit={!busy&&!error&&!posting} canReview={consent&&/^[1-9]\d*$/.test(points)&&reason.trim().length>=3} onSavingChange={setPosting} onDone={saved}>
   <Input label={tr("Sarflanadigan bonus ballari")} inputMode="numeric" value={points} onChange={e=>setPoints(e.target.value)}/><Input label={tr("Ball sarflash sababi")} value={reason} onChange={e=>setReason(e.target.value)}/><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> {tr("Mijoz shu savdoda ball sarflashga rozilik berdi")}</label>
  </DurableMutation>}
  {mutable&&choice?.state==='prepared'&&<DurableMutation path={path+'/cancel'} returnPath={returnPath} body={{reason}} label={tr("Ball tanlovini bekor qilish")} review={['Faqat yakunlanmagan tanlov; original ball sarflanmaydi.',reason]} canSubmit={!busy&&!error&&!posting} canReview={reason.trim().length>=3} onSavingChange={setPosting} onDone={saved}><Input label={tr("Ball tanlovini bekor qilish sababi")} value={reason} onChange={e=>setReason(e.target.value)}/></DurableMutation>}
 </div></Card>;
}
