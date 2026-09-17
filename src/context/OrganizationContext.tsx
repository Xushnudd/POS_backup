'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Register, Shift, Store } from '@/types';
import { useAuth } from './AuthContext';

interface OrganizationContextType {
  stores: Store[];
  activeStore: Store | null;
  activeRegister: Register | null;
  activeShift: Shift | null;
  isLoading: boolean;
  setActiveStore: (store: Store) => void;
  setActiveRegister: (register: Register) => void;
  refreshStores: () => Promise<void>;
  refreshShift: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { organization, isAuthenticated } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStore, setActiveStoreState] = useState<Store | null>(null);
  const [activeRegister, setActiveRegisterState] = useState<Register | null>(null);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const setActiveStore = useCallback((store: Store) => {
    setActiveStoreState(store);
    localStorage.setItem('pos_active_store', JSON.stringify(store));
    if (store.registers && store.registers.length > 0) {
      setActiveRegister(store.registers[0]);
    } else {
      setActiveRegisterState(null);
      localStorage.removeItem('pos_active_register');
    }
  }, []);

  const setActiveRegister = useCallback((register: Register) => {
    setActiveRegisterState(register);
    localStorage.setItem('pos_active_register', JSON.stringify(register));
  }, []);

  const refreshStores = useCallback(async () => {
    if (!organization?.id || !isAuthenticated) return;
    setIsLoading(true);
    try {
      const res = await api.stores.list(organization.id);
      if (res.data) {
        setStores(res.data);

        // Check if there is an active store saved
        const savedStoreJson = localStorage.getItem('pos_active_store');
        let currentStore: Store | undefined;

        if (savedStoreJson) {
          try {
            const parsed = JSON.parse(savedStoreJson);
            currentStore = res.data.find((s) => s.id === parsed.id);
          } catch {
            // ignore
          }
        }

        if (!currentStore && res.data.length > 0) {
          currentStore = res.data[0];
        }

        if (currentStore) {
          setActiveStoreState(currentStore);

          const savedRegisterJson = localStorage.getItem('pos_active_register');
          let currentRegister: Register | undefined;

          if (savedRegisterJson && currentStore.registers) {
            try {
              const parsed = JSON.parse(savedRegisterJson);
              currentRegister = currentStore.registers.find((r) => r.id === parsed.id);
            } catch {
              // ignore
            }
          }

          if (!currentRegister && currentStore.registers && currentStore.registers.length > 0) {
            currentRegister = currentStore.registers[0];
          }

          if (currentRegister) {
            setActiveRegisterState(currentRegister);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching stores:', err);
    } finally {
      setIsLoading(false);
    }
  }, [organization?.id, isAuthenticated]);

  const refreshShift = useCallback(async () => {
    if (!activeRegister?.id || !isAuthenticated) {
      setActiveShift(null);
      return;
    }

    try {
      const res = await api.shifts.list({ registerId: activeRegister.id, status: 'open' });
      if (res.data && res.data.length > 0) {
        setActiveShift(res.data[0]);
      } else {
        setActiveShift(null);
      }
    } catch (err) {
      console.error('Error fetching active shift:', err);
      setActiveShift(null);
    }
  }, [activeRegister?.id, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && organization?.id) {
      refreshStores();
    }
  }, [isAuthenticated, organization?.id, refreshStores]);

  useEffect(() => {
    if (activeRegister?.id) {
      refreshShift();
    }
  }, [activeRegister?.id, refreshShift]);

  return (
    <OrganizationContext.Provider
      value={{
        stores,
        activeStore,
        activeRegister,
        activeShift,
        isLoading,
        setActiveStore,
        setActiveRegister,
        refreshStores,
        refreshShift,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
