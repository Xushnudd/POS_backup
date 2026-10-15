'use client';
import {localizeOwnedLabels} from '@/i18n/messages';

import {useTranslation} from '@/context/LocaleContext';

import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import React, {useEffect,useState} from 'react';
import {api} from '@/lib/api';
import {confirmPageNavigation,commitPageNavigation} from '@/lib/page-navigation';
import {deviceId,pendingOperations} from '@/lib/offline';
import type {Organization} from '@/types';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotification } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faCashRegister,
  faStore,
  faRightFromBracket,
  faBolt,
} from '@fortawesome/free-solid-svg-icons';
import OwnershipRequests from '@/components/users/OwnershipRequests';
import SecurityNoticeBadge from '@/components/security/SecurityNoticeBadge';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
 const {locale:mapLocale}=useTranslation();

 const {t:tr}=useTranslation();

  const pathname = usePathname();
  const { notifyError } = useNotification();
  const { user, organization, role, logout } = useAuth();
  const { activeStore, activeRegister, activeShift } = useOrganization();
  const [businesses,setBusinesses]=useState<Organization[]>([]);
  const [switching,setSwitching]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    if (organization?.id) void api.organizations.list().then(result=>{if(!cancelled)setBusinesses(result.data??[]);}).catch(()=>undefined);
    return ()=>{cancelled=true;};
  },[organization?.id]);
  const switchBusiness=async(target:string)=>{
    if (!organization?.id || !user?.id || target===organization.id || !confirmPageNavigation()) return;
    setSwitching(true);
    try{
      if ((await pendingOperations({organizationId:organization.id,userId:user.id,deviceId:deviceId()})).length) throw new Error('Avval kutilayotgan savdo natijalarini tekshiring');
      await api.organizations.switch(target);
      localStorage.removeItem('pos_active_store');localStorage.removeItem('pos_active_register');
      commitPageNavigation();
      window.location.assign(new URL('/pos', window.location.origin).toString());
    }catch(error){notifyError(error instanceof Error?error.message:'Biznes almashtirilmadi');setSwitching(false);}
  };

  const roleNames: Record<string, string> = localizeOwnedLabels({
    owner: 'Do\'kon egasi',
    admin: 'Administrator',
    cashier: 'Kassir',
  },mapLocale);

  const isPosPage = pathname === '/pos';

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200/80 px-4 lg:px-6 h-16 flex items-center justify-between shadow-2xs">
      <OwnershipRequests organizationId={organization?.id}/>
      {/* Left: Mobile hamburger & Store / Register info */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition"
          aria-label={tr("Menyu")}
        >
          <FontAwesomeIcon icon={faBars} className="text-lg" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg text-gray-700 font-medium">
            <FontAwesomeIcon icon={faStore} className="text-gray-400" />
            <span>{activeStore?.name || organization?.name || tr("Do'kon")}</span>
          </div>

          {activeRegister && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg text-gray-700 font-medium">
              <FontAwesomeIcon icon={faCashRegister} className="text-gray-400" />
              <span>{activeRegister.name}</span>
            </div>
          )}
        </div>

        {/* Shift status */}
        <div className="flex items-center">
          {activeShift ? (
            <Badge variant="success" size="sm" dot>
              {tr("Smena ochiq")}</Badge>
          ) : (
            <Link href="/shifts" prefetch={false}>
              <Badge variant="warning" size="sm" dot className="hover:opacity-80 transition cursor-pointer">
                {tr("Smena ochilmagan")}</Badge>
            </Link>
          )}
        </div>
      </div>

      {/* Right: Quick POS link, User profile & Logout */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <LanguageSwitcher compact/><SecurityNoticeBadge/>
        {businesses.length>1 && <select aria-label={tr("Biznesni almashtirish")} value={organization?.id??''} disabled={switching} onChange={e=>{void switchBusiness(e.target.value);}} className="max-w-24 sm:max-w-36 min-w-0 text-xs border rounded-lg p-2">
          {businesses.map(business=><option key={business.id} value={business.id}>{business.name}</option>)}
        </select>}
        {!isPosPage && (
          <Link href="/pos" prefetch={false}>
            <Button
              variant="success"
              size="sm"
              leftIcon={<FontAwesomeIcon icon={faBolt} />}
              className="font-bold shadow-xs"
            >
              {tr("Kassa (POS)")}</Button>
          </Link>
        )}

        <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-bold text-gray-800 leading-tight">
              {user?.fullName}
            </span>
            <span className="text-[10px] text-gray-500 font-medium">
              {role ? roleNames[role] || role : ''}
            </span>
          </div>

          <button
            onClick={() => { void logout().catch(error => notifyError(error instanceof Error ? error.message : 'Chiqish amalga oshmadi')); }}
            title={tr("Tizimdan chiqish")}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="text-base" />
          </button>
        </div>
      </div>
    </header>
  );
}
