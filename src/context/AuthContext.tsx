'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { AuthData, AuthUser, Organization, Role } from '@/types';

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  organization: Organization | null;
  role: Role | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (data: {
    fullName: string;
    phone: string;
    password: string;
    organizationName: string;
    email?: string;
    tin?: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setAuthData = useCallback((data: AuthData) => {
    localStorage.setItem('pos_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setOrganization({
      id: data.organization.id,
      name: data.organization.name,
      tin: data.organization.tin || null,
      phone: data.organization.phone || data.user.phone,
      currencyCode: data.organization.currencyCode || 'UZS',
      timezone: data.organization.timezone || 'Asia/Tashkent',
      allowNegativeStock: data.organization.allowNegativeStock ?? false,
      receiptFooter: data.organization.receiptFooter || null,
    });
    setRole(data.role);
  }, []);

  const clearAuthData = useCallback(() => {
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_active_store');
    localStorage.removeItem('pos_active_register');
    setToken(null);
    setUser(null);
    setOrganization(null);
    setRole(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const savedToken = localStorage.getItem('pos_token');
    if (!savedToken) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.auth.me();
      if (res.data) {
        setToken(savedToken);
        setUser(res.data.user);
        setOrganization({
          id: res.data.organization.id,
          name: res.data.organization.name,
          tin: res.data.organization.tin || null,
          phone: res.data.organization.phone || res.data.user.phone,
          currencyCode: res.data.organization.currencyCode || 'UZS',
          timezone: res.data.organization.timezone || 'Asia/Tashkent',
          allowNegativeStock: res.data.organization.allowNegativeStock ?? false,
          receiptFooter: res.data.organization.receiptFooter || null,
        });
        setRole(res.data.role);
      } else {
        clearAuthData();
      }
    } catch {
      clearAuthData();
    } finally {
      setIsLoading(false);
    }
  }, [clearAuthData]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (phone: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.auth.login({ phone, password });
      if (res.data) {
        setAuthData(res.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: {
    fullName: string;
    phone: string;
    password: string;
    organizationName: string;
    email?: string;
    tin?: string;
  }) => {
    setIsLoading(true);
    try {
      const res = await api.auth.register(data);
      if (res.data) {
        setAuthData(res.data);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearAuthData();
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        organization,
        role,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
