'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Header from './Header';
import Sidebar from './Sidebar';
import DeploymentNotice from '@/components/operations/DeploymentNotice';
import BillingNotice from '@/components/operations/BillingNotice';
import OperationalAlerts from '@/components/operations/OperationalAlerts';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Yuklanmoqda..." fullPage />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-60 bg-white text-blue-900 p-3">Asosiy mazmunga o‘tish</a>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-64 flex flex-col flex-1">
        <Header onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <main id="main-content" className="flex-1 p-4 lg:p-6 overflow-x-hidden"><DeploymentNotice/><BillingNotice/><OperationalAlerts/>{children}</main>
      </div>
    </div>
  );
}
