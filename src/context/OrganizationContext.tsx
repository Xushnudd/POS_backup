'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
  const storeRequest=useRef(0),shiftRequest=useRef(0),loadedOrganization=useRef<string|undefined>(undefined);
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStore, setActiveStoreState] = useState<Store | null>(null);
  const [activeRegister, setActiveRegisterState] = useState<Register | null>(null);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const setActiveRegister = useCallback((register: Register) => {
    shiftRequest.current++;
    setActiveShift(null);
    setActiveRegisterState(register);
    localStorage.setItem('pos_active_register', JSON.stringify(register));
  }, []);

  const setActiveStore = useCallback((store: Store) => {
    shiftRequest.current++;
    setActiveShift(null);
    setActiveStoreState(store);
    localStorage.setItem('pos_active_store', JSON.stringify(store));
    if (store.registers && store.registers.length > 0) {
      setActiveRegister(store.registers[0]);
    } else {
      setActiveRegisterState(null);
      localStorage.removeItem('pos_active_register');
    }
  }, [setActiveRegister]);

  const refreshStores = useCallback(async () => {
    const request=++storeRequest.current;
    if(loadedOrganization.current!==organization?.id){
      loadedOrganization.current=organization?.id;shiftRequest.current++;
      setStores([]);setActiveStoreState(null);setActiveRegisterState(null);setActiveShift(null);
    }
    if (!organization?.id || !isAuthenticated) {
      shiftRequest.current++;setStores([]);setActiveStoreState(null);setActiveRegisterState(null);setActiveShift(null);setIsLoading(false);return;
    }
    setIsLoading(true);
    try {
      const res = await api.stores.list(organization.id);
      if(request!==storeRequest.current)return;
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

          shiftRequest.current++;setActiveShift(null);
          setActiveRegisterState(currentRegister??null);
          if(!currentRegister)localStorage.removeItem('pos_active_register');
        }else{
          shiftRequest.current++;setActiveStoreState(null);setActiveRegisterState(null);setActiveShift(null);
          localStorage.removeItem('pos_active_store');localStorage.removeItem('pos_active_register');
        }
      }
    } catch (err) {
      console.error('Error fetching stores:', err);
    } finally {
      if(request===storeRequest.current)setIsLoading(false);
    }
  }, [organization, isAuthenticated]);

  const refreshShift = useCallback(async () => {
    const request=++shiftRequest.current;
    if (!activeRegister?.id || !isAuthenticated) {
      setActiveShift(null);
      return;
    }

    try {
      const res = await api.shifts.list({ registerId: activeRegister.id, status: 'open' });
      if(request!==shiftRequest.current)return;
      if (res.data && res.data.length > 0) {
        setActiveShift(res.data[0]);
      } else {
        setActiveShift(null);
      }
    } catch (err) {
      console.error('Error fetching active shift:', err);
      if(request===shiftRequest.current)setActiveShift(null);
    }
  }, [activeRegister, isAuthenticated]);

  const invalidateStores=useCallback(()=>{storeRequest.current++;shiftRequest.current++;},[]);
  const invalidateShift=useCallback(()=>{shiftRequest.current++;},[]);
  useEffect(() => {
    void Promise.resolve().then(refreshStores);
    return invalidateStores;
  }, [isAuthenticated, organization?.id, refreshStores, invalidateStores]);

  useEffect(() => {
    void Promise.resolve().then(refreshShift);
    return invalidateShift;
  }, [activeRegister?.id, refreshShift, invalidateShift]);

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
