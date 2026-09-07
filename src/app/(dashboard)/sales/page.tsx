'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotification } from '@/context/NotificationContext';
import { api } from '@/lib/api';
import { Sale } from '@/types';
import { formatMoney, formatDate } from '@/lib/format';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ReceiptPreview from '@/components/pos/ReceiptPreview';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faReceipt,
  faPrint,
  faBan,
  faRotateLeft,
  faEye,
} from '@fortawesome/free-solid-svg-icons';

export default function SalesPage() {
  const { organization } = useAuth();
  const { activeStore } = useOrganization();
  const { notifySuccess, notifyError } = useNotification();

  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Selected sale for receipt preview
  const [previewSale, setPreviewSale] = useState<Sale | null>(null);

  const loadSales = useCallback(async () => {
    if (!organization?.id) return;
    setIsLoading(true);
    try {
      const res = await api.sales.list({
        organizationId: organization.id,
        storeId: activeStore?.id,
        status: selectedStatus || undefined,
        page,
        limit: 20,
      });

      if (res.data) {
        setSales(res.data);
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages);
        }
      }
    } catch (err: any) {
      console.error('Error loading sales:', err);
    } finally {
      setIsLoading(false);
    }
  }, [organization?.id, activeStore?.id, selectedStatus, page]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const handleVoidSale = async (saleId: string) => {
    if (!confirm('Haqiqatan ham bu savdoni bekor qilmoqchimisiz?')) return;

    try {
      await api.sales.void(saleId);
      notifySuccess('Savdo muvaffaqiyatli bekor qilindi');
      loadSales();
    } catch (err: any) {
      notifyError(err.message || 'Savdoni bekor qilishda xatolik');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success" size="sm">Yakunlangan</Badge>;
      case 'draft':
        return <Badge variant="warning" size="sm">Qoralama</Badge>;
      case 'voided':
        return <Badge variant="danger" size="sm">Bekor qilingan</Badge>;
      case 'partially_returned':
      case 'returned':
        return <Badge variant="purple" size="sm">Qaytarilgan</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Savdolar jurnali
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Barcha amalga oshirilgan va qoralama savdolar tarixi va cheklar
          </p>
        </div>

        <Button
          variant="outline"
          onClick={loadSales}
          leftIcon={<FontAwesomeIcon icon={faRotateLeft} />}
        >
          Yangilash
        </Button>
      </div>

      {/* Filter Tabs */}
      <Card padding={false} className="p-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          {[
            { id: '', label: 'Barcha savdolar' },
            { id: 'completed', label: 'Yakunlangan' },
            { id: 'draft', label: 'Qoralama' },
            { id: 'voided', label: 'Bekor qilingan' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedStatus(tab.id);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                selectedStatus === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Sales Table */}
      <Card padding={false}>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <LoadingSpinner size="lg" text="Savdolar yuklanmoqda..." />
          </div>
        ) : sales.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-400">
            <FontAwesomeIcon icon={faReceipt} className="text-4xl text-gray-300 mb-3" />
            <p className="text-base font-bold text-gray-700">Savdolar topilmadi</p>
            <p className="text-xs text-gray-400 mt-1">Ushbu parametr bo&apos;yicha savdo yozuvlari mavjud emas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Chek №</th>
                  <th className="py-3.5 px-4">Sana va vaqt</th>
                  <th className="py-3.5 px-4">Mijoz</th>
                  <th className="py-3.5 px-4 text-center">Tovarlar</th>
                  <th className="py-3.5 px-4 text-right">Summa</th>
                  <th className="py-3.5 px-4 text-center">Holat</th>
                  <th className="py-3.5 px-4 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                      {sale.receiptNo}
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">
                      {formatDate(sale.completedAt || sale.createdAt, true)}
                    </td>
                    <td className="py-3.5 px-4">
                      {sale.customer ? (
                        <span className="font-semibold text-gray-800">
                          {sale.customer.fullName}
                        </span>
                      ) : (
                        <span className="text-gray-400">Mijozsiz</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-gray-700">
                      {sale.items?.length || 0} ta
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-gray-900">
                      {formatMoney(sale.totalAmount)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {getStatusBadge(sale.status)}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewSale(sale)}
                        leftIcon={<FontAwesomeIcon icon={faEye} />}
                      >
                        Ko&apos;rish
                      </Button>

                      {sale.status === 'draft' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleVoidSale(sale.id)}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          leftIcon={<FontAwesomeIcon icon={faBan} />}
                        >
                          Bekor qilish
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500">
              Sahifa {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Oldingi
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Keyingi
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Receipt Modal */}
      <ReceiptPreview
        isOpen={!!previewSale}
        onClose={() => setPreviewSale(null)}
        sale={previewSale}
      />
    </div>
  );
}
