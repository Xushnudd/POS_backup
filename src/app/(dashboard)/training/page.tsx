'use client';

import {useTranslation} from '@/context/LocaleContext';

import {useState} from 'react';
import Link from 'next/link';
import {fixed,displayed,clientLine} from '@/lib/money';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {useAuth} from '@/context/AuthContext';
export default function Training(){
 const {organization,user}=useAuth();
 return <TrainingExercise key={`${organization?.id??'none'}:${user?.id??'none'}`}/>;
}
function TrainingExercise(){
 const {t:tr}=useTranslation();

 const [quantity,setQuantity]=useState(0),[tender,setTender]=useState('0'),[stage,setStage]=useState('basket'),[message,setMessage]=useState('');
 const total=clientLine(quantity,10000),valid=/^\d{1,10}(\.\d{1,2})?$/.test(tender),change=valid?fixed(tender)-fixed(total):BigInt(-1);
 return <div className="max-w-2xl space-y-4"><h1 className="text-2xl font-bold">{tr("Yangi kassir uchun mashq")}</h1><p role="note" className="p-4 bg-blue-50 text-blue-900">{tr("Bu alohida o‘quv mashqi. Misol mahsulot real katalogga kirmaydi; sale/payment/stock/fiscal yoki printer operatsiyasi yuborilmaydi.")}</p><ol className="list-decimal pl-6 space-y-2"><li>{tr("Ayni biznes, filial, kassa va o‘z smenangizni tekshiring.")}</li><li>{tr("Mahsulotni qidiring, miqdor va narxni tekshiring. F2 qidiruv, F9 to‘lov oynasi, Escape oynani yopadi.")}</li><li>{tr("To‘lov turi, mijoz va nasiya muddatini tanlang. Naqd berilgan summadan qaytim hisoblanadi.")}</li><li>{tr("Javob kelmasa asl natijani tekshiring. Yangi chek yaratmang. Print failure savdo failure degani emas.")}</li><li>{tr("Smenada pulni sanang; farq sababini yozing va rahbar tasdig‘ini kuting.")}</li></ol><h2 className="font-bold">{tr("Misol: mashq mahsuloti —10000 so‘m")}</h2><p>{tr("Miqdor:")}{' '}{quantity}{tr("; jami:")}{' '}{total} {tr("so‘m")}</p>{stage==='basket'&&<Button onClick={()=>setQuantity(q=>q+1)}>{tr("Mashq mahsulotini qo‘shish")}</Button>}{stage==='basket'&&<Button disabled={!quantity} onClick={()=>{setStage('payment');setMessage('');}}>{tr("Mashq to‘loviga o‘tish")}</Button>}{stage==='payment'&&<><Input label={tr("Mashqda berilgan naqd")} type="number" min="0" step="0.01" value={tender} onChange={e=>setTender(e.target.value)}/><p>{tr("Qaytim:")}{' '}{displayed(change>BigInt(0)?change:BigInt(0))} {tr("so‘m")}</p><Button disabled={!valid} onClick={()=>{if(change<BigInt(0)){setMessage('Berilgan pul yetmaydi; miqdorni tekshiring.');return;}setStage('complete');setMessage('Mashq yakunlandi; real savdo yaratilmagan. Chek qayta chiqarish yangi savdo bo‘lmasligi kerak.');}}>{tr("Faqat mashqni yakunlash")}</Button></>}{message&&<p role="status">{message}</p>}<Button variant="outline" onClick={()=>{setQuantity(0);setTender('0');setStage('basket');setMessage('');}}>{tr("Mashqni boshidan boshlash")}</Button><p><Link className="underline text-blue-800" href="/help">{tr("Tiklash qo‘llanmasi")}</Link> · <Link className="underline text-blue-800" href="/pos">{tr("Real kassaga o‘tish")}</Link></p></div>;
}
