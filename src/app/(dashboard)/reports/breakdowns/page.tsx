'use client';
import {localizeOwnedLabels} from '@/i18n/messages';

import {useTranslation} from '@/context/LocaleContext';

import {Suspense,useEffect,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {api} from '@/lib/api';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import CsvExportButton from '@/components/ui/CsvExportButton';
import {useListFilters} from '@/hooks/useListFilters';
import {breakdownReportSorts} from '@/lib/list-query';
import ListFilter from '@/components/ui/ListFilter';
import DataTable from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
type Row={id:string;name:string;quantity:string|null;revenue:string;cost:string|null;grossProfit:string|null};
type Totals={netSales:string;quantity:string|null;cogs:string|null;grossProfit:string|null};
const labels:Record<string,string>={product:'Mahsulot',category:'Kategoriya',cashier:'Kassir',store:'Filial',payment:'To‘lov turi',cash:'Naqd',card:'Karta',transfer:'Bank',credit:'Nasiya'};
const labelsSource=labels;
export default function Page(){
 const {t:tr}=useTranslation();
const {organization,user,role}=useAuth();return organization&&user&&role&&role!=='cashier'?<Suspense fallback={<p>{tr("Yuklanmoqda...")}</p>}><Breakdowns key={organization.id+':'+user.id+':'+role}/></Suspense>:<p>{tr("Hisobot uchun rahbar vakolati kerak.")}</p>;}
function Breakdowns(){
 const {locale:mapLocale}=useTranslation();

 const labels=localizeOwnedLabels(labelsSource,mapLocale);

 const {t:tr}=useTranslation();

 const {query,params,filters,changeQuery,replaceQuery}=useListFilters(breakdownReportSorts,'revenue_desc',['startDate','endDate','storeId']);
 const page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'revenue_desc',search=query?.search??'',dimension=params.get('dimension')??'store',asOf=params.get('asOf')??'',invalidQuery=!query;
 const [start,setStart]=useState(params.get('startDate')??''),[end,setEnd]=useState(params.get('endDate')??''),[pages,setPages]=useState(0),[rows,setRows]=useState<Row[]>([]),[summary,setSummary]=useState<Totals|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[revision,setRevision]=useState(0);
 const filterKey=JSON.stringify(filters);
 useEffect(()=>{let live=true;void Promise.resolve().then(()=>{const parsed=JSON.parse(filterKey);if(live){setStart(parsed.startDate??'');setEnd(parsed.endDate??'');}});return()=>{live=false;};},[filterKey]);
 useEffect(()=>{if(invalidQuery)return;let cancelled=false;void Promise.resolve().then(async()=>{if(cancelled)return;setBusy(true);setError('');try{const response=await api.request<Row[],Totals>('/reports/breakdowns?'+new URLSearchParams({...filters,dimension,page:String(page),limit:String(limit),sort,search,...asOf?{asOf}:{}}));if(!cancelled){setRows(response.data??[]);setSummary(response.summary??null);setPages(response.pagination?.totalPages??0);if(!asOf&&response.meta?.asOf)replaceQuery({asOf:response.meta.asOf});}}catch(e){if(!cancelled){setError(e instanceof Error?e.message:'Hisobot yuklanmadi');}}finally{if(!cancelled)setBusy(false);}});return()=>{cancelled=true;};},[filters,dimension,page,limit,sort,search,asOf,revision,invalidQuery,replaceQuery]);
 return <div className="space-y-4"><h1 className="text-2xl font-bold">{tr("Savdo kesimlari")}</h1><p>{tr("Sof savdo: davrdagi yakunlangan savdolar − davrdagi qaytarmalar. Kategoriya mahsulotning joriy kategoriyasidir. Kassir kesimida qaytarma original savdo kassiriga tegishli. To‘lov kesimi original savdo to‘lovlari va qaytarish kanallarini jamlaydi; keyingi qarz undirish, qo‘lda naqd va ichki o‘tkazmalar kirmaydi. Bu pul oqimi hisoboti emas; kanalning sof summasi manfiy bo‘lishi mumkin.")}</p>
 <Card><form className="space-y-3" onSubmit={e=>{e.preventDefault();changeQuery({startDate:start,endDate:end,page:'1',asOf:''});}}><Input label={tr("Kesim davri boshi")} type="date" value={start} onChange={e=>setStart(e.target.value)}/><Input label={tr("Kesim davri oxiri")} type="date" value={end} onChange={e=>setEnd(e.target.value)}/><Button type="submit">{tr("Davrni qo‘llash")}</Button></form><label>{tr("Kesim")}{' '}<select aria-label={tr("Savdo kesimi")} value={dimension} onChange={e=>{changeQuery({dimension:e.target.value,page:'1'});}}>{['product','category','cashier','store','payment'].map(d=><option key={d} value={d}>{labels[d]}</option>)}</select></label><Button onClick={()=>{changeQuery({asOf:'',page:'1'});setRevision(n=>n+1);}}>{tr("Yangi holatni yuklash")}</Button></Card>
 <ListFilter search={search} sort={sort} label={tr("Kesim nomi yoki IDsi qidirish")} onChange={changeQuery} reset={{startDate:'',endDate:'',dimension:'',storeId:'',asOf:''}} options={[{value:'revenue_desc',label:tr("Sof savdo: kamayish")},{value:'revenue_asc',label:tr("Sof savdo: o‘sish")},{value:'name_asc',label:tr("Nom: A–Z")},{value:'name_desc',label:tr("Nom: Z–A")}]}/>{invalidQuery&&<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>}
 {error&&<p role="alert">{error}</p>}{busy&&!invalidQuery?<p>{tr("Yuklanmoqda...")}</p>:!error&&!invalidQuery&&summary&&<Card><p>{tr("Umumiy sof savdo:")}{' '}{summary.netSales}</p>{summary.cogs!==null&&<><p>{tr("Tarixiy tannarx:")}{' '}{summary.cogs}</p><p>{tr("Yalpi foyda:")}{' '}{summary.grossProfit}</p></>}<p>{tr("Holat (UTC):")}{' '}{asOf}</p><CsvExportButton path="/reports/breakdowns" params={{...filters,dimension,sort,search,...asOf?{asOf}:{}}}/><div className="overflow-auto"><DataTable><thead><tr><th>{tr("Nomi")}</th><th>{tr("Sof miqdor")}</th><th>{tr("Sof savdo")}</th><th>{tr("Tarixiy tannarx")}</th><th>{tr("Yalpi foyda")}</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{dimension==='payment'?labels[r.name]??r.name:r.name}</td><td>{r.quantity??'—'}</td><td>{r.revenue}</td><td>{r.cost??'—'}</td><td>{r.grossProfit??'—'}</td></tr>)}</tbody></DataTable>{!rows.length&&<p>{tr("Bu davrda yozuvlar yo‘q.")}</p>}</div><Pagination page={page} pages={pages} busy={busy&&!invalidQuery} blocked={invalidQuery||!!error} onPage={value=>changeQuery({page:String(value)})}/>{page>Math.max(1,pages)&&<Button onClick={()=>changeQuery({page:'1'})}>{tr("Birinchi sahifaga qaytish")}</Button>}</Card>}
 </div>;
}
