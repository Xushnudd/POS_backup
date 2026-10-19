'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {localizeOwnedLabels} from '@/i18n/messages';

import {useTranslation} from '@/context/LocaleContext';

import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import React, {useEffect,useState,useRef} from 'react';
import {api} from '@/lib/api';
import {confirmPageNavigation,commitPageNavigation} from '@/lib/page-navigation';
import {deviceId} from '@/lib/offline';
import {assertContextSwitchReady} from '@/lib/context-switch';
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
  const { stores,activeStore, activeRegister, activeShift,isLoading } = useOrganization();
  const [businesses,setBusinesses]=useState<Organization[]>([]);
  const [switching,setSwitching]=useState(false);
  const switchFlight=useRef(false);
  useEffect(()=>{
    let cancelled=false;
    if (organization?.id) void api.organizations.list().then(result=>{if(!cancelled)setBusinesses(result.data??[]);}).catch(()=>undefined);
    return ()=>{cancelled=true;};
  },[organization?.id]);
  const switchBusiness=async(target:string)=>{
    if (switchFlight.current || !organization?.id || !user?.id || target===organization.id || !confirmPageNavigation()) return;
    switchFlight.current=true;
    setSwitching(true);
    try{
      await assertContextSwitchReady({organizationId:organization.id,userId:user.id,deviceId:deviceId()});
      await api.organizations.switch(target);
      localStorage.removeItem('pos_active_store');localStorage.removeItem('pos_active_register');
      commitPageNavigation();
      window.location.assign(new URL('/pos', window.location.origin).toString());
    }catch(error){notifyError(displayErrorMessage(error,'Biznes almashtirilmadi'));setSwitching(false);switchFlight.current=false;}
  };
  const switchRegisterContext=async(kind:'store'|'register',id:string)=>{
    if(switchFlight.current||!organization||!user||isLoading||id===(kind==='store'?activeStore?.id:activeRegister?.id))return;
    switchFlight.current=true;setSwitching(true);
    try{
      await assertContextSwitchReady({organizationId:organization.id,userId:user.id,deviceId:deviceId()},true);
      // Refresh the accessible list before persisting IDs; never trust stale options.
      const response=await api.stores.list(organization.id);
      const store=response.data?.find(row=>row.id===(kind==='store'?id:activeStore?.id)&&row.isActive!==false);
      if(!store)throw new Error('Filial yoki kassa hozir mavjud emas; ruxsatlarni qayta tekshiring.');
      const registers=store.registers?.filter(row=>row.isActive!==false)??[];
      const register=kind==='store'?registers[0]:registers.find(row=>row.id===id);
      if(kind==='register'&&!register)throw new Error('Filial yoki kassa hozir mavjud emas; ruxsatlarni qayta tekshiring.');
      // A cart or payment may have changed while the list was being refreshed.
      await assertContextSwitchReady({organizationId:organization.id,userId:user.id,deviceId:deviceId()},true);
      if(!confirmPageNavigation()){setSwitching(false);switchFlight.current=false;return;}
      localStorage.setItem('pos_active_store',JSON.stringify({id:store.id}));
      if(register)localStorage.setItem('pos_active_register',JSON.stringify({id:register.id}));else localStorage.removeItem('pos_active_register');
      commitPageNavigation();
      window.location.assign(new URL('/pos',window.location.origin).toString());
    }catch(error){notifyError(displayErrorMessage(error,'Filial yoki kassa almashtirilmadi.'));setSwitching(false);switchFlight.current=false;}
  };

  const roleNames: Record<string, string> = localizeOwnedLabels({
    owner: 'Do\'kon egasi',
    admin: 'Administrator',
    cashier: 'Kassir',
  },mapLocale);

  const isPosPage = pathname === '/pos';

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200/80 px-4 lg:px-6 min-h-16 py-2 flex flex-wrap gap-y-2 items-center justify-between shadow-2xs">
      <OwnershipRequests organizationId={organization?.id}/>
      {/* Left: Mobile hamburger & Store / Register info */}
      <div className="flex flex-wrap min-w-0 items-center gap-2 sm:gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition"
          aria-label={tr("Menyu")}
        >
          <FontAwesomeIcon icon={faBars} className="text-lg" />
        </button>

        <div className="flex min-w-0 items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg text-gray-700 font-medium">
            <FontAwesomeIcon icon={faStore} className="text-gray-400" />
            {stores.length>1?<select aria-label={tr("Filialni almashtirish")} className="max-w-22 sm:max-w-36 min-w-0 bg-transparent" disabled={switching||isLoading} value={activeStore?.id??''} onChange={e=>{void switchRegisterContext('store',e.target.value);}}>{!activeStore&&<option value="">{tr("Filialni tanlang")}</option>}{stores.map(store=><option key={store.id} value={store.id}>{store.name}</option>)}</select>:<span className="truncate max-w-22 sm:max-w-36">{activeStore?.name || organization?.name || tr("Do'kon")}</span>}
          </div>

          {activeRegister && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg text-gray-700 font-medium">
              <FontAwesomeIcon icon={faCashRegister} className="text-gray-400" />
              {(activeStore?.registers?.length??0)>1?<select aria-label={tr("Kassani almashtirish")} className="max-w-22 sm:max-w-36 min-w-0 bg-transparent" disabled={switching||isLoading} value={activeRegister.id} onChange={e=>{void switchRegisterContext('register',e.target.value);}}>{activeStore!.registers!.map(register=><option key={register.id} value={register.id}>{register.name}</option>)}</select>:<span className="truncate max-w-22 sm:max-w-36">{activeRegister.name}</span>}
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
          <Link href="/pos" prefetch={false} className="hidden sm:block">
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
            onClick={() => { void logout().catch(error => notifyError(displayErrorMessage(error,'Chiqish amalga oshmadi'))); }}
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
