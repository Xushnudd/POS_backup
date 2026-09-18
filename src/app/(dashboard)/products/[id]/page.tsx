'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Category, Product } from '@/types';
import { PRODUCT_UNITS } from '@/lib/constants';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import CameraBarcodeScanner from '@/components/pos/CameraBarcodeScanner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faSave, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useNotification } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';

export default function ProductDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const router = useRouter();
  const { organization } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    unit: 'dona',
    costPrice: '',
    salePrice: '',
    minStock: '',
  });

  useEffect(() => {
    if (!id) return;
    let isCancelled = false;

    Promise.all([
      api.products.get(id),
      organization?.id ? api.categories.list(organization.id) : Promise.resolve({ data: [] }),
    ])
      .then(([prodRes, catRes]) => {
        if (isCancelled) return;
        if (prodRes.data) {
          const p = prodRes.data;
          setProduct(p);
          setFormData({
            name: p.name,
            sku: p.sku,
            barcode: p.barcode,
            categoryId: p.categoryId || '',
            unit: p.unit || 'dona',
            costPrice: String(p.costPrice),
            salePrice: String(p.salePrice),
            minStock: String(p.minStock),
          });
        }
        if (catRes.data) setCategories(catRes.data);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [id, organization]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;

    if (Number(formData.costPrice) <= 0 || Number(formData.salePrice) <= 0) {
      notifyError('Tannarx va sotuv narxi 0 dan katta bo‘lishi kerak');
      return;
    }

    setIsSaving(true);
    try {
      await api.products.update(product.id, {
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        barcode: formData.barcode.trim(),
        categoryId: formData.categoryId || undefined,
        unit: formData.unit,
        costPrice: Number(formData.costPrice),
        salePrice: Number(formData.salePrice),
        minStock: parseFloat(formData.minStock) || 0,
      });
      notifySuccess('Mahsulot muvaffaqiyatli saqlandi');
      router.push('/products');
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!product || !confirm('Ushbu mahsulotni o\'chirmoqchimisiz?')) return;
    try {
      await api.products.delete(product.id);
      notifySuccess('Mahsulot o\'chirildi');
      router.push('/products');
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'O\'chirishda xatolik');
    }
  };

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Mahsulot yuklanmoqda..." />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500 mb-4">Mahsulot topilmadi</p>
        <Link href="/products">
          <Button variant="outline">Mahsulotlarga qaytish</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/products">
            <Button variant="ghost" size="icon">
              <FontAwesomeIcon icon={faArrowLeft} />
            </Button>
          </Link>
          <h1 className="text-2xl font-black text-gray-900">{product.name}</h1>
        </div>

        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          leftIcon={<FontAwesomeIcon icon={faTrash} />}
        >
          O&apos;chirish
        </Button>
      </div>

      <Card title="Mahsulot ma'lumotlarini tahrirlash">
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Mahsulot nomi *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="SKU (Artikul) *"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              required
            />
            <div className="relative">
              <Input
                label="Barkod *"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="pr-11"
                required
              />
              <CameraBarcodeScanner
                onDetected={(barcode) => setFormData((current) => ({ ...current, barcode }))}
                className="absolute right-1 top-7 p-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Kategoriya"
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Select
              label="O'lchov birligi"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              options={PRODUCT_UNITS}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Tannarx (so'm) *"
              type="number"
              value={formData.costPrice}
              onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
              required
            />
            <Input
              label="Sotuv narxi (so'm) *"
              type="number"
              value={formData.salePrice}
              onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
              required
            />
            <Input
              label="Minimal qoldiq"
              type="number"
              value={formData.minStock}
              onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Link href="/products">
              <Button type="button" variant="outline" disabled={isSaving}>
                Bekor qilish
              </Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSaving}
              leftIcon={<FontAwesomeIcon icon={faSave} />}
              className="font-bold"
            >
              Saqlash
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
