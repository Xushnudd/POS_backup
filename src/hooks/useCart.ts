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
        const newQty = currentItem.quantity + quantity;
        const discountAmount=currentItem.discountPercent===undefined?currentItem.discountAmount:clientPercentage(clientLine(newQty,currentItem.unitPrice),currentItem.discountPercent);
        const lineTotal = clientLine(newQty, currentItem.unitPrice, discountAmount);

        updated[existingIdx] = {
          ...currentItem,
          quantity: newQty,discountAmount,
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
    updateQuantity,
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
