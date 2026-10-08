'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faCashRegister,
  faChartPie,
  faReceipt,
  faBoxesStacked,
  faWarehouse,
  faUsers,
  faClockRotateLeft,
  faChartLine,
  faGear,
  faTimes,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: IconDefinition;
  roles?: ('owner' | 'admin' | 'cashier')[];
  badge?: string;
  highlight?: boolean;
}

const navItems: NavItem[] = [
  {
    href: '/pos',
    label: 'POS Kassa',
    icon: faCashRegister,
    highlight: true,
  },
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: faChartPie,
    roles: ['owner', 'admin'],
  },
  {
    href: '/sales',
    label: 'Savdolar',
    icon: faReceipt,
  },
  {
    href: '/products',
    label: 'Mahsulotlar',
    icon: faBoxesStacked,
    roles: ['owner', 'admin'],
  },
  {
    href: '/inventory',
    label: 'Ombor',
    icon: faWarehouse,
    roles: ['owner', 'admin'],
  },
  {
    href: '/customers',
    label: 'Mijozlar',
    icon: faUsers,
    roles: ['owner', 'admin'],
  },
  {
    href: '/shifts',
    label: 'Smenalar',
    icon: faClockRotateLeft,
  },
  {
    href: '/reports',
    label: 'Hisobotlar',
    icon: faChartLine,
    roles: ['owner', 'admin'],
  },
  {
    href: '/settings',
    label: 'Sozlamalar',
    icon: faGear,
    roles: ['owner'],
  },
  {href:'/products/categories',label:'Kategoriyalar',icon:faBoxesStacked,roles:['owner','admin']},
  {href:'/archive',label:'Arxiv',icon:faBoxesStacked,roles:['owner','admin']},
  {href:'/suppliers',label:'Yetkazib beruvchilar',icon:faUsers,roles:['owner','admin']},
  {href:'/products/prices',label:'Narxlar tarixi',icon:faBoxesStacked,roles:['owner','admin']},
  {href:'/inventory/dispositions',label:'Brak va hisobdan chiqarish',icon:faWarehouse,roles:['owner','admin']},
  {href:'/inventory/movements',label:'Ombor jurnali',icon:faWarehouse,roles:['owner','admin']},
  {href:'/audit',label:'Audit tarixi',icon:faClockRotateLeft,roles:['owner']},
  {href:'/drafts',label:'Server qoralamalari',icon:faReceipt},
  {href:'/sync-review',label:'Navbat va konfliktlar',icon:faClockRotateLeft},
  {href:'/incidents',label:'Hisob tafovutlari',icon:faTriangleExclamation,roles:['owner','admin']},
  {href:'/replenishment',label:'Qayta buyurtma',icon:faWarehouse,roles:['owner','admin']},
  {href:'/help',label:'Yordam',icon:faUsers},
  {href:'/training',label:'Kassir mashqi',icon:faCashRegister},
  {href:'/security',label:'Faol sessiyalar',icon:faClockRotateLeft},
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { role, organization } = useAuth();

  const filteredNavItems = navItems.filter((item) => {
    if (!item.roles) return true;
    return role ? item.roles.includes(role) : false;
  });

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 lg:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-64 bg-slate-900 text-white flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800">
          <Link href="/dashboard" prefetch={false} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-emerald-500 to-blue-500 flex items-center justify-center text-white font-black text-lg shadow-md shadow-emerald-500/20">
              S
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
                Shuni <span className="text-emerald-400">POS</span>
              </h1>
              <p className="text-[10px] text-slate-400 truncate max-w-[130px]">
                {organization?.name || 'Savdo tizimi'}
              </p>
            </div>
          </Link>

          <button
            aria-label="Menyuni yopish"
            onClick={onClose}
            className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <FontAwesomeIcon icon={faTimes} className="text-base" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard' || pathname === '/'
                : item.href==='/inventory'?pathname==='/inventory':pathname.startsWith(item.href);

            if (item.highlight) {
              return (
                <div key={item.href} className="pb-2 pt-1">
                  <Link
                    href={item.href}
                    prefetch={false}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl font-bold text-sm transition-all shadow-md ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                        : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                    }`}
                  >
                    <FontAwesomeIcon icon={item.icon} className="text-base" />
                    <span>{item.label}</span>
                  </Link>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                onClick={onClose}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <FontAwesomeIcon
                  icon={item.icon}
                  className={`text-sm w-4 ${isActive ? 'text-white' : 'text-slate-400'}`}
                />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="px-2 py-0.5 text-[10px] bg-slate-800 text-slate-300 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800 text-slate-400 text-xs flex items-center justify-between">
          <span>v1.0.0 (MVP)</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-400 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Online
          </span>
        </div>
      </aside>
    </>
  );
}
