'use client';

import {useListQuery} from '@/hooks/useListQuery';
import {customerListSorts} from '@/lib/list-query';
import ListFilter from '@/components/ui/ListFilter';
import Pagination from '@/components/ui/Pagination';
import CsvExportButton from '@/components/ui/CsvExportButton';
import Link from 'next/link';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import {useAcknowledgedMutation} from '@/hooks/useAcknowledgedMutation';
import React, { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { fixed } from '@/lib/money';
import { api } from '@/lib/api';
import { Customer } from '@/types';
import { formatMoney, formatPhone } from '@/lib/format';
import DataTable from '@/components/ui/DataTable';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers,
  faUserPlus,
  faHandHoldingDollar,
  faPhone,
  faEdit,
} from '@fortawesome/free-solid-svg-icons';

export default function CustomersPage(){const {organization,user,role}=useAuth();return organization&&user&&role?<Suspense fallback={<LoadingSpinner text="Mijozlar yuklanmoqda..."/>}><Customers key={[organization.id,user.id,role].join(':')}/></Suspense>:null;}
function Customers() {
  const { organization,role } = useAuth();
  const { notifySuccess, notifyError } = useNotification();

  const [customers, setCustomers] = useState<(Customer&{debtUnavailable?:boolean})[]>([]);
  const {query,changeQuery}=useListQuery(customerListSorts,'name_asc');
  const searchQuery=query?.search??'',page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'name_asc',invalidQuery=!query;
  const [totalPages,setTotalPages]=useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Add / Edit Modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    address: '',
    note: '',
    creditLimit: '0',
  });
  const [readError,setReadError]=useState(''),[debtError,setDebtError]=useState('');
  const readRequest=useRef({value:0});
  const mutation=useAcknowledgedMutation(!isLoading&&!readError&&!invalidQuery),isSaving=mutation.saving;
  const [originalForm,setOriginalForm]=useState(formData);
  const dirty=isCustomerModalOpen&&(Object.keys(formData) as (keyof typeof formData)[]).some(key=>formData[key]!==originalForm[key]);
  const confirmDiscard=useUnsavedChanges(dirty,isSaving);
  const closeEditor=()=>{if(confirmDiscard())setIsCustomerModalOpen(false);};

  const loadCustomers = useCallback(async () => {
    if (!organization?.id||invalidQuery) return;
    const request=++readRequest.current.value;setIsLoading(true);
    try {
      const res = await api.customers.list({
        organizationId: organization.id,
        search: searchQuery || undefined,
        page,limit,sort,
      });

      if(!res.data)throw new Error('Mijozlar natijasi mavjud emas');
      if (res.data) {
        // Also load debts for each customer
        const customersWithDebt = await Promise.all(
          res.data.map(async (c) => {
            try {
              const debtRes = await api.customers.getDebt(c.id);
              if(debtRes.data?.totalDebt===undefined)throw new Error('Qarz natijasi mavjud emas');
              const debt=String(debtRes.data.totalDebt);fixed(debt);return {...c,debt,debtUnavailable:false};
            } catch {
              return {...c,debtUnavailable:true};
            }
          })
        );
        if(request===readRequest.current.value){setCustomers(customersWithDebt);setTotalPages(res.pagination?.totalPages??0);setReadError('');setDebtError(customersWithDebt.some(row=>row.debtUnavailable)?'Ba’zi mijozlarning qarzi yuklanmadi; noma’lum qiymat nol deb ko‘rsatilmaydi.':'');}
      }
    } catch (err: unknown) {
      if(request===readRequest.current.value)setReadError(err instanceof Error?err.message:'Mijozlar yuklanmadi');
    } finally {
      if(request===readRequest.current.value)setIsLoading(false);
    }
  }, [organization, searchQuery, page, limit, sort, invalidQuery]);

  useEffect(() => {
    const tracker=readRequest.current;let cancelled=false;
    void Promise.resolve().then(()=>{if(!cancelled)return loadCustomers();});
    return()=>{cancelled=true;tracker.value++;};
  }, [loadCustomers]);

  const openCreateModal = () => {
    if(!confirmDiscard())return;
    setOriginalForm({fullName:'',phone:'',address:'',note:'',creditLimit:'1000000'});
    setEditingCustomer(null);
    setFormData({
      fullName: '',
      phone: '',
      address: '',
      note: '',
      creditLimit: '1000000',
    });
    setIsCustomerModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    if(!confirmDiscard())return;
    setOriginalForm({fullName:c.fullName,phone:c.phone,address:c.address||'',note:c.note||'',creditLimit:String(c.creditLimit||0)});
    setEditingCustomer(c);
    setFormData({
      fullName: c.fullName,
      phone: c.phone,
      address: c.address || '',
      note: c.note || '',
      creditLimit: String(c.creditLimit || 0),
    });
    setIsCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id||isSaving) return;

    if (!formData.fullName || !formData.phone) {
      notifyError('Ism va telefon raqamini kiriting');
      return;
    }

    await mutation.execute(async()=>{
      const payload = {
        organizationId: organization.id,
        fullName: formData.fullName.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim() || undefined,
        note: formData.note.trim() || undefined,
        creditLimit: formData.creditLimit.trim()||'0',
      };

      if (editingCustomer) {
        await api.customers.update(editingCustomer.id, payload);
        notifySuccess('Mijoz ma\'lumotlari yangilandi');
      } else {
        await api.customers.create(payload);
        notifySuccess('Yangi mijoz muvaffaqiyatli qo\'shildi');
      }

    },()=>{setIsCustomerModalOpen(false);void loadCustomers();});
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {(readError||debtError)&&<p role="alert">{readError||debtError}. Oxirgi ro‘yxat va draft saqlangan.</p>}<Button disabled={isLoading||isSaving} onClick={()=>void loadCustomers()}>Mijozlarni qayta yuklash</Button>{mutation.error&&<p role="alert">{mutation.error}</p>}{isSaving&&<p role="status">Server tasdig‘i kutilmoqda…</p>}{mutation.state==='saved'&&<p role="status">Mijoz serverda saqlandi.</p>}
      {role==='owner'&&<Link href="/customers/duplicates" className="text-blue-700 underline">Legacy telefon dublikatlarini tekshirish</Link>}
      {organization&&role==='owner'&&<CsvExportButton path="/customers" params={{organizationId:organization.id,...(searchQuery?{search:searchQuery}:{}),sort}} label="Mijozlarni CSV yuklash"/>}
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Mijozlar va Nasiya
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Doimiy xaridorlar ro&apos;yxati, kredit limitlari va qarzdorlik nazorati
          </p>
        </div>

        <Button
          variant="primary"
          disabled={isLoading||isSaving||!!readError}
          onClick={openCreateModal}
          leftIcon={<FontAwesomeIcon icon={faUserPlus} />}
          className="font-bold shadow-md shadow-blue-500/20"
        >
          Yangi mijoz qo&apos;shish
        </Button>
      </div>

      {/* Search bar */}
      <Card padding={false} className="p-4">
        <ListFilter search={searchQuery} sort={sort} label="Mijoz qidirish" placeholder="Mijoz ismi yoki telefon raqami bo'yicha qidirish..."
          disabled={isSaving} onChange={changeQuery}
          options={[{value:'name_asc',label:'Nom: A–Z'},{value:'name_desc',label:'Nom: Z–A'},{value:'newest',label:'Yangi mijozlar avval'},{value:'oldest',label:'Eski mijozlar avval'}]}/>

      </Card>

      {/* Customers Table */}
      <Card padding={false}>
        {invalidQuery ? <div role="alert" className="p-6">URL dagi filtr yoki sahifa noto‘g‘ri. Filtrlarni tozalang.</div>
        :readError ? <div className="p-6">Ro‘yxat yuklanmadi. Oxirgi ma’lumot asosida amal bajarmang; qayta yuklang.</div>
        :isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <LoadingSpinner size="lg" text="Mijozlar yuklanmoqda..." />
          </div>
        ) : customers.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-gray-400">
            <FontAwesomeIcon icon={faUsers} className="text-4xl text-gray-300 mb-3" />
            <p className="text-base font-bold text-gray-700">Mijozlar topilmadi</p>
            <p className="text-xs text-gray-400 mt-1">
              Yangi mijoz qo&apos;shish uchun yuqoridagi tugmani bosing
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <DataTable>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Mijoz</th>
                  <th className="py-3.5 px-4">Telefon</th>
                  <th className="py-3.5 px-4">Manzil</th>
                  <th className="py-3.5 px-4 text-right">Kredit limiti</th>
                  <th className="py-3.5 px-4 text-right">Joriy qarz</th>
                  <th className="py-3.5 px-4 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((c) => {
                  const hasDebt = !c.debtUnavailable&&fixed(c.debt ?? '0') > BigInt(0);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3.5 px-4 font-bold text-gray-900"><Link className="text-blue-700 underline" href={`/customers/${c.id}`}>{c.fullName}</Link><br/><Link className="text-blue-700 underline" href={`/customers/${c.id}/history`}>Xarid tarixi va merge</Link></td>
                      <td className="py-3.5 px-4 text-gray-700 font-mono">
                        {formatPhone(c.phone)}
                      </td>
                      <td className="py-3.5 px-4 text-gray-500">{c.address || '-'}</td>
                      <td className="py-3.5 px-4 text-right font-medium text-gray-600">
                        {formatMoney(c.creditLimit)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {c.debtUnavailable?<span>Qarz yuklanmadi</span>:hasDebt ? (
                          <span className="font-black text-red-600">
                            {formatMoney(c.debt)}
                          </span>
                        ) : (
                          <span className="text-gray-400">{fixed(c.debt??'0')<BigInt(0)?'Avans (net qoldiq): '+formatMoney(c.debt):"0 so‘m"}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1">
                        {hasDebt && (
                          <Link href={`/customers/${c.id}?collect=1`} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-white font-bold">
                            <FontAwesomeIcon icon={faHandHoldingDollar} /> Qarzni undirish
                          </Link>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isSaving||isLoading||!!readError}
                          onClick={() => openEditModal(c)}
                          leftIcon={<FontAwesomeIcon icon={faEdit} />}
                        >
                          Tahrirlash
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </div>
        )}
      </Card>

      {!invalidQuery&&!readError&&<Pagination page={page} pages={totalPages} busy={isLoading||isSaving} onPage={value=>changeQuery({page:String(value)})}/>}
      {!invalidQuery&&!isLoading&&!readError&&page>Math.max(1,totalPages)&&<Button onClick={()=>changeQuery({page:'1'})}>Birinchi sahifaga qaytish</Button>}
      {/* Customer Form Modal */}
      <Modal
        isOpen={isCustomerModalOpen}
        onClose={closeEditor}
        title={editingCustomer ? 'Mijozni tahrirlash' : 'Yangi mijoz qo\'shish'}
        size="md"
      >
        <form onChangeCapture={mutation.edited} onSubmit={handleSaveCustomer} className="space-y-4">
          {dirty&&<p role="status">Saqlanmagan mijoz o‘zgarishlari bor.</p>}
          <Input
            label="Mijoz to'liq ismi *"
            placeholder="Jamshid Ergashev"
            disabled={isSaving||isLoading||!!readError}
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            required
          />

          <Input
            label="Telefon raqami *"
            type="tel"
            placeholder="901234567"
            disabled={isSaving||isLoading||!!readError}
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            leftIcon={<FontAwesomeIcon icon={faPhone} className="text-xs" />}
            required
          />

          <Input
            label="Manzil"
            placeholder="Toshkent sh., Yunusobod tumani"
            disabled={isSaving||isLoading||!!readError}
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <Input
            label="Maksimal nasiya / kredit limiti (so'm)"
            type="number"
            min="0"
            step="0.01"
            placeholder="1000000"
            disabled={isSaving||isLoading||!!readError}
            value={formData.creditLimit}
            onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
            helperText="Mijozga berilishi mumkin bo'lgan maksimal qarz miqdori"
          />

          <Input
            label="Izoh (ixtiyoriy)"
            placeholder="Mijoz haqida qo'shimcha eslatma"
            disabled={isSaving||isLoading||!!readError}
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          />

          <div className="pt-3 flex justify-end gap-3 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={closeEditor}
              disabled={isSaving||isLoading||!!readError}
            >
              Bekor qilish
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving} disabled={isSaving||isLoading||!!readError} className="font-bold">
              {editingCustomer ? 'Saqlash' : 'Qo\'shish'}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}
