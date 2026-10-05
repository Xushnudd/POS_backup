'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
export default function InvitePage() {
 const {isAuthenticated}=useAuth()
 const [token,setToken]=useState(''),[fullName,setFullName]=useState(''),[password,setPassword]=useState('')
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[accepted,setAccepted]=useState(false)
 useEffect(()=>{void Promise.resolve().then(()=>setToken(window.location.hash.slice(1)))},[])
 return <main className="max-w-lg mx-auto p-6 mt-12 bg-white rounded-2xl border">
  <h1 className="text-xl font-bold mb-4">Biznesga taklifni qabul qilish</h1>
  <p className="text-sm mb-4">Mavjud hisobingiz bo‘lsa, avval tizimga kiring va taklif havolasini yana oching. Yangi hisob uchun ism va parol kiriting.</p>
  <form className="space-y-4" onSubmit={async event=>{
   event.preventDefault();setBusy(true);setMessage('');
   try {await api.auth.acceptInvitation({token,...(!isAuthenticated?{fullName,password}:{})});setAccepted(true);setToken('');window.history.replaceState(null,'','/invite');setMessage('Taklif qabul qilindi. Tizimga kirib yoki biznesni almashtirib davom eting.');}
   catch(error){setMessage(error instanceof Error?error.message:'Taklif qabul qilinmadi');}finally{setBusy(false);}
  }}>
   {!isAuthenticated && <><Input label="To‘liq ism" value={fullName} onChange={e=>setFullName(e.target.value)} minLength={2} maxLength={200} required/><Input label="Yangi parol" type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} maxLength={72} autoComplete="new-password" required/></>}
   {!accepted && <Button type="submit" disabled={!token} isLoading={busy}>Taklifni qabul qilish</Button>}
   {message && <p role="status" className="text-sm">{message}</p>}
   <Link href="/login" className="text-blue-700 text-sm">Tizimga kirish</Link>
  </form>
 </main>
}
