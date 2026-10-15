'use client'
import {localizeOwnedLabels} from '@/i18n/messages';

import {useTranslation} from '@/context/LocaleContext';

import {useCallback,useState} from 'react'
import {REPORT_EXPORTS} from '@/lib/report-exports'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import DurableMutation from './DurableMutation'
import {useUnsavedChanges,confirmUnsavedChanges} from '@/hooks/useUnsavedChanges'
const filterLabels:Record<string,string>={startDate:'Davr boshi (YYYY-MM-DD)',endDate:'Davr oxiri (YYYY-MM-DD)',from:'Davr boshi (YYYY-MM-DD)',to:'Davr oxiri (YYYY-MM-DD)',asOf:'Hisob holati UTC (ISO sana)',storeId:'Filial ID',fromStoreId:'Jo‘natuvchi filial ID',toStoreId:'Qabul qiluvchi filial ID',supplierId:'Yetkazib beruvchi ID',categoryId:'Kategoriya ID',productId:'Mahsulot ID',registerId:'Kassa ID',search:'Qidiruv',barcode:'Asosiy barkod',identifier:'SKU yoki barkod',lowStock:'Faqat kam qoldiq (true/false)',inactiveDays:'Savdosiz kunlar',status:'Holat',dimension:'Kesim (product/category/cashier/store/payment)',view:'Ko‘rinish',disposition:'Yo‘nalish (damaged/write_off)',movementType:'Harakat turi',sourceType:'Manba turi',sourceId:'Manba ID',entityType:'Resurs turi',entityId:'Resurs ID',actorId:'Xodim ID',action:'Amal',documentType:'Hujjat turi',field:'Narx maydoni'}
const filterLabelsSource=filterLabels;
export default function ReportExportFields({reason,onDone,ready=true,onSavingChange}:{reason:string;revision:number;ready?:boolean;onSavingChange?:(value:boolean)=>void;onDone:(result?:unknown,original?:Record<string,unknown>)=>void}){
 const {locale:mapLocale}=useTranslation();

 const filterLabels=localizeOwnedLabels(filterLabelsSource,mapLocale);

 const {t:tr}=useTranslation();

 const [report,setReport]=useState<keyof typeof REPORT_EXPORTS>('reports-sales'),[format,setFormat]=useState('csv'),[filters,setFilters]=useState<Record<string,string>>({})
 const [saving,setSaving]=useState(false);const changed=useCallback((value:boolean)=>{setSaving(value);onSavingChange?.(value);},[onSavingChange]);
 const rawDirty=Object.values(filters).some(value=>value!=='')||format!=='csv'||report!=='reports-sales';useUnsavedChanges(rawDirty,saving);
 const body={type:'report_export',report:{report,format,filters:Object.fromEntries(Object.entries(filters).filter(([,value])=>value.trim()).map(([key,value])=>[key,value.trim()]))},reason};
 return <section aria-label={tr("Hisobot eksporti")} className="space-y-3"><DurableMutation path="/jobs" returnPath="/jobs" body={body} canSubmit={ready} onSavingChange={changed} label={tr("Hisobot eksportini navbatga qo‘yish")} review={[REPORT_EXPORTS[report].label,format,...Object.entries(filters).filter(([,value])=>value.trim()).map(([key,value])=>(filterLabels[key]??key)+': '+value),reason]} onDone={(result,original)=>{if(JSON.stringify(original)===JSON.stringify(body)){setFilters({});setFormat('csv');setReport('reports-sales');}onDone(result,original)}}><Select label={tr("Eksport hisoboti")} value={report} options={Object.entries(REPORT_EXPORTS).map(([value,item])=>({value,label:item.label}))} onChange={e=>{if(e.target.value===report||!confirmUnsavedChanges(Object.values(filters).some(value=>value!==''),saving,'Joriy hisobot filtrlarini almashtirishni tasdiqlaysizmi?'))return;setReport(e.target.value as keyof typeof REPORT_EXPORTS);setFilters({});}}/><Select label={tr("Hisobot fayli formati")} value={format} options={[{value:'csv',label:'CSV'},{value:'xlsx',label:tr("Excel XLSX")},{value:'pdf',label:tr("PDF uchun chop etish")}]} onChange={e=>setFormat(e.target.value)}/><p>{tr("Bo‘sh filtrlar cheklov qo‘ymaydi. Eksport sahifadagi qatorlar bilan chegaralanmaydi. Eng ko‘pi 10000 natija va 16MiB; chegara oshsa qisman fayl berilmaydi. Tayyor fayl 24 soat saqlanadi.")}</p>{format==='pdf'&&<p>{tr("Chop etish hujjatini yuklab, brauzerda oching: Ctrl+P → PDF sifatida saqlash. Barcha qatorlar chiqariladi.")}</p>}{REPORT_EXPORTS[report].filters.map(key=><Input key={key} label={filterLabels[key]??key} value={filters[key]??''} onChange={e=>setFilters(previous=>({...previous,[key]:e.target.value}))}/>)}</DurableMutation></section>
}
