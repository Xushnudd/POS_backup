'use client';
import {localizeOwnedLabels} from '@/i18n/messages';

import {useTranslation} from '@/context/LocaleContext';

import { useEffect, useState } from 'react';
import type { Shift } from '@/types';
import { api } from '@/lib/api';

import Card from '@/components/ui/Card';
const labels:Record<string,string>={saleReceipts:'Naqd savdo',debtCollections:'Naqd qarz undirish',refunds:'Naqd refund',manualIn:'Boshqa naqd to‘lov kirimi',manualOut:'Boshqa naqd to‘lov chiqimi',cashIn:'Naqd kirim',cashOut:'Naqd chiqim',bankDeposits:'Bankka topshirish',collections:'Inkassatsiya',correctionIn:'Smena tuzatishi kirimi',correctionOut:'Smena tuzatishi chiqimi',expectedCash:'Boshlang‘ich + sof naqd = kutilgan pul'};
const labelsSource=labels;
export default function ShiftCashSummary({shifts,activeShift}:{shifts:Shift[];activeShift?:Shift}){
 const {formatMoney}=useTranslation();

 const {locale:mapLocale}=useTranslation();

 const labels=localizeOwnedLabels(labelsSource,mapLocale);

 const {t:tr}=useTranslation();

 const [selected,setSelected]=useState(''),[summary,setSummary]=useState<Record<string,string>>(),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const id=selected||activeShift?.id;
 useEffect(()=>{
  let cancelled=false;
  void Promise.resolve().then(async()=>{
   setSummary(undefined);setError('');if(!id)return;setBusy(true);
   try{const result=await api.shifts.get(id);if(!cancelled)setSummary(result.data?.cashSummary);}
   catch(err){if(!cancelled)setError(err instanceof Error?err.message:'Pul manbalari yuklanmadi');}
   finally{if(!cancelled)setBusy(false);}
  });
  return()=>{cancelled=true;};
 },[id,activeShift]);
 return <Card title={tr("Kassa pul manbalari")}><label>{tr("Smena")}<select aria-label={tr("Pul manbalari smenasi")} value={selected} onChange={e=>setSelected(e.target.value)} className="block border p-2"><option value="">{tr("Faol smena")}</option>{shifts.map(s=><option key={s.id} value={s.id}>{s.register?.name} · {s.status} · {s.id.slice(0,8)}</option>)}</select></label>{busy?<p>{tr("Yuklanmoqda...")}</p>:error?<p role="alert">{error}</p>:summary?<dl className="grid grid-cols-2 gap-2 mt-3">{Object.entries(labels).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{formatMoney(summary[key]??'0')}</dd></div>)}</dl>:<p>{tr("Smena tanlang.")}</p>}<p className="text-xs mt-3">{tr("Bankka topshirish va inkassatsiya naqd chiqimdir; bu yerda tashqi bank o‘tkazmasi tasdiqlangani da’vo qilinmaydi.")}</p></Card>;
}
