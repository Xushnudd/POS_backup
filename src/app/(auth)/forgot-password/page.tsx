'use client'

import {useTranslation} from '@/context/LocaleContext';

import { useRef, useState } from 'react'
import Link from 'next/link'
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges'
import { api } from '@/lib/api'
export default function ForgotPasswordPage(){
 const {t:tr}=useTranslation();

 const [identifier,setIdentifier]=useState(''),[channel,setChannel]=useState('sms'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false)
 const flight=useRef(false)
 useUnsavedChanges(Boolean(identifier)&&!sent,busy)
 return <main className="mx-auto max-w-lg space-y-5 p-8"><h1 className="text-2xl font-bold">{tr("Parolni tiklash")}</h1><p>{tr("SMS/e-mail xizmati sozlanmagan bo‘lsa, tiklash mavjud emas. Akkaunt avtomatik tasdiqlanmaydi.")}</p>
 {busy&&<p role="status">{tr("Server tasdig‘i kutilmoqda…")}</p>}{identifier&&!sent&&!busy&&<p role="status">{tr("Saqlanmagan forma ma’lumotlari bor.")}</p>}
 {error&&<p role="alert">{error}</p>}{sent&&<p role="status">{tr("Agar mos akkaunt mavjud bo‘lsa, tiklash yo‘riqnomasi yuborish navbatiga qo‘yildi. Yetkazilishi tasdiqlanmaguncha token ishlamaydi.")}</p>}
 <form className="space-y-4" onSubmit={async event=>{event.preventDefault();if(flight.current)return;flight.current=true;setBusy(true);setError('');setSent(false);try{await api.request('/auth/password-reset/request',{method:'POST',body:JSON.stringify({identifier,channel})});setSent(true)}catch(e){setError(e instanceof Error?e.message:'Tiklash so‘rovi yuborilmadi')}finally{flight.current=false;setBusy(false)}}}><fieldset disabled={busy} className="space-y-4">
 <label className="block">{tr("Kanal")}<select aria-label={tr("Kanal")} value={channel} onChange={event=>{setChannel(event.target.value);setSent(false)}} className="ml-3 border p-2"><option value="sms">SMS</option><option value="email">{tr("E-mail")}</option></select></label>
 <label className="block">{tr("Telefon yoki e-mail")}<input className="block w-full border p-2" required maxLength={200} value={identifier} onChange={event=>{setIdentifier(event.target.value);setSent(false)}}/></label>
 <button className="rounded bg-blue-600 p-3 text-white" type="submit">{busy?tr("Tekshirilmoqda…"):tr("Tiklashni so‘rash")}</button></fieldset></form>
 <p><Link href="/reset-password" className="underline">{tr("Tiklash tokenini kiritish")}</Link></p><Link href="/login" className="underline">{tr("Kirishga qaytish")}</Link>
 </main>
}
