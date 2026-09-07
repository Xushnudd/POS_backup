'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  notify: (type: NotificationType, message: string, title?: string) => void;
  notifySuccess: (message: string, title?: string) => void;
  notifyError: (message: string, title?: string) => void;
  notifyWarning: (message: string, title?: string) => void;
  notifyInfo: (message: string, title?: string) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback(
    (type: NotificationType, message: string, title?: string) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newNotification: Notification = { id, type, message, title };

      setNotifications((prev) => [...prev, newNotification]);

      setTimeout(() => {
        removeNotification(id);
      }, 4000);
    },
    [removeNotification]
  );

  const notifySuccess = useCallback(
    (message: string, title?: string) => notify('success', message, title),
    [notify]
  );
  const notifyError = useCallback(
    (message: string, title?: string) => notify('error', message, title),
    [notify]
  );
  const notifyWarning = useCallback(
    (message: string, title?: string) => notify('warning', message, title),
    [notify]
  );
  const notifyInfo = useCallback(
    (message: string, title?: string) => notify('info', message, title),
    [notify]
  );

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        notify,
        notifySuccess,
        notifyError,
        notifyWarning,
        notifyInfo,
        removeNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
