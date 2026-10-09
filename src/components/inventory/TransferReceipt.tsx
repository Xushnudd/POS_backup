'use client';
import {useState} from 'react';
import type {StockTransferItem} from '@/types';
import {fixed} from '@/lib/money';
import DurableMutation from '@/components/forms/DurableMutation';
export function remainingTransfer(item:StockTransferItem){
 const value=fixed(item.quantity,6)-fixed(item.receivedQuantity??0,6)-fixed(item.returnedQuantity??0,6)-fixed(item.damagedQuantity??0,6)-fixed(item.shortageQuantity??0,6);
 const whole=value/BigInt(1000000),fraction=(value%BigInt(1000000)).toString().padStart(6,'0').replace(/0+$/,'');return whole.toString()+(fraction?'.'+fraction:'');
}
export default function TransferReceipt({id,items,onDone}:{id:string;items:StockTransferItem[];onDone:()=>void}){
 const [reason,setReason]=useState(''),[rows,setRows]=useState(()=>items.filter(item=>fixed(remainingTransfer(item),6)>BigInt(0)).map(item=>({itemId:item.id!,quantity:remainingTransfer(item),damagedQuantity:'0',shortageQuantity:'0'})));
 const selected=rows.filter(row=>![row.quantity,row.damagedQuantity,row.shortageQuantity].every(value=>/^0+(?:\.0+)?$/.test(value)));
 return <DurableMutation path={'/transfers/'+id+'/receive'} returnPath="/inventory/transfers" body={{items:selected,...(reason.trim()?{reason:reason.trim()}:{})}} label="Transfer qabulini qayd etish" review={['Transfer: '+id,...selected.map(row=>`${items.find(item=>item.id===row.itemId)?.product?.name??row.itemId}: soz ${row.quantity}, brak ${row.damagedQuantity}, kamomad ${row.shortageQuantity}`),'Sabab: '+reason]} onDone={onDone}>
 <p>Faqat yetib kelgan soz mahsulot sotiladigan qoldiqqa kiradi. Brak alohida saqlanadi. Kamomadni sanash va manager tasdig‘idan keyin yozing; qolgan miqdor yo‘lda qoladi.</p>
 {rows.map((row,index)=>{const item=items.find(item=>item.id===row.itemId)!;return <fieldset key={row.itemId} className="border p-3 space-y-2"><legend>{item.product?.name??item.productId}; yo‘lda: {remainingTransfer(item)}</legend>{(['quantity','damagedQuantity','shortageQuantity'] as const).map((key,i)=><label key={key} className="block">{['Soz qabul','Brak qabul','Tasdiqlangan kamomad'][i]}<input aria-label={(item.product?.name??item.productId)+' '+['soz qabul','brak qabul','kamomad'][i]} inputMode="decimal" value={row[key]} onChange={event=>setRows(previous=>previous.map((value,n)=>n===index?{...value,[key]:event.target.value}:value))} className="block border p-2 rounded"/></label>)}</fieldset>})}
 <label>Brak/kamomad sababi<textarea aria-label="Brak/kamomad sababi" maxLength={2000} value={reason} onChange={event=>setReason(event.target.value)} className="block border p-2 rounded w-full"/></label>
 </DurableMutation>;
}
