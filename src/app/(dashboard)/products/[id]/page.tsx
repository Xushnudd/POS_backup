'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import ProductBarcodes from '@/components/catalog/ProductBarcodes';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Category, Product, CatalogUnit } from '@/types';
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
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';

const emptyForm={name:'',sku:'',barcode:'',categoryId:'',unit:'dona',costPrice:'',salePrice:'',minStock:''};

export default function ProductDetailPage() {
  const {id}=useParams<{id:string}>();
  const {organization,user,role}=useAuth();
  return organization&&user?<ProductEditor key={[organization.id,user.id,role,id].join(':')} id={id}/>:null;
}

function ProductEditor({id}:{id:string}) {
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

  const router = useRouter();
  const { organization, role } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [product, setProduct] = useState<Product | null>(null);
  const [units,setUnits]=useState<CatalogUnit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved,setSaved]=useState(false);
  const flight=useRef(false);
  const [loadError,setLoadError]=useState('');
  const [revision,setRevision]=useState(0);
  const [barcodeRevision,setBarcodeRevision]=useState(0);
  const [formData,setFormData]=useState(emptyForm);
  const [baseline,setBaseline]=useState(emptyForm);
  const [barcodeState,setBarcodeState]=useState({dirty:false,busy:false});
  const dirty=!!product&&Object.keys(formData).some(key=>formData[key as keyof typeof formData]!==baseline[key as keyof typeof baseline]);
  const confirmDiscard=useUnsavedChanges(role!=='cashier'&&(dirty||barcodeState.dirty),isSaving||barcodeState.busy);

  useEffect(() => {
    if (!id) return;
    let isCancelled = false;

    void Promise.resolve().then(()=>{if(isCancelled)return;setIsLoading(true);setLoadError('');return Promise.all([
      role!=='cashier'?api.units.list():Promise.resolve({data:[]}),
      api.products.get(id),
      organization?.id ? api.categories.list(organization.id) : Promise.resolve({ data: [] }),
    ]);})
      .then((responses) => {
        if (isCancelled||!responses) return;
        const [unitRes,prodRes,catRes]=responses;
        setUnits(unitRes.data??[]);
        if (prodRes.data) {
          const p = prodRes.data;
          setProduct(p);
          const loaded={
            name: p.name,
            sku: p.sku,
            barcode: p.barcode,
            categoryId: p.categoryId || '',
            unit: p.unit || 'dona',
            costPrice: String(p.costPrice),
            salePrice: String(p.salePrice),
            minStock: String(p.minStock),
          };
          setFormData(loaded);setBaseline(loaded);
        }
        if (catRes.data) setCategories(catRes.data);
      })
      .catch((err) => {if(!isCancelled)setLoadError(displayErrorMessage(err,'Mahsulot yuklanmadi'));})
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [id, organization, role,revision]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product||flight.current||barcodeState.busy) return;

    if (!/^\d+(?:\.\d{1,6})?$/.test(formData.costPrice.trim()) || !/^\d+(?:\.\d{1,2})?$/.test(formData.salePrice.trim()) || !/^\d+(?:\.\d{1,6})?$/.test(formData.minStock.trim()||'0')) {
      notifyError('Narx/qoldiq manfiy bo‘lmasin: sotuv narxi ko‘pi bilan 2, tannarx va qoldiq 6 kasr xonali bo‘lsin');
      return;
    }

    flight.current=true;setIsSaving(true);
    try {
      const response=await api.products.update(product.id, {
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        barcode: formData.barcode.trim(),
        categoryId: formData.categoryId || undefined,
        unit: formData.unit,
        costPrice: formData.costPrice.trim(),
        salePrice: formData.salePrice.trim(),
        minStock: formData.minStock.trim()||'0',
      });
      if(response.data)setProduct(response.data);
      setBaseline({...formData});setBarcodeRevision(n=>n+1);setSaved(true);
      notifySuccess('Mahsulot muvaffaqiyatli saqlandi');
      if(!barcodeState.dirty)router.push('/products');
    } catch (err: unknown) {
      notifyError(displayErrorMessage(err,'Xatolik yuz berdi'));
    } finally {
      flight.current=false;setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!product||flight.current||!confirmDiscard()||!confirm('Ushbu mahsulotni o\'chirmoqchimisiz?')) return;
    flight.current=true;setIsSaving(true);
    try {
      await api.products.delete(product.id);
      notifySuccess('Mahsulot o\'chirildi');
      router.push('/products');
    } catch (err: unknown) {
      notifyError(displayErrorMessage(err,'O\'chirishda xatolik'));
    } finally {
      flight.current=false;setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <LoadingSpinner size="lg" text={tr("Mahsulot yuklanmoqda...")} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center">
        {loadError?<><p role="alert" className="mb-4">{uiMessage(loadError)}</p><Button onClick={()=>setRevision(n=>n+1)}>{tr("Qayta yuklash")}</Button></>:<p className="text-gray-500 mb-4">{tr("Mahsulot topilmadi")}</p>}
        <Link href="/products">
          <Button variant="outline">{tr("Mahsulotlarga qaytish")}</Button>
        </Link>
      </div>
    );
  }

  if (role==='cashier') return <div className="space-y-4"><h1 className="text-xl font-bold">{product.name}</h1><p>{product.sku} · {product.unit}</p><ProductBarcodes productId={product.id} readOnly/></div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/products">
            <Button variant="ghost" size="icon" aria-label={tr("Mahsulotlarga qaytish")}>
              <FontAwesomeIcon icon={faArrowLeft} />
            </Button>
          </Link>
          <h1 className="text-2xl font-black text-gray-900">{product.name}</h1>
        </div>

        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          disabled={isSaving||barcodeState.busy}
          leftIcon={<FontAwesomeIcon icon={faTrash} />}
        >
          {tr("O'chirish")}</Button>
      </div>

      <ProductBarcodes key={product.id} productId={product.id} disabled={isSaving} revision={barcodeRevision} onEditStateChange={setBarcodeState}/>
      <Card title={tr("Mahsulot ma'lumotlarini tahrirlash")}>
        <form onSubmit={handleSave} className="space-y-4">
          {dirty&&<p role="status">{tr("Saqlanmagan mahsulot o‘zgarishlari bor.")}</p>}
          {!dirty&&saved&&<p role="status">{tr("Mahsulotning asosiy ma’lumotlari saqlandi.")}</p>}
          <fieldset disabled={isSaving||barcodeState.busy} className="space-y-4">
          <Input
            label={tr("Mahsulot nomi *")}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={tr("SKU (Artikul) *")}
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              required
            />
            <div className="relative">
              <Input
                label={tr("Barkod *")}
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="pr-11"
                required
              />
              <CameraBarcodeScanner
                disabled={isSaving||barcodeState.busy}
                onDetected={(barcode) => setFormData((current) => ({ ...current, barcode }))}
                className="absolute right-1 top-7 p-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label={tr("Kategoriya")}
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Select
              label={tr("O'lchov birligi")}
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              options={units.length?units.filter(unit=>unit.isActive).map(unit=>({value:unit.code,label:unit.name})):PRODUCT_UNITS}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label={tr("Tannarx (so'm) *")}
              type="number" min="0" step="0.000001"
              value={formData.costPrice}
              onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
              required
            />
            <Input
              label={tr("Sotuv narxi (so'm) *")}
              type="number" min="0" step="0.01"
              value={formData.salePrice}
              onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
              required
            />
            <Input
              label={tr("Minimal qoldiq")}
              type="number"
              min="0" step="0.000001"
              value={formData.minStock}
              onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
            />
          </div>
          </fieldset>

          <div className="pt-4 flex justify-end gap-3">
            <Link href="/products">
              <Button type="button" variant="outline" disabled={isSaving}>
                {tr("Bekor qilish")}</Button>
            </Link>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSaving}
              disabled={barcodeState.busy}
              leftIcon={<FontAwesomeIcon icon={faSave} />}
              className="font-bold"
            >
              {tr("Saqlash")}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
