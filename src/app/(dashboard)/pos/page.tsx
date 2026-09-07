'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotification } from '@/context/NotificationContext';
import { useCart } from '@/hooks/useCart';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/lib/api';
import { Category, Customer, PaymentType, Product, Sale } from '@/types';
import ProductSearch from '@/components/pos/ProductSearch';
import Cart from '@/components/pos/Cart';
import PaymentModal from '@/components/pos/PaymentModal';
import ReceiptPreview from '@/components/pos/ReceiptPreview';
import OpenShiftModal from '@/components/pos/OpenShiftModal';
import Button from '@/components/ui/Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

export default function PosPage() {
  const { user, organization } = useAuth();
  const { activeStore, activeRegister, activeShift, refreshShift } = useOrganization();
  const { notifySuccess, notifyError } = useNotification();

  // Cart state
  const {
    items,
    subtotal,
    totalAmount,
    cartDiscount,
    customer,
    note,
    addItem,
    updateQuantity,
    updateLineDiscount,
    removeItem,
    clearCart,
    setCartDiscount,
    setCustomer,
  } = useCart();

  // Products & Categories
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false);

  // Modals
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Load products
  const loadProducts = useCallback(async () => {
    if (!organization?.id) return;
    setIsLoadingProducts(true);
    try {
      const res = await api.products.list({
        organizationId: organization.id,
        search: debouncedSearch || undefined,
        categoryId: selectedCategoryId || undefined,
        limit: 50,
      });
      if (res.data) {
        setProducts(res.data);
      }
    } catch (err: any) {
      console.error('Error loading products:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [organization?.id, debouncedSearch, selectedCategoryId]);

  // Load initial data (categories and customers)
  useEffect(() => {
    if (!organization?.id) return;

    api.categories.list(organization.id).then((res) => {
      if (res.data) setCategories(res.data);
    });

    api.customers.list({ organizationId: organization.id, limit: 100 }).then((res) => {
      if (res.data) setCustomers(res.data);
    });
  }, [organization?.id]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Check if shift is open
  const handleProceedToPayment = () => {
    if (!activeShift) {
      setIsOpenShiftModalOpen(true);
      notifyError('Savdo qilish uchun avval smenani ochishingiz zarur!');
      return;
    }
    if (items.length === 0) {
      notifyError('Savatda hech qanday mahsulot yo\'q');
      return;
    }
    setIsPaymentModalOpen(true);
  };

  // Process and complete sale
  const handleProcessPayment = async (
    payments: { paymentType: PaymentType; amount: number; referenceNo?: string }[]
  ) => {
    if (!organization?.id || !activeStore?.id || !activeRegister?.id || !activeShift?.id || !user?.id) {
      notifyError('Kassa yoki smena ma\'lumotlari to\'liq emas');
      return;
    }

    setIsProcessingPayment(true);
    try {
      // 1. Create draft sale
      const draftPayload = {
        organizationId: organization.id,
        storeId: activeStore.id,
        registerId: activeRegister.id,
        shiftId: activeShift.id,
        cashierId: user.id,
        customerId: customer?.id || undefined,
        discountAmount: cartDiscount,
        note: note || undefined,
        items: items.map((i) => ({
          productId: i.product.id,
          productName: i.product.name,
          sku: i.product.sku,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discountAmount: i.discountAmount,
          unitCost: Number(i.product.costPrice) || 0,
        })),
      };

      const saleRes = await api.sales.create(draftPayload);
      if (!saleRes.data) {
        throw new Error('Savdo qoralamasi yaratilmadi');
      }

      // 2. Complete sale with payments
      const completeRes = await api.sales.complete(saleRes.data.id, {
        payments,
      });

      if (!completeRes.data) {
        throw new Error('Savdoni yakunlashda xatolik');
      }

      notifySuccess('Savdo muvaffaqiyatli yakunlandi!');

      // 3. Prepare for receipt preview
      const finishedSale: Sale = {
        ...completeRes.data,
        items: draftPayload.items.map((it) => ({
          ...it,
          lineTotal: it.quantity * it.unitPrice - it.discountAmount,
        })),
        customer,
        payments: payments.map((p) => ({
          ...p,
          direction: 'in',
        })),
      };

      setCompletedSale(finishedSale);
      setIsPaymentModalOpen(false);
      clearCart();
      setIsReceiptModalOpen(true);
    } catch (err: any) {
      notifyError(err.message || 'To\'lovni yakunlashda xatolik yuz berdi');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col gap-4">
      {/* Warning banner if shift is closed */}
      {!activeShift && (
        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center text-base">
              <FontAwesomeIcon icon={faExclamationTriangle} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">Smena ochilmagan</h4>
              <p className="text-xs text-amber-700">
                Savdolarni yakunlash va chek chiqarish uchun smena ochishingiz zarur
              </p>
            </div>
          </div>
          <Button
            variant="warning"
            size="sm"
            onClick={() => setIsOpenShiftModalOpen(true)}
            leftIcon={<FontAwesomeIcon icon={faClock} />}
            className="font-bold shadow-xs"
          >
            Smenani ochish
          </Button>
        </div>
      )}

      {/* Main 2-column layout: Left Catalog, Right Cart */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Left: Product Catalog & Search (2 cols) */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <ProductSearch
            products={products}
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            onSelectCategory={setSelectedCategoryId}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectProduct={addItem}
            isLoading={isLoadingProducts}
          />
        </div>

        {/* Right: Shopping Cart (1 col) */}
        <div className="lg:col-span-1 flex flex-col min-h-0">
          <Cart
            items={items}
            subtotal={subtotal}
            totalAmount={totalAmount}
            cartDiscount={cartDiscount}
            customer={customer}
            customers={customers}
            onUpdateQuantity={updateQuantity}
            onUpdateDiscount={updateLineDiscount}
            onRemoveItem={removeItem}
            onClearCart={clearCart}
            onSetCartDiscount={setCartDiscount}
            onSetCustomer={setCustomer}
            onCheckout={handleProceedToPayment}
            disabled={!activeShift}
          />
        </div>
      </div>

      {/* Modals */}
      <OpenShiftModal
        isOpen={isOpenShiftModalOpen}
        onClose={() => setIsOpenShiftModalOpen(false)}
        onSuccess={refreshShift}
      />

      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        totalAmount={totalAmount}
        customer={customer}
        onProcessPayment={handleProcessPayment}
        isLoading={isProcessingPayment}
      />

      <ReceiptPreview
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        sale={completedSale}
      />
    </div>
  );
}
