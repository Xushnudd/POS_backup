 'use client';
import {useEffect,useState} from 'react';
import {api} from '@/lib/api';
import Button from '@/components/ui/Button';
export default function OwnershipRequests({organizationId}:{organizationId?:string}){
 const [rows,setRows]=useState<Array<{id:string;incoming:boolean;expiresAt:string}>>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let cancelled=false;const load=()=>api.ownership.list().then(result=>{if(!cancelled)setRows(result.data??[]);}).catch(()=>undefined);void load();const timer=setInterval(()=>void load(),30000);return()=>{cancelled=true;clearInterval(timer);};},[organizationId]);
 if(!rows.length)return null;
 return <div className="text-xs">{error&&<p role="alert">{error}</p>}{rows.map(row=><div key={row.id}>Egalikni topshirish so‘rovi ({new Date(row.expiresAt).toLocaleString('uz-UZ')}) {row.incoming&&<Button size="sm" disabled={busy} onClick={async()=>{if(!window.confirm('Biznes egaligini qabul qilasizmi? Joriy egasi administrator bo‘ladi.'))return;setBusy(true);try{await api.ownership.respond(row.id,'accept');window.location.assign(new URL('/pos',window.location.origin).toString());}catch(error){setError(error instanceof Error?error.message:'So‘rov bajarilmadi');setBusy(false);}}}>Qabul qilish</Button>} <Button size="sm" disabled={busy} onClick={async()=>{setBusy(true);try{await api.ownership.respond(row.id,'cancel');setRows(rows=>rows.filter(x=>x.id!==row.id));}catch(error){setError(error instanceof Error?error.message:'So‘rov bekor qilinmadi');}finally{setBusy(false);}}}>Bekor qilish</Button></div>)}</div>;
}
