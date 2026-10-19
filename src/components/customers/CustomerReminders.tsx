'use client';
import {useEffect,useState} from 'react';
import Image from 'next/image';
import {api} from '@/lib/api';
import {useTranslation} from '@/context/LocaleContext';
import {errorMessage} from '@/i18n/errors';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import DurableMutation from '@/components/forms/DurableMutation';
type Data={rows:{id:string;state:string;lastError:string|null;expiresAt:string;available:boolean;url:string|null;qrDataUrl:string|null}[];totalPages:number;consentEventId:string|null};
export default function CustomerReminders({customerId}:{customerId:string}){
 const {t:tr,message}=useTranslation(),path='/customers/'+customerId+'/reminders',returnPath='/customers/'+customerId;
 const [data,setData]=useState<Data|null>(null),[version,setVersion]=useState(0),[page,setPage]=useState(1),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const refresh=()=>setVersion(value=>value+1);
 useEffect(()=>{let live=true;void Promise.resolve().then(()=>{if(live)setBusy(true);return api.request<Data>(path+'?page='+page);}).then(result=>{if(live){setData(result.data??null);setError('');}}).catch(cause=>{if(live){setData(null);setError(errorMessage(cause));}}).finally(()=>{if(live)setBusy(false);});return()=>{live=false;};},[path,page,version]);
 return <Card title={tr('Shaxsan xizmat eslatmalari')}>
  <p>{tr('Bu SMS yoki e-mail jo‘natish emas. Worker ko‘chirmani tayyorlaydi; havolani mijozga shaxsan bering.')}</p>
  <p>{tr('Rozilikni bekor qilish yoki mijoz kartasini o‘zgartirish eski havolalarni to‘xtatadi.')}</p>
  {error&&<p role="alert">{message(error)}</p>}
  <Button disabled={busy} onClick={refresh}>{tr('Yangilash')}</Button>
  {!busy&&!data?.consentEventId&&<p>{tr('Avval xizmat eslatmasi uchun shaxsan kanalga rozilik qayd eting va yangilang.')}</p>}
  <DurableMutation path={path} returnPath={returnPath} body={{consentEventId:data?.consentEventId??''}} canSubmit={!busy&&!error&&!!data?.consentEventId} onRejected={refresh} label={tr('Ko‘chirmani tayyorlash navbatiga qo‘yish')} review={[tr('Shaxsan xizmat eslatmalari'),tr('Bu SMS yoki e-mail jo‘natish emas. Worker ko‘chirmani tayyorlaydi; havolani mijozga shaxsan bering.')]} onDone={()=>{setPage(1);refresh();}}/>
  {!busy&&data?.rows.map(row=><article key={row.id} className="border p-3 my-2">
   <p>{row.state} {row.lastError}</p><p>{tr('Muddati:')}{' '}{row.expiresAt}</p>
   {row.available&&row.url&&row.qrDataUrl?<><Image unoptimized src={row.qrDataUrl} alt={tr('Ko‘chirma QR kodi')} width={180} height={180}/><a className="block" href={row.url} target="_blank" rel="noreferrer">{tr('Ko‘chirmani ochish')}</a><Button variant="outline" onClick={()=>{void navigator.clipboard.writeText(row.url!).catch(()=>setError('Havola nusxalanmadi'));}}>{tr('Havolani nusxalash')}</Button></>:row.state==='succeeded'?<p>{tr('Havola faol emas.')}</p>:<p>{tr('Navbat holatini yangilang. Haqiqiy yetkazish tasdiqlanmagan.')}</p>}
  </article>)}
  <Pagination page={page} pages={data?.totalPages??0} busy={busy} onPage={setPage} retry={refresh}/>
 </Card>;
}
