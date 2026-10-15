'use client';
import {useTranslation} from '@/context/LocaleContext';

import {useEffect,useRef,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import {api} from '@/lib/api';
import {LOCAL_OPERATIONS_CHANGED,deviceId,pendingOperations,acknowledge,type PendingOperation} from '@/lib/offline';
import {durableRequestMethod} from '@/lib/durable-request';
import {durableIdentity} from '@/lib/durable-identity';
import Button from '@/components/ui/Button';
type PendingActionsProps={exact?:boolean;identity?:string;returnPath?:string;prefix:string;revision:number;onDone:(result?:unknown,originalBody?:Record<string,unknown>,path?:string)=>void};
export default function PendingActions(props:PendingActionsProps){const {organization,user,role}=useAuth();return organization&&user?<ScopedPendingActions key={[organization.id,user.id,role,props.prefix,props.returnPath].join(':')} organizationId={organization.id} userId={user.id} {...props}/>:null;}
function ScopedPendingActions({organizationId,userId,prefix,revision,onDone,returnPath,exact=false,identity}:PendingActionsProps&{organizationId:string;userId:string}){
 const {t:tr}=useTranslation();

const [rows,setRows]=useState<PendingOperation[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState('');const live=useRef(true),flight=useRef(false);
 useUnsavedChanges(false,Boolean(busy));
 useEffect(()=>{
  let cancelled=false,sequence=0;live.current=true;
  const read=async()=>{const request=++sequence;try{const pending=await pendingOperations({organizationId,userId,deviceId:deviceId()});if(!cancelled&&request===sequence)setRows(pending.filter(op=>op.type==='finance.action'&&(exact?op.payload.path===prefix:String(op.payload.path).startsWith(prefix))&&(identity===undefined||durableIdentity(String(op.payload.path),op.payload.body)===identity)&&(!returnPath||op.payload.returnPath===returnPath)));}catch(cause){if(!cancelled&&request===sequence)setError(cause instanceof Error?cause.message:'Lokal natijalar yuklanmadi');}};
  const changed=()=>{void read();};window.addEventListener(LOCAL_OPERATIONS_CHANGED,changed);window.addEventListener('focus',changed);void Promise.resolve().then(()=>{if(!cancelled)return read();});
  return()=>{cancelled=true;live.current=false;window.removeEventListener(LOCAL_OPERATIONS_CHANGED,changed);window.removeEventListener('focus',changed);};
 },[organizationId,userId,prefix,revision,returnPath,exact,identity]);

 return <section className="space-y-3">{error&&<p role="alert">{error}</p>}{rows.map(op=><article key={op.id} className="border p-3"><p>{tr("Original natijani tekshirish:")}{' '}{String(op.payload.label)}</p>{(Array.isArray(op.payload.review)?op.payload.review:[]).map((line,i)=><p key={i}>{String(line)}</p>)}<p>{tr("Amal kaliti:")}{' '}{op.id}</p><Button disabled={!!busy} onClick={async()=>{if(flight.current)return;flight.current=true;setBusy(op.id);setError('');try{const path=String(op.payload.path);if(path==='/offline-cash')throw new Error('Ruxsat shifrlanishi uchun original offline ruxsatni tekshirish formasidan foydalaning');if(!/^\/(loyalty|billing|taxes|incidents|sync|jobs|reports|exchanges|onboarding|catalog-import|offline-cash|sales|shifts|inventory|stock-documents|finance|purchases|purchase-orders|customers|taxes|suppliers|supplier-payments|supplier-invoices|products|brands|files|transfers|support|price-rules|customer-groups|customer-merges)(\/[a-zA-Z0-9/-]+)?$/.test(path))throw new Error('Lokal amal manzili noto‘g‘ri');const method=durableRequestMethod(path,op.payload.method);const response=await api.request(path,{method,body:JSON.stringify(op.payload.body)});await acknowledge(op.id,'synced',response.data);if(live.current){setRows(previous=>previous.filter(item=>item.id!==op.id));const {operationId:ignoredOperationId,...originalBody}=op.payload.body as Record<string,unknown>;void ignoredOperationId;onDone(response.data,originalBody,path);}}catch(e){if(live.current)setError(e instanceof Error?e.message:'Natija noma’lum; original kalit saqlangan');}finally{flight.current=false;if(live.current)setBusy('');}}}>{tr("Saqlangan amalni qayta tekshirish")}</Button></article>)}</section>;
}
