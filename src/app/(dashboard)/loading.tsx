
'use client';
import {useTranslation} from '@/context/LocaleContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
export default function Loading() {
 const {t:tr}=useTranslation();

  return <div role="status" aria-live="polite"><LoadingSpinner fullPage text={tr("Sahifa yuklanmoqda…")} /></div>;
}
