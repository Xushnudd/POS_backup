'use client';


import {useTranslation} from '@/context/LocaleContext';

import {useEffect,useState,useRef} from 'react';
import {useAuth} from '@/context/AuthContext';
import {useOrganization} from '@/context/OrganizationContext';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import {commitPageNavigation} from '@/lib/page-navigation';
import {api} from '@/lib/api';
import {deviceId,pendingOperations} from '@/lib/offline';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
export default function CashierPin(){const {organization,user,role}=useAuth();return organization&&user?<Controls key={organization.id+':'+user.id+':'+role}/>:null;}
function Controls(){
 const {t:tr}=useTranslation();

 const {organization,user,role}=useAuth(),{activeStore}=useOrganization();
 const [password,setPassword]=useState(''),[newPin,setNewPin]=useState(''),[pin,setPin]=useState(''),[target,setTarget]=useState(''),[rows,setRows]=useState<{id:string;fullName:string}[]>([]),[page,setPage]=useState(1),[pages,setPages]=useState(0),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const flight=useRef(false);
 const confirmDiscard=useUnsavedChanges(Boolean(password||newPin||pin||target),busy);
 useEffect(()=>{let live=true;if(!activeStore?.id)return;void api.request<{id:string;fullName:string}[]>('/auth/pin-switch?storeId='+activeStore.id+'&page='+page+'&limit=20').then(response=>{if(live){setRows(response.data??[]);setPages(response.pagination?.totalPages??0);}}).catch(e=>{if(live)setMessage(String(e));});return()=>{live=false;};},[activeStore?.id,page,revision]);
 const configure=async(disable:boolean)=>{if(flight.current)return;flight.current=true;setBusy(true);setMessage('');try{await api.request('/auth/pin',{method:'POST',body:JSON.stringify({currentPassword:password,pin:disable?null:newPin})});setPassword('');setNewPin('');setMessage(disable?'PIN o‘chirildi':'PIN saqlandi');setRevision(n=>n+1);}catch(e){setMessage(e instanceof Error?e.message:'PIN saqlanmadi');}finally{flight.current=false;setBusy(false);}};
 // A full reload discards the previous actor’s in-memory register/catalog state.
 // eslint-disable-next-line @next/next/no-location-assign-relative-destination
 const switchCashier=async()=>{if(!organization||!user||!activeStore||flight.current)return;flight.current=true;setBusy(true);setMessage('');try{if((await pendingOperations({organizationId:organization.id,userId:user.id,deviceId:deviceId()})).length)throw new Error('Sinxronlanmagan amallar bor; avval natijani tekshiring');await api.request('/auth/pin-switch',{method:'POST',body:JSON.stringify({targetMembershipId:target,storeId:activeStore.id,pin})});setPin('');commitPageNavigation();window.location.assign('/pos');}catch(e){setMessage(e instanceof Error?e.message:'Almashish natijasi noaniq; parol bilan qayta kirishni tekshiring');}finally{flight.current=false;setBusy(false);}};
 return <Card title={tr("Kassir PIN va tez almashish")}><p>{tr("PIN 6 raqamdan iborat. Faqat tanlangan filialda kassir vakolatini beradi; rahbar uchun parol bilan kirish kerak. Qoldiq, smena va savdo vakolatlari serverda qayta tekshiriladi. Oldingi kassirning lokal savati o‘z hisobida saqlanadi.")}</p>{message&&<p role="status">{message}</p>}{role==='cashier'&&<div><Input label={tr("PIN sozlash uchun parol")} disabled={busy} type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} maxLength={72}/><Input label={tr("Yangi kassir PIN")} disabled={busy} type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={newPin} onChange={e=>setNewPin(e.target.value)}/><Button disabled={busy||!password||!/^\d{6}$/.test(newPin)} onClick={()=>configure(false)}>{tr("Kassir PINni saqlash")}</Button><Button disabled={busy||!password} onClick={()=>configure(true)}>{tr("Kassir PINni o‘chirish")}</Button></div>}{activeStore?<div><p>{tr("Filial:")}{' '}{activeStore.name}</p><Select label={tr("Almashiladigan kassir")} value={target} options={[{value:'',label:tr("Kassirni tanlang")},...rows.map(row=>({value:row.id,label:row.fullName}))]} onChange={e=>setTarget(e.target.value)} disabled={busy}/><Input label={tr("Almashish PIN")} disabled={busy} type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={e=>setPin(e.target.value)}/><Button disabled={busy||!target||!/^\d{6}$/.test(pin)} onClick={switchCashier}>{tr("PIN bilan kassirni almashtirish")}</Button><Pagination page={page} pages={pages} busy={busy} onPage={n=>{if(!confirmDiscard())return;setTarget('');setPage(n);}} retry={()=>setRevision(n=>n+1)}/></div>:<p>{tr("Avval faol filialni tanlang.")}</p>}</Card>;
}
