'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {useAuth} from '@/context/AuthContext';
import {api} from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import DurableMutation from '@/components/forms/DurableMutation';
import PendingActions from '@/components/forms/PendingActions';
import TaxProfilePicker from '@/components/forms/TaxProfilePicker';
type Classification={id:string;mxik:string|null;mxikSource:string|null;mxikRequired:boolean;taxRequired:boolean;markingRequired:boolean;taxProfileId:string|null};
export default function ClassificationPage(){
 const {t:tr}=useTranslation();
const {id}=useParams<{id:string}>(),{user,organization,role}=useAuth();return user&&organization&&role==='owner'?<Editor key={[user.id,organization.id,id].join(':')} id={id}/>:<p>{tr("Tasnifni boshqarish uchun egasi vakolati kerak.")}</p>;}
function Editor({id}:{id:string}){
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

 const path='/products/'+id+'/compliance',returnPath=path;
 const [form,setForm]=useState<Classification|null>(null),[reason,setReason]=useState(''),[error,setError]=useState(''),[revision,setRevision]=useState(0),[busy,setBusy]=useState(true);
 useEffect(()=>{let live=true;void Promise.resolve().then(async()=>{if(live){setBusy(true);setError('');}try{const result=await api.request<Classification>(path);if(live)setForm(current=>current??result.data??null);}catch(e){if(live)setError(displayErrorMessage(e,'Tasnif yuklanmadi'));}finally{if(live)setBusy(false);}});return()=>{live=false;};},[path,revision]);
 const refresh=()=>setRevision(n=>n+1);
 return <div className="space-y-4"><h1 className="text-2xl font-bold">{tr("Mahsulot tasnifi va savdo cheklovlari")}</h1><Link href="/products" prefetch={false}>{tr("Mahsulotlarga qaytish")}</Link><p>{tr("MXIK kodi va manba qaydini tekshirilgan katalogdan kiriting. Ilova rasmiy kod formatini yoki qonuniy tovar toifasini taxmin qilmaydi. Markirovka xizmati ulanmaguncha markirovkasi majburiy mahsulot checkouti bloklanadi.")}</p>{error&&<p role="alert">{uiMessage(error)}<Button disabled={busy} onClick={refresh}>{tr("Qayta yuklash")}</Button></p>}{busy&&<p role="status">{tr("Yuklanmoqda...")}</p>}<Button disabled={busy} onClick={refresh}>{tr("Tasnifni qayta tekshirish")}</Button><PendingActions prefix={path} returnPath={returnPath} revision={revision} onDone={refresh}/>{form&&<Card title={tr("Tasnif siyosati")}><DurableMutation canSubmit={!busy&&!error} path={path} returnPath={returnPath} body={{mxik:form.mxik?.trim()||null,mxikSource:form.mxikSource?.trim()||null,mxikRequired:form.mxikRequired,taxRequired:form.taxRequired,markingRequired:form.markingRequired,taxProfileId:form.taxProfileId,reason}} label={tr("Tasnifni saqlash")} review={[tr("MXIK:")+" "+(form.mxik||tr("kiritilmagan")),tr("Manba:")+" "+(form.mxikSource||tr("kiritilmagan")),tr("MXIK majburiy:")+" "+form.mxikRequired,tr("Soliq majburiy:")+" "+form.taxRequired,tr("Markirovka majburiy:")+" "+form.markingRequired,tr("Sabab:")+" "+reason]} onDone={result=>{if(result&&typeof result==='object')setForm(result as Classification);setReason('');refresh()}}>
 <Input label={tr("MXIK kodi")} maxLength={100} value={form.mxik??''} onChange={e=>setForm({...form,mxik:e.target.value})}/><Input label={tr("MXIK tekshirilgan manbasi")} maxLength={2000} value={form.mxikSource??''} onChange={e=>setForm({...form,mxikSource:e.target.value})}/><TaxProfilePicker value={form.taxProfileId??''} onChange={value=>setForm({...form,taxProfileId:value||null})}/>
 {(['mxikRequired','taxRequired','markingRequired'] as const).map((key,i)=><label key={key} className="flex gap-2"><input type="checkbox" checked={form[key]} onChange={e=>setForm({...form,[key]:e.target.checked})}/>{[tr("MXIK majburiy"),tr("Soliq siyosati majburiy"),tr("Markirovka majburiy")][i]}</label>)}<Input label={tr("Tasnif o‘zgarishi sababi")} minLength={3} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></DurableMutation></Card>}</div>;
}
