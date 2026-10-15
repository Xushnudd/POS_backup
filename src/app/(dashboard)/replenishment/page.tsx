'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import {Suspense,useCallback,useEffect,useRef,useState} from 'react';
import {api} from '@/lib/api';
import {useAuth} from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import CatalogFilter from '@/components/reports/CatalogFilter';
import DurableMutation from '@/components/forms/DurableMutation';
import PendingActions from '@/components/forms/PendingActions';
import {useListQuery} from '@/hooks/useListQuery';
import {replenishmentListSorts} from '@/lib/list-query';
import ListFilter from '@/components/ui/ListFilter';
import DataTable from '@/components/ui/DataTable';
type Row={storeName:string;productName:string;unit:string;quantity:string;minimum:string;maximum:string|null;suggestedQuantity:string;minimumOnly:boolean};
export default function Replenishment(){
 const {t:tr}=useTranslation();
const {organization,user,role}=useAuth();return organization&&user?<Suspense fallback={<p>{tr("Yuklanmoqda...")}</p>}><ReplenishmentControls key={[organization.id,user.id,role].join(':')}/></Suspense>:null;}
function ReplenishmentControls(){
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

 const {organization,role}=useAuth();const [rows,setRows]=useState<Row[]>([]),[stores,setStores]=useState<{id:string;name:string}[]>([]),[storeId,setStoreId]=useState(''),[productId,setProductId]=useState(''),[minimum,setMinimum]=useState('0'),[maximum,setMaximum]=useState('0'),[pages,setPages]=useState(0),[busy,setBusy]=useState(true),[error,setError]=useState('');const [version,setVersion]=useState(0),[metadataReady,setMetadataReady]=useState(false),[metadataError,setMetadataError]=useState('');
 const {query,params,changeQuery}=useListQuery(replenishmentListSorts,'store');
 const page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'store',search=query?.search??'',filterStore=params.get('storeId')??'',invalidQuery=!query;
 const sequence=useRef({value:0});
 const load=useCallback(async()=>{
  if(!organization?.id||invalidQuery)return;const request=++sequence.current.value;setBusy(true);setError('');
  try{const result=await api.request<Row[]>('/reports/replenishment?'+new URLSearchParams({page:String(page),limit:String(limit),sort,search,...(filterStore?{storeId:filterStore}:{})}));if(request===sequence.current.value){setRows(result.data??[]);setPages(result.pagination?.totalPages??0);}}
  catch(e){if(request===sequence.current.value)setError(displayErrorMessage(e,'Yuklanmadi'));}finally{if(request===sequence.current.value)setBusy(false);}
 },[page,limit,sort,search,filterStore,organization?.id,invalidQuery]);
 useEffect(()=>{const requests=sequence.current;let live=true;if(role&&role!=='cashier')void Promise.resolve().then(()=>{if(live)return load();});return()=>{live=false;requests.value++;};},[load,role]);
 useEffect(()=>{let cancelled=false;if(organization&&role!=='cashier')void api.stores.list(organization.id).then(response=>{if(!cancelled){setStores(response.data??[]);setMetadataReady(true);setMetadataError('');}}).catch(cause=>{if(!cancelled){setMetadataReady(false);setMetadataError(displayErrorMessage(cause,'Filiallar yuklanmadi'));}});return()=>{cancelled=true;};},[organization,role,version]);
 const saved=()=>{setStoreId('');setProductId('');setMinimum('0');setMaximum('0');setVersion(value=>value+1);void load();};
 if(role==='cashier')return <p role="alert">{tr("Qoldiq tavsiyalari rahbarlar uchun.")}</p>;
 return <div className="space-y-4"><h1 className="text-2xl font-bold">{tr("Qayta buyurtma tavsiyasi")}</h1><p>{tr("Qoldiq minimumga teng yoki undan kam bo‘lsa ro‘yxatga kiradi. Tavsiya = max−qoldiq. Max sozlanmasa faqat minimumgacha to‘ldirish ko‘rsatiladi. Bu buyurtma yoki rezerv yaratmaydi; sotuv tezligi/yetkazish muddatini taxmin qilmaydi.")}</p><PendingActions prefix="/inventory/thresholds" returnPath="/replenishment" revision={version} onDone={()=>{setVersion(value=>value+1);void load();}}/>{metadataError&&<p role="alert">{uiMessage(metadataError)}<Button onClick={()=>setVersion(value=>value+1)}>{tr("Filiallarni qayta yuklash")}</Button></p>}<DurableMutation path="/inventory/thresholds" returnPath="/replenishment" canSubmit={metadataReady} body={{storeId,productId,minimum,maximum}} label={tr("Chegaralarni saqlash")} review={[stores.find(store=>store.id===storeId)?.name??tr("Filial tanlanmagan"),tr("Mahsulot:")+" "+productId,tr("Minimum:")+" "+minimum,tr("Maksimum:")+" "+maximum,tr("Bu sozlash yangi kirim, buyurtma yoki rezerv yaratmaydi.")]} onDone={saved}><Select label={tr("Qoldiq filiali")} value={storeId} onChange={e=>setStoreId(e.target.value)} options={[{value:'',label:tr("Filialni tanlang")},...stores.map(s=>({value:s.id,label:s.name}))]}/><CatalogFilter kind="product" value={productId} onChange={setProductId}/><Input label={tr("Minimal qoldiq")} type="number" min="0" step="0.000001" value={minimum} onChange={e=>setMinimum(e.target.value)}/><Input label={tr("Maksimal qoldiq")} type="number" min="0" step="0.000001" value={maximum} onChange={e=>setMaximum(e.target.value)}/></DurableMutation>{busy&&<p role="status">{tr("Yuklanmoqda...")}</p>}{error&&<p role="alert">{uiMessage(error)}</p>}{!busy&&!error&&!invalidQuery&&!rows.length&&<p>{tr("Kam qoldiqli mahsulot yo‘q.")}</p>}<ListFilter search={search} sort={sort} label={tr("Tavsiya mahsuloti yoki filial qidirish")} onChange={changeQuery} reset={{storeId:''}} options={[{value:'store',label:tr("Filiallar bo‘yicha")},{value:'name_asc',label:tr("Nom: A–Z")},{value:'name_desc',label:tr("Nom: Z–A")},{value:'quantity_asc',label:tr("Qoldiq: o‘sish")},{value:'quantity_desc',label:tr("Qoldiq: kamayish")},{value:'suggested_desc',label:tr("Tavsiya: kamayish")}]}><Select label={tr("Tavsiya hisobotining filiali")} value={filterStore} options={[{value:'',label:tr("Barcha ruxsatli filiallar")},...stores.map(s=>({value:s.id,label:s.name}))]} onChange={e=>changeQuery({storeId:e.target.value,page:'1'})}/></ListFilter>{invalidQuery&&<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>}{!busy&&!error&&!invalidQuery&&<DataTable><thead><tr><th>{tr("Filial / mahsulot")}</th><th>{tr("Qoldiq / minimum")}</th><th>{tr("Maksimum / tavsiya")}</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i} className="border-b"><td>{r.storeName} · {r.productName}</td><td>{r.quantity} / {r.minimum}</td><td>{r.maximum??tr("sozlanmagan")} / {r.suggestedQuantity} {r.unit} {r.minimumOnly?tr("(minimumgacha)"):''}</td></tr>)}</tbody></DataTable>}<Pagination page={page} pages={pages} busy={busy&&!invalidQuery} blocked={invalidQuery||!!error} onPage={value=>changeQuery({page:String(value)})} retry={load}/></div>;
}
