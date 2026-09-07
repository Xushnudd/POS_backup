'use client';

import React from 'react';
import '@fortawesome/fontawesome-svg-core/styles.css';
import { config } from '@fortawesome/fontawesome-svg-core';
import { NotificationProvider } from './NotificationContext';
import { AuthProvider } from './AuthContext';
import { OrganizationProvider } from './OrganizationContext';
import { ToastContainer } from '@/components/ui/ToastContainer';

config.autoAddCss = false;

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider>
      <AuthProvider>
        <OrganizationProvider>
          {children}
          <ToastContainer />
        </OrganizationProvider>
      </AuthProvider>
    </NotificationProvider>
  );
}
