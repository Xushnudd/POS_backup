'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges'
import {commitPageNavigation} from '@/lib/page-navigation'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
export default function ResetPasswordPage(){
 const {refreshUser}=useAuth(),router=useRouter()
 const [token,setToken]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const flight=useRef(false)
 useUnsavedChanges(Boolean(token||password||confirmation),busy)
 return <main className="mx-auto max-w-lg space-y-5 p-8"><h1 className="text-2xl font-bold">Yangi parol</h1><p>Tiklash tokeni bir marta va cheklangan muddatda ishlaydi. Muvaffaqiyatli tiklash barcha qurilma sessiyalari va kassir PINlarini bekor qiladi.</p>
 {busy&&<p role="status">Server tasdig‘i kutilmoqda…</p>}{!busy&&(token||password||confirmation)&&<p role="status">Saqlanmagan forma ma’lumotlari bor.</p>}
 {error&&<p role="alert">{error}</p>}
 <form className="space-y-4" onSubmit={async event=>{event.preventDefault();if(flight.current)return;if(password!==confirmation){setError('Parollar bir xil emas');return}flight.current=true;setBusy(true);setError('');try{await api.request('/auth/password-reset/complete',{method:'POST',body:JSON.stringify({token,newPassword:password})});setToken('');setPassword('');setConfirmation('');commitPageNavigation();await refreshUser();router.replace('/login')}catch(e){setError(e instanceof Error?e.message:'Parol tiklanmadi')}finally{flight.current=false;setBusy(false)}}}><fieldset disabled={busy} className="space-y-4">
 <label className="block">Tiklash tokeni<input className="block w-full border p-2" type="password" autoComplete="one-time-code" required maxLength={43} value={token} onChange={event=>setToken(event.target.value.trim())}/></label>
 <label className="block">Yangi parol<input className="block w-full border p-2" type="password" autoComplete="new-password" required value={password} onChange={event=>setPassword(event.target.value)}/></label>
 <label className="block">Yangi parolni takrorlang<input className="block w-full border p-2" type="password" autoComplete="new-password" required value={confirmation} onChange={event=>setConfirmation(event.target.value)}/></label>
 <button className="rounded bg-blue-600 p-3 text-white" type="submit">{busy?'Tekshirilmoqda…':'Parolni yangilash'}</button></fieldset></form>
 <Link href="/login" className="underline">Kirishga qaytish</Link></main>
}
