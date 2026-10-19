'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import {commitPageNavigation} from '@/lib/page-navigation';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUser,
  faPhone,
  faLock,
  faBuilding,
  faEnvelope,
  faIdCard,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons';

export default function RegisterPage() {
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

  const router = useRouter();
  const { register } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [tin, setTin] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const flight=useRef(false);
  const dirty=Boolean(fullName||phone||email||password||organizationName||tin);
  useUnsavedChanges(dirty,isLoading);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(flight.current)return;
    setErrorMessage('');

    if (!fullName || fullName.trim().length < 2) {
      setErrorMessage("Iltimos, ism familiyangizni kiriting");
      return;
    }

    if (!phone || phone.trim().length < 9) {
      setErrorMessage("Telefon raqami kamida 9 ta belgidan iborat bo'lishi kerak");
      return;
    }

    if (!password || password.length < 8 || password.length > 72) {
      setErrorMessage("Parol 8–72 ta belgidan iborat bo'lishi kerak");
      return;
    }

    if (!organizationName || organizationName.trim().length < 2) {
      setErrorMessage("Tashkilot yoki do'kon nomini kiriting");
      return;
    }

    flight.current=true;
    setIsLoading(true);
    try {
      await register({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email ? email.trim() : undefined,
        password,
        organizationName: organizationName.trim(),
        tin: tin ? tin.trim() : undefined,
      });

      notifySuccess("Muvaffaqiyatli ro'yxatdan o'tdingiz! Tizim sozlandi.");
      setPassword('');commitPageNavigation();router.push('/dashboard');
    } catch (err: unknown) {
      const msg = displayErrorMessage(err,'Ro\'yxatdan o\'tishda xatolik yuz berdi');
      setErrorMessage(msg);
      notifyError(msg);
    } finally {
      flight.current=false;
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center">
        <Link href="/" className="inline-flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-emerald-500 to-blue-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-emerald-500/20">
            S
          </div>
          <span className="text-2xl font-black tracking-tight text-gray-900">
            Shuni <span className="text-emerald-600">POS</span>
          </span>
        </Link>
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
          {tr("Yangi biznesni ro'yxatdan o'tkazish")}</h2>
        <p className="mt-2 text-sm text-gray-600">
          {tr("Bir necha soniyada o'z do'koningizni tizimga ulang")}</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-gray-100">
          {errorMessage && (
            <div role="alert" className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {uiMessage(errorMessage)}
            </div>
          )}

          {isLoading&&<p role="status">{tr("Server tasdig‘i kutilmoqda…")}</p>}
          {!isLoading&&dirty&&<p role="status">{tr("Saqlanmagan forma ma’lumotlari bor.")}</p>}
          <form onSubmit={handleSubmit} className="space-y-4"><fieldset disabled={isLoading} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={tr("Ism va Familiya")}
                placeholder={tr("Ali Valiyev")}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                leftIcon={<FontAwesomeIcon icon={faUser} className="text-xs" />}
                required
              />

              <Input
                label={tr("Telefon raqam")}
                type="tel"
                placeholder="901234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                leftIcon={<FontAwesomeIcon icon={faPhone} className="text-xs" />}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={tr("Do'kon yoki Biznes nomi")}
                placeholder={tr("Mening Do'konim")}
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                leftIcon={<FontAwesomeIcon icon={faBuilding} className="text-xs" />}
                required
              />

              <Input
                label={tr("STIR / INN (ixtiyoriy)")}
                placeholder="123456789"
                value={tin}
                onChange={(e) => setTin(e.target.value)}
                leftIcon={<FontAwesomeIcon icon={faIdCard} className="text-xs" />}
              />
            </div>

            <Input
              label={tr("Email (ixtiyoriy)")}
              type="email"
              placeholder="example@pos.uz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<FontAwesomeIcon icon={faEnvelope} className="text-xs" />}
            />

            <Input
              label={tr("Parol (8–72 ta belgi)")}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8} maxLength={72}
              leftIcon={<FontAwesomeIcon icon={faLock} className="text-xs" />}
              required
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="success"
                size="lg"
                fullWidth
                isLoading={isLoading}
                rightIcon={<FontAwesomeIcon icon={faArrowRight} />}
                className="font-bold shadow-md shadow-emerald-500/20"
              >
                {tr("Hisob yaratish va Boshlash")}</Button>
            </div>
          </fieldset></form>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-600">
              {tr("Allaqachon ro'yxatdan o'tganmisiz?")}{' '}
              <Link
                href="/login"
                className="font-bold text-blue-600 hover:text-blue-700 hover:underline"
              >
                {tr("Kirish")}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
