'use client';

import {useTranslation} from '@/context/LocaleContext';

import SerialPicker from '@/components/inventory/SerialPicker';
import React, { Suspense, useState, useEffect, useCallback, useRef } from 'react';
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

import {useListFilters} from '@/hooks/useListFilters';
import {inventoryListSorts,journalListSorts} from '@/lib/list-query';
import DataTable from '@/components/ui/DataTable';
export default function InventoryPage(){
 const {t:tr}=useTranslation();
const {organization,user,role}=useAuth();return <Suspense fallback={<p>{tr("Yuklanmoqda...")}</p>}><Inventory key={[organization?.id,user?.id,role].join(':')}/></Suspense>;}
function Inventory() {
 const {formatNumber,formatDate}=useTranslation();

 const {t:tr}=useTranslation();

  const { organization, role } = useAuth();
  const { activeStore } = useOrganization();
  const { notifySuccess, notifyError } = useNotification();

  const {query,params,filters,changeQuery}=useListFilters(inventoryListSorts,'newest',['search','from','to','documentType','status','supplierId']);
  const activeTab=params.get('tab')??'balances',page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'newest';
  const inactiveDays=params.get('inactiveDays')??'',lowStockOnly=params.get('lowStock')==='true';
  const invalidQuery=!query||!['balances','documents'].includes(activeTab)||(activeTab==='documents'&&!journalListSorts.some(value=>value===sort))||(params.has('lowStock')&&!['true','false'].includes(params.get('lowStock')!));
  const setActiveTab=(tab:string)=>changeQuery({tab,page:'1',sort:''}),setInactiveDays=(value:string)=>changeQuery({inactiveDays:value,page:'1'}),setLowStockOnly=(value:boolean)=>changeQuery({lowStock:value?'true':'',page:'1'});
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [documents, setDocuments] = useState<StockDocument[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [listError,setListError]=useState(''),[pages,setPages]=useState(0);
  const [draftFilters,setDraftFilters]=useState({search:params.get('search')??'',from:params.get('from')??'',to:params.get('to')??'',documentType:params.get('documentType')??'',status:params.get('status')??'',supplierId:params.get('supplierId')??''});
  const filterKey=JSON.stringify(filters);
  useEffect(()=>{let live=true;void Promise.resolve().then(()=>{if(live)setDraftFilters({search:'',from:'',to:'',documentType:'',status:'',supplierId:'',...JSON.parse(filterKey)});});return()=>{live=false;};},[filterKey]);
  const requestSequence=useRef({value:0});

  // New stock document modal
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docType, setDocType] = useState<string>('purchase');
  const [docSupplierId, setDocSupplierId] = useState<string>('');
  const [docNote, setDocNote] = useState<string>('');
  const [docItems, setDocItems] = useState<
    { productId: string; quantity: string; unitCost: string;tradeUnit?:string;serialInput?:string[];batchInput?:{code:string;receivedOn:string;expiresOn:string} }[]
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
    if (!organization?.id||invalidQuery) return;
    const sequence=++requestSequence.current.value;
    setIsLoading(true);setListError('');
    try {
      if (activeTab === 'balances') {
        const res = await api.inventory.balances({
          organizationId: organization.id,
          storeId: activeStore?.id,
          lowStock: lowStockOnly || undefined,inactiveDays:inactiveDays?Number(inactiveDays):undefined,search:filters.search,page,limit,sort,
        });
        if(sequence===requestSequence.current.value){setBalances(res.data??[]);setPages(res.pagination?.totalPages??0);}
      } else {
        const res = await api.stockDocuments.list({
          organizationId: organization.id,
          storeId: activeStore?.id,...filters,page,limit,sort,
        });
        if(sequence===requestSequence.current.value){setDocuments(res.data??[]);setPages(res.pagination?.totalPages??0);}
      }
    } catch (err: unknown) {
      if(sequence===requestSequence.current.value)setListError(err instanceof Error?err.message:'Ombor ro‘yxati yuklanmadi');
    } finally {
      if(sequence===requestSequence.current.value)setIsLoading(false);
    }
  }, [organization, activeStore, activeTab, lowStockOnly, inactiveDays, filters, page, limit, sort, invalidQuery]);

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
      <Link href="/inventory/serials" className="text-blue-700 underline">{tr("Seriya raqamlari va kafolat")}</Link>
      <Link href="/inventory/batches" className="text-blue-700 underline">{tr("Partiyalar va yaroqlilik hisoboti")}</Link>
      <PendingActions prefix="/stock-documents" returnPath="/inventory" revision={draftRevision} onDone={()=>{setDraftRevision(value=>value+1);void loadData()}}/>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {tr("Ombor boshqaruvi")}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {tr("Tovar qoldiqlari, kirim hujjatlari va inventarizatsiya")}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/inventory/counts"><Button variant="outline">{tr("Inventarizatsiya")}</Button></Link>
          <Link href="/inventory/locations">{tr("Zonalar va rezervlar")}</Link><Link href="/inventory/transfers">
            <Button variant="outline" leftIcon={<FontAwesomeIcon icon={faRightLeft} />}>
              {tr("Transferlar")}</Button>
          </Link>

          <Button
            variant="success"
            onClick={openNewDocModal}
            leftIcon={<FontAwesomeIcon icon={faPlus} />}
            className="font-bold shadow-md shadow-emerald-500/20"
          >
            {tr("Yangi kirim hujjati")}</Button>
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
            {tr("Joriy qoldiqlar")}</button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`pb-3 text-sm font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'documents'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FontAwesomeIcon icon={faFileLines} className="mr-2" />
            {tr("Hujjatlar (Kirim/Tuzatish)")}</button>
        </div>

        {activeTab === 'balances' && (
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 pb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded-sm text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>{tr("Faqat kam qolganlar")}</span>
          </label>
        )}
      </div>

      {activeTab==='balances'&&<div className="max-w-md space-y-1"><Select label={tr("Filialda yakunlangan savdosiz qoldiq")} value={inactiveDays} onChange={event=>setInactiveDays(event.target.value)} options={[{value:'',label:tr("Barcha qoldiqlar")},{value:'30',label:tr("Oxirgi 30 kun savdo yo‘q")},{value:'60',label:tr("Oxirgi 60 kun savdo yo‘q")},{value:'90',label:tr("Oxirgi 90 kun savdo yo‘q")}]}/><p className="text-xs text-gray-600">{tr("Faqat musbat joriy qoldiq. Bu omborda turish yoshi emas; qaytarilgan savdo ham savdo harakati hisoblanadi.")}</p></div>}
      <form className="grid sm:grid-cols-3 gap-3" onSubmit={event=>{event.preventDefault();changeQuery({...Object.fromEntries(Object.entries(draftFilters).map(([key,value])=>[key,value.trim()])),page:'1'});}}>
        <Input label={activeTab==='balances'?tr("Mahsulot, SKU yoki barkod"):tr("Hujjat raqamini qidirish")} value={draftFilters.search} maxLength={200} onChange={e=>setDraftFilters({...draftFilters,search:e.target.value})}/>
        {activeTab==='documents'&&<><Input label={tr("Hujjat davri boshi")} type="date" value={draftFilters.from} onChange={e=>setDraftFilters({...draftFilters,from:e.target.value})}/><Input label={tr("Hujjat davri oxiri")} type="date" value={draftFilters.to} onChange={e=>setDraftFilters({...draftFilters,to:e.target.value})}/><Select label={tr("Hujjat turi filtri")} value={draftFilters.documentType} options={[{value:'',label:tr("Barchasi")},{value:'purchase',label:tr("Xarid")},{value:'opening',label:tr("Boshlang‘ich qoldiq")},{value:'adjustment',label:tr("Tuzatish")},{value:'reversal',label:tr("Qarshi hujjat")},{value:'transfer_out',label:tr("Transfer chiqimi")},{value:'transfer_in',label:tr("Transfer kirimi")},{value:'return_in',label:tr("Qaytarish kirimi")}]} onChange={e=>setDraftFilters({...draftFilters,documentType:e.target.value})}/><Select label={tr("Hujjat holati filtri")} value={draftFilters.status} options={[{value:'',label:tr("Barchasi")},{value:'draft',label:tr("Qoralama")},{value:'confirmed',label:tr("Tasdiqlangan")}]} onChange={e=>setDraftFilters({...draftFilters,status:e.target.value})}/><Input label={tr("Supplier ID filtri")} value={draftFilters.supplierId} onChange={e=>setDraftFilters({...draftFilters,supplierId:e.target.value})}/></>}
        <Button type="submit" disabled={isLoading}>{tr("Filtrlash")}</Button>
      </form>
      <div className="flex gap-3"><Select label={tr("Ombor saralash")} value={sort} options={(activeTab==='documents'?journalListSorts:inventoryListSorts).map(value=>({value,label:({newest:'Eng yangi',oldest:'Eng eski',name_asc:'Nom: A–Z',name_desc:'Nom: Z–A',quantity_asc:'Miqdor: o‘sish',quantity_desc:'Miqdor: kamayish'} as Record<string,string>)[value]}))} onChange={e=>changeQuery({sort:e.target.value,page:'1'})}/><Button onClick={()=>changeQuery({search:'',from:'',to:'',documentType:'',status:'',supplierId:'',sort:'',page:'',limit:'',inactiveDays:'',lowStock:''})}>{tr("Filtrlarni tozalash")}</Button></div>
      {organization&&<CsvExportButton path={activeTab==='balances'?'/inventory/balances':'/stock-documents'} label={activeTab==='balances'?tr("Qoldiqlarni CSV yuklash"):tr("Hujjatlarni CSV yuklash")} params={{organizationId:organization.id,sort,...(activeStore?{storeId:activeStore.id}:{}),...(activeTab==='balances'?{...(filters.search?{search:filters.search}:{}),...(lowStockOnly?{lowStock:'true'}:{}),...(inactiveDays?{inactiveDays}:{})}:filters)}}/>}
      {invalidQuery&&<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>}
      {listError&&<p role="alert" className="text-red-700">{listError}</p>}
      {!invalidQuery&&page>Math.max(1,pages)&&<Button onClick={()=>changeQuery({page:'1'})}>{tr("Birinchi sahifaga qaytish")}</Button>}
      <Pagination page={page} pages={pages} busy={isLoading&&!invalidQuery} blocked={invalidQuery||!!listError} onPage={value=>changeQuery({page:String(value)})} retry={()=>{void loadData();}}/>

      {/* Tab Content: Balances */}
      {activeTab === 'balances' && (
        <Card padding={false}>
          {invalidQuery||listError ? (<p>{tr("Ro‘yxat yuklanmadi; filtrlarni tekshiring yoki qayta yuklang.")}</p>) : isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <LoadingSpinner size="lg" text={tr("Qoldiqlar yuklanmoqda...")} />
            </div>
          ) : balances.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <FontAwesomeIcon icon={faWarehouse} className="text-4xl text-gray-300 mb-3" />
              <p className="text-base font-bold text-gray-700">{tr("Qoldiqlar mavjud emas")}</p>
              <p className="text-xs text-gray-400 mt-1">
                {tr("Omborga tovar kiritish uchun \"Yangi kirim hujjati\" tugmasini bosing")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <DataTable className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">{tr("Mahsulot")}</th>
                    <th className="py-3.5 px-4">{tr("SKU / Barkod")}</th>
                    <th className="py-3.5 px-4 text-center">{tr("Birlik")}</th>
                    <th className="py-3.5 px-4 text-right">{tr("Mavjud qoldiq")}</th>
                    <th className="py-3.5 px-4 text-center">{tr("Min. zaxira")}</th>
                    <th className="py-3.5 px-4 text-center">{tr("Holat")}</th>
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
                          {b.product?.name || tr("Mahsulot")}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-gray-500">
                          {b.product?.sku}
                        </td>
                        <td className="py-3.5 px-4 text-center font-medium text-gray-600">
                          {b.product?.unit || tr("dona")}
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
                              {tr("Kam qolgan")}</Badge>
                          ) : (
                            <Badge variant="success" size="sm" dot>
                              {tr("Yetarli")}</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            </div>
          )}
        </Card>
      )}

      {/* Tab Content: Documents */}
      {activeTab === 'documents' && (
        <Card padding={false}>
          {invalidQuery||listError ? (<p>{tr("Ro‘yxat yuklanmadi; filtrlarni tekshiring yoki qayta yuklang.")}</p>) : isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <LoadingSpinner size="lg" text={tr("Hujjatlar yuklanmoqda...")} />
            </div>
          ) : documents.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <FontAwesomeIcon icon={faFileLines} className="text-4xl text-gray-300 mb-3" />
              <p className="text-base font-bold text-gray-700">{tr("Hujjatlar topilmadi")}</p>
              <p className="text-xs text-gray-400 mt-1">
                {tr("Kirim va tuzatish hujjatlari bu yerda ko'rinadi")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <DataTable className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">{tr("Hujjat №")}</th>
                    <th className="py-3.5 px-4">{tr("Turi")}</th>
                    <th className="py-3.5 px-4">{tr("Ta'minotchi")}</th>
                    <th className="py-3.5 px-4 text-center">{tr("Mahsulotlar soni")}</th>
                    <th className="py-3.5 px-4">{tr("Sana")}</th>
                    <th className="py-3.5 px-4 text-center">{tr("Holat")}</th>
                    <th className="py-3.5 px-4 text-right">{tr("Amallar")}</th>
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
                          ? tr("Kirim (Xarid)")
                          : doc.documentType === 'adjustment'
                          ? tr("Tuzatish")
                          : doc.documentType === 'reversal' ? tr("Qarshi hujjat") : doc.documentType}
                      </td>
                      <td className="py-3.5 px-4 text-gray-700">
                        {doc.supplier?.name || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-gray-800">
                        {doc.items?.length || 0} {tr("ta")}</td>
                      <td className="py-3.5 px-4 text-gray-500">
                        {formatDate(doc.createdAt, true)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {doc.status === 'confirmed' ? (
                          <Badge variant="success" size="sm">
                            {tr("Tasdiqlangan")}</Badge>
                        ) : (
                          <Badge variant="warning" size="sm">
                            {tr("Qoralama")}</Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {doc.status === 'confirmed' && !doc.reversalOfId && (role==='owner'||role==='admin') && (
                          doc.reversal ? <span className="text-xs text-gray-500">{tr("Qaytarilgan:")}{' '}{doc.reversal.documentNo}</span> :
                          <Button variant="outline" size="sm" onClick={()=>{setReverseTarget({id:doc.id,operationId:crypto.randomUUID()});setReverseReason('');setReverseSubmitted(false);}}>{tr("Qarshi hujjat")}</Button>
                        )}
                        {doc.status === 'draft' && (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleConfirmDocument(doc.id)}
                            leftIcon={<FontAwesomeIcon icon={faCheck} />}
                          >
                            {tr("Tasdiqlash")}</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
          )}
        </Card>
      )}

      <Modal isOpen={!!reverseTarget} onClose={()=>{if(!reverseSubmitted&&closeReversal())setReverseTarget(null);}} title={tr("Ombor hujjatini qaytarish")}>
        <form onSubmit={handleReverseDocument} className="space-y-4">
          <p className="text-sm text-gray-600">{tr("Asl hujjat o‘zgarmaydi. Miqdorlar qarshi hujjat bilan qaytariladi; yetarli qoldiq bo‘lishi shart.")}</p>
          <Input label={tr("Qaytarish sababi")} value={reverseReason} onChange={event=>setReverseReason(event.target.value)} minLength={3} maxLength={2000} required disabled={reverseSubmitted}/>
          {reverseSubmitted && <p className="text-sm text-amber-700">{tr("Javob noaniq bo‘lsa, shu amal bilan qayta urining. Sabab va kalit saqlanadi.")}</p>}
          <Button type="submit" disabled={isReversing}>{isReversing?tr("Tekshirilmoqda..."):reverseSubmitted?tr("Natijani qayta olish"):tr("Qarshi hujjatni tasdiqlash")}</Button>
        </form>
      </Modal>
      {/* New Document Modal */}
      <Modal
        isOpen={isDocModalOpen}
        onClose={() => {if(confirmPageNavigation())setIsDocModalOpen(false)}}
        title={tr("Yangi ombor hujjati (Kirim)")}
        size="xl"
      >
        <DurableMutation path="/stock-documents" returnPath="/inventory" label={tr("Hujjatni yaratish")} body={{organizationId:organization?.id,storeId:activeStore?.id,documentNo,documentType:docType,supplierId:docSupplierId||undefined,note:docNote||undefined,items:docItems}} review={[`Qoralama: ${documentNo}`,`Tur: ${docType}; filial: ${activeStore?.name??''}`,`Qatorlar: ${docItems.length}`,`Sabab: ${docNote}`, ...docItems.map(item=>`${products.find(product=>product.id===item.productId)?.name??item.productId}: ${item.quantity} × ${item.unitCost}; birlik: ${item.tradeUnit??products.find(product=>product.id===item.productId)?.unit??''}${item.batchInput?'; partiya '+item.batchInput.code+'; kirim '+item.batchInput.receivedOn+'; yaroqli '+item.batchInput.expiresOn:''}`)]} onDone={()=>{notifySuccess('Ombor qoralamasi yaratildi');setIsDocModalOpen(false);setActiveTab('documents');setDraftRevision(value=>value+1);void loadData()}}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label={tr("Hujjat turi")}
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              options={[
                { value: 'purchase', label: tr("Kirim (Xarid)") },
                { value: 'opening', label: tr("Boshlang‘ich qoldiq") },
                { value: 'adjustment', label: tr("Tuzatish (Inventarizatsiya)") },
              ]}
            />

            <Select
              label={tr("Yetkazib beruvchi (ta'minotchi)")}
              value={docSupplierId}
              onChange={(e) => setDocSupplierId(e.target.value)}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              placeholder={tr("Ta'minotchini tanlang (ixtiyoriy)")}
            />
          </div>

          <Input
            label={tr("Izoh (ixtiyoriy)")}
            placeholder={tr("Hujjat bo'yicha qo'shimcha ma'lumot")}
            value={docNote}
            onChange={(e) => setDocNote(e.target.value)}
          />

          {/* Document Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-700">
                {tr("Mahsulotlar ro'yxati")}</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItemRow}
                leftIcon={<FontAwesomeIcon icon={faPlus} />}
              >
                {tr("Qator qo'shish")}</Button>
            </div>

            <p>{tr("Tannarx har doim mahsulotning asosiy birligi uchun kiritiladi; hujjat miqdori tanlangan birlikdan konvertatsiya qilinadi.")}</p>
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
                          updated[idx].batchInput = undefined;updated[idx].serialInput=undefined;
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

                  <label className="text-xs">{tr("Hujjat birligi")}<select aria-label={'Hujjat birligi '+idx} value={item.tradeUnit??products.find(p=>p.id===item.productId)?.unit??''} onChange={e=>{const updated=[...docItems];updated[idx]={...item,tradeUnit:e.target.value};setDocItems(updated)}}><option value={products.find(p=>p.id===item.productId)?.unit}>{products.find(p=>p.id===item.productId)?.unit}</option>{products.find(p=>p.id===item.productId)?.unitConversions?.filter(row=>row.isActive).map(row=><option key={row.tradeUnit} value={row.tradeUnit}>{row.tradeUnit}:1={row.ratio} {row.baseUnit}</option>)}</select></label>
                  <div className="w-24">
                    <input
                      type="number"
                      placeholder={tr("Miqdor")}
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
                      placeholder={tr("Asosiy birlik tannarxi")}
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

                  {products.find(product=>product.id===item.productId)?.serialTracking&&(item.quantity.trim().startsWith('-')&&activeStore?<SerialPicker storeId={activeStore.id} productId={item.productId} label={'Hisobdan chiqariladigan seriallar '+(idx+1)} value={item.serialInput??[]} onChange={ids=>setDocItems(previous=>previous.map((r,n)=>n===idx?{...r,serialInput:ids}:r))}/>:<Input label={'Hujjat seriya raqamlari '+(idx+1)} value={(item.serialInput??[]).join(', ')} onChange={event=>setDocItems(previous=>previous.map((r,n)=>n===idx?{...r,serialInput:event.target.value.split(/[\s,;]+/).filter(Boolean)}:r))}/>)}
                  {products.find(product=>product.id===item.productId)?.batchTracking&&<div className="flex gap-2 flex-wrap" aria-label={tr("Partiya ma’lumotlari")}>{(['code','receivedOn','expiresOn'] as const).map((field,index)=><label key={field}>{['Partiya kodi','Partiya kirim kuni','Yaroqlilik kuni'][index]}<input aria-label={['Partiya kodi','Partiya kirim kuni','Yaroqlilik kuni'][index]+' '+idx} type={field==='code'?'text':'date'} value={item.batchInput?.[field]??''} onChange={event=>setDocItems(previous=>previous.map((row,n)=>n===idx?{...row,batchInput:{code:row.batchInput?.code??'',receivedOn:row.batchInput?.receivedOn??'',expiresOn:row.batchInput?.expiresOn??'',[field]:event.target.value}}:row))} className="block border p-2 rounded"/></label>)}</div>}
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
              {tr("Bekor qilish")}</Button>

          </div>
        </DurableMutation>
      </Modal>
    </div>
  );
}
