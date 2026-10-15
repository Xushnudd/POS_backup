'use client';
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
import { faPhone, faLock, faArrowRight } from '@fortawesome/free-solid-svg-icons';

export default function LoginPage() {
 const {t:tr}=useTranslation();

  const router = useRouter();
  const { login } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const flight=useRef(false);
  const dirty=Boolean(phone||password);
  useUnsavedChanges(dirty,isLoading);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(flight.current)return;
    setErrorMessage('');

    if (!phone || phone.trim().length < 9) {
      setErrorMessage("Iltimos, to'g'ri telefon raqam kiriting (kamida 9 ta raqam)");
      return;
    }

    if (!password) {
      setErrorMessage("Iltimos, parolingizni kiriting");
      return;
    }

    flight.current=true;
    setIsLoading(true);
    try {
      const authenticated=await login(phone.trim(), password);
      notifySuccess("Tizimga muvaffaqiyatli kirdingiz!");
      setPhone('');setPassword('');commitPageNavigation();router.push(authenticated.role==='cashier'?'/pos':'/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Kirishda xatolik yuz berdi';
      setErrorMessage(msg);
      notifyError(msg);
    } finally {
      flight.current=false;
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-emerald-500 to-blue-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-emerald-500/20">
            S
          </div>
          <span className="text-2xl font-black tracking-tight text-gray-900">
            Shuni <span className="text-emerald-600">POS</span>
          </span>
        </Link>
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
          {tr("Tizimga kirish")}</h2>
        <p className="mt-2 text-sm text-gray-600">
          {tr("Kassa va savdo boshqaruvi tizimingizga xush kelibsiz")}</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-gray-100">
          {errorMessage && (
            <div role="alert" className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {errorMessage}
            </div>
          )}

          {isLoading&&<p role="status">{tr("Server tasdig‘i kutilmoqda…")}</p>}
          {!isLoading&&dirty&&<p role="status">{tr("Saqlanmagan forma ma’lumotlari bor.")}</p>}
          <form onSubmit={handleSubmit} className="space-y-5"><fieldset disabled={isLoading} className="space-y-5">
            <Input
              label={tr("Telefon raqam")}
              type="tel"
              placeholder="901234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              leftIcon={<FontAwesomeIcon icon={faPhone} className="text-xs" />}
              helperText={tr("Misol: 901234567 yoki +998901234567")}
              required
            />

            <Input
              label={tr("Parol")}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<FontAwesomeIcon icon={faLock} className="text-xs" />}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isLoading}
              rightIcon={<FontAwesomeIcon icon={faArrowRight} />}
              className="mt-2 font-bold shadow-md shadow-blue-500/20"
            >
              {tr("Kirish")}</Button>
          </fieldset></form>

          <Link href="/forgot-password" className="mt-4 block text-sm text-blue-600 underline">{tr("Parolni unutdingizmi?")}</Link>

          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-600">
              {tr("Hisobingiz yo'qmi?")}{' '}
              <Link
                href="/register"
                className="font-bold text-blue-600 hover:text-blue-700 hover:underline"
              >
                {tr("Ro'yxatdan o'tish")}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
