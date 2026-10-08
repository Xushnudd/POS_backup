'use client';
import {useEffect,useRef,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {api} from '@/lib/api';
import {deviceId,pendingOperations,acknowledge,type PendingOperation} from '@/lib/offline';
import Button from '@/components/ui/Button';
export default function PendingActions({prefix,revision,onDone}:{prefix:string;revision:number;onDone:()=>void}){
 const {organization,user}=useAuth();const [rows,setRows]=useState<PendingOperation[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState('');const live=useRef(true),flight=useRef(false);
 useEffect(()=>{let cancelled=false;live.current=true;void Promise.resolve().then(async()=>{if(!organization||!user||cancelled)return;try{const pending=await pendingOperations({organizationId:organization.id,userId:user.id,deviceId:deviceId()});if(!cancelled)setRows(pending.filter(op=>op.type==='finance.action'&&String(op.payload.path).startsWith(prefix)));}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Lokal natijalar yuklanmadi');}});return()=>{cancelled=true;live.current=false;};},[organization,user,prefix,revision]);
 return <section className="space-y-3">{error&&<p role="alert">{error}</p>}{rows.map(op=><article key={op.id} className="border p-3"><p>Original natijani tekshirish: {String(op.payload.label)}</p>{(Array.isArray(op.payload.review)?op.payload.review:[]).map((line,i)=><p key={i}>{String(line)}</p>)}<p>Amal kaliti: {op.id}</p><Button disabled={!!busy} onClick={async()=>{if(flight.current)return;flight.current=true;setBusy(op.id);setError('');try{const path=String(op.payload.path);if(!/^\/(finance|purchases|customers|taxes)\/[a-zA-Z0-9/-]+$/.test(path))throw new Error('Lokal amal manzili noto‘g‘ri');const response=await api.request(path,{method:'POST',body:JSON.stringify(op.payload.body)});await acknowledge(op.id,'synced',response.data);if(live.current){setRows(previous=>previous.filter(item=>item.id!==op.id));onDone();}}catch(e){if(live.current)setError(e instanceof Error?e.message:'Natija noma’lum; original kalit saqlangan');}finally{flight.current=false;if(live.current)setBusy('');}}}>Saqlangan amalni qayta tekshirish</Button></article>)}</section>;
}
