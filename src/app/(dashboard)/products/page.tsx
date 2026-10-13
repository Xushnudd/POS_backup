'use client';

import {useListQuery} from '@/hooks/useListQuery';
import {productListSorts} from '@/lib/list-query';
import ListFilter from '@/components/ui/ListFilter';
import Pagination from '@/components/ui/Pagination';
import CsvExportButton from '@/components/ui/CsvExportButton';
import Link from 'next/link';
import React, { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { api } from '@/lib/api';
import { Category, Product } from '@/types';
import { formatMoney, formatNumber } from '@/lib/format';
import { PRODUCT_UNITS } from '@/lib/constants';
import DataTable from '@/components/ui/DataTable';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import CameraBarcodeScanner from '@/components/pos/CameraBarcodeScanner';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faEdit,
  faBoxesStacked,
  faTags,
} from '@fortawesome/free-solid-svg-icons';

export default function ProductsPage() {
  const {organization,user,role}=useAuth();
  return organization&&user?<Suspense fallback={<LoadingSpinner text="Mahsulotlar yuklanmoqda..."/>}><ProductsEditor key={[organization.id,user.id,role].join(':')}/></Suspense>:null;
}

function ProductsEditor() {
  const { organization, role } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [unitOptions,setUnitOptions]=useState(PRODUCT_UNITS);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const {query,params,changeQuery}=useListQuery(productListSorts,'name_asc');
  const searchQuery=query?.search??'',selectedCategory=params.get('categoryId')??'';
  const page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'name_asc',invalidQuery=!query;
  const [totalPages,setTotalPages]=useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError,setLoadError]=useState('');
  const loadSequence=useRef({value:0}),flight=useRef(false),categoryFlight=useRef(false);

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
  const [isCategorySaving,setIsCategorySaving]=useState(false);
  const [baseline,setBaseline]=useState(formData);
  const productDirty=isProductModalOpen&&Object.keys(formData).some(key=>formData[key as keyof typeof formData]!==baseline[key as keyof typeof baseline]);
  const categoryDirty=isCategoryModalOpen&&categoryName.length>0;
  const confirmDiscard=useUnsavedChanges(productDirty||categoryDirty,isSaving||isCategorySaving);
  const closeProduct=()=>{if(confirmDiscard())setIsProductModalOpen(false);};
  const closeCategory=()=>{if(confirmDiscard())setIsCategoryModalOpen(false);};

  const loadData = useCallback(async () => {
    if (!organization?.id||invalidQuery) return;
    const sequence=++loadSequence.current.value;
    setIsLoading(true);setLoadError('');
    try {
      const [prodsRes, catsRes, unitsRes] = await Promise.all([
        api.products.list({
          organizationId: organization.id,
          search: searchQuery || undefined,
          categoryId: selectedCategory || undefined,
          page,limit,sort,
        }),
        api.categories.list(organization.id),
        role!=='cashier'?api.units.list():Promise.resolve({data:[]}),
      ]);

      if(sequence!==loadSequence.current.value)return;
      if (prodsRes.data) {setProducts(prodsRes.data);setTotalPages(prodsRes.pagination?.totalPages??0);}
      if (catsRes.data) setCategories(catsRes.data);
      if (unitsRes.data?.length) setUnitOptions(unitsRes.data.filter(unit=>unit.isActive).map(unit=>({value:unit.code,label:unit.name})));
    } catch (err: unknown) {
      if(sequence===loadSequence.current.value)setLoadError(err instanceof Error?err.message:'Mahsulotlar yuklanmadi');
    } finally {
      if(sequence===loadSequence.current.value)setIsLoading(false);
    }
  }, [organization, searchQuery, selectedCategory, role, page, limit, sort, invalidQuery]);

  useEffect(() => {
    const tracker=loadSequence.current;let cancelled=false;
    void Promise.resolve().then(()=>{if(!cancelled)return loadData();});
    return()=>{cancelled=true;tracker.value++;};
  }, [loadData]);

  const openCreateModal = () => {
    if(!confirmDiscard())return;
    setEditingProduct(null);
    const initial={
      name: '',
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      barcode: `${Math.floor(100000000000 + Math.random() * 900000000000)}`,
      categoryId: categories[0]?.id || '',
      unit: 'dona',
      costPrice: '',
      salePrice: '',
      minStock: '5',
    };setFormData(initial);setBaseline(initial);
    setIsProductModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    if(!confirmDiscard())return;
    setEditingProduct(p);
    const initial={
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      categoryId: p.categoryId || '',
      unit: p.unit || 'dona',
      costPrice: String(p.costPrice),
      salePrice: String(p.salePrice),
      minStock: String(p.minStock),
    };setFormData(initial);setBaseline(initial);
    setIsProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id||flight.current||categoryFlight.current) return;

    if (
      !formData.name ||
      !formData.sku ||
      !formData.barcode ||
      !/^\d+(?:\.\d{1,6})?$/.test(formData.costPrice.trim()) ||
      !/^\d+(?:\.\d{1,2})?$/.test(formData.salePrice.trim())
    ) {
      notifyError('Barcha majburiy maydonlarni to‘ldiring; tannarx va sotuv narxi manfiy bo‘lmagan bo‘lsin');
      return;
    }

    flight.current=true;setIsSaving(true);
    try {
      const payload = {
        organizationId: organization.id,
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        barcode: formData.barcode.trim(),
        categoryId: formData.categoryId || undefined,
        unit: formData.unit,
        costPrice: formData.costPrice.trim(),
        salePrice: formData.salePrice.trim(),
        minStock: formData.minStock.trim() || '0',
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
      flight.current=false;setIsSaving(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id || !categoryName.trim()||categoryFlight.current||flight.current) return;

    categoryFlight.current=true;setIsCategorySaving(true);
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
    } finally {
      categoryFlight.current=false;setIsCategorySaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {loadError&&<div role="alert"><p>{loadError}</p><Button disabled={isLoading} onClick={()=>void loadData()}>Qayta yuklash</Button></div>}
      {organization&&role!=='cashier'&&<CsvExportButton path="/products" params={{organizationId:organization.id,...(searchQuery?{search:searchQuery}:{}),...(selectedCategory?{categoryId:selectedCategory}:{}),sort}} label="Katalogni CSV yuklash"/>}
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Mahsulotlar katalogi
          </h1>
          {role==='owner'&&<Link href="/products/import">CSV / Excel import va eksport</Link>}
          <p className="text-sm text-gray-500 mt-0.5">
            Tovar va xizmatlar narxi, o&apos;lchov birligi va zaxira parametrlari
          </p>
        </div>

        <div className="flex items-center gap-2">
          {role!=='cashier' && <Link href="/products/units" className="text-sm text-blue-700">Birliklar</Link>}
          <Button
            variant="outline"
            disabled={role==='cashier'}
            onClick={() => setIsCategoryModalOpen(true)}
            leftIcon={<FontAwesomeIcon icon={faTags} />}
          >
            Kategoriyalar
          </Button>

          <Button
            variant="primary"
            disabled={role==='cashier'}
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
        <ListFilter search={searchQuery} sort={sort} label="Mahsulot qidirish" placeholder="Nom, SKU yoki barkod bo'yicha qidirish..."
          disabled={isSaving||isCategorySaving} onChange={changeQuery}
          options={[{value:'name_asc',label:'Nom: A–Z'},{value:'name_desc',label:'Nom: Z–A'},{value:'price_asc',label:'Narx: kichikdan kattaga'},{value:'price_desc',label:'Narx: kattadan kichikka'},{value:'sku',label:'SKU bo‘yicha'}]}>
          <CameraBarcodeScanner onDetected={barcode=>changeQuery({search:barcode,page:'1'})}/>
          <Select label="Kategoriya filtri" value={selectedCategory} disabled={isSaving||isCategorySaving}
            options={[{value:'',label:'Barcha kategoriyalar'},...categories.map(c=>({value:c.id,label:c.name}))]}
            onChange={event=>changeQuery({categoryId:event.target.value,page:'1'})}/>
        </ListFilter>
      </Card>

      {/* Products Table */}
      <Card padding={false}>
        {invalidQuery ? <div role="alert" className="p-6">URL dagi filtr yoki sahifa noto‘g‘ri. Filtrlarni tozalang.</div>
        :loadError ? <div className="p-6">Ro‘yxat yuklanmadi. Qayta yuklash orqali urinib ko‘ring.</div>
        :isLoading ? (
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
            <DataTable>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Mahsulot</th>
                  <th className="py-3.5 px-4">SKU / Barkod</th>
                  <th className="py-3.5 px-4">Kategoriya</th>
                  <th className="py-3.5 px-4">Birlik</th>
                  {role!=='cashier' && <th className="py-3.5 px-4 text-right">Tannarx</th>}
                  <th className="py-3.5 px-4 text-right">Sotuv narxi</th>
                  <th className="py-3.5 px-4 text-center">Min. qoldiq</th>
                  <th className="py-3.5 px-4 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/70 transition">
                    <td className="py-3.5 px-4 font-bold text-gray-900">{p.name}<p><Link href={`/products/${p.id}/variants`} className="text-xs text-blue-700">Variantlar</Link>{role!=='cashier'&&<Link href={`/products/${p.id}/media`} className="ml-2 text-xs text-blue-700">Tavsif / rasm</Link>}{role==='owner'&&<Link href={`/products/${p.id}/compliance`} className="ml-2 text-xs text-blue-700">Tasnif / cheklov</Link>}{role==='owner'&&<Link href={`/products/${p.id}/units`} className="ml-2 text-xs text-blue-700">Birlik nisbati</Link>}</p></td>
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
                    {role!=='cashier' && <td className="py-3.5 px-4 text-right text-gray-500 font-medium">
                      {formatMoney(p.costPrice)}
                    </td>}
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
                        disabled={role==='cashier'}
                        onClick={() => openEditModal(p)}
                        leftIcon={<FontAwesomeIcon icon={faEdit} />}
                      >
                        Tahrirlash
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </div>
        )}
      </Card>

      {!invalidQuery&&!loadError&&<Pagination page={page} pages={totalPages} busy={isLoading||isSaving||isCategorySaving} onPage={value=>changeQuery({page:String(value)})}/>}
      {!invalidQuery&&!isLoading&&!loadError&&page>Math.max(1,totalPages)&&<Button onClick={()=>changeQuery({page:'1'})}>Birinchi sahifaga qaytish</Button>}
      {/* Product Form Modal */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={closeProduct}
        title={editingProduct ? 'Mahsulotni tahrirlash' : 'Yangi mahsulot qo\'shish'}
        size="lg"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          {productDirty&&<p role="status">Saqlanmagan mahsulot o‘zgarishlari bor.</p>}
          <fieldset disabled={isSaving||isCategorySaving} className="space-y-4">
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
                disabled={isSaving||isCategorySaving}
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
              options={unitOptions}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Tannarx (so'm) *"
              type="number"
              min="0"
              step="0.000001"
              placeholder="8000"
              value={formData.costPrice}
              disabled={!!editingProduct&&role!=='owner'}
              onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
              required
            />

            <Input
              label="Sotuv narxi (so'm) *"
              type="number"
              min="0"
              step="0.01"
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
              step="0.000001"
              value={formData.minStock}
              onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
              helperText="Kam qolganda ogohlantirish"
            />
          </div>
          </fieldset>

          <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={closeProduct}
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
        onClose={closeCategory}
        title="Kategoriyalar boshqaruvi"
        size="md"
      >
        <div className="space-y-4">
          {categoryDirty&&<p role="status">Saqlanmagan kategoriya o‘zgarishlari bor.</p>}
          <form onSubmit={handleCreateCategory} className="flex gap-2">
            <Input
              label="Yangi kategoriya nomi"
              disabled={isCategorySaving||isSaving}
              placeholder="Yangi kategoriya nomi..."
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              required
            />
            <Button
              type="submit"
              isLoading={isCategorySaving}
              disabled={isSaving}
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
