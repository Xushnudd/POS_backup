'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import {Suspense,useEffect,useState} from 'react';
import Link from 'next/link';
import {useAuth} from '@/context/AuthContext';
import {useOrganization} from '@/context/OrganizationContext';
import {api} from '@/lib/api';
import {confirmPageNavigation} from '@/lib/page-navigation';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import DurableMutation from '@/components/forms/DurableMutation';
import PendingActions from '@/components/forms/PendingActions';
import {useListFilters} from '@/hooks/useListFilters';
import {journalListSorts} from '@/lib/list-query';
import ListFilter from '@/components/ui/ListFilter';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
const reservationFields=['status','kind'] as const;
type Draft={id:string;receiptNo:string;totalAmount:string;items:{productName:string;quantity:string}[]};
type Named={id:string;name:string};type Option={value:string;label:string};
type Reservation={id:string;status:string;expiresAt:string;reason:string;kind:string};
type Position={onHand:string;reserved:string;available:string;unassigned:string;damaged:string;zones:{locationId:string;quantity:string;reserved:string;available:string}[]};
export default function LocationsPage(){
 const {t:tr}=useTranslation();
const {organization,user,role}=useAuth(),{activeStore}=useOrganization();return organization&&user&&activeStore&&['owner','admin'].includes(role??'')?<Suspense fallback={<LoadingSpinner/>}><Editor key={[organization.id,user.id,activeStore.id,role].join(':')} organizationId={organization.id} storeId={activeStore.id}/></Suspense>:<p>{tr("Filial tanlang. Zonalar va rezervlarni rahbar boshqaradi.")}</p>}
function Editor({storeId,organizationId}:{storeId:string;organizationId:string}){
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

 const {query,filters,changeQuery}=useListFilters(journalListSorts,'newest',reservationFields,'reservation_');
 const {query:draftQuery,changeQuery:changeDraft}=useListFilters(['newest'] as const,'newest',[],'draft_');
 const page=query?.page??1,limit=query?.limit??20,sort=query?.sort??'newest',reservationSearch=query?.search??'',draftPage=draftQuery?.page??1,draftLimit=draftQuery?.limit??20,invalidQuery=!query||!draftQuery;
 const [releaseReasons,setReleaseReasons]=useState<Record<string,string>>({});
 const [locations,setLocations]=useState<Named[]>([]),[reservations,setReservations]=useState<Reservation[]>([]),[products,setProducts]=useState<Named[]>([]),[selected,setSelected]=useState<Named|null>(null),[search,setSearch]=useState(''),[position,setPosition]=useState<Position|null>(null),[revision,setRevision]=useState(0),[pages,setPages]=useState(0),[error,setError]=useState(''),[serverTime,setServerTime]=useState(''),[drafts,setDrafts]=useState<Draft[]>([]),[draftPages,setDraftPages]=useState(0),[loading,setLoading]=useState(true),[positionLoading,setPositionLoading]=useState(false),[positionError,setPositionError]=useState(''),[posting,setPosting]=useState(false);
 const refresh=()=>{setLoading(true);if(selected)setPositionLoading(true);setRevision(n=>n+1);},productId=selected?.id??'';
 useEffect(()=>{let live=true;const timer=setTimeout(()=>{if(!live||invalidQuery)return;setLoading(true);setError('');void Promise.all([
  api.request<{serverTime:string;locations:Named[];reservations:Reservation[];total:number;limit:number}>('/inventory/locations?'+new URLSearchParams({storeId,page:String(page),limit:String(limit),sort,search:reservationSearch,...filters})),
  api.products.list({organizationId,search,limit:50}),
  api.request<Draft[]>('/sales?organizationId='+organizationId+'&storeId='+storeId+'&status=draft&page='+draftPage+'&limit='+draftLimit),
 ]).then(([r,p,d])=>{if(!live)return;if(!r.data)throw Error('Ombor ma’lumoti olinmadi');setServerTime(r.data.serverTime);setLocations(r.data.locations);setReservations(r.data.reservations);setPages(Math.ceil(r.data.total/r.data.limit));setProducts(p.data??[]);setDrafts(d.data??[]);setDraftPages(d.pagination?.totalPages??0);}).catch(e=>{if(live)setError(displayErrorMessage(e,'Ombor yuklanmadi'));}).finally(()=>{if(live)setLoading(false);});},250);return()=>{live=false;clearTimeout(timer);};},[storeId,organizationId,page,limit,sort,reservationSearch,filters,draftPage,draftLimit,invalidQuery,search,revision]);
 useEffect(()=>{let live=true;void Promise.resolve().then(async()=>{if(!live)return;setPositionError('');if(!productId){setPosition(null);setPositionLoading(false);return;}setPositionLoading(true);try{const r=await api.request<Position>('/inventory/position?storeId='+storeId+'&productId='+productId);if(live)setPosition(r.data??null);}catch(e){if(live)setPositionError(displayErrorMessage(e,'Qoldiq yuklanmadi'));}finally{if(live)setPositionLoading(false);}});return()=>{live=false;};},[productId,storeId,revision]);
 const ready=!loading&&!error&&!invalidQuery,stockReady=ready&&!positionLoading&&!positionError&&!!position;
 const options=[{value:'',label:tr("Zonaga biriktirilmagan")},...locations.map(l=>({value:l.id,label:l.name}))];
 return <div className="space-y-4"><h1>{tr("Ombor zonalari va rezervlar")}</h1><Link href="/inventory">{tr("Omborga qaytish")}</Link><p>{tr("Zonaga ko‘chirish umumiy fizik qoldiqni o‘zgartirmaydi. Available = on-hand − faol rezerv. Brak sotiladigan qoldiqqa kirmaydi. Rezerv muddati server vaqti bilan belgilanadi; ko‘rsatilgan balans yangilanish paytidagi holatdir.")}</p>{invalidQuery&&<p role="alert">{tr("URL filtri yoki sahifasi noto‘g‘ri. Filtrlarni tozalang.")}</p>}{loading&&!invalidQuery&&<p role="status">{tr("Ombor ma’lumoti yuklanmoqda…")}</p>}{error&&<p role="alert">{uiMessage(error)}{tr(". Oxirgi yuklangan ma’lumot va draftlar saqlanadi.")}</p>}{positionError&&<p role="alert">{uiMessage(positionError)}</p>}<Button disabled={posting} onClick={refresh}>{tr("Ombor ma’lumotini qayta yuklash")}</Button><PendingActions prefix="/inventory" returnPath="/inventory/locations" revision={revision} onDone={refresh}/>
 <ZoneForm storeId={storeId} ready={ready&&!posting} saved={refresh} posting={setPosting}/>
 <Card title={tr("Mahsulot qoldig‘i")}><Input label={tr("Zona uchun mahsulot qidirish")} value={search} disabled={posting} onChange={e=>{setLoading(true);setSearch(e.target.value);}}/><Select label={tr("Zona mahsuloti")} value={productId} disabled={posting} options={[{value:'',label:tr("Tanlang")},...(selected&&!products.some(p=>p.id===selected.id)?[{value:selected.id,label:selected.name}]:[]),...products.map(p=>({value:p.id,label:p.name}))]} onChange={e=>{if(e.target.value===productId||!confirmPageNavigation())return;setSelected(products.find(p=>p.id===e.target.value)??null);setPosition(null);}}/>{positionLoading&&<p role="status">{tr("Qoldiq yuklanmoqda…")}</p>}{position&&<div role="status"><p>{tr("Fizik:")}{' '}{position.onHand} {tr("· Rezerv:")}{' '}{position.reserved} {tr("· Mavjud:")}{' '}{position.available} {tr("· Biriktirilmagan:")}{' '}{position.unassigned} {tr("· Brak:")}{' '}{position.damaged}</p>{position.zones.map(z=><p key={z.locationId}>{locations.find(l=>l.id===z.locationId)?.name??z.locationId}: {z.quantity} {tr("· rezerv")}{' '}{z.reserved} {tr("· mavjud")}{' '}{z.available}</p>)}</div>}
 <MoveForm key={'move:'+productId} storeId={storeId} productId={productId} productName={selected?.name??''} options={options} ready={stockReady&&!posting} posting={setPosting} saved={refresh}/>
 <ReserveForm key={'reserve:'+productId} storeId={storeId} productId={productId} productName={selected?.name??''} options={options} ready={stockReady&&!posting} posting={setPosting} saved={refresh}/></Card>
 <Card title={tr("Rezervlar tarixi")}><p>{tr("Rezerv bilan sotuv uchun POSda aynan rezerv miqdoridagi qoralama tayyorlang. Quyida uni tanlang va naqd to‘lovni tasdiqlang. Server SKU, miqdor, narx va smenani qayta tekshiradi.")}</p>
 <ListFilter search={reservationSearch} sort={sort} label={tr("Rezerv sababi yoki ID qidirish")} onChange={changeQuery} reset={{status:'',kind:''}} options={[{value:'newest',label:tr("Yangi → eski")},{value:'oldest',label:tr("Eski → yangi")}]}><Select label={tr("Rezerv holati")} value={filters.status??''} options={[{value:'',label:tr("Barcha holatlar")},{value:'active',label:tr("Faol")},{value:'released',label:tr("Bo‘shatilgan")},{value:'consumed',label:tr("Sotilgan")},{value:'expired',label:tr("Muddati tugagan")}]} onChange={e=>changeQuery({status:e.target.value,page:'1'})}/><Select label={tr("Rezerv turi")} value={filters.kind??''} options={[{value:'',label:tr("Barcha turlar")},{value:'manual',label:tr("Ichki rezerv")},{value:'cash_ticket',label:tr("Offline naqd rezerv")}]} onChange={e=>changeQuery({kind:e.target.value,page:'1'})}/></ListFilter>{ready&&!reservations.length&&<p>{tr("Bu filtrda rezerv topilmadi.")}</p>}
 {reservations.map(r=><article key={r.id}><p>{r.id} · {r.status==='active'&&Date.parse(r.expiresAt)<=Date.parse(serverTime)?(r.kind==='cash_ticket'?tr("Muddati tugagan; offline pul/tovarni rahbar bilan hal qiling"):tr("Muddati tugagan (worker jurnalni yakunlaydi)")):r.status} · {r.expiresAt} · {r.reason}</p><ReleaseForm reason={releaseReasons[r.id]??''} setReason={reason=>setReleaseReasons(old=>({...old,[r.id]:reason}))} reservation={r} ready={ready&&!posting} posting={setPosting} saved={refresh}/></article>)}
 <SettlementForm drafts={drafts} reservations={reservations} serverTime={serverTime} ready={ready&&!posting} posting={setPosting} saved={refresh}/><Pagination page={draftPage} pages={draftPages} busy={posting||loading&&!invalidQuery} blocked={invalidQuery||!!error} onPage={p=>changeDraft({page:String(p)})} retry={refresh}/><PendingActions prefix="/sales" returnPath="/inventory/locations" revision={revision} onDone={refresh}/><Pagination page={page} pages={pages} busy={posting||loading&&!invalidQuery} blocked={invalidQuery||!!error} onPage={p=>changeQuery({page:String(p)})} retry={refresh}/></Card></div>;
}
type Shared={ready:boolean;posting:(value:boolean)=>void;saved:()=>void};
function ZoneForm({storeId,ready,posting,saved}:Shared&{storeId:string}){
 const {t:tr}=useTranslation();
const [name,setName]=useState('');return <Card title={tr("Yangi zona")}><DurableMutation path="/inventory/locations" returnPath="/inventory/locations" body={{storeId,name}} label={tr("Zona yaratish")} review={[name]} canSubmit={ready} onSavingChange={posting} onDone={()=>{setName('');saved();}}><Input label={tr("Zona nomi")} value={name} maxLength={100} onChange={e=>setName(e.target.value)}/></DurableMutation></Card>;}
type StockShared=Shared&{storeId:string;productId:string;productName:string;options:Option[]};
const zoneLabel=(options:Option[],id:string)=>options.find(o=>o.value===id)?.label??id;
function MoveForm({storeId,productId,productName,options,ready,posting,saved}:StockShared){
 const {t:tr}=useTranslation();
const [quantity,setQuantity]=useState('1'),[reason,setReason]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState('');return <DurableMutation path="/inventory/locations/move" returnPath="/inventory/locations" body={{storeId,productId,fromLocationId:from||null,toLocationId:to||null,quantity,reason}} label={tr("Zonaga ko‘chirish")} review={[productName,quantity,zoneLabel(options,from)+' → '+zoneLabel(options,to),reason]} canSubmit={ready&&!!productId} onSavingChange={posting} onDone={()=>{setQuantity('1');setReason('');setFrom('');setTo('');saved();}}><Input label={tr("Zona miqdori")} value={quantity} onChange={e=>setQuantity(e.target.value)}/><Input label={tr("Zona ko‘chirish sababi")} value={reason} onChange={e=>setReason(e.target.value)}/><Select label={tr("Manba zona")} value={from} options={options} onChange={e=>setFrom(e.target.value)}/><Select label={tr("Qabul zona")} value={to} options={options} onChange={e=>setTo(e.target.value)}/></DurableMutation>;}
function ReserveForm({storeId,productId,productName,options,ready,posting,saved}:StockShared){
 const {t:tr}=useTranslation();
const [quantity,setQuantity]=useState('1'),[reason,setReason]=useState(''),[holdLocation,setLocation]=useState(''),[expiresAt,setExpiry]=useState(()=>new Date(Date.now()+3600000).toISOString());return <DurableMutation path="/inventory/reservations" returnPath="/inventory/locations" body={{storeId,expiresAt,reason,items:[{productId,locationId:holdLocation||null,quantity}]}} label={tr("Qoldiqni rezervlash")} review={[productName,quantity,zoneLabel(options,holdLocation),expiresAt,reason]} canSubmit={ready&&!!productId} onSavingChange={posting} onDone={()=>{setQuantity('1');setReason('');setLocation('');setExpiry(new Date(Date.now()+3600000).toISOString());saved();}}><Input label={tr("Rezerv miqdori")} value={quantity} onChange={e=>setQuantity(e.target.value)}/><Input label={tr("Rezerv yaratish sababi")} value={reason} onChange={e=>setReason(e.target.value)}/><Select label={tr("Rezerv zonasi")} value={holdLocation} options={options} onChange={e=>setLocation(e.target.value)}/><Input label={tr("Rezerv tugashi (ISO sana)")} value={expiresAt} onChange={e=>setExpiry(e.target.value)}/></DurableMutation>;}
function ReleaseForm({reservation:r,ready,posting,saved,reason,setReason}:Shared&{reservation:Reservation;reason:string;setReason:(value:string)=>void}){
 const {t:tr}=useTranslation();
return <DurableMutation path={'/inventory/reservations/'+r.id+'/release'} returnPath="/inventory/locations" body={{reason}} label={tr("Rezervni bo‘shatish")} allowNew={r.status==='active'&&r.kind==='manual'} canSubmit={ready} onSavingChange={posting} review={[r.id,r.reason,reason]} onDone={()=>{setReason('');saved();}}>{r.status==='active'&&r.kind==='manual'&&<Input label={tr("Rezervni bo‘shatish sababi:")+" "+r.id} value={reason} onChange={e=>setReason(e.target.value)}/>}</DurableMutation>;}
function SettlementForm({drafts,reservations,serverTime,ready,posting,saved}:Shared&{drafts:Draft[];reservations:Reservation[];serverTime:string}){
 const {t:tr}=useTranslation();

 const [selected,setSelected]=useState<Draft|null>(null),[reservationId,setReservationId]=useState(''),[tender,setTender]=useState('');
 useUnsavedChanges(!!selected||!!reservationId||!!tender);
 const active=reservations.filter(r=>r.status==='active'&&r.kind==='manual'&&Date.parse(r.expiresAt)>Date.parse(serverTime));
 return <><Select label={tr("Sotiladigan rezerv")} value={reservationId} disabled={!ready} options={[{value:'',label:tr("Tanlang")},...(reservationId&&!active.some(r=>r.id===reservationId)?[{value:reservationId,label:tr("Tanlangan rezerv ·")+" "+reservationId}]:[]),...active.map(r=>({value:r.id,label:r.reason+' · '+r.id}))]} onChange={e=>{if(e.target.value===reservationId||!confirmPageNavigation())return;setReservationId(e.target.value);}}/><Select label={tr("Rezerv savdo qoralamasi")} value={selected?.id??''} disabled={!ready} options={[{value:'',label:tr("Tanlang")},...(selected&&!drafts.some(d=>d.id===selected.id)?[{value:selected.id,label:selected.receiptNo+' · '+selected.totalAmount}]:[]),...drafts.map(d=>({value:d.id,label:d.receiptNo+' · '+d.totalAmount}))]} onChange={e=>{if(e.target.value===(selected?.id??'')||!confirmPageNavigation())return;setSelected(drafts.find(d=>d.id===e.target.value)??null);setTender('');}}/>{selected?<DurableMutation path={'/sales/'+selected.id+'/complete'} returnPath="/inventory/locations" body={{reservationId,cashTendered:tender,payments:[{paymentType:'cash',amount:selected.totalAmount}]}} label={tr("Rezervni naqd sotish")} canSubmit={ready&&!!reservationId} onSavingChange={posting} review={[selected.receiptNo,...selected.items.map(i=>i.productName+' · '+i.quantity),tr("Jami")+" "+selected.totalAmount,tr("Berilgan")+" "+tender,reservationId]} onDone={()=>{setSelected(null);setReservationId('');setTender('');saved();}}><Input label={tr("Rezerv uchun berilgan naqd pul")} value={tender} onChange={e=>setTender(e.target.value)}/></DurableMutation>:<Input label={tr("Rezerv uchun berilgan naqd pul")} value={tender} disabled={!ready} onChange={e=>setTender(e.target.value)}/>}</>;
}
