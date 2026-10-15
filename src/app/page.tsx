import LandingContent from '@/components/landing/LandingContent'
import type {Metadata} from 'next';
import {cookies} from 'next/headers';
import {LOCALE_COOKIE,normalizeLocale} from '@/i18n/locale';
import {translate} from '@/i18n/messages';
import { publicPricing } from '@/server/billing/public-pricing'
export const dynamic='force-dynamic'
export async function generateMetadata():Promise<Metadata>{
 const locale=normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
 return {title:translate('Shuni POS — savdo, ombor va obuna',locale),description:translate('Naqd savdo, ombor, qaytarish, nasiya va hisobotlar. Tasdiqlangan tariflar va hozirgi integratsiya chegaralari.',locale)};
}
export default async function LandingPage(){
 const plans=await publicPricing().catch(()=>null);
 return <LandingContent plans={plans}/>;
}
