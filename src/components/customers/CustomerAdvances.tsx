'use client';
import {useEffect,useState} from 'react';
import {api} from '@/lib/api';
import {useOrganization} from '@/context/OrganizationContext';
import {formatMoney} from '@/lib/format';
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
 const {activeShift}=useOrganization(),[action,setAction]=useState('receive'),[amount,setAmount]=useState(''),[reason,setReason]=useState(''),[accountId,setAccountId]=useState(''),[advanceId,setAdvanceId]=useState(''),[targetKey,setTargetKey]=useState('');
 const [wallet,setWallet]=useState<Wallet|null>(null),[accounts,setAccounts]=useState<Account[]>([]),[targets,setTargets]=useState<DebtAllocationTarget[]>([]),[page,setPage]=useState(1),[debtPage,setDebtPage]=useState(1),[moreDebt,setMoreDebt]=useState(false),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const path='/customers/'+customerId+'/advances',returnPath='/customers/'+customerId;
 useEffect(()=>{let live=true;void Promise.resolve().then(async()=>{if(!live)return;setBusy(true);setError('');try{const [w,a,d]=await Promise.all([api.request<Wallet>(path+'?page='+page+'&limit=20'),api.request<Account[]>('/finance/accounts'),api.customers.getDebt(customerId,debtPage)]);if(live){setWallet(w.data??null);setAccounts(a.data??[]);setTargets(d.data?.allocationTargets?.items??[]);setMoreDebt(d.data?.allocationTargets?.hasMore??false)}}catch(e){if(live)setError(e instanceof Error?e.message:'Avanslar yuklanmadi')}finally{if(live)setBusy(false)}});return()=>{live=false}},[path,customerId,page,debtPage,revision]);
 const body={action,amount,reason,...(action!=='receive'?{advanceId}:{}),...(action==='allocate'?{targetKey}:{accountId,shiftId:activeShift?.id??''})};
 const refresh=()=>{setRevision(v=>v+1);void onChanged().catch(e=>setError(e instanceof Error?e.message:'Qarz qayta yuklanmadi'))};
 return <Card className="space-y-3"><h2 className="font-bold">Mijoz avansi</h2><p>Avans qarzdan alohida. Pulni qabul qilish qarzni o‘zi yopmaydi; tanlangan hujjatga ajrating. Faqat ishlatilmagan qoldiqni qaytarish mumkin. Naqd pul amali ochiq smenadagi haqiqiy kassa jurnaliga yoziladi.</p>{error&&<p role="alert">{error}</p>}{busy&&<p role="status">Avanslar yuklanmoqda…</p>}{wallet&&<p>Jami qabul: {formatMoney(wallet.summary.received)} · Ishlatilmagan avans: {formatMoney(wallet.summary.available)}</p>}<PendingActions prefix={path} returnPath={returnPath} revision={revision} onDone={refresh}/>
 <DurableMutation key={revision} path={path} returnPath={returnPath} body={body} label={action==='receive'?'Naqd avans qabul qilish':action==='allocate'?'Avansni qarzga ajratish':'Ishlatilmagan avansni qaytarish'} review={['Amal: '+action,'Mijoz: '+customerId,'Asl avans: '+advanceId,'Qarz hujjati: '+targetKey,'Hisob: '+accountId,'Summa: '+amount,reason]} onDone={refresh}>
 <Select label="Avans amali" value={action} onChange={e=>setAction(e.target.value)} options={[{value:'receive',label:'Naqd avans qabul qilish'},{value:'allocate',label:'Qarzga ajratish'},{value:'refund',label:'Ishlatilmagan avansni qaytarish'}]}/>
 {action!=='receive'&&<Select label="Asl avans" value={advanceId} onChange={e=>setAdvanceId(e.target.value)} options={[{value:'',label:'Avansni tanlang'},...(wallet?.rows??[]).map(a=>({value:a.id,label:a.id+' · qoldiq '+formatMoney(a.available)}))]}/>}
 {action==='allocate'?<><Select label="Avans ajratiladigan qarz" value={targetKey} onChange={e=>setTargetKey(e.target.value)} options={[{value:'',label:'Qarz hujjatini tanlang'},...targets.filter(t=>t.saleId||t.debtOriginId).map(t=>({value:t.saleId?'sale:'+t.saleId:'document:'+t.debtOriginId,label:(t.receiptNo??t.debtOriginId??t.saleId??'')+' · '+formatMoney(t.balance)}))]}/><Button type="button" disabled={debtPage<=1||busy} onClick={()=>setDebtPage(p=>p-1)}>Oldingi avans qarzlari</Button><Button type="button" disabled={!moreDebt||busy} onClick={()=>setDebtPage(p=>p+1)}>Keyingi avans qarzlari</Button></>:<><Select label="Avans uchun naqd hisob" value={accountId} onChange={e=>setAccountId(e.target.value)} options={[{value:'',label:'Ochiq smena hisobini tanlang'},...accounts.filter(a=>a.kind==='cash'&&a.isActive&&a.registerId===activeShift?.registerId).map(a=>({value:a.id,label:a.name}))]}/>{!activeShift&&<p role="alert">Naqd amal uchun ochiq smena tanlang.</p>}</>}
 <Input label="Avans summasi" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} helperText="Musbat summa; ko‘pi bilan 2 kasr raqami"/><Input label="Avans sababi" value={reason} onChange={e=>setReason(e.target.value)} helperText="Kamida 3 belgili sabab"/>
 </DurableMutation>
 {!busy&&wallet?.rows.length===0&&<p>Hali avans yo‘q.</p>}{wallet?.rows.map(a=><article key={a.id} className="border p-2"><p>Avans {a.id}</p><p>Qabul {formatMoney(a.amount)} · Qarzlarga {formatMoney(a.allocated)} · Qaytarilgan {formatMoney(a.refunded)} · Qoldiq {formatMoney(a.available)}</p></article>)}<Button disabled={page<=1||busy} onClick={()=>setPage(p=>p-1)}>Oldingi avanslar</Button><span>{page}/{Math.max(1,wallet?.pagination.totalPages??0)}</span><Button disabled={busy||page>=(wallet?.pagination.totalPages??0)} onClick={()=>setPage(p=>p+1)}>Keyingi avanslar</Button><Button onClick={refresh} disabled={busy}>Avanslarni yangilash</Button>
 </Card>
}
