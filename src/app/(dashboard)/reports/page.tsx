'use client';

import Link from 'next/link';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { api } from '@/lib/api';
import { ProductReportItem, Sale, SalesReportSummary } from '@/types';
import { formatMoney, formatNumber, formatDate } from '@/lib/format';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartLine,
  faFileCsv,
  faBoxesStacked,
  faRotateLeft,
} from '@fortawesome/free-solid-svg-icons';

export default function ReportsPage() {
  const { organization } = useAuth();
  const { activeStore } = useOrganization();

  const dateParts=new Intl.DateTimeFormat('en',{timeZone:organization?.timezone??'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const part=(type:string)=>dateParts.find(value=>value.type===type)?.value;
  const todayStr=`${part('year')}-${part('month')}-${part('day')}`;
  const firstDayStr=`${todayStr.slice(0,7)}-01`;

  const [activeTab, setActiveTab] = useState<'sales' | 'products'>('sales');
  const [startDate, setStartDate] = useState(firstDayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [salesReport, setSalesReport] = useState<Sale[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesReportSummary | null>(null);
  const [productsReport, setProductsReport] = useState<ProductReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadReport = useCallback(async () => {
    if (!organization?.id) return;
    setIsLoading(true);
    try {
      if (activeTab === 'sales') {
        const res = await api.reports.sales({
          organizationId: organization.id,
          storeId: activeStore?.id,
          startDate,
          endDate,
        });
        if (res.data) setSalesReport(res.data);
        if (res.summary) setSalesSummary(res.summary);
      } else {
        const res = await api.reports.products({
          organizationId: organization.id,
          storeId: activeStore?.id,
          startDate,
          endDate,
        });
        if (res.data) setProductsReport(res.data);
      }
    } catch (err: unknown) {
      console.error('Failed to load report:', err);
    } finally {
      setIsLoading(false);
    }
  }, [organization, activeStore, activeTab, startDate, endDate]);

  useEffect(() => {
    void Promise.resolve().then(loadReport);
  }, [loadReport]);

  // CSV Export utility
  const exportCSV = () => {
    if (activeTab === 'sales') {
      const rows = [
        ['Chek raqami', 'Sana', 'Mijoz', 'Summa', 'Holat'],
        ...salesReport.map((s) => [
          s.receiptNo,
          formatDate(s.completedAt || s.createdAt, true),
          s.customer?.fullName || 'Mijozsiz',
          s.totalAmount,
          s.status,
        ]),
      ];
      downloadCSV(rows, `savdolar_hisoboti_${startDate}_${endDate}.csv`);
    } else {
      const rows = [
        ['Mahsulot', 'SKU', 'Kategoriya', 'Sotilgan miqdor', 'Tushum', 'Tannarx', 'Yalpi foyda'],
        ...productsReport.map((p) => [
          p.name,
          p.sku,
          p.category?.name || '-',
          p.quantitySold,
          p.revenue,
          p.cost,
          p.profit,
        ]),
      ];
      downloadCSV(rows, `mahsulotlar_hisoboti_${startDate}_${endDate}.csv`);
    }
  };

  const downloadCSV = (rows: Array<Array<string | number>>, filename: string) => {
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      rows.map((e) => e.map((val) => `"${val}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Tahlil va Hisobotlar
          </h1>
          <Link href="/reports/reconciliation" className="text-sm text-blue-700">Qoldiq va pul hisobini solishtirish</Link>
          <p className="text-sm text-gray-500 mt-0.5">
            Savdo ko&apos;rsatkichlari, tovarlar aylanmasi, foyda va CSV eksport
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={exportCSV}
            leftIcon={<FontAwesomeIcon icon={faFileCsv} className="text-emerald-600 text-sm" />}
            className="font-bold"
          >
            CSV Eksport
          </Button>

          <Button
            variant="outline"
            onClick={loadReport}
            leftIcon={<FontAwesomeIcon icon={faRotateLeft} />}
          >
            Yangilash
          </Button>
        </div>
      </div>

      {/* Filter and Date selector */}
      <Card padding={false} className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('sales')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'sales'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FontAwesomeIcon icon={faChartLine} />
              Savdolar hisoboti
            </button>

            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'products'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FontAwesomeIcon icon={faBoxesStacked} />
              Mahsulotlar hisoboti
            </button>
          </div>

          {/* Date range pickers */}
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <span className="text-gray-400">Dan:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent focus:outline-hidden cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <span className="text-gray-400">Gacha:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent focus:outline-hidden cursor-pointer"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Tab 1: Sales Report */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          {/* Summary metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card padding={false} className="p-5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                Umumiy savdo summasi
              </span>
              <span className="text-2xl font-black text-gray-900 mt-2 block">
                {formatMoney(salesSummary?.totalRevenue || 0)}
              </span>
              <span className="text-xs text-gray-400 mt-1 block">Tanlangan davr uchun</span>
            </Card>

            <Card padding={false} className="p-5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                Cheklar soni
              </span>
              <span className="text-2xl font-black text-blue-600 mt-2 block">
                {formatNumber(salesReport.length)} ta
              </span>
              <span className="text-xs text-gray-400 mt-1 block">Yakunlangan cheklar</span>
            </Card>

            <Card padding={false} className="p-5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                O&apos;rtacha chek
              </span>
              <span className="text-2xl font-black text-purple-600 mt-2 block">
                {formatMoney(salesSummary?.averageSale || 0)}
              </span>
              <span className="text-xs text-gray-400 mt-1 block">1 chekka to&apos;g&apos;ri keladi</span>
            </Card>
          </div>

          {/* Sales table */}
          <Card
            title="Savdolar ro'yxati"
            subtitle={`${startDate} dan ${endDate} gacha amalga oshirilgan savdolar`}
            padding={false}
          >
            {isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <LoadingSpinner size="lg" text="Hisobot yuklanmoqda..." />
              </div>
            ) : salesReport.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-gray-400 text-xs">
                Bu davrda savdolar topilmadi
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">Chek №</th>
                      <th className="py-3 px-4">Sana</th>
                      <th className="py-3 px-4">Mijoz</th>
                      <th className="py-3 px-4 text-right">Summa</th>
                      <th className="py-3 px-4 text-center">Holat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {salesReport.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50/70 transition">
                        <td className="py-3 px-4 font-mono font-bold text-gray-900">
                          {s.receiptNo}
                        </td>
                        <td className="py-3 px-4 text-gray-600">
                          {formatDate(s.completedAt || s.createdAt, true)}
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {s.customer?.fullName || 'Mijozsiz'}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-gray-900">
                          {formatMoney(s.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-600">
                          Yakunlangan
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Products Report */}
      {activeTab === 'products' && (
        <Card
          title="Mahsulotlar kesimida sotuv va foyda hisoboti"
          subtitle="Sotilgan miqdor, yalpi tushum va tannarx solishtirmasi"
          padding={false}
        >
          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <LoadingSpinner size="lg" text="Hisobot yuklanmoqda..." />
            </div>
          ) : productsReport.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-400 text-xs">
              Bu davrda tovar sotuvlari topilmadi
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">Mahsulot</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4 text-center">Sotilgan miqdor</th>
                    <th className="py-3 px-4 text-right">Tushum</th>
                    <th className="py-3 px-4 text-right">Tannarx</th>
                    <th className="py-3 px-4 text-right">Yalpi foyda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {productsReport.map((p, idx) => {
                    const profit = Number(p.profit || 0);
                    return (
                      <tr key={idx} className="hover:bg-gray-50/70 transition">
                        <td className="py-3 px-4 font-bold text-gray-900">{p.name}</td>
                        <td className="py-3 px-4 font-mono text-gray-500">{p.sku}</td>
                        <td className="py-3 px-4 text-center font-bold text-blue-600">
                          {formatNumber(p.quantitySold)}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-800">
                          {formatMoney(p.revenue)}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-500 font-medium">
                          {formatMoney(p.cost)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`font-black ${
                              profit >= 0 ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {formatMoney(profit)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
