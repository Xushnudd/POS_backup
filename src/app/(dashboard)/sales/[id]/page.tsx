'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Sale } from '@/types';
import { formatMoney, formatDate } from '@/lib/format';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ReceiptPreview from '@/components/pos/ReceiptPreview';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPrint, faBan } from '@fortawesome/free-solid-svg-icons';
import { useNotification } from '@/context/NotificationContext';

export default function SaleDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { notifySuccess, notifyError } = useNotification();

  const [sale, setSale] = useState<Sale | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    api.sales
      .get(id)
      .then((res) => {
        if (res.data) setSale(res.data);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  const handleVoid = async () => {
    if (!sale || !confirm('Haqiqatan ham bu savdoni bekor qilmoqchimisiz?')) return;
    try {
      await api.sales.void(sale.id);
      notifySuccess('Savdo bekor qilindi');
      router.push('/sales');
    } catch (err: any) {
      notifyError(err.message || 'Xatolik yuz berdi');
    }
  };

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Savdo tafsilotlari yuklanmoqda..." />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Savdo topilmadi</p>
        <Link href="/sales">
          <Button variant="outline">Savdolar ro&apos;yxatiga qaytish</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/sales">
            <Button variant="ghost" size="icon">
              <FontAwesomeIcon icon={faArrowLeft} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-gray-900">
              Chek #{sale.receiptNo}
            </h1>
            <p className="text-xs text-gray-500">
              {formatDate(sale.completedAt || sale.createdAt, true)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsReceiptOpen(true)}
            leftIcon={<FontAwesomeIcon icon={faPrint} />}
          >
            Chekni chop etish
          </Button>

          {sale.status === 'draft' && (
            <Button
              variant="danger"
              onClick={handleVoid}
              leftIcon={<FontAwesomeIcon icon={faBan} />}
            >
              Bekor qilish
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding={false} className="p-4">
          <span className="text-xs text-gray-500">Mijoz</span>
          <p className="font-bold text-gray-900 mt-1">
            {sale.customer ? sale.customer.fullName : 'Mijozsiz'}
          </p>
        </Card>

        <Card padding={false} className="p-4">
          <span className="text-xs text-gray-500">Holat</span>
          <div className="mt-1">
            <Badge variant={sale.status === 'completed' ? 'success' : 'warning'}>
              {sale.status}
            </Badge>
          </div>
        </Card>

        <Card padding={false} className="p-4">
          <span className="text-xs text-gray-500">Jami to&apos;lov</span>
          <p className="text-xl font-black text-emerald-600 mt-1">
            {formatMoney(sale.totalAmount)}
          </p>
        </Card>
      </div>

      <Card title="Mahsulotlar ro'yxati" padding={false}>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 font-bold uppercase">
              <th className="py-3 px-4">Mahsulot</th>
              <th className="py-3 px-4">SKU</th>
              <th className="py-3 px-4 text-center">Miqdor</th>
              <th className="py-3 px-4 text-right">Narxi</th>
              <th className="py-3 px-4 text-right">Chegirma</th>
              <th className="py-3 px-4 text-right">Jami</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sale.items.map((item, idx) => (
              <tr key={idx}>
                <td className="py-3 px-4 font-bold text-gray-900">{item.productName}</td>
                <td className="py-3 px-4 font-mono text-gray-500">{item.sku}</td>
                <td className="py-3 px-4 text-center font-bold">{item.quantity}</td>
                <td className="py-3 px-4 text-right">{formatMoney(item.unitPrice)}</td>
                <td className="py-3 px-4 text-right text-red-500">
                  {item.discountAmount > 0 ? `-${formatMoney(item.discountAmount)}` : '0'}
                </td>
                <td className="py-3 px-4 text-right font-black">
                  {formatMoney(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ReceiptPreview
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        sale={sale}
      />
    </div>
  );
}
