'use client';
import Link from 'next/link';
import {useTranslation} from '@/context/LocaleContext';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
export default function NotFound(){
 const {t}=useTranslation();
 return <main className="mx-auto max-w-xl space-y-4 p-8" role="alert"><LanguageSwitcher/><h1 className="text-2xl font-bold">{t('Sahifa topilmadi')}</h1><p>{t('Manzilni tekshiring. Javobi noma’lum savdo yoki to‘lov bo‘lsa, avval original amal natijasini tekshiring.')}</p><Link className="block underline" href="/sync-review" prefetch={false}>{t('Saqlangan amallarni tekshirish')}</Link><Link className="block underline" href="/">{t('Bosh sahifaga qaytish')}</Link></main>;
}
