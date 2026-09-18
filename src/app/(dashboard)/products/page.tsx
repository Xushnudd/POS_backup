'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { api } from '@/lib/api';
import { Category, Product } from '@/types';
import { formatMoney, formatNumber } from '@/lib/format';
import { PRODUCT_UNITS } from '@/lib/constants';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import CameraBarcodeScanner from '@/components/pos/CameraBarcodeScanner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faSearch,
  faEdit,
  faBoxesStacked,
  faTags,
} from '@fortawesome/free-solid-svg-icons';

export default function ProductsPage() {
  const { organization } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    categoryId: '',
    unit: 'dona',
    costPrice: '',
    salePrice: '',
    minStock: '0',
  });

  const [categoryName, setCategoryName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!organization?.id) return;
    setIsLoading(true);
    try {
      const [prodsRes, catsRes] = await Promise.all([
        api.products.list({
          organizationId: organization.id,
          search: searchQuery || undefined,
          categoryId: selectedCategory || undefined,
          limit: 100,
        }),
        api.categories.list(organization.id),
      ]);

      if (prodsRes.data) setProducts(prodsRes.data);
      if (catsRes.data) setCategories(catsRes.data);
    } catch (err: unknown) {
      console.error('Failed to load products:', err);
    } finally {
      setIsLoading(false);
    }
  }, [organization, searchQuery, selectedCategory]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      barcode: `${Math.floor(100000000000 + Math.random() * 900000000000)}`,
      categoryId: categories[0]?.id || '',
      unit: 'dona',
      costPrice: '',
      salePrice: '',
      minStock: '5',
    });
    setIsProductModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
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
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;

    if (
      !formData.name ||
      !formData.sku ||
      !formData.barcode ||
      Number(formData.costPrice) <= 0 ||
      Number(formData.salePrice) <= 0
    ) {
      notifyError('Barcha majburiy maydonlarni to‘ldiring; tannarx va sotuv narxi 0 dan katta bo‘lsin');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        organizationId: organization.id,
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        barcode: formData.barcode.trim(),
        categoryId: formData.categoryId || undefined,
        unit: formData.unit,
        costPrice: Number(formData.costPrice),
        salePrice: Number(formData.salePrice),
        minStock: parseFloat(formData.minStock) || 0,
      };

      if (editingProduct) {
        await api.products.update(editingProduct.id, payload);
        notifySuccess('Mahsulot muvaffaqiyatli yangilandi');
      } else {
        await api.products.create(payload);
        notifySuccess('Yangi mahsulot yaratildi');
      }

      setIsProductModalOpen(false);
      loadData();
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Mahsulotni saqlashda xatolik');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !categoryName.trim()) return;

    try {
      await api.categories.create({
        organizationId: organization.id,
        name: categoryName.trim(),
      });
      notifySuccess('Kategoriya muvaffaqiyatli qo\'shildi');
      setCategoryName('');
      const catsRes = await api.categories.list(organization.id);
      if (catsRes.data) setCategories(catsRes.data);
    } catch (err: unknown) {
      notifyError(err instanceof Error ? err.message : 'Kategoriya qo\'shishda xatolik');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Mahsulotlar katalogi
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tovar va xizmatlar narxi, o&apos;lchov birligi va zaxira parametrlari
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsCategoryModalOpen(true)}
            leftIcon={<FontAwesomeIcon icon={faTags} />}
          >
            Kategoriyalar
          </Button>

          <Button
            variant="primary"
            onClick={openCreateModal}
            leftIcon={<FontAwesomeIcon icon={faPlus} />}
            className="font-bold shadow-md shadow-blue-500/20"
          >
            Yangi mahsulot
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card padding={false} className="p-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex w-full flex-1 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <input
                type="text"
                placeholder="Nom, SKU yoki barkod bo'yicha qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-hidden focus:border-blue-500"
              />
              <FontAwesomeIcon
                icon={faSearch}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"
              />
            </div>

            <CameraBarcodeScanner
              onDetected={(barcode) => setSearchQuery(barcode)}
              className="shrink-0 border border-gray-200 bg-gray-50 p-2.5 text-base"
            />
          </div>

          <div className="w-full sm:w-64">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-hidden text-gray-700 cursor-pointer"
            >
              <option value="">Barcha kategoriyalar</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Products Table */}
      <Card padding={false}>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <LoadingSpinner size="lg" text="Mahsulotlar yuklanmoqda..." />
          </div>
        ) : products.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-400">
            <FontAwesomeIcon icon={faBoxesStacked} className="text-4xl text-gray-300 mb-3" />
            <p className="text-base font-bold text-gray-700">Mahsulotlar topilmadi</p>
            <p className="text-xs text-gray-400 mt-1 max-w-sm">
              Qidiruv filtrlaringizni o&apos;zgartiring yoki yangi mahsulot qo&apos;shing
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Mahsulot</th>
                  <th className="py-3.5 px-4">SKU / Barkod</th>
                  <th className="py-3.5 px-4">Kategoriya</th>
                  <th className="py-3.5 px-4">Birlik</th>
                  <th className="py-3.5 px-4 text-right">Tannarx</th>
                  <th className="py-3.5 px-4 text-right">Sotuv narxi</th>
                  <th className="py-3.5 px-4 text-center">Min. qoldiq</th>
                  <th className="py-3.5 px-4 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/70 transition">
                    <td className="py-3.5 px-4 font-bold text-gray-900">{p.name}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-gray-700">{p.sku}</div>
                      <div className="font-mono text-[10px] text-gray-400">{p.barcode}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {p.category ? (
                        <Badge variant="neutral" size="sm">
                          {p.category.name}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-gray-600">{p.unit}</td>
                    <td className="py-3.5 px-4 text-right text-gray-500 font-medium">
                      {formatMoney(p.costPrice)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-gray-900">
                      {formatMoney(p.salePrice)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-semibold text-gray-600">
                        {formatNumber(p.minStock)} {p.unit}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(p)}
                        leftIcon={<FontAwesomeIcon icon={faEdit} />}
                      >
                        Tahrirlash
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Product Form Modal */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title={editingProduct ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot qo\'shish'}
        size="lg"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <Input
            label="Mahsulot nomi *"
            placeholder="Coca-Cola 1.5L"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="SKU (Artikul) *"
              placeholder="SKU-001"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              required
            />

            <div className="relative">
              <Input
                label="Barkod *"
                placeholder="478000123456"
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
              placeholder="Kategoriyani tanlang"
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
              min="0"
              step="100"
              placeholder="8000"
              value={formData.costPrice}
              onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
              required
            />

            <Input
              label="Sotuv narxi (so'm) *"
              type="number"
              min="0"
              step="100"
              placeholder="12000"
              value={formData.salePrice}
              onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
              required
            />

            <Input
              label="Minimal qoldiq"
              type="number"
              min="0"
              placeholder="5"
              value={formData.minStock}
              onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
              helperText="Kam qolganda ogohlantirish"
            />
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsProductModalOpen(false)}
              disabled={isSaving}
            >
              Bekor qilish
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving} className="font-bold">
              {editingProduct ? 'Saqlash' : 'Qo\'shish'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Categories Management Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Kategoriyalar boshqaruvi"
        size="md"
      >
        <div className="space-y-4">
          <form onSubmit={handleCreateCategory} className="flex gap-2">
            <Input
              placeholder="Yangi kategoriya nomi..."
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="primary"
              leftIcon={<FontAwesomeIcon icon={faPlus} />}
              className="whitespace-nowrap"
            >
              Qo&apos;shish
            </Button>
          </form>

          <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-60 overflow-y-auto">
            {categories.map((c) => (
              <div key={c.id} className="p-3 flex items-center justify-between text-xs font-semibold">
                <span>{c.name}</span>
                <Badge variant="neutral" size="sm">
                  {products.filter((p) => p.categoryId === c.id).length} ta mahsulot
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
