import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/context/AppProviders';

export const metadata: Metadata = {
  title: 'Shuni POS — Savdo va ombor boshqaruvi tizimi',
  description: 'Kichik va o‘rta bizneslar uchun brauzerda ishlovchi zamonaviy POS savdo va ombor tizimi.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uz">
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
