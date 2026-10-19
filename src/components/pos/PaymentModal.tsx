'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import SerialPicker from '@/components/inventory/SerialPicker';
import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Customer, PaymentType } from '@/types';
import { fixed, displayed } from '@/lib/money';

import { useAuth } from '@/context/AuthContext';
import { dateBoundary } from '@/server/reports/dates';
import { useNotification } from '@/context/NotificationContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMoneyBillWave,
  faCreditCard,
  faBuildingColumns,
  faHandshake,
  faCheck,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';

interface PaymentModalProps {
  serialItems?:{productId:string;name:string;quantity:string}[];
  storeId?:string;
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  taxAmount?:string;
  netAmount?:string;
  customer: Customer | null;
  onProcessPayment: (payments: { paymentType: PaymentType; amount: number; referenceNo?: string }[], creditDueAt?:string, cashTendered?:string,serialSelections?:{productId:string;ids:string[]}[]) => Promise<void>;
  isLoading: boolean;
}

export default function PaymentModal({
  isOpen,
  serialItems=[],storeId,
  onClose,
  totalAmount,taxAmount,netAmount,
  customer,
  onProcessPayment,
  isLoading,
}: PaymentModalProps) {
 const {formatMoney}=useTranslation();

 const {t:tr}=useTranslation();

  const {organization}=useAuth();
  const [serialChoices,setSerialChoices]=useState<Record<string,string[]>>({});
  const [creditDueDate,setCreditDueDate]=useState('');
  const { notifyError } = useNotification();
  const [activeMethod, setActiveMethod] = useState<PaymentType | 'mixed'>('cash');
  const [mixedCash,setMixedCash]=useState('0');
  const [mixedCard,setMixedCard]=useState('0');
  const [mixedCredit,setMixedCredit]=useState('0');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [referenceNo, setReferenceNo] = useState<string>('');

  // When modal opens, reset tendered amount to totalAmount
  useEffect(() => {
    if (isOpen) {
      void Promise.resolve().then(() => {
        setCashTendered(String(totalAmount));
        setSerialChoices({});setReferenceNo('');setCreditDueDate('');
        setMixedCash(String(totalAmount));setMixedCard('0');setMixedCredit('0');
      });
    }
  }, [isOpen, totalAmount]);

  const validCash=(value:string)=>/^\d+(\.\d{1,2})?$/.test(value)&&fixed(value)<BigInt('100000000000000');
  const numericCash = validCash(cashTendered)?displayed(fixed(cashTendered)):0;
  const appliedMixedCash=validCash(mixedCash)?fixed(mixedCash):BigInt(0);
  const changeAmount = displayed(fixed(numericCash)>fixed(totalAmount)?fixed(numericCash)-fixed(totalAmount):BigInt(0));

  const quickAmounts = [
    totalAmount,
    Math.ceil(totalAmount / 10000) * 10000,
    Math.ceil(totalAmount / 50000) * 50000,
    100000,
    200000,
  ].filter((v, i, a) => v >= totalAmount && a.indexOf(v) === i);

  const handleComplete = async () => {
    if (activeMethod === 'credit') {
      if (!customer) {
        notifyError('Nasiya savdo uchun mijoz tanlanishi shart!');
        return;
      }
    }

    if (activeMethod === 'cash') {
      if (numericCash < totalAmount) {
        notifyError('Kiritilgan naqd pul jami summadan kam bo\'lishi mumkin emas!');
        return;
      }
    }

    let payments: {paymentType:PaymentType;amount:number;referenceNo?:string}[];
    if (activeMethod === 'mixed') {
      try {
        const parts=[{paymentType:'cash' as const,value:mixedCash},{paymentType:'card' as const,value:mixedCard},{paymentType:'credit' as const,value:mixedCredit}];
        if (parts.some(p=>!validCash(p.value)||fixed(p.value)<BigInt(0)) || parts.reduce((sum,p)=>sum+fixed(p.value),BigInt(0))!==fixed(totalAmount)) { notifyError('Aralash to‘lov jami chek summasiga teng bo‘lishi kerak'); return; }
        if (fixed(mixedCredit)>BigInt(0) && !customer) { notifyError('Nasiya uchun mijoz tanlang'); return; }
        payments=parts.filter(p=>fixed(p.value)>BigInt(0)).map(p=>({paymentType:p.paymentType,amount:displayed(fixed(p.value)),referenceNo:referenceNo||undefined}));
      } catch { notifyError('To‘lov miqdori noto‘g‘ri'); return; }
    } else payments=totalAmount===0?[]:[{paymentType:activeMethod,amount:totalAmount,referenceNo:referenceNo.trim()||undefined}];

    let creditDueAt:string|undefined;
    if(payments.some(payment=>payment.paymentType==='credit')&&creditDueDate){
      try{const deadline=new Date(dateBoundary(creditDueDate,organization?.timezone??'Asia/Tashkent',true).getTime()-1);if(deadline.getTime()<Date.now())throw new Error('Nasiya muddati o‘tgan sana bo‘lmasligi kerak');creditDueAt=deadline.toISOString();}
      catch(error){notifyError(displayErrorMessage(error,'Muddat noto‘g‘ri'));return;}
    }
    const applied=payments.filter(p=>p.paymentType==='cash').reduce((sum,p)=>sum+fixed(p.amount),BigInt(0));
    let tender:string|undefined;
    if(activeMethod==='cash'||(activeMethod==='mixed'&&applied>BigInt(0))){
      if(!validCash(cashTendered)||fixed(cashTendered)<applied){notifyError('Berilgan naqd pul naqd qismidan kam yoki format noto‘g‘ri');return;}
      tender=cashTendered;
    }
    if(serialItems.some(item=>(serialChoices[item.productId]?.length??0)!==Number(item.quantity))){notifyError('Har birlik uchun aniq serialni tanlang');return;}
    await onProcessPayment(payments,creditDueAt,tender,serialItems.length?serialItems.map(item=>({productId:item.productId,ids:serialChoices[item.productId]??[]})):undefined);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tr("To'lovni qabul qilish")}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {tr("Bekor qilish")}</Button>
          <Button
            variant="success"
            size="lg"
            onClick={handleComplete}
            isLoading={isLoading}
            leftIcon={<FontAwesomeIcon icon={faCheck} />}
            className="font-bold px-8 shadow-md shadow-emerald-500/20"
          >
            {tr("Savdoni yakunlash (")}{formatMoney(totalAmount)})
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
{storeId&&serialItems.map(item=><SerialPicker key={item.productId} storeId={storeId} productId={item.productId} label={item.name+" "+tr("sotiladigan seriallar (")+item.quantity+')'} value={serialChoices[item.productId]??[]} onChange={ids=>setSerialChoices(previous=>({...previous,[item.productId]:ids}))} disabled={isLoading}/>)}
      {taxAmount!==undefined&&<p>{tr("Server hisobi: jami ichidagi soliq qismi")}{' '}{taxAmount}{tr(", soliqsiz")}{' '}{netAmount}.</p>}
        {/* Total sum display */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-slate-300 font-semibold uppercase tracking-wider block">
              {tr("To'lanadigan summa")}</span>
            <span className="text-3xl font-black text-emerald-400">
              {formatMoney(totalAmount)}
            </span>
          </div>

          {customer && (
            <div className="text-right">
              <span className="text-xs text-slate-300 block">{tr("Mijoz")}</span>
              <span className="text-sm font-bold text-white">{customer.fullName}</span>
            </div>
          )}
        </div>

        {/* Payment method selector */}
        <div>
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-2.5">
            {tr("To'lov usulini tanlang")}</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'mixed', label: tr("Aralash"), icon: faMoneyBillWave, color: 'emerald' },
              { id: 'cash', label: tr("Naqd pul"), icon: faMoneyBillWave, color: 'emerald' },
              { id: 'card', label: tr("Karta (qo‘lda)"), icon: faCreditCard, color: 'blue' },
              { id: 'transfer', label: tr("O'tkazma"), icon: faBuildingColumns, color: 'purple' },
              { id: 'credit', label: tr("Nasiya / Qarz"), icon: faHandshake, color: 'amber' },
            ].map((m) => {
              const isSelected = activeMethod === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveMethod(m.id as PaymentType | 'mixed')}
                  className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm font-bold'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700 bg-white font-medium'
                  }`}
                >
                  <FontAwesomeIcon
                    icon={m.icon}
                    className={`text-2xl mb-2 ${isSelected ? 'text-emerald-700' : 'text-gray-600'}`}
                  />
                  <span className="text-xs">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {activeMethod === 'mixed' && <div className="grid gap-3 sm:grid-cols-3">
          <Input label={tr("Naqd")} type="number" min="0" step="0.01" value={mixedCash} onChange={e=>setMixedCash(e.target.value)}/>
          <Input label={tr("Karta (qo‘lda qayd)")} type="number" min="0" step="0.01" value={mixedCard} onChange={e=>setMixedCard(e.target.value)}/>
          <Input label={tr("Nasiya")} type="number" min="0" step="0.01" value={mixedCredit} onChange={e=>setMixedCredit(e.target.value)}/>
        </div>}
        {activeMethod==='mixed'&&<div><Input label={tr("Aralash to‘lovda berilgan naqd pul")} type="number" min="0" step="0.01" value={cashTendered} onChange={e=>setCashTendered(e.target.value)}/><p>{tr("Naqd qaytim:")}{' '}{formatMoney(displayed(fixed(numericCash)>appliedMixedCash?fixed(numericCash)-appliedMixedCash:BigInt(0)))}</p></div>}
        {/* Method-specific content */}
        {activeMethod === 'cash' && (
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
            <Input
              label={tr("Mijoz bergan naqd pul (so'm)")}
              type="number"
              min={totalAmount}
              step="1000"
              value={cashTendered}
              onChange={(e) => setCashTendered(e.target.value)}
              className="text-lg font-bold text-emerald-700"
            />

            {/* Quick cash buttons */}
            <div>
              <span className="text-xs font-semibold text-gray-600 block mb-2">
                {tr("Tezkor summalar:")}</span>
              <div className="flex flex-wrap gap-2">
                {quickAmounts.map((amt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCashTendered(String(amt))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-shadow ${
                      numericCash === amt
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {formatMoney(amt)}
                  </button>
                ))}
              </div>
            </div>

            {/* Change display */}
            <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-600">{tr("Qaytim:")}</span>
              <span
                className={`text-xl font-black ${
                  changeAmount > 0 ? 'text-blue-600' : 'text-gray-600'
                }`}
              >
                {formatMoney(changeAmount)}
              </span>
            </div>
          </div>
        )}

        {(activeMethod==='credit'||activeMethod==='mixed')&&<Input type="date" label={tr("Nasiya to‘lash muddati (ixtiyoriy)")} value={creditDueDate} onChange={event=>setCreditDueDate(event.target.value)} disabled={isLoading} helperText={tr("Muddat tashkilot vaqt zonasida kun oxirigacha hisoblanadi; faqat nasiya qismiga qo‘llanadi.")}/>}
        {activeMethod === 'credit' && (
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
              <FontAwesomeIcon icon={faExclamationTriangle} />
              <span>{tr("Nasiya savdo ogohlantirishi")}</span>
            </div>
            {customer ? (
              <div className="text-xs space-y-1">
                <p>
                  {tr("Mijoz:")}{' '}<strong>{customer.fullName}</strong> ({customer.phone})
                </p>
                <p>
                  {tr("Kredit limiti:")}{' '}
                  <strong>{formatMoney(customer.creditLimit || 0)}</strong>
                </p>
                <p className="text-gray-600">
                  {tr("Ushbu summa mijozning qarz hisobiga yoziladi.")}</p>
              </div>
            ) : (
              <p className="text-xs font-semibold text-red-600">
                {tr("Diqqat: Savatda mijoz tanlanmagan! Nasiya savdoni amalga oshirish uchun avval mijozni tanlang.")}</p>
            )}
          </div>
        )}

        {(activeMethod === 'card' || activeMethod === 'transfer') && (
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <Input
              label={tr("Kvitansiya / Chek / Tranzaksiya raqami (ixtiyoriy)")}
              placeholder={tr("Masalan: 987654")}
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
