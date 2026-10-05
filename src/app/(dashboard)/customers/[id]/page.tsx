'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CustomerLedger } from '@/components/customers/CustomerLedger';
import { fixed } from '@/lib/money';
import { api, ApiError } from '@/lib/api';
import { Customer } from '@/types';
import { formatMoney, formatPhone } from '@/lib/format';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faHandHoldingDollar } from '@fortawesome/free-solid-svg-icons';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotification } from '@/context/NotificationContext';

export default function CustomerDetailPage() {
  const attempt=useRef<Parameters<typeof api.payments.credit>[0]|null>(null);
  const params = useParams();
  const id = params?.id as string;
  const { organization, role } = useAuth();
  const { activeStore, activeShift } = useOrganization();
  const { notifySuccess, notifyError } = useNotification();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [debt, setDebt] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(true);

  // Debt payment modal
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasPendingPayment,setHasPendingPayment]=useState(false);
  const [ledgerVersion,setLedgerVersion]=useState(0);

  useEffect(() => {
    if (!id) return;
    let isCancelled = false;

    Promise.all([api.customers.get(id), api.customers.getDebt(id)])
      .then(([cRes, dRes]) => {
        if (isCancelled) return;
        if (cRes.data) setCustomer(cRes.data);
        if (dRes.data) setDebt(String(dRes.data.totalDebt));
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [id]);

  const handleDebtPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !customer) return;

    if(attempt.current&&attempt.current.customerId!==customer.id){notifyError('Oldingi mijoz to‘lovi natijasi noaniq. O‘sha mijoz kartasiga qayting');return;}
    const amt = paymentAmount.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(amt) || fixed(amt)<=BigInt(0)) {
      notifyError('To\'lov summasini kiriting');
      return;
    }

    if (!attempt.current && (!activeStore || !activeShift)) { notifyError('Qarzni undirish uchun do‘kon tanlab, smenani oching'); return; }
    setIsProcessing(true);
    try {
      attempt.current ??= {
        organizationId: organization.id,
        storeId: activeStore!.id,
        customerId: customer.id,
        shiftId: activeShift!.id,
        operationId: crypto.randomUUID(),
        amount: amt,
        note: paymentNote.trim() || undefined,
      };
      setHasPendingPayment(true);
      await api.payments.credit(attempt.current);

      attempt.current = null;setHasPendingPayment(false);setLedgerVersion(value=>value+1);
      notifySuccess('Nasiya qarzi undirildi');
      setIsDebtModalOpen(false);
      setPaymentAmount('');
      // refresh debt
      const dRes = await api.customers.getDebt(customer.id);
      if (dRes.data) setDebt(String(dRes.data.totalDebt));
    } catch (err: unknown) {
      if(err instanceof ApiError && err.status && err.status>=400 && err.status<500){attempt.current=null;setHasPendingPayment(false);}
      notifyError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
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

        {fixed(debt)>BigInt(0) && (
          <Button
            variant="success"
            onClick={() => {
              setPaymentAmount(attempt.current?String(attempt.current.amount):debt);
              if(attempt.current)setPaymentNote(attempt.current.note??'');
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
              fixed(debt)>BigInt(0) ? 'text-red-600' : 'text-gray-900'
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

      {role==='owner'&&<CustomerLedger key={id} customerId={id} version={ledgerVersion} onChanged={async()=>{const response=await api.customers.getDebt(id);if(response.data)setDebt(String(response.data.totalDebt));}}/>}
      {/* Debt Payment Modal */}
      <Modal
        isOpen={isDebtModalOpen}
        onClose={() => {if(!attempt.current&&!isProcessing)setIsDebtModalOpen(false);}}
        title="Qarzni undirish"
        size="md"
      >
        <form onSubmit={handleDebtPayment} className="space-y-4">
          <Input
            label="To'lov summasi (so'm) *"
            type="number"
            min="0.01"
            step="0.01"
            max={debt}
            disabled={isProcessing || hasPendingPayment}
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            required
          />

          <Input
            label="Izoh"
            placeholder="Qarz to'lovi"
            disabled={isProcessing || hasPendingPayment}
            value={paymentNote}
            onChange={(e) => setPaymentNote(e.target.value)}
          />

          <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDebtModalOpen(false)}
              disabled={isProcessing || hasPendingPayment}
            >
              Bekor qilish
            </Button>
            <Button type="submit" variant="success" isLoading={isProcessing} className="font-bold">
              {hasPendingPayment?'Oldingi to‘lovni tekshirish':'Tasdiqlash'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
