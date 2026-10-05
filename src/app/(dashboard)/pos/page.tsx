'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotification } from '@/context/NotificationContext';
import { useCart } from '@/hooks/useCart';
import { useDebounce } from '@/hooks/useDebounce';
import { api } from '@/lib/api';
import { deviceId, saveDraft, loadDraft, enqueue, acknowledge } from '@/lib/offline';
import { Category, Customer, PaymentType, Product, Sale, CartItem } from '@/types';
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
    hydrate,
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
    } catch (err: unknown) {
      console.error('Error loading products:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [organization, debouncedSearch, selectedCategoryId]);

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
    void Promise.resolve().then(loadProducts);
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

  const handleCameraBarcode = async (barcode: string) => {
    if (!organization?.id) return;

    try {
      const response = await api.products.findByBarcode(organization.id, barcode);
      if (!response.data) {
        notifyError('Barkod bo‘yicha mahsulot topilmadi');
        return;
      }

      addItem(response.data);
      setSearchQuery('');
      notifySuccess(`${response.data.name} savatga qo‘shildi`);
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Barkod bo‘yicha mahsulot topilmadi');
    }
  };

  const [localReady,setLocalReady]=useState(false);
  const [hasPendingCheckout,setHasPendingCheckout]=useState(false);
  const checkoutAttempt = useRef<{ operationId: string; payload: string; saleId?: string } | null>(null);
  useEffect(() => {
    if (!organization?.id || !user?.id) return;
    let cancelled=false;
    const scope={organizationId:organization.id,userId:user.id,deviceId:deviceId()};
    void loadDraft(scope).then(value=>{
      if (cancelled) return;
      if (value && typeof value==='object') {
        const saved=value as {cart:{items:CartItem[];cartDiscount:number;customer:Customer|null;note:string};attempt:typeof checkoutAttempt.current};
        if (saved.cart?.items) hydrate(saved.cart);
        checkoutAttempt.current=saved.attempt;
        setHasPendingCheckout(Boolean(saved.attempt));
      }
      setLocalReady(true);
    }).catch(()=>{if (!cancelled) notifyError('Lokal savatni tiklab bo‘lmadi; ma’lumotni tozalashdan oldin tekshiring');});
    return ()=>{cancelled=true;};
  },[organization?.id,user?.id,hydrate,notifyError]);
  useEffect(()=>{
    if (!localReady || !organization?.id || !user?.id) return;
    const scope={organizationId:organization.id,userId:user.id,deviceId:deviceId()};
    const timer=setTimeout(()=>{void saveDraft(scope,{cart:{items,cartDiscount,customer,note},attempt:checkoutAttempt.current}).catch(()=>notifyError('Savat lokal saqlanmadi; ushbu oynani yopmang'));},200);
    return ()=>clearTimeout(timer);
  },[localReady,organization?.id,user?.id,items,cartDiscount,customer,note,notifyError]);

  // Process and complete sale
  const handleProcessPayment = async (
    payments: { paymentType: PaymentType; amount: number; referenceNo?: string }[]
  ) => {
    if (!organization?.id || !activeStore?.id || !activeRegister?.id || !activeShift?.id || !user?.id) {
      notifyError('Kassa yoki smena ma\'lumotlari to\'liq emas');
      return;
    }

    if (!localReady) { notifyError('Lokal savat hali tayyor emas'); return; }
    if (!navigator.onLine) { notifyError('Savdoni yakunlash uchun ulanishni tiklang; savat saqlangan'); return; }
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

      const signature = JSON.stringify(draftPayload);
      if (checkoutAttempt.current && checkoutAttempt.current.payload !== signature) {
        throw new Error('Oldingi savdo natijasini aniqlang; kutilayotgan savatni o‘zgartirish mumkin emas');
      }
      checkoutAttempt.current ??= { operationId: crypto.randomUUID(), payload: signature };
      const scope={organizationId:organization.id,userId:user.id,deviceId:deviceId()};
      setHasPendingCheckout(true);
      const operationId=checkoutAttempt.current.operationId;
      await saveDraft(scope,{cart:{items,cartDiscount,customer,note},attempt:checkoutAttempt.current});
      await enqueue({id:operationId,scope,type:'sale.create',payload:{...draftPayload,operationId},state:'pending',createdAt:new Date().toISOString()});
      const saleRes = await api.sales.create({ ...draftPayload, operationId });
      if (!saleRes.data) throw new Error('Savdo qoralamasi yaratilmadi');
      checkoutAttempt.current.saleId = saleRes.data.id;
      await acknowledge(operationId,'synced',saleRes.data);
      await saveDraft(scope,{cart:{items,cartDiscount,customer,note},attempt:checkoutAttempt.current});
      await enqueue({id:saleRes.data.id,scope,type:'sale.complete',payload:{saleId:saleRes.data.id,payments},state:'pending',createdAt:new Date().toISOString()});

      // 2. Complete sale with payments
      const completeRes = await api.sales.complete(saleRes.data.id, {
        payments,
      });

      if (!completeRes.data) {
        throw new Error('Savdoni yakunlashda xatolik');
      }

      await acknowledge(saleRes.data.id,'synced',completeRes.data);
      await saveDraft(scope,{cart:{items:[],cartDiscount:0,customer:null,note:''},attempt:null});
      notifySuccess('Savdo muvaffaqiyatli yakunlandi!');

      // 3. Prepare for receipt preview
      const finishedSale: Sale = { ...completeRes.data, customer };
      checkoutAttempt.current = null;
      setHasPendingCheckout(false);

      setCompletedSale(finishedSale);
      setIsPaymentModalOpen(false);
      clearCart();
      setIsReceiptModalOpen(true);
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'To\'lovni yakunlashda xatolik yuz berdi');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const recoverCheckout = async () => {
    const attempt=checkoutAttempt.current;
    if (!attempt || !organization?.id || !user?.id) return;
    setIsProcessingPayment(true);
    try {
      const scope={organizationId:organization.id,userId:user.id,deviceId:deviceId()};
      if (!attempt.saleId) {
        const draft=await api.operations.status('sale.create',attempt.operationId);
        if (draft.data?.state!=='completed' || !draft.data.result) {
          notifyError('Yakunlangan natija hali topilmadi. Oldingi amal kalitini saqlab, ulanish tiklangach qayta tekshiring.');
          return;
        }
        attempt.saleId=draft.data.result.id;
        await acknowledge(attempt.operationId,'synced',draft.data.result);
        await saveDraft(scope,{cart:{items,cartDiscount,customer,note},attempt});
      }
      const completed=await api.operations.status('sale.complete',attempt.saleId);
      if (completed.data?.state!=='completed' || !completed.data.result) {
        notifyError('Qoralama mavjud, lekin yakunlash natijasi hali topilmadi. Shu savat va to‘lov bilan qayta urinishingiz mumkin; yangi savdo boshlamang.');
        return;
      }
      await acknowledge(attempt.saleId,'synced',completed.data.result);
      await saveDraft(scope,{cart:{items:[],cartDiscount:0,customer:null,note:''},attempt:null});
      checkoutAttempt.current=null;
      setHasPendingCheckout(false);
      setCompletedSale(completed.data.result);
      clearCart();
      setIsPaymentModalOpen(false);
      setIsReceiptModalOpen(true);
      notifySuccess('Oldingi savdoning yakunlangan natijasi tiklandi');
    } catch(error) { notifyError(error instanceof Error?error.message:'Savdo holatini tekshirib bo‘lmadi'); }
    finally { setIsProcessingPayment(false); }
  };

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col gap-4">
      {hasPendingCheckout && <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between gap-3">
        <p className="text-sm">Oldingi savdo natijasi tekshirilishi kerak. Savatni o‘zgartirmang.</p>
        <Button onClick={recoverCheckout} disabled={isProcessingPayment}>Natijani tekshirish</Button>
      </div>}
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
            onCameraScan={handleCameraBarcode}
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
