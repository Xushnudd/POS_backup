'use client';

import {useTranslation} from '@/context/LocaleContext';


import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BrowserMultiFormatReader,
  IScannerControls,
} from '@zxing/browser';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera, faCircleNotch } from '@fortawesome/free-solid-svg-icons';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

export interface CameraBarcodeScannerProps {
  /** Kamera aniqlagan barcode yoki QR kod qiymati. */
  onDetected: (barcode: string) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export default function CameraBarcodeScanner({
  onDetected,
  disabled = false,
  className = '',
  ariaLabel = 'Kamera orqali barkodni skanerlash',
}: CameraBarcodeScannerProps) {
 const {t:tr}=useTranslation();

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const detectedRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  const closeScanner = useCallback(() => {
    stopScanner();
    setIsOpen(false);
  }, [stopScanner]);

  const startScanner = useCallback(async () => {
    if (!videoRef.current) return;

    detectedRef.current = false;
    setErrorMessage(null);
    setIsStarting(true);

    try {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result) => {
          const barcode = result?.getText().trim();
          if (!barcode || detectedRef.current) return;

          detectedRef.current = true;
          stopScanner();
          setIsOpen(false);
          void Promise.resolve(onDetected(barcode)).catch(() => {
            setErrorMessage('Skanerlangan kodni saqlashda xatolik yuz berdi');
          });
        }
      );
      controlsRef.current = controls;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      setErrorMessage(
        message || 'Kameraga ulanib bo‘lmadi. Ruxsat berilganini va HTTPS ishlatilayotganini tekshiring.'
      );
    } finally {
      setIsStarting(false);
    }
  }, [onDetected, stopScanner]);

  useEffect(() => {
    if (isOpen) {
      void Promise.resolve().then(startScanner);
    }

    return stopScanner;
  }, [isOpen, startScanner, stopScanner]);

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className={`inline-flex aspect-square items-center justify-center rounded-xl p-2 text-gray-600 transition hover:bg-gray-100 hover:text-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <FontAwesomeIcon icon={faCamera} />
      </button>

      <Modal isOpen={isOpen} onClose={closeScanner} title={tr("Barkodni skanerlash")} size="md">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-xl bg-black aspect-video">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            {isStarting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white">
                <FontAwesomeIcon icon={faCircleNotch} className="mr-2 animate-spin" />
                {tr("Kamera ulanmoqda...")}</div>
            )}
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-20 -translate-y-1/2 rounded-lg border-2 border-emerald-400" />
          </div>

          {errorMessage ? (
            <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {errorMessage}
            </p>
          ) : (
            <p className="text-center text-xs text-gray-600">
              {tr("Barkodni ramka ichiga joylashtiring. Kod topilishi bilan skaner avtomatik yopiladi.")}</p>
          )}

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={closeScanner}>
              {tr("Bekor qilish")}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
