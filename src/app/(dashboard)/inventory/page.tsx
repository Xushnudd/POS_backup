'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotification } from '@/context/NotificationContext';
import { api, ApiError } from '@/lib/api';
import DurableMutation from '@/components/forms/DurableMutation';
import PendingActions from '@/components/forms/PendingActions';
import {confirmPageNavigation} from '@/lib/page-navigation';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import { InventoryBalance, Product, StockDocument, Supplier } from '@/types';
import { formatNumber, formatDate } from '@/lib/format';
import Pagination from '@/components/ui/Pagination';
import CsvExportButton from '@/components/ui/CsvExportButton';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWarehouse,
  faPlus,
  faFileLines,
  faBoxesStacked,
  faCheck,
  faTrash,
  faRightLeft,
} from '@fortawesome/free-solid-svg-icons';

export default function InventoryPage() {
  const { organization, role } = useAuth();
  const { activeStore } = useOrganization();
  const { notifySuccess, notifyError } = useNotification();

  const [activeTab, setActiveTab] = useState<'balances' | 'documents'>('balances');
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [documents, setDocuments] = useState<StockDocument[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [inactiveDays,setInactiveDays]=useState('');
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);

  const [listError,setListError]=useState(''),[pages,setPages]=useState(0);
  const [draftFilters,setDraftFilters]=useState({search:'',from:'',to:'',documentType:'',status:'',supplierId:''}),[filters,setFilters]=useState<Record<string,string>>({});
  const listScope=JSON.stringify([organization?.id,activeStore?.id,activeTab,lowStockOnly,inactiveDays,filters]);
  const [listPage,setListPage]=useState({scope:'',page:1});
  const page=listPage.scope===listScope?listPage.page:1;
  const requestSequence=useRef({value:0});

  // New stock document modal
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docType, setDocType] = useState<string>('purchase');
  const [docSupplierId, setDocSupplierId] = useState<string>('');
  const [docNote, setDocNote] = useState<string>('');
  const [docItems, setDocItems] = useState<
    { productId: string; quantity: string; unitCost: string;tradeUnit?:string }[]
  >([]);
  const [documentNo,setDocumentNo]=useState('');
  const [draftRevision,setDraftRevision]=useState(0);
  const [reverseTarget,setReverseTarget]=useState<{id:string;operationId:string}|null>(null);
  const [reverseReason,setReverseReason]=useState('');
  const [isReversing,setIsReversing]=useState(false);
  const [reverseSubmitted,setReverseSubmitted]=useState(false);
  const [docBaseline,setDocBaseline]=useState('');
  const docDirty=isDocModalOpen&&JSON.stringify([docType,docSupplierId,docNote,docItems])!==docBaseline;
  useUnsavedChanges(docDirty);
  const closeReversal=useUnsavedChanges(Boolean(reverseTarget&&reverseReason),isReversing);



  const loadData = useCallback(async () => {
    if (!organization?.id) return;
    const sequence=++requestSequence.current.value;
    setIsLoading(true);setListError('');
    try {
      if (activeTab === 'balances') {
        const res = await api.inventory.balances({
          organizationId: organization.id,
          storeId: activeStore?.id,
          lowStock: lowStockOnly || undefined,inactiveDays:inactiveDays?Number(inactiveDays):undefined,search:filters.search,page,limit:20,
        });
        if(sequence===requestSequence.current.value){setBalances(res.data??[]);setPages(res.pagination?.totalPages??0);}
      } else {
        const res = await api.stockDocuments.list({
          organizationId: organization.id,
          storeId: activeStore?.id,...filters,page,limit:20,
        });
        if(sequence===requestSequence.current.value){setDocuments(res.data??[]);setPages(res.pagination?.totalPages??0);}
      }
    } catch (err: unknown) {
      if(sequence===requestSequence.current.value){setListError(err instanceof Error?err.message:'Ombor ro‘yxati yuklanmadi');setBalances([]);setDocuments([]);setPages(0);}
    } finally {
      if(sequence===requestSequence.current.value)setIsLoading(false);
    }
  }, [organization, activeStore, activeTab, lowStockOnly, inactiveDays, filters, page]);

  useEffect(() => {
    const requests=requestSequence.current;let cancelled=false;void Promise.resolve().then(()=>{if(!cancelled)return loadData();});
    return()=>{cancelled=true;requests.value++;};
  }, [loadData]);

  // Load products and suppliers for document creation
  useEffect(() => {
    if (!organization?.id) return;
    api.products.list({ organizationId: organization.id, limit: 200 }).then((res) => {
      if (res.data) setProducts(res.data);
    });
    api.suppliers.list(organization.id).then((res) => {
      if (res.data) setSuppliers(res.data);
    });
  }, [organization?.id]);

  const handleConfirmDocument = async (id: string) => {
    if (!confirm('Ushbu hujjatni tasdiqlaysizmi? Qoldiqlar darhol yangilanadi.')) return;

    try {
      await api.stockDocuments.confirm(id);
      notifySuccess('Ombor hujjati tasdiqlandi va qoldiqlar yangilandi!');
      loadData();
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Hujjatni tasdiqlashda xatolik');
    }
  };

  const handleReverseDocument=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(!reverseTarget)return;
    setIsReversing(true);setReverseSubmitted(true);
    try{
      await api.stockDocuments.reverse(reverseTarget.id,{operationId:reverseTarget.operationId,reason:reverseReason});
      setReverseTarget(null);notifySuccess('Qarshi hujjat tasdiqlandi; asl hujjat tarixda saqlandi');await loadData();
    }catch(error){
      if(error instanceof ApiError && error.status && error.status>=400 && error.status<500){setReverseSubmitted(false);if(error.code==='ALREADY_REVERSED'){setReverseTarget(null);await loadData();}}
      notifyError(error instanceof Error?error.message:'Qarshi hujjat yaratilmadi. Shu amal bilan qayta urinishingiz mumkin');
    }
    finally{setIsReversing(false);}
  };

  const openNewDocModal = () => {
    setDocumentNo('DOC-'+crypto.randomUUID());
    setDocType('purchase');
    setDocSupplierId(suppliers[0]?.id || '');
    setDocNote('');
    const initialItems=products.length>0?[{productId:products[0].id,quantity:'10',unitCost:String(products[0].costPrice??'0')}]:[];
    setDocItems(initialItems);
    setDocBaseline(JSON.stringify(['purchase',suppliers[0]?.id||'','',initialItems]));
    setIsDocModalOpen(true);
  };

  const handleAddItemRow = () => {
    if (products.length === 0) return;
    setDocItems([
      ...docItems,
      { productId: products[0].id, quantity: '1', unitCost: String(products[0].costPrice??'0') },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    setDocItems(docItems.filter((_, i) => i !== index));
  };


  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PendingActions prefix="/stock-documents" returnPath="/inventory" revision={draftRevision} onDone={()=>{setDraftRevision(value=>value+1);void loadData()}}/>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Ombor boshqaruvi
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tovar qoldiqlari, kirim hujjatlari va inventarizatsiya
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/inventory/counts"><Button variant="outline">Inventarizatsiya</Button></Link>
          <Link href="/inventory/locations">Zonalar va rezervlar</Link><Link href="/inventory/transfers">
            <Button variant="outline" leftIcon={<FontAwesomeIcon icon={faRightLeft} />}>
              Transferlar
            </Button>
          </Link>

          <Button
            variant="success"
            onClick={openNewDocModal}
            leftIcon={<FontAwesomeIcon icon={faPlus} />}
            className="font-bold shadow-md shadow-emerald-500/20"
          >
            Yangi kirim hujjati
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('balances')}
            className={`pb-3 text-sm font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'balances'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FontAwesomeIcon icon={faBoxesStacked} className="mr-2" />
            Joriy qoldiqlar
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`pb-3 text-sm font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'documents'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FontAwesomeIcon icon={faFileLines} className="mr-2" />
            Hujjatlar (Kirim/Tuzatish)
          </button>
        </div>

        {activeTab === 'balances' && (
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 pb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded-sm text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>Faqat kam qolganlar</span>
          </label>
        )}
      </div>

      {activeTab==='balances'&&<div className="max-w-md space-y-1"><Select label="Filialda yakunlangan savdosiz qoldiq" value={inactiveDays} onChange={event=>setInactiveDays(event.target.value)} options={[{value:'',label:'Barcha qoldiqlar'},{value:'30',label:'Oxirgi 30 kun savdo yo‘q'},{value:'60',label:'Oxirgi 60 kun savdo yo‘q'},{value:'90',label:'Oxirgi 90 kun savdo yo‘q'}]}/><p className="text-xs text-gray-600">Faqat musbat joriy qoldiq. Bu omborda turish yoshi emas; qaytarilgan savdo ham savdo harakati hisoblanadi.</p></div>}
      <form className="grid sm:grid-cols-3 gap-3" onSubmit={event=>{event.preventDefault();setFilters(Object.fromEntries(Object.entries(draftFilters).filter(([,value])=>value.trim()).map(([key,value])=>[key,value.trim()])));}}>
        <Input label={activeTab==='balances'?'Mahsulot, SKU yoki barkod':'Hujjat raqamini qidirish'} value={draftFilters.search} maxLength={200} onChange={e=>setDraftFilters({...draftFilters,search:e.target.value})}/>
        {activeTab==='documents'&&<><Input label="Hujjat davri boshi" type="date" value={draftFilters.from} onChange={e=>setDraftFilters({...draftFilters,from:e.target.value})}/><Input label="Hujjat davri oxiri" type="date" value={draftFilters.to} onChange={e=>setDraftFilters({...draftFilters,to:e.target.value})}/><Select label="Hujjat turi filtri" value={draftFilters.documentType} options={[{value:'',label:'Barchasi'},{value:'purchase',label:'Xarid'},{value:'opening',label:'Boshlang‘ich qoldiq'},{value:'adjustment',label:'Tuzatish'},{value:'reversal',label:'Qarshi hujjat'},{value:'transfer_out',label:'Transfer chiqimi'},{value:'transfer_in',label:'Transfer kirimi'},{value:'return_in',label:'Qaytarish kirimi'}]} onChange={e=>setDraftFilters({...draftFilters,documentType:e.target.value})}/><Select label="Hujjat holati filtri" value={draftFilters.status} options={[{value:'',label:'Barchasi'},{value:'draft',label:'Qoralama'},{value:'confirmed',label:'Tasdiqlangan'}]} onChange={e=>setDraftFilters({...draftFilters,status:e.target.value})}/><Input label="Supplier ID filtri" value={draftFilters.supplierId} onChange={e=>setDraftFilters({...draftFilters,supplierId:e.target.value})}/></>}
        <Button type="submit" disabled={isLoading}>Filtrlash</Button>
      </form>
      {organization&&<CsvExportButton path={activeTab==='balances'?'/inventory/balances':'/stock-documents'} label={activeTab==='balances'?'Qoldiqlarni CSV yuklash':'Hujjatlarni CSV yuklash'} params={{organizationId:organization.id,...(activeStore?{storeId:activeStore.id}:{}),...(activeTab==='balances'?{...(filters.search?{search:filters.search}:{}),...(lowStockOnly?{lowStock:'true'}:{}),...(inactiveDays?{inactiveDays}:{})}:filters)}}/>}
      {listError&&<p role="alert" className="text-red-700">{listError}</p>}
      <Pagination page={page} pages={pages} busy={isLoading} onPage={value=>setListPage({scope:listScope,page:value})} retry={()=>{void loadData();}}/>

      {/* Tab Content: Balances */}
      {activeTab === 'balances' && (
        <Card padding={false}>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <LoadingSpinner size="lg" text="Qoldiqlar yuklanmoqda..." />
            </div>
          ) : balances.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <FontAwesomeIcon icon={faWarehouse} className="text-4xl text-gray-300 mb-3" />
              <p className="text-base font-bold text-gray-700">Qoldiqlar mavjud emas</p>
              <p className="text-xs text-gray-400 mt-1">
                Omborga tovar kiritish uchun &quot;Yangi kirim hujjati&quot; tugmasini bosing
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Mahsulot</th>
                    <th className="py-3.5 px-4">SKU / Barkod</th>
                    <th className="py-3.5 px-4 text-center">Birlik</th>
                    <th className="py-3.5 px-4 text-right">Mavjud qoldiq</th>
                    <th className="py-3.5 px-4 text-center">Min. zaxira</th>
                    <th className="py-3.5 px-4 text-center">Holat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {balances.map((b, idx) => {
                    const isLow =
                      Number(b.product?.minStock || 0) > 0 &&
                      Number(b.quantity) < Number(b.product?.minStock || 0);
                    return (
                      <tr key={idx} className="hover:bg-gray-50/70 transition">
                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          {b.product?.name || 'Mahsulot'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-gray-500">
                          {b.product?.sku}
                        </td>
                        <td className="py-3.5 px-4 text-center font-medium text-gray-600">
                          {b.product?.unit || 'dona'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-sm text-gray-900">
                          {formatNumber(b.quantity)}
                        </td>
                        <td className="py-3.5 px-4 text-center text-gray-500">
                          {formatNumber(b.product?.minStock || 0)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isLow ? (
                            <Badge variant="danger" size="sm" dot>
                              Kam qolgan
                            </Badge>
                          ) : (
                            <Badge variant="success" size="sm" dot>
                              Yetarli
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Tab Content: Documents */}
      {activeTab === 'documents' && (
        <Card padding={false}>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <LoadingSpinner size="lg" text="Hujjatlar yuklanmoqda..." />
            </div>
          ) : documents.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <FontAwesomeIcon icon={faFileLines} className="text-4xl text-gray-300 mb-3" />
              <p className="text-base font-bold text-gray-700">Hujjatlar topilmadi</p>
              <p className="text-xs text-gray-400 mt-1">
                Kirim va tuzatish hujjatlari bu yerda ko&apos;rinadi
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Hujjat №</th>
                    <th className="py-3.5 px-4">Turi</th>
                    <th className="py-3.5 px-4">Ta&apos;minotchi</th>
                    <th className="py-3.5 px-4 text-center">Mahsulotlar soni</th>
                    <th className="py-3.5 px-4">Sana</th>
                    <th className="py-3.5 px-4 text-center">Holat</th>
                    <th className="py-3.5 px-4 text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                        {doc.documentNo}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-gray-700">
                        {doc.documentType === 'purchase'
                          ? 'Kirim (Xarid)'
                          : doc.documentType === 'adjustment'
                          ? 'Tuzatish'
                          : doc.documentType === 'reversal' ? 'Qarshi hujjat' : doc.documentType}
                      </td>
                      <td className="py-3.5 px-4 text-gray-700">
                        {doc.supplier?.name || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-gray-800">
                        {doc.items?.length || 0} ta
                      </td>
                      <td className="py-3.5 px-4 text-gray-500">
                        {formatDate(doc.createdAt, true)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {doc.status === 'confirmed' ? (
                          <Badge variant="success" size="sm">
                            Tasdiqlangan
                          </Badge>
                        ) : (
                          <Badge variant="warning" size="sm">
                            Qoralama
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {doc.status === 'confirmed' && !doc.reversalOfId && (role==='owner'||role==='admin') && (
                          doc.reversal ? <span className="text-xs text-gray-500">Qaytarilgan: {doc.reversal.documentNo}</span> :
                          <Button variant="outline" size="sm" onClick={()=>{setReverseTarget({id:doc.id,operationId:crypto.randomUUID()});setReverseReason('');setReverseSubmitted(false);}}>Qarshi hujjat</Button>
                        )}
                        {doc.status === 'draft' && (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleConfirmDocument(doc.id)}
                            leftIcon={<FontAwesomeIcon icon={faCheck} />}
                          >
                            Tasdiqlash
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal isOpen={!!reverseTarget} onClose={()=>{if(!reverseSubmitted&&closeReversal())setReverseTarget(null);}} title="Ombor hujjatini qaytarish">
        <form onSubmit={handleReverseDocument} className="space-y-4">
          <p className="text-sm text-gray-600">Asl hujjat o‘zgarmaydi. Miqdorlar qarshi hujjat bilan qaytariladi; yetarli qoldiq bo‘lishi shart.</p>
          <Input label="Qaytarish sababi" value={reverseReason} onChange={event=>setReverseReason(event.target.value)} minLength={3} maxLength={2000} required disabled={reverseSubmitted}/>
          {reverseSubmitted && <p className="text-sm text-amber-700">Javob noaniq bo‘lsa, shu amal bilan qayta urining. Sabab va kalit saqlanadi.</p>}
          <Button type="submit" disabled={isReversing}>{isReversing?'Tekshirilmoqda...':reverseSubmitted?'Natijani qayta olish':'Qarshi hujjatni tasdiqlash'}</Button>
        </form>
      </Modal>
      {/* New Document Modal */}
      <Modal
        isOpen={isDocModalOpen}
        onClose={() => {if(confirmPageNavigation())setIsDocModalOpen(false)}}
        title="Yangi ombor hujjati (Kirim)"
        size="xl"
      >
        <DurableMutation path="/stock-documents" returnPath="/inventory" label="Hujjatni yaratish" body={{organizationId:organization?.id,storeId:activeStore?.id,documentNo,documentType:docType,supplierId:docSupplierId||undefined,note:docNote||undefined,items:docItems}} review={[`Qoralama: ${documentNo}`,`Tur: ${docType}; filial: ${activeStore?.name??''}`,`Qatorlar: ${docItems.length}`,`Sabab: ${docNote}`, ...docItems.map(item=>`${products.find(product=>product.id===item.productId)?.name??item.productId}: ${item.quantity} × ${item.unitCost}; birlik: ${item.tradeUnit??products.find(product=>product.id===item.productId)?.unit??''}`)]} onDone={()=>{notifySuccess('Ombor qoralamasi yaratildi');setIsDocModalOpen(false);setActiveTab('documents');setDraftRevision(value=>value+1);void loadData()}}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Hujjat turi"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              options={[
                { value: 'purchase', label: 'Kirim (Xarid)' },
                { value: 'opening', label: 'Boshlang‘ich qoldiq' },
                { value: 'adjustment', label: 'Tuzatish (Inventarizatsiya)' },
              ]}
            />

            <Select
              label="Yetkazib beruvchi (ta'minotchi)"
              value={docSupplierId}
              onChange={(e) => setDocSupplierId(e.target.value)}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              placeholder="Ta'minotchini tanlang (ixtiyoriy)"
            />
          </div>

          <Input
            label="Izoh (ixtiyoriy)"
            placeholder="Hujjat bo'yicha qo'shimcha ma'lumot"
            value={docNote}
            onChange={(e) => setDocNote(e.target.value)}
          />

          {/* Document Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-700">
                Mahsulotlar ro&apos;yxati
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItemRow}
                leftIcon={<FontAwesomeIcon icon={faPlus} />}
              >
                Qator qo&apos;shish
              </Button>
            </div>

            <p>Tannarx har doim mahsulotning asosiy birligi uchun kiritiladi; hujjat miqdori tanlangan birlikdan konvertatsiya qilinadi.</p>
            <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-xl p-3 bg-gray-50">
              {docItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <select
                      value={item.productId}
                      onChange={(e) => {
                        const selProd = products.find((p) => p.id === e.target.value);
                        const updated = [...docItems];
                        updated[idx].productId = e.target.value;updated[idx].tradeUnit=undefined;
                        if (selProd) {
                          updated[idx].unitCost = String(selProd.costPrice??'0');
                        }
                        setDocItems(updated);
                      }}
                      className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-hidden"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <label className="text-xs">Hujjat birligi<select aria-label={'Hujjat birligi '+idx} value={item.tradeUnit??products.find(p=>p.id===item.productId)?.unit??''} onChange={e=>{const updated=[...docItems];updated[idx]={...item,tradeUnit:e.target.value};setDocItems(updated)}}><option value={products.find(p=>p.id===item.productId)?.unit}>{products.find(p=>p.id===item.productId)?.unit}</option>{products.find(p=>p.id===item.productId)?.unitConversions?.filter(row=>row.isActive).map(row=><option key={row.tradeUnit} value={row.tradeUnit}>{row.tradeUnit}:1={row.ratio} {row.baseUnit}</option>)}</select></label>
                  <div className="w-24">
                    <input
                      type="number"
                      placeholder="Miqdor"
                      min={docType==='adjustment'?undefined:'0.000001'}
                      step="0.1"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...docItems];
                        updated[idx].quantity = e.target.value;
                        setDocItems(updated);
                      }}
                      className="w-full text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-hidden text-center"
                    />
                  </div>

                  <div className="w-32">
                    <input
                      type="number"
                      placeholder="Asosiy birlik tannarxi"
                      aria-label={'Asosiy birlik tannarxi '+idx}
                      min="0"
                      step="100"
                      value={item.unitCost}
                      onChange={(e) => {
                        const updated = [...docItems];
                        updated[idx].unitCost = e.target.value;
                        setDocItems(updated);
                      }}
                      className="w-full text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-hidden text-right"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItemRow(idx)}
                    className="p-2 text-gray-400 hover:text-red-600 transition"
                  >
                    <FontAwesomeIcon icon={faTrash} className="text-xs" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => {if(confirmPageNavigation())setIsDocModalOpen(false)}}
            >
              Bekor qilish
            </Button>

          </div>
        </DurableMutation>
      </Modal>
    </div>
  );
}
