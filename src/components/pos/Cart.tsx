'use client';

import {useTranslation} from '@/context/LocaleContext';

import React, { useState } from 'react';
import DiscountInput from './DiscountInput';
import { CartItem as ICartItem, Customer } from '@/types';
import CartItem from './CartItem';
import Button from '@/components/ui/Button';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCartShopping,
  faTrash,
  faArrowRight,
  faPercent,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';

interface CartProps {
  items: ICartItem[];
  subtotal: number;
  totalAmount: number;
  cartDiscount: number;
  cartDiscountPercent?:number;
  onSetCartPercent:(value:number|undefined)=>void;
  discountReason:string;
  onSetDiscountReason:(value:string)=>void;
  customer: Customer | null;
  customers: Customer[];
  onSelectUnit:(productId:string,unit:string)=>void;
  onUpdateTradeQuantity:(productId:string,value:string)=>void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onUpdateDiscount: (productId: string, discount: number,percent?:number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onSetCartDiscount: (discount: number,percent?:number) => void;
  onSetCustomer: (customer: Customer | null) => void;
  onCheckout: () => void;
  disabled?: boolean;
}

export default function Cart({
  items,
  subtotal,
  totalAmount,
  cartDiscount,cartDiscountPercent,onSetCartPercent,discountReason,onSetDiscountReason,
  customer,
  customers,
  onUpdateQuantity,onSelectUnit,onUpdateTradeQuantity,
  onUpdateDiscount,
  onRemoveItem,
  onClearCart,
  onSetCartDiscount,
  onSetCustomer,
  onCheckout,
  disabled = false,
}: CartProps) {
 const {formatMoney}=useTranslation();

 const {t:tr}=useTranslation();

  const [showDiscountInput, setShowDiscountInput] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs flex flex-col h-full overflow-hidden">
      {/* Header: Customer selection */}
      <div className="p-3.5 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <label className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block mb-1">
              {tr("Mijoz (Nasiya uchun majburiy)")}</label>
            <div className="relative">
              <select
                value={customer?.id || ''}
                onChange={(e) => {
                  const c = customers.find((cust) => cust.id === e.target.value);
                  onSetCustomer(c || null);
                }}
                className="w-full text-xs font-semibold bg-white border border-gray-200 rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:border-blue-500 text-gray-800 cursor-pointer"
              >
                <option value="">{tr("Oddiy xaridor (Mijozsiz)")}</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.phone})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {customer && (
            <button
              onClick={() => onSetCustomer(null)}
              className="mt-4 p-1.5 text-gray-600 hover:text-red-500 rounded-lg hover:bg-gray-100 transition"
              title={tr("Mijozni olib tashlash")}
            >
              <FontAwesomeIcon icon={faTimes} className="text-xs" />
            </button>
          )}
        </div>
      </div>

      {/* Cart Items List */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-600">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-2xl mb-3 text-gray-300">
              <FontAwesomeIcon icon={faCartShopping} />
            </div>
            <p className="text-sm font-bold text-gray-600">{tr("Savat bo'sh")}</p>
            <p className="text-xs text-gray-600 mt-1 max-w-[200px]">
              {tr("Katalogdan mahsulot tanlang yoki barkodni skaner qiling")}</p>
          </div>
        ) : (
          items.map((item) => (
            <CartItem
              key={item.product.id}
              item={item}
              onUpdateQuantity={onUpdateQuantity} onSelectUnit={onSelectUnit} onUpdateTradeQuantity={onUpdateTradeQuantity} disabled={disabled}
              onUpdateDiscount={onUpdateDiscount}
              onRemove={onRemoveItem}
            />
          ))
        )}
      </div>

      {/* Footer: Totals & Checkout */}
      {items.length > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50/70 space-y-3">
          {/* Discount and Subtotal rows */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-gray-600 font-medium">
              <span>{tr("Oraliq summa:")}</span>
              <span className="font-semibold text-gray-800">{formatMoney(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDiscountInput(!showDiscountInput)}
                className="text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold"
              >
                <FontAwesomeIcon icon={faPercent} className="text-[10px]" />
                <span>{tr("Chegirma qo'llash")}</span>
              </button>
              {cartDiscount > 0 && (
                <span className="font-bold text-red-600">-{formatMoney(cartDiscount)}</span>
              )}
            </div>

            {showDiscountInput && (
              <div className="pt-1 pb-1">
                <DiscountInput label={tr("Butun chek chegirmasi")} amount={cartDiscount} percent={cartDiscountPercent} onChange={(amount,percent)=>{if(percent===undefined)onSetCartDiscount(amount);else onSetCartPercent(percent);}}/>

              </div>
            )}
          </div>

          <label className="block text-xs text-gray-900">{tr("Chegirma sababi")}<input aria-label={tr("Chegirma sababi")} maxLength={2000} value={discountReason} onChange={e=>onSetDiscountReason(e.target.value)} className="w-full border bg-white rounded-lg p-2"/></label>
          <p className="text-xs text-gray-700">{tr("Chegirma vakolati serverda tekshiriladi. Katta chegirmani rahbar o‘z hisobida tasdiqlaydi; sabab chekda saqlanadi.")}</p>
          {/* Big Total */}
          <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block">
                {tr("Jami to'lov")}</span>
              <span className="text-2xl font-black text-gray-900 leading-tight">
                {formatMoney(totalAmount)}
              </span>
            </div>

            <button
              type="button"
              onClick={onClearCart}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
              title={tr("Savatni tozalash")}
            >
              <FontAwesomeIcon icon={faTrash} className="text-sm" />
            </button>
          </div>

          {/* Checkout Button */}
          <Button
            variant="success"
            size="lg"
            fullWidth
            onClick={onCheckout}
            disabled={disabled}
            rightIcon={<FontAwesomeIcon icon={faArrowRight} />}
            className="font-black text-base shadow-md shadow-emerald-500/20 py-3.5"
          >
            {tr("To'lovga o'tish")}</Button>
        </div>
      )}
    </div>
  );
}
