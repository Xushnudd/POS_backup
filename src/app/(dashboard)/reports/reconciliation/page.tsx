'use client'
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {localizeOwnedLabels} from '@/i18n/messages';

import {useTranslation} from '@/context/LocaleContext';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { useOrganization } from '@/context/OrganizationContext'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import {useAuth} from '@/context/AuthContext'
import {useListQuery} from '@/hooks/useListQuery'
import {reconciliationListSorts} from '@/lib/list-query'
import ListFilter from '@/components/ui/ListFilter'
import DataTable from '@/components/ui/DataTable'
import Pagination from '@/components/ui/Pagination'
import Select from '@/components/ui/Select'
const names:Record<string,string>={inventory:'Ombor qoldig‘i',sales:'Savdo va to‘lov',returns:'Qaytarish summasi',shifts:'Yopilgan smena'}
const namesSource=names;
const labels:Record<string,string>={productName:'Mahsulot',receiptNo:'Chek',returnReceiptNo:'Qaytarma chek',expected:'Kutilgan',actual:'Saqlangan',difference:'Farq',itemAmount:'Chek qatorlari jami',paymentAmount:'Original to‘lov jami'}
const labelsSource=labels;
export default function ReconciliationPage(){const {organization,user,role}=useAuth();return <Suspense fallback={<LoadingSpinner/>}><Reconciliation key={[organization?.id,user?.id,role].join(':')}/></Suspense>}
function Reconciliation(){
 const {message:uiMessage}=useTranslation();

 const {locale:mapLocale}=useTranslation();

 const labels=localizeOwnedLabels(labelsSource,mapLocale);

 const names=localizeOwnedLabels(namesSource,mapLocale);

 const {t:tr}=useTranslation();

 const {stores}=useOrganization()
 const {query,params,changeQuery}=useListQuery(reconciliationListSorts,'source')
 const kind=params.get('kind')??'inventory',storeId=params.get('storeId')??'',page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'source',search=query?.search??'',invalidQuery=!query
 const sequence=useRef({value:0})
 const [rows,setRows]=useState<Record<string,unknown>[]>([]),[total,setTotal]=useState(0)
 const [busy,setBusy]=useState(true),[error,setError]=useState('')
 const load=useCallback(async()=>{
  if(invalidQuery)return;const request=++sequence.current.value;setBusy(true);setError('')
  try{const result=await api.reports.reconciliation({kind,storeId:storeId||undefined,page,limit,sort,search});if(request===sequence.current.value){setRows(result.data??[]);setTotal(result.pagination?.total??0)}}
  catch(error){if(request===sequence.current.value)setError(displayErrorMessage(error,'Hisobni tekshirib bo‘lmadi'))}
  finally{if(request===sequence.current.value)setBusy(false)}
 },[kind,storeId,page,limit,sort,search,invalidQuery])
 useEffect(()=>{const requests=sequence.current;let live=true;void Promise.resolve().then(()=>{if(live)return load()});return()=>{live=false;requests.value++}},[load])
 const columns=rows.length?Object.keys(rows[0]).filter(key=>labels[key]):[]
 return <div className="space-y-4">
  <h1 className="text-xl font-bold">{tr("Qoldiq va pul hisobini solishtirish")}</h1>
  <p className="text-sm">{tr("Bu tekshiruv farqlarni ko‘rsatadi. Tarixni avtomatik o‘zgartirmaydi. Sababni tekshirib, vakolatli tuzatish hujjati bilan hal qiling. Harakat hujjatisiz kiritilgan eski boshlang‘ich qoldiq ham farq sifatida chiqadi.")}</p>
  <ListFilter search={search} sort={sort} label={tr("Tekshiruv mahsuloti, chek yoki ID qidirish")} onChange={changeQuery} reset={{kind:'',storeId:''}} options={[{value:'source',label:tr("Asl ketma-ketlik")},{value:'expected_asc',label:tr("Kutilgan qiymat: o‘sish")},{value:'expected_desc',label:tr("Kutilgan qiymat: kamayish")}]}><Select label={tr("Tekshiruv turi")} value={kind} options={Object.entries(names).map(([value,label])=>({value,label}))} onChange={e=>changeQuery({kind:e.target.value,page:'1'})}/><Select label={tr("Filial")} value={storeId} options={[{value:'',label:tr("Vakolatli barcha filiallar")},...stores.map(store=>({value:store.id,label:store.name}))]} onChange={e=>changeQuery({storeId:e.target.value,page:'1'})}/><Button onClick={()=>{void load()}} disabled={busy&&!invalidQuery}>{tr("Qayta tekshirish")}</Button></ListFilter>
  {invalidQuery?<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>:error?<p role="alert" className="text-red-700">{uiMessage(error)}</p>:busy?<LoadingSpinner/>:<>
   <p role="status">{tr("Aniqlangan farqlar:")}{' '}{total}</p>
   {rows.length>0 && <div className="overflow-auto bg-white border rounded-xl"><DataTable className="text-sm"><thead><tr><th className="p-3 text-left">{tr("Filial")}</th>{columns.map(key=><th key={key} className="p-3 text-left">{labels[key]}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={index} className="border-t"><td className="p-3">{stores.find(store=>store.id===row.storeId)?.name??String(row.storeId)}</td>{columns.map(key=><td key={key} className="p-3">{String(row[key]??'—')}</td>)}</tr>)}</tbody></DataTable></div>}
   {!rows.length&&<p>{tr("Tanlangan filtrda tafovut yo‘q.")}</p>}
  </>}
  <Pagination page={page} pages={Math.ceil(total/limit)} busy={busy&&!invalidQuery} blocked={invalidQuery||!!error} onPage={value=>changeQuery({page:String(value)})} retry={()=>{void load()}}/>
 </div>
}
