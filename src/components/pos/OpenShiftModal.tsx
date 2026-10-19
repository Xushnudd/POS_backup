'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import React, { useState, useEffect } from 'react';
import DurableMutation from '@/components/forms/DurableMutation';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import {confirmPageNavigation} from '@/lib/page-navigation';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotification } from '@/context/NotificationContext';
import type {Shift} from '@/types';
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
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

  const { user } = useAuth();
  const { activeStore, activeRegister, setActiveRegister, applyOpenedShift } = useOrganization();
  const { notifySuccess, notifyError } = useNotification();

  const [openingCash, setOpeningCash] = useState<string>('0');
  const [handover,setHandover]=useState<{id:string;countedCash:string}|null>(null),[acceptHandover,setAcceptHandover]=useState(false);
  const [handoverState,setHandoverState]=useState<'loading'|'ready'|'failed'>('loading');
  const [handoverError,setHandoverError]=useState(''),[handoverRevision,setHandoverRevision]=useState(0);
  const [note,setNote]=useState('');
  const registerId=activeRegister?.id;
  useUnsavedChanges(isOpen&&Boolean(openingCash!=='0'||note||acceptHandover));
  useEffect(()=>{
    let cancelled=false;
    void Promise.resolve().then(async()=>{
      if(cancelled)return;
      setHandover(null);setAcceptHandover(false);setHandoverState('loading');setHandoverError('');
      if(!isOpen||!registerId)return;
      try{const response=await api.shifts.handover(registerId);if(!cancelled){setHandover(response.data??null);setHandoverState('ready');}}
      catch(error){if(!cancelled){setHandoverError(displayErrorMessage(error,'Oldingi smena tekshirilmadi'));setHandoverState('failed');}}
    });
    return()=>{cancelled=true;};
  },[isOpen,registerId,handoverRevision]);
  const registers=activeStore?.registers||[];
  const finish=()=>{setOpeningCash('0');setNote('');setAcceptHandover(false);onClose();};
  const close=()=>{if(confirmPageNavigation())finish();};
  const saved=(result?:unknown)=>{
    const shift=result as Shift|undefined;
    if(!shift||!applyOpenedShift(shift)){notifyError('Smena ochildi, lekin kassa yoki foydalanuvchi konteksti o‘zgardi. Holatni qayta tekshiring.');finish();return;}
    notifySuccess('Smena muvaffaqiyatli ochildi!');finish();
    try{onSuccess?.();}catch{notifyError('Smena ochildi; keyingi ekran yangilanmadi.');}
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={
        <div className="flex items-center gap-2 text-emerald-700">
          <FontAwesomeIcon icon={faClock} />
          <span>{tr("Yangi smena ochish")}</span>
        </div>
      }
      size="md"
    >
      {handoverState==='loading'&&<p role="status">{tr("Oldingi smena tekshirilmoqda…")}</p>}
      {handoverState==='failed'&&<p role="alert">{uiMessage(handoverError)} <button type="button" className="underline" onClick={()=>setHandoverRevision(value=>value+1)}>{tr("Oldingi smenani qayta tekshirish")}</button></p>}
      <DurableMutation path="/shifts" returnPath="/pos" label={tr("Smenani ochish")} allowNew={handoverState==='ready'&&Boolean(registerId&&user?.organizationUserId)} body={{registerId,organizationUserId:user?.organizationUserId,openingCash:acceptHandover&&handover?handover.countedCash:openingCash,...(acceptHandover&&handover?{handoverFromId:handover.id}:{}),note:note.trim()||undefined}} review={[tr("Kassa: {value1}",{value1:String(activeRegister?.name??'')}),tr("Boshlang‘ich naqd: {value1}",{value1:String(acceptHandover&&handover?handover.countedCash:openingCash)}),tr("Izoh: {value1}",{value1:String(note)}),...(acceptHandover&&handover?[`Qabul qilinadigan smena: ${handover.id}`]:[])]} onDone={saved}>
      <fieldset disabled={handoverState!=='ready'} className="space-y-4">
        <p className="text-sm text-gray-600">
          {tr("Kassada savdo qilish uchun smena ochishingiz zarur. Boshlang'ich naqd pul qoldig'ini kiriting:")}</p>

        {registers.length > 1 && (
          <Select
            label={tr("Kassa terminali")}
            value={activeRegister?.id || ''}
            onChange={(e) => {
              const selected = registers.find((r) => r.id === e.target.value);
              if(selected&&selected.id!==registerId&&confirmPageNavigation()){setOpeningCash('0');setNote('');setActiveRegister(selected);}
            }}
            options={registers.map((r) => ({ value: r.id, label: `${r.name} (${r.code})` }))}
          />
        )}

        {handover&&<label className="block text-sm"><input type="checkbox" checked={acceptHandover} onChange={e=>{setAcceptHandover(e.target.checked);if(e.target.checked)setOpeningCash(handover.countedCash);}}/> {tr("Oldingi smenani qabul qilish —")}{' '}{handover.countedCash} {tr("so‘m")}</label>}
        <Input
          label={tr("Boshlang'ich naqd pul (so'm)")}
          type="number"
          min="0"
          step="0.01"
          disabled={acceptHandover}
          value={openingCash}
          onChange={(e) => setOpeningCash(e.target.value)}
          leftIcon={<FontAwesomeIcon icon={faMoneyBillWave} className="text-xs" />}
          helperText={tr("Kassa g'aladonidagi mavjud naqd pul miqdori")}
          required
        />

        <Input
          label={tr("Izoh (ixtiyoriy)")}
          placeholder={tr("Ertalabki smena")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="pt-2 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={close}>
            {tr("Bekor qilish")}</Button>

        </div>
      </fieldset></DurableMutation>
    </Modal>
  );
}
