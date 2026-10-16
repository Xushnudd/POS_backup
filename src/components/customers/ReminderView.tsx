'use client';
import {useEffect,useRef,useState} from 'react';
import type {ReminderSnapshot} from '@/server/customers/reminders';
import {useTranslation} from '@/context/LocaleContext';
export default function ReminderView(){
 const {t:tr}=useTranslation(),fragment=useRef<string|null>(null);
 const [data,setData]=useState<ReminderSnapshot|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{let live=true;const value=fragment.current??location.hash.slice(1);fragment.current=value;const [organizationId,jobId,capability,...extra]=value.split('.');
  if(extra.length||!organizationId||!jobId||!capability){void Promise.resolve().then(()=>{if(live)setFailed(true);});return()=>{live=false;};}
  fetch('/api/reminder-view',{method:'POST',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:{'content-type':'application/json'},body:JSON.stringify({organizationId,jobId,capability})}).then(async response=>{if(!response.ok)throw new Error('DOCUMENT_UNAVAILABLE');const result=await response.json();if(live)setData(result.data);}).catch(()=>{if(live)setFailed(true);});return()=>{live=false;};
 },[]);
 if(failed)return <main className="p-8"><h1>{tr('Ko‘chirma mavjud emas yoki ruxsat bekor qilingan.')}</h1></main>;
 if(!data)return <main className="p-8" role="status">{tr('Yuklanmoqda...')}</main>;
 return <main className="max-w-4xl mx-auto p-6"><button className="print:hidden" onClick={()=>window.print()}>{tr('Chop etish / PDF')}</button><h1>{tr('Mijoz qarz ko‘chirmasi')}</h1><h2>{data.organizationName}</h2><p>{data.customerName}</p><p>{data.asOf} · {data.timezone}</p><p>{tr('Joriy qarz')}: {data.debtTotal} {data.currency}</p><p>{tr('Muddati o‘tgan qarz')}: {data.overdue}</p><p>{tr('Muddati kelmagan qarz')}: {data.upcoming}</p><p>{tr('Muddatsiz qarz')}: {data.noDueDate}</p><p>{tr('Taqsimlanmagan qarz')}: {data.unallocated}</p>{data.requiresReconciliation&&<p role="alert">{tr('Qarz taqsimotini solishtirish kerak.')}</p>}
  <table className="w-full"><thead><tr><th>{tr('Sana')}</th><th>{tr('Hujjat')}</th><th>{tr('Summa')}</th><th>{tr('Qoldiq')}</th><th>{tr('Muddat')}</th></tr></thead><tbody>{data.entries.map((entry,index)=><tr key={index}><td>{entry.date}</td><td>{entry.receiptNo??entry.sourceType}</td><td>{entry.amount}</td><td>{entry.balance}</td><td>{entry.dueAt}</td></tr>)}</tbody></table>
 </main>;
}
