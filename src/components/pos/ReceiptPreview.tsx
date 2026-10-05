'use client';

import React, { useRef } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Sale } from '@/types';
import { formatMoney, formatDate } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPrint, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

interface ReceiptPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
}

export default function ReceiptPreview({
  isOpen,
  onClose,
  sale,
}: ReceiptPreviewProps) {
  const { organization, user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-emerald-600">
          <FontAwesomeIcon icon={faCheckCircle} />
          <span>Savdo muvaffaqiyatli yakunlandi</span>
        </div>
      }
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" onClick={onClose}>
            Yangi savdo
          </Button>
          <Button
            variant="primary"
            onClick={handlePrint}
            leftIcon={<FontAwesomeIcon icon={faPrint} />}
            className="font-bold shadow-md"
          >
            Chekni chop etish
          </Button>
        </div>
      }
    >
      {/* Printable Receipt Paper */}
      <div
        ref={printRef}
        id="printable-receipt"
        className="bg-white p-6 border border-dashed border-gray-300 rounded-xl max-w-sm mx-auto font-mono text-xs text-gray-800"
      >
        {/* Header */}
        <div className="text-center pb-3 border-b border-dashed border-gray-300">
          <h2 className="text-base font-black uppercase text-gray-900 tracking-wider">
            {organization?.name || 'SHUNI POS'}
          </h2>
          {organization?.phone && (
            <p className="text-[11px] text-gray-600 mt-0.5">Tel: {organization.phone}</p>
          )}
          {organization?.tin && (
            <p className="text-[11px] text-gray-600">STIR: {organization.tin}</p>
          )}
        </div>

        {/* Info */}
        <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-gray-500">Chek raqami:</span>
            <span className="font-bold">{sale.receiptNo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Sana:</span>
            <span>{formatDate(sale.completedAt || sale.createdAt, true)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Kassir:</span>
            <span>{user?.fullName || 'Kassir'}</span>
          </div>
          {sale.customer && (
            <div className="flex justify-between">
              <span className="text-gray-500">Mijoz:</span>
              <span className="font-semibold">{sale.customer.fullName}</span>
            </div>
          )}
        </div>

        {/* Items List */}
        <div className="py-2.5 border-b border-dashed border-gray-300">
          <div className="flex justify-between font-bold pb-1 text-[11px] text-gray-500 uppercase">
            <span>Mahsulot</span>
            <span>Summa</span>
          </div>
          <div className="space-y-2 mt-1">
            {sale.items.map((item, idx) => (
              <div key={idx} className="flex flex-col text-[11px]">
                <div className="flex justify-between font-medium text-gray-900">
                  <span className="truncate max-w-[200px]">{item.productName}</span>
                  <span className="font-bold">{formatMoney(item.lineTotal)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>
                    {item.quantity} {item.unit??''} x {formatMoney(item.unitPrice)}
                  </span>
                  {item.discountAmount > 0 && (
                    <span className="text-red-500">
                      Chegirma: -{formatMoney(item.discountAmount)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="py-3 border-b border-dashed border-gray-300 space-y-1.5 text-[11px]">
          <div className="flex justify-between text-gray-600">
            <span>Oraliq summa:</span>
            <span>{formatMoney(sale.subtotal)}</span>
          </div>
          {sale.discountAmount > 0 && (
            <div className="flex justify-between text-red-600 font-medium">
              <span>Umumiy chegirma:</span>
              <span>-{formatMoney(sale.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-black text-gray-950 pt-1 border-t border-gray-200">
            <span>JAMI TO&apos;LOV:</span>
            <span className="text-emerald-700">{formatMoney(sale.totalAmount)}</span>
          </div>
        </div>

        {/* Payments breakdown */}
        {sale.payments && sale.payments.length > 0 && (
          <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1 text-[11px]">
            <span className="text-gray-500 font-bold block mb-1">To&apos;lov turi:</span>
            {sale.payments.map((p, idx) => {
              const pTypeLabels: Record<string, string> = {
                cash: 'Naqd pul',
                card: 'Plastik karta',
                transfer: 'O\'tkazma',
                credit: 'Nasiya / Qarz',
              };
              return (
                <div key={idx} className="flex justify-between text-gray-700">
                  <span>{pTypeLabels[p.paymentType] || p.paymentType}:</span>
                  <span className="font-semibold">{formatMoney(p.amount)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer message */}
        <div className="text-center pt-4 text-[11px] text-gray-500">
          <p>{organization?.receiptFooter || 'Xaridingiz uchun rahmat!'}</p>
          <p className="text-[9px] text-gray-400 mt-2">Dastur: Shuni POS</p>
        </div>
      </div>
    </Modal>
  );
}
