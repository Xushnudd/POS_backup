'use client';
import {useTranslation} from '@/context/LocaleContext';

import Link from 'next/link';
import Button from '@/components/ui/Button';
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
 const {t:tr}=useTranslation();

  return <section role="alert" className="space-y-4 rounded-lg border p-5">
    <h1 className="text-xl font-semibold">{tr("Sahifa ochilmadi")}</h1>
    <p>{tr("Sahifani qayta yuklab ko‘ring. Javobi olinmagan savdo yoki to‘lov bo‘lsa, avval uning original natijasini tekshiring.")}</p>
    <Button onClick={retry}>{tr("Sahifani qayta ochish")}</Button>
    <Link href="/sync-review" prefetch={false} className="block underline">{tr("Saqlangan amallarni tekshirish")}</Link>
  </section>;
}
