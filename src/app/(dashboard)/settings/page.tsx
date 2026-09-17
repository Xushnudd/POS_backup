'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotification } from '@/context/NotificationContext';
import { api } from '@/lib/api';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding,
  faStore,
  faCashRegister,
  faUserTie,
  faPlus,
  faCheck,
  faPhone,
  faIdCard,
} from '@fortawesome/free-solid-svg-icons';

type SettingsUser = {
  id: string;
  role: 'owner' | 'admin' | 'cashier';
  isActive: boolean;
  user: { fullName: string; phone: string; email?: string | null };
  stores?: Array<{ id: string; name: string }>;
};

export default function SettingsPage() {
  const { organization, refreshUser } = useAuth();
  const { stores, refreshStores } = useOrganization();
  const { notifySuccess, notifyError } = useNotification();

  const [activeTab, setActiveTab] = useState<'organization' | 'stores' | 'users'>('organization');

  // Organization settings state
  const [orgName, setOrgName] = useState('');
  const [orgPhone, setOrgPhone] = useState('');
  const [orgTin, setOrgTin] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [isSavingOrg, setIsSavingOrg] = useState(false);

  // Users state
  const [users, setUsers] = useState<SettingsUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Modals
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [isSavingStore, setIsSavingStore] = useState(false);

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [registerStoreId, setRegisterStoreId] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerCode, setRegisterCode] = useState('');
  const [isSavingRegister, setIsSavingRegister] = useState(false);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState<'admin' | 'cashier'>('cashier');
  const [userStoreIds, setUserStoreIds] = useState<string[]>([]);
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Initialize org form
  useEffect(() => {
    if (organization) {
      void Promise.resolve().then(() => {
        setOrgName(organization.name || '');
        setOrgPhone(organization.phone || '');
        setOrgTin(organization.tin || '');
        setReceiptFooter(organization.receiptFooter || '');
        setAllowNegativeStock(organization.allowNegativeStock || false);
      });
    }
  }, [organization]);

  // Load org users
  const loadUsers = useCallback(async () => {
    if (!organization?.id) return;
    setIsLoadingUsers(true);
    try {
      const res = await api.organizations.users(organization.id);
      if (res.data) setUsers(res.data);
    } catch (err: unknown) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [organization]);

  useEffect(() => {
    if (activeTab === 'users') {
      void Promise.resolve().then(loadUsers);
    }
  }, [activeTab, loadUsers]);

  // Save organization settings
  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;

    setIsSavingOrg(true);
    try {
      await api.organizations.update(organization.id, {
        name: orgName.trim(),
        phone: orgPhone.trim(),
        tin: orgTin.trim() || undefined,
        receiptFooter: receiptFooter.trim() || undefined,
        allowNegativeStock,
      });

      notifySuccess('Tashkilot sozlamalari muvaffaqiyatli saqlandi');
      await refreshUser();
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Sozlamalarni saqlashda xatolik');
    } finally {
      setIsSavingOrg(false);
    }
  };

  // Create store
  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;

    setIsSavingStore(true);
    try {
      await api.stores.create({
        organizationId: organization.id,
        name: storeName.trim(),
        address: storeAddress.trim() || undefined,
        phone: storePhone.trim() || undefined,
      });

      notifySuccess('Yangi do\'kon yaratildi');
      setIsStoreModalOpen(false);
      setStoreName('');
      setStoreAddress('');
      setStorePhone('');
      await refreshStores();
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Do\'kon yaratishda xatolik');
    } finally {
      setIsSavingStore(false);
    }
  };

  // Create register
  const handleCreateRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerStoreId) return;

    setIsSavingRegister(true);
    try {
      await api.stores.createRegister(registerStoreId, {
        name: registerName.trim(),
        code: registerCode.trim(),
      });

      notifySuccess('Yangi kassa terminali qo\'shildi');
      setIsRegisterModalOpen(false);
      setRegisterName('');
      setRegisterCode('');
      await refreshStores();
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Kassa yaratishda xatolik');
    } finally {
      setIsSavingRegister(false);
    }
  };

  // Create organization user (cashier/admin)
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;

    setIsSavingUser(true);
    try {
      await api.organizations.addUser(organization.id, {
        fullName: userName.trim(),
        phone: userPhone.trim(),
        password: userPassword,
        role: userRole,
        storeIds: userStoreIds.length > 0 ? userStoreIds : undefined,
      });

      notifySuccess('Xodim muvaffaqiyatli qo\'shildi');
      setIsUserModalOpen(false);
      setUserName('');
      setUserPhone('');
      setUserPassword('');
      setUserStoreIds([]);
      loadUsers();
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Foydalanuvchi qo\'shishda xatolik');
    } finally {
      setIsSavingUser(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Tizim Sozlamalari</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Tashkilot rekvizitlari, savdo nuqtalari (do&apos;konlar), kassa terminallari va xodimlar
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        {[
          { id: 'organization', label: 'Tashkilot rekvizitlari', icon: faBuilding },
          { id: 'stores', label: 'Do\'konlar va Kassalar', icon: faStore },
          { id: 'users', label: 'Xodimlar (Foydalanuvchilar)', icon: faUserTie },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'organization' | 'stores' | 'users')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FontAwesomeIcon icon={tab.icon} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Organization Settings */}
      {activeTab === 'organization' && (
        <Card title="Asosiy tashkilot ma'lumotlari">
          <form onSubmit={handleSaveOrganization} className="space-y-4 max-w-xl">
            <Input
              label="Tashkilot / Biznes nomi *"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Telefon raqam *"
                value={orgPhone}
                onChange={(e) => setOrgPhone(e.target.value)}
                leftIcon={<FontAwesomeIcon icon={faPhone} className="text-xs" />}
                required
              />

              <Input
                label="STIR / INN"
                value={orgTin}
                onChange={(e) => setOrgTin(e.target.value)}
                leftIcon={<FontAwesomeIcon icon={faIdCard} className="text-xs" />}
              />
            </div>

            <Input
              label="Chek ostidagi matn (kvitansiya footer)"
              placeholder="Xaridingiz uchun rahmat! Yana kutib qolamiz!"
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              helperText="Chop etiladigan har bir chekning pastki qismida chiqadi"
            />

            <div className="pt-2">
              <label className="flex items-start gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowNegativeStock}
                  onChange={(e) => setAllowNegativeStock(e.target.checked)}
                  className="mt-0.5 rounded-sm text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-gray-800 block">
                    Manfiy qoldiqqa ruxsat berish
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Agar yoqilsa, omborda qoldiq yetarli bo&apos;lmaganda ham kassir savdoni yakunlay oladi
                  </span>
                </div>
              </label>
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                variant="primary"
                isLoading={isSavingOrg}
                leftIcon={<FontAwesomeIcon icon={faCheck} />}
                className="font-bold px-6 shadow-md shadow-blue-500/20"
              >
                O&apos;zgarishlarni saqlash
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tab 2: Stores & Registers */}
      {activeTab === 'stores' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={() => setIsStoreModalOpen(true)}
              leftIcon={<FontAwesomeIcon icon={faPlus} />}
              className="font-bold"
            >
              Yangi do&apos;kon qo&apos;shish
            </Button>
          </div>

          <div className="space-y-4">
            {stores.map((store) => (
              <Card
                key={store.id}
                title={
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faStore} className="text-blue-600 text-sm" />
                    <span>{store.name}</span>
                  </div>
                }
                subtitle={store.address || 'Manzil ko\'rsatilmagan'}
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRegisterStoreId(store.id);
                      setRegisterName(`Kassa ${(store.registers?.length || 0) + 1}`);
                      setRegisterCode(`REG-${Date.now().toString().slice(-4)}`);
                      setIsRegisterModalOpen(true);
                    }}
                    leftIcon={<FontAwesomeIcon icon={faPlus} />}
                  >
                    Kassa qo&apos;shish
                  </Button>
                }
              >
                <div>
                  <span className="text-xs font-bold text-gray-700 block mb-2">
                    Kassa terminallari:
                  </span>
                  {store.registers && store.registers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {store.registers.map((reg) => (
                        <div
                          key={reg.id}
                          className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2">
                            <FontAwesomeIcon icon={faCashRegister} className="text-gray-400" />
                            <div>
                              <span className="text-xs font-bold text-gray-800 block">
                                {reg.name}
                              </span>
                              <span className="text-[10px] font-mono text-gray-500">
                                {reg.code}
                              </span>
                            </div>
                          </div>
                          <Badge variant="success" size="sm" dot>
                            Faol
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">Bu do&apos;konda hozircha kassa mavjud emas</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Users */}
      {activeTab === 'users' && (
        <Card
          title="Tizim xodimlari"
          subtitle="Do'kon egasi, administrator va kassirlar ro'yxati"
          action={
            <Button
              variant="primary"
              onClick={() => {
                setUserName('');
                setUserPhone('');
                setUserPassword('');
                setUserRole('cashier');
                setUserStoreIds(stores.length > 0 ? [stores[0].id] : []);
                setIsUserModalOpen(true);
              }}
              leftIcon={<FontAwesomeIcon icon={faPlus} />}
              className="font-bold"
            >
              Yangi xodim
            </Button>
          }
          padding={false}
        >
          {isLoadingUsers ? (
            <div className="h-48 flex items-center justify-center">
              <LoadingSpinner size="lg" text="Xodimlar yuklanmoqda..." />
            </div>
          ) : users.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-400 text-xs">
              Xodimlar ro&apos;yxati bo&apos;sh
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Xodim</th>
                    <th className="py-3 px-4">Telefon</th>
                    <th className="py-3 px-4">Rol</th>
                    <th className="py-3 px-4">Biriktirilgan do&apos;konlar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3 px-4 font-bold text-gray-900">{u.user?.fullName}</td>
                      <td className="py-3 px-4 font-mono text-gray-600">{u.user?.phone}</td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            u.role === 'owner'
                              ? 'purple'
                              : u.role === 'admin'
                              ? 'info'
                              : 'success'
                          }
                          size="sm"
                        >
                          {u.role === 'owner'
                            ? 'Egasi'
                            : u.role === 'admin'
                            ? 'Admin'
                            : 'Kassir'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {u.stores && u.stores.length > 0
                          ? u.stores.map((s) => s.name).join(', ')
                          : 'Barcha do\'konlar'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Store Modal */}
      <Modal
        isOpen={isStoreModalOpen}
        onClose={() => setIsStoreModalOpen(false)}
        title="Yangi do'kon yaratish"
        size="md"
      >
        <form onSubmit={handleCreateStore} className="space-y-4">
          <Input
            label="Do'kon nomi *"
            placeholder="Filial 2 (Chilonzor)"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            required
          />
          <Input
            label="Manzil"
            placeholder="Toshkent sh., Chilonzor tumani"
            value={storeAddress}
            onChange={(e) => setStoreAddress(e.target.value)}
          />
          <Input
            label="Telefon raqam"
            placeholder="901234567"
            value={storePhone}
            onChange={(e) => setStorePhone(e.target.value)}
          />
          <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsStoreModalOpen(false)}
              disabled={isSavingStore}
            >
              Bekor qilish
            </Button>
            <Button type="submit" variant="primary" isLoading={isSavingStore} className="font-bold">
              Yaratish
            </Button>
          </div>
        </form>
      </Modal>

      {/* Register Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Yangi kassa terminali"
        size="md"
      >
        <form onSubmit={handleCreateRegister} className="space-y-4">
          <Input
            label="Kassa nomi *"
            placeholder="Kassa 1"
            value={registerName}
            onChange={(e) => setRegisterName(e.target.value)}
            required
          />
          <Input
            label="Kassa kodi *"
            placeholder="REG-001"
            value={registerCode}
            onChange={(e) => setRegisterCode(e.target.value)}
            required
          />
          <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRegisterModalOpen(false)}
              disabled={isSavingRegister}
            >
              Bekor qilish
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSavingRegister}
              className="font-bold"
            >
              Qo&apos;shish
            </Button>
          </div>
        </form>
      </Modal>

      {/* User Modal */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        title="Yangi xodim qo'shish"
        size="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label="Xodim to'liq ismi *"
            placeholder="Aziz Karimov"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            required
          />
          <Input
            label="Telefon raqam *"
            type="tel"
            placeholder="901234567"
            value={userPhone}
            onChange={(e) => setUserPhone(e.target.value)}
            required
          />
          <Input
            label="Parol (kamida 6 ta belgi) *"
            type="password"
            placeholder="••••••••"
            value={userPassword}
            onChange={(e) => setUserPassword(e.target.value)}
            required
          />
          <Select
            label="Roli *"
            value={userRole}
            onChange={(e) => setUserRole(e.target.value as 'admin' | 'cashier')}
            options={[
              { value: 'cashier', label: 'Kassir (faqat POS va smena)' },
              { value: 'admin', label: 'Administrator (to\'liq nazorat)' },
            ]}
          />
          <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUserModalOpen(false)}
              disabled={isSavingUser}
            >
              Bekor qilish
            </Button>
            <Button type="submit" variant="primary" isLoading={isSavingUser} className="font-bold">
              Qo&apos;shish
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
