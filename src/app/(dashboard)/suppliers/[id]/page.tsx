'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import {useListFilters} from '@/hooks/useListFilters';
import {journalListSorts} from '@/lib/list-query';
import DataTable from '@/components/ui/DataTable';
import ListFilter from '@/components/ui/ListFilter';
import PurchaseOrders from '@/components/suppliers/PurchaseOrders';
import SupplierLedger from '@/components/suppliers/SupplierLedger';
import { useEffect,useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import type { Supplier,StockDocument } from '@/types';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import CsvExportButton from '@/components/ui/CsvExportButton';
const purchaseFields=['from','to','storeId','status'] as const;
type Totals=NonNullable<Awaited<ReturnType<typeof api.suppliers.totals>>['data']>;
export default function SupplierPage(){
 const {t:tr}=useTranslation();
const {organization,user,role}=useAuth(),{id}=useParams<{id:string}>();return organization&&user&&role&&role!=='cashier'?<SupplierContent key={[organization.id,user.id,role,id].join(':')}/>:<p>{tr("Supplier kartasi uchun rahbar vakolati kerak.")}</p>;}
function SupplierContent(){
 const {status:codeLabel}=useTranslation();

 const {formatDate}=useTranslation();

 const {message:uiMessage}=useTranslation();

 const {formatMoney}=useTranslation();

 const {t:tr}=useTranslation();

 const {id}=useParams<{id:string}>(),{organization,role}=useAuth();
 const {query,filters,changeQuery}=useListFilters(journalListSorts,'newest',purchaseFields,'purchases_');
 const page=query?.page??1,limit=query?.limit??20,search=query?.search??'',sort=query?.sort??'newest',invalid=!query;
 const [supplier,setSupplier]=useState<Supplier|null>(null),[rows,setRows]=useState<StockDocument[]>([]),[totals,setTotals]=useState<Totals|null>(null),[pages,setPages]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [draft,setDraft]=useState({from:filters.from??'',to:filters.to??'',storeId:filters.storeId??'',status:filters.status??''});
 useEffect(()=>{void Promise.resolve().then(()=>setDraft({from:filters.from??'',to:filters.to??'',storeId:filters.storeId??'',status:filters.status??''}))},[filters]);
 useEffect(()=>{if(!organization||!role||role==='cashier'||invalid)return;let cancelled=false;void Promise.resolve().then(async()=>{if(cancelled)return;setBusy(true);setError('');setRows([]);setTotals(null);try{const summaryFilters=Object.fromEntries(Object.entries(filters).filter(([key])=>['from','to','storeId'].includes(key)));const [card,history,summary]=await Promise.all([api.suppliers.get(id),api.suppliers.purchases(id,{...filters,page:String(page),limit:String(limit),sort,search}),api.suppliers.totals(id,summaryFilters)]);if(!cancelled){setSupplier(card.data??null);setRows(history.data??[]);setPages(history.pagination?.totalPages??0);setTotals(summary.data??null);}}catch(error){if(!cancelled)setError(displayErrorMessage(error,'Supplier kartasi yuklanmadi'));}finally{if(!cancelled)setBusy(false);}});return()=>{cancelled=true;};},[id,organization,role,page,limit,sort,search,filters,retry,invalid]);
 if(!organization||!role||role==='cashier')return <p>{tr("Supplier kartasi uchun rahbar vakolati kerak.")}</p>;
 return <div className="space-y-4"><h1 className="text-2xl font-bold">{tr("Yetkazib beruvchi kartasi")}</h1><Link href="/suppliers" className="text-blue-700">{tr("Ro‘yxatga qaytish")}</Link>{error&&<p role="alert">{uiMessage(error)}</p>}
 {supplier&&<Card title={supplier.name}><dl className="grid sm:grid-cols-2 gap-2"><div><dt>{tr("Telefon")}</dt><dd>{supplier.phone??'—'}</dd></div><div><dt>{tr("STIR")}</dt><dd>{supplier.tin??'—'}</dd></div><div><dt>{tr("Manzil")}</dt><dd>{supplier.address??'—'}</dd></div><div><dt>{tr("Holat")}</dt><dd>{supplier.isActive?tr("Faol"):tr("Arxivlangan")}</dd></div></dl><div className="space-y-2"><p>{tr("Bank:")}{' '}{supplier.bankName||tr("Kiritilmagan")}</p><p>{tr("Hisob raqami:")}{' '}{supplier.bankAccount||tr("Kiritilmagan")}</p><p className="whitespace-pre-wrap">{tr("To‘lov va yetkazish shartlari:")}{' '}{supplier.paymentTerms||tr("Kiritilmagan")}</p><p className="whitespace-pre-wrap">{supplier.note}</p></div></Card>}
 {supplier&&<PurchaseOrders supplierId={id} onPosted={()=>setRetry(v=>v+1)}/>}
 {supplier&&<SupplierLedger key={organization.id+':'+id+':'+role} id={id} documents={rows} version={retry}/>}
 <Card><form className="grid sm:grid-cols-2 gap-3" onSubmit={e=>{e.preventDefault();changeQuery({...draft,page:'1'});}}><Input label={tr("Davr boshi")} type="date" value={draft.from} onChange={e=>setDraft({...draft,from:e.target.value})}/><Input label={tr("Davr oxiri")} type="date" value={draft.to} onChange={e=>setDraft({...draft,to:e.target.value})}/><Input label={tr("Filial ID")} value={draft.storeId} onChange={e=>setDraft({...draft,storeId:e.target.value})}/><Select label={tr("Hujjat holati")} value={draft.status} options={[{value:'',label:tr("Barchasi")},{value:'draft',label:tr("Qoralama")},{value:'confirmed',label:tr("Tasdiqlangan")}]} onChange={e=>setDraft({...draft,status:e.target.value})}/><Button type="submit" disabled={busy&&!invalid}>{tr("Filtrlash")}</Button></form></Card>
 {totals&&!busy&&!error&&<Card title={tr("Tasdiqlangan xarid hujjatlari qiymati")}><p className="text-xs mb-3">{tr("Sana/filial filtri va hujjat yaratilgan vaqti bo‘yicha. Ro‘yxatning holat/raqam filtri bu yig‘indiga ta’sir qilmaydi. Har qator qiymati 2 kasrga yaxlitlanib yig‘iladi. Supplierga to‘langan pul yoki qarz hisobi emas; qoralama va boshqa tuzatish turlari kirmaydi.")}</p><div className="grid sm:grid-cols-3 gap-3"><p>{tr("Xarid:")}{' '}{formatMoney(totals.purchaseValue).replace(/ so‘m$/,'')} {totals.currency}<br/>{totals.purchases} {tr("hujjat")}</p><p>{tr("Qarshi xarid:")}{' '}{formatMoney(totals.reversalValue).replace(/ so‘m$/,'')} {totals.currency}<br/>{totals.reversals} {tr("hujjat")}</p><p>{tr("Sof xarid qiymati:")}{' '}{formatMoney(totals.netPurchaseValue).replace(/ so‘m$/,'')} {totals.currency}</p></div></Card>}
 <ListFilter search={search} sort={sort} label={tr("Supplier kirim hujjati raqami qidirish")} onChange={changeQuery} reset={{from:'',to:'',storeId:'',status:''}} options={[{value:'newest',label:tr("Yangi → eski")},{value:'oldest',label:tr("Eski → yangi")}]}/>{invalid&&<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>}
 <CsvExportButton path="/stock-documents" label={tr("Supplier tarixini CSV yuklash")} params={{organizationId:organization.id,supplierId:id,...filters,search,sort}}/>
 <Card title={tr("Ombor hujjatlari tarixi")}>{busy&&!invalid?<p role="status">{tr("Yuklanmoqda...")}</p>:!error&&!invalid?<><div className="overflow-auto"><DataTable className="w-full text-sm"><thead><tr><th>{tr("Hujjat / sana")}</th><th>{tr("Filial")}</th><th>{tr("Turi / holat")}</th><th>{tr("Qatorlar")}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t"><td className="p-2">{row.documentNo}<p className="text-xs">{formatDate(row.createdAt,true,organization.timezone)}</p><p className="text-xs">{row.reversalOfId&&tr("Asl: {value1}",{value1:String(row.reversalOfId)})}{row.reversal&&tr("Qarshi: {value1}",{value1:String(row.reversal.documentNo)})}</p></td><td>{row.store?.name}</td><td>{row.documentType}<p>{codeLabel(row.status)}</p></td><td>{row.items?.map(item=><p key={item.id}>{item.product?.name}: {String(item.quantity)} {item.product?.unit} × {String(item.unitCost)}</p>)}</td></tr>)}</tbody></DataTable>{!rows.length&&<p>{tr("Hujjat topilmadi.")}</p>}</div></>:null}<Pagination page={page} pages={pages} busy={busy&&!invalid} blocked={invalid||!!error} onPage={value=>changeQuery({page:String(value)})} retry={()=>setRetry(x=>x+1)}/></Card></div>;
}
