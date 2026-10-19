import {Suspense} from 'react';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import DashboardLayout from '@/components/layouts/DashboardLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout><Suspense fallback={<LoadingSpinner/>}>{children}</Suspense></DashboardLayout>;
}
