'use client';

import {useTranslation} from '@/context/LocaleContext';

import React, { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotification } from '@/context/NotificationContext';
import { api, ApiError } from '@/lib/api';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import { acknowledge, deviceId, enqueue, pendingOperations } from '@/lib/offline';
import { Shift } from '@/types';

import { useAuth } from '@/context/AuthContext';
import CsvExportButton from '@/components/ui/CsvExportButton';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import OpenShiftModal from '@/components/pos/OpenShiftModal';
import ShiftCorrections from '@/components/finance/ShiftCorrections';
import ShiftCashSummary from '@/components/finance/ShiftCashSummary';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClock,
  faMoneyBillWave,
  faArrowDown,
  faArrowUp,
  faLock,
  faHistory,
} from '@fortawesome/free-solid-svg-icons';

import {useListFilters} from '@/hooks/useListFilters';
import {journalListSorts} from '@/lib/list-query';
import ListFilter from '@/components/ui/ListFilter';
import Pagination from '@/components/ui/Pagination';
import DataTable from '@/components/ui/DataTable';
import Select from '@/components/ui/Select';
export default function ShiftsPage(){
 const {t:tr}=useTranslation();
const {organization,user,role}=useAuth();return <Suspense fallback={<p>{tr("Yuklanmoqda...")}</p>}><Shifts key={[organization?.id,user?.id,role].join(':')}/></Suspense>;}
function Shifts() {
 const {formatDate,formatMoney}=useTranslation();

 const {t:tr}=useTranslation();

  const {role,organization,user}=useAuth();
  const cashAttempt=useRef<{shiftId:string;input:Parameters<typeof api.shifts.cashMovement>[1]&{operationId:string}}|null>(null);
  const [cashReady,setCashReady]=useState(false);
  const [cashUnknown,setCashUnknown]=useState(false);
  const { activeRegister, activeShift, refreshShift } = useOrganization();
  const { notifySuccess, notifyError } = useNotification();

  const [shiftsHistory, setShiftsHistory] = useState<Shift[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const {query,filters,params,changeQuery}=useListFilters(journalListSorts,'newest',['from','to','status']);
  const page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'newest',search=query?.search??'',invalidQuery=!query;
  const [historyError,setHistoryError]=useState(''),[pages,setPages]=useState(0);
  const historySequence=useRef({value:0});

  // Modals
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);

  // Cash movement modal
  const [isCashMoveModalOpen, setIsCashMoveModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<'cash_in' | 'cash_out'|'bank_deposit'|'collection'>('cash_in');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [isProcessingMove, setIsProcessingMove] = useState(false);

  // Close shift modal
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const closeAttempt=useRef<string|null>(null);
  const [countedCash, setCountedCash] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [isClosingShift, setIsClosingShift] = useState(false);
  const cashDirty=isCashMoveModalOpen&&!cashUnknown&&Boolean(movementAmount||movementReason);
  const closeCashEditor=useUnsavedChanges(cashDirty,isProcessingMove);
  const shiftCloseDirty=isCloseModalOpen&&Boolean(countedCash||closeNote);
  const closeShiftEditor=useUnsavedChanges(shiftCloseDirty,isClosingShift);

  const loadHistory = useCallback(async () => {
    if(invalidQuery)return;
    const sequence=++historySequence.current.value;setIsLoadingHistory(true);setHistoryError('');
    try {
      const res=await api.shifts.list({...filters,registerId:activeRegister?.id,page,limit,sort,search});
      if(sequence===historySequence.current.value){setShiftsHistory(res.data??[]);setPages(res.pagination?.totalPages??0);}
    }catch(error){if(sequence===historySequence.current.value)setHistoryError(error instanceof Error?error.message:'Smena tarixi yuklanmadi');}
    finally{if(sequence===historySequence.current.value)setIsLoadingHistory(false);}
  },[activeRegister,filters,page,limit,sort,search,invalidQuery]);
  useEffect(()=>{const requests=historySequence.current;let live=true;void Promise.resolve().then(()=>{if(live)return loadHistory();});return()=>{live=false;requests.value++;};},[loadHistory,activeShift]);

  useEffect(()=>{
    let cancelled=false;
    void Promise.resolve().then(async()=>{
      if(!organization||!user)return;setCashReady(false);cashAttempt.current=null;setCashUnknown(false);
      try{const saved=(await pendingOperations({organizationId:organization.id,userId:user.id,deviceId:deviceId()})).find(op=>op.type==='shift.cash');if(cancelled)return;
        if(saved){const {shiftId,...input}=saved.payload;cashAttempt.current={shiftId:String(shiftId),input:input as NonNullable<typeof cashAttempt.current>['input']};setMovementType(input.movementType as typeof movementType);setMovementAmount(String(input.amount));setMovementReason(String(input.reason));setCashUnknown(true);setIsCashMoveModalOpen(true);}
        setCashReady(true);
      }catch(err){if(!cancelled)notifyError(err instanceof Error?err.message:'Lokal pul amali o‘qilmadi');}
    });return()=>{cancelled=true;};
  },[organization,user,notifyError]);

  // The durable original intent is replayed even after its shift has closed.
  const handleCashMovement = async (e: React.FormEvent) => {
    e.preventDefault();if(!organization||!user||!cashReady||isProcessingMove)return;
    const wasRetry=!!cashAttempt.current;
    if(!cashAttempt.current){
      if(!activeShift?.id)return;
      if(!/^\d+(\.\d{1,2})?$/.test(movementAmount)||!movementReason.trim()){notifyError('Musbat summa (2 kasr) va sabab kiriting');return;}
      cashAttempt.current={shiftId:activeShift.id,input:{operationId:crypto.randomUUID(),movementType,amount:movementAmount,reason:movementReason.trim()}};
    }
    const saved=cashAttempt.current;setCashUnknown(true);setIsProcessingMove(true);
    try{
      await enqueue({id:saved.input.operationId,scope:{organizationId:organization.id,userId:user.id,deviceId:deviceId()},type:'shift.cash',payload:{shiftId:saved.shiftId,...saved.input},state:'pending',createdAt:new Date().toISOString()});
      const result=await api.shifts.cashMovement(saved.shiftId,saved.input);
      await acknowledge(saved.input.operationId,'synced',result.data);
      cashAttempt.current=null;setCashUnknown(false);setIsCashMoveModalOpen(false);setMovementAmount('');setMovementReason('');notifySuccess('Naqd harakat qayd etildi');await refreshShift();await loadHistory();
    }catch(err){
      notifyError(err instanceof Error?err.message:'Natija noma’lum; asl pul amalini tekshiring');
      if(!wasRetry&&err instanceof ApiError&&['VALIDATION_ERROR','INVALID_SHIFT','MANAGER_REQUIRED'].includes(err.code??'')){
        try{await acknowledge(saved.input.operationId,'rejected',undefined,err.code);cashAttempt.current=null;setCashUnknown(false);}catch{notifyError('Rad natijasi lokal saqlanmadi; asl amalni tekshiring');}
      }
    }finally{setIsProcessingMove(false);}
  };

  // Close shift handler
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift?.id) return;

    if (!/^\d+(\.\d{1,2})?$/.test(countedCash)) {
      notifyError('Kassadagi sanalgan naqd pulni kiriting');
      return;
    }

    setIsClosingShift(true);
    try {
      closeAttempt.current??=crypto.randomUUID();
      const result=await api.shifts.close(activeShift.id, {
        operationId:closeAttempt.current,
        countedCash,
        note: closeNote.trim() || undefined,
      });

      notifySuccess(result.data?.pendingClose?'Yopish so‘rovi rahbar tasdig‘ini kutmoqda':'Smena muvaffaqiyatli yopildi');
      closeAttempt.current=null;
      setIsCloseModalOpen(false);
      await refreshShift();
      loadHistory();
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Smenani yopishda xatolik yuz berdi');
    } finally {
      setIsClosingShift(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {role&&role!=='cashier'&&<CsvExportButton path="/shifts" params={{...filters,search,sort,...(activeRegister?{registerId:activeRegister.id}:{})}}/>}
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {tr("Kassa va Smenalar nazorati")}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {tr("Kassir smenalari, naqd pul harakati (inkassatsiya) va hisobdorlik")}</p>
        </div>

        {!activeShift && (
          <Button
            variant="success"
            onClick={() => setIsOpenShiftModalOpen(true)}
            leftIcon={<FontAwesomeIcon icon={faClock} />}
            className="font-bold shadow-md shadow-emerald-500/20"
          >
            {tr("Yangi smena ochish")}</Button>
        )}
      </div>

      {/* Active Shift Card */}
      {activeShift ? (
        <Card
          title={
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{tr("Joriy Ochiq Smena")}</span>
            </div>
          }
          subtitle={`Terminal: ${activeShift.register?.name || 'Kassa'} • Ochilgan: ${formatDate(
            activeShift.openedAt,
            true
          )}`}
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMovementType('cash_in');
                  setIsCashMoveModalOpen(true);
                }}
                leftIcon={<FontAwesomeIcon icon={faArrowDown} />}
              >
                {tr("Pul kiritish")}</Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMovementType('cash_out');
                  setIsCashMoveModalOpen(true);
                }}
                leftIcon={<FontAwesomeIcon icon={faArrowUp} />}
              >
                {tr("Pul olish")}</Button>

              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setCountedCash('');
                  setIsCloseModalOpen(true);
                }}
                leftIcon={<FontAwesomeIcon icon={faLock} />}
                className="font-bold"
              >
                {tr("Smenani yopish")}</Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-xs text-gray-500 font-semibold block">
                {tr("Boshlang'ich naqd pul:")}</span>
              <span className="text-xl font-black text-gray-900 mt-1 block">
                {formatMoney(activeShift.openingCash)}
              </span>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-xs text-gray-500 font-semibold block">{tr("Kassir:")}</span>
              <span className="text-base font-bold text-gray-800 mt-1 block">
                {activeShift.organizationUser?.user?.fullName || tr("Kassir")}
              </span>
            </div>

            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <span className="text-xs text-emerald-700 font-bold block">
                {tr("Kassa holati:")}</span>
              <span className="text-xs text-emerald-900 font-medium mt-1 block">
                {tr("Savdo qilish va to'lovlarni qabul qilishga tayyor")}</span>
            </div>
          </div>
        </Card>
      ) : (
        <Card padding={false} className="p-8 text-center bg-linear-to-b from-gray-50 to-white">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center text-2xl mx-auto mb-3">
            <FontAwesomeIcon icon={faClock} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">{tr("Ayni vaqtda ochiq smena yo'q")}</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-5">
            {tr("Savdolarni amalga oshirish uchun boshlang'ich naqd pul qoldig'i bilan yangi smena oching")}</p>
          <Button
            variant="success"
            onClick={() => setIsOpenShiftModalOpen(true)}
            leftIcon={<FontAwesomeIcon icon={faClock} />}
            className="font-bold shadow-md shadow-emerald-500/20"
          >
            {tr("Smena ochish")}</Button>
        </Card>
      )}

      {/* Shifts History Table */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faHistory} className="text-gray-400 text-sm" />
            <span>{tr("Smenalar tarixi")}</span>
          </div>
        }
        subtitle={tr("Avval yopilgan va faol barcha smenalar arxivi")}
        padding={false}
      >
        <ListFilter search={search} sort={sort} label={tr("Kassa yoki xodim qidirish")} onChange={changeQuery} reset={{from:'',to:'',status:''}} options={[{value:'newest',label:tr("Eng yangi")},{value:'oldest',label:tr("Eng eski")}]}><Select label={tr("Smena holati")} value={params.get('status')??''} options={[{value:'',label:tr("Barchasi")},{value:'open',label:tr("Ochiq")},{value:'closed',label:tr("Yopilgan")}]} onChange={e=>changeQuery({status:e.target.value,page:'1'})}/><Input label={tr("Smena davri boshi")} type="date" value={params.get('from')??''} onChange={e=>changeQuery({from:e.target.value,page:'1'})}/><Input label={tr("Smena davri oxiri")} type="date" value={params.get('to')??''} onChange={e=>changeQuery({to:e.target.value,page:'1'})}/></ListFilter>
        {invalidQuery?<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>:historyError?<p role="alert">{historyError}{tr(". Oxirgi tarix saqlangan.")}</p>:isLoadingHistory ? (
          <div className="h-48 flex items-center justify-center">
            <LoadingSpinner size="lg" text={tr("Tarix yuklanmoqda...")} />
          </div>
        ) : shiftsHistory.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-gray-400 text-xs">
            {tr("Smenalar tarixi topilmadi")}</div>
        ) : (
          <div className="overflow-x-auto">
            <DataTable>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">{tr("Terminal")}</th>
                  <th className="py-3.5 px-4">{tr("Kassir")}</th>
                  <th className="py-3.5 px-4">{tr("Ochilgan vaqti")}</th>
                  <th className="py-3.5 px-4">{tr("Yopilgan vaqti")}</th>
                  <th className="py-3.5 px-4 text-right">{tr("Boshlang'ich")}</th>
                  <th className="py-3.5 px-4 text-right">{tr("Kutilgan summa")}</th>
                  <th className="py-3.5 px-4 text-right">{tr("Sanalgan summa")}</th>
                  <th className="py-3.5 px-4 text-right">{tr("Farq")}</th>
                  <th className="py-3.5 px-4 text-center">{tr("Holat")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shiftsHistory.map((s) => {
                  const diff = Number(s.cashDifference || 0);
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3.5 px-4 font-bold text-gray-900">
                        {s.register?.name || tr("Kassa")}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-700">
                        {s.organizationUser?.user?.fullName || tr("Kassir")}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">
                        {formatDate(s.openedAt, true)}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600">
                        {formatDate(s.closedAt, true)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-gray-700">
                        {formatMoney(s.openingCash)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-gray-800">
                        {s.expectedCash !== null ? formatMoney(s.expectedCash) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-gray-900">
                        {s.countedCash !== null ? formatMoney(s.countedCash) : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {s.status === 'closed' ? (
                          diff === 0 ? (
                            <span className="text-gray-400 font-bold">{tr("0 so'm")}</span>
                          ) : diff > 0 ? (
                            <span className="text-emerald-600 font-black">
                              +{formatMoney(diff)}
                            </span>
                          ) : (
                            <span className="text-red-600 font-black">
                              {formatMoney(diff)}
                            </span>
                          )
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {s.status === 'open' ? (
                          <Badge variant="success" size="sm" dot>
                            {tr("Ochiq")}</Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">
                            {tr("Yopilgan")}</Badge>
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

      <Pagination page={page} pages={pages} busy={isLoadingHistory&&!invalidQuery} blocked={invalidQuery||!!historyError} onPage={value=>changeQuery({page:String(value)})} retry={()=>{void loadHistory();}}/>{!invalidQuery&&page>Math.max(1,pages)&&<Button onClick={()=>changeQuery({page:'1'})}>{tr("Birinchi sahifaga qaytish")}</Button>}
      {shiftsHistory.filter(shift=>shift.pendingClose).map(shift=><Card key={shift.id} title={tr("Smena yopilishi tasdiq kutmoqda")}>
        <p>{tr("Kutilgan:")}{' '}{formatMoney(shift.pendingClose!.expectedCash)} {tr("· Sanalgan:")}{' '}{formatMoney(shift.pendingClose!.countedCash)} {tr("· Farq:")}{' '}{formatMoney(shift.pendingClose!.difference)}</p>
        <p>{tr("Sabab:")}{' '}{shift.pendingClose!.reason}</p><p>{tr("Sanagan xodim ID:")}{' '}{shift.pendingClose!.countedBy}</p>
        <p>{tr("Yangi savdo va pul harakatlari tasdiq yoki rad javobigacha bloklangan.")}</p>
        {role!=='cashier'&&<div className="flex flex-wrap gap-2"><Button onClick={async()=>{try{await api.shifts.close(shift.id,{countedCash:shift.pendingClose!.countedCash,approvalRequestId:shift.pendingClose!.id});await refreshShift();await loadHistory();notifySuccess('Smena farqi tasdiqlandi va yopildi');}catch(error){notifyError(error instanceof Error?error.message:'Tasdiq bajarilmadi');}}}>{tr("Farqni tasdiqlash va yopish")}</Button>
        <Button variant="outline" onClick={async()=>{const reason=window.prompt('Rad etish sababi (kamida 3 belgi)');if(!reason)return;try{await api.shifts.rejectClose(shift.id,{requestId:shift.pendingClose!.id,operationId:crypto.randomUUID(),reason});await refreshShift();await loadHistory();notifySuccess('So‘rov rad etildi; qayta sanash mumkin');}catch(error){notifyError(error instanceof Error?error.message:'Rad etilmadi');}}}>{tr("Qayta sanashga qaytarish")}</Button></div>}
      </Card>)}
      {/* Open Shift Modal */}
      <OpenShiftModal
        isOpen={isOpenShiftModalOpen}
        onClose={() => setIsOpenShiftModalOpen(false)}
        onSuccess={loadHistory}
      />

      {role&&role!=='cashier'&&<ShiftCorrections shifts={shiftsHistory} activeShiftId={activeShift?.id} onChanged={async()=>{await refreshShift();await loadHistory();}}/>}
      <ShiftCashSummary shifts={shiftsHistory} activeShift={activeShift??undefined}/>
      {/* Cash Movement Modal */}
      <Modal
        isOpen={isCashMoveModalOpen}
        onClose={() => {if(closeCashEditor())setIsCashMoveModalOpen(false)}}
        title={movementType === 'cash_in' ? tr("Naqd pul kiritish") : tr("Naqd pul olish")}
        size="md"
      >
        {cashUnknown&&<p role="status">{tr("Natija noma’lum: asl summa va amal kaliti bilan qayta tekshiriladi.")}</p>}
        <form onSubmit={handleCashMovement} className="space-y-4">
          <label className="block text-sm">{tr("Naqd harakat turi")}<select aria-label={tr("Naqd harakat turi")} value={movementType} disabled={isProcessingMove||cashUnknown||!cashReady} onChange={e=>setMovementType(e.target.value as typeof movementType)} className="block border p-2 w-full"><option value="cash_in">{tr("Naqd kirim")}</option><option value="cash_out">{tr("Naqd chiqim")}</option>{role!=='cashier'&&<><option value="bank_deposit">{tr("Bankka topshirish")}</option><option value="collection">{tr("Inkassatsiya")}</option></>}</select></label>
          <Input
            label={tr("Summa (so'm) *")}
            type="number"
            min="0.01"
            step="0.01"
            placeholder="50000"
            value={movementAmount}
            disabled={isProcessingMove||cashUnknown||!cashReady}
            onChange={(e) => setMovementAmount(e.target.value)}
            leftIcon={<FontAwesomeIcon icon={faMoneyBillWave} className="text-xs" />}
            required
          />

          <Input
            label={tr("Sababi / Izoh *")}
            placeholder={
              movementType === 'cash_in'
                ? tr("Mayda pul kiritish")
                : tr("Inkassatsiya / Xarajat")
            }
            value={movementReason}
            disabled={isProcessingMove||cashUnknown||!cashReady}
            onChange={(e) => setMovementReason(e.target.value)}
            required
          />

          <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => {if(closeCashEditor())setIsCashMoveModalOpen(false)}}
              disabled={isProcessingMove}
            >
              {tr("Bekor qilish")}</Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isProcessingMove}
              disabled={!cashReady}
              className="font-bold"
            >
              {tr("Tasdiqlash")}</Button>
          </div>
        </form>
      </Modal>

      {/* Close Shift Modal */}
      <Modal
        isOpen={isCloseModalOpen}
        onClose={() => {if(closeShiftEditor())setIsCloseModalOpen(false)}}
        title={tr("Smenani yakunlash va yopish")}
        size="md"
      >
        <form onSubmit={handleCloseShift} className="space-y-4">
          <p className="text-xs text-gray-600">
            {tr("Kassa g'aladonidagi barcha naqd pullarni sanab, quyidagi maydonga kiriting. Tizim kutilayotgan summa bilan avtomatik taqqoslab, kassa farqini hisoblaydi:")}</p>

          <Input
            label={tr("Kassadagi sanalgan naqd pul (so'm) *")}
            type="number"
            min="0"
            step="0.01"
            placeholder="1500000"
            value={countedCash}
            onChange={(e) => setCountedCash(e.target.value)}
            leftIcon={<FontAwesomeIcon icon={faMoneyBillWave} className="text-xs" />}
            className="text-lg font-bold text-gray-900"
            required
            autoFocus
          />

          <Input
            label={tr("Izoh (ixtiyoriy)")}
            placeholder={tr("Smena yakuni bo'yicha izoh")}
            value={closeNote}
            onChange={(e) => setCloseNote(e.target.value)}
          />

          <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => {if(closeShiftEditor())setIsCloseModalOpen(false)}}
              disabled={isClosingShift}
            >
              {tr("Bekor qilish")}</Button>
            <Button
              type="submit"
              variant="danger"
              isLoading={isClosingShift}
              className="font-bold"
            >
              {tr("Smenani yopish")}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
