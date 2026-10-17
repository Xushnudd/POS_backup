'use client';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import PendingActions from '@/components/forms/PendingActions';
import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotification } from '@/context/NotificationContext';
import { useCart } from '@/hooks/useCart';
import { usePosConnection } from '@/hooks/usePosConnection';
import { useDebounce } from '@/hooks/useDebounce';
import { api, ApiError } from '@/lib/api';
import { posFailure, type PosFailure } from '@/lib/pos-failure';
import { clientLine } from '@/lib/money';
import { quickProductKey } from '@/lib/quick-products';
import Modal from '@/components/ui/Modal';
import { deviceId, saveDraft, loadDraft, enqueue, acknowledge, acknowledgeRecovered, markCancelled, synchronize,saveCatalog,loadCatalog } from '@/lib/offline';
import { Category, Customer, PaymentType, Product, Sale, CartItem } from '@/types';
import ProductSearch from '@/components/pos/ProductSearch';
import Cart from '@/components/pos/Cart';
import PaymentModal from '@/components/pos/PaymentModal';
import ReceiptPreview from '@/components/pos/ReceiptPreview';
import OpenShiftModal from '@/components/pos/OpenShiftModal';
import Button from '@/components/ui/Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

type CheckoutAttempt={operationId:string;payload:string;saleId?:string};
function writeAttempt(ref:{current:CheckoutAttempt|null},value:CheckoutAttempt|null){ref.current=value;}

export default function PosPage() {
 const {t:tr,message:uiMessage}=useTranslation();

  const { user, organization, role } = useAuth();
  const { activeStore, activeRegister, activeShift, refreshShift } = useOrganization();
  const { notifySuccess, notifyError } = useNotification();

  // Cart state
  const {
    items,
    subtotal,
    totalAmount,
    cartDiscount,cartDiscountPercent,setCartDiscountPercent,discountReason,setDiscountReason,
    customer,
    note,
    addItem,
    updateQuantity,selectTradeUnit,updateTradeQuantity,
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
  const [catalogNotice,setCatalogNotice]=useState('');
  const [catalogExpiresAt,setCatalogExpiresAt]=useState<string|null>(null);

  // Modals
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState<boolean>(false);
  const [paymentQuote,setPaymentQuote]=useState<{signature:string;taxFingerprint:string;totals:{totalAmount:string;taxAmount:string;netAmount:string}}|null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [failure,setFailure]=useState<(PosFailure&{details?:{productName?:string;previousPrice?:string;currentPrice?:string|null;requestedQuantity?:string;availableQuantity?:string}})|null>(null);

  const connection=usePosConnection();
  const debouncedSearch = useDebounce(searchQuery, 300);
  const catalogRequest = useRef(0);
  const actorScope = organization?.id+':'+user?.id+':'+activeRegister?.id;
  const liveActor = useRef(actorScope);
  const lookupCount = useRef(0);
  useLayoutEffect(() => {liveActor.current=actorScope;}, [actorScope]);

  // Load products
  const loadProducts = useCallback(async () => {
    if (!organization?.id||!user?.id||!activeRegister?.id) return;
    const requestNumber=++catalogRequest.current;
    const scope={organizationId:organization.id,userId:user.id,deviceId:deviceId(),registerId:activeRegister.id};
    const query=JSON.stringify([debouncedSearch,selectedCategoryId]);
    setIsLoadingProducts(true);
    try {
      const res = await api.products.list({
        organizationId: organization.id,
        search: debouncedSearch || undefined,
        categoryId: selectedCategoryId || undefined,
        limit: 50,
      });
      if (res.data && catalogRequest.current===requestNumber) {
        setProducts(res.data);
        setCatalogExpiresAt(res.catalogLease?.expiresAt??null);
        setCatalogNotice('');
        if(res.catalogLease)try{await saveCatalog(scope,query,res.catalogLease,res.data)}catch{if(catalogRequest.current===requestNumber)setCatalogNotice('Katalog lokal saqlanmadi; internet uzilganda ro‘yxat tiklanmaydi.');}
      }
    } catch (err: unknown) {
      if(catalogRequest.current!==requestNumber)return;
      if(err instanceof ApiError&&err.code==='NETWORK_ERROR'){
        try{const saved=await loadCatalog(scope,query);if(catalogRequest.current!==requestNumber)return;setProducts(saved?.products??[]);setCatalogExpiresAt(saved?.lease.expiresAt??null);setCatalogNotice(saved?'Oxirgi qidiruvning lokal katalogi (5 daqiqagacha). Narx va qoldiq serverda qayta tekshirilmaguncha savdo yakunlanmaydi.':'Lokal katalog yo‘q yoki muddati tugagan. Internetni tiklang.');}catch{if(catalogRequest.current!==requestNumber)return;setProducts([]);setCatalogNotice('Lokal katalog o‘qilmadi. Internetni tiklang.');}
      }else{setProducts([]);setCatalogNotice('Katalog ruxsati tekshirilmadi.');notifyError(displayErrorMessage(err,'Mahsulotlarni yuklash amalga oshmadi'));}
    } finally {
      if(catalogRequest.current===requestNumber)setIsLoadingProducts(false);
    }
  }, [organization,user,activeRegister, debouncedSearch, selectedCategoryId, notifyError]);

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
  useEffect(()=>{const reload=()=>{void loadProducts()};window.addEventListener('online',reload);window.addEventListener('offline',reload);const timer=setInterval(reload,60000);return()=>{clearInterval(timer);window.removeEventListener('online',reload);window.removeEventListener('offline',reload)}},[loadProducts]);
  useEffect(()=>{if(!catalogExpiresAt)return;const timer=setTimeout(()=>{setProducts([]);setCatalogNotice('Katalog muddati tugadi. Internetni tiklab narxlarni yangilang.');},Math.max(0,Date.parse(catalogExpiresAt)-Date.now()));return()=>clearTimeout(timer)},[catalogExpiresAt]);

  const handleCameraBarcode = async (barcode: string, allowCatalogIdentifier=false) => {
    if (!organization?.id || !localReady || hasPendingCheckout || isProcessingPayment) return;
    const originalActor=actorScope;
    lookupCount.current++;

    try {
      let response;
      try {response = await api.products.findByBarcode(organization.id, barcode);}
      catch(error){
        if(!allowCatalogIdentifier||!(error instanceof ApiError)||error.code!=='NOT_FOUND')throw error;
        response=await api.products.findByIdentifier(organization.id,barcode);
      }
      if(liveActor.current!==originalActor)return;
      if (!response.data) {
        notifyError('Barkod bo‘yicha mahsulot topilmadi');
        return;
      }

      addItem(response.data);
      setSearchQuery('');
      notifySuccess(`${response.data.name} savatga qo‘shildi`);
    } catch (error: unknown) {
      notifyError(displayErrorMessage(error,'Barkod bo‘yicha mahsulot topilmadi'));
    } finally {
      lookupCount.current--;
    }
  };

  const handleQuickProduct = async (id: string) => {
    if (!localReady || hasPendingCheckout || isProcessingPayment) return;
    lookupCount.current++;
    try {
      const response = await api.products.get(id);
      if(liveActor.current!==actorScope)return;
      if (!response.data?.isActive) {notifyError('Mahsulot arxivlangan. Tezkor ro‘yxatdan olib tashlang.');return;}
      addItem(response.data);
    } catch {notifyError('Mahsulot tekshirilmadi. Internet va ruxsatni tekshirib qayta urining.');}
    finally {lookupCount.current--;}
  };

  const [localReady,setLocalReady]=useState(false);
  const [serviceType,setServiceType]=useState('');
  const [localSaveProof,setLocalSaveProof]=useState<string|null>(null);
  const localSnapshot=JSON.stringify({items,cartDiscount,cartDiscountPercent,discountReason,customer,note,serviceType});
  const [hasPendingCheckout,setHasPendingCheckout]=useState(false);
  useUnsavedChanges(false,isProcessingPayment||!localReady||localSaveProof!==localSnapshot);
  const checkoutAttempt = useRef<{ operationId: string; payload: string; saleId?: string } | null>(null);
  useEffect(() => {
    if (!organization?.id || !user?.id) return;
    let cancelled=false;
    void Promise.resolve().then(()=>{if(!cancelled){setLocalReady(false);setHasPendingCheckout(false);writeAttempt(checkoutAttempt,null);clearCart();setServiceType('');}});
    const scope={organizationId:organization.id,userId:user.id,deviceId:deviceId()};
    void loadDraft(scope).then(value=>{
      if (cancelled) return;
      if (value && typeof value==='object') {
        const saved=value as {cart:{items:CartItem[];cartDiscount:number;customer:Customer|null;note:string};serviceType?:string;attempt:typeof checkoutAttempt.current};
        if (saved.cart?.items) hydrate(saved.cart);
        setServiceType(saved.serviceType??'');
        writeAttempt(checkoutAttempt,saved.attempt);
        setHasPendingCheckout(Boolean(saved.attempt));
      }
      setLocalReady(true);
    }).catch(()=>{if (!cancelled) notifyError('Lokal savatni tiklab bo‘lmadi; ma’lumotni tozalashdan oldin tekshiring');});
    return ()=>{cancelled=true;};
  },[organization?.id,user?.id,hydrate,clearCart,notifyError]);
  useEffect(()=>{
    if (!localReady || !organization?.id || !user?.id) return;
    const scope={organizationId:organization.id,userId:user.id,deviceId:deviceId()};
    let cancelled=false;
    const timer=setTimeout(()=>{void saveDraft(scope,{cart:{items,cartDiscount,cartDiscountPercent,discountReason,customer,note},serviceType,attempt:checkoutAttempt.current}).then(()=>{if(!cancelled)setLocalSaveProof(localSnapshot);}).catch(()=>notifyError('Savat lokal saqlanmadi; ushbu oynani yopmang'));},200);
    return ()=>{cancelled=true;clearTimeout(timer);};
  },[localReady,organization?.id,user?.id,items,cartDiscount,customer,note,cartDiscountPercent,discountReason,serviceType,localSnapshot,notifyError]);

  useEffect(()=>{
    if(!localReady||localSaveProof===localSnapshot)return;
    const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();};window.addEventListener('beforeunload',guard);
    return ()=>window.removeEventListener('beforeunload',guard);
  },[localReady,localSaveProof,localSnapshot]);

  const buildDraftPayload=useCallback(()=>{
    return {
        organizationId: organization?.id,
        storeId: activeStore?.id,
        registerId: activeRegister?.id,
        shiftId: activeShift?.id,
        cashierId: user?.id,
        customerId: customer?.id || undefined,
        discountAmount: cartDiscount,discountPercent:cartDiscountPercent,discountReason:discountReason.trim()||undefined,
        note: note || undefined,
        sellerId:user?.id,serviceType:serviceType.trim()||undefined,
        items: items.map((i) => ({
          productId: i.product.id,
          productName: i.product.name,
          sku: i.product.sku,
          quantity: i.tradeQuantity??i.quantity,tradeUnit:i.tradeUnit,expectedConversionRatio:i.conversionRatio,
          unitPrice: i.unitPrice,
          expectedUnitPrice: i.unitPrice,
          discountAmount: i.discountAmount,discountPercent:i.discountPercent,
        })),
      };
  },[organization?.id,activeStore?.id,activeRegister?.id,activeShift?.id,user?.id,customer?.id,cartDiscount,cartDiscountPercent,discountReason,note,serviceType,items]);

  // Check if shift is open
  const handleProceedToPayment = useCallback(async () => {
    if(lookupCount.current>0){notifyError('Avval mahsulot tekshiruvi tugashini kuting');return;}
    if (!activeShift) {
      setIsOpenShiftModalOpen(true);
      notifyError('Savdo qilish uchun avval smenani ochishingiz zarur!');
      return;
    }
    if(hasPendingCheckout&&!checkoutAttempt.current?.saleId){notifyError('Avval asl qoralama natijasini tekshiring');return;}
    if (items.length === 0) {
      notifyError('Savatda hech qanday mahsulot yo\'q');
      return;
    }
    if(connection.state!=='online'||isProcessingPayment){notifyError('To‘lov oldidan server bilan narx/soliqni tekshirish kerak');return;}
    const actor=actorScope,body=buildDraftPayload();setIsProcessingPayment(true);
    try{const result=await api.request<{totals:{totalAmount:string;taxAmount:string;netAmount:string};taxFingerprint:string}>('/sales/preview',{method:'POST',body:JSON.stringify(body)});if(actor!==liveActor.current||!result.data)return;setPaymentQuote({...result.data,signature:JSON.stringify(body)});setIsPaymentModalOpen(true);}catch(e){setFailure({...posFailure(e),details:e instanceof ApiError?e.details as NonNullable<typeof failure>['details']:undefined});}finally{setIsProcessingPayment(false);}
  },[activeShift,hasPendingCheckout,items.length,connection.state,isProcessingPayment,actorScope,buildDraftPayload,notifyError]);

  // Process and complete sale
  const handleProcessPayment = async (
    payments: { paymentType: PaymentType; amount: number; referenceNo?: string }[], creditDueAt?:string, cashTendered?:string,serialSelections?:{productId:string;ids:string[]}[]
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
      const rawDraft=buildDraftPayload();
      if(!paymentQuote||paymentQuote.signature!==JSON.stringify(rawDraft))throw new Error('Savat o‘zgardi; to‘lov hisobini serverda qayta tekshiring');
      const draftPayload={...rawDraft,expectedTotalAmount:paymentQuote.totals.totalAmount,expectedTaxFingerprint:paymentQuote.taxFingerprint};

      const completion={payments,...(serialSelections?{serialSelections}:{}),...(creditDueAt?{creditDueAt}: {}),...(cashTendered!==undefined?{cashTendered}: {})};
      const signature = JSON.stringify(draftPayload);
      if (checkoutAttempt.current && checkoutAttempt.current.payload !== signature && checkoutAttempt.current.payload!=='resumed') {
        throw new Error('Oldingi savdo natijasini aniqlang; kutilayotgan savatni o‘zgartirish mumkin emas');
      }
      if(!checkoutAttempt.current)writeAttempt(checkoutAttempt,{ operationId: crypto.randomUUID(), payload: signature });
      const scope={organizationId:organization.id,userId:user.id,deviceId:deviceId()};
      setHasPendingCheckout(true);
      const currentAttempt=checkoutAttempt.current;if(!currentAttempt)throw new Error('Asl urinishni tekshiring');
      const operationId=currentAttempt.operationId;
      await saveDraft(scope,{cart:{items,cartDiscount,cartDiscountPercent,discountReason,customer,note},serviceType,attempt:checkoutAttempt.current});
      if(!currentAttempt.saleId)await enqueue({id:operationId,scope,type:'sale.create',payload:{...draftPayload,operationId},state:'pending',createdAt:new Date().toISOString()});
      const saleRes = currentAttempt.saleId?await api.sales.get(currentAttempt.saleId):await api.sales.create({ ...draftPayload, operationId });
      if (!saleRes.data) throw new Error('Savdo qoralamasi yaratilmadi');
      writeAttempt(checkoutAttempt,{...currentAttempt,saleId:saleRes.data.id});
      if(currentAttempt.payload!=='resumed')await acknowledge(operationId,'synced',saleRes.data);
      await saveDraft(scope,{cart:{items,cartDiscount,cartDiscountPercent,discountReason,customer,note},serviceType,attempt:checkoutAttempt.current});
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
      writeAttempt(checkoutAttempt,null);
      setHasPendingCheckout(false);

      setCompletedSale(finishedSale);
      setIsPaymentModalOpen(false);
      clearCart();setServiceType('');
      setIsReceiptModalOpen(true);
    } catch (err: unknown) {
      setFailure({...posFailure(err),details:err instanceof ApiError?err.details as NonNullable<typeof failure>['details']:undefined});
      setIsPaymentModalOpen(false);
      notifyError(displayErrorMessage(err,'To\'lovni yakunlashda xatolik yuz berdi'));
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const parkAttempt=useRef<{key:string;signature:string}|null>(null);
  const [parkedMessage,setParkedMessage]=useState('');
  const parkDraft=async()=>{
    if(lookupCount.current>0){notifyError('Avval mahsulot tekshiruvi tugashini kuting');return;}
    if(!organization||!user||!activeShift||!activeStore||!activeRegister||!items.length||hasPendingCheckout||!localReady)return;
    setIsProcessingPayment(true);
    try{
      const payload=buildDraftPayload(),signature=JSON.stringify(payload);
      if(parkAttempt.current&&parkAttempt.current.signature!==signature)throw new Error('Oldingi saqlash natijasini tekshiring; savatni o‘zgartirmang');
      parkAttempt.current??={key:crypto.randomUUID(),signature};
      const scope={organizationId:organization.id,userId:user.id,deviceId:deviceId()},operationId=parkAttempt.current.key;
      writeAttempt(checkoutAttempt,{operationId,payload:signature});setHasPendingCheckout(true);
      await saveDraft(scope,{cart:{items,cartDiscount,cartDiscountPercent,discountReason,customer,note},serviceType,attempt:checkoutAttempt.current});
      await enqueue({id:operationId,scope,type:'sale.create',payload:{...payload,operationId},state:'pending',createdAt:new Date().toISOString()});
      const result=await api.sales.create({...payload,operationId});if(!result.data)throw new Error('Qoralama natijasini tekshiring');
      await acknowledge(operationId,'synced',result.data);
      await saveDraft(scope,{cart:{items:[],cartDiscount:0,customer:null,note:''},attempt:null});
      parkAttempt.current=null;writeAttempt(checkoutAttempt,null);setHasPendingCheckout(false);clearCart();setServiceType('');setParkedMessage('Qoralama serverda saqlandi: '+result.data.receiptNo);
    }catch(error){notifyError(displayErrorMessage(error,'Qoralama saqlanmadi; asl natijani tekshiring'));}finally{setIsProcessingPayment(false);}
  };
  const [draftToResume,setDraftToResume]=useState('');
  useEffect(()=>{void Promise.resolve().then(()=>setDraftToResume(new URLSearchParams(window.location.search).get('draft')??''));},[]);
  const openServerDraft=async()=>{
    if(!draftToResume||!localReady||!organization||!user||!activeShift)return;
    setIsProcessingPayment(true);
    try{
      if(items.length||hasPendingCheckout)throw new Error('Avval lokal savat yoki kutilayotgan urinishni hal qiling');
      const response=await api.sales.get(draftToResume),sale=response.data;if(!sale)throw new Error('Qoralama topilmadi');
      if(sale.status!=='draft'||sale.cashierId!==user.id||sale.shiftId!==activeShift.id||sale.registerId!==activeRegister?.id)throw new Error('Faqat o‘zingizning faol kassa/smena qoralamangizni oching; boshqa savdoni tarixdan tekshiring');
      const restored:CartItem[]=[];
      for(const item of sale.items??[]){const response=await api.products.get(item.productId);if(!response.data)throw new Error('Mahsulot topilmadi');restored.push({product:response.data,quantity:Number(item.quantity),unitPrice:Number(item.unitPrice),discountAmount:Number(item.discountAmount),discountPercent:item.discountPercent==null?undefined:Number(item.discountPercent),lineTotal:Number(item.lineTotal)});}
      const attempt={operationId:crypto.randomUUID(),payload:'resumed',saleId:sale.id};
      await saveDraft({organizationId:organization.id,userId:user.id,deviceId:deviceId()},{cart:{items:restored,cartDiscount:Number(sale.discountAmount),cartDiscountPercent:sale.discountPercent==null?undefined:Number(sale.discountPercent),discountReason:sale.discountReason??'',customer:sale.customer??null,note:sale.note??''},serviceType:sale.serviceType,attempt});
      hydrate({items:restored,cartDiscount:Number(sale.discountAmount),cartDiscountPercent:sale.discountPercent==null?undefined:Number(sale.discountPercent),discountReason:sale.discountReason??'',customer:sale.customer??null,note:sale.note??''});setServiceType(sale.serviceType??'');
      writeAttempt(checkoutAttempt,{...attempt});setHasPendingCheckout(true);setDraftToResume('');
      setParkedMessage('Server qoralamasi ochildi; narx va qoldiq yakunlashda qayta tekshiriladi.');
    }catch(error){notifyError(displayErrorMessage(error,'Qoralama ochilmadi'));}finally{setIsProcessingPayment(false);}
  };

  const cancelPendingCheckout=async()=>{
    const attempt=checkoutAttempt.current;
    if(!attempt || !organization?.id || !user?.id)return;
    setIsProcessingPayment(true);
    try{
      const scope={organizationId:organization.id,userId:user.id,deviceId:deviceId()};
      if(attempt.payload==='resumed'&&attempt.saleId){
        const current=await api.sales.get(attempt.saleId);
        if(current.data?.status==='draft'){
          if(role==='cashier')throw new Error('Server qoralamasini rahbar bekor qilishi kerak');
          await api.sales.void(attempt.saleId);
        }else if(current.data?.status!=='voided')throw new Error('Savdo yakunlangan yoki noma’lum; asl natijani tekshiring');
        await markCancelled(attempt.saleId,scope,{saleId:attempt.saleId,state:'voided'});
        await saveDraft(scope,{cart:{items,cartDiscount,cartDiscountPercent,discountReason,customer,note},serviceType,attempt:null});
        writeAttempt(checkoutAttempt,null);setHasPendingCheckout(false);notifySuccess('Server qoralamasi bekor qilinganini tekshirdik');return true;
      }
      const outcome=await api.operations.cancelDraftIntent(attempt.operationId,{...JSON.parse(attempt.payload),operationId:attempt.operationId});
      if(outcome.data?.state==='created' && outcome.data.saleId){
        writeAttempt(checkoutAttempt,{...attempt,saleId:outcome.data.saleId});
        const createdSaleId=outcome.data.saleId;
        const current=await api.sales.get(createdSaleId);
        if(current.data?.status!=='voided'){
          if(role==='cashier')throw new Error('Qoralama yaratilgan. Uni rahbar Savdolar sahifasida bekor qilishi kerak; keyin yana tekshiring.');
          await api.sales.void(createdSaleId);
        }
        await markCancelled(createdSaleId,scope,{saleId:createdSaleId,state:'voided'});
      }else if(outcome.data?.state!=='cancelled')throw new Error('Server bekor qilishni tasdiqlamadi');
      await markCancelled(attempt.operationId,scope,outcome.data);
      await saveDraft(scope,{cart:{items,cartDiscount,cartDiscountPercent,discountReason,customer,note},serviceType,attempt:null});
      writeAttempt(checkoutAttempt,null);setHasPendingCheckout(false);setIsPaymentModalOpen(false);
      notifySuccess('Urinish serverda bekor qilindi. Savat saqlangan.');
      return true;
    }catch(error){notifyError(displayErrorMessage(error,'Bekor qilish tasdiqlanmadi; urinish saqlangan'));return false;}
    finally{setIsProcessingPayment(false);}
  };

  const refreshConflictCart=async()=>{
    try{
      if(!activeStore)throw new Error('Filial tanlang')
      const quote=await api.request<{productId:string;unitPrice:string}[]>('/price-rules/quote',{method:'POST',body:JSON.stringify({storeId:activeStore.id,customerId:customer?.id,items:items.map(i=>({productId:i.product.id,quantity:i.quantity}))})});if(!quote.data||quote.data.length!==items.length)throw new Error('Narx darajasi tekshirilmadi')
      const current=await Promise.all(items.map(async item=>{const result=await api.products.get(item.product.id);if(!result.data||!result.data.isActive)throw new Error('Mahsulot arxivlangan; rahbar bilan savatni tekshiring');return {...item,product:result.data,tradeUnit:undefined,tradeQuantity:undefined,conversionRatio:undefined,unitPrice:Number(quote.data!.find(p=>p.productId===item.product.id)!.unitPrice),discountAmount:0,discountPercent:undefined,lineTotal:clientLine(item.quantity,Number(quote.data!.find(p=>p.productId===item.product.id)!.unitPrice))};}));
      if(checkoutAttempt.current&&!await cancelPendingCheckout())return;
      hydrate({items:current,cartDiscount:0,customer,note});setFailure(null);await loadProducts();
      notifySuccess('Narxlar yangilandi, chegirmalar tozalandi; miqdorlar asosiy birlikda. Miqdorlarni tekshirib, to‘lovni qayta tasdiqlang.');
    }catch(error){notifyError(displayErrorMessage(error,'Savat yangilanmadi; asl urinish saqlangan'));}
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
        writeAttempt(checkoutAttempt,{...attempt,saleId:draft.data.result.id});
        await acknowledge(attempt.operationId,'synced',draft.data.result);
        await saveDraft(scope,{cart:{items,cartDiscount,cartDiscountPercent,discountReason,customer,note},serviceType,attempt:checkoutAttempt.current});
      }
      const recoveredSaleId=checkoutAttempt.current?.saleId;
      if(!recoveredSaleId)throw new Error('Savdo natijasi topilmadi');
      const completed=await api.operations.status('sale.complete',recoveredSaleId);
      if (completed.data?.state!=='completed' || !completed.data.result) {
        notifyError('Qoralama mavjud, lekin yakunlash natijasi hali topilmadi. Shu savat va to‘lov bilan qayta urinishingiz mumkin; yangi savdo boshlamang.');
        return;
      }
      await acknowledgeRecovered(recoveredSaleId,scope,completed.data.result);
      await saveDraft(scope,{cart:{items:[],cartDiscount:0,customer:null,note:''},attempt:null});
      writeAttempt(checkoutAttempt,null);
      setHasPendingCheckout(false);
      setCompletedSale(completed.data.result);
      clearCart();setServiceType('');
      setIsPaymentModalOpen(false);
      setIsReceiptModalOpen(true);
      notifySuccess('Oldingi savdoning yakunlangan natijasi tiklandi');
    } catch(error) { notifyError(displayErrorMessage(error,'Savdo holatini tekshirib bo‘lmadi')); }
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
        if(lookupCount.current>0){notifyError('Avval mahsulot tekshiruvi tugashini kuting');return;}
        if(!activeShift){setIsOpenShiftModalOpen(true);return;}
        if(items.length)void handleProceedToPayment();
      }
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[localReady,isProcessingPayment,hasPendingCheckout,isPaymentModalOpen,isReceiptModalOpen,isOpenShiftModalOpen,activeShift,items.length,notifyError,handleProceedToPayment]);

  return (
    <div data-testid="pos-touch" className="min-h-[calc(100dvh-5rem)] lg:h-[calc(100dvh-5rem)] flex flex-col gap-4 [&_button]:min-h-11 [&_button]:min-w-11 [&_input]:min-h-11">
      <PendingActions prefix="/shifts" returnPath="/pos" revision={Number(isOpenShiftModalOpen)} onDone={()=>{void refreshShift().catch(()=>notifyError('Smena natijasi tasdiqlandi; joriy holat yuklanmadi.'))}}/>
      <div role="status" className={'flex flex-wrap items-center gap-2 '+(connection.state==='online'?'text-green-700':'bg-amber-50 text-amber-900 p-3')}>
        <span>{connection.state==='online'?tr("Server bilan aloqa bor"):connection.state==='checking'?tr("Server aloqasi tekshirilmoqda"):tr("Server bilan aloqa yo‘q. Savat lokal saqlanadi; savdo yakunlanmaydi.")}</span>
        <Button variant="outline" onClick={connection.recheck}>{tr("Aloqani tekshirish")}</Button>
      </div>
      <p className="text-xs text-slate-500">{tr("F2: qidirish · F4: qidiruv filtrlarini tozalash · F9: to‘lov oynasi · Esc: oynani yopish. To‘lov avtomatik yuborilmaydi.")}</p>
      {hasPendingCheckout && <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">{tr("Oldingi savdo natijasi tekshirilishi kerak. Savatni o‘zgartirmang.")}</p>
        <div className="flex flex-wrap gap-2"><Button onClick={handleProceedToPayment} disabled={isProcessingPayment||connection.state!=='online'}>{tr("Qoralama to‘lovini davom ettirish")}</Button><Button onClick={recoverCheckout} disabled={isProcessingPayment}>{tr("Natijani tekshirish")}</Button><Button disabled={isProcessingPayment||connection.state!=='online'} onClick={async()=>{if(!organization||!user)return;setIsProcessingPayment(true);try{await synchronize({organizationId:organization.id,userId:user.id,deviceId:deviceId()});await recoverCheckout();}catch(error){notifyError(displayErrorMessage(error,'Navbat saqlangan'));}finally{setIsProcessingPayment(false);}}}>{tr("Navbatni sinxronlash")}</Button><Button variant="outline" onClick={cancelPendingCheckout} disabled={isProcessingPayment}>{tr("Urinishni bekor qilish")}</Button></div>
      </div>}
      {/* Warning banner if shift is closed */}
      {!activeShift && (
        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center text-base">
              <FontAwesomeIcon icon={faExclamationTriangle} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">{tr("Smena ochilmagan")}</h4>
              <p className="text-xs text-amber-700">
                {tr("Savdolarni yakunlash va chek chiqarish uchun smena ochishingiz zarur")}</p>
            </div>
          </div>
          <Button
            variant="warning"
            size="sm"
            onClick={() => setIsOpenShiftModalOpen(true)}
            leftIcon={<FontAwesomeIcon icon={faClock} />}
            className="font-bold shadow-xs"
          >
            {tr("Smenani ochish")}</Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={parkDraft} disabled={!localReady||hasPendingCheckout||isProcessingPayment||!activeShift||!items.length||connection.state!=='online'}>{tr("Qoralamani serverda saqlash")}</Button><a href="/pos/offline" className="text-blue-800 underline p-2">{tr("Offline ruxsat olish")}</a><a href="/drafts" className="text-blue-800 underline p-2">{tr("Server qoralamalari")}</a><a href="/sync-review" className="text-blue-800 underline p-2">{tr("Navbat va konfliktlar")}</a><a href="/help" className="text-blue-800 underline p-2">{tr("Yordam")}</a></div>
      {draftToResume&&<Button disabled={!localReady||!activeShift||isProcessingPayment} onClick={openServerDraft}>{tr("Tanlangan server qoralamasini ochish")}</Button>}
      {parkedMessage&&<p role="status">{parkedMessage}</p>}
      <label>{tr("Chek izohi")}<textarea aria-label={tr("Chek izohi")} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} disabled={!localReady||hasPendingCheckout||isProcessingPayment} className="block border rounded p-2 w-full"/></label>
      <label>{tr("Xizmat turi (ixtiyoriy)")}<input aria-label={tr("Xizmat turi (ixtiyoriy)")} maxLength={100} value={serviceType} onChange={e=>setServiceType(e.target.value)} disabled={!localReady||hasPendingCheckout||isProcessingPayment} className="block border rounded p-2 w-full"/></label>
      {/* Main 2-column layout: Left Catalog, Right Cart */}
      {!localReady&&<p role="status">{tr("Lokal savat tiklanmoqda; mahsulot kiritishni kuting.")}</p>}
      {catalogNotice&&<p role="status">{uiMessage(catalogNotice)}</p>}
      <p role="status" className="text-sm text-gray-900">{!localReady?tr("Lokal savat tiklanmoqda"):localSaveProof===localSnapshot?tr("Savat lokal saqlandi"):tr("Savat lokal saqlanmoqda; oynani yopmang")}</p>
      <fieldset disabled={!localReady||!activeStore||!activeRegister||hasPendingCheckout} className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 min-w-0">
        {/* Left: Product Catalog & Search (2 cols) */}
        <div className="lg:col-span-2 flex flex-col min-h-[320px] lg:min-h-0">
          <ProductSearch
            quickScope={organization?.id&&user?.id&&activeRegister?.id?quickProductKey(organization.id,user.id,activeRegister.id):null}
            onQuickSelect={handleQuickProduct}
            onKeyboardIdentifier={value=>handleCameraBarcode(value,true)}
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
            cartDiscount={cartDiscount} cartDiscountPercent={cartDiscountPercent} onSetCartPercent={setCartDiscountPercent} discountReason={discountReason} onSetDiscountReason={setDiscountReason}
            customer={customer}
            customers={customers}
            onUpdateQuantity={updateQuantity} onSelectUnit={selectTradeUnit} onUpdateTradeQuantity={updateTradeQuantity}
            onUpdateDiscount={updateLineDiscount}
            onRemoveItem={removeItem}
            onClearCart={clearCart}
            onSetCartDiscount={setCartDiscount}
            onSetCustomer={setCustomer}
            onCheckout={handleProceedToPayment}
            disabled={!activeShift||!localReady||connection.state!=='online'}
          />
        </div>
      </fieldset>

      <Modal isOpen={Boolean(failure)} onClose={()=>setFailure(null)} title={failure?.stage==='integration'?tr("Tashqi xizmat holati"):tr("Savdo yakunlanmadi")}>
        {failure&&<div role="alert" data-stage={failure.stage} className="space-y-3"><p>{failure.code}: {uiMessage(failure.message)}</p><p>{uiMessage(failure.nextAction)}</p>
          {failure.details&&<div><p>{tr("Mahsulot:")}{' '}{failure.details.productName}</p>{failure.details.previousPrice!==undefined&&<p>{tr("Oldingi narx:")}{' '}{failure.details.previousPrice} {tr("· Joriy narx:")}{' '}{failure.details.currentPrice??tr("Mahsulot mavjud emas")}</p>}{failure.details.requestedQuantity!==undefined&&<p>{tr("Savat miqdori:")}{' '}{failure.details.requestedQuantity} {tr("· Mavjud qoldiq:")}{' '}{failure.details.availableQuantity}</p>}</div>}
          {['PRICE_CHANGED','INSUFFICIENT_STOCK'].includes(failure.code)&&<><p>{tr("Avval eski urinish serverda bekor qilinadi. Kassir qoralamasini bekor qilish uchun rahbar yordami kerak. Chegirmalar tozalanadi, to‘lov qayta tasdiqlanadi.")}</p><Button disabled={isProcessingPayment} onClick={refreshConflictCart}>{tr("Eski urinishni bekor qilib savatni yangilash")}</Button></>}
          <Button variant="outline" onClick={()=>{setFailure(null);void recoverCheckout();}}>{tr("Asl savdo natijasini tekshirish")}</Button>
        </div>}
      </Modal>
      {/* Modals */}
      <OpenShiftModal key={[organization?.id,user?.id,role].join(':')}
        isOpen={isOpenShiftModalOpen}
        onClose={() => setIsOpenShiftModalOpen(false)}
      />

      <PaymentModal
        storeId={activeStore?.id}
        serialItems={items.filter(item=>item.product.serialTracking).map(item=>({productId:item.product.id,name:item.product.name,quantity:String(item.quantity)}))}
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        totalAmount={Number(paymentQuote?.totals.totalAmount??totalAmount)}
        taxAmount={paymentQuote?.totals.taxAmount}
        netAmount={paymentQuote?.totals.netAmount}
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
