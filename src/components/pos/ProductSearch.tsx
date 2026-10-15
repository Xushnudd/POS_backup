'use client';

import {useTranslation} from '@/context/LocaleContext';

import React, { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { quickProductIds, QUICK_PRODUCT_LIMIT } from '@/lib/quick-products';
import { Category, Product } from '@/types';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSearch,
  faBarcode,
  faBoxesStacked,
  faPlus,
} from '@fortawesome/free-solid-svg-icons';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import CameraBarcodeScanner from '@/components/pos/CameraBarcodeScanner';

interface ProductSearchProps {
  products: Product[];
  categories: Category[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectProduct: (product: Product) => void;
  onCameraScan: (barcode: string) => void | Promise<void>;
  onKeyboardIdentifier: (identifier: string) => Promise<void>;
  isLoading: boolean;
  quickScope: string | null;
  onQuickSelect: (id: string) => Promise<void>;
}

export default function ProductSearch({
  products,
  categories,
  selectedCategoryId,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onSelectProduct,
  onCameraScan,
  onKeyboardIdentifier,
  isLoading,
  quickScope,
  onQuickSelect,
}: ProductSearchProps) {
 const {formatMoney}=useTranslation();

 const {t:tr}=useTranslation();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const [quick, setQuick] = useState<{scope: string | null; ids: string[]; products: Product[]}>({scope:null,ids:[],products:[]});
  const [quickError, setQuickError] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  const scanLock = useRef(false);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      let ids: string[] = [];
      try { if (quickScope) ids = quickProductIds(JSON.parse(localStorage.getItem(quickScope) || '[]')); } catch { /* Corrupt/disabled preferences never block checkout. */ }
      const rows = await Promise.all(ids.map(id => api.products.get(id).then(res => res.data?.isActive ? res.data : null).catch(() => null)));
      if (!cancelled) setQuick({scope:quickScope,ids,products:rows.filter((row): row is Product => row !== null && row !== undefined)});
    }
    void load();
    return () => { cancelled = true; };
  }, [quickScope]);
  function toggleQuick(product: Pick<Product, 'id'> & Partial<Product>) {
    if (!quickScope) return;
    const current = quick.scope === quickScope ? quick : {scope:quickScope,ids:[],products:[]};
    const removing = current.ids.includes(product.id);
    if (!removing && current.ids.length >= QUICK_PRODUCT_LIMIT) {setQuickError('Tezkor mahsulotlar chegarasi: 12 ta. Avval bittasini olib tashlang.');return;}
    const ids = removing ? current.ids.filter(id => id !== product.id) : [...current.ids, product.id];
    try {
      localStorage.setItem(quickScope, JSON.stringify(ids));
      setQuick({scope:quickScope,ids,products:removing ? current.products.filter(row => row.id !== product.id) : [...current.products,product as Product]});
      setQuickError('');
    } catch {setQuickError('Tezkor ro‘yxat saqlanmadi. Brauzer saqlash ruxsatini tekshiring.');}
  }

  // Auto-focus search input for fast barcode scanning
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Handle Enter key for fast barcode scan
  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = searchQuery.trim();
      if (!trimmed) return;

      // Resolve the complete scan against the server, never a stale debounced list.
      if (scanLock.current || e.repeat || e.nativeEvent.isComposing) return;
      scanLock.current = true; setScanBusy(true);
      try { await onKeyboardIdentifier(trimmed); }
      finally { scanLock.current = false; setScanBusy(false); }
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top: Search & Barcode input */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-600 pointer-events-none">
            <FontAwesomeIcon icon={faSearch} className="text-sm" />
            <span className="text-gray-200">|</span>
            <FontAwesomeIcon icon={faBarcode} className="text-sm" />
          </div>

          <input
            id="pos-product-search"
            aria-label={tr("POS mahsulot qidirish")}
            ref={searchInputRef}
            type="text"
            placeholder={tr("Mahsulot nomi yoki barkod...")}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-white text-gray-900 border border-gray-200 rounded-2xl pl-16 pr-4 py-3 text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-600 hover:text-gray-600 bg-gray-100 px-2 py-1 rounded-lg"
            >
              {tr("Tozalash")}</button>
          )}
        </div>

        <CameraBarcodeScanner
          onDetected={onCameraScan}
          className="shrink-0 border border-gray-200 bg-white p-3 text-base shadow-xs"
        />
      </div>

      {scanBusy && <p role="status">{tr("Barkod tekshirilmoqda…")}</p>}
      {quickError && <p role="alert">{quickError}</p>}
      {quick.scope === quickScope && quick.ids.length > 0 && <section aria-label={tr("Tezkor mahsulotlar")} className="flex flex-wrap gap-2">
        {quick.ids.map(id => {const product=quick.products.find(row=>row.id===id);return <div key={id} className="flex border rounded-xl bg-white">
          <button type="button" className="min-h-11 p-2 text-gray-900" disabled={!product} onClick={() => void onQuickSelect(id)}>{product?.name??tr("Mavjud bo‘lmagan mahsulot")} {tr("— tezkor")}</button>
          <button type="button" className="min-h-11 min-w-11 text-gray-900" aria-label={(product?.name??'Mavjud bo‘lmagan mahsulot')+' — tezkor ro‘yxatdan olib tashlash'} onClick={() => toggleQuick(product??{id})}>×</button>
        </div>;})}
      </section>}

      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => onSelectCategory('')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
            selectedCategoryId === ''
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          {tr("Barchasi (")}{products.length})
        </button>

        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(cat.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategoryId === cat.id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto" aria-busy={isLoading}>
        {isLoading && products.length > 0 && <p role="status" className="text-sm text-gray-700">{tr("Mahsulotlar yangilanmoqda…")}</p>}
        {isLoading && products.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <LoadingSpinner size="lg" text={tr("Mahsulotlar yuklanmoqda...")} />
          </div>
        ) : products.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-gray-600">
            <FontAwesomeIcon icon={faBoxesStacked} className="text-3xl text-gray-300 mb-2" />
            <p className="text-sm font-semibold text-gray-600">{tr("Mahsulot topilmadi")}</p>
            <p className="text-xs text-gray-600 mt-0.5">
              {tr("Qidiruv so'zini tekshiring yoki yangi mahsulot qo'shing")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {products.map((p) => (
              <div key={p.id} className="flex flex-col">
              <button
                type="button"
                aria-label={p.name+' — savatga qo‘shish'}
                data-focus-key={'pos-product:'+p.id}
                key={p.id}
                onClick={() => onSelectProduct(p)}
                className="group text-left min-h-28 focus-visible:ring-2 focus-visible:ring-blue-600 bg-white rounded-2xl p-3.5 border border-gray-200 hover:border-emerald-500 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between active:scale-98"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider truncate">
                      {p.category?.name || tr("Katalog")}
                    </span>
                    <span className="text-[10px] font-mono text-gray-600">
                      {p.unit || tr("dona")}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-gray-900 line-clamp-2 leading-snug group-hover:text-emerald-700 transition">
                    {p.name}
                  </h4>
                </div>

                <div className="pt-3 mt-2 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-black text-gray-950">
                    {formatMoney(p.salePrice)}
                  </span>
                  <div className="w-6 h-6 rounded-lg bg-gray-100 group-hover:bg-emerald-600 text-gray-600 group-hover:text-white flex items-center justify-center transition text-xs">
                    <FontAwesomeIcon icon={faPlus} />
                  </div>
                </div>
              </button>
              <button type="button" disabled={!quickScope||quick.scope!==quickScope} aria-pressed={quick.scope===quickScope&&quick.ids.includes(p.id)} aria-label={p.name+' — tezkor ro‘yxat'} className="min-h-11 text-xs text-gray-900 bg-white border rounded-xl" onClick={() => toggleQuick(p)}>{quick.scope===quickScope&&quick.ids.includes(p.id)?tr("Tezkor ro‘yxatdan olish"):tr("Tezkor ro‘yxatga qo‘shish")}</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
