'use client'
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges'
import { useAuth } from '@/context/AuthContext'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
export default function InvitePage() {
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

 const {isAuthenticated}=useAuth()
 const [token,setToken]=useState(''),[fullName,setFullName]=useState(''),[password,setPassword]=useState('')
 const flight=useRef(false)
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[accepted,setAccepted]=useState(false),[failed,setFailed]=useState(false)
 useUnsavedChanges(!accepted&&Boolean(fullName||password),busy)
 useEffect(()=>{void Promise.resolve().then(()=>setToken(window.location.hash.slice(1)))},[])
 return <main className="max-w-lg mx-auto p-6 mt-12 bg-white rounded-2xl border">
  <h1 className="text-xl font-bold mb-4">{tr("Biznesga taklifni qabul qilish")}</h1>
  <p className="text-sm mb-4">{tr("Mavjud hisobingiz bo‘lsa, avval tizimga kiring va taklif havolasini yana oching. Yangi hisob uchun ism va parol kiriting.")}</p>
  <form className="space-y-4" onSubmit={async event=>{
   event.preventDefault();if(flight.current)return;flight.current=true;setBusy(true);setMessage('');setFailed(false);
   try {const response=await api.auth.acceptInvitation({token,...(!isAuthenticated?{fullName,password}:{})});if(!response.data?.organizationId||!response.data.membershipId)throw new Error("Server taklif qabul qilinganini tasdiqlamadi");setAccepted(true);setToken('');setPassword('');setFullName('');window.history.replaceState(null,'','/invite');setMessage("Taklif qabul qilindi. Tizimga kirib yoki biznesni almashtirib davom eting.");}
   catch(error){setFailed(true);setMessage(displayErrorMessage(error,'Taklif qabul qilinmadi'));}finally{flight.current=false;setBusy(false);}
  }}>
   <fieldset disabled={busy||accepted} className="space-y-4">{!isAuthenticated && <><Input label={tr("To‘liq ism")} value={fullName} onChange={e=>setFullName(e.target.value)} minLength={2} maxLength={200} required/><Input label={tr("Yangi parol")} type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} maxLength={72} autoComplete="new-password" required/></>}
   {!accepted && <Button type="submit" disabled={!token} isLoading={busy}>{tr("Taklifni qabul qilish")}</Button>}
   </fieldset>{busy&&<p role="status">{tr("Server tasdig‘i kutilmoqda…")}</p>}
   {message && <p role={failed?'alert':'status'} className="text-sm">{uiMessage(message)}</p>}
   <Link href="/login" className="text-blue-700 text-sm">{tr("Tizimga kirish")}</Link>
  </form>
 </main>
}
