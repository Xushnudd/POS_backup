'use client';

import {useTranslation} from '@/context/LocaleContext';

import CsvExportButton from '@/components/ui/CsvExportButton';
import Link from 'next/link';
import {useListQuery} from '@/hooks/useListQuery';
import {reportListSorts} from '@/lib/list-query';
import ListFilter from '@/components/ui/ListFilter';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import React, { Suspense, useRef, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { api } from '@/lib/api';
import { ProductReportItem, Sale, SalesReportSummary } from '@/types';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartLine,
  faBoxesStacked,
  faRotateLeft,
} from '@fortawesome/free-solid-svg-icons';

export default function ReportsPage(){const {organization,user,role}=useAuth();return <Suspense fallback={<LoadingSpinner/>}><ReportsContent key={[organization?.id,user?.id,role].join(':')}/></Suspense>}
function ReportsContent() {
 const {formatMoney,formatNumber,formatDate}=useTranslation();

 const {t:tr}=useTranslation();

  const {query,params:searchParams,changeQuery,replaceQuery}=useListQuery(reportListSorts,'default');
  const { organization,role } = useAuth();
  const { activeStore } = useOrganization();

  const dateParts=new Intl.DateTimeFormat('en',{timeZone:organization?.timezone??'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const part=(type:string)=>dateParts.find(value=>value.type===type)?.value;
  const todayStr=`${part('year')}-${part('month')}-${part('day')}`;
  const firstDayStr=`${todayStr.slice(0,7)}-01`;

  const activeTab=searchParams.get('tab')??'sales',customDates=searchParams.get('dateMode')==='custom';
  const startDate=searchParams.get('startDate')??(customDates?'':firstDayStr),endDate=searchParams.get('endDate')??(customDates?'':todayStr);
  const page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'default',search=query?.search??'',asOf=searchParams.get('asOf')??'',invalidQuery=!query||!['sales','products'].includes(activeTab);
  const [salesReport,setSalesReport]=useState<Sale[]>([]),[salesSummary,setSalesSummary]=useState<SalesReportSummary|null>(null),[productsReport,setProductsReport]=useState<ProductReportItem[]>([]);
  const [isLoading,setIsLoading]=useState(true),[error,setError]=useState(''),[pages,setPages]=useState(0),[totalCount,setTotalCount]=useState(0),[periodCount,setPeriodCount]=useState(0),[revision,setRevision]=useState(0);
  const requestVersion=useRef({value:0});

  const loadReport = useCallback(async () => {
    if (!organization?.id||invalidQuery) return;
    const version=++requestVersion.current.value;
    setIsLoading(true);setError('');
    try {
      if (activeTab === 'sales') {
        const res = await api.reports.sales({
          organizationId: organization.id,
          storeId: activeStore?.id,
          startDate,
          endDate,page,limit,sort,search,asOf:asOf||undefined,
        });
        if(version!==requestVersion.current.value)return;
        if(!asOf&&res.meta?.asOf)replaceQuery({asOf:res.meta.asOf,startDate,endDate,dateMode:'custom',tab:activeTab});setTotalCount(res.pagination?.total??0);setPages(res.pagination?.totalPages??0);
        if (res.data) setSalesReport(res.data);
        if (res.summary) setSalesSummary(res.summary);setPeriodCount(Number(res.meta?.periodSaleCount??res.pagination?.total??0));
      } else {
        const res = await api.reports.products({
          organizationId: organization.id,
          storeId: activeStore?.id,
          startDate,
          endDate,page,limit,sort,search,asOf:asOf||undefined,
        });
        if(version!==requestVersion.current.value)return;
        if(!asOf&&res.meta?.asOf)replaceQuery({asOf:res.meta.asOf,startDate,endDate,dateMode:'custom',tab:activeTab});setTotalCount(res.pagination?.total??0);setPages(res.pagination?.totalPages??0);
        if (res.data) setProductsReport(res.data);
      }
    } catch (err: unknown) {
      if(version===requestVersion.current.value){setError(err instanceof Error?err.message:'Hisobot yuklanmadi');}
    } finally {
      if(version===requestVersion.current.value)setIsLoading(false);
    }
  }, [organization, activeStore, activeTab, startDate, endDate,page,limit,sort,search,asOf,invalidQuery,replaceQuery]);

  useEffect(() => {
    const requests=requestVersion.current;let live=true;void Promise.resolve().then(()=>{if(live)return loadReport();});return()=>{live=false;requests.value++;};
  }, [loadReport,revision]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {tr("Tahlil va Hisobotlar")}</h1>
          <Link href="/reports/purchases" className="text-sm text-blue-700 mr-4">{tr("Xarid narxlari tahlili")}</Link>
          {role==='owner'&&<Link href="/reports/plans" className="text-sm text-blue-700 mr-4">{tr("Rejalashtirilgan hisobotlar")}</Link>}
          <Link href="/reports/reconciliation" className="text-sm text-blue-700">{tr("Qoldiq va pul hisobini solishtirish")}</Link>
          <p className="text-sm text-gray-500 mt-0.5">
            {tr("Savdo ko'rsatkichlari, tovarlar aylanmasi, foyda va CSV eksport")}</p>
        </div>

        <div className="flex items-center gap-2">
          {organization&&!isLoading&&!error&&asOf&&<CsvExportButton path={activeTab==='sales'?'/reports/sales':'/reports/products'} params={{organizationId:organization.id,startDate,endDate,asOf,sort,search,...(activeStore?.id?{storeId:activeStore.id}:{})}} label={tr("To‘liq hisobotni CSV yuklash")}/>}

          <Button
            variant="outline"
            onClick={()=>{changeQuery({asOf:''});setRevision(value=>value+1);}}
            leftIcon={<FontAwesomeIcon icon={faRotateLeft} />}
          >
            {tr("Yangilash")}</Button>
        </div>
      </div>

      {/* Filter and Date selector */}
      <Card padding={false} className="p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => {changeQuery({tab:'sales',page:'1',sort:'',asOf:''});}}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'sales'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FontAwesomeIcon icon={faChartLine} />
              {tr("Savdolar hisoboti")}</button>

            <button
              onClick={() => {changeQuery({tab:'products',page:'1',sort:'',asOf:''});}}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                activeTab === 'products'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FontAwesomeIcon icon={faBoxesStacked} />
              {tr("Mahsulotlar hisoboti")}</button>
          </div>

          {/* Date range pickers */}
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <span className="text-gray-400">{tr("Dan:")}</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {changeQuery({startDate:e.target.value,dateMode:'custom',page:'1',asOf:''});}}
                className="bg-transparent focus:outline-hidden cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <span className="text-gray-400">{tr("Gacha:")}</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {changeQuery({endDate:e.target.value,dateMode:'custom',page:'1',asOf:''});}}
                className="bg-transparent focus:outline-hidden cursor-pointer"
              />
            </div>
          </div>
        </div>
      </Card>

      <ListFilter search={search} sort={sort} label={activeTab==='products'?tr("Hisobot mahsuloti yoki SKU qidirish"):tr("Hisobot cheki yoki mijoz qidirish")} onChange={changeQuery} reset={{startDate:'',endDate:'',dateMode:'',asOf:'',tab:''}} options={[{value:'default',label:tr("Asl ketma-ketlik")},{value:'amount_asc',label:tr("Summa: o‘sish")},{value:'amount_desc',label:tr("Summa: kamayish")}]}/>{invalidQuery&&<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>}{isLoading&&!invalidQuery&&<p role="status">{tr("Hisobot yuklanmoqda…")}</p>}
      {error&&<p role="alert" className="text-red-700">{error}</p>}
      {asOf&&!isLoading&&!error&&<p className="text-xs text-slate-500">{tr("Hisob holati:")}{' '}{asOf}{tr(". Eksport ham shu holatdan olinadi; yangi amallarni olish uchun Yangilash ni bosing.")}</p>}
      {activeTab==='sales'&&salesSummary&&!isLoading&&!error&&<Card title={tr("Tovar va pul hisoblari")}><dl className="grid grid-cols-2 gap-3">{[['Yalpi savdo',salesSummary.grossRevenue],['Qaytarilgan tovar qiymati',salesSummary.refundAmount],['Naqd savdo',salesSummary.cashSales],['Naqd qarz undirish',salesSummary.cashDebtCollections],['Naqd refund',salesSummary.cashRefunds],['Nasiya savdo — pul tushumi emas',salesSummary.creditSales]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{formatMoney(value??'0')}</dd></div>)}</dl></Card>}
      {/* Tab 1: Sales Report */}
      {activeTab === 'sales' && !isLoading&&!error&&!invalidQuery&&(
        <div className="space-y-6">
          {/* Summary metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card padding={false} className="p-5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                {tr("Umumiy savdo summasi")}</span>
              <span className="text-2xl font-black text-gray-900 mt-2 block">
                {formatMoney(salesSummary?.totalRevenue || 0)}
              </span>
              <span className="text-xs text-gray-400 mt-1 block">{tr("Tanlangan davr uchun")}</span>
            </Card>

            <Card padding={false} className="p-5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                {tr("Cheklar soni")}</span>
              <span className="text-2xl font-black text-blue-600 mt-2 block">
                {formatNumber(periodCount)} {tr("ta")}</span>
              <span className="text-xs text-gray-400 mt-1 block">{tr("Yakunlangan cheklar")}</span>
            </Card>

            <Card padding={false} className="p-5">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                {tr("O'rtacha chek")}</span>
              <span className="text-2xl font-black text-purple-600 mt-2 block">
                {formatMoney(salesSummary?.averageSale || 0)}
              </span>
              <span className="text-xs text-gray-400 mt-1 block">{tr("1 chekka to'g'ri keladi")}</span>
            </Card>
          </div>

          {/* Sales table */}
          <Card
            title={tr("Savdolar ro'yxati")}
            subtitle={`${startDate} dan ${endDate} gacha amalga oshirilgan savdolar`}
            padding={false}
          >
            {isLoading ? (
              <div className="h-48 flex items-center justify-center">
                <LoadingSpinner size="lg" text={tr("Hisobot yuklanmoqda...")} />
              </div>
            ) : salesReport.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-gray-400 text-xs">
                {tr("Bu davrda savdolar topilmadi")}</div>
            ) : (
              <div className="overflow-x-auto">
                <DataTable className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 font-bold uppercase tracking-wider">
                      <th className="py-3 px-4">{tr("Chek №")}</th>
                      <th className="py-3 px-4">{tr("Sana")}</th>
                      <th className="py-3 px-4">{tr("Mijoz")}</th>
                      <th className="py-3 px-4 text-right">{tr("Summa")}</th>
                      <th className="py-3 px-4 text-center">{tr("Holat")}</th>
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
                          {s.customer?.fullName || tr("Mijozsiz")}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-gray-900">
                          {formatMoney(s.totalAmount)}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-600">
                          {tr("Yakunlangan")}</td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Products Report */}
      {activeTab === 'products' && !isLoading&&!error&&!invalidQuery&&(
        <Card
          title={tr("Mahsulotlar kesimida sotuv va foyda hisoboti")}
          subtitle={tr("Sotilgan miqdor, yalpi tushum va tannarx solishtirmasi")}
          padding={false}
        >
          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <LoadingSpinner size="lg" text={tr("Hisobot yuklanmoqda...")} />
            </div>
          ) : productsReport.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-400 text-xs">
              {tr("Bu davrda tovar sotuvlari topilmadi")}</div>
          ) : (
            <div className="overflow-x-auto">
              <DataTable className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">{tr("Mahsulot")}</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4 text-center">{tr("Sotilgan miqdor")}</th>
                    <th className="py-3 px-4 text-right">{tr("Tushum")}</th>
                    <th className="py-3 px-4 text-right">{tr("Tannarx")}</th>
                    <th className="py-3 px-4 text-right">{tr("Yalpi foyda")}</th>
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
              </DataTable>
            </div>
          )}
        </Card>
      )}
      <Pagination page={page} pages={pages} busy={isLoading&&!invalidQuery} blocked={invalidQuery||!!error} onPage={value=>changeQuery({page:String(value)})} retry={()=>{void loadReport();}}/><p>{tr("Filtrga mos yozuvlar:")}{' '}{totalCount}</p>{!invalidQuery&&page>Math.max(1,pages)&&<Button onClick={()=>changeQuery({page:'1'})}>{tr("Birinchi sahifaga qaytish")}</Button>}
      {activeTab==='sales'&&<p className="text-xs">{tr("Yig‘indilar tanlangan davr bo‘yicha. Qidiruv chek ro‘yxatini tanlaydi; davr pul va qarz hodisalarini saqlaydi.")}</p>}
    </div>
  );
}
