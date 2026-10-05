'use client';

import React from 'react';
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
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  const pathname = usePathname();
  const { notifyError } = useNotification();
  const { user, organization, role, logout } = useAuth();
  const { activeStore, activeRegister, activeShift } = useOrganization();

  const roleNames: Record<string, string> = {
    owner: 'Do\'kon egasi',
    admin: 'Administrator',
    cashier: 'Kassir',
  };

  const isPosPage = pathname === '/pos';

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200/80 px-4 lg:px-6 h-16 flex items-center justify-between shadow-2xs">
      {/* Left: Mobile hamburger & Store / Register info */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition"
          aria-label="Menyu"
        >
          <FontAwesomeIcon icon={faBars} className="text-lg" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 rounded-lg text-gray-700 font-medium">
            <FontAwesomeIcon icon={faStore} className="text-gray-400" />
            <span>{activeStore?.name || organization?.name || 'Do\'kon'}</span>
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
              Smena ochiq
            </Badge>
          ) : (
            <Link href="/shifts">
              <Badge variant="warning" size="sm" dot className="hover:opacity-80 transition cursor-pointer">
                Smena ochilmagan
              </Badge>
            </Link>
          )}
        </div>
      </div>

      {/* Right: Quick POS link, User profile & Logout */}
      <div className="flex items-center gap-3">
        {!isPosPage && (
          <Link href="/pos">
            <Button
              variant="success"
              size="sm"
              leftIcon={<FontAwesomeIcon icon={faBolt} />}
              className="font-bold shadow-xs"
            >
              Kassa (POS)
            </Button>
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
            title="Tizimdan chiqish"
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="text-base" />
          </button>
        </div>
      </div>
    </header>
  );
}
