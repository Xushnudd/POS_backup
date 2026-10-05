'use client';

import React from 'react';
import Link from 'next/link';
import uzDict from '@/dictionary/uz.json';
import { useAuth } from '@/context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBolt,
  faBoxesStacked,
  faChartLine,
  faCheck,
  faArrowRight,
  faCashRegister,
} from '@fortawesome/free-solid-svg-icons';
import Button from '@/components/ui/Button';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const icons = [faBolt, faBoxesStacked, faChartLine];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-emerald-500 to-blue-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-emerald-500/20">
              S
            </div>
            <span className="text-xl font-extrabold tracking-tight text-gray-900">
              Shuni <span className="text-emerald-600">POS</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-gray-900 transition">
              {uzDict.nav.list[0]}
            </a>
            <a href="#prices" className="hover:text-gray-900 transition">
              {uzDict.nav.list[1]}
            </a>
            <a href="#about" className="hover:text-gray-900 transition">
              {uzDict.nav.list[2]}
            </a>
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button variant="primary" size="md">
                  Dashboardga o&apos;tish
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="md">
                    Kirish
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="success" size="md">
                    {uzDict.nav.button}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="relative overflow-hidden pt-16 pb-24 lg:pt-24 lg:pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-6 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Yangi avlod savdo tizimi MVP
            </div>

            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-black text-gray-900 tracking-tight leading-tight mb-6"
              dangerouslySetInnerHTML={{ __html: uzDict.banner.title }}
            />

            <p className="text-lg sm:text-xl text-gray-600 mb-10 leading-relaxed">
              {uzDict.banner.caption.replace('{logo}', 'Shuni POS')}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="w-full sm:w-auto">
                <Button
                  variant="success"
                  size="lg"
                  fullWidth
                  rightIcon={<FontAwesomeIcon icon={faArrowRight} />}
                  className="shadow-lg shadow-emerald-600/30 text-base"
                >
                  {uzDict.banner.buttons[0].name}
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" fullWidth className="text-base">
                  Tizimga kirish
                </Button>
              </Link>
            </div>
          </div>

          {/* POS Mockup Preview */}
          <div className="mt-14 max-w-5xl mx-auto rounded-2xl border border-gray-200 shadow-2xl bg-white overflow-hidden p-2 sm:p-4 bg-linear-to-b from-gray-50 to-white">
            <div className="rounded-xl border border-gray-100 bg-slate-900 p-4 text-white">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs text-slate-400 font-mono ml-2">kassa.shunipos.uz</span>
                </div>
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faCashRegister} /> Ochiq smena: REG-001
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 bg-slate-800 rounded-xl p-4 flex flex-col gap-2">
                  <span className="text-xs text-slate-400">Tezkor katalog & Barkod qidiruv</span>
                  <div className="grid grid-cols-3 gap-2">
                    {['Coca-Cola 1.5L', 'Non Toshkent', 'Sut 1L', 'Shakar 1kg', 'Yog\' 1L', 'Tuxum 10talik'].map(
                      (item, i) => (
                        <div
                          key={i}
                          className="bg-slate-700/60 p-2.5 rounded-lg border border-slate-600/40 text-xs font-medium hover:border-emerald-500 cursor-pointer transition"
                        >
                          <p className="truncate text-slate-200">{item}</p>
                          <p className="text-emerald-400 font-bold mt-1">12 000 so&apos;m</p>
                        </div>
                      )
                    )}
                  </div>
                </div>
                <div className="bg-slate-800/90 rounded-xl p-4 flex flex-col justify-between border border-slate-700">
                  <div>
                    <span className="text-xs font-bold text-slate-300">Joriy Savat</span>
                    <div className="mt-2 space-y-1.5 text-xs text-slate-400">
                      <div className="flex justify-between">
                        <span>Coca-Cola 1.5L x 2</span>
                        <span className="text-white">24 000</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Non x 3</span>
                        <span className="text-white">12 000</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-700 mt-4">
                    <div className="flex justify-between text-sm font-bold text-white mb-2">
                      <span>Jami to&apos;lov:</span>
                      <span className="text-emerald-400">36 000 so&apos;m</span>
                    </div>
                    <div className="py-2 bg-emerald-600 text-center rounded-lg font-bold text-xs">
                      To&apos;lov qilish (F4)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust metric */}
      <section className="py-12 bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">
            {uzDict.mystore.title}
          </p>
          <p className="text-sm sm:text-base text-gray-500">{uzDict.mystore.caption}</p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-4">
            {uzDict.control_info.title}
          </h2>
          <p className="text-base sm:text-lg text-gray-600">{uzDict.control_info.caption}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {uzDict.control_info.cards.map((card, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl p-8 border border-gray-100 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl mb-6 shadow-xs">
                <FontAwesomeIcon icon={icons[idx]} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{card.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed flex-1">{card.caption}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section id="prices" className="py-20 lg:py-28 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
              {uzDict.prices.title}
            </h2>
            <p className="text-slate-400 text-base sm:text-lg">{uzDict.prices.caption}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {uzDict.prices.cards.map((card, idx) => {
              const isPro = card.title === 'Pro';
              return (
                <div
                  key={idx}
                  className={`rounded-2xl p-8 flex flex-col justify-between transition relative ${
                    isPro
                      ? 'bg-linear-to-b from-slate-800 to-slate-900 border-2 border-emerald-500 shadow-2xl shadow-emerald-500/20'
                      : 'bg-slate-800/60 border border-slate-700/60'
                  }`}
                >
                  {isPro && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-full shadow-md">
                      Eng ommabop
                    </span>
                  )}

                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{card.title}</h3>
                    <div className="flex items-baseline gap-1 my-4">
                      <span className="text-4xl font-black">
                        {card.price === 0 ? 'Bepul' : `${card.price.toLocaleString()} so'm`}
                      </span>
                      {card.price > 0 && <span className="text-sm text-slate-400">/oy</span>}
                    </div>

                    <ul className="space-y-3 my-6 text-sm text-slate-300">
                      {card.caption.map((feature, fIdx) => (
                        <li key={fIdx} className="flex items-center gap-2.5">
                          <FontAwesomeIcon icon={faCheck} className="text-emerald-400 text-sm" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Link href="/register" className="mt-4">
                    <Button
                      variant={isPro ? 'success' : 'outline'}
                      size="lg"
                      fullWidth
                      className={isPro ? '' : 'text-white border-slate-600 hover:bg-slate-700'}
                    >
                      {card.button.title}
                    </Button>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Bottom Section */}
      <section id="about" className="py-20 bg-linear-to-tr from-emerald-600 to-blue-700 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-black mb-4">{uzDict.trade.title}</h2>
          <p className="text-emerald-100 text-base sm:text-lg mb-8">{uzDict.trade.caption}</p>
          <Link href="/register">
            <Button
              variant="secondary"
              size="lg"
              className="bg-white text-gray-900 font-bold hover:bg-emerald-50 text-base px-8 py-3.5 shadow-xl"
            >
              {uzDict.trade.button}
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-black text-sm">
              S
            </div>
            <span className="text-white font-bold">Shuni POS</span>
          </div>

          <div className="flex flex-wrap gap-6 text-sm">
            {uzDict.footer.list.map((item, i) => (
              <a key={i} href="#" className="hover:text-white transition">
                {item.title}
              </a>
            ))}
          </div>

          <p className="text-xs">{uzDict.footer.copyright}</p>
        </div>
      </footer>
    </div>
  );
}