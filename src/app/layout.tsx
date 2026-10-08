import type { Metadata } from 'next';
import {headers} from 'next/headers';
import './globals.css';
import { AppProviders } from '@/context/AppProviders';

export const metadata: Metadata = {
  title: 'Shuni POS — Savdo va ombor boshqaruvi tizimi',
  description: 'Kichik va o‘rta bizneslar uchun brauzerda ishlovchi zamonaviy POS savdo va ombor tizimi.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonces are generated per document request; static HTML cannot reuse them.
  await headers();
  return (
    <html lang="uz">
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
