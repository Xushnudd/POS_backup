'use client';

import {useTranslation} from '@/context/LocaleContext';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import CsvExportButton from '@/components/ui/CsvExportButton';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { api } from '@/lib/api';
import { DashboardReportData } from '@/types';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faMoneyBillTrendUp,
  faReceipt,
  faScaleBalanced,
  faCreditCard,
  faMoneyBillWave,
  faTriangleExclamation,
  faCashRegister,
  faBoxesStacked,
  faWarehouse,
  faArrowRight,
  faCalendarDay,
} from '@fortawesome/free-solid-svg-icons';

export default function DashboardPage() {
 const {formatMoney,formatNumber}=useTranslation();

 const {t:tr}=useTranslation();

  const { organization,role } = useAuth();
  const router=useRouter();
  const { activeStore } = useOrganization();

  const [date, setDate] = useState<string>(new Intl.DateTimeFormat('en-CA',{timeZone:organization?.timezone??'Asia/Tashkent'}).format(new Date()));
  const [asOf,setAsOf]=useState(''),[error,setError]=useState('');
  const [data, setData] = useState<DashboardReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadDashboardData = useCallback(async () => {
    if (!organization?.id||role==='cashier') return;
    setIsLoading(true);setError('');setAsOf('');
    try {
      const res = await api.reports.dashboard({
        organizationId: organization.id,
        storeId: activeStore?.id,
        date,
      });
      if (res.data) {
        setData(res.data);setAsOf(res.meta?.asOf??'');
      }
    } catch (err) {
      setData(null);setError(err instanceof Error?err.message:'Dashboard yuklanmadi');
    } finally {
      setIsLoading(false);
    }
  }, [organization, activeStore, date,role]);

  useEffect(() => {
    void Promise.resolve().then(loadDashboardData);
  }, [loadDashboardData]);

  useEffect(()=>{if(role==='cashier')router.replace('/pos');},[role,router]);
  if(role==='cashier')return <p role="status">{tr("Kassaga o‘tilmoqda...")}</p>;
  return (
    <div data-testid="owner-dashboard" className="space-y-6 max-w-7xl min-w-0 mx-auto">
      {/* Top Banner: Welcome & Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {tr("Xush kelibsiz,")}{' '}{organization?.name || tr("Do'kon egasi")}!
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {tr("Bugungi kundalik savdo ko'rsatkichlari va asosiy analitika")}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <FontAwesomeIcon icon={faCalendarDay} className="text-gray-600 text-sm" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs font-bold text-gray-700 bg-transparent focus:outline-hidden cursor-pointer"
            />
          </div>

          <Link href="/pos">
            <Button
              variant="success"
              size="md"
              leftIcon={<FontAwesomeIcon icon={faCashRegister} />}
              className="font-bold shadow-md shadow-emerald-500/20"
            >
              {tr("Kassaga o'tish")}</Button>
          </Link>
        </div>
      </div>

      {error&&<p role="alert" className="text-red-700">{error}</p>}
      {organization&&asOf&&!isLoading&&!error&&<div className="flex flex-wrap gap-3 items-center"><p className="text-xs">{tr("Hisob holati:")}{' '}{asOf}</p><CsvExportButton path="/reports/sales" params={{organizationId:organization.id,startDate:date,endDate:date,asOf,...(activeStore?.id?{storeId:activeStore.id}:{})}} label={tr("Shu holatdagi savdolar CSV")}/><Link href={`/reports?startDate=${date}&endDate=${date}&asOf=${encodeURIComponent(asOf)}`}>{tr("Shu holatdagi jadval")}</Link><Button variant="outline" onClick={loadDashboardData}>{tr("Yangilash")}</Button></div>}
      {/* Metric Cards Grid */}
      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <LoadingSpinner size="lg" text={tr("Ko'rsatkichlar yuklanmoqda...")} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <Card padding={false} className="p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  {tr("Sof tovar tushumi")}</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-lg">
                  <FontAwesomeIcon icon={faMoneyBillTrendUp} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-gray-900">
                  {formatMoney(data?.totalRevenue || 0)}
                </span>
                <p className="text-xs text-gray-600 mt-1">{tr("Tanlangan sana bo'yicha")}</p>
              </div>
            </Card>

            {/* Check Count */}
            <Card padding={false} className="p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  {tr("Cheklar soni")}</span>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
                  <FontAwesomeIcon icon={faReceipt} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-gray-900">
                  {formatNumber(data?.totalSales || 0)} {tr("ta")}</span>
                <p className="text-xs text-gray-600 mt-1">{tr("Muvaffaqiyatli savdolar")}</p>
              </div>
            </Card>

            {/* Average Check */}
            <Card padding={false} className="p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  {tr("O'rtacha chek")}</span>
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg">
                  <FontAwesomeIcon icon={faScaleBalanced} />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-gray-900">
                  {formatMoney(data?.averageCheck || 0)}
                </span>
                <p className="text-xs text-gray-600 mt-1">{tr("Har bir savdo bo'yicha")}</p>
              </div>
            </Card>

            {/* Low stock alert */}
            <Card padding={false} className="p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                  {tr("Kam qolgan tovarlar")}</span>
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center text-lg">
                  <FontAwesomeIcon icon={faTriangleExclamation} />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-gray-900">
                    {data?.lowStockCount || 0} {tr("ta")}</span>
                  {Number(data?.lowStockCount) > 0 && (
                    <Badge variant="danger" size="sm">
                      {tr("Kirim zarur")}</Badge>
                  )}
                </div>
                <Link
                  href="/inventory"
                  className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1 font-semibold"
                >
                  <span>{tr("Ombor qoldiqlariga o'tish")}</span>
                  <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
                </Link>
              </div>
            </Card>
          </div>

          {/* Payment Breakdown & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payment breakdown */}
            <Card
              title={tr("To'lov turlari taqsimoti")}
              subtitle={tr("Bugungi savdolarning to'lov shakllari")}
              className="lg:col-span-1"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-sm">
                      <FontAwesomeIcon icon={faMoneyBillWave} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">{tr("Naqd pulda")}</span>
                      <span className="text-[11px] text-gray-600">{tr("Kassaga tushgan naqd")}</span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-emerald-700">
                    {formatMoney(data?.cashPayments || 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-blue-50/60 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm">
                      <FontAwesomeIcon icon={faCreditCard} />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">{tr("Plastik karta")}</span>
                      <span className="text-[11px] text-gray-600">{tr("Terminal orqali")}</span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-blue-700">
                    {formatMoney(data?.cardPayments || 0)}
                  </span>
                </div>

                <div className="pt-2 border-t border-gray-100 flex justify-between text-xs text-gray-600 font-semibold">
                  <span>{tr("Jami to'lovlar:")}</span>
                  <span className="text-gray-900 font-bold">
                    {formatMoney((data?.cashPayments || 0) + (data?.cardPayments || 0))}
                  </span>
                </div>
              </div>
            </Card>

            {/* Top Products */}
            <Card
              title={tr("Eng ko'p sotilgan mahsulotlar")}
              subtitle={tr("Bugungi kunda eng yaxshi natija ko'rsatgan 5 ta tovar")}
              className="lg:col-span-2"
              action={
                <Link href="/reports">
                  <Button variant="ghost" size="sm">
                    {tr("Barcha hisobotlar")}</Button>
                </Link>
              }
            >
              {data?.topProducts && data.topProducts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-600 font-bold uppercase tracking-wider">
                        <th className="pb-3">{tr("Mahsulot")}</th>
                        <th className="pb-3">SKU</th>
                        <th className="pb-3 text-center">{tr("Sotilgan miqdor")}</th>
                        <th className="pb-3 text-right">{tr("Tushum")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.topProducts.map((p, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/60 transition">
                          <td className="py-3 font-bold text-gray-900">{p.name}</td>
                          <td className="py-3 font-mono text-gray-600">{p.sku}</td>
                          <td className="py-3 text-center font-bold text-blue-600">
                            {formatNumber(p.quantity)}
                          </td>
                          <td className="py-3 text-right font-black text-gray-900">
                            {formatMoney(p.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-gray-600 text-xs font-medium">
                  {tr("Ushbu sanada savdo bo'yicha ma'lumot mavjud emas")}</div>
              )}
            </Card>
          </div>

          {/* Quick Actions Shortcuts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link
              href="/pos"
              className="p-4 bg-white rounded-2xl border border-gray-200 hover:border-emerald-500 hover:shadow-md transition flex items-center gap-3 text-gray-800 group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg group-hover:bg-emerald-600 group-hover:text-white transition">
                <FontAwesomeIcon icon={faCashRegister} />
              </div>
              <div>
                <span className="text-xs font-bold block">{tr("POS Kassa")}</span>
                <span className="text-[11px] text-gray-600">{tr("Yangi savdo ochish")}</span>
              </div>
            </Link>

            <Link
              href="/products"
              className="p-4 bg-white rounded-2xl border border-gray-200 hover:border-blue-500 hover:shadow-md transition flex items-center gap-3 text-gray-800 group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-lg group-hover:bg-blue-600 group-hover:text-white transition">
                <FontAwesomeIcon icon={faBoxesStacked} />
              </div>
              <div>
                <span className="text-xs font-bold block">{tr("Mahsulotlar")}</span>
                <span className="text-[11px] text-gray-600">{tr("Katalog va narxlar")}</span>
              </div>
            </Link>

            <Link
              href="/inventory"
              className="p-4 bg-white rounded-2xl border border-gray-200 hover:border-purple-500 hover:shadow-md transition flex items-center gap-3 text-gray-800 group"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-lg group-hover:bg-purple-600 group-hover:text-white transition">
                <FontAwesomeIcon icon={faWarehouse} />
              </div>
              <div>
                <span className="text-xs font-bold block">{tr("Ombor & Kirim")}</span>
                <span className="text-[11px] text-gray-600">{tr("Qoldiq va xaridlar")}</span>
              </div>
            </Link>

            <Link
              href="/shifts"
              className="p-4 bg-white rounded-2xl border border-gray-200 hover:border-amber-500 hover:shadow-md transition flex items-center gap-3 text-gray-800 group"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center text-lg group-hover:bg-amber-600 group-hover:text-white transition">
                <FontAwesomeIcon icon={faReceipt} />
              </div>
              <div>
                <span className="text-xs font-bold block">{tr("Smenalar")}</span>
                <span className="text-[11px] text-gray-600">{tr("Kassa nazorati")}</span>
              </div>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
