'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotification } from '@/context/NotificationContext';
import { api } from '@/lib/api';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
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
  archivedAt: string | null;
  user: { fullName: string; phone: string; email?: string | null };
  stores?: Array<{ id: string; name: string }>;
};

export default function SettingsPage() {
  const { organization, refreshUser, role } = useAuth();
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
  const [orgInitialized,setOrgInitialized]=useState('');
  const [orgBaseline,setOrgBaseline]=useState('');

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
  const [userMode,setUserMode]=useState<'direct'|'invite'>('direct');
  const [invitationLink,setInvitationLink]=useState('');
  const [invitationId,setInvitationId]=useState('');
  const [editingMember,setEditingMember]=useState<SettingsUser|null>(null);
  const [memberRole,setMemberRole]=useState<'owner'|'admin'|'cashier'>('cashier');
  const [memberStores,setMemberStores]=useState<string[]>([]);
  const userFlight=useRef(false);
  const savingFlights=useRef({organization:false,store:false,register:false});
  const userMutation=useRef<{signature:string;operationId:string}|null>(null);
  const memberMutation=useRef<{signature:string;operationId:string}|null>(null);

  const orgDirty=role==='owner'&&orgInitialized===organization?.id&&JSON.stringify([orgName,orgPhone,orgTin,receiptFooter,allowNegativeStock])!==orgBaseline;
  useUnsavedChanges(orgDirty,isSavingOrg);
  const storeDirty=isStoreModalOpen&&Boolean(storeName||storeAddress||storePhone);
  const closeStore=useUnsavedChanges(storeDirty,isSavingStore);
  const registerDirty=isRegisterModalOpen&&Boolean(registerName||registerCode);
  const closeRegister=useUnsavedChanges(registerDirty,isSavingRegister);
  const memberDirty=Boolean(editingMember&&(memberRole!==editingMember.role||JSON.stringify([...memberStores].sort())!==JSON.stringify((editingMember.stores?.map(store=>store.id)??[]).sort())));
  const userDirty=isUserModalOpen&&Boolean(userName||userPhone||userPassword||userRole!=='cashier'||userMode!=='direct'||userStoreIds.length);
  const closeUser=useUnsavedChanges(userDirty||memberDirty,isSavingUser);

  // Initialize org form
  useEffect(() => {
    if (organization && !(orgInitialized===organization.id&&orgDirty)) {
      void Promise.resolve().then(() => {
        setOrgName(organization.name || '');
        setOrgPhone(organization.phone || '');
        setOrgTin(organization.tin || '');
        setReceiptFooter(organization.receiptFooter || '');
        setAllowNegativeStock(organization.allowNegativeStock || false);
        setOrgBaseline(JSON.stringify([organization.name||'',organization.phone||'',organization.tin||'',organization.receiptFooter||'',Boolean(organization.allowNegativeStock)]));
        setOrgInitialized(organization.id);
      });
    }
  }, [organization,orgInitialized,orgDirty]);

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
    if (!organization?.id||savingFlights.current.organization) return;

    savingFlights.current.organization=true;
    setIsSavingOrg(true);
    try {
      await api.organizations.update(organization.id, {
        name: orgName.trim(),
        phone: orgPhone.trim(),
        tin: orgTin.trim() || undefined,
        receiptFooter: receiptFooter.trim() || undefined,
        allowNegativeStock,
      });

      setOrgBaseline(JSON.stringify([orgName,orgPhone,orgTin,receiptFooter,allowNegativeStock]));
      notifySuccess('Tashkilot sozlamalari muvaffaqiyatli saqlandi');
      await refreshUser();
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Sozlamalarni saqlashda xatolik');
    } finally {
      savingFlights.current.organization=false;
      setIsSavingOrg(false);
    }
  };

  // Create store
  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id||savingFlights.current.store) return;

    savingFlights.current.store=true;
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
      savingFlights.current.store=false;
      setIsSavingStore(false);
    }
  };

  // Create register
  const handleCreateRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerStoreId) return;

    savingFlights.current.register=true;
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
      savingFlights.current.register=false;
      setIsSavingRegister(false);
    }
  };

  // Create organization user (cashier/admin)
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id||userFlight.current) return;
    userFlight.current=true;
    const signature=JSON.stringify({organizationId:organization.id,userMode,userName,userPhone,userPassword,userRole,userStoreIds});
    if(userMutation.current?.signature!==signature)userMutation.current={signature,operationId:crypto.randomUUID()};
    const operationId=userMutation.current.operationId;
    setIsSavingUser(true);
    try {
      if (userMode==='invite') {
        const result=await api.organizations.createInvitation(organization.id,{operationId,phone:userPhone.trim(),role:userRole,storeIds:userStoreIds});
        if (!result.data) throw new Error('Taklif yaratilmadi');
        setInvitationId(result.data.id);
        if(!result.data.invitationToken){setInvitationLink('');throw new Error('Taklif allaqachon yaratilgan; bir martalik havola qayta berilmaydi. Taklifni bekor qilib, yangisini yarating.');}
        setInvitationLink(`${window.location.origin}/invite#${result.data.invitationToken}`);
      } else await api.organizations.addUser(organization.id, {
        operationId,
        fullName: userName.trim(),
        phone: userPhone.trim(),
        password: userPassword,
        role: userRole,
        storeIds: userStoreIds.length > 0 ? userStoreIds : undefined,
      });

      userMutation.current=null;
      notifySuccess(userMode==='invite'?'Taklif yaratildi; havolani xodimga xavfsiz ulashing':'Xodim muvaffaqiyatli qo‘shildi');
      setIsUserModalOpen(false);
      setUserName('');
      setUserPhone('');
      setUserPassword('');
      setUserStoreIds([]);
      loadUsers();
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Foydalanuvchi qo\'shishda xatolik');
    } finally {
      userFlight.current=false;
      setIsSavingUser(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {['owner','admin'].includes(role??'')&&<a href="/settings/prices" className="underline text-blue-800">Narx darajalari va mijoz guruhlari</a>}
      {role==='owner'&&<a href="/settings/support" className="underline text-blue-800">Support uchun vaqtli kirish ruxsati</a>}

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
        ].filter(tab=>tab.id!=='users'||role==='owner').map((tab) => (
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
          <form onSubmit={handleSaveOrganization} className="space-y-4 max-w-xl"><fieldset disabled={isSavingOrg} className="space-y-4">
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
          </fieldset></form>
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

      {(orgDirty||storeDirty||registerDirty||userDirty||memberDirty)&&<p role="status">Saqlanmagan sozlama o‘zgarishlari bor.</p>}
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
                    <th className="py-3 px-4">Biriktirilgan do&apos;konlar</th><th className="py-3 px-4">Amallar</th>
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
                          : u.role==='owner'?'Barcha do‘konlar':'Filial biriktirilmagan'}
                      </td>
                      <td className="py-3 px-4"><div className="flex gap-2">
                        {u.isActive&&<Button size="sm" onClick={async()=>{if(!organization?.id||!window.confirm(`${u.user?.fullName} ga egalik so‘rovini yuborasizmi? Qabul qilganda siz administrator bo‘lasiz.`))return;try{await api.ownership.request(organization.id,u.id);notifySuccess('Qabul qiluvchi tasdig‘i kutilmoqda');}catch(error){notifyError(error instanceof Error?error.message:'So‘rov yuborilmadi');}}}>Egalikni topshirish</Button>}
                        <Badge size="sm">{u.archivedAt?'Arxivlangan':u.isActive?'Faol':'Bloklangan'}</Badge>
                        {!u.archivedAt&&<Button size="sm" onClick={()=>{setEditingMember(u);setMemberRole(u.role);setMemberStores(u.stores?.map(store=>store.id)??[]);}}>Vakolat</Button>}
                        {!u.archivedAt&&<Button size="sm" onClick={async()=>{
                          if (!organization?.id) return;
                          try{await api.organizations.updateMember(organization.id,u.id,{isActive:!u.isActive});await loadUsers();notifySuccess(u.isActive?'Xodim bloklandi':'Xodim faollashtirildi');}catch(error){notifyError(error instanceof Error?error.message:'Amal bajarilmadi');}
                        }}>{u.isActive?'Bloklash':'Faollashtirish'}</Button>}
                        <Button size="sm" onClick={async()=>{
                          if(!organization?.id||!window.confirm(u.archivedAt?'Xodim arxivdan bloklangan holatda tiklanadi. Vakolatlarini tekshirib, alohida faollashtiring.':'Xodim arxivlanadi va sessiyalari bekor qilinadi. Savdo tarixi saqlanadi. Davom etasizmi?'))return;
                          try{await api.organizations.updateMember(organization.id,u.id,{action:u.archivedAt?'restore':'archive'});await loadUsers();notifySuccess(u.archivedAt?'Arxivdan tiklandi; hali bloklangan':'Xodim arxivlandi');}catch(error){notifyError(error instanceof Error?error.message:'Amal bajarilmadi');}
                        }}>{u.archivedAt?'Arxivdan tiklash':'Arxivlash'}</Button>
                      </div></td>
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
        onClose={() => {if(closeStore())setIsStoreModalOpen(false)}}
        title="Yangi do'kon yaratish"
        size="md"
      >
        <form onSubmit={handleCreateStore} className="space-y-4"><fieldset disabled={isSavingStore} className="space-y-4">
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
              onClick={() => {if(closeStore())setIsStoreModalOpen(false)}}
              disabled={isSavingStore}
            >
              Bekor qilish
            </Button>
            <Button type="submit" variant="primary" isLoading={isSavingStore} className="font-bold">
              Yaratish
            </Button>
          </div>
        </fieldset></form>
      </Modal>

      {/* Register Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => {if(closeRegister())setIsRegisterModalOpen(false)}}
        title="Yangi kassa terminali"
        size="md"
      >
        <form onSubmit={handleCreateRegister} className="space-y-4"><fieldset disabled={isSavingRegister} className="space-y-4">
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
              onClick={() => {if(closeRegister())setIsRegisterModalOpen(false)}}
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
        </fieldset></form>
      </Modal>

      {invitationId && <Card title="Bir martalik taklif havolasi">
        <p className="text-sm mb-2">Havola 72 soat amal qiladi. Uni faqat tegishli xodimga ulashing; umumiy chatga qo‘ymang.</p>
        {invitationLink?<Input label="Taklif havolasi" value={invitationLink} readOnly />:<p>Havola faqat bir marta beriladi. Bekor qilib yangi taklif yarating.</p>}
        <div className="flex gap-2 mt-2"><Button disabled={!invitationLink} onClick={()=>setInvitationLink('')}>Havolani yashirish</Button>
        <Button onClick={async()=>{if (!organization?.id) return;try{await api.organizations.revokeInvitation(organization.id,invitationId);setInvitationLink('');setInvitationId('');userMutation.current=null;notifySuccess('Taklif bekor qilindi');}catch(error){notifyError(error instanceof Error?error.message:'Taklif bekor qilinmadi');}}}>Taklifni bekor qilish</Button></div>
      </Card>}
      <Modal isOpen={Boolean(editingMember)} onClose={()=>{if(closeUser())setEditingMember(null)}} title="Xodim vakolatlari" size="md">
        <form className="space-y-4" onSubmit={async event=>{
          event.preventDefault();if (!organization?.id || !editingMember||userFlight.current) return;
          userFlight.current=true;
          const signature=JSON.stringify({organizationId:organization.id,id:editingMember.id,memberRole,memberStores});
          if(memberMutation.current?.signature!==signature)memberMutation.current={signature,operationId:crypto.randomUUID()};
          setIsSavingUser(true);
          try {await api.organizations.updateMember(organization.id,editingMember.id,{operationId:memberMutation.current.operationId,role:memberRole,storeIds:memberStores});memberMutation.current=null;setEditingMember(null);await loadUsers();notifySuccess('Vakolat yangilandi; xodim qayta kirishi kerak');}
          catch(error){notifyError(error instanceof Error?error.message:'Vakolat o‘zgarmadi');}finally{userFlight.current=false;setIsSavingUser(false);}
        }}>
          <fieldset disabled={isSavingUser} className="space-y-4">
          <Select label="Rol" value={memberRole} onChange={e=>setMemberRole(e.target.value as typeof memberRole)} options={[{value:'owner',label:'Egasi'},{value:'admin',label:'Administrator'},{value:'cashier',label:'Kassir'}]} />
          <fieldset><legend className="text-sm font-semibold">Filiallar</legend>{stores.map(store=><label key={store.id} className="flex gap-2 py-1"><input type="checkbox" checked={memberStores.includes(store.id)} onChange={e=>setMemberStores(old=>e.target.checked?[...old,store.id]:old.filter(id=>id!==store.id))}/>{store.name}</label>)}</fieldset>
          <Button type="submit" isLoading={isSavingUser}>Saqlash</Button>
        </fieldset></form>
      </Modal>
      {/* User Modal */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => {if(closeUser())setIsUserModalOpen(false)}}
        title="Yangi xodim qo'shish"
        size="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4"><fieldset disabled={isSavingUser} className="space-y-4">
          <Select label="Qo‘shish usuli" value={userMode} onChange={e=>setUserMode(e.target.value as 'direct'|'invite')} options={[{value:'direct',label:'Yangi hisob yaratish'},{value:'invite',label:'Bir martalik taklif havolasi'}]} />
          {userMode==='direct' && <Input
            label="Xodim to'liq ismi *"
            placeholder="Aziz Karimov"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            required
          />}
          <Input
            label="Telefon raqam *"
            type="tel"
            placeholder="901234567"
            value={userPhone}
            onChange={(e) => setUserPhone(e.target.value)}
            required
          />
          {userMode==='direct' && <Input
            label="Parol (kamida 8 ta belgi) *"
            type="password"
            placeholder="••••••••"
            value={userPassword}
            onChange={(e) => setUserPassword(e.target.value)}
            minLength={8} maxLength={72} required
          />}
          <Select
            label="Roli *"
            value={userRole}
            onChange={(e) => setUserRole(e.target.value as 'admin' | 'cashier')}
            options={[
              { value: 'cashier', label: 'Kassir (faqat POS va smena)' },
              { value: 'admin', label: 'Administrator (to\'liq nazorat)' },
            ]}
          />
          <fieldset><legend className="text-sm font-semibold">Filiallar</legend>{stores.map(store=><label key={store.id} className="flex gap-2 py-1"><input type="checkbox" checked={userStoreIds.includes(store.id)} onChange={e=>setUserStoreIds(old=>e.target.checked?[...old,store.id]:old.filter(id=>id!==store.id))}/>{store.name}</label>)}</fieldset>
          <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => {if(closeUser())setIsUserModalOpen(false)}}
              disabled={isSavingUser}
            >
              Bekor qilish
            </Button>
            <Button type="submit" variant="primary" isLoading={isSavingUser} className="font-bold">
              Qo&apos;shish
            </Button>
          </div>
        </fieldset></form>
      </Modal>
    </div>
  );
}
