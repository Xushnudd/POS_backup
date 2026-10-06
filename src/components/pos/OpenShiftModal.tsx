'use client';

import React, { useState, useRef, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotification } from '@/context/NotificationContext';
import { api } from '@/lib/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faMoneyBillWave } from '@fortawesome/free-solid-svg-icons';

interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function OpenShiftModal({
  isOpen,
  onClose,
  onSuccess,
}: OpenShiftModalProps) {
  const { user } = useAuth();
  const { activeStore, activeRegister, setActiveRegister, refreshShift } = useOrganization();
  const { notifySuccess, notifyError } = useNotification();

  const [openingCash, setOpeningCash] = useState<string>('0');
  const [handover,setHandover]=useState<{id:string;countedCash:string}|null>(null),[acceptHandover,setAcceptHandover]=useState(false);
  useEffect(()=>{let cancelled=false;void Promise.resolve().then(async()=>{setHandover(null);setAcceptHandover(false);if(!isOpen||!activeRegister)return;try{const response=await api.shifts.handover(activeRegister.id);if(!cancelled)setHandover(response.data??null);}catch(error){if(!cancelled)notifyError(error instanceof Error?error.message:'Oldingi smena tekshirilmadi');}});return()=>{cancelled=true;};},[isOpen,activeRegister,notifyError]);
  const [note, setNote] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const attempt = useRef<string | null>(null);
  const registers = activeStore?.registers || [];

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRegister?.id) {
      notifyError('Iltimos, kassa terminalini tanlang');
      return;
    }
    if (!user?.organizationUserId) {
      notifyError('Tashkilot foydalanuvchisi ma\'lumotlari topilmadi');
      return;
    }

    setIsLoading(true);
    try {
      attempt.current ??= crypto.randomUUID();
      await api.shifts.open({
        operationId: attempt.current,
        registerId: activeRegister.id,
        organizationUserId: user.organizationUserId,
        openingCash: acceptHandover&&handover?handover.countedCash:openingCash,
        ...(acceptHandover&&handover?{handoverFromId:handover.id}:{}),
        note: note.trim() || undefined,
      });

      attempt.current = null;
      notifySuccess('Smena muvaffaqiyatli ochildi!');
      await refreshShift();
      onClose();
      onSuccess?.();
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Smenani ochishda xatolik yuz berdi');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-emerald-700">
          <FontAwesomeIcon icon={faClock} />
          <span>Yangi smena ochish</span>
        </div>
      }
      size="md"
    >
      <form onSubmit={handleOpenShift} className="space-y-4">
        <p className="text-sm text-gray-600">
          Kassada savdo qilish uchun smena ochishingiz zarur. Boshlang&apos;ich naqd pul qoldig&apos;ini kiriting:
        </p>

        {registers.length > 1 && (
          <Select
            label="Kassa terminali"
            value={activeRegister?.id || ''}
            onChange={(e) => {
              const selected = registers.find((r) => r.id === e.target.value);
              if (selected) setActiveRegister(selected);
            }}
            options={registers.map((r) => ({ value: r.id, label: `${r.name} (${r.code})` }))}
          />
        )}

        {handover&&<label className="block text-sm"><input type="checkbox" checked={acceptHandover} onChange={e=>{setAcceptHandover(e.target.checked);if(e.target.checked)setOpeningCash(handover.countedCash);}}/> Oldingi smenani qabul qilish — {handover.countedCash} so‘m</label>}
        <Input
          label="Boshlang'ich naqd pul (so'm)"
          type="number"
          min="0"
          step="0.01"
          disabled={acceptHandover||isLoading}
          value={openingCash}
          onChange={(e) => setOpeningCash(e.target.value)}
          leftIcon={<FontAwesomeIcon icon={faMoneyBillWave} className="text-xs" />}
          helperText="Kassa g'aladonidagi mavjud naqd pul miqdori"
          required
        />

        <Input
          label="Izoh (ixtiyoriy)"
          placeholder="Ertalabki smena"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="pt-2 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Bekor qilish
          </Button>
          <Button
            type="submit"
            variant="success"
            isLoading={isLoading}
            className="font-bold"
          >
            Smenani ochish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
