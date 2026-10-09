import {clientBaseQuantity,clientQuantitySum} from '@/lib/unit-conversion';
import { clientLine, clientPercentage, fixed, displayed } from '@/lib/money';
import { useState, useCallback, useMemo } from 'react';
import { CartItem, Customer, Product } from '@/types';

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [amountDiscount, setAmountDiscount] = useState<number>(0);
  const [cartDiscountPercent,setCartDiscountPercent]=useState<number|undefined>();
  const [discountReason,setDiscountReason]=useState('');
  const setCartDiscount=useCallback((value:number)=>{setCartDiscountPercent(undefined);setAmountDiscount(value);},[]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [note, setNote] = useState<string>('');

  const addItem = useCallback((product: Product, quantity: number = 1) => {
    setItems((prev) => {
      const existingIdx = prev.findIndex((item) => item.product.id === product.id);

      if (existingIdx > -1) {
        const updated = [...prev];
        const currentItem = updated[existingIdx];
        const tradeQuantity=currentItem.tradeUnit?clientQuantitySum(currentItem.tradeQuantity??'1',quantity):undefined;
        const newQty = tradeQuantity?Number(clientBaseQuantity(tradeQuantity,currentItem.conversionRatio??'1',product.unitPrecision??6)):currentItem.quantity + quantity;
        const discountAmount=currentItem.discountPercent===undefined?currentItem.discountAmount:clientPercentage(clientLine(newQty,currentItem.unitPrice),currentItem.discountPercent);
        const lineTotal = clientLine(newQty, currentItem.unitPrice, discountAmount);

        updated[existingIdx] = {
          ...currentItem,
          quantity: newQty,tradeQuantity,discountAmount,
          lineTotal: Math.max(0, lineTotal),
        };
        return updated;
      }

      const unitPrice = Number(product.salePrice);
      const lineTotal = clientLine(quantity, unitPrice);

      return [
        ...prev,
        {
          product,
          quantity,
          unitPrice,
          discountAmount: 0,
          lineTotal,
        },
      ];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.product.id !== productId));
      return;
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const discountAmount=item.discountPercent===undefined?item.discountAmount:clientPercentage(clientLine(quantity,item.unitPrice),item.discountPercent);
          const lineTotal = clientLine(quantity, item.unitPrice, discountAmount);
          return {
            ...item,
            quantity,discountAmount,
            lineTotal: Math.max(0, lineTotal),
          };
        }
        return item;
      })
    );
  }, []);

  const selectTradeUnit=useCallback((productId:string,tradeUnit:string)=>{
    const item=items.find(row=>row.product.id===productId);if(!item)return;const conversion=item.product.unitConversions?.find(row=>row.tradeUnit===tradeUnit&&row.isActive);
    if(tradeUnit!==item.product.unit&&!conversion)throw new Error('Birlik nisbati mavjud emas');const ratio=conversion?.ratio??'1',quantity=Number(clientBaseQuantity('1',ratio,item.product.unitPrecision??6));const lineTotal=clientLine(quantity,item.unitPrice);
    setItems(previous=>previous.map(row=>row.product.id===productId?{...row,tradeUnit:conversion?tradeUnit:undefined,conversionRatio:conversion?.ratio,tradeQuantity:conversion?'1':undefined,quantity,discountAmount:0,discountPercent:undefined,lineTotal}:row));
  },[items]);
  const updateTradeQuantity=useCallback((productId:string,value:string)=>{
    const item=items.find(row=>row.product.id===productId);if(!item)return;const conversion=item.product.unitConversions?.find(row=>row.tradeUnit===item.tradeUnit),precision=conversion?.tradePrecision??6;
    if(fixed(value,6)%BigInt(10)**BigInt(6-precision)!==BigInt(0))throw new Error('Savdo birligi kasr aniqligiga mos emas');const quantity=Number(clientBaseQuantity(value,item.conversionRatio??'1',item.product.unitPrecision??6)),discountAmount=item.discountPercent===undefined?item.discountAmount:clientPercentage(clientLine(quantity,item.unitPrice),item.discountPercent),lineTotal=clientLine(quantity,item.unitPrice,discountAmount);
    setItems(previous=>previous.map(row=>row.product.id===productId?{...row,tradeQuantity:value,quantity,discountAmount,lineTotal}:row));
  },[items]);

  const updateLineDiscount = useCallback(
    (productId: string, discountAmount: number,discountPercent?:number) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.product.id === productId) {
            const safeDiscount = discountPercent===undefined?Math.max(0, Math.min(discountAmount, clientLine(item.quantity,item.unitPrice))):clientPercentage(clientLine(item.quantity,item.unitPrice),discountPercent);
            const lineTotal = clientLine(item.quantity, item.unitPrice, safeDiscount);
            return {
              ...item,
              discountAmount: safeDiscount,discountPercent,
              lineTotal,
            };
          }
          return item;
        })
      );
    },
    []
  );

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCartDiscount(0);
    setCustomer(null);
    setNote('');setCartDiscountPercent(undefined);setDiscountReason('');
  }, [setCartDiscount]);

  const subtotal = useMemo(() => {
    return displayed(items.reduce((sum, item) => sum + fixed(item.lineTotal), BigInt(0)));
  }, [items]);

  const cartDiscount=cartDiscountPercent===undefined?amountDiscount:clientPercentage(subtotal,cartDiscountPercent);
  const totalAmount = useMemo(() => {
    const net=fixed(subtotal)-fixed(Number(cartDiscount)||0);
    return displayed(net<BigInt(0)?BigInt(0):net);
  }, [subtotal, cartDiscount]);

  const itemCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const hydrate = useCallback((snapshot: { items: CartItem[]; cartDiscount: number; customer: Customer | null; note: string;discountReason?:string;cartDiscountPercent?:number }) => {
    setItems(snapshot.items); setCartDiscount(snapshot.cartDiscount); setCustomer(snapshot.customer); setNote(snapshot.note);setDiscountReason(snapshot.discountReason??'');setCartDiscountPercent(snapshot.cartDiscountPercent);
  }, [setCartDiscount]);

  return {
    hydrate,
    items,
    addItem,
    updateQuantity,selectTradeUnit,updateTradeQuantity,
    updateLineDiscount,
    removeItem,
    clearCart,
    cartDiscount,cartDiscountPercent,setCartDiscountPercent,discountReason,setDiscountReason,
    setCartDiscount,
    customer,
    setCustomer,
    note,
    setNote,
    subtotal,
    totalAmount,
    itemCount,
  };
}
