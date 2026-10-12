import LoadingSpinner from '@/components/ui/LoadingSpinner';
export default function Loading() {
  return <div role="status" aria-live="polite"><LoadingSpinner fullPage text="Sahifa yuklanmoqda…" /></div>;
}
