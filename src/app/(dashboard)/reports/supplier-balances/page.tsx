'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useAuth} from '@/context/AuthContext';
import {useOrganization} from '@/context/OrganizationContext';
import {api} from '@/lib/api';
import CatalogFilter from '@/components/reports/CatalogFilter';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import CsvExportButton from '@/components/ui/CsvExportButton';
const fields=['invoiced','allocated','unpaid','overdue','upcoming','noDueDate','paid','advance'] as const;
type Totals=Record<typeof fields[number],string>;
type Row=Totals&{supplierId:string;storeId:string;supplierName:string;storeName:string};
type Report={rows:Row[];summary:Totals;meta:{asOf:string;timezone:string;currency:string}};
const labels:Record<typeof fields[number],string>={invoiced:'Invoice jami',allocated:'Taqsimlangan',unpaid:'To‘lanmagan qarz',overdue:'Muddati o‘tgan',upcoming:'Muddati kelmagan',noDueDate:'Muddatsiz',paid:'To‘langan pul',advance:'Taqsimlanmagan avans'};
export default function SupplierBalancesPage(){const {organization,user,role}=useAuth();return organization&&user&&role&&role!=='cashier'?<Content key={[organization.id,user.id,role].join(':')}/>:<p>Supplier hisobotiga rahbar vakolati kerak.</p>;}
function Content(){const {stores}=useOrganization(),[draft,setDraft]=useState({supplierId:'',storeId:''}),[filters,setFilters]=useState<Record<string,string>>({}),[page,setPage]=useState(1),[pages,setPages]=useState(0),[cutoff,setCutoff]=useState(''),[report,setReport]=useState<Report|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{let live=true;void(async()=>{if(live){setBusy(true);setError('');}try{const r=await api.request<Report>('/reports/supplier-balances?'+new URLSearchParams({...filters,page:String(page),limit:'20',...(cutoff?{asOf:cutoff}:{})}));if(live){setReport(r.data??null);setPages(r.pagination?.totalPages??0);if(!cutoff&&r.data)setCutoff(r.data.meta.asOf);}}catch(e){if(live){setReport(null);setError(e instanceof Error?e.message:'Hisobot yuklanmadi');}}finally{if(live)setBusy(false);}})();return()=>{live=false;};},[filters,page,cutoff,revision]);
 const refresh=()=>{setPage(1);setCutoff('');setRevision(v=>v+1);};
 return <div className="space-y-4"><h1 className="text-2xl font-bold">Supplier qarzi va to‘lov muddati</h1><p>Faqat tekshirilgan, ro‘yxatga olingan invoice va to‘lovlar. Eski ro‘yxatga olinmagan xaridlar avtomatik qarz deb olinmaydi. Qarz va avans alohida; filiallar orasida yashirin netting yo‘q.</p><Card><form onSubmit={e=>{e.preventDefault();setFilters(Object.fromEntries(Object.entries(draft).filter(([,v])=>v)));refresh();}} className="space-y-3"><CatalogFilter kind="supplier" value={draft.supplierId} onChange={supplierId=>setDraft(v=>({...v,supplierId}))}/><Select label="Supplier hisobot filiali" value={draft.storeId} onChange={e=>setDraft(v=>({...v,storeId:e.target.value}))} options={[{value:'',label:'Vakolatli filiallar'},...stores.map(s=>({value:s.id,label:s.name}))]}/><Button type="submit" disabled={busy}>Supplier hisobotini filtrlash</Button><Button disabled={busy} onClick={refresh}>Joriy balansni yangilash</Button></form></Card>{error&&<p role="alert">{error}</p>}{busy?<p>Yuklanmoqda...</p>:report&&<><Card><p>Balans kesimi: {report.meta.asOf}; {report.meta.timezone}; {report.meta.currency}</p>{fields.map(k=><p key={k}>{labels[k]}: {report.summary[k]}</p>)}</Card><CsvExportButton path="/reports/supplier-balances" params={{...filters,asOf:report.meta.asOf}} label="Supplier balansini CSV yuklash"/><div className="overflow-auto"><table><thead><tr><th>Supplier / filial</th>{fields.map(k=><th key={k}>{labels[k]}</th>)}</tr></thead><tbody>{report.rows.map(r=><tr key={r.supplierId+':'+r.storeId}><td><Link prefetch={false} href={'/suppliers/'+r.supplierId}>{r.supplierName}</Link> · {r.storeName}</td>{fields.map(k=><td key={k}>{r[k]}</td>)}</tr>)}</tbody></table>{!report.rows.length&&<p>Supplier ledger yozuvi yo‘q.</p>}</div></>}<Pagination page={page} pages={pages} busy={busy} onPage={setPage} retry={refresh}/><p><Link prefetch={false} href="/shifts">Smena va pul farqi</Link> · <Link prefetch={false} href="/customers">Mijoz qarzi va muddati</Link> · <Link prefetch={false} href="/reports/purchases">Xarid hisoboti</Link></p></div>;
}
