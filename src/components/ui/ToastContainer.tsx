'use client';

import React from 'react';
import { useNotification, NotificationType } from '@/context/NotificationContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faCheckCircle,
  faExclamationCircle,
  faExclamationTriangle,
  faInfoCircle,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';

const typeConfig: Record<
  NotificationType,
  { bg: string; border: string; text: string; icon: IconDefinition }
> = {
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-500',
    text: 'text-emerald-800',
    icon: faCheckCircle,
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-500',
    text: 'text-red-800',
    icon: faExclamationCircle,
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-500',
    text: 'text-amber-800',
    icon: faExclamationTriangle,
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-500',
    text: 'text-blue-800',
    icon: faInfoCircle,
  },
};

export function ToastContainer() {
  const { notifications, removeNotification } = useNotification();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {notifications.map((n) => {
        const config = typeConfig[n.type];
        return (
          <div
            key={n.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border-l-4 shadow-lg ${config.bg} ${config.border} transition-all duration-300 animate-in fade-in slide-in-from-bottom-5`}
          >
            <FontAwesomeIcon icon={config.icon} className={`mt-0.5 text-lg ${config.text}`} />
            <div className="flex-1">
              {n.title && <h4 className={`font-semibold text-sm ${config.text}`}>{n.title}</h4>}
              <p className={`text-sm ${config.text}`}>{n.message}</p>
            </div>
            <button
              onClick={() => removeNotification(n.id)}
              className="text-gray-400 hover:text-gray-600 transition p-1"
            >
              <FontAwesomeIcon icon={faTimes} className="text-sm" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
