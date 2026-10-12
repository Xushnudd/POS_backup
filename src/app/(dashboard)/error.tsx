'use client';
import Link from 'next/link';
import Button from '@/components/ui/Button';
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <section role="alert" className="space-y-4 rounded-lg border p-5">
    <h1 className="text-xl font-semibold">Sahifa ochilmadi</h1>
    <p>Sahifani qayta yuklab ko‘ring. Javobi olinmagan savdo yoki to‘lov bo‘lsa, avval uning original natijasini tekshiring.</p>
    <Button onClick={retry}>Sahifani qayta ochish</Button>
    <Link href="/sync-review" prefetch={false} className="block underline">Saqlangan amallarni tekshirish</Link>
  </section>;
}
