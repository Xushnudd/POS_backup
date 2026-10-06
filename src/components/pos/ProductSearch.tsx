'use client';

import React, { useEffect, useRef } from 'react';
import { Category, Product } from '@/types';
import { formatMoney } from '@/lib/format';
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
  isLoading: boolean;
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
  isLoading,
}: ProductSearchProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input for fast barcode scanning
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Handle Enter key for fast barcode scan
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = searchQuery.trim();
      if (!trimmed) return;

      // Check if there is an exact barcode match
      const exactMatch = products.find(
        (p) => p.barcode === trimmed || p.sku.toLowerCase() === trimmed.toLowerCase()
      );

      if (exactMatch) {
        onSelectProduct(exactMatch);
        onSearchChange('');
      } else if (products.length === 1) {
        onSelectProduct(products[0]);
        onSearchChange('');
      }
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top: Search & Barcode input */}
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-400 pointer-events-none">
            <FontAwesomeIcon icon={faSearch} className="text-sm" />
            <span className="text-gray-200">|</span>
            <FontAwesomeIcon icon={faBarcode} className="text-sm" />
          </div>

          <input
            id="pos-product-search"
            aria-label="POS mahsulot qidirish"
            ref={searchInputRef}
            type="text"
            placeholder="Mahsulot nomi yoki barkod..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-white text-gray-900 border border-gray-200 rounded-2xl pl-16 pr-4 py-3 text-sm shadow-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600 bg-gray-100 px-2 py-1 rounded-lg"
            >
              Tozalash
            </button>
          )}
        </div>

        <CameraBarcodeScanner
          onDetected={onCameraScan}
          className="shrink-0 border border-gray-200 bg-white p-3 text-base shadow-xs"
        />
      </div>

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
          Barchasi ({products.length})
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
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <LoadingSpinner size="lg" text="Mahsulotlar yuklanmoqda..." />
          </div>
        ) : products.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-gray-400">
            <FontAwesomeIcon icon={faBoxesStacked} className="text-3xl text-gray-300 mb-2" />
            <p className="text-sm font-semibold text-gray-600">Mahsulot topilmadi</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Qidiruv so&apos;zini tekshiring yoki yangi mahsulot qo&apos;shing
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {products.map((p) => (
              <button
                type="button"
                aria-label={p.name+' — savatga qo‘shish'}
                key={p.id}
                onClick={() => onSelectProduct(p)}
                className="group text-left min-h-28 focus-visible:ring-2 focus-visible:ring-blue-600 bg-white rounded-2xl p-3.5 border border-gray-200 hover:border-emerald-500 hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between active:scale-98"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">
                      {p.category?.name || 'Katalog'}
                    </span>
                    <span className="text-[10px] font-mono text-gray-400">
                      {p.unit || 'dona'}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-gray-900 line-clamp-2 leading-snug group-hover:text-emerald-600 transition">
                    {p.name}
                  </h4>
                </div>

                <div className="pt-3 mt-2 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-black text-gray-950">
                    {formatMoney(p.salePrice)}
                  </span>
                  <div className="w-6 h-6 rounded-lg bg-gray-100 group-hover:bg-emerald-600 text-gray-500 group-hover:text-white flex items-center justify-center transition text-xs">
                    <FontAwesomeIcon icon={faPlus} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
