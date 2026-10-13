'use client';

import SerialPicker from '@/components/inventory/SerialPicker';
import SalePoints from '@/components/customers/SalePoints';
import BatchRestorePicker,{type BatchChoice} from '@/components/inventory/BatchRestorePicker';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import {confirmPageNavigation} from '@/lib/page-navigation';
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { api, ApiError } from '@/lib/api';
import { deviceId, pendingOperations, enqueue, acknowledge } from '@/lib/offline';
import { Sale } from '@/types';
import { formatMoney, formatDate } from '@/lib/format';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ReceiptPreview from '@/components/pos/ReceiptPreview';
import ReturnHistory from '@/components/pos/ReturnHistory';
import ExchangeHistory from '@/components/pos/ExchangeHistory';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPrint, faBan } from '@fortawesome/free-solid-svg-icons';
import { useNotification } from '@/context/NotificationContext';

export default function SaleDetailPage() {
  const {role,user,organization}=useAuth();
  const {activeShift}=useOrganization();
  const [returnOpen,setReturnOpen]=useState(false);
  const [returnQty,setReturnQty]=useState<Record<string,string>>({});
  const [returnDisposition,setReturnDisposition]=useState<Record<string,'sellable'|'damaged'|'write_off'>>({});
  const [serialChoices,setSerialChoices]=useState<Record<string,string[]>>({});
  const [batchChoices,setBatchChoices]=useState<Record<string,BatchChoice[]>>({});
  const [batchReady,setBatchReady]=useState<Record<string,boolean>>({});
  const [reason,setReason]=useState('');
  const [manualNonCash,setManualNonCash]=useState(false);
  const [manualReference,setManualReference]=useState('');
  const [preview,setPreview]=useState<{fingerprint:string;value:{cash:string;card:string;transfer:string;debt:string;waived:string}}|null>(null);
  const [previewing,setPreviewing]=useState(false);
  const [returning,setReturning]=useState(false);
  const returnAttempt=useRef<Parameters<typeof api.sales.returns>[1]|null>(null);
  const [returnUnknown,setReturnUnknown]=useState(false);
  const [localReady,setLocalReady]=useState(false);
  const [localError,setLocalError]=useState('');
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { notifySuccess, notifyError } = useNotification();

  const [sale, setSale] = useState<Sale | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError,setLoadError]=useState('');
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [returnVersion,setReturnVersion]=useState(0);
  useUnsavedChanges(returnOpen&&Boolean(reason||manualReference||Object.values(returnQty).some(value=>/[1-9]/.test(value))||Object.values(batchChoices).some(rows=>rows.length)||Object.values(serialChoices).some(rows=>rows.length)),returning||returnUnknown);

  useEffect(()=>{
    if(!id||!organization?.id||!user?.id)return;
    let cancelled=false;
    void Promise.resolve().then(async()=>{
      if(cancelled)return;
      setLocalReady(false);setLocalError('');returnAttempt.current=null;setReturnUnknown(false);
      try{
        const saved=(await pendingOperations({organizationId:organization.id,userId:user.id,deviceId:deviceId()})).find(operation=>operation.type==='sale.return'&&operation.payload.saleId===id);
        if(cancelled)return;
        if(saved){
          const {saleId,...payload}=saved.payload;
          if(saleId!==id||payload.operationId!==saved.id)throw new Error('Saqlangan qaytarish mos emas');
          const input=payload as Parameters<typeof api.sales.returns>[1];
          returnAttempt.current=input;setSerialChoices(Object.fromEntries(input.items.map(item=>[item.saleItemId,item.serialIds??[]])));setBatchChoices(Object.fromEntries(input.items.map(item=>[item.saleItemId,item.batchSelection??[]])));setReturnQty(Object.fromEntries(input.items.map(item=>[item.saleItemId,String(item.quantity)])));setReturnDisposition(Object.fromEntries(input.items.map(item=>[item.saleItemId,item.disposition])));setReason(input.reason);setManualNonCash(!!input.manualNonCash);setManualReference(input.manualNonCash?.referenceNo??'');setReturnUnknown(true);setReturnOpen(true);
        }
        setLocalReady(true);
      }catch(error){if(!cancelled)setLocalError(error instanceof Error?error.message:'Lokal qaytarish yuklanmadi');}
    });
    return()=>{cancelled=true;};
  },[id,organization?.id,user?.id]);

  useEffect(() => {
    if (!id||!organization?.id||!user?.id) return;
    let isCancelled = false;

    void Promise.resolve().then(()=>{if(isCancelled)return null;setSale(null);setIsLoading(true);setLoadError('');return api.sales.get(id);})
      .then((res) => {
        if (!isCancelled && res?.data) setSale(res.data);
      })
      .catch((err) => {
        if(!isCancelled){setSale(null);setLoadError(err instanceof Error?err.message:'Savdo yuklanmadi');}
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [id,organization?.id,user?.id,role]);

  const handleVoid = async () => {
    if (!sale || !confirm('Haqiqatan ham bu savdoni bekor qilmoqchimisiz?')) return;
    try {
      await api.sales.void(sale.id);
      notifySuccess('Savdo bekor qilindi');
      router.push('/sales');
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    }
  };

  const handleReturn=async()=>{
    if(!sale||!organization||!user||!localReady||returning)return;
    const wasRetry=!!returnAttempt.current;
    if(!wasRetry&&!activeShift){notifyError('Qaytarish uchun ochiq smena kerak');return;}
    const selected=sale.items.filter(item=>Number(returnQty[item.id??'']??0)>0).map(item=>({saleItemId:item.id!,quantity:(returnQty[item.id!]??'0').replace(/^\./,'0.').replace(/\.$/,''),disposition:returnDisposition[item.id!]??'sellable',...(item.serialTracking?{serialIds:serialChoices[item.id!]??[]}:{}),...(batchChoices[item.id!]?.length?{batchSelection:batchChoices[item.id!].map(row=>({...row,quantity:row.quantity.trim().replace(/^\./,'0.').replace(/\.$/,'')}))}:{})}));
    if(!wasRetry&&sale.items.some(item=>item.batchTracking&&Number(returnQty[item.id!]??0)>0&&!batchReady[item.id!])){notifyError('Original partiya ma’lumotini qayta yuklang');return;}
    if (!selected.length || reason.trim().length<2) {notifyError('Miqdor va qaytarish sababini kiriting');return;}
    if(!wasRetry&&manualNonCash&&manualReference.trim().length<3){notifyError('Bank qaytarmasining haqiqiy hujjat raqamini kiriting');return;}
    if(!wasRetry&&manualNonCash&&preview?.fingerprint!==JSON.stringify({saleId:sale.id,shiftId:activeShift!.id,reason,items:selected})){notifyError('Avval qaytariladigan summalarni serverda hisoblang. Miqdor yoki sabab o‘zgarsa qayta hisoblang.');return;}
    returnAttempt.current ??= {operationId:crypto.randomUUID(),shiftId:activeShift!.id,reason,items:selected,...(manualNonCash?{manualNonCash:{confirmed:true as const,referenceNo:manualReference.trim(),expectedSettlement:preview!.value}}:{})};setReturning(true);
    try {
      await enqueue({id:returnAttempt.current.operationId,scope:{organizationId:organization.id,userId:user.id,deviceId:deviceId()},type:'sale.return',payload:{saleId:sale.id,...returnAttempt.current},state:'pending',createdAt:new Date().toISOString()});
      const result=await api.sales.returns(sale.id,returnAttempt.current);
      await acknowledge(returnAttempt.current.operationId,'synced',result.data);
      returnAttempt.current=null;setReturnUnknown(false);setReturnOpen(false);setSerialChoices({});setBatchChoices({});setBatchReady({});setReturnQty({});setReturnDisposition({});setReason('');setManualNonCash(false);setManualReference('');setPreview(null);
      setReturnVersion(value=>value+1);
      const response=await api.sales.get(sale.id);if(response.data)setSale(response.data);
      notifySuccess('Qaytarish qayd etildi');
    } catch(error) {
      setReturnUnknown(true);
      if(!wasRetry&&returnAttempt.current&&error instanceof ApiError&&['BATCH_SELECTION_REQUIRED','INVALID_BATCH_SELECTION','BATCH_RESTORE_QUANTITY_EXCEEDED','VALIDATION_ERROR','RETURN_QUANTITY_EXCEEDED','DUPLICATE_ITEM','INVALID_SHIFT','EXTERNAL_REFUND_REQUIRED','REFUND_ALLOCATION_CHANGED','DEBT_ALLOCATION_REQUIRED','DEBT_RECONCILIATION_REQUIRED','INVALID_STATUS'].includes(error.code??'')){
        try{await acknowledge(returnAttempt.current.operationId,'rejected',undefined,error.code);returnAttempt.current=null;setReturnUnknown(false);}catch{notifyError('Lokal natija saqlanmadi; asl amalni qayta tekshiring');}
      }
      notifyError(error instanceof Error?error.message:'Qaytarish amalga oshmadi');
    }
    finally{setReturning(false);}
  };
  const calculateReturnPreview=async()=>{
    if(!sale||!activeShift||returnUnknown||returning||previewing)return;
    const items=sale.items.filter(item=>Number(returnQty[item.id??'']??0)>0).map(item=>({saleItemId:item.id!,quantity:(returnQty[item.id!]??'0').replace(/^\./,'0.').replace(/\.$/,''),disposition:returnDisposition[item.id!]??'sellable',...(item.serialTracking?{serialIds:serialChoices[item.id!]??[]}:{}),...(batchChoices[item.id!]?.length?{batchSelection:batchChoices[item.id!].map(row=>({...row,quantity:row.quantity.trim().replace(/^\./,'0.').replace(/\.$/,'')}))}:{})}));
    const data={operationId:crypto.randomUUID(),shiftId:activeShift.id,reason,items};
    setPreviewing(true);
    try{const response=await api.sales.returnPreview(sale.id,data);if(response.data)setPreview({fingerprint:JSON.stringify({saleId:sale.id,shiftId:activeShift.id,reason,items}),value:response.data.settlement});}
    catch(error){setPreview(null);notifyError(error instanceof Error?error.message:'Qaytarma hisoblanmadi');}
    finally{setPreviewing(false);}
  };

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Savdo tafsilotlari yuklanmoqda..." />
      </div>
    );
  }

  if(loadError)return <div role="alert">{loadError}<Button onClick={()=>window.location.reload()}>Qayta yuklash</Button></div>;
  if (!sale) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Savdo topilmadi</p>
        <Link href="/sales">
          <Button variant="outline">Savdolar ro&apos;yxatiga qaytish</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Modal isOpen={returnOpen} onClose={()=>{if(confirmPageNavigation())setReturnOpen(false)}} title="Tovar qaytarish">
        <div className="space-y-3">
          {sale.items.map(item=><div key={item.id} className="space-y-2">
            <Input id={`return-quantity-${item.id}`} label={item.productName} disabled={returning||returnUnknown} type="number" min="0" max={Number(item.quantity)} step="0.001" value={returnQty[item.id!]??'0'} onChange={e=>setReturnQty(q=>({...q,[item.id!]:e.target.value}))}/>
            <Select id={`return-disposition-${item.id}`} label={`${item.productName}: qaytarilgan tovar holati`} disabled={returning||returnUnknown} value={returnDisposition[item.id!]??'sellable'} options={[{value:'sellable',label:'Sotiladigan qoldiqqa qaytarish'},{value:'damaged',label:'Brak — sotiladigan qoldiqqa qo‘shilmaydi'},{value:'write_off',label:'Hisobdan chiqarish — sotiladigan qoldiqqa qo‘shilmaydi'}]} onChange={e=>setReturnDisposition(values=>({...values,[item.id!]:e.target.value as 'sellable'|'damaged'|'write_off'}))}/>
            {item.serialTracking&&<SerialPicker storeId={sale.storeId} productId={item.productId} saleItemId={item.id} state="sold" label={item.productName+' original qaytariladigan seriallar'} value={serialChoices[item.id!]??[]} disabled={returning||returnUnknown} onChange={ids=>setSerialChoices(previous=>({...previous,[item.id!]:ids}))}/>}
            {item.batchTracking&&<BatchRestorePicker kind="sale" sourceId={sale.id} productId={item.productId} label={item.productName+' qaytariladigan partiyalar'} value={batchChoices[item.id!]??[]} disabled={returning||returnUnknown} onChange={rows=>setBatchChoices(previous=>({...previous,[item.id!]:rows}))} onReady={ready=>setBatchReady(previous=>previous[item.id!]===ready?previous:{...previous,[item.id!]:ready})}/>}
          </div>)}
          <Input label="Sabab" disabled={returning||returnUnknown} value={reason} onChange={e=>setReason(e.target.value)}/>
          <Button variant="outline" disabled={!activeShift||returning||returnUnknown||previewing} onClick={calculateReturnPreview}>Qaytariladigan summalarni hisoblash</Button>
          {preview&&<p role="status">Hisoblangan taqsimot: naqd {preview.value.cash}, karta {preview.value.card}, bank {preview.value.transfer}, qarz {preview.value.debt}, hisobdan chiqarilgan qarz {preview.value.waived}. Miqdor o‘zgarsa qayta hisoblang.</p>}
          <label className="flex gap-2"><input type="checkbox" checked={manualNonCash} disabled={returning||returnUnknown} onChange={e=>setManualNonCash(e.target.checked)}/>Qo‘lda qayd etilgan karta/bank to‘lovining qaytariladigan qismini tashqarida haqiqatda qaytardim</label>
          {manualNonCash&&<Input label="Bank qaytarmasi hujjat raqami" maxLength={200} disabled={returning||returnUnknown} value={manualReference} onChange={e=>setManualReference(e.target.value)}/>}
          <p>Tashqarida bajarilgan bank qaytarmasini haqiqiy hujjat asosida qayd eting. Naqd qismi kassadan, bank qismi o‘z kanalidan, qolgan nasiya esa qarzdan kamayadi.</p>
          <p className="text-xs text-slate-500">Faqat sotilgan va hali qaytarilmagan miqdor qabul qilinadi. Naqd/nasiya hisobini server original chekdan hisoblaydi.</p>
          <p className="text-xs text-slate-500">Brak va hisobdan chiqarilgan tovar qaytarish hujjatida qayd etiladi; alohida brak omboriga ko‘chirilmaydi.</p>
          {returnUnknown&&<p role="status">Oldingi qaytarish natijasi tekshirilishi kerak. Asl miqdor, holat va smena saqlangan.</p>}
          {localError&&<p role="alert">{localError}. Yangi qaytarish bloklandi; sahifani qayta yuklang.</p>}
          <Button onClick={handleReturn} disabled={returning||!localReady}>{returnUnknown?'Oldingi qaytarishni tekshirish':'Qaytarishni tasdiqlash'}</Button>
        </div>
      </Modal>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/sales">
            <Button variant="ghost" size="icon">
              <FontAwesomeIcon icon={faArrowLeft} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-gray-900">
              Chek #{sale.receiptNo}
            </h1>
            <p className="text-xs text-gray-500">
              {formatDate(sale.completedAt || sale.createdAt, true)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sale.status==='draft'&&<Link href={'/pos?draft='+sale.id} className="text-blue-700 underline">Savdoni kassada davom ettirish</Link>}
          <Button
            variant="outline"
            onClick={() => setIsReceiptOpen(true)}
            leftIcon={<FontAwesomeIcon icon={faPrint} />}
          >
            Chekni chop etish
          </Button>

          {role !== 'cashier' && ['completed','partially_returned'].includes(sale.status) && <Link href={'/sales/'+sale.id+'/exchange'}>Tovar almashtirish</Link>}
          {role !== 'cashier' && (returnUnknown||['completed','partially_returned'].includes(sale.status)) && <Button onClick={()=>setReturnOpen(true)}>Qaytarish</Button>}
          {role !== 'cashier' && sale.status === 'draft' && (
            <Button
              variant="danger"
              onClick={handleVoid}
              leftIcon={<FontAwesomeIcon icon={faBan} />}
            >
              Bekor qilish
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding={false} className="p-4">
          <span className="text-xs text-gray-500">Mijoz</span>
          <p className="font-bold text-gray-900 mt-1">
            {sale.customer ? sale.customer.fullName : 'Mijozsiz'}
          </p>
        </Card>

        <Card padding={false} className="p-4">
          <span className="text-xs text-gray-500">Holat</span>
          <div className="mt-1">
            <Badge variant={sale.status === 'completed' ? 'success' : 'warning'}>
              {sale.status}
            </Badge>
          </div>
        </Card>

        <Card padding={false} className="p-4">
          <span className="text-xs text-gray-500">Jami to&apos;lov</span>
          <p className="text-xl font-black text-emerald-600 mt-1">
            {formatMoney(sale.totalAmount)}
          </p>
        </Card>
      </div>

      <Card title="Mahsulotlar ro'yxati" padding={false}>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 font-bold uppercase">
              <th className="py-3 px-4">Mahsulot</th>
              <th className="py-3 px-4">SKU</th>
              <th className="py-3 px-4 text-center">Miqdor</th>
              <th className="py-3 px-4 text-right">Narxi</th>
              <th className="py-3 px-4 text-right">Chegirma</th>
              <th className="py-3 px-4 text-right">Jami</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sale.items.map((item, idx) => (
              <tr key={idx}>
                <td className="py-3 px-4 font-bold text-gray-900">{item.productName}</td>
                <td className="py-3 px-4 font-mono text-gray-500">{item.sku}</td>
                <td className="py-3 px-4 text-center font-bold">{item.quantity}</td>
                <td className="py-3 px-4 text-right">{formatMoney(item.unitPrice)}</td>
                <td className="py-3 px-4 text-right text-red-500">
                  {item.discountAmount > 0 ? `-${formatMoney(item.discountAmount)}` : '0'}
                </td>
                <td className="py-3 px-4 text-right font-black">
                  {formatMoney(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <SalePoints sale={sale} onChanged={setSale}/>
      <ReturnHistory key={sale.id} saleId={sale.id} timezone={organization?.timezone??'Asia/Tashkent'} version={returnVersion}/>
      {role !== 'cashier' && <ExchangeHistory saleId={sale.id}/>}
      <ReceiptPreview
        copy
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        sale={sale}
      />
    </div>
  );
}
