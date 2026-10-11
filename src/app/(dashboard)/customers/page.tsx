'use client';

import CsvExportButton from '@/components/ui/CsvExportButton';
import Link from 'next/link';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { fixed } from '@/lib/money';
import { api } from '@/lib/api';
import { Customer } from '@/types';
import { formatMoney, formatPhone } from '@/lib/format';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers,
  faUserPlus,
  faSearch,
  faHandHoldingDollar,
  faPhone,
  faEdit,
} from '@fortawesome/free-solid-svg-icons';

export default function CustomersPage(){const {organization,user,role}=useAuth();return organization&&user&&role?<Customers key={[organization.id,user.id,role].join(':')}/>:null;}
function Customers() {
  const { organization,role } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Add / Edit Modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    address: '',
    note: '',
    creditLimit: '0',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [originalForm,setOriginalForm]=useState(formData);
  const dirty=isCustomerModalOpen&&(Object.keys(formData) as (keyof typeof formData)[]).some(key=>formData[key]!==originalForm[key]);
  const confirmDiscard=useUnsavedChanges(dirty,isSaving);
  const closeEditor=()=>{if(confirmDiscard())setIsCustomerModalOpen(false);};

  const loadCustomers = useCallback(async () => {
    if (!organization?.id) return;
    setIsLoading(true);
    try {
      const res = await api.customers.list({
        organizationId: organization.id,
        search: searchQuery || undefined,
        limit: 100,
      });

      if (res.data) {
        // Also load debts for each customer
        const customersWithDebt = await Promise.all(
          res.data.map(async (c) => {
            try {
              const debtRes = await api.customers.getDebt(c.id);
              return {
                ...c,
                debt: String(debtRes.data?.totalDebt ?? '0'),
              };
            } catch {
              return c;
            }
          })
        );
        setCustomers(customersWithDebt);
      }
    } catch (err: unknown) {
      console.error('Error loading customers:', err);
    } finally {
      setIsLoading(false);
    }
  }, [organization, searchQuery]);

  useEffect(() => {
    void Promise.resolve().then(loadCustomers);
  }, [loadCustomers]);

  const openCreateModal = () => {
    if(!confirmDiscard())return;
    setOriginalForm({fullName:'',phone:'',address:'',note:'',creditLimit:'1000000'});
    setEditingCustomer(null);
    setFormData({
      fullName: '',
      phone: '',
      address: '',
      note: '',
      creditLimit: '1000000',
    });
    setIsCustomerModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    if(!confirmDiscard())return;
    setOriginalForm({fullName:c.fullName,phone:c.phone,address:c.address||'',note:c.note||'',creditLimit:String(c.creditLimit||0)});
    setEditingCustomer(c);
    setFormData({
      fullName: c.fullName,
      phone: c.phone,
      address: c.address || '',
      note: c.note || '',
      creditLimit: String(c.creditLimit || 0),
    });
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id||isSaving) return;

    if (!formData.fullName || !formData.phone) {
      notifyError('Ism va telefon raqamini kiriting');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        organizationId: organization.id,
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim() || undefined,
        note: formData.note.trim() || undefined,
        creditLimit: formData.creditLimit.trim()||'0',
      };

      if (editingCustomer) {
        await api.customers.update(editingCustomer.id, payload);
        notifySuccess('Mijoz ma\'lumotlari yangilandi');
      } else {
        await api.customers.create(payload);
        notifySuccess('Yangi mijoz muvaffaqiyatli qo\'shildi');
      }

      setIsCustomerModalOpen(false);
      loadCustomers();
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Mijozni saqlashda xatolik');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {role==='owner'&&<Link href="/customers/duplicates" className="text-blue-700 underline">Legacy telefon dublikatlarini tekshirish</Link>}
      {organization&&role==='owner'&&<CsvExportButton path="/customers" params={{organizationId:organization.id,...(searchQuery?{search:searchQuery}:{})}} label="Mijozlarni CSV yuklash"/>}
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Mijozlar va Nasiya
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Doimiy xaridorlar ro&apos;yxati, kredit limitlari va qarzdorlik nazorati
          </p>
        </div>

        <Button
          variant="primary"
          onClick={openCreateModal}
          leftIcon={<FontAwesomeIcon icon={faUserPlus} />}
          className="font-bold shadow-md shadow-blue-500/20"
        >
          Yangi mijoz qo&apos;shish
        </Button>
      </div>

      {/* Search bar */}
      <Card padding={false} className="p-4">
        <div className="relative w-full">
          <input
            type="text"
            placeholder="Mijoz ismi yoki telefon raqami bo'yicha qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-hidden focus:border-blue-500"
          />
          <FontAwesomeIcon
            icon={faSearch}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"
          />
        </div>
      </Card>

      {/* Customers Table */}
      <Card padding={false}>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <LoadingSpinner size="lg" text="Mijozlar yuklanmoqda..." />
          </div>
        ) : customers.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-400">
            <FontAwesomeIcon icon={faUsers} className="text-4xl text-gray-300 mb-3" />
            <p className="text-base font-bold text-gray-700">Mijozlar topilmadi</p>
            <p className="text-xs text-gray-400 mt-1">
              Yangi mijoz qo&apos;shish uchun yuqoridagi tugmani bosing
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Mijoz</th>
                  <th className="py-3.5 px-4">Telefon</th>
                  <th className="py-3.5 px-4">Manzil</th>
                  <th className="py-3.5 px-4 text-right">Kredit limiti</th>
                  <th className="py-3.5 px-4 text-right">Joriy qarz</th>
                  <th className="py-3.5 px-4 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((c) => {
                  const hasDebt = fixed(c.debt ?? '0') > BigInt(0);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3.5 px-4 font-bold text-gray-900"><Link className="text-blue-700 underline" href={`/customers/${c.id}`}>{c.fullName}</Link><br/><Link className="text-blue-700 underline" href={`/customers/${c.id}/history`}>Xarid tarixi va merge</Link></td>
                      <td className="py-3.5 px-4 text-gray-700 font-mono">
                        {formatPhone(c.phone)}
                      </td>
                      <td className="py-3.5 px-4 text-gray-500">{c.address || '-'}</td>
                      <td className="py-3.5 px-4 text-right font-medium text-gray-600">
                        {formatMoney(c.creditLimit)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {hasDebt ? (
                          <span className="font-black text-red-600">
                            {formatMoney(c.debt)}
                          </span>
                        ) : (
                          <span className="text-gray-400">0 so&apos;m</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1">
                        {hasDebt && (
                          <Link href={`/customers/${c.id}?collect=1`} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-white font-bold">
                            <FontAwesomeIcon icon={faHandHoldingDollar} /> Qarzni undirish
                          </Link>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(c)}
                          leftIcon={<FontAwesomeIcon icon={faEdit} />}
                        >
                          Tahrirlash
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Customer Form Modal */}
      <Modal
        isOpen={isCustomerModalOpen}
        onClose={closeEditor}
        title={editingCustomer ? 'Mijozni tahrirlash' : 'Yangi mijoz qo\'shish'}
        size="md"
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4">
          {dirty&&<p role="status">Saqlanmagan mijoz o‘zgarishlari bor.</p>}
          <Input
            label="Mijoz to'liq ismi *"
            placeholder="Jamshid Ergashev"
            disabled={isSaving}
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            required
          />

          <Input
            label="Telefon raqami *"
            type="tel"
            placeholder="901234567"
            disabled={isSaving}
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            leftIcon={<FontAwesomeIcon icon={faPhone} className="text-xs" />}
            required
          />

          <Input
            label="Manzil"
            placeholder="Toshkent sh., Yunusobod tumani"
            disabled={isSaving}
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <Input
            label="Maksimal nasiya / kredit limiti (so'm)"
            type="number"
            min="0"
            step="0.01"
            placeholder="1000000"
            disabled={isSaving}
            value={formData.creditLimit}
            onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
            helperText="Mijozga berilishi mumkin bo'lgan maksimal qarz miqdori"
          />

          <Input
            label="Izoh (ixtiyoriy)"
            placeholder="Mijoz haqida qo'shimcha eslatma"
            disabled={isSaving}
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          />

          <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={closeEditor}
              disabled={isSaving}
            >
              Bekor qilish
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving} className="font-bold">
              {editingCustomer ? 'Saqlash' : 'Qo\'shish'}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
