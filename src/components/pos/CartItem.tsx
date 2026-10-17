'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import React, { useState } from 'react';
import {clientQuantitySum} from '@/lib/unit-conversion';
import DiscountInput from './DiscountInput';
import { CartItem as ICartItem } from '@/types';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faMinus, faTrash, faPercent } from '@fortawesome/free-solid-svg-icons';

interface CartItemProps {
  item: ICartItem;
  disabled?:boolean;
  onSelectUnit:(productId:string,unit:string)=>void;
  onUpdateTradeQuantity:(productId:string,value:string)=>void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onUpdateDiscount: (productId: string, discount: number,percent?:number) => void;
  onRemove: (productId: string) => void;
}

export default function CartItem({
  item,
  onUpdateQuantity,onSelectUnit,onUpdateTradeQuantity,disabled,
  onUpdateDiscount,
  onRemove,
}: CartItemProps) {
 const {message:uiMessage}=useTranslation();

 const {formatMoney}=useTranslation();

 const {t:tr}=useTranslation();

  const [showDiscount, setShowDiscount] = useState(false);
  const [unitError,setUnitError]=useState('');
  const precision=item.tradeUnit?(item.product.unitConversions?.find(row=>row.tradeUnit===item.tradeUnit)?.tradePrecision??6):(item.product.unitPrecision??(item.product.unit==='dona'?0:6));const quantityStep=precision===0?'1':`0.${'0'.repeat(precision-1)}1`;
  const changeTrade=(value:string)=>{if(value==='0'){onRemove(item.product.id);return}try{onUpdateTradeQuantity(item.product.id,value);setUnitError('')}catch(e){setUnitError(displayErrorMessage(e,'Birlik miqdori noto‘g‘ri'))}};

  return (
    <div className="p-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition shadow-2xs space-y-2">
      {/* Top: Product Name, Unit price, and Delete */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-gray-900 truncate leading-snug">
            {item.product.name}
          </h4>
          <span className="text-[11px] text-gray-600 font-medium">
            {formatMoney(item.unitPrice)} / {item.product.unit || tr("dona")}
          </span>
        </div>

        <button
          onClick={() => onRemove(item.product.id)}
          className="text-gray-600 hover:text-red-500 p-1 transition"
          title={tr("O'chirish")}
        >
          <FontAwesomeIcon icon={faTrash} className="text-xs" />
        </button>
      </div>

      {!!item.product.unitConversions?.length&&<label className="text-xs">{tr("Savdo birligi (tanlash miqdorni 1 ga, chegirmani 0 ga qaytaradi)")}<select aria-label={item.product.name+" "+tr("savdo birligi")} disabled={disabled} value={item.tradeUnit??item.product.unit} onChange={e=>{try{onSelectUnit(item.product.id,e.target.value);setUnitError('')}catch(error){setUnitError(displayErrorMessage(error,'Birlik tanlanmadi'))}}}><option value={item.product.unit}>{item.product.unit} {tr("(asosiy)")}</option>{item.product.unitConversions.filter(row=>row.isActive).map(row=><option key={row.tradeUnit} value={row.tradeUnit}>{row.tradeUnit}: 1 = {row.ratio} {item.product.unit}</option>)}</select></label>}
      {item.tradeUnit&&<p className="text-xs">{item.tradeQuantity} {item.tradeUnit} = {item.quantity} {item.product.unit}{tr("; narx asosiy birlik uchun.")}</p>}{unitError&&<p role="alert">{uiMessage(unitError)}</p>}
      {/* Middle: Quantity controls & Line Total */}
      <div className="flex items-center justify-between gap-2">
        {/* Quantity buttons */}
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
          <button
            type="button"
            aria-label={item.product.name+" "+tr("miqdorini kamaytirish")}
            onClick={() => item.tradeUnit?changeTrade(clientQuantitySum(item.tradeQuantity??'1',-1)):onUpdateQuantity(item.product.id, Number(clientQuantitySum(String(item.quantity),-1)))}
            className="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition active:scale-95"
          >
            <FontAwesomeIcon icon={faMinus} className="text-[10px]" />
          </button>

          <input
            aria-label={item.product.name+" "+tr("miqdori")}
            type="number"
            min={quantityStep}
            step={quantityStep}
            value={item.tradeUnit?item.tradeQuantity:item.quantity}
            onChange={(e) => {
              if(item.tradeUnit){changeTrade(e.target.value);return}const val = parseFloat(e.target.value);
              if (!isNaN(val)) onUpdateQuantity(item.product.id, val);
            }}
            className="w-12 h-7 text-center text-xs font-bold bg-white text-gray-800 border-x border-gray-200 focus:outline-hidden"
          />

          <button
            type="button"
            aria-label={item.product.name+" "+tr("miqdorini oshirish")}
            onClick={() => item.tradeUnit?changeTrade(clientQuantitySum(item.tradeQuantity??'1',1)):onUpdateQuantity(item.product.id, Number(clientQuantitySum(String(item.quantity),1)))}
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
            <span>{item.discountAmount > 0 ? `-${formatMoney(item.discountAmount)}` : tr("Chegirma")}</span>
          </button>
        </div>
      </div>

      {/* Optional Line Discount Input */}
      {showDiscount && (
        <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
          <DiscountInput label={item.product.name+" "+tr("qator chegirmasi")} amount={item.discountAmount} percent={item.discountPercent} onChange={(amount,percent)=>onUpdateDiscount(item.product.id,amount,percent)}/>
          <button
            onClick={() => setShowDiscount(false)}
            className="text-[10px] text-gray-600 font-semibold hover:text-gray-700"
          >
            {tr("Yopish")}</button>
        </div>
      )}
    </div>
  );
}
