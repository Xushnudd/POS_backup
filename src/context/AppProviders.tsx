'use client';

import React from 'react';
import {LocaleProvider} from './LocaleContext';
import {type Locale} from '@/i18n/locale';
import {PublicLanguageSwitcher} from '@/components/ui/LanguageSwitcher';
import '@fortawesome/fontawesome-svg-core/styles.css';
import { config } from '@fortawesome/fontawesome-svg-core';
import { NotificationProvider } from './NotificationContext';
import { AuthProvider } from './AuthContext';
import { OrganizationProvider } from './OrganizationContext';
import { ToastContainer } from '@/components/ui/ToastContainer';
import PwaStatus from '@/components/security/PwaStatus';

config.autoAddCss = false;

export function AppProviders({ children,initialLocale='uz' }: { children: React.ReactNode;initialLocale?:Locale }) {
  return (
    <LocaleProvider initialLocale={initialLocale}><NotificationProvider>
      <AuthProvider>
        <OrganizationProvider>
          <React.Suspense fallback={null}><PublicLanguageSwitcher/></React.Suspense>{children}
          <PwaStatus />
          <ToastContainer />
        </OrganizationProvider>
      </AuthProvider>
    </NotificationProvider></LocaleProvider>
  );
}
