import { useState, useCallback, useMemo } from 'react';
import { CartItem, Customer, Product } from '@/types';

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartDiscount, setCartDiscount] = useState<number>(0);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [note, setNote] = useState<string>('');

  const addItem = useCallback((product: Product, quantity: number = 1) => {
    setItems((prev) => {
      const existingIdx = prev.findIndex((item) => item.product.id === product.id);

      if (existingIdx > -1) {
        const updated = [...prev];
        const currentItem = updated[existingIdx];
        const newQty = currentItem.quantity + quantity;
        const lineTotal = newQty * currentItem.unitPrice - currentItem.discountAmount;

        updated[existingIdx] = {
          ...currentItem,
          quantity: newQty,
          lineTotal: Math.max(0, lineTotal),
        };
        return updated;
      }

      const unitPrice = Number(product.salePrice);
      const lineTotal = quantity * unitPrice;

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
          const lineTotal = quantity * item.unitPrice - item.discountAmount;
          return {
            ...item,
            quantity,
            lineTotal: Math.max(0, lineTotal),
          };
        }
        return item;
      })
    );
  }, []);

  const updateLineDiscount = useCallback(
    (productId: string, discountAmount: number) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.product.id === productId) {
            const safeDiscount = Math.max(0, Math.min(discountAmount, item.quantity * item.unitPrice));
            const lineTotal = item.quantity * item.unitPrice - safeDiscount;
            return {
              ...item,
              discountAmount: safeDiscount,
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
    setNote('');
  }, []);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.lineTotal, 0);
  }, [items]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal - (Number(cartDiscount) || 0));
  }, [subtotal, cartDiscount]);

  const itemCount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  return {
    items,
    addItem,
    updateQuantity,
    updateLineDiscount,
    removeItem,
    clearCart,
    cartDiscount,
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
