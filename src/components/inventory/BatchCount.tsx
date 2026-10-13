'use client';
import {useEffect,useState} from 'react';
import {api} from '@/lib/api';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import DurableMutation from '@/components/forms/DurableMutation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
type Snapshot={productId:string;productName:string;unit:string;unitCost:string;expectedHash:string;rows:{id:string;code:string;quantity:string;receivedOn:string;expiresOn:string}[]};
export default function BatchCount({productId,storeId,onDone}:{productId:string;storeId:string;onDone:()=>void}){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[quantities,setQuantities]=useState<Record<string,string>>({}),[reason,setReason]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(true),[posting,setPosting]=useState(false),[revision,setRevision]=useState(0);
 const dirty=Boolean(reason||Object.values(quantities).some(Boolean)),discard=useUnsavedChanges(dirty,posting);
 useEffect(()=>{
  let live=true;const controller=new AbortController();
  void(async()=>{setBusy(true);setError('');try{const response=await api.request<Snapshot>('/inventory/batches/count/'+productId+'?'+new URLSearchParams({storeId}),{cache:'no-store',signal:controller.signal});if(!response.data)throw Error('Sanash manbasi kelmadi');if(live)setSnapshot(previous=>previous??response.data!)}catch(error){if(live)setError(error instanceof Error?error.message:'Sanash manbasi yuklanmadi')}finally{if(live)setBusy(false)}})();return()=>{live=false;controller.abort()};
 },[storeId,productId,revision]);
 const body={storeId,expectedHash:snapshot?.expectedHash,reason:reason.trim(),counts:snapshot?.rows.map(row=>({batchId:row.id,quantity:quantities[row.id]??''}))??[]};
 const completed=()=>{setQuantities({});setReason('');setSnapshot(null);setBusy(true);setRevision(value=>value+1);onDone()};
 return <section aria-label="Partiya bo‘yicha sanash"><h2>Partiya bo‘yicha sanash: {snapshot?.productName??''}</h2><p>Haqiqiy sanalgan miqdorlarni har bir ma’lum partiya uchun kiriting. Qoldiq yoki tannarx o‘zgarsa, eski review bilan tuzatish rad etiladi.</p>{error&&<p role="alert">{error}. Qoralama saqlandi.</p>}
 <DurableMutation path={'/inventory/batches/count/'+productId} returnPath="/inventory/batches" label="Partiya sanashini tasdiqlash" body={body} review={['Mahsulot: '+(snapshot?.productName??''),'Joriy birlik tannarxi: '+(snapshot?.unitCost??''),'Sabab: '+reason,...(snapshot?.rows.map(row=>row.code+': '+row.quantity+' → '+(quantities[row.id]??'—')+' '+snapshot.unit)??[])]} canSubmit={!busy&&!error&&Boolean(snapshot)} allowNew={Boolean(snapshot?.rows.length&&snapshot.rows.every(row=>/^\d+(?:\.\d{1,6})?$/.test(quantities[row.id]??''))&&reason.trim().length>=3)} onSavingChange={setPosting} onDone={(_result,original)=>{if(JSON.stringify(original)===JSON.stringify(body))completed();else onDone()}}>
 {snapshot?.rows.map(row=><div key={row.id}><p>{row.code}: qoldiq {row.quantity}; yaroqlilik {row.expiresOn}</p><Input label={'Sanalgan partiya '+row.code} inputMode="decimal" value={quantities[row.id]??''} onChange={event=>setQuantities(previous=>({...previous,[row.id]:event.target.value}))}/></div>)}<Input label="Partiya sanash sababi" value={reason} onChange={event=>setReason(event.target.value)}/>
 </DurableMutation><Button disabled={busy||posting} onClick={()=>{setBusy(true);setRevision(value=>value+1)}}>Sanash manbasini qayta tekshirish</Button><Button variant="outline" disabled={posting} onClick={()=>{if(discard()){setSnapshot(null);setQuantities({});setReason('');setBusy(true);setRevision(value=>value+1)}}}>Qoralamani bekor qilib yangi qoldiqni olish</Button>
 </section>
}
