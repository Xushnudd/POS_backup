'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import React, { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotification } from '@/context/NotificationContext';
import { api } from '@/lib/api';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import {confirmPageNavigation} from '@/lib/page-navigation';
import { Product, StockTransfer } from '@/types';

import Pagination from '@/components/ui/Pagination';
import CsvExportButton from '@/components/ui/CsvExportButton';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import SerialPicker from '@/components/inventory/SerialPicker';
import TransferReceipt,{remainingTransfer} from '@/components/inventory/TransferReceipt';
import DurableMutation from '@/components/forms/DurableMutation';
import PendingActions from '@/components/forms/PendingActions';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faRightLeft,
  faPlus,
  faArrowLeft,
  faPaperPlane,
  faInbox,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';

import {useListFilters} from '@/hooks/useListFilters';
import {journalListSorts} from '@/lib/list-query';
import ListFilter from '@/components/ui/ListFilter';
import DataTable from '@/components/ui/DataTable';
export default function StockTransfersPage(){
 const {t:tr}=useTranslation();
const {organization,user,role}=useAuth();return <Suspense fallback={<p>{tr("Yuklanmoqda...")}</p>}><Transfers key={[organization?.id,user?.id,role].join(':')}/></Suspense>;}
function Transfers() {
 const {message:uiMessage}=useTranslation();

 const {formatDate}=useTranslation();

 const {t:tr}=useTranslation();

  const { organization } = useAuth();
  const { stores } = useOrganization();
  const { notifySuccess, notifyError } = useNotification();

  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const {query,params,filters,changeQuery}=useListFilters(journalListSorts,'newest',['fromStoreId','toStoreId','from','to','status']);
  const page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'newest',search=query?.search??'',invalidQuery=!query;
  const [listError,setListError]=useState(''),[pages,setPages]=useState(0),[draftFilters,setDraftFilters]=useState({fromStoreId:params.get('fromStoreId')??'',toStoreId:params.get('toStoreId')??'',from:params.get('from')??'',to:params.get('to')??'',status:params.get('status')??''});
  const filterKey=JSON.stringify(filters);
  useEffect(()=>{let live=true;void Promise.resolve().then(()=>{if(live)setDraftFilters({fromStoreId:'',toStoreId:'',from:'',to:'',status:'',...JSON.parse(filterKey)});});return()=>{live=false;};},[filterKey]);
  const requestSequence=useRef({value:0});

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fromStoreId, setFromStoreId] = useState('');
  const [toStoreId, setToStoreId] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<{ productId: string; quantity: string; unitCost: string;serialInput?:string[] }[]>([]);

  const [draftBaseline,setDraftBaseline]=useState('');
  const draftDirty=isModalOpen&&JSON.stringify([fromStoreId,toStoreId,note,items])!==draftBaseline;
  useUnsavedChanges(draftDirty);
  const [receiving,setReceiving]=useState<StockTransfer|null>(null),[receiptRevision,setReceiptRevision]=useState(0);

  const loadTransfers = useCallback(async () => {
    if (!organization?.id||invalidQuery) return;
    const sequence=++requestSequence.current.value;setIsLoading(true);setListError('');
    try {
      const res = await api.transfers.list({ organizationId: organization.id,...filters,page,limit,sort,search });
      if(sequence===requestSequence.current.value){setTransfers(res.data??[]);setPages(res.pagination?.totalPages??0);}
    } catch (err: unknown) {
      if(sequence===requestSequence.current.value)setListError(displayErrorMessage(err,'Transferlar yuklanmadi'));
    } finally {
      if(sequence===requestSequence.current.value)setIsLoading(false);
    }
  }, [organization,filters,page,limit,sort,search,invalidQuery]);

  useEffect(() => {
    const requests=requestSequence.current;let cancelled=false;void Promise.resolve().then(()=>{if(!cancelled)return loadTransfers();});return()=>{cancelled=true;requests.value++;};
  }, [loadTransfers]);

  useEffect(() => {
    if (!organization?.id) return;
    api.products.list({ organizationId: organization.id, limit: 100 }).then((res) => {
      if (res.data) setProducts(res.data);
    });
  }, [organization?.id]);

  const openCreateModal = () => {
    if (stores.length < 2) {
      notifyError('Transfer uchun kamida 2 ta do\'kon mavjud bo\'lishi kerak');
      return;
    }
    setFromStoreId(stores[0]?.id || '');
    setToStoreId(stores[1]?.id || '');
    setNote('');
    const initialItems=products.length>0?[{productId:products[0].id,quantity:'1',unitCost:String(products[0].costPrice??'0')}]:[];
    setItems(initialItems);
    setDraftBaseline(JSON.stringify([stores[0]?.id||'',stores[1]?.id||'','',initialItems]));
    setIsModalOpen(true);
  };

  const handleAddItem = () => {
    if (products.length === 0) return;
    setItems([
      ...items,
      { productId: products[0].id, quantity: '1', unitCost: String(products[0].costPrice??'0') },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const returnIntents=useRef<Record<string,{operationId:string;reason:string}>>({});
  const handleReturn=async(id:string)=>{
    let intent=returnIntents.current[id];
    if(!intent){
      const reason=window.prompt('Hali qabul qilinmagan mahsulotlar manba omborga qaytib kelganini tasdiqlang. Qaytarish sababi:')?.trim();
      if(!reason)return;
      if(reason.length<3||reason.length>2000){notifyError('Sabab 3–2000 belgi bo‘lishi kerak');return;}
      intent={operationId:crypto.randomUUID(),reason};returnIntents.current[id]=intent;
    }
    try{await api.transfers.returnTransit(id,intent);notifySuccess('Qabul qilinmagan miqdorlar manba omborga qaytarildi');await loadTransfers();}
    catch(error){notifyError(displayErrorMessage(error,'Natija noaniq; shu amal bilan qayta urinishingiz mumkin'));await loadTransfers();}
  };
  const cancelReasons=useRef<Record<string,string>>({});
  const handleCancel=async(id:string)=>{
    const reason=cancelReasons.current[id]??window.prompt('Jo‘natilmagan transferni bekor qilish sababi:')?.trim();
    if(!reason)return;
    if(reason.length<3||reason.length>2000){notifyError('Sabab 3–2000 belgi bo‘lishi kerak');return;}
    cancelReasons.current[id]=reason;
    try{await api.transfers.cancel(id,reason);notifySuccess('Transfer bekor qilindi; qoldiq o‘zgarmadi');await loadTransfers();}
    catch(error){notifyError(displayErrorMessage(error,'Natija noaniq. Shu transferni yana tekshiring'));await loadTransfers();}
  };

  const handleSend = async (id: string) => {
    try {
      await api.transfers.send(id);
      notifySuccess('Transfer jo\'natildi');
      loadTransfers();
    } catch (err: unknown) {
      notifyError(displayErrorMessage(err,'Transferni jo\'natishda xatolik'));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PendingActions prefix="/transfers" returnPath="/inventory/transfers" revision={receiptRevision} onDone={()=>{setReceiptRevision(value=>value+1);void loadTransfers()}}/>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/inventory">
            <Button variant="ghost" size="icon">
              <FontAwesomeIcon icon={faArrowLeft} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              {tr("Do'konlararo transferlar")}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {tr("Filiallar va savdo nuqtalari o'rtasida mahsulot harakati")}</p>
          </div>
        </div>

        <Button
          variant="primary"
          onClick={openCreateModal}
          leftIcon={<FontAwesomeIcon icon={faPlus} />}
          className="font-bold shadow-md shadow-blue-500/20"
        >
          {tr("Yangi transfer")}</Button>
      </div>

      <ListFilter search={search} sort={sort} label={tr("Transfer izohi yoki filial qidirish")} onChange={changeQuery} reset={{fromStoreId:'',toStoreId:'',from:'',to:'',status:''}} options={[{value:'newest',label:tr("Eng yangi")},{value:'oldest',label:tr("Eng eski")}]}/>
      <form className="grid sm:grid-cols-3 gap-3" onSubmit={e=>{e.preventDefault();changeQuery({...Object.fromEntries(Object.entries(draftFilters).map(([key,value])=>[key,value.trim()])),page:'1'});}}>
        <Select label={tr("Jo‘natuvchi filtri")} value={draftFilters.fromStoreId} options={[{value:'',label:tr("Barcha filiallar")},...stores.map(store=>({value:store.id,label:store.name}))]} onChange={e=>setDraftFilters({...draftFilters,fromStoreId:e.target.value})}/>
        <Select label={tr("Qabul qiluvchi filtri")} value={draftFilters.toStoreId} options={[{value:'',label:tr("Barcha filiallar")},...stores.map(store=>({value:store.id,label:store.name}))]} onChange={e=>setDraftFilters({...draftFilters,toStoreId:e.target.value})}/>
        <Select label={tr("Transfer holati filtri")} value={draftFilters.status} options={[{value:'',label:tr("Barchasi")},{value:'draft',label:tr("Qoralama")},{value:'sent',label:tr("Yo‘lda")},{value:'received',label:tr("Qabul qilingan")},{value:'closed',label:tr("Yopilgan")},{value:'cancelled',label:tr("Bekor qilingan")}]} onChange={e=>setDraftFilters({...draftFilters,status:e.target.value})}/>
        <Input label={tr("Transfer davri boshi")} type="date" value={draftFilters.from} onChange={e=>setDraftFilters({...draftFilters,from:e.target.value})}/><Input label={tr("Transfer davri oxiri")} type="date" value={draftFilters.to} onChange={e=>setDraftFilters({...draftFilters,to:e.target.value})}/><Button type="submit" disabled={isLoading}>{tr("Filtrlash")}</Button>
      </form>
      {organization&&<CsvExportButton path="/transfers" params={{organizationId:organization.id,...filters,search,sort}} label={tr("Transferlarni CSV yuklash")}/>}
      {invalidQuery&&<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>}
      {listError&&<p role="alert">{uiMessage(listError)}</p>}
      {!invalidQuery&&page>Math.max(1,pages)&&<Button onClick={()=>changeQuery({page:'1'})}>{tr("Birinchi sahifaga qaytish")}</Button>}
      <Pagination page={page} pages={pages} busy={isLoading&&!invalidQuery} blocked={invalidQuery||!!listError} onPage={value=>changeQuery({page:String(value)})} retry={()=>{void loadTransfers();}}/>
      <Card padding={false}>
        {invalidQuery||listError ? (<p>{tr("Ro‘yxat yuklanmadi; filtrlarni tekshiring yoki qayta yuklang.")}</p>) : isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <LoadingSpinner size="lg" text={tr("Transferlar yuklanmoqda...")} />
          </div>
        ) : transfers.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-400">
            <FontAwesomeIcon icon={faRightLeft} className="text-4xl text-gray-300 mb-3" />
            <p className="text-base font-bold text-gray-700">{tr("Transferlar topilmadi")}</p>
            <p className="text-xs text-gray-400 mt-1">
              {tr("Do'konlar orasida tovar jo'natish uchun \"Yangi transfer\" tugmasini bosing")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <DataTable className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">{tr("Jo'natuvchi do'kon")}</th>
                  <th className="py-3.5 px-4">{tr("Qabul qiluvchi do'kon")}</th>
                  <th className="py-3.5 px-4 text-center">{tr("Tovarlar soni")}</th>
                  <th className="py-3.5 px-4">{tr("Sana")}</th>
                  <th className="py-3.5 px-4 text-center">{tr("Holat")}</th>
                  <th className="py-3.5 px-4 text-right">{tr("Amallar")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/70 transition">
                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      {t.fromStore?.name || tr("Do'kon A")}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-gray-900">
                      {t.toStore?.name || tr("Do'kon B")}
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-blue-600">
                      {t.items?.length || 0} {tr("ta")}<details><summary>{tr("Qabul va farqlar")}</summary>{t.items.map(item=><div key={item.id} className="text-left text-gray-900"><p>{item.product?.name??item.productId}{tr(": jo‘natilgan")}{' '}{String(item.quantity)}{tr(", soz")}{' '}{String(item.receivedQuantity??0)}{tr(", manbaga qaytgan")}{' '}{String(item.returnedQuantity??0)}{tr(", brak")}{' '}{String(item.damagedQuantity??0)}{tr(", kamomad")}{' '}{String(item.shortageQuantity??0)}{tr(", yo‘lda")}{' '}{remainingTransfer(item)}</p>{item.dispositions?.map(entry=><p key={entry.id}>{entry.disposition==='damaged'?tr("Brak"):tr("Kamomad")} {entry.quantity}: {entry.reason}</p>)}</div>)}</details>
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">
                      {formatDate(t.createdAt, true)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {t.status === 'received' ? (
                        <Badge variant="success" size="sm">
                          {tr("Qabul qilingan")}</Badge>
                      ) : t.status === 'closed' ? (<Badge variant="success" size="sm">{tr("Qabul/qaytarish bilan yopilgan")}</Badge>) : t.status === 'cancelled' ? (<Badge variant="warning" size="sm">{tr("Bekor qilingan")}</Badge>) : t.status === 'sent' ? (
                        <Badge variant="info" size="sm">
                          {tr("Yo'lda (Jo'natilgan)")}</Badge>
                      ) : (
                        <Badge variant="warning" size="sm">
                          {tr("Qoralama")}</Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1">
                      {t.status === 'draft' && <Button size="sm" variant="outline" onClick={()=>handleCancel(t.id)}>{tr("Bekor qilish")}</Button>}
                      {t.status === 'draft' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleSend(t.id)}
                          leftIcon={<FontAwesomeIcon icon={faPaperPlane} />}
                        >
                          {tr("Jo'natish")}</Button>
                      )}
                      {t.status === 'sent' && <Button size="sm" variant="outline" onClick={()=>handleReturn(t.id)}>{tr("Yo‘ldagi qismini qaytarish")}</Button>}
                      {t.status === 'sent' && (
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => setReceiving(t)}
                          leftIcon={<FontAwesomeIcon icon={faInbox} />}
                        >
                          {tr("Qabul qilish")}</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        )}
      </Card>
      <Modal isOpen={!!receiving} onClose={()=>{if(!confirmPageNavigation())return;setReceiving(null);setReceiptRevision(value=>value+1)}} title={tr("Transferni qisman qabul qilish")} size="lg">{receiving&&<TransferReceipt key={receiving.id} id={receiving.id} fromStoreId={receiving.fromStoreId} items={receiving.items} onDone={()=>{setReceiving(null);setReceiptRevision(value=>value+1);notifySuccess('Qabul qayd etildi; yo‘ldagi qoldiq yangilandi');void loadTransfers()}}/>}</Modal>

      {/* Transfer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {if(confirmPageNavigation())setIsModalOpen(false)}}
        title={tr("Yangi do'konlararo transfer")}
        size="lg"
      >
        <DurableMutation path="/transfers" returnPath="/inventory/transfers" label={tr("Transferni yaratish")} body={{organizationId:organization?.id,fromStoreId,toStoreId,note:note.trim()||undefined,items}} review={[tr("Yo‘nalish: {value1} → {value2}",{value1:String(stores.find(store=>store.id===fromStoreId)?.name??''),value2:String(stores.find(store=>store.id===toStoreId)?.name??'')}),tr("Izoh: {value1}",{value1:String(note)}),...items.map(item=>`${products.find(product=>product.id===item.productId)?.name??item.productId}: ${item.quantity}; asosiy birlik tannarxi: ${item.unitCost}`)]} onDone={()=>{notifySuccess('Transfer qoralamasi yaratildi');setIsModalOpen(false);setReceiptRevision(value=>value+1);void loadTransfers()}}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label={tr("Qaysi do'kondan (Chiqim) *")}
              value={fromStoreId}
              onChange={(e) => setFromStoreId(e.target.value)}
              options={stores.map((s) => ({ value: s.id, label: s.name }))}
            />

            <Select
              label={tr("Qaysi do'konga (Kirim) *")}
              value={toStoreId}
              onChange={(e) => setToStoreId(e.target.value)}
              options={stores.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>

          <Input
            label={tr("Izoh (ixtiyoriy)")}
            placeholder={tr("Transfer sababi")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-700">{tr("Mahsulotlar")}</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                leftIcon={<FontAwesomeIcon icon={faPlus} />}
              >
                {tr("Qo'shish")}</Button>
            </div>

            <div className="space-y-2 border border-gray-200 rounded-xl p-3 bg-gray-50 max-h-52 overflow-y-auto">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <select
                      value={item.productId}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx].productId = e.target.value;updated[idx].serialInput=undefined;
                        setItems(updated);
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

                  {products.find(p=>p.id===item.productId)?.serialTracking&&fromStoreId&&<SerialPicker key={fromStoreId+item.productId} storeId={fromStoreId} productId={item.productId} label={tr("Jo‘natiladigan seriallar")+" "+(idx+1)} value={item.serialInput??[]} onChange={ids=>setItems(previous=>previous.map((r,n)=>n===idx?{...r,serialInput:ids}:r))}/>}
                  <div className="w-24">
                    <input
                      type="number"
                      placeholder={tr("Miqdor")}
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[idx].quantity = e.target.value;
                        setItems(updated);
                      }}
                      className="w-full text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg p-2 text-center focus:outline-hidden"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    className="p-2 text-gray-400 hover:text-red-500"
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
              onClick={() => {if(confirmPageNavigation())setIsModalOpen(false)}}
            >
              {tr("Bekor qilish")}</Button>

          </div>
        </DurableMutation>
      </Modal>
    </div>
  );
}
