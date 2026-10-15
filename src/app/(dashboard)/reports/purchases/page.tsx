'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {localizeOwnedLabels} from '@/i18n/messages';

import {useTranslation} from '@/context/LocaleContext';

import {Suspense,useEffect,useState} from 'react';
import {api} from '@/lib/api';
import {useOrganization} from '@/context/OrganizationContext';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import CatalogFilter from '@/components/reports/CatalogFilter';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import CsvExportButton from '@/components/ui/CsvExportButton';
import {useAuth} from '@/context/AuthContext';
import {useListFilters} from '@/hooks/useListFilters';
import {purchaseReportSorts} from '@/lib/list-query';
import ListFilter from '@/components/ui/ListFilter';
import DataTable from '@/components/ui/DataTable';
type Report=NonNullable<Awaited<ReturnType<typeof api.reports.purchases>>['data']>;
const labels:Record<string,string>={eventAt:'Tasdiq sanasi',documentNo:'Hujjat',documentType:'Turi',supplierName:'Yetkazib beruvchi',productName:'Mahsulot',unit:'Birlik',quantity:'Miqdor',unitCost:'Xarid narxi',value:'Qiymat',storeName:'Filial',purchaseQuantity:'Xarid miqdori',reversedQuantity:'Qarshi miqdor',netQuantity:'Sof miqdor',minPrice:'Eng kam narx',maxPrice:'Eng yuqori narx',averagePrice:'Vaznli o‘rtacha',firstPrice:'Birinchi narx',latestPrice:'Oxirgi narx',purchaseValue:'Xarid qiymati',reversalValue:'Qarshi qiymat',netPurchaseValue:'Sof qiymat'};
const labelsSource=labels;
export default function PurchasesReport(){
 const {t:tr}=useTranslation();
const {organization,user,role}=useAuth();return <Suspense fallback={<p>{tr("Yuklanmoqda...")}</p>}><Purchases key={[organization?.id,user?.id,role].join(':')}/></Suspense>;}
function Purchases(){
 const {formatDate}=useTranslation();

 const {message:uiMessage}=useTranslation();

 const {locale:mapLocale}=useTranslation();

 const labels=localizeOwnedLabels(labelsSource,mapLocale);

 const {t:tr}=useTranslation();

 const {stores}=useOrganization();
 const {query,params,filters,changeQuery,replaceQuery}=useListFilters(purchaseReportSorts,'default',['view','from','to','supplierId','productId','storeId']);
 const page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'default',search=query?.search??'',cutoff=params.get('asOf')??'',invalidQuery=!query;
 const [draft,setDraft]=useState({view:params.get('view')??'history',from:params.get('from')??'',to:params.get('to')??'',supplierId:params.get('supplierId')??'',productId:params.get('productId')??'',storeId:params.get('storeId')??''}),[pages,setPages]=useState(0),[report,setReport]=useState<Report|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const filterKey=JSON.stringify(filters);
 useEffect(()=>{let live=true;void Promise.resolve().then(()=>{if(live)setDraft({view:'history',from:'',to:'',supplierId:'',productId:'',storeId:'',...JSON.parse(filterKey)});});return()=>{live=false;};},[filterKey]);
 useEffect(()=>{if(invalidQuery)return;let cancelled=false;void Promise.resolve().then(async()=>{if(cancelled)return;setBusy(true);setError('');try{const result=await api.reports.purchases({...filters,page:String(page),limit:String(limit),sort,search,...(cutoff?{asOf:cutoff}:{})});if(!cancelled){setReport(result.data??null);setPages(result.pagination?.totalPages??0);if(!cutoff&&result.data)replaceQuery({asOf:result.data.meta.asOf});}}catch(error){if(!cancelled){setError(displayErrorMessage(error,'Xarid tahlili yuklanmadi'));}}finally{if(!cancelled)setBusy(false);}});return()=>{cancelled=true;};},[filters,page,limit,sort,search,cutoff,retry,invalidQuery,replaceQuery]);
 const columns=filters.view==='comparison'?['productName','supplierName','unit','purchaseQuantity','reversedQuantity','netQuantity','firstPrice','latestPrice','minPrice','maxPrice','averagePrice','purchaseValue','reversalValue','netPurchaseValue']:['eventAt','documentNo','documentType','supplierName','storeName','productName','unit','quantity','unitCost','value'];
 return <div className="space-y-4"><h1 className="text-2xl font-bold">{tr("Xarid narxlari tahlili")}</h1><p className="text-sm">{tr("Tasdiqlangan xarid, qarshi hujjat, supplier qaytarma va narx creditlari. Narx va miqdor hujjatdagi tarixiy qiymatlardan; nomlar joriy katalogdan. Xarid/qarshi hujjat qiymati 2 kasrga yaxlitlanadi; credit qiymati original bog‘langan credit hujjatidan. Narx creditida fizik miqdor nol. Birliklar orasidagi miqdorlar qo‘shilmaydi. Vaznli o‘rtacha faqat xarid qatorlaridan, qarshi hujjat qiymati alohida. Bu supplier qarzi/to‘lovi hisoboti emas.")}</p>
 <Card><form className="grid sm:grid-cols-3 gap-3" onSubmit={e=>{e.preventDefault();changeQuery({...draft,page:'1',asOf:''});}}><Select label={tr("Xarid tahlili ko‘rinishi")} value={draft.view} onChange={e=>setDraft({...draft,view:e.target.value})} options={[{value:'history',label:tr("Narx tarixi")},{value:'comparison',label:tr("Mahsulot / supplier taqqoslash")}]}/><Input label={tr("Xarid davri boshi")} type="date" value={draft.from} onChange={e=>setDraft({...draft,from:e.target.value})}/><Input label={tr("Xarid davri oxiri")} type="date" value={draft.to} onChange={e=>setDraft({...draft,to:e.target.value})}/><CatalogFilter kind="supplier" value={draft.supplierId} onChange={supplierId=>setDraft({...draft,supplierId})}/><CatalogFilter kind="product" value={draft.productId} onChange={productId=>setDraft({...draft,productId})}/><Select label={tr("Xarid filiali")} value={draft.storeId} onChange={e=>setDraft({...draft,storeId:e.target.value})} options={[{value:'',label:tr("Barcha vakolatli filiallar")},...stores.map(store=>({value:store.id,label:store.name}))]}/><Button type="submit" disabled={busy}>{tr("Xaridni filtrlash")}</Button></form></Card>
 <ListFilter search={search} sort={sort} label={tr("Xarid mahsuloti, supplier yoki hujjat qidirish")} onChange={changeQuery} reset={{view:'',from:'',to:'',supplierId:'',productId:'',storeId:'',asOf:''}} options={[{value:'default',label:tr("Asl ketma-ketlik")},{value:'name_asc',label:tr("Mahsulot: A–Z")},{value:'name_desc',label:tr("Mahsulot: Z–A")},{value:'value_asc',label:tr("Qiymat: o‘sish")},{value:'value_desc',label:tr("Qiymat: kamayish")}]}/>{invalidQuery&&<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>}
 {error&&<p role="alert">{uiMessage(error)}</p>}{busy&&!invalidQuery?<p>{tr("Yuklanmoqda...")}</p>:!error&&!invalidQuery&&report&&<><Card title={tr("Tanlangan filtrning to‘liq yig‘indisi")}><p>{tr("Xarid:")}{' '}{report.summary.purchaseValue} {report.meta.currency}{tr("; qarshi:")}{' '}{report.summary.reversalValue}{tr("; sof:")}{' '}{report.summary.netPurchaseValue}</p><p className="text-xs">{tr("Tasdiq sanasi; eski confirmedAt yo‘q hujjatlar yaratilgan sana bilan alohida belgilanadi. Sana kesimi:")}{' '}{report.meta.asOf}; {report.meta.timezone}{tr(". Bu davomli DB snapshot emas.")}</p></Card><CsvExportButton path="/reports/purchases" params={{...filters,sort,search,asOf:report.meta.asOf}} label={tr("Xarid tahlilini CSV yuklash")}/><div className="overflow-auto"><DataTable className="text-sm"><thead><tr>{columns.map(key=><th className="p-2" key={key}>{labels[key]}</th>)}</tr></thead><tbody>{report.rows.map((row,index)=><tr key={String(row.lineId??index)} className="border-t">{columns.map(key=><td className="p-2" key={key}>{key==='eventAt'?formatDate(String(row[key]),true,report.meta.timezone)+(row.legacyDate?" "+tr("(eski sana)"):''):String(row[key]??'—')}</td>)}</tr>)}</tbody></DataTable>{!report.rows.length&&<p>{tr("Xarid topilmadi.")}</p>}</div></>}
 <Pagination page={page} pages={pages} busy={busy&&!invalidQuery} blocked={invalidQuery||!!error} onPage={value=>changeQuery({page:String(value)})} retry={()=>{changeQuery({asOf:''});setRetry(x=>x+1);}}/></div>;
}
