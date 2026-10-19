'use client';
import {PUBLIC_COPY} from '@/release/public-copy';
import {useTranslation} from '@/context/LocaleContext';

import Link from 'next/link';
import type {PublicPlan} from '@/server/billing/public-pricing';
export default function LandingContent({plans}:{plans:PublicPlan[]|null}){
 const {t:tr,formatMoney}=useTranslation();

 const trial=plans?.find(plan=>plan.isTrial);
 return <div className="min-h-screen bg-slate-50 text-slate-900"><header className="border-b bg-white"><nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 p-6 pt-16 sm:pt-6 sm:pr-40" aria-label={tr(PUBLIC_COPY.navigationLabel)}><Link href="/" className="text-xl font-bold">Shuni POS</Link><a href="#features">{tr(PUBLIC_COPY.featuresNavigation)}</a><a href="#prices">{tr(PUBLIC_COPY.pricesNavigation)}</a><a href="#devices">{tr(PUBLIC_COPY.compatibilityNavigation)}</a><Link href="/login" className="ml-auto underline">{tr(PUBLIC_COPY.login)}</Link></nav></header>
 <main><section className="mx-auto max-w-6xl px-6 py-20"><h1 className="max-w-3xl text-4xl font-bold leading-tight">{tr(PUBLIC_COPY.heroTitle)}</h1><p className="my-6 max-w-3xl text-lg">{tr(PUBLIC_COPY.heroDescription)}</p>
 {trial&&<p className="mb-6">{tr(PUBLIC_COPY.trialOrganization)}{' '}{trial.trialDays} {tr(PUBLIC_COPY.trialDays)}{' '}{trial.name} {tr(PUBLIC_COPY.trialAfter)}{' '}{trial.graceDays} {tr(PUBLIC_COPY.graceDays)}</p>}
 <Link href="/register" className="inline-block rounded bg-emerald-700 px-6 py-3 font-semibold text-white">{tr(trial?PUBLIC_COPY.startTrial:PUBLIC_COPY.register)}</Link><Link href="/pos" className="ml-6 underline">{tr(PUBLIC_COPY.openPos)}</Link>
 </section><section id="features" className="mx-auto max-w-6xl px-6 py-12"><h2 className="mb-6 text-2xl font-bold">{tr(PUBLIC_COPY.featuresTitle)}</h2><div className="grid gap-6 md:grid-cols-3">
 <article className="rounded border bg-white p-6"><h3 className="text-xl font-semibold">{tr(PUBLIC_COPY.salesTitle)}</h3><p className="mt-3">{tr(PUBLIC_COPY.salesDescription)}</p></article>
 <article className="rounded border bg-white p-6"><h3 className="text-xl font-semibold">{tr(PUBLIC_COPY.inventoryTitle)}</h3><p className="mt-3">{tr(PUBLIC_COPY.inventoryDescription)}</p></article>
 <article className="rounded border bg-white p-6"><h3 className="text-xl font-semibold">{tr(PUBLIC_COPY.shiftsTitle)}</h3><p className="mt-3">{tr(PUBLIC_COPY.shiftsDescription)}</p></article>
 </div></section><section id="prices" className="bg-slate-900 px-6 py-16 text-white"><div className="mx-auto max-w-6xl"><h2 className="mb-6 text-2xl font-bold">{tr(PUBLIC_COPY.pricesTitle)}</h2>
 {!plans&&<p role="status">{tr(PUBLIC_COPY.pricesUnavailable)}</p>}
 <div className="grid gap-6 md:grid-cols-3">{plans?.map(plan=><article key={plan.code} className="rounded border border-slate-600 p-6"><h3 className="text-xl font-semibold">{plan.name}</h3><p className="my-4 text-3xl font-bold">{plan.currency==='UZS'?formatMoney(plan.monthlyPrice):plan.monthlyPrice+' '+plan.currency}{tr(PUBLIC_COPY.pricePeriod)}</p><ul className="mb-6 space-y-2"><li>{plan.branchLimit} {tr(PUBLIC_COPY.branchLimit)}</li><li>{tr(PUBLIC_COPY.organizationLimit)}{' '}{plan.registerLimit} {tr(PUBLIC_COPY.registerLimit)}</li><li>{tr(PUBLIC_COPY.totalLimit)}{' '}{plan.staffLimit} {tr(PUBLIC_COPY.staffLimit)}</li></ul><Link className="underline" href="/register">{tr(PUBLIC_COPY.register)}</Link></article>)}</div>
 <p className="mt-6">{tr(PUBLIC_COPY.subscriptionConditions)}</p></div></section>
 <section id="devices" className="mx-auto max-w-6xl px-6 py-12"><h2 className="text-2xl font-bold">{tr(PUBLIC_COPY.compatibilityTitle)}</h2><p className="mt-4">{tr(PUBLIC_COPY.browserCompatibility)}</p><p className="mt-3">{tr(PUBLIC_COPY.hardwareLimitations)}</p><p className="mt-3">{tr(PUBLIC_COPY.integrationLimitations)}</p></section>
 <section className="mx-auto max-w-6xl px-6 py-12"><h2 className="text-2xl font-bold">{tr(PUBLIC_COPY.helpTitle)}</h2><p className="mt-4">{tr(PUBLIC_COPY.onboardingDescription)}</p><div className="mt-4 flex gap-6"><Link href="/onboarding" className="underline">{tr(PUBLIC_COPY.onboarding)}</Link><Link href="/help" className="underline">{tr(PUBLIC_COPY.help)}</Link></div></section>
 </main><footer className="border-t p-6 text-center">{tr(PUBLIC_COPY.footer)}</footer></div>
}
