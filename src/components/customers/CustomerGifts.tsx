'use client';
import {Suspense,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useAuth} from '@/context/AuthContext';
import {useOrganization} from '@/context/OrganizationContext';
import {useListQuery} from '@/hooks/useListQuery';
import {api} from '@/lib/api';
import {formatMoney} from '@/lib/format';
import type {DebtAllocationTarget} from '@/types';
import type {LoyaltyPolicy} from '@/server/loyalty/calculations';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import ListFilter from '@/components/ui/ListFilter';
import DurableMutation from '@/components/forms/DurableMutation';
import PendingActions from '@/components/forms/PendingActions';
type Gift={id:string;code:string;amount:string;liability:string;spendable:string;expiresAt:string|null;allowUnusedCashRefund:boolean};
type Wallet={rows:Gift[];pagination:{page:number;limit:number;total:number}};
type Policy={id:string;configuration:LoyaltyPolicy};
type Account={id:string;name:string;kind:string;registerId:string|null;isActive:boolean};
export function CustomerGifts({customerId,onChanged}:{customerId:string;onChanged:()=>Promise<void>}){
 const {organization,user,role}=useAuth();
 return role==='owner'&&organization&&user?<Suspense fallback={<p role="status">Sertifikatlar yuklanmoqda…</p>}><GiftPanel key={[organization.id,user.id,role,customerId].join(':')} customerId={customerId} onChanged={onChanged}/></Suspense>:null;
}
function GiftPanel({customerId,onChanged}:{customerId:string;onChanged:()=>Promise<void>}){
 const {activeShift}=useOrganization(),{query,changeQuery}=useListQuery(['newest'] as const,'newest');
 const [wallet,setWallet]=useState<Wallet|null>(null),[policy,setPolicy]=useState<Policy|null>(null),[accounts,setAccounts]=useState<Account[]>([]),[targets,setTargets]=useState<DebtAllocationTarget[]>([]),[debtPage,setDebtPage]=useState(1),[moreDebt,setMoreDebt]=useState(false);
 const [action,setAction]=useState('issue'),[giftId,setGiftId]=useState(''),[saleId,setSaleId]=useState(''),[accountId,setAccountId]=useState(''),[code,setCode]=useState(''),[amount,setAmount]=useState(''),[reason,setReason]=useState(''),[consent,setConsent]=useState(false),[revision,setRevision]=useState(0),[busy,setBusy]=useState(true),[posting,setPosting]=useState(false),[error,setError]=useState('');
 const live=useRef(true);useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const page=query?.page,limit=query?.limit,search=query?.search;
 useEffect(()=>{let cancelled=false;void Promise.resolve().then(async()=>{
  if(cancelled)return;setBusy(true);setError('');setWallet(null);
  if(page===undefined||limit===undefined||search===undefined){setError('Sertifikat filtri noto‘g‘ri. URL parametrlarini tozalang.');setBusy(false);return;}
  try{const [w,p,a,d]=await Promise.all([api.request<Wallet>('/loyalty/gifts?'+new URLSearchParams({page:String(page),limit:String(limit),search,customerId})),api.request<Policy|null>('/loyalty/policy'),api.request<Account[]>('/finance/accounts'),api.customers.getDebt(customerId,debtPage)]);
   if(!cancelled){setWallet(w.data??null);setPolicy(p.data??null);setAccounts(a.data??[]);setTargets(d.data?.allocationTargets?.items??[]);setMoreDebt(d.data?.allocationTargets?.hasMore??false);}
  }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Sertifikatlar yuklanmadi');}finally{if(!cancelled)setBusy(false);}
 });return()=>{cancelled=true;};},[page,limit,search,customerId,debtPage,revision]);
 const selected=wallet?.rows.find(row=>row.id===giftId),selectedSale=targets.find(row=>row.saleId===saleId);
 const selectedAccount=accounts.find(row=>row.id===accountId&&row.kind==='cash'&&row.isActive&&row.registerId===activeShift?.registerId);
 const body={action,amount,reason,...(action==='issue'?{customerId,code,policyVersionId:policy?.id??'',accountId,shiftId:activeShift?.id??''}:action==='redeem'?{giftId,saleId,customerConsent:consent}:{giftId,accountId,shiftId:activeShift?.id??''})};
 const valid=/^\d+(?:\.\d{1,2})?$/.test(amount)&&reason.trim().length>=3&&
  (action==='issue'?!!policy?.configuration.gifts.enabled&&!!selectedAccount&&/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(code):action==='redeem'?!!selected&&!!selectedSale&&consent:!!selected?.allowUnusedCashRefund&&!!selectedAccount);
 function refreshed(){if(!live.current)return;setRevision(value=>value+1);void onChanged().catch(e=>{if(live.current)setError(e instanceof Error?e.message:'Mijoz hisobi qayta yuklanmadi');});}
 const totalPages=Math.max(1,Math.ceil((wallet?.pagination.total??0)/(limit??20)));
 return <Card className="space-y-3"><h2 className="font-bold">Sovg‘a sertifikatlari</h2>
  <p>Sertifikat ushbu mijozga biriktiriladi. Kod maxfiy to‘lov tokeni emas. Chiqarish — naqd kirim va majburiyat; sarflash — mavjud nasiya savdosini to‘lash. Tovar qaytarilishi mavjud avans qoidasi bilan naqd qaytariladi; sertifikat qayta to‘ldirilmaydi.</p>
  <Link href="/loyalty">Administrator sertifikat siyosati</Link>
  {error&&<p role="alert">{error}</p>}{busy&&<p role="status">Sertifikatlar yuklanmoqda…</p>}
  <PendingActions prefix="/loyalty/gifts" returnPath={'/customers/'+customerId} revision={revision} onDone={refreshed}/>
  <ListFilter search={search??''} sort="newest" label="Sertifikat kodi bo‘yicha qidirish" options={[{value:'newest',label:'Yangilari avval'}]} onChange={changeQuery} disabled={posting}/>
  <DurableMutation path="/loyalty/gifts" returnPath={'/customers/'+customerId} body={body} label="Sertifikat amalini saqlash" review={['Amal: '+action,'Kod: '+(action==='issue'?code:selected?.code??''),'Mijoz: '+customerId,'Savdo: '+(selectedSale?.receiptNo??saleId),'Summa: '+amount+' UZS',reason]} canSubmit={!busy&&!posting&&!error} canReview={valid} onSavingChange={setPosting} onDone={refreshed}>
   <Select label="Sertifikat amali" value={action} onChange={e=>setAction(e.target.value)} options={[{value:'issue',label:'Naqd pul bilan chiqarish'},{value:'redeem',label:'Mavjud savdoga sarflash'},{value:'refund',label:'Ruxsat etilgan ishlatilmagan pulni qaytarish'}]}/>
   {action==='issue'?<Input label="Yangi sertifikat kodi" value={code} maxLength={64} onChange={e=>setCode(e.target.value.toUpperCase())}/>:<Select label="Original sertifikat" value={giftId} onChange={e=>setGiftId(e.target.value)} options={[{value:'',label:'Sertifikatni tanlang'},...(wallet?.rows??[]).map(row=>({value:row.id,label:row.code+' · majburiyat '+formatMoney(row.liability)+' · sarflash '+formatMoney(row.spendable)}))]}/>}
   {action==='redeem'?<><Select label="Sertifikat sarflanadigan original savdo" value={saleId} onChange={e=>setSaleId(e.target.value)} options={[{value:'',label:'Nasiya savdosini tanlang'},...targets.filter(row=>row.saleId).map(row=>({value:row.saleId!,label:(row.receiptNo??row.saleId!)+' · '+formatMoney(row.balance)}))]}/><Button disabled={debtPage<=1||busy} onClick={()=>setDebtPage(value=>value-1)}>Oldingi sertifikat savdolari</Button><Button disabled={!moreDebt||busy} onClick={()=>setDebtPage(value=>value+1)}>Keyingi sertifikat savdolari</Button><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> Mijoz ushbu sertifikatni sarflashga rozi</label></>:<Select label="Sertifikat uchun naqd hisob" value={accountId} onChange={e=>setAccountId(e.target.value)} options={[{value:'',label:'Ochiq smena hisobini tanlang'},...accounts.filter(row=>row.kind==='cash'&&row.isActive&&row.registerId===activeShift?.registerId).map(row=>({value:row.id,label:row.name}))]}/>}
   <Input label="Sertifikat amali summasi (UZS)" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/><Input label="Sertifikat amali sababi" value={reason} onChange={e=>setReason(e.target.value)}/>
  </DurableMutation>
  {!busy&&!error&&wallet?.rows.length===0&&<p>Ushbu filtrda sertifikat yo‘q.</p>}
  {wallet&&<DataTable><thead><tr><th>Kod</th><th>Chiqarilgan</th><th>Majburiyat</th><th>Sarflash mumkin</th><th>Muddati</th></tr></thead><tbody>{wallet.rows.map(row=><tr key={row.id}><td>{row.code}</td><td>{formatMoney(row.amount)}</td><td>{formatMoney(row.liability)}</td><td>{formatMoney(row.spendable)}</td><td>{row.expiresAt?new Intl.DateTimeFormat('uz-UZ',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Tashkent'}).format(new Date(row.expiresAt)):'Cheklanmagan'}</td></tr>)}</tbody></DataTable>}
  <Button disabled={busy||posting||(page??1)<=1} onClick={()=>changeQuery({page:String((page??1)-1)})}>Oldingi sertifikatlar</Button><span>{page??1}/{totalPages}</span><Button disabled={busy||posting||(page??1)>=totalPages} onClick={()=>changeQuery({page:String((page??1)+1)})}>Keyingi sertifikatlar</Button><Button disabled={busy||posting} onClick={refreshed}>Sertifikatlarni yangilash</Button>
 </Card>;
}
