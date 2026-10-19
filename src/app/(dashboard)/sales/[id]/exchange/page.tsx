'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import SerialPicker from '@/components/inventory/SerialPicker';
import BatchRestorePicker,{type BatchChoice} from '@/components/inventory/BatchRestorePicker';
import {useEffect,useRef,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {useAuth} from '@/context/AuthContext';
import {useOrganization} from '@/context/OrganizationContext';
import {api} from '@/lib/api';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import DurableMutation from '@/components/forms/DurableMutation';
import PendingActions from '@/components/forms/PendingActions';
type Sale={id:string;storeId:string;receiptNo:string;customerId:string|null;items:{id:string;productId:string;serialTracking?:boolean;batchTracking?:boolean;productName:string;quantity:string}[]};
type Quote={confirmationHash:string;refundAmount:string;replacementTotal:string;cashDifference:string;debtDifference:string};
type Exchange={id:string;replacementSaleId:string;saleReturnId:string;cashDifference:string;debtDifference:string};
export default function ExchangePage(){
 const {t:tr}=useTranslation();
const {id}=useParams<{id:string}>(),{organization,user,role}=useAuth(),{activeShift}=useOrganization();return role!=='cashier'&&organization&&user?<Editor key={[organization.id,user.id,role,id,activeShift?.id].join(':')} organizationId={organization.id} saleId={id} shiftId={activeShift?.id}/>:<p>{tr("Almashtirish uchun rahbar hisobida kiring.")}</p>;}
function Editor({organizationId,saleId,shiftId}:{organizationId:string;saleId:string;shiftId?:string}){
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

 const [sale,setSale]=useState<Sale|null>(null),[history,setHistory]=useState<Exchange[]>([]),[qty,setQty]=useState<Record<string,string>>({}),[reason,setReason]=useState(''),[search,setSearch]=useState(''),[products,setProducts]=useState<{id:string;name:string;sku:string;serialTracking?:boolean}[]>([]),[productId,setProductId]=useState(''),[newQty,setNewQty]=useState('1'),[credit,setCredit]=useState('0'),[tender,setTender]=useState('0'),[quote,setQuote]=useState<Quote|null>(null),[body,setBody]=useState<Record<string,unknown>|null>(null),[error,setError]=useState(''),[readError,setReadError]=useState(''),[catalogError,setCatalogError]=useState(''),[busy,setBusy]=useState(false),[posting,setPosting]=useState(false),[loading,setLoading]=useState(true),[catalogLoading,setCatalogLoading]=useState(true),[message,setMessage]=useState(''),[revision,setRevision]=useState(0),[catalogRevision,setCatalogRevision]=useState(0);
 const [serialChoices,setSerialChoices]=useState<Record<string,string[]>>({}),[replacementSerials,setReplacementSerials]=useState<string[]>([]);
 const [batchChoices,setBatchChoices]=useState<Record<string,BatchChoice[]>>({}),[batchReady,setBatchReady]=useState<Record<string,boolean>>({});
 const live=useRef(true),flight=useRef(false),returnPath='/sales/'+saleId+'/exchange';
 const dirty=Boolean(Object.values(batchChoices).some(rows=>rows.length)||reason||productId||quote||newQty!=='1'||credit!=='0'||tender!=='0'||Object.values(qty).some(value=>value!==''&&!/^0+(\.0+)?$/.test(value)));
 useUnsavedChanges(dirty,busy||posting);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const refresh=()=>setRevision(value=>value+1);
 useEffect(()=>{let current=true;void Promise.resolve().then(async()=>{if(!current)return;setLoading(true);setReadError('');try{const [original,exchanges]=await Promise.all([api.request<Sale>('/sales/'+saleId),api.request<Exchange[]>('/exchanges?saleId='+saleId)]);if(current){setSale(original.data??null);setHistory(exchanges.data??[]);}}catch(cause){if(current)setReadError(displayErrorMessage(cause,'Original savdo yuklanmadi'));}finally{if(current)setLoading(false);}});return()=>{current=false;};},[saleId,revision]);
 useEffect(()=>{let current=true;const timer=setTimeout(()=>{if(!current)return;setCatalogLoading(true);setCatalogError('');void api.request<typeof products>('/products?organizationId='+organizationId+'&limit=20&search='+encodeURIComponent(search)).then(result=>{if(current)setProducts(result.data??[]);}).catch(cause=>{if(current)setCatalogError(displayErrorMessage(cause,'Mahsulotlar yuklanmadi'));}).finally(()=>{if(current)setCatalogLoading(false);});},250);return()=>{current=false;clearTimeout(timer);};},[search,organizationId,catalogRevision]);
 const invalidate=()=>{setQuote(null);setBody(null);setMessage('');};
 const validQuantities=()=>Boolean(sale)&&sale!.items.every(item=>/^\d+(\.\d{1,6})?$/.test(qty[item.id]||'0'));
 function command(){return {originalSaleId:saleId,shiftId,reason,items:sale!.items.filter(item=>/[1-9]/.test(qty[item.id]||'0')).map(item=>({saleItemId:item.id,quantity:qty[item.id],disposition:'sellable',...(item.serialTracking?{serialIds:serialChoices[item.id]??[]}:{}),...(batchChoices[item.id]?.length?{batchSelection:batchChoices[item.id].map(row=>({...row,quantity:row.quantity.trim().replace(/^\./,'0.').replace(/\.$/,'')}))}:{})})),replacement:{customerId:sale!.customerId,discountAmount:0,items:[{productId,quantity:newQty,discountAmount:0}]},creditAmount:credit,...(products.find(p=>p.id===productId)?.serialTracking?{serialSelections:[{productId,ids:replacementSerials}]}:{})};}
 async function preview(){
  if(flight.current||posting||!sale||loading||catalogLoading||readError||catalogError||sale.items.some(item=>item.batchTracking&&/[1-9]/.test(qty[item.id]??'0')&&!batchReady[item.id]))return;
  if(!validQuantities()){setError('Qaytarish miqdorini manfiy bo‘lmagan, ko‘pi bilan 6 kasrli son bilan kiriting. Noto‘g‘ri qator tashlab ketilmaydi.');return;}
  flight.current=true;setBusy(true);setError('');invalidate();
  try{const original=command(),result=await api.request<Quote>('/exchanges/preview',{method:'POST',body:JSON.stringify(original)});if(!result.data?.confirmationHash)throw new Error('Server almashtirish hisobini tasdiqlamadi');if(live.current){setQuote(result.data);setBody(original);}}
  catch(cause){if(live.current)setError(displayErrorMessage(cause,'Almashtirish hisobi olinmadi'));}
  finally{flight.current=false;if(live.current)setBusy(false);}
 }
 function posted(_result?:unknown,original?:Record<string,unknown>){
  const {confirmationHash:ignored,cashTendered,...originalCommand}=original??{};void ignored;
  const matches=validQuantities()&&JSON.stringify(command())===JSON.stringify(originalCommand)&&tender===cashTendered;
  if(matches){setBatchChoices({});setBatchReady({});setQty({});setReason('');setProductId('');setNewQty('1');setCredit('0');setTender('0');setQuote(null);setBody(null);}
  setMessage(matches?'Almashtirish serverda saqlandi.':'Original almashtirish serverda saqlandi. Joriy mustaqil draft saqlanadi.');refresh();
 }
 return <div className="space-y-4"><h1>{tr("Tovar almashtirish")}</h1><Link href={'/sales/'+saleId}>{tr("Original savdoga qaytish")}</Link>
  <p>{tr("Original qaytarish va yangi savdo birga qayd etiladi. Yangi savdo rad etilsa ikkala hujjat ham yozilmaydi. Musbat naqd farq mijozdan olinadi, manfiy farq mijozga qaytariladi. Nasiya farqi original mijoz kartasida qoladi.")}</p>
  {error&&<p role="alert">{uiMessage(error)}</p>}{readError&&<p role="alert">{uiMessage(readError)} {tr("Draft va oxirgi yuklangan tarix saqlanadi.")}</p>}{catalogError&&<p role="alert">{uiMessage(catalogError)}</p>}
  {loading&&<p role="status">{tr("Original savdo va almashtirish tarixi yuklanmoqda…")}</p>}{catalogLoading&&<p role="status">{tr("Yangi mahsulotlar yuklanmoqda…")}</p>}{busy&&<p role="status">{tr("Almashtirish farqi serverda hisoblanmoqda…")}</p>}{!busy&&!posting&&dirty&&<p role="status">{tr("Saqlanmagan almashtirish drafti bor.")}</p>}{message&&<p role="status">{uiMessage(message)}</p>}
  <Button disabled={loading||busy||posting} onClick={refresh}>{tr("Original savdoni qayta tekshirish")}</Button><Button disabled={catalogLoading||busy||posting} onClick={()=>setCatalogRevision(value=>value+1)}>{tr("Almashtirish mahsulotlarini qayta tekshirish")}</Button>
  <PendingActions prefix="/exchanges" returnPath={returnPath} revision={revision} onDone={()=>{setMessage('Saqlangan original amal serverda tasdiqlandi. Joriy draft o‘zgartirilmadi.');refresh();}}/>
  {!shiftId&&<p role="alert">{tr("Original filialda ochiq smena tanlang.")}</p>}
  {sale&&<><h2>{tr("Original chek:")}{' '}{sale.receiptNo}</h2><fieldset disabled={busy||posting} className="space-y-3">
   {sale.items.map(item=><div key={item.id}><Input label={tr("Qaytarish miqdori:")+" "+item.productName} value={qty[item.id]??'0'} onChange={event=>{invalidate();setQty(current=>({...current,[item.id]:event.target.value}));}}/>{item.serialTracking&&<SerialPicker storeId={sale.storeId} productId={item.productId} state="sold" saleItemId={item.id} label={item.productName+" "+tr("almashtiriladigan seriallar")} value={serialChoices[item.id]??[]} onChange={ids=>{invalidate();setSerialChoices(previous=>({...previous,[item.id]:ids}))}}/>}{item.batchTracking&&<BatchRestorePicker kind="sale" sourceId={saleId} productId={item.productId} label={item.productName+" "+tr("almashtirish partiyalari")} value={batchChoices[item.id]??[]} onChange={rows=>{invalidate();setBatchChoices(previous=>({...previous,[item.id]:rows}))}} onReady={ready=>setBatchReady(previous=>previous[item.id]===ready?previous:{...previous,[item.id]:ready})}/>}</div>)}
   {products.find(p=>p.id===productId)?.serialTracking&&<SerialPicker key={productId} storeId={sale.storeId} productId={productId} label={tr("Yangi mahsulot seriallari")} value={replacementSerials} onChange={ids=>{invalidate();setReplacementSerials(ids)}}/>}
   <Input label={tr("Almashtirish sababi")} value={reason} onChange={event=>{invalidate();setReason(event.target.value);}}/>
   <Input label={tr("Yangi mahsulot qidirish")} value={search} onChange={event=>setSearch(event.target.value)}/>
   <Select label={tr("Almashtirishdagi yangi mahsulot")} value={productId} placeholder={tr("Mahsulot tanlang")} options={[...(productId&&!products.some(product=>product.id===productId)?[{value:productId,label:tr("Tanlangan mahsulot ·")+" "+productId}]:[]),...products.map(product=>({value:product.id,label:product.name+' · '+product.sku}))]} onChange={event=>{invalidate();setProductId(event.target.value);}}/>
   <Input label={tr("Yangi mahsulot miqdori")} value={newQty} onChange={event=>{invalidate();setNewQty(event.target.value);}}/>
   <Input label={tr("Yangi savdoning nasiya qismi")} value={credit} onChange={event=>{invalidate();setCredit(event.target.value);}}/>
  </fieldset><Button disabled={busy||posting||loading||catalogLoading||Boolean(readError||catalogError)||!shiftId||!productId||reason.trim().length<3} onClick={()=>void preview()}>{tr("Almashtirish farqini hisoblash")}</Button>
  {quote&&body&&<><p role="status">{tr("Qaytarish:")}{' '}{quote.refundAmount}{tr("; yangi savdo:")}{' '}{quote.replacementTotal}{tr("; naqd farq:")}{' '}{quote.cashDifference}{tr("; nasiya farqi:")}{' '}{quote.debtDifference}</p>
   <p>{tr("Naqd farq nol yoki manfiy bo‘lsa berilgan pul0. Yangi savdoning to‘liq summasini mijoz bergan deb yozmaymiz; actual farq va qaytim almashtirish hujjatida.")}</p>
   <DurableMutation path="/exchanges" returnPath={returnPath} canSubmit={!busy&&!loading&&!readError&&!catalogError} body={{...body,confirmationHash:quote.confirmationHash,cashTendered:tender}} label={tr("Almashtirishni qayd etish")} review={[sale.receiptNo,tr("Qaytarish")+" "+quote.refundAmount,tr("Yangi savdo")+" "+quote.replacementTotal,tr("Naqd farq")+" "+quote.cashDifference,tr("Nasiya farqi")+" "+quote.debtDifference,tr("Haqiqiy tender")+" "+tender,reason]} onSavingChange={setPosting} onDone={posted}>
    <Input label={tr("Farq uchun mijoz bergan haqiqiy naqd pul")} value={tender} onChange={event=>setTender(event.target.value)}/>
   </DurableMutation>
  </>}</>}
  <h2>{tr("Almashtirish tarixi")}</h2>{!loading&&!readError&&history.length===0?<p>{tr("Almashtirish yozuvi yo‘q.")}</p>:history.map(exchange=><article key={exchange.id}><p>{tr("Naqd farq")}{' '}{exchange.cashDifference}{tr("; nasiya farqi")}{' '}{exchange.debtDifference}</p><Link href={'/sales/'+exchange.replacementSaleId}>{tr("Bog‘langan yangi savdoni ochish")}</Link></article>)}
 </div>;
}
