'use client';

import React, { useState } from 'react';
import { CartItem as ICartItem } from '@/types';
import { formatMoney } from '@/lib/format';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faMinus, faTrash, faPercent } from '@fortawesome/free-solid-svg-icons';

interface CartItemProps {
  item: ICartItem;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onUpdateDiscount: (productId: string, discount: number) => void;
  onRemove: (productId: string) => void;
}

export default function CartItem({
  item,
  onUpdateQuantity,
  onUpdateDiscount,
  onRemove,
}: CartItemProps) {
  const [showDiscount, setShowDiscount] = useState(false);

  return (
    <div className="p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition shadow-2xs space-y-2">
      {/* Top: Product Name, Unit price, and Delete */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-gray-900 truncate leading-snug">
            {item.product.name}
          </h4>
          <span className="text-[11px] text-gray-600 font-medium">
            {formatMoney(item.unitPrice)} / {item.product.unit || 'dona'}
          </span>
        </div>

        <button
          onClick={() => onRemove(item.product.id)}
          className="text-gray-600 hover:text-red-500 p-1 transition"
          title="O'chirish"
        >
          <FontAwesomeIcon icon={faTrash} className="text-xs" />
        </button>
      </div>

      {/* Middle: Quantity controls & Line Total */}
      <div className="flex items-center justify-between gap-2">
        {/* Quantity buttons */}
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
          <button
            type="button"
            aria-label={item.product.name+' miqdorini kamaytirish'}
            onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
            className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition active:scale-95"
          >
            <FontAwesomeIcon icon={faMinus} className="text-[10px]" />
          </button>

          <input
            aria-label={item.product.name+' miqdori'}
            type="number"
            min="0.1"
            step={item.product.unitPrecision===0 || item.product.unit==='dona'?'1':`0.${'0'.repeat(Math.max(0,(item.product.unitPrecision??6)-1))}1`}
            value={item.quantity}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val)) onUpdateQuantity(item.product.id, val);
            }}
            className="w-12 h-7 text-center text-xs font-bold bg-white text-gray-800 border-x border-gray-200 focus:outline-hidden"
          />

          <button
            type="button"
            aria-label={item.product.name+' miqdorini oshirish'}
            onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
            className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition active:scale-95"
          >
            <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
          </button>
        </div>

        {/* Total & Discount trigger */}
        <div className="text-right">
          <span className="text-xs font-extrabold text-gray-900 block">
            {formatMoney(item.lineTotal)}
          </span>
          <button
            type="button"
            onClick={() => setShowDiscount(!showDiscount)}
            className="text-[10px] text-blue-600 hover:underline inline-flex items-center gap-0.5"
          >
            <FontAwesomeIcon icon={faPercent} className="text-[8px]" />
            <span>{item.discountAmount > 0 ? `-${formatMoney(item.discountAmount)}` : 'Chegirma'}</span>
          </button>
        </div>
      </div>

      {/* Optional Line Discount Input */}
      {showDiscount && (
        <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
          <input
            type="number"
            placeholder="Chegirma summasi"
            min="0"
            max={item.quantity * item.unitPrice}
            value={item.discountAmount || ''}
            onChange={(e) => onUpdateDiscount(item.product.id, parseFloat(e.target.value) || 0)}
            className="w-full text-xs px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-red-600 font-semibold focus:outline-hidden focus:border-red-400"
          />
          <button
            onClick={() => setShowDiscount(false)}
            className="text-[10px] text-gray-600 font-semibold hover:text-gray-700"
          >
            Yopish
          </button>
        </div>
      )}
    </div>
  );
}
