'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotification } from '@/context/NotificationContext';
import { api } from '@/lib/api';
import { Shift } from '@/types';
import { formatMoney, formatDate } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import CsvExportButton from '@/components/ui/CsvExportButton';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import OpenShiftModal from '@/components/pos/OpenShiftModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faClock,
  faMoneyBillWave,
  faArrowDown,
  faArrowUp,
  faLock,
  faHistory,
} from '@fortawesome/free-solid-svg-icons';

export default function ShiftsPage() {
  const {role}=useAuth();
  const cashAttempt=useRef<string|null>(null);
  const { activeRegister, activeShift, refreshShift } = useOrganization();
  const { notifySuccess, notifyError } = useNotification();

  const [shiftsHistory, setShiftsHistory] = useState<Shift[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Modals
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);

  // Cash movement modal
  const [isCashMoveModalOpen, setIsCashMoveModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<'cash_in' | 'cash_out'>('cash_in');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [isProcessingMove, setIsProcessingMove] = useState(false);

  // Close shift modal
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [countedCash, setCountedCash] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [isClosingShift, setIsClosingShift] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const res = await api.shifts.list({
        registerId: activeRegister?.id,
      });
      if (res.data) {
        setShiftsHistory(res.data);
      }
    } catch (err: unknown) {
      console.error('Failed to load shift history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [activeRegister]);

  useEffect(() => {
    void Promise.resolve().then(loadHistory);
  }, [loadHistory, activeShift]);

  // Cash movement handler
  const handleCashMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift?.id) return;

    const amount = parseFloat(movementAmount);
    if (!amount || amount <= 0) {
      notifyError('Summani to\'g\'ri kiriting');
      return;
    }
    if (!movementReason.trim()) {
      notifyError('Sababini kiriting');
      return;
    }

    cashAttempt.current ??= crypto.randomUUID();
    setIsProcessingMove(true);
    try {
      await api.shifts.cashMovement(activeShift.id, {
        operationId:cashAttempt.current,
        movementType,
        amount,
        reason: movementReason.trim(),
      });

      notifySuccess(
        movementType === 'cash_in'
          ? 'Naqd pul kassaga kiritildi'
          : 'Naqd pul kassadan chiqarildi'
      );
      cashAttempt.current=null;
      setIsCashMoveModalOpen(false);
      setMovementAmount('');
      setMovementReason('');
      await refreshShift();
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Pul harakatida xatolik yuz berdi');
    } finally {
      setIsProcessingMove(false);
    }
  };

  // Close shift handler
  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift?.id) return;

    const counted = parseFloat(countedCash);
    if (isNaN(counted)) {
      notifyError('Kassadagi sanalgan naqd pulni kiriting');
      return;
    }

    setIsClosingShift(true);
    try {
      await api.shifts.close(activeShift.id, {
        countedCash: counted,
        note: closeNote.trim() || undefined,
      });

      notifySuccess('Smena muvaffaqiyatli yopildi');
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
      {role&&role!=='cashier'&&<CsvExportButton path="/shifts" params={activeRegister?{registerId:activeRegister.id}:{}}/>}
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Kassa va Smenalar nazorati
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Kassir smenalari, naqd pul harakati (inkassatsiya) va hisobdorlik
          </p>
        </div>

        {!activeShift && (
          <Button
            variant="success"
            onClick={() => setIsOpenShiftModalOpen(true)}
            leftIcon={<FontAwesomeIcon icon={faClock} />}
            className="font-bold shadow-md shadow-emerald-500/20"
          >
            Yangi smena ochish
          </Button>
        )}
      </div>

      {/* Active Shift Card */}
      {activeShift ? (
        <Card
          title={
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Joriy Ochiq Smena</span>
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
                Pul kiritish
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMovementType('cash_out');
                  setIsCashMoveModalOpen(true);
                }}
                leftIcon={<FontAwesomeIcon icon={faArrowUp} />}
              >
                Pul olish
              </Button>

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
                Smenani yopish
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-xs text-gray-500 font-semibold block">
                Boshlang&apos;ich naqd pul:
              </span>
              <span className="text-xl font-black text-gray-900 mt-1 block">
                {formatMoney(activeShift.openingCash)}
              </span>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-xs text-gray-500 font-semibold block">Kassir:</span>
              <span className="text-base font-bold text-gray-800 mt-1 block">
                {activeShift.organizationUser?.user?.fullName || 'Kassir'}
              </span>
            </div>

            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <span className="text-xs text-emerald-700 font-bold block">
                Kassa holati:
              </span>
              <span className="text-xs text-emerald-900 font-medium mt-1 block">
                Savdo qilish va to&apos;lovlarni qabul qilishga tayyor
              </span>
            </div>
          </div>
        </Card>
      ) : (
        <Card padding={false} className="p-8 text-center bg-linear-to-b from-gray-50 to-white">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center text-2xl mx-auto mb-3">
            <FontAwesomeIcon icon={faClock} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Ayni vaqtda ochiq smena yo&apos;q</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-5">
            Savdolarni amalga oshirish uchun boshlang&apos;ich naqd pul qoldig&apos;i bilan yangi smena oching
          </p>
          <Button
            variant="success"
            onClick={() => setIsOpenShiftModalOpen(true)}
            leftIcon={<FontAwesomeIcon icon={faClock} />}
            className="font-bold shadow-md shadow-emerald-500/20"
          >
            Smena ochish
          </Button>
        </Card>
      )}

      {/* Shifts History Table */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <FontAwesomeIcon icon={faHistory} className="text-gray-400 text-sm" />
            <span>Smenalar tarixi</span>
          </div>
        }
        subtitle="Avval yopilgan va faol barcha smenalar arxivi"
        padding={false}
      >
        {isLoadingHistory ? (
          <div className="h-48 flex items-center justify-center">
            <LoadingSpinner size="lg" text="Tarix yuklanmoqda..." />
          </div>
        ) : shiftsHistory.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-gray-400 text-xs">
            Smenalar tarixi topilmadi
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Terminal</th>
                  <th className="py-3.5 px-4">Kassir</th>
                  <th className="py-3.5 px-4">Ochilgan vaqti</th>
                  <th className="py-3.5 px-4">Yopilgan vaqti</th>
                  <th className="py-3.5 px-4 text-right">Boshlang&apos;ich</th>
                  <th className="py-3.5 px-4 text-right">Kutilgan summa</th>
                  <th className="py-3.5 px-4 text-right">Sanalgan summa</th>
                  <th className="py-3.5 px-4 text-right">Farq</th>
                  <th className="py-3.5 px-4 text-center">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shiftsHistory.map((s) => {
                  const diff = Number(s.cashDifference || 0);
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3.5 px-4 font-bold text-gray-900">
                        {s.register?.name || 'Kassa'}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-gray-700">
                        {s.organizationUser?.user?.fullName || 'Kassir'}
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
                            <span className="text-gray-400 font-bold">0 so&apos;m</span>
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
                            Ochiq
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="sm">
                            Yopilgan
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

      {/* Open Shift Modal */}
      <OpenShiftModal
        isOpen={isOpenShiftModalOpen}
        onClose={() => setIsOpenShiftModalOpen(false)}
        onSuccess={loadHistory}
      />

      {/* Cash Movement Modal */}
      <Modal
        isOpen={isCashMoveModalOpen}
        onClose={() => setIsCashMoveModalOpen(false)}
        title={movementType === 'cash_in' ? 'Naqd pul kiritish' : 'Naqd pul olish'}
        size="md"
      >
        <form onSubmit={handleCashMovement} className="space-y-4">
          <Input
            label="Summa (so'm) *"
            type="number"
            min="1000"
            step="1000"
            placeholder="50000"
            value={movementAmount}
            onChange={(e) => setMovementAmount(e.target.value)}
            leftIcon={<FontAwesomeIcon icon={faMoneyBillWave} className="text-xs" />}
            required
          />

          <Input
            label="Sababi / Izoh *"
            placeholder={
              movementType === 'cash_in'
                ? 'Mayda pul kiritish'
                : 'Inkassatsiya / Xarajat'
            }
            value={movementReason}
            onChange={(e) => setMovementReason(e.target.value)}
            required
          />

          <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCashMoveModalOpen(false)}
              disabled={isProcessingMove}
            >
              Bekor qilish
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isProcessingMove}
              className="font-bold"
            >
              Tasdiqlash
            </Button>
          </div>
        </form>
      </Modal>

      {/* Close Shift Modal */}
      <Modal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        title="Smenani yakunlash va yopish"
        size="md"
      >
        <form onSubmit={handleCloseShift} className="space-y-4">
          <p className="text-xs text-gray-600">
            Kassa g&apos;aladonidagi barcha naqd pullarni sanab, quyidagi maydonga kiriting. Tizim kutilayotgan summa bilan avtomatik taqqoslab, kassa farqini hisoblaydi:
          </p>

          <Input
            label="Kassadagi sanalgan naqd pul (so'm) *"
            type="number"
            min="0"
            step="1000"
            placeholder="1500000"
            value={countedCash}
            onChange={(e) => setCountedCash(e.target.value)}
            leftIcon={<FontAwesomeIcon icon={faMoneyBillWave} className="text-xs" />}
            className="text-lg font-bold text-gray-900"
            required
            autoFocus
          />

          <Input
            label="Izoh (ixtiyoriy)"
            placeholder="Smena yakuni bo'yicha izoh"
            value={closeNote}
            onChange={(e) => setCloseNote(e.target.value)}
          />

          <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCloseModalOpen(false)}
              disabled={isClosingShift}
            >
              Bekor qilish
            </Button>
            <Button
              type="submit"
              variant="danger"
              isLoading={isClosingShift}
              className="font-bold"
            >
              Smenani yopish
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
