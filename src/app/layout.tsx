import type { Metadata } from 'next';
import {headers,cookies} from 'next/headers';
import {translate} from '@/i18n/messages';
import {LOCALE_COOKIE,normalizeLocale} from '@/i18n/locale';
import './globals.css';
import { AppProviders } from '@/context/AppProviders';

export async function generateMetadata():Promise<Metadata>{
 const locale=normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
 return {title:translate('Shuni POS — Savdo va ombor boshqaruvi tizimi',locale),description:translate('Kichik va o‘rta bizneslar uchun brauzerda ishlovchi zamonaviy POS savdo va ombor tizimi.',locale)};
}


export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonces are generated per document request; static HTML cannot reuse them.
  await headers();
  const locale=normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return (
    <html lang={locale}>
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen">
        <AppProviders initialLocale={locale}>{children}</AppProviders>
      </body>
    </html>
  );
}
