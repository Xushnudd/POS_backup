'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotification } from '@/context/NotificationContext';
import { useCart } from '@/hooks/useCart';
import { usePosConnection } from '@/hooks/usePosConnection';
import { useDebounce } from '@/hooks/useDebounce';
import { api, ApiError } from '@/lib/api';
import { posFailure, type PosFailure } from '@/lib/pos-failure';
import { clientLine } from '@/lib/money';
import Modal from '@/components/ui/Modal';
import { deviceId, saveDraft, loadDraft, enqueue, acknowledge, markCancelled, synchronize } from '@/lib/offline';
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
  const { user, organization, role } = useAuth();
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
    setNote,
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
  const [failure,setFailure]=useState<(PosFailure&{details?:{productName?:string;previousPrice?:string;currentPrice?:string|null;requestedQuantity?:string;availableQuantity?:string}})|null>(null);

  const connection=usePosConnection();
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
  const [serviceType,setServiceType]=useState('');
  const [hasPendingCheckout,setHasPendingCheckout]=useState(false);
  const checkoutAttempt = useRef<{ operationId: string; payload: string; saleId?: string } | null>(null);
  useEffect(() => {
    if (!organization?.id || !user?.id) return;
    let cancelled=false;
    void Promise.resolve().then(()=>{if(!cancelled){setLocalReady(false);setHasPendingCheckout(false);checkoutAttempt.current=null;clearCart();setServiceType('');}});
    const scope={organizationId:organization.id,userId:user.id,deviceId:deviceId()};
    void loadDraft(scope).then(value=>{
      if (cancelled) return;
      if (value && typeof value==='object') {
        const saved=value as {cart:{items:CartItem[];cartDiscount:number;customer:Customer|null;note:string};serviceType?:string;attempt:typeof checkoutAttempt.current};
        if (saved.cart?.items) hydrate(saved.cart);
        setServiceType(saved.serviceType??'');
        checkoutAttempt.current=saved.attempt;
        setHasPendingCheckout(Boolean(saved.attempt));
      }
      setLocalReady(true);
    }).catch(()=>{if (!cancelled) notifyError('Lokal savatni tiklab bo‘lmadi; ma’lumotni tozalashdan oldin tekshiring');});
    return ()=>{cancelled=true;};
  },[organization?.id,user?.id,hydrate,clearCart,notifyError]);
  useEffect(()=>{
    if (!localReady || !organization?.id || !user?.id) return;
    const scope={organizationId:organization.id,userId:user.id,deviceId:deviceId()};
    const timer=setTimeout(()=>{void saveDraft(scope,{cart:{items,cartDiscount,customer,note},serviceType,attempt:checkoutAttempt.current}).catch(()=>notifyError('Savat lokal saqlanmadi; ushbu oynani yopmang'));},200);
    return ()=>clearTimeout(timer);
  },[localReady,organization?.id,user?.id,items,cartDiscount,customer,note,serviceType,notifyError]);

  // Process and complete sale
  const handleProcessPayment = async (
    payments: { paymentType: PaymentType; amount: number; referenceNo?: string }[], creditDueAt?:string, cashTendered?:string
  ) => {
    if (!organization?.id || !activeStore?.id || !activeRegister?.id || !activeShift?.id || !user?.id) {
      notifyError('Kassa yoki smena ma\'lumotlari to\'liq emas');
      return;
    }

    if (!localReady) { notifyError('Lokal savat hali tayyor emas'); return; }
    if (connection.state!=='online') { notifyError('Savdoni yakunlash uchun ulanishni tiklang; savat saqlangan'); return; }
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
        sellerId:user.id,serviceType:serviceType.trim()||undefined,
        items: items.map((i) => ({
          productId: i.product.id,
          productName: i.product.name,
          sku: i.product.sku,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          expectedUnitPrice: i.unitPrice,
          discountAmount: i.discountAmount,
        })),
      };

      const completion={payments,...(creditDueAt?{creditDueAt}: {}),...(cashTendered!==undefined?{cashTendered}: {})};
      const signature = JSON.stringify(draftPayload);
      if (checkoutAttempt.current && checkoutAttempt.current.payload !== signature) {
        throw new Error('Oldingi savdo natijasini aniqlang; kutilayotgan savatni o‘zgartirish mumkin emas');
      }
      checkoutAttempt.current ??= { operationId: crypto.randomUUID(), payload: signature };
      const scope={organizationId:organization.id,userId:user.id,deviceId:deviceId()};
      setHasPendingCheckout(true);
      const operationId=checkoutAttempt.current.operationId;
      await saveDraft(scope,{cart:{items,cartDiscount,customer,note},serviceType,attempt:checkoutAttempt.current});
      await enqueue({id:operationId,scope,type:'sale.create',payload:{...draftPayload,operationId},state:'pending',createdAt:new Date().toISOString()});
      const saleRes = await api.sales.create({ ...draftPayload, operationId });
      if (!saleRes.data) throw new Error('Savdo qoralamasi yaratilmadi');
      checkoutAttempt.current.saleId = saleRes.data.id;
      await acknowledge(operationId,'synced',saleRes.data);
      await saveDraft(scope,{cart:{items,cartDiscount,customer,note},serviceType,attempt:checkoutAttempt.current});
      await enqueue({id:saleRes.data.id,scope,type:'sale.complete',payload:{saleId:saleRes.data.id,...completion},state:'pending',createdAt:new Date().toISOString()});

      // 2. Complete sale with payments
      const completeRes = await api.sales.complete(saleRes.data.id, {
        ...completion,
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
      clearCart();setServiceType('');
      setIsReceiptModalOpen(true);
    } catch (err: unknown) {
      setFailure({...posFailure(err),details:err instanceof ApiError?err.details as NonNullable<typeof failure>['details']:undefined});
      setIsPaymentModalOpen(false);
      notifyError(err instanceof Error ? err.message : 'To\'lovni yakunlashda xatolik yuz berdi');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const cancelPendingCheckout=async()=>{
    const attempt=checkoutAttempt.current;
    if(!attempt || !organization?.id || !user?.id)return;
    setIsProcessingPayment(true);
    try{
      const scope={organizationId:organization.id,userId:user.id,deviceId:deviceId()};
      const outcome=await api.operations.cancelDraftIntent(attempt.operationId,{...JSON.parse(attempt.payload),operationId:attempt.operationId});
      if(outcome.data?.state==='created' && outcome.data.saleId){
        attempt.saleId=outcome.data.saleId;
        const current=await api.sales.get(attempt.saleId);
        if(current.data?.status!=='voided'){
          if(role==='cashier')throw new Error('Qoralama yaratilgan. Uni rahbar Savdolar sahifasida bekor qilishi kerak; keyin yana tekshiring.');
          await api.sales.void(attempt.saleId);
        }
        await markCancelled(attempt.saleId,scope,{saleId:attempt.saleId,state:'voided'});
      }else if(outcome.data?.state!=='cancelled')throw new Error('Server bekor qilishni tasdiqlamadi');
      await markCancelled(attempt.operationId,scope,outcome.data);
      await saveDraft(scope,{cart:{items,cartDiscount,customer,note},serviceType,attempt:null});
      checkoutAttempt.current=null;setHasPendingCheckout(false);setIsPaymentModalOpen(false);
      notifySuccess('Urinish serverda bekor qilindi. Savat saqlangan.');
      return true;
    }catch(error){notifyError(error instanceof Error?error.message:'Bekor qilish tasdiqlanmadi; urinish saqlangan');return false;}
    finally{setIsProcessingPayment(false);}
  };

  const refreshConflictCart=async()=>{
    if(!checkoutAttempt.current)return;
    try{
      const current=await Promise.all(items.map(async item=>{const result=await api.products.get(item.product.id);if(!result.data||!result.data.isActive)throw new Error('Mahsulot arxivlangan; rahbar bilan savatni tekshiring');return {...item,product:result.data,unitPrice:Number(result.data.salePrice),discountAmount:0,lineTotal:clientLine(item.quantity,Number(result.data.salePrice))};}));
      if(!await cancelPendingCheckout())return;
      hydrate({items:current,cartDiscount:0,customer,note});setFailure(null);await loadProducts();
      notifySuccess('Narxlar yangilandi, chegirmalar tozalandi. Miqdorlarni tekshirib, to‘lovni qayta tasdiqlang.');
    }catch(error){notifyError(error instanceof Error?error.message:'Savat yangilanmadi; asl urinish saqlangan');}
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
        await saveDraft(scope,{cart:{items,cartDiscount,customer,note},serviceType,attempt});
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
      clearCart();setServiceType('');
      setIsPaymentModalOpen(false);
      setIsReceiptModalOpen(true);
      notifySuccess('Oldingi savdoning yakunlangan natijasi tiklandi');
    } catch(error) { notifyError(error instanceof Error?error.message:'Savdo holatini tekshirib bo‘lmadi'); }
    finally { setIsProcessingPayment(false); }
  };

  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.repeat||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||!localReady||isProcessingPayment||hasPendingCheckout)return;
      if(event.key==='Escape'){
        if(isPaymentModalOpen){event.preventDefault();setIsPaymentModalOpen(false);}
        else if(isReceiptModalOpen){event.preventDefault();setIsReceiptModalOpen(false);}
        return;
      }
      if(isPaymentModalOpen||isReceiptModalOpen||isOpenShiftModalOpen||document.querySelector('[role="dialog"]'))return;
      const target=event.target as HTMLElement|null;
      if(target&&(target.matches('input,textarea,select')||target.isContentEditable)&&target.id!=='pos-product-search')return;
      if(event.key==='F2'){event.preventDefault();document.getElementById('pos-product-search')?.focus();}
      if(event.key==='F4'){event.preventDefault();setSearchQuery('');setSelectedCategoryId('');document.getElementById('pos-product-search')?.focus();}
      if(event.key==='F9'){
        event.preventDefault();
        if(!activeShift){setIsOpenShiftModalOpen(true);return;}
        if(items.length)setIsPaymentModalOpen(true);
      }
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[localReady,isProcessingPayment,hasPendingCheckout,isPaymentModalOpen,isReceiptModalOpen,isOpenShiftModalOpen,activeShift,items.length]);

  return (
    <div data-testid="pos-touch" className="min-h-[calc(100dvh-5rem)] lg:h-[calc(100dvh-5rem)] flex flex-col gap-4 [&_button]:min-h-11 [&_button]:min-w-11 [&_input]:min-h-11">
      <div role="status" className={connection.state==='online'?'text-green-700':'bg-amber-50 text-amber-900 p-3'}>
        <span>{connection.state==='online'?'Server bilan aloqa bor':connection.state==='checking'?'Server aloqasi tekshirilmoqda':'Server bilan aloqa yo‘q. Savat lokal saqlanadi; savdo yakunlanmaydi.'}</span>
        <Button variant="outline" onClick={connection.recheck}>Aloqani tekshirish</Button>
      </div>
      <p className="text-xs text-slate-500">F2: qidirish · F4: qidiruv filtrlarini tozalash · F9: to‘lov oynasi · Esc: oynani yopish. To‘lov avtomatik yuborilmaydi.</p>
      {hasPendingCheckout && <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">Oldingi savdo natijasi tekshirilishi kerak. Savatni o‘zgartirmang.</p>
        <div className="flex flex-wrap gap-2"><Button onClick={recoverCheckout} disabled={isProcessingPayment}>Natijani tekshirish</Button><Button disabled={isProcessingPayment||connection.state!=='online'} onClick={async()=>{if(!organization||!user)return;setIsProcessingPayment(true);try{await synchronize({organizationId:organization.id,userId:user.id,deviceId:deviceId()});await recoverCheckout();}catch(error){notifyError(error instanceof Error?error.message:'Navbat saqlangan');}finally{setIsProcessingPayment(false);}}}>Navbatni sinxronlash</Button><Button variant="outline" onClick={cancelPendingCheckout} disabled={isProcessingPayment}>Urinishni bekor qilish</Button></div>
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

      <label>Chek izohi<textarea aria-label="Chek izohi" maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} disabled={!localReady||hasPendingCheckout||isProcessingPayment} className="block border rounded p-2 w-full"/></label>
      <label>Xizmat turi (ixtiyoriy)<input aria-label="Xizmat turi (ixtiyoriy)" maxLength={100} value={serviceType} onChange={e=>setServiceType(e.target.value)} disabled={!localReady||hasPendingCheckout||isProcessingPayment} className="block border rounded p-2 w-full"/></label>
      {/* Main 2-column layout: Left Catalog, Right Cart */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Left: Product Catalog & Search (2 cols) */}
        <div className="lg:col-span-2 flex flex-col min-h-[320px] lg:min-h-0">
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
        <div className="lg:col-span-1 flex flex-col min-h-[360px] lg:min-h-0">
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
            disabled={!activeShift||!localReady||connection.state!=='online'}
          />
        </div>
      </div>

      <Modal isOpen={Boolean(failure)} onClose={()=>setFailure(null)} title={failure?.stage==='integration'?'Tashqi xizmat holati':'Savdo yakunlanmadi'}>
        {failure&&<div role="alert" data-stage={failure.stage} className="space-y-3"><p>{failure.code}: {failure.message}</p><p>{failure.nextAction}</p>
          {failure.details&&<div><p>Mahsulot: {failure.details.productName}</p>{failure.details.previousPrice!==undefined&&<p>Oldingi narx: {failure.details.previousPrice} · Joriy narx: {failure.details.currentPrice??'Mahsulot mavjud emas'}</p>}{failure.details.requestedQuantity!==undefined&&<p>Savat miqdori: {failure.details.requestedQuantity} · Mavjud qoldiq: {failure.details.availableQuantity}</p>}</div>}
          {['PRICE_CHANGED','INSUFFICIENT_STOCK'].includes(failure.code)&&<><p>Avval eski urinish serverda bekor qilinadi. Kassir qoralamasini bekor qilish uchun rahbar yordami kerak. Chegirmalar tozalanadi, to‘lov qayta tasdiqlanadi.</p><Button disabled={isProcessingPayment} onClick={refreshConflictCart}>Eski urinishni bekor qilib savatni yangilash</Button></>}
          <Button variant="outline" onClick={()=>{setFailure(null);void recoverCheckout();}}>Asl savdo natijasini tekshirish</Button>
        </div>}
      </Modal>
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
