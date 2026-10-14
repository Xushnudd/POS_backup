'use client';
import {useEffect,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {api} from '@/lib/api';
import type {Sale} from '@/types';
import {formatMoney} from '@/lib/format';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import SerialPicker from '@/components/inventory/SerialPicker';
import DurableMutation from '@/components/forms/DurableMutation';
import PendingActions from '@/components/forms/PendingActions';
type Choices={rows:{id:string;code:string;available:string;expiresAt:string|null}[];pagination:{page:number;limit:number;total:number}};
export default function SaleGift({sale,onChanged}:{sale:Sale;onChanged:(sale:Sale)=>void}){
 const {organization,user,role}=useAuth();
 if(!organization||!user||!sale.customerId)return null;
 const key=[organization.id,user.id,role,sale.id,sale.customerId].join(':');
 return sale.status==='draft'?<Editor key={key} sale={sale} onChanged={onChanged}/>:<PendingActions key={key} prefix={'/sales/'+sale.id+'/gift'} returnPath={'/sales/'+sale.id} revision={0} onDone={result=>onChanged(result as Sale)}/>;
}
function Editor({sale,onChanged}:{sale:Sale;onChanged:(sale:Sale)=>void}){
 const [choices,setChoices]=useState<Choices|null>(null),[page,setPage]=useState(1),[search,setSearch]=useState(''),[filter,setFilter]=useState(''),[giftId,setGiftId]=useState(''),[giftAmount,setGiftAmount]=useState(''),[cash,setCash]=useState('0'),[cashTendered,setCashTendered]=useState(''),[reason,setReason]=useState(''),[consent,setConsent]=useState(false),[serials,setSerials]=useState<Record<string,string[]>>({}),[revision,setRevision]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState(''),[posting,setPosting]=useState(false);
 const path='/sales/'+sale.id+'/gift',returnPath='/sales/'+sale.id;
 useEffect(()=>{let live=true;void Promise.resolve().then(async()=>{if(!live)return;setBusy(true);setError('');setChoices(null);try{const response=await api.request<Choices>(path+'?'+new URLSearchParams({page:String(page),search:filter}));if(live)setChoices(response.data??null);}catch(e){if(live)setError(e instanceof Error?e.message:'Sertifikat tanlovi yuklanmadi');}finally{if(live)setBusy(false);}});return()=>{live=false;};},[path,page,filter,revision]);
 const serialItems=sale.items.filter(item=>item.serialTracking),selected=choices?.rows.find(row=>row.id===giftId);
 const body={giftId,giftAmount,customerConsent:consent,reason,payments:/^[0.]+$/.test(cash)?[]:[{paymentType:'cash',amount:cash}],...(cashTendered?{cashTendered}:{}),...(serialItems.length?{serialSelections:serialItems.map(item=>({productId:item.productId,ids:serials[item.productId]??[]}))}:{})};
 const valid=!!selected&&consent&&reason.trim().length>=3&&/^\d+(?:\.\d{1,2})?$/.test(giftAmount)&&/^\d+(?:\.\d{1,2})?$/.test(cash)&&serialItems.every(item=>(serials[item.productId]??[]).length===Number(item.quantity));
 return <Card className="space-y-3"><h2 className="font-bold">Sertifikat bilan savdoni yakunlash</h2><p>Chek jami: {formatMoney(sale.totalAmount)}. Sertifikat va qolgan naqd summa jamiga teng bo‘lsin. To‘lov, stock va majburiyat bitta tranzaksiyada yoziladi; nasiya limiti oldindan to‘langan sertifikat uchun oshirilmaydi.</p>
  {error&&<p role="alert">{error}</p>}{busy&&<p role="status">Sertifikat tanlovi yuklanmoqda…</p>}
  <PendingActions prefix={path} returnPath={returnPath} revision={revision} onDone={result=>onChanged(result as Sale)}/>
  <form onSubmit={event=>{event.preventDefault();setFilter(search.trim());setPage(1);}}><Input label="Sarflash uchun sertifikat kodi qidiruvi" value={search} maxLength={200} onChange={e=>setSearch(e.target.value)}/><Button type="submit" disabled={posting}>Sertifikat kodini qidirish</Button></form>
  <DurableMutation path={path} returnPath={returnPath} body={body} label="Sertifikat bilan yakunlash" canSubmit={!busy&&!error&&!posting} canReview={valid} onSavingChange={setPosting} review={['Chek: '+sale.receiptNo,'Sertifikat: '+(selected?.code??''),'Sertifikat summasi: '+giftAmount+' UZS','Qolgan naqd: '+cash+' UZS',reason]} onDone={result=>onChanged(result as Sale)}>
   <Select label="Savdo uchun sertifikat" value={giftId} onChange={e=>setGiftId(e.target.value)} options={[{value:'',label:'Mijozning sertifikatini tanlang'},...(choices?.rows??[]).map(row=>({value:row.id,label:row.code+' · '+formatMoney(row.available)}))]}/>
   <Input label="Sertifikatdan sarflanadigan summa (UZS)" inputMode="decimal" value={giftAmount} onChange={e=>setGiftAmount(e.target.value)}/><Input label="Sertifikatdan keyin qolgan naqd (UZS)" inputMode="decimal" value={cash} onChange={e=>setCash(e.target.value)}/><Input label="Sertifikat savdosida berilgan naqd (UZS)" inputMode="decimal" value={cashTendered} onChange={e=>setCashTendered(e.target.value)}/>
   {serialItems.map(item=><SerialPicker key={item.productId} storeId={sale.storeId} productId={item.productId} label={item.productName+' sertifikat savdosi seriallari'} value={serials[item.productId]??[]} onChange={ids=>setSerials(previous=>({...previous,[item.productId]:ids}))}/>)}
   <Input label="Sertifikat checkout sababi" value={reason} onChange={e=>setReason(e.target.value)}/><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> Mijoz sertifikat orqali shu savdoni to‘lashga rozi</label>
  </DurableMutation>
  {!busy&&!error&&choices?.rows.length===0&&<p>Bu mijoz uchun faol va qoldiqli sertifikat topilmadi.</p>}
  <Button disabled={busy||posting||page<=1} onClick={()=>setPage(value=>value-1)}>Oldingi savdo sertifikatlari</Button><Button disabled={busy||posting||page*20>=(choices?.pagination.total??0)} onClick={()=>setPage(value=>value+1)}>Keyingi savdo sertifikatlari</Button><Button disabled={busy||posting} onClick={()=>setRevision(value=>value+1)}>Savdo sertifikatlarini yangilash</Button>
 </Card>;
}
