'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Customer } from '@/types';
import { formatMoney, formatPhone } from '@/lib/format';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faEdit, faHandHoldingDollar } from '@fortawesome/free-solid-svg-icons';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotification } from '@/context/NotificationContext';

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { organization } = useAuth();
  const { activeStore } = useOrganization();
  const { notifySuccess, notifyError } = useNotification();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [debt, setDebt] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Debt payment modal
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    Promise.all([api.customers.get(id), api.customers.getDebt(id)])
      .then(([cRes, dRes]) => {
        if (cRes.data) setCustomer(cRes.data);
        if (dRes.data) setDebt(dRes.data.debt || 0);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, [id]);

  const handleDebtPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !activeStore?.id || !customer) return;

    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      notifyError('To\'lov summasini kiriting');
      return;
    }

    setIsProcessing(true);
    try {
      await api.payments.credit({
        organizationId: organization.id,
        storeId: activeStore.id,
        customerId: customer.id,
        amount: amt,
        note: paymentNote.trim() || undefined,
      });

      notifySuccess('Nasiya qarzi undirildi');
      setIsDebtModalOpen(false);
      setPaymentAmount('');
      // refresh debt
      const dRes = await api.customers.getDebt(customer.id);
      if (dRes.data) setDebt(dRes.data.debt || 0);
    } catch (err: any) {
      notifyError(err.message || 'Xatolik yuz berdi');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Mijoz ma'lumotlari yuklanmoqda..." />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Mijoz topilmadi</p>
        <Link href="/customers">
          <Button variant="outline">Mijozlarga qaytish</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/customers">
            <Button variant="ghost" size="icon">
              <FontAwesomeIcon icon={faArrowLeft} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-gray-900">{customer.fullName}</h1>
            <p className="text-xs text-gray-500">{formatPhone(customer.phone)}</p>
          </div>
        </div>

        {debt > 0 && (
          <Button
            variant="success"
            onClick={() => {
              setPaymentAmount(String(debt));
              setIsDebtModalOpen(true);
            }}
            leftIcon={<FontAwesomeIcon icon={faHandHoldingDollar} />}
          >
            Qarzni undirish
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card padding={false} className="p-4">
          <span className="text-xs text-gray-500">Joriy qarzdorlik</span>
          <p
            className={`text-2xl font-black mt-1 ${
              debt > 0 ? 'text-red-600' : 'text-gray-900'
            }`}
          >
            {formatMoney(debt)}
          </p>
        </Card>

        <Card padding={false} className="p-4">
          <span className="text-xs text-gray-500">Kredit / Nasiya limiti</span>
          <p className="text-2xl font-black text-gray-900 mt-1">
            {formatMoney(customer.creditLimit)}
          </p>
        </Card>
      </div>

      <Card title="Mijoz ma'lumotlari">
        <div className="space-y-3 text-xs">
          <div>
            <span className="text-gray-500">Manzil:</span>
            <p className="font-semibold text-gray-900 text-sm mt-0.5">
              {customer.address || 'Ko\'rsatilmagan'}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Izoh:</span>
            <p className="font-semibold text-gray-900 text-sm mt-0.5">
              {customer.note || 'Mavjud emas'}
            </p>
          </div>
        </div>
      </Card>

      {/* Debt Payment Modal */}
      <Modal
        isOpen={isDebtModalOpen}
        onClose={() => setIsDebtModalOpen(false)}
        title="Qarzni undirish"
        size="md"
      >
        <form onSubmit={handleDebtPayment} className="space-y-4">
          <Input
            label="To'lov summasi (so'm) *"
            type="number"
            min="1"
            max={debt}
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            required
          />

          <Input
            label="Izoh"
            placeholder="Qarz to'lovi"
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
          />

          <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDebtModalOpen(false)}
              disabled={isProcessing}
            >
              Bekor qilish
            </Button>
            <Button type="submit" variant="success" isLoading={isProcessing} className="font-bold">
              Tasdiqlash
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
