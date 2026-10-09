'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DebtAllocationPicker } from '@/components/customers/DebtAllocationPicker';
import Select from '@/components/ui/Select';
import { CustomerSales } from '@/components/customers/CustomerSales';
import {CustomerAdvances} from '@/components/customers/CustomerAdvances';
import { CustomerLedger } from '@/components/customers/CustomerLedger';
import { deviceId, pendingOperations, enqueue, acknowledge } from '@/lib/offline';
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
  const collectionLinkHandled=useRef<string|null>(null);
  const params = useParams();
  const id = params?.id as string;
  const { organization, role, user } = useAuth();
  const { activeStore, activeShift } = useOrganization();
  const { notifySuccess, notifyError } = useNotification();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [debt, setDebt] = useState<string>('0');
  const [isLoading, setIsLoading] = useState(true);

  // Debt payment modal
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentType,setPaymentType]=useState<'cash'|'card'|'transfer'>('cash');
  const [paymentReference,setPaymentReference]=useState('');
  const [manualConfirmed,setManualConfirmed]=useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasPendingPayment,setHasPendingPayment]=useState(false);
  const [ledgerVersion,setLedgerVersion]=useState(0);
  const [allocationMode,setAllocationMode]=useState('fifo');
  const [allocations,setAllocations]=useState<{saleId:string|null;debtOriginId?:string;amount:string}[]>([]);
  const [localReady,setLocalReady]=useState(false);
  const [localError,setLocalError]=useState('');
  const [recoveryVersion,setRecoveryVersion]=useState(0);
  useEffect(()=>{
    if(!organization?.id||!user?.id||!id)return;
    let cancelled=false;
    void Promise.resolve().then(async()=>{
      if(cancelled)return;
      setLocalReady(false);setLocalError('');
      attempt.current=null;setHasPendingPayment(false);setIsDebtModalOpen(false);
      try {
        const queued=await pendingOperations({organizationId:organization.id,userId:user.id,deviceId:deviceId()});
        const saved=queued.find(operation=>operation.type==='debt.collect'&&operation.payload.customerId===id);
        if(!cancelled&&saved){
          const payload=saved.payload as Parameters<typeof api.payments.credit>[0];
          if(payload.organizationId!==organization.id||payload.customerId!==id||payload.operationId!==saved.id)throw new Error('Saqlangan to‘lov ma’lumotlari mos emas');
          attempt.current=payload;setHasPendingPayment(true);setPaymentAmount(String(payload.amount));setPaymentNote(payload.note??'');setPaymentType(payload.paymentType??'cash');setPaymentReference(payload.referenceNo??'');setManualConfirmed(payload.manualConfirmed??false);
          setAllocationMode(payload.allocations?'explicit':'fifo');setAllocations(payload.allocations??[]);setIsDebtModalOpen(true);
        }
        if(!cancelled)setLocalReady(true);
      }catch(error){if(!cancelled)setLocalError(error instanceof Error?error.message:'Lokal to‘lovlar yuklanmadi');}
    });
    return ()=>{cancelled=true;};
  },[organization?.id,user?.id,id,recoveryVersion]);


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

  useEffect(()=>{
    if(!localReady||!customer||customer.id!==id||collectionLinkHandled.current===id)return;
    collectionLinkHandled.current=id;
    const url=new URL(window.location.href);
    if(url.searchParams.get('collect')==='1') {
      url.searchParams.delete('collect');
      window.history.replaceState(null,'',url.pathname+url.search+url.hash);
      if(!attempt.current&&fixed(debt)>BigInt(0))void Promise.resolve().then(()=>{setPaymentAmount(debt);setAllocationMode('fifo');setAllocations([]);setIsDebtModalOpen(true);});
    }
  },[localReady,customer,id,debt]);

  const handleDebtPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !user?.id || !customer || !localReady) return;

    if(attempt.current&&attempt.current.customerId!==customer.id){notifyError('Oldingi mijoz to‘lovi natijasi noaniq. O‘sha mijoz kartasiga qayting');return;}
    const amt = paymentAmount.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(amt) || fixed(amt)<=BigInt(0)) {
      notifyError('To\'lov summasini kiriting');
      return;
    }

    if (!attempt.current && (!activeStore || !activeShift)) { notifyError('Qarzni undirish uchun do‘kon tanlab, smenani oching'); return; }
    if(!attempt.current && allocationMode==='explicit') {
      if(!allocations.length||allocations.length>200||allocations.some(item=>!/^\d+(\.\d{1,2})?$/.test(item.amount)||fixed(item.amount)<=BigInt(0))||allocations.reduce((sum,item)=>sum+fixed(item.amount),BigInt(0))!==fixed(amt)) {
        notifyError('Ajratilgan musbat summalar jami to‘lov summasiga teng bo‘lishi kerak (1–200 qarz)');return;
      }
    }
    const wasRetry=!!attempt.current;
    setIsProcessing(true);
    try {
      const scope={organizationId:organization.id,userId:user.id,deviceId:deviceId()};
      attempt.current ??= {
        organizationId: organization.id,
        storeId: activeStore!.id,
        customerId: customer.id,
        shiftId: activeShift!.id,
        operationId: crypto.randomUUID(),
        amount: amt,
        note: paymentNote.trim() || undefined,
        paymentType,
        ...(paymentType!=='cash'?{referenceNo:paymentReference.trim(),manualConfirmed}:{}),
        ...(allocationMode==='explicit'?{allocations:allocations.map(item=>({...item}))}:{}),
      };
      setHasPendingPayment(true);
      await enqueue({id:attempt.current.operationId,scope,type:'debt.collect',payload:attempt.current,state:'pending',createdAt:new Date().toISOString()});
      const response=await api.payments.credit(attempt.current);
      await acknowledge(attempt.current.operationId,'synced',response.data);

      attempt.current = null;setHasPendingPayment(false);setLedgerVersion(value=>value+1);setRecoveryVersion(value=>value+1);
      notifySuccess('Nasiya qarzi undirildi');
      setIsDebtModalOpen(false);
      setPaymentAmount('');
      // refresh debt
      const dRes = await api.customers.getDebt(customer.id);
      if (dRes.data) setDebt(String(dRes.data.totalDebt));
    } catch (err: unknown) {
      if(!wasRetry&&attempt.current&&err instanceof ApiError&&['VALIDATION_ERROR','DEBT_OVERPAYMENT','DUPLICATE_DEBT_TARGET','DEBT_ALLOCATION_TOTAL_MISMATCH','DEBT_TARGET_NOT_FOUND','DEBT_TARGET_OVERPAYMENT','DEBT_ALLOCATION_MISMATCH','MANUAL_PAYMENT_PROOF_REQUIRED','MANUAL_PAYMENT_DOCUMENT_REUSED'].includes(err.code??'')){
        try{await acknowledge(attempt.current.operationId,'rejected',undefined,err.code);attempt.current=null;setHasPendingPayment(false);}catch{notifyError('Lokal holat saqlanmadi. Oldingi to‘lov kaliti saqlangan; qayta tekshiring');}
      }
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
      {localError&&<Card><p role="alert">Lokal to‘lovlarni tekshirishda xato: {localError}. Yangi to‘lov vaqtincha bloklangan.</p><Button onClick={()=>setRecoveryVersion(v=>v+1)}>Lokal to‘lovlarni qayta tekshirish</Button></Card>}
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

        {(fixed(debt)>BigInt(0)||hasPendingPayment) && (
          <Button
            variant="success"
            disabled={!localReady}
            onClick={() => {
              if(!attempt.current){setAllocationMode('fifo');setAllocations([]);setPaymentType('cash');setPaymentReference('');setManualConfirmed(false);}
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

      <CustomerSales key={'sales:'+id} customerId={id} version={ledgerVersion}/>
      {role==='owner'&&<CustomerAdvances key={'advance:'+id} customerId={id} onChanged={async()=>{const response=await api.customers.getDebt(id);if(response.data)setDebt(String(response.data.totalDebt));setLedgerVersion(v=>v+1)}}/>}
      {role==='owner'&&<CustomerLedger key={id} customerId={id} version={ledgerVersion} onChanged={async()=>{const response=await api.customers.getDebt(id);if(response.data)setDebt(String(response.data.totalDebt));}}/>}
      {/* Debt Payment Modal */}
      <Modal
        isOpen={isDebtModalOpen}
        onClose={() => {if(!attempt.current&&!isProcessing)setIsDebtModalOpen(false);}}
        title="Qarzni undirish"
        size="md"
      >
        <form onSubmit={handleDebtPayment} className="space-y-4">
          {hasPendingPayment&&<p className="text-amber-700">Oldingi to‘lovning kaliti, smenasi va taqsimoti qurilmada saqlangan. Yangi to‘lov kiritishdan oldin shu amal natijasini tekshiring.</p>}
          {role==='owner'&&<Select label="Qarzni taqsimlash usuli" value={allocationMode} disabled={isProcessing||hasPendingPayment} onChange={event=>setAllocationMode(event.target.value)} options={[{value:'fifo',label:'Avtomatik FIFO'},{value:'explicit',label:'Aniq qarzlarni tanlash'}]}/>}
          {isDebtModalOpen&&allocationMode==='explicit'&&<DebtAllocationPicker key={customer.id} customerId={customer.id} disabled={isProcessing||hasPendingPayment} value={allocations} onChange={setAllocations}/>}

          <Input
            label="To'lov summasi (so'm) *"
            type="number"
            min="0.01"
            step="0.01"
            max={hasPendingPayment?undefined:debt}
            disabled={isProcessing || hasPendingPayment}
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            required
          />

          <Select label="Undirish usuli" value={paymentType} disabled={isProcessing||hasPendingPayment} onChange={event=>{setPaymentType(event.target.value as 'cash'|'card'|'transfer');setManualConfirmed(false);}} options={[{value:'cash',label:'Naqd'},{value:'card',label:'Karta — qo‘lda qayd'},{value:'transfer',label:'Bank o‘tkazmasi — qo‘lda qayd'}]}/>
          {paymentType!=='cash'&&<><p>Bu yerda tashqarida bajarilgan to‘lov qayd etiladi. Hujjatni tekshiring; bank amalini takrorlamang.</p><Input label="To‘lov hujjati raqami" value={paymentReference} maxLength={200} disabled={isProcessing||hasPendingPayment} onChange={event=>setPaymentReference(event.target.value)} required/><label className="flex gap-2"><input type="checkbox" checked={manualConfirmed} disabled={isProcessing||hasPendingPayment} onChange={event=>setManualConfirmed(event.target.checked)} required/>To‘lov haqiqatan bajarilganini tasdiqlayman</label></>}

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
