'use client'
import {localizeOwnedLabels} from '@/i18n/messages';

import {useTranslation} from '@/context/LocaleContext';

import {useEffect, useRef, useState} from 'react'
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges'
import Modal from '@/components/ui/Modal'
import {api} from '@/lib/api'
import {STEP_UP_EVENT, type StepUpRequest} from '@/lib/step-up'
import {useAuth} from '@/context/AuthContext'
const actionNames: Record<string,string> = {
  'auth.password.change':'Parolni almashtirish',
  'users.role.create':'Maxsus rol yaratish', 'users.role.update':'Maxsus rol vakolatlarini o‘zgartirish',
  'users.member.update':'Xodim vakolati yoki holatini o‘zgartirish',
  'users.member.create':'Yangi xodimga vakolat berish', 'users.invitation.create':'Xodimni vakolat bilan taklif qilish',
  'users.ownership.request':'Egalikni topshirish so‘rovi', 'users.ownership.accept':'Egalikni qabul qilish', 'users.ownership.cancel':'Egalik so‘rovini bekor qilish',
  'platform.overview':'Platforma boshqaruv panelini ko‘rish',
  'retention.closure.request':'Tashkilotni yopish so‘rovi', 'retention.closure.cancel':'Yopish so‘rovini bekor qilish',
  'retention.policy.publish':'Ma’lumotlarni saqlash siyosatini o‘zgartirish', 'billing.plan.publish':'Tarifni o‘zgartirish',
  'billing.plan.assign':'Tashkilot tarifini almashtirish', 'billing.payment.confirm':'Obuna to‘lovini tasdiqlash',
  'billing.subscription.cancel':'Obunani yangilash niyatini o‘zgartirish', 'offline-cash.policy':'Offline naqd savdo siyosatini o‘zgartirish',
  'billing.cost.record':'Platforma xarajatini qayd etish', 'billing.cost.cancel':'Platforma xarajatini bekor qilish',
  'support.policy.publish':'Yordam xizmati siyosatini o‘zgartirish', 'support.grant':'Yordam xodimiga vaqtli ruxsat berish',
}
const actionNamesSource=actionNames;

export default function CriticalStepUp() {
 const {locale:mapLocale}=useTranslation();

 const actionNames=localizeOwnedLabels(actionNamesSource,mapLocale);

 const {t:tr}=useTranslation();

  const {user, organization} = useAuth()
  const pending = useRef<StepUpRequest | null>(null), busy = useRef(false)
  const [binding, setBinding] = useState<StepUpRequest | null>(null)
  const [code, setCode] = useState(''), [error, setError] = useState(''), [saving, setSaving] = useState(false)
  useUnsavedChanges(Boolean(binding&&code),saving)
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
  return <Modal layer="critical" isOpen={binding !== null} onClose={close} title={tr("Muhim amalni tasdiqlash")} size="sm">
    <p className="mb-3">{tr("Authenticator ilovasidagi kodni kiriting. Tasdiq faqat shu amal va joriy sessiya uchun ishlaydi.")}</p>
    <p className="mb-3">{tr("Amal:")}{' '}{binding ? actionNames[binding.action] ?? tr("Muhim amal") : ''}</p>
    <p className="mb-3">{tr("Authenticator ulanmagan bo‘lsa, amalni bekor qilib xavfsizlik sahifasida ulang.")}</p>
    {error && <p role="alert" className="mb-3 text-red-700">{error}</p>}
    <form onSubmit={event => {event.preventDefault(); void approve()}}>
      <label htmlFor="critical-totp">{tr("Muhim amal uchun Authenticator kodi")}</label>
      <input id="critical-totp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value)} disabled={saving} className="w-full border rounded p-2 my-2"/>
      <div className="flex gap-3"><button type="submit" disabled={saving} className="bg-blue-700 text-white rounded p-2">{saving ? tr("Tasdiqlanmoqda…") : tr("Amalni tasdiqlash")}</button><button type="button" disabled={saving} onClick={close}>{tr("Bekor qilish")}</button></div>
    </form>
  </Modal>
}
