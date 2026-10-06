'use client';

import React, { useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { Sale } from '@/types';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPrint, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

interface ReceiptPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  copy?:boolean;
}

export default function ReceiptPreview({
  isOpen,
  onClose,
  sale,
  copy=false,
}: ReceiptPreviewProps) {
  const { organization, user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const [width,setWidth]=useState('80');
  const [printRequested,setPrintRequested]=useState(false);
  const [printing,setPrinting]=useState(false),[printError,setPrintError]=useState('');
  const printAttempt=useRef<{saleId:string;operationId:string;width:58|80;copy:boolean;markup:string}|null>(null);

  if (!sale) return null;

  const handlePrint = async () => {
    // This records only a browser print request, never hardware confirmation.
    if(!printRef.current)return;
    if(printing)return;
    const attempt=(printAttempt.current?.saleId===sale.id?printAttempt.current:null)??{saleId:sale.id,operationId:crypto.randomUUID(),width:Number(width)===58?58 as const:80 as const,copy,markup:printRef.current.outerHTML};
    printAttempt.current=attempt;setPrinting(true);setPrintError('');
    try{await api.sales.printRequest(attempt.saleId,{operationId:attempt.operationId,width:attempt.width,copy:attempt.copy});}
    catch(error){setPrintError(error instanceof Error?error.message:'Chop etish so‘rovi yozilmadi; qayta urinib ko‘ring');setPrinting(false);return;}
    printAttempt.current=null;setPrinting(false);
    if(!printRef.current)return;
    setPrintRequested(true);
    const frame=document.createElement('iframe');frame.title='Chek chop etish';frame.style.cssText='position:fixed;width:0;height:0;border:0;';
    const paper=attempt.width;
    frame.srcdoc=`<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>POS chek</title><style>@page{size:${paper}mm 297mm;margin:2mm}body{margin:0;font:11px monospace;color:#111}#printable-receipt{width:${paper-4}mm!important;max-width:none!important;padding:0!important;border:0!important}p{margin:3px 0}h2{font-size:14px}.flex{display:flex}.flex-col{flex-direction:column}.justify-between{justify-content:space-between}.text-center{text-align:center}.font-bold,.font-black{font-weight:bold}.break-words{overflow-wrap:anywhere}.flex-1{flex:1}.border-b{border-bottom:1px dashed #aaa}.py-2\\.5,.py-3{padding:6px 0}.space-y-2>div{margin:5px 0}svg{display:none}</style></head><body>${attempt.markup}</body></html>`;
    frame.onload=()=>{frame.contentWindow?.addEventListener('afterprint',()=>frame.remove(),{once:true});frame.contentWindow?.focus();frame.contentWindow?.print();};
    document.body.append(frame);setTimeout(()=>frame.remove(),120000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-emerald-600">
          <FontAwesomeIcon icon={faCheckCircle} />
          <span>{copy?'Chek nusxasi':sale.status==='draft'?'Savdo qoralamasi':'Savdo muvaffaqiyatli yakunlandi'}</span>
        </div>
      }
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" onClick={onClose}>
            {copy?'Yopish':'Yangi savdo'}
          </Button>
          <Button
            variant="primary"
            onClick={handlePrint}
            disabled={printing}
            leftIcon={<FontAwesomeIcon icon={faPrint} />}
            className="font-bold shadow-md"
          >
            Chekni chop etish
          </Button>
        </div>
      }
    >
      <Select disabled={printing||!!printError} label="Chek qog‘ozi eni" value={width} options={[{value:'58',label:'58 mm'},{value:'80',label:'80 mm'}]} onChange={event=>setWidth(event.target.value)}/>
      <p className="text-xs text-slate-500 mb-3">Brauzer orqali chop etish/PDF. Printer sozlamasida mos qog‘ozni tanlang. Bu fiskal chek emas.</p>
      {printError&&<p role="alert" className="text-red-600 text-xs">{printError}</p>}
      {printRequested&&<p role="status" className="text-xs">Chop etish oynasi so‘raldi; fizik chop etilganligi tasdiqlanmaydi.</p>}
      {/* Printable Receipt Paper */}
      <div
        ref={printRef}
        id="printable-receipt"
        className="bg-white p-6 border border-dashed border-gray-300 rounded-xl max-w-sm mx-auto font-mono text-xs text-gray-800"
        style={{width:width+'mm',maxWidth:'100%'}}
      >
        {/* Header */}
        <p className="text-center font-bold">{sale.status==='draft'?'QORALAMA · ':''}{copy?'CHEK NUSXASI':'SAVDO CHEKI'} · FISKAL EMAS</p>
        <div className="text-center pb-3 border-b border-dashed border-gray-300">
          <h2 className="text-base font-black uppercase text-gray-900 tracking-wider">
            {organization?.name || 'SHUNI POS'}
          </h2>
          {organization?.phone && (
            <p className="text-[11px] text-gray-600 mt-0.5">Tel: {organization.phone}</p>
          )}
          {organization?.tin && (
            <p className="text-[11px] text-gray-600">STIR: {organization.tin}</p>
          )}
        </div>

        {/* Info */}
        <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-gray-500">Chek raqami:</span>
            <span className="font-bold">{sale.receiptNo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Sana:</span>
            <span>{new Date(sale.completedAt||sale.createdAt).toLocaleString('uz-UZ',{timeZone:organization?.timezone??'Asia/Tashkent'})}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Kassir:</span>
            <span>{sale.cashier?.fullName || (sale.cashierId===user?.id?user.fullName:'Chekdagi kassir ID: '+sale.cashierId)}</span>
          </div>
          {sale.customer && (
            <div className="flex justify-between">
              <span className="text-gray-500">Mijoz:</span>
              <span className="font-semibold">{sale.customer.fullName}</span>
            </div>
          )}
        </div>

        {/* Items List */}
        <div className="py-2.5 border-b border-dashed border-gray-300">
          <div className="flex justify-between font-bold pb-1 text-[11px] text-gray-500 uppercase">
            <span>Mahsulot</span>
            <span>Summa</span>
          </div>
          <div className="space-y-2 mt-1">
            {sale.items.map((item, idx) => (
              <div key={idx} className="flex flex-col text-[11px]">
                <div className="flex justify-between font-medium text-gray-900">
                  <span className="break-words min-w-0 flex-1">{item.productName}</span>
                  <span className="font-bold">{formatMoney(item.lineTotal)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>
                    {item.quantity} {item.unit??''} x {formatMoney(item.unitPrice)}
                  </span>
                  {item.discountAmount > 0 && (
                    <span className="text-red-500">
                      Chegirma: -{formatMoney(item.discountAmount)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="py-3 border-b border-dashed border-gray-300 space-y-1.5 text-[11px]">
          <div className="flex justify-between text-gray-600">
            <span>Oraliq summa:</span>
            <span>{formatMoney(sale.subtotal)}</span>
          </div>
          {sale.discountAmount > 0 && (
            <div className="flex justify-between text-red-600 font-medium">
              <span>Umumiy chegirma:</span>
              <span>-{formatMoney(sale.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-black text-gray-950 pt-1 border-t border-gray-200">
            <span>JAMI TO&apos;LOV:</span>
            <span className="text-emerald-700">{formatMoney(sale.totalAmount)}</span>
          </div>
        </div>

        {/* Payments breakdown */}
        {sale.payments && sale.payments.length > 0 && (
          <div className="py-2.5 border-b border-dashed border-gray-300 space-y-1 text-[11px]">
            <span className="text-gray-500 font-bold block mb-1">To&apos;lov turi:</span>
            {sale.payments.map((p, idx) => {
              const pTypeLabels: Record<string, string> = {
                cash: 'Naqd pul',
                card: 'Plastik karta',
                transfer: 'O\'tkazma',
                credit: 'Nasiya / Qarz',
              };
              return (
                <div key={idx} className="flex justify-between text-gray-700">
                  <span>{pTypeLabels[p.paymentType] || p.paymentType} ({p.direction==='out'?'chiqim':'kirim'}):</span>
                  <span className="font-semibold">{formatMoney(p.amount)}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer message */}
        <div className="text-center pt-4 text-[11px] text-gray-500">
          <p>{organization?.receiptFooter || 'Xaridingiz uchun rahmat!'}</p>
          <p className="text-[9px] text-gray-400 mt-2">Dastur: Shuni POS</p>
        </div>
      </div>
    </Modal>
  );
}
