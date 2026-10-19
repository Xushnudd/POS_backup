'use client';
import {useEffect,useState} from 'react';
import Image from 'next/image';
import {usePathname} from 'next/navigation';
import {api} from '@/lib/api';
import DurableMutation from '@/components/forms/DurableMutation';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import {useTranslation} from '@/context/LocaleContext';
import {errorMessage} from '@/i18n/errors';
type LinkRecord={operationId:string;expiresAt:string;available:boolean;url:string|null;qrDataUrl:string|null};
export default function ReceiptLinks({saleId}:{saleId:string}){
 const {t:tr,message}=useTranslation(),returnPath=usePathname();
 const path='/sales/'+saleId+'/receipt-links';
 const [consent,setConsent]=useState(false),[revision,setRevision]=useState(0),[links,setLinks]=useState<LinkRecord[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[page,setPage]=useState(1),[pages,setPages]=useState(0);
 const refresh=()=>setRevision(value=>value+1);
 useEffect(()=>{let live=true;api.request<{rows:LinkRecord[];totalPages:number}>(path+'?page='+page).then(result=>{if(live){setLinks(result.data?.rows??[]);setPages(result.data?.totalPages??0);setError('');}}).catch(cause=>{if(live)setError(errorMessage(cause,'Chek havolalari yuklanmadi'));});return()=>{live=false;};},[path,revision,page]);
 async function revoke(operationId:string){if(busy)return;setBusy(true);setError('');try{await api.request(path,{method:'DELETE',body:JSON.stringify({operationId})});refresh();}catch(cause){setError(errorMessage(cause,'Havolani bekor qilish tasdiqlanmadi'));}finally{setBusy(false);}}
 return <section className="my-4 space-y-3 border rounded p-3" aria-label={tr('Elektron chek')}>
  <p>{tr('Havola bir soat amal qiladi. Uni faqat mijozning roziligi bilan shaxsan taqdim eting.')}</p>
  {error&&<p role="alert">{message(error)}</p>}
  <Button variant="outline" disabled={busy} onClick={refresh}>{tr('Yangilash')}</Button>
  <DurableMutation path={path} returnPath={returnPath} body={{consent}} canSubmit={consent&&!busy} canEdit={!busy} label={tr('Elektron chek havolasini yaratish')} review={[tr('Mijoz shaxsan havolani olishga rozilik berdi.'),tr('Havola bir soat amal qiladi. Uni faqat mijozning roziligi bilan shaxsan taqdim eting.')]} onDone={()=>{setConsent(false);setPage(1);refresh();}}>
   <label><input type="checkbox" checked={consent} onChange={event=>setConsent(event.target.checked)}/>{' '}{tr('Mijoz shaxsan havolani olishga rozilik berdi.')}</label>
  </DurableMutation>
  {links.map(link=><div key={link.operationId} className="border-t pt-2">
   <p>{tr('Muddati:')}{' '}{link.expiresAt}</p>
   {link.available&&link.url&&link.qrDataUrl?<><Image unoptimized src={link.qrDataUrl} width={180} height={180} alt={tr('Elektron chek QR kodi')}/><a className="block break-all" href={link.url} target="_blank" rel="noreferrer">{tr('Elektron chekni ochish')}</a><Button variant="outline" onClick={()=>{void navigator.clipboard.writeText(link.url!).catch(()=>setError('Havola nusxalanmadi'));}}>{tr('Havolani nusxalash')}</Button><Button variant="outline" disabled={busy} onClick={()=>{void revoke(link.operationId);}}>{tr('Havolani bekor qilish')}</Button></>:<p>{tr('Havola faol emas.')}</p>}
  </div>)}
  <Pagination page={page} pages={pages} busy={busy} onPage={setPage} retry={refresh}/>
 </section>;
}
