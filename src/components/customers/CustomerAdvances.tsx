'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import {useEffect,useState} from 'react';
import {useReadPage} from '@/hooks/useReadPage';
import ReadQueryNotice from '@/components/ui/ReadQueryNotice';
import {api} from '@/lib/api';
import {useOrganization} from '@/context/OrganizationContext';

import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import DurableMutation from '@/components/forms/DurableMutation';
import PendingActions from '@/components/forms/PendingActions';
import type {DebtAllocationTarget} from '@/types';
type Wallet={rows:{id:string;amount:string;available:string;allocated:string;refunded:string;createdAt:string;documentId:string}[];summary:{received:string;available:string};pagination:{totalPages:number}};
type Account={id:string;name:string;kind:string;registerId:string|null;isActive:boolean};
export function CustomerAdvances({customerId,onChanged}:{customerId:string;onChanged:()=>Promise<void>}){
 const {message:uiMessage}=useTranslation();

 const {formatMoney}=useTranslation();

 const {t:tr}=useTranslation();

 const {page,setPage,invalid,reset}=useReadPage('advances_');
 const {activeShift}=useOrganization(),[action,setAction]=useState('receive'),[amount,setAmount]=useState(''),[reason,setReason]=useState(''),[accountId,setAccountId]=useState(''),[advanceId,setAdvanceId]=useState(''),[targetKey,setTargetKey]=useState('');
 const [wallet,setWallet]=useState<Wallet|null>(null),[accounts,setAccounts]=useState<Account[]>([]),[targets,setTargets]=useState<DebtAllocationTarget[]>([]),[debtPage,setDebtPage]=useState(1),[moreDebt,setMoreDebt]=useState(false),[revision,setRevision]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const path='/customers/'+customerId+'/advances',returnPath='/customers/'+customerId;
 useEffect(()=>{let live=true;void Promise.resolve().then(async()=>{if(!live||invalid)return;setBusy(true);setError('');try{const [w,a,d]=await Promise.all([api.request<Wallet>(path+'?page='+page+'&limit=20'),api.request<Account[]>('/finance/accounts'),api.customers.getDebt(customerId,debtPage)]);if(live){setWallet(w.data??null);setAccounts(a.data??[]);setTargets(d.data?.allocationTargets?.items??[]);setMoreDebt(d.data?.allocationTargets?.hasMore??false)}}catch(e){if(live)setError(displayErrorMessage(e,'Avanslar yuklanmadi'))}finally{if(live)setBusy(false)}});return()=>{live=false}},[path,customerId,page,debtPage,revision,invalid]);
 const body={action,amount,reason,...(action!=='receive'?{advanceId}:{}),...(action==='allocate'?{targetKey}:{accountId,shiftId:activeShift?.id??''})};
 const refresh=()=>{setRevision(v=>v+1);void onChanged().catch(e=>setError(displayErrorMessage(e,'Qarz qayta yuklanmadi')))};
 return <Card className="space-y-3"><h2 className="font-bold">{tr("Mijoz avansi")}</h2><p>{tr("Avans qarzdan alohida. Pulni qabul qilish qarzni o‘zi yopmaydi; tanlangan hujjatga ajrating. Faqat ishlatilmagan qoldiqni qaytarish mumkin. Naqd pul amali ochiq smenadagi haqiqiy kassa jurnaliga yoziladi.")}</p><ReadQueryNotice invalid={invalid} reset={reset}/>{error&&<p role="alert">{uiMessage(error)}</p>}{busy&&!invalid&&<p role="status">{tr("Avanslar yuklanmoqda…")}</p>}{wallet&&<p>{tr("Jami qabul:")}{' '}{formatMoney(wallet.summary.received)} {tr("· Ishlatilmagan avans:")}{' '}{formatMoney(wallet.summary.available)}</p>}<PendingActions prefix={path} returnPath={returnPath} revision={revision} onDone={refresh}/>
 <DurableMutation canSubmit={!busy&&!error&&!invalid} key={revision} path={path} returnPath={returnPath} body={body} label={action==='receive'?tr("Naqd avans qabul qilish"):action==='allocate'?tr("Avansni qarzga ajratish"):tr("Ishlatilmagan avansni qaytarish")} review={[tr("Amal:")+" "+action,tr("Mijoz:")+" "+customerId,tr("Asl avans:")+" "+advanceId,tr("Qarz hujjati:")+" "+targetKey,tr("Hisob:")+" "+accountId,tr("Summa:")+" "+amount,reason]} onDone={refresh}>
 <Select label={tr("Avans amali")} value={action} onChange={e=>setAction(e.target.value)} options={[{value:'receive',label:tr("Naqd avans qabul qilish")},{value:'allocate',label:tr("Qarzga ajratish")},{value:'refund',label:tr("Ishlatilmagan avansni qaytarish")}]}/>
 {action!=='receive'&&<Select label={tr("Asl avans")} value={advanceId} onChange={e=>setAdvanceId(e.target.value)} options={[{value:'',label:tr("Avansni tanlang")},...(advanceId&&!wallet?.rows.some(row=>row.id===advanceId)?[{value:advanceId,label:tr("Tanlangan original avans ·")+" "+advanceId}]:[]),...(wallet?.rows??[]).map(a=>({value:a.id,label:a.id+" "+tr("· qoldiq")+" "+formatMoney(a.available)}))]}/>}
 {action==='allocate'?<><Select label={tr("Avans ajratiladigan qarz")} value={targetKey} onChange={e=>setTargetKey(e.target.value)} options={[{value:'',label:tr("Qarz hujjatini tanlang")},...(targetKey&&!targets.some(target=>(target.saleId?'sale:'+target.saleId:'document:'+target.debtOriginId)===targetKey)?[{value:targetKey,label:tr("Tanlangan original qarz ·")+" "+targetKey}]:[]),...targets.filter(t=>t.saleId||t.debtOriginId).map(t=>({value:t.saleId?'sale:'+t.saleId:'document:'+t.debtOriginId,label:(t.receiptNo??t.debtOriginId??t.saleId??'')+' · '+formatMoney(t.balance)}))]}/><Button type="button" disabled={debtPage<=1||busy} onClick={()=>setDebtPage(p=>p-1)}>{tr("Oldingi avans qarzlari")}</Button><Button type="button" disabled={!moreDebt||busy} onClick={()=>setDebtPage(p=>p+1)}>{tr("Keyingi avans qarzlari")}</Button></>:<><Select label={tr("Avans uchun naqd hisob")} value={accountId} onChange={e=>setAccountId(e.target.value)} options={[{value:'',label:tr("Ochiq smena hisobini tanlang")},...accounts.filter(a=>a.kind==='cash'&&a.isActive&&a.registerId===activeShift?.registerId).map(a=>({value:a.id,label:a.name}))]}/>{!activeShift&&<p role="alert">{tr("Naqd amal uchun ochiq smena tanlang.")}</p>}</>}
 <Input label={tr("Avans summasi")} inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} helperText={tr("Musbat summa; ko‘pi bilan 2 kasr raqami")}/><Input label={tr("Avans sababi")} value={reason} onChange={e=>setReason(e.target.value)} helperText={tr("Kamida 3 belgili sabab")}/>
 </DurableMutation>
 {!busy&&!error&&!invalid&&wallet?.rows.length===0&&<p>{tr("Hali avans yo‘q.")}</p>}{wallet?.rows.map(a=><article key={a.id} className="border p-2"><p>{tr("Avans")}{' '}{a.id}</p><p>{tr("Qabul")}{' '}{formatMoney(a.amount)} {tr("· Qarzlarga")}{' '}{formatMoney(a.allocated)} {tr("· Qaytarilgan")}{' '}{formatMoney(a.refunded)} {tr("· Qoldiq")}{' '}{formatMoney(a.available)}</p></article>)}<Button disabled={page<=1||busy||invalid||!!error} onClick={()=>setPage(p=>p-1)}>{tr("Oldingi avanslar")}</Button><span>{page}/{Math.max(1,wallet?.pagination.totalPages??0)}</span><Button disabled={busy||invalid||!!error||page>=(wallet?.pagination.totalPages??0)} onClick={()=>setPage(p=>p+1)}>{tr("Keyingi avanslar")}</Button><Button onClick={refresh} disabled={busy}>{tr("Avanslarni yangilash")}</Button>
 </Card>
}
