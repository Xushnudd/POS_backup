'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useNotification } from '@/context/NotificationContext';
import { api } from '@/lib/api';
import { InventoryBalance, Product, StockDocument, Supplier } from '@/types';
import { formatMoney, formatNumber, formatDate } from '@/lib/format';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWarehouse,
  faPlus,
  faFileLines,
  faBoxesStacked,
  faCheck,
  faTrash,
  faRightLeft,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';

export default function InventoryPage() {
  const { organization } = useAuth();
  const { activeStore } = useOrganization();
  const { notifySuccess, notifyError } = useNotification();

  const [activeTab, setActiveTab] = useState<'balances' | 'documents'>('balances');
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [documents, setDocuments] = useState<StockDocument[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);

  // New stock document modal
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docType, setDocType] = useState<string>('purchase');
  const [docSupplierId, setDocSupplierId] = useState<string>('');
  const [docNote, setDocNote] = useState<string>('');
  const [docItems, setDocItems] = useState<
    { productId: string; quantity: number; unitCost: number }[]
  >([]);
  const [isSavingDoc, setIsSavingDoc] = useState(false);

  const loadData = useCallback(async () => {
    if (!organization?.id) return;
    setIsLoading(true);
    try {
      if (activeTab === 'balances') {
        const res = await api.inventory.balances({
          organizationId: organization.id,
          storeId: activeStore?.id,
          lowStock: lowStockOnly || undefined,
        });
        if (res.data) setBalances(res.data);
      } else {
        const res = await api.stockDocuments.list({
          organizationId: organization.id,
          storeId: activeStore?.id,
        });
        if (res.data) setDocuments(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [organization?.id, activeStore?.id, activeTab, lowStockOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load products and suppliers for document creation
  useEffect(() => {
    if (!organization?.id) return;
    api.products.list({ organizationId: organization.id, limit: 200 }).then((res) => {
      if (res.data) setProducts(res.data);
    });
    api.suppliers.list(organization.id).then((res) => {
      if (res.data) setSuppliers(res.data);
    });
  }, [organization?.id]);

  const handleConfirmDocument = async (id: string) => {
    if (!confirm('Ushbu hujjatni tasdiqlaysizmi? Qoldiqlar darhol yangilanadi.')) return;

    try {
      await api.stockDocuments.confirm(id);
      notifySuccess('Ombor hujjati tasdiqlandi va qoldiqlar yangilandi!');
      loadData();
    } catch (err: any) {
      notifyError(err.message || 'Hujjatni tasdiqlashda xatolik');
    }
  };

  const openNewDocModal = () => {
    setDocType('purchase');
    setDocSupplierId(suppliers[0]?.id || '');
    setDocNote('');
    setDocItems(
      products.length > 0
        ? [{ productId: products[0].id, quantity: 10, unitCost: Number(products[0].costPrice) || 0 }]
        : []
    );
    setIsDocModalOpen(true);
  };

  const handleAddItemRow = () => {
    if (products.length === 0) return;
    setDocItems([
      ...docItems,
      { productId: products[0].id, quantity: 1, unitCost: Number(products[0].costPrice) || 0 },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    setDocItems(docItems.filter((_, i) => i !== index));
  };

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !activeStore?.id) {
      notifyError('Do\'kon tanlanmagan');
      return;
    }
    if (docItems.length === 0) {
      notifyError('Kamida bitta mahsulot qo\'shing');
      return;
    }

    setIsSavingDoc(true);
    try {
      await api.stockDocuments.create({
        organizationId: organization.id,
        storeId: activeStore.id,
        documentType: docType,
        documentNo: `DOC-${Date.now().toString().slice(-6)}`,
        supplierId: docSupplierId || undefined,
        note: docNote || undefined,
        items: docItems.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity) || 1,
          unitCost: Number(item.unitCost) || 0,
        })),
      });

      notifySuccess('Ombor hujjati yaratildi');
      setIsDocModalOpen(false);
      setActiveTab('documents');
      loadData();
    } catch (err: any) {
      notifyError(err.message || 'Hujjatni yaratishda xatolik');
    } finally {
      setIsSavingDoc(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Ombor boshqaruvi
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tovar qoldiqlari, kirim hujjatlari va inventarizatsiya
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/inventory/transfers">
            <Button variant="outline" leftIcon={<FontAwesomeIcon icon={faRightLeft} />}>
              Transferlar
            </Button>
          </Link>

          <Button
            variant="success"
            onClick={openNewDocModal}
            leftIcon={<FontAwesomeIcon icon={faPlus} />}
            className="font-bold shadow-md shadow-emerald-500/20"
          >
            Yangi kirim hujjati
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('balances')}
            className={`pb-3 text-sm font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'balances'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FontAwesomeIcon icon={faBoxesStacked} className="mr-2" />
            Joriy qoldiqlar
          </button>

          <button
            onClick={() => setActiveTab('documents')}
            className={`pb-3 text-sm font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'documents'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FontAwesomeIcon icon={faFileLines} className="mr-2" />
            Hujjatlar (Kirim/Tuzatish)
          </button>
        </div>

        {activeTab === 'balances' && (
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 pb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded-sm text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>Faqat kam qolganlar</span>
          </label>
        )}
      </div>

      {/* Tab Content: Balances */}
      {activeTab === 'balances' && (
        <Card padding={false}>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <LoadingSpinner size="lg" text="Qoldiqlar yuklanmoqda..." />
            </div>
          ) : balances.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <FontAwesomeIcon icon={faWarehouse} className="text-4xl text-gray-300 mb-3" />
              <p className="text-base font-bold text-gray-700">Qoldiqlar mavjud emas</p>
              <p className="text-xs text-gray-400 mt-1">
                Omborga tovar kiritish uchun &quot;Yangi kirim hujjati&quot; tugmasini bosing
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Mahsulot</th>
                    <th className="py-3.5 px-4">SKU / Barkod</th>
                    <th className="py-3.5 px-4 text-center">Birlik</th>
                    <th className="py-3.5 px-4 text-right">Mavjud qoldiq</th>
                    <th className="py-3.5 px-4 text-center">Min. zaxira</th>
                    <th className="py-3.5 px-4 text-center">Holat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {balances.map((b, idx) => {
                    const isLow =
                      Number(b.product?.minStock || 0) > 0 &&
                      Number(b.quantity) <= Number(b.product?.minStock || 0);
                    return (
                      <tr key={idx} className="hover:bg-gray-50/70 transition">
                        <td className="py-3.5 px-4 font-bold text-gray-900">
                          {b.product?.name || 'Mahsulot'}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-gray-500">
                          {b.product?.sku}
                        </td>
                        <td className="py-3.5 px-4 text-center font-medium text-gray-600">
                          {b.product?.unit || 'dona'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-sm text-gray-900">
                          {formatNumber(b.quantity)}
                        </td>
                        <td className="py-3.5 px-4 text-center text-gray-500">
                          {formatNumber(b.product?.minStock || 0)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isLow ? (
                            <Badge variant="danger" size="sm" dot>
                              Kam qolgan
                            </Badge>
                          ) : (
                            <Badge variant="success" size="sm" dot>
                              Yetarli
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
      )}

      {/* Tab Content: Documents */}
      {activeTab === 'documents' && (
        <Card padding={false}>
          {isLoading ? (
            <div className="h-64 flex items-center justify-center">
              <LoadingSpinner size="lg" text="Hujjatlar yuklanmoqda..." />
            </div>
          ) : documents.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <FontAwesomeIcon icon={faFileLines} className="text-4xl text-gray-300 mb-3" />
              <p className="text-base font-bold text-gray-700">Hujjatlar topilmadi</p>
              <p className="text-xs text-gray-400 mt-1">
                Kirim va tuzatish hujjatlari bu yerda ko&apos;rinadi
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Hujjat №</th>
                    <th className="py-3.5 px-4">Turi</th>
                    <th className="py-3.5 px-4">Ta&apos;minotchi</th>
                    <th className="py-3.5 px-4 text-center">Mahsulotlar soni</th>
                    <th className="py-3.5 px-4">Sana</th>
                    <th className="py-3.5 px-4 text-center">Holat</th>
                    <th className="py-3.5 px-4 text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-900">
                        {doc.documentNo}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-gray-700">
                        {doc.documentType === 'purchase'
                          ? 'Kirim (Xarid)'
                          : doc.documentType === 'adjustment'
                          ? 'Tuzatish'
                          : doc.documentType}
                      </td>
                      <td className="py-3.5 px-4 text-gray-700">
                        {doc.supplier?.name || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-gray-800">
                        {doc.items?.length || 0} ta
                      </td>
                      <td className="py-3.5 px-4 text-gray-500">
                        {formatDate(doc.createdAt, true)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {doc.status === 'confirmed' ? (
                          <Badge variant="success" size="sm">
                            Tasdiqlangan
                          </Badge>
                        ) : (
                          <Badge variant="warning" size="sm">
                            Qoralama
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {doc.status === 'draft' && (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleConfirmDocument(doc.id)}
                            leftIcon={<FontAwesomeIcon icon={faCheck} />}
                          >
                            Tasdiqlash
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* New Document Modal */}
      <Modal
        isOpen={isDocModalOpen}
        onClose={() => setIsDocModalOpen(false)}
        title="Yangi ombor hujjati (Kirim)"
        size="xl"
      >
        <form onSubmit={handleSaveDocument} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Hujjat turi"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              options={[
                { value: 'purchase', label: 'Kirim (Xarid)' },
                { value: 'adjustment', label: 'Tuzatish (Inventarizatsiya)' },
              ]}
            />

            <Select
              label="Yetkazib beruvchi (ta'minotchi)"
              value={docSupplierId}
              onChange={(e) => setDocSupplierId(e.target.value)}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              placeholder="Ta'minotchini tanlang (ixtiyoriy)"
            />
          </div>

          <Input
            label="Izoh (ixtiyoriy)"
            placeholder="Hujjat bo'yicha qo'shimcha ma'lumot"
            value={docNote}
            onChange={(e) => setDocNote(e.target.value)}
          />

          {/* Document Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-700">
                Mahsulotlar ro&apos;yxati
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItemRow}
                leftIcon={<FontAwesomeIcon icon={faPlus} />}
              >
                Qator qo&apos;shish
              </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-xl p-3 bg-gray-50">
              {docItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <select
                      value={item.productId}
                      onChange={(e) => {
                        const selProd = products.find((p) => p.id === e.target.value);
                        const updated = [...docItems];
                        updated[idx].productId = e.target.value;
                        if (selProd) {
                          updated[idx].unitCost = Number(selProd.costPrice) || 0;
                        }
                        setDocItems(updated);
                      }}
                      className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-hidden"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <input
                      type="number"
                      placeholder="Miqdor"
                      min="0.1"
                      step="0.1"
                      value={item.quantity}
                      onChange={(e) => {
                        const updated = [...docItems];
                        updated[idx].quantity = parseFloat(e.target.value) || 0;
                        setDocItems(updated);
                      }}
                      className="w-full text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-hidden text-center"
                    />
                  </div>

                  <div className="w-32">
                    <input
                      type="number"
                      placeholder="Tannarx"
                      min="0"
                      step="100"
                      value={item.unitCost}
                      onChange={(e) => {
                        const updated = [...docItems];
                        updated[idx].unitCost = parseFloat(e.target.value) || 0;
                        setDocItems(updated);
                      }}
                      className="w-full text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg p-2 focus:outline-hidden text-right"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveItemRow(idx)}
                    className="p-2 text-gray-400 hover:text-red-600 transition"
                  >
                    <FontAwesomeIcon icon={faTrash} className="text-xs" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDocModalOpen(false)}
              disabled={isSavingDoc}
            >
              Bekor qilish
            </Button>
            <Button
              type="submit"
              variant="success"
              isLoading={isSavingDoc}
              className="font-bold"
            >
              Hujjatni yaratish
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
