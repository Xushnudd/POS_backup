'use client'



import {useTranslation} from '@/context/LocaleContext';

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
export default function BillingNotice() {
  const { organization } = useAuth()
  return organization ? <Notice key={organization.id} /> : null
}
function Notice() {
 const {t:tr}=useTranslation();

  const [state,setState] = useState(''), [error,setError] = useState(false)
  useEffect(() => {
    let active = true
    const load = async () => { try { const result = await api.request<{state:string}>('/billing'); if (active) { setState(result.data?.state ?? ''); setError(false) } } catch { if (active) setError(true) } }
    void load(); const timer = setInterval(load,60000)
    return () => { active = false; clearInterval(timer) }
  }, [])
  if (error) return <aside role="status">{tr("Obuna holati tekshirilmadi.")}{' '}<Link href="/billing">{tr("Qayta tekshirish")}</Link></aside>
  if (!['trial','grace','expired'].includes(state)) return null
  return <aside className="mb-4 rounded border p-3" role={state === 'expired' ? 'alert' : 'status'}>
    {state === 'trial' ? tr("Sinov davri faol.") : state === 'grace' ? tr("Obuna imtiyozli muddatda. Yangilashni tekshiring.") : tr("Obuna muddati tugadi: yangi savdo yaratish yopilgan. Mavjud ma’lumotlar va eksport ochiq.")}
    {' '}<Link className="underline" href="/billing">{tr("Tarif va obuna")}</Link>
  </aside>
}
