'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {api,type SecurityEventType,type SecurityEventRow,type SecurityHistoryData,type SecurityNoticeRow} from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Pagination from '@/components/ui/Pagination';

const eventLabels:Record<SecurityEventType,string>={
  session_created:'Sessiya ochildi',session_revoked:'Sessiya bekor qilindi',
  login_succeeded:'Kirish muvaffaqiyatli',login_failed:'Kirish urinishi rad etildi',
  password_changed:'Parol almashtirildi',cashier_pin_changed:'Kassir PIN sozlamasi o‘zgardi',
  member_updated:'Xodim vakolatlari o‘zgardi',ownership_transferred:'Biznes egaligi topshirildi',
};
const deliveryLabels:Record<string,string>={pending:'Navbatda',queued:'Navbatda',delivered:'Hisobingizga yetkazildi',dead:'Yetkazishda xato',cancelled:'Bekor qilindi',skipped:'Yetkazilmadi (hisob yoki muddat)'};
const errorMessage=(error:unknown)=>error instanceof Error?error.message:'Xavfsizlik ma’lumotlari yuklanmadi';

export default function SecurityHistory(){
  const {user,organization}=useAuth();
  return user?<AccountHistory key={user.id} timezone={organization?.timezone}/>:null;
}

function AccountHistory({timezone}:{timezone?:string}){
  const [data,setData]=useState<SecurityHistoryData|null>(null);
  const [page,setPage]=useState(1),[pages,setPages]=useState(0),[revision,setRevision]=useState(0);
  const [busy,setBusy]=useState(true),[reading,setReading]=useState(''),[error,setError]=useState('');
  const [readError,setReadError]=useState(''),[message,setMessage]=useState('');
  const [retrying,setRetrying]=useState(''),[retryError,setRetryError]=useState(''),[retryMessage,setRetryMessage]=useState('');
  const live=useRef(true),sequence=useRef(0),operationIds=useRef(new Map<string,string>());
  const retryIds=useRef(new Map<string,{operationId:string;maxAttempts:number|null;resolved:boolean}>());

  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  const refresh=useCallback(async()=>{
    const request=++sequence.current;
    setBusy(true);setError('');
    try{
      const response=await api.security.list(page);
      if(!response.data)throw new Error('Xavfsizlik ma’lumotlari yuklanmadi');
      if(live.current&&request===sequence.current){
        setData(response.data);setPages(response.pagination?.totalPages??0);
      }
      return response.data;
    }catch(error){
      if(live.current&&request===sequence.current)setError(errorMessage(error));
      throw error;
    }finally{
      if(live.current&&request===sequence.current)setBusy(false);
    }
  },[page]);
  useEffect(()=>{
    let cancelled=false;
    void Promise.resolve().then(()=>{if(!cancelled&&live.current)return refresh();}).catch(()=>undefined);
    return()=>{cancelled=true;};
  },[refresh,revision]);

  const acknowledge=async(notice:SecurityNoticeRow)=>{
    if(reading||retrying||notice.readAt)return;
    const operationId=operationIds.current.get(notice.id)??crypto.randomUUID();
    operationIds.current.set(notice.id,operationId);
    setReading(notice.id);setReadError('');setMessage('');
    let confirmed=false;
    try{
      const response=await api.security.read(notice.id,operationId);
      if(response.data?.id!==notice.id||!response.data.readAt)throw new Error('O‘qilganlik natijasi tasdiqlanmadi');
      confirmed=true;
    }catch(error){
      if(!live.current)return;
      // The write may have committed despite a lost acknowledgement.
      try{
        const latest=await refresh();
        confirmed=!!latest.notices.find(row=>row.id===notice.id)?.readAt;
      }catch{/* Preserve the original operation ID and show an explicit error. */}
      if(!confirmed&&live.current)setReadError(errorMessage(error)+' Natijani tekshirish uchun qayta yuklang yoki shu bildirishnomani yana belgilang.');
    }
    if(confirmed&&live.current){
      setMessage('Bildirishnoma o‘qildi deb belgilandi.');
      window.dispatchEvent(new Event('pos-security-notices'));
      try{await refresh();}catch{/* The existing fetch error keeps the stale list explicit. */}
    }
    if(live.current)setReading('');
  };

  const retryDelivery=async(event:SecurityEventRow)=>{
    if(reading||retrying||!event.canRetry||event.deliveryState!=='dead')return;
    let intent=retryIds.current.get(event.id);
    // An unresolved acknowledgement always keeps its original key. A later,
    // separately exhausted batch needs the user's new explicit confirmation.
    if(!intent||(intent.resolved&&intent.maxAttempts!==event.deliveryMaxAttempts)){
      intent={operationId:crypto.randomUUID(),maxAttempts:event.deliveryMaxAttempts,resolved:false};
      retryIds.current.set(event.id,intent);
    }
    setRetrying(event.id);setRetryError('');setRetryMessage('');
    let resolved=false;
    try{
      const response=await api.security.retry(event.id,intent.operationId);
      if(response.data?.eventId!==event.id||!['pending','delivered'].includes(response.data.state))throw new Error('Qayta yetkazish natijasi tasdiqlanmadi');
      resolved=true;
    }catch(error){
      if(!live.current)return;
      try{
        const latest=await refresh(),current=latest.events.find(row=>row.id===event.id);
        // A pending/delivered source is authoritative, but does not establish
        // which concurrent operation queued it. Do not submit a second queue.
        resolved=current?.deliveryState==='pending'||current?.deliveryState==='delivered';
      }catch{/* Keep the original confirmation key for an unresolved result. */}
      if(!resolved&&live.current)setRetryError(errorMessage(error)+' Natijani tekshirish uchun qayta yuklang yoki shu bildirishnomani yana tasdiqlang.');
    }
    if(resolved&&live.current){
      intent.resolved=true;
      setRetryMessage('Bildirishnomaning yangilangan holati tarixda ko‘rsatiladi.');
      window.dispatchEvent(new Event('pos-security-notices'));
      try{await refresh();}catch{/* The fetch error explicitly identifies stale data. */}
    }
    if(live.current)setRetrying('');
  };

  const date=(value:string)=>{
    const parsed=new Date(value);
    if(!Number.isFinite(parsed.getTime()))return 'Sana mavjud emas';
    try{return parsed.toLocaleString('uz-UZ',{timeZone:timezone});}
    catch{return parsed.toISOString();}
  };

  return <section className="space-y-4" aria-label="Hisob xavfsizligi tarixi">
    <Card title="Xavfsizlik bildirishnomalari">
      <p className="mb-3 text-sm text-gray-600">Bir safar ko‘pi bilan 20 bildirishnoma ko‘rsatiladi. Avval o‘qilmaganlari chiqadi; o‘qilgan deb belgilagach keyingilari yuklanadi. O‘qilmaganlar soni barcha 90 kunlik tarixni hisoblaydi. Yangi brauzer belgisi yoki takroriy muvaffaqiyatsiz kirish xavfsizlikni tekshirish uchun sabab bo‘ladi; bu hisob buzilganini tasdiqlamaydi. Tanish bo‘lmagan kirishda yuqoridagi faol sessiyalarni tekshiring va parolni almashtiring.</p>
      {error&&<div role="alert" className="mb-3 text-sm text-red-700">{error} {data&&'Quyida oxirgi muvaffaqiyatli yuklangan ma’lumotlar ko‘rsatilgan.'} <Button size="sm" disabled={busy||!!reading||!!retrying} onClick={()=>setRevision(value=>value+1)}>Xavfsizlikni qayta yuklash</Button></div>}
      {readError&&<p role="alert" className="mb-3 text-sm text-red-700">{readError}</p>}
      {message&&<p role="status" className="mb-3 text-sm text-emerald-700">{message}</p>}
      {busy&&<p role="status">Xavfsizlik ma’lumotlari yuklanmoqda...</p>}
      {data&&<>
        <p className="mb-3 text-sm font-medium">O‘qilmagan: {data.unread}</p>
        {data.notices.length===0?<p className="text-sm text-gray-600">Bildirishnomalar yo‘q.</p>:data.notices.map(notice=><article key={notice.id} className="space-y-2 border-t border-gray-100 py-3">
          <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{notice.type==='login_failed'?'Takroriy muvaffaqiyatsiz kirish':'Yangi brauzerdan kirish'}</p><Badge variant={notice.readAt?'neutral':'warning'} size="sm">{notice.readAt?'O‘qilgan':'O‘qilmagan'}</Badge></div>
          <p className="text-sm">{notice.type==='login_failed'?'Hisobingizga kirishga bir necha marta muvaffaqiyatsiz urinildi. Bu sizning urinishlaringiz bo‘lmasa, faol sessiyalarni tekshiring.':'Hisobingizga avval qayd etilmagan brauzer belgisi bilan kirildi. Brauzer ma’lumotlarini tozalash yoki boshqa brauzerdan foydalanish ham shu belgini yuzaga keltirishi mumkin.'}</p>
          <p className="text-xs text-gray-600">Yetkazilgan: {date(notice.createdAt)}</p>
          <p className="break-all text-xs text-gray-600">Biznes ID: {notice.organizationId}</p>
          {notice.readAt?<p className="text-xs text-gray-600">O‘qilgan: {date(notice.readAt)}</p>:<Button size="sm" disabled={!!reading||!!retrying||busy} onClick={()=>{void acknowledge(notice);}}>{reading===notice.id?'Tekshirilmoqda...':'O‘qildi deb belgilash'}</Button>}
        </article>)}
      </>}
    </Card>
    <Card title="Xavfsizlik hodisalari">
      <p className="mb-3 text-sm text-gray-600">Hisobingizning barcha bizneslardagi kirishlari, sessiyalari va muhim xavfsizlik amallari ko‘rsatiladi. Tarix va bildirishnomalar 90 kun saqlanadi. Qurilma modeli yoki joylashuv taxmin qilinmaydi.</p>
      <p className="mb-3 text-sm text-gray-600">Yetkazishda xato bo‘lsa, qayta yetkazishni tasdiqlashingiz mumkin. Har bir tasdiqlash ko‘pi bilan 3 ta yangi urinishga ruxsat beradi; bitta bildirishnoma uchun jami 30 ta urinish chegarasi saqlanadi.</p>
      {retryError&&<p role="alert" className="mb-3 text-sm text-red-700">{retryError}</p>}
      {retryMessage&&<p role="status" className="mb-3 text-sm text-emerald-700">{retryMessage}</p>}
      {data&&(data.events.length===0?<p className="text-sm text-gray-600">Hozircha xavfsizlik hodisalari yo‘q.</p>:data.events.map(event=><article key={event.id} className="space-y-1 border-t border-gray-100 py-3">
        <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{eventLabels[event.type]??'Xavfsizlik hodisasi'}</p>{event.suspicious&&<Badge variant="warning" size="sm">Tekshirish tavsiya etiladi</Badge>}</div>
        <p className="text-sm">Vaqt: {date(event.createdAt)}</p>
        <p className="break-all text-xs text-gray-600">Biznes ID: {event.organizationId}</p>
        {event.sourceSessionId&&<p className="break-all text-xs text-gray-600">Sessiya ID: {event.sourceSessionId}</p>}
        {event.deliveryState&&<p className="text-xs text-gray-600">Bildirishnoma: {deliveryLabels[event.deliveryState]??'Holat aniqlanmoqda'}</p>}
        {event.deliveryState==='dead'&&<div className="space-y-2 py-1">
          <p role="alert" className="text-sm text-red-700">Bildirishnoma yetkazilmadi. Urinishlar: {event.deliveryAttempts??'—'} / {event.deliveryMaxAttempts??'—'}.</p>
          {event.canRetry?<Button size="sm" aria-label={'Bildirishnomani qayta yetkazish '+event.id} disabled={busy||!!reading||!!retrying} onClick={()=>{void retryDelivery(event);}}>{retrying===event.id?'Tekshirilmoqda...':'Bildirishnomani qayta yetkazish'}</Button>:<p className="text-xs text-gray-600">Bu bildirishnoma uchun qayta yetkazish ruxsati mavjud emas.</p>}
        </div>}
        <p className="text-xs text-gray-600">Tarixda saqlash muddati: {date(event.expiresAt)}</p>
      </article>))}
      <Pagination page={page} pages={pages} busy={busy||!!reading||!!retrying} onPage={setPage} retry={()=>setRevision(value=>value+1)}/>
    </Card>
  </section>;
}
