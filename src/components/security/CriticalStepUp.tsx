'use client'
import {useEffect, useRef, useState} from 'react'
import Modal from '@/components/ui/Modal'
import {api} from '@/lib/api'
import {STEP_UP_EVENT, type StepUpRequest} from '@/lib/step-up'
import {useAuth} from '@/context/AuthContext'
const actionNames: Record<string,string> = {
  'users.role.create':'Maxsus rol yaratish', 'users.role.update':'Maxsus rol vakolatlarini o‘zgartirish',
  'platform.overview':'Platforma boshqaruv panelini ko‘rish',
  'retention.closure.request':'Tashkilotni yopish so‘rovi', 'retention.closure.cancel':'Yopish so‘rovini bekor qilish',
  'retention.policy.publish':'Ma’lumotlarni saqlash siyosatini o‘zgartirish', 'billing.plan.publish':'Tarifni o‘zgartirish',
  'billing.plan.assign':'Tashkilot tarifini almashtirish', 'billing.payment.confirm':'Obuna to‘lovini tasdiqlash',
  'billing.subscription.cancel':'Obunani yangilash niyatini o‘zgartirish', 'offline-cash.policy':'Offline naqd savdo siyosatini o‘zgartirish',
  'billing.cost.record':'Platforma xarajatini qayd etish', 'billing.cost.cancel':'Platforma xarajatini bekor qilish',
  'support.policy.publish':'Yordam xizmati siyosatini o‘zgartirish', 'support.grant':'Yordam xodimiga vaqtli ruxsat berish',
}

export default function CriticalStepUp() {
  const {user, organization} = useAuth()
  const pending = useRef<StepUpRequest | null>(null), busy = useRef(false)
  const [binding, setBinding] = useState<StepUpRequest | null>(null)
  const [code, setCode] = useState(''), [error, setError] = useState(''), [saving, setSaving] = useState(false)
  useEffect(() => {
    const receive = (event: Event) => {
      const request = (event as CustomEvent<StepUpRequest>).detail
      if (pending.current) {request.finish(false); return}
      request.accepted = true
      pending.current = request; setBinding(request); setCode(''); setError('')
      request.signal.addEventListener('abort', () => {
        if (pending.current !== request) return
        pending.current = null; setBinding(null); setCode(''); setError('')
      }, {once:true})
    }
    window.addEventListener(STEP_UP_EVENT, receive)
    return () => {window.removeEventListener(STEP_UP_EVENT, receive); pending.current?.finish(false); pending.current = null}
  }, [user?.id, organization?.id])
  const close = () => {
    if (busy.current) return
    pending.current?.finish(false); pending.current = null
    setBinding(null); setCode(''); setError('')
  }
  const approve = async () => {
    const request = pending.current
    if (!request || busy.current) return
    busy.current = true; setSaving(true); setError('')
    try {
      await api.request('/auth/totp/proof', {method: 'POST', body: JSON.stringify({action: request.action, operationKey: request.operationKey, payloadHash: request.payloadHash, code})})
      // An account switch or unmount cancels the old request during the await.
      if (pending.current !== request) return
      pending.current = null; setBinding(null); request.finish(true)
    } catch (failure) {if (pending.current === request) setError(failure instanceof Error ? failure.message : 'Tasdiqlash amalga oshmadi')}
    finally {setCode(''); busy.current = false; setSaving(false)}
  }
  return <Modal isOpen={binding !== null} onClose={close} title="Muhim amalni tasdiqlash" size="sm">
    <p className="mb-3">Authenticator ilovasidagi kodni kiriting. Tasdiq faqat shu amal va joriy sessiya uchun ishlaydi.</p>
    <p className="mb-3">Amal: {binding ? actionNames[binding.action] ?? 'Muhim amal' : ''}</p>
    <p className="mb-3">Authenticator ulanmagan bo‘lsa, amalni bekor qilib xavfsizlik sahifasida ulang.</p>
    {error && <p role="alert" className="mb-3 text-red-700">{error}</p>}
    <form onSubmit={event => {event.preventDefault(); void approve()}}>
      <label htmlFor="critical-totp">Muhim amal uchun Authenticator kodi</label>
      <input id="critical-totp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value)} disabled={saving} className="w-full border rounded p-2 my-2"/>
      <div className="flex gap-3"><button type="submit" disabled={saving} className="bg-blue-700 text-white rounded p-2">{saving ? 'Tasdiqlanmoqda…' : 'Amalni tasdiqlash'}</button><button type="button" disabled={saving} onClick={close}>Bekor qilish</button></div>
    </form>
  </Modal>
}
