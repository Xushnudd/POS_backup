'use client';



import {useTranslation} from '@/context/LocaleContext';

import {useReadPage} from '@/hooks/useReadPage';
import ReadQueryNotice from '@/components/ui/ReadQueryNotice';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useAuth} from '@/context/AuthContext';
import {api} from '@/lib/api';
import {confirmPageNavigation} from '@/lib/page-navigation';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import DurableMutation from '@/components/forms/DurableMutation';
import PendingActions from '@/components/forms/PendingActions';
type Profile={id:string;name:string;isActive:boolean;versions:Version[]};
type Version={id:string;mode:string;rate:string;exemptionReason:string|null;effectiveAt:string};
export default function TaxesPage(){
 const {t:tr}=useTranslation();
const {organization,user,role}=useAuth();return organization&&user&&role==='owner'?<Editor key={organization.id+':'+user.id+':'+role}/>:<p>{tr("Soliq siyosatini tashkilot egasi sozlaydi.")}</p>;}
function Editor(){
 const {t:tr}=useTranslation();

 const {page,setPage,invalid,reset}=useReadPage('taxes_');
 const historyQuery=useReadPage('tax_versions_'),historyPage=historyQuery.page,setHistoryPage=historyQuery.setPage;
 const [rows,setRows]=useState<Profile[]>([]),[history,setHistory]=useState<Version[]>([]),[selected,setSelected]=useState(''),[name,setName]=useState(''),[mode,setMode]=useState('included'),[rate,setRate]=useState('0'),[reason,setReason]=useState(''),[date,setDate]=useState(()=>new Date().toISOString()),[pages,setPages]=useState(0),[historyPages,setHistoryPages]=useState(0),[revision,setRevision]=useState(0),[error,setError]=useState(''),[historyError,setHistoryError]=useState(''),[loading,setLoading]=useState(true),[historyLoading,setHistoryLoading]=useState(false);
 const refresh=()=>setRevision(value=>value+1);
 useEffect(()=>{let live=true;void Promise.resolve().then(async()=>{if(!live||invalid)return;setLoading(true);setError('');try{const result=await api.request<Profile[]>('/taxes?status=all&page='+page+'&limit=20');if(live){setRows(result.data??[]);setPages(result.pagination?.totalPages??0);}}catch(cause){if(live)setError(cause instanceof Error?cause.message:'Soliq profillari yuklanmadi');}finally{if(live)setLoading(false);}});return()=>{live=false;};},[page,revision,invalid]);
 useEffect(()=>{let live=true;if(!selected||historyQuery.invalid)return;void Promise.resolve().then(async()=>{if(!live)return;setHistoryLoading(true);setHistoryError('');try{const result=await api.request<Version[]>('/taxes/'+selected+'/versions?page='+historyPage+'&limit=20');if(live){setHistory(result.data??[]);setHistoryPages(result.pagination?.totalPages??0);}}catch(cause){if(live)setHistoryError(cause instanceof Error?cause.message:'Stavka tarixi yuklanmadi');}finally{if(live)setHistoryLoading(false);}});return()=>{live=false;};},[selected,historyPage,revision,historyQuery.invalid]);
 function open(id:string){if(id===selected||!confirmPageNavigation())return;setSelected(id);setHistoryPage(1);setHistory([]);setMode('included');setRate('0');setReason('');setDate(new Date().toISOString());}
 return <div className="space-y-4"><h1>{tr("Soliq siyosati va stavka tarixi")}</h1><ReadQueryNotice invalid={invalid} reset={reset}/><ReadQueryNotice invalid={historyQuery.invalid} reset={historyQuery.reset}/><Link href="/settings">{tr("Sozlamalarga qaytish")}</Link>
  <p>{tr("Stavka va imtiyozni biznes egasi o‘z talablari asosida kiritadi. Bu ichki hisob siyosati; fiskal integratsiya yoki qonuniy tasdiq emas. Versiya o‘zgarmaydi, keyingi qoida yangi sana bilan yoziladi; tarixiy savdo o‘z snapshotini saqlaydi.")}</p>
  {loading&&<p role="status">{tr("Soliq profillari yuklanmoqda…")}</p>}{error&&<p role="alert">{error} {tr("Oxirgi yuklangan ro‘yxat saqlanadi.")}</p>}
  <PendingActions prefix="/taxes" returnPath="/settings/taxes" revision={revision} onDone={refresh}/>
  <Card title={tr("Yangi soliq profili")}><DurableMutation path="/taxes" returnPath="/settings/taxes" body={{name:name.trim()}} label={tr("Soliq profilini yaratish")} review={[name.trim()]} onDone={()=>{setName('');refresh();}}><Input label={tr("Soliq profili nomi")} value={name} maxLength={200} onChange={event=>setName(event.target.value)}/></DurableMutation></Card>
  <Card title={tr("Faol va arxiv profillar")}>{!loading&&!error&&!rows.length&&<p>{tr("Soliq profili yo‘q.")}</p>}{rows.map(row=><div key={row.id}><p>{row.name} · {row.isActive?tr("Faol"):tr("Arxiv")} · {row.versions[0]?row.versions[0].mode+' '+row.versions[0].rate+'%':tr("Kuchga kirgan qoida yo‘q")}</p>
   <Button disabled={loading} onClick={()=>open(row.id)}>{tr("Soliq tarixini ochish:")}{' '}{row.name}</Button>
   <DurableMutation method="PUT" path={'/taxes/'+row.id} returnPath="/settings/taxes" canSubmit={!loading&&!error&&!invalid} body={{isActive:!row.isActive}} label={(row.isActive?'Soliq profilini arxivlash: ':'Soliq profilini tiklash: ')+row.name} review={[row.name,row.isActive?'Profil arxivlanadi. Tarixiy cheklar o‘zgarmaydi.':'Profil tiklanadi. Tarixiy cheklar o‘zgarmaydi.']} onDone={refresh}/>
  </div>)}<Pagination page={page} pages={pages} busy={loading&&!invalid} blocked={invalid||!!error} onPage={setPage} retry={refresh}/></Card>
  {selected&&<Card title={tr("Yangi tarixiy stavka")}><DurableMutation key={selected} path={'/taxes/'+selected+'/versions'} returnPath="/settings/taxes" body={{mode,rate,effectiveAt:date,...(mode==='exempt'?{exemptionReason:reason}:{})}} label={tr("Soliq stavkasini yozish")} review={[mode,rate+'%',date,...(mode==='exempt'?[reason]:[])]} onDone={()=>{setMode('included');setRate('0');setReason('');setDate(new Date().toISOString());refresh();}}>
   <Select label={tr("Soliq hisoblash usuli")} value={mode} options={[{value:'included',label:tr("Narx ichida")},{value:'excluded',label:tr("Narx ustiga qo‘shiladi")},{value:'exempt',label:tr("Imtiyoz")}]} onChange={event=>{setMode(event.target.value);if(event.target.value==='exempt')setRate('0');}}/>
   <Input label={tr("Soliq stavkasi foiz")} inputMode="decimal" value={rate} maxLength={6} onChange={event=>setRate(event.target.value)} disabled={mode==='exempt'}/>
   {mode==='exempt'&&<Input label={tr("Imtiyoz sababi")} value={reason} maxLength={2000} onChange={event=>setReason(event.target.value)}/>}
   <Input label={tr("Kuchga kirish UTC ISO sanasi")} value={date} onChange={event=>setDate(event.target.value)}/>
  </DurableMutation><p>{tr("Keyingi versiya oldingi effective sanadan keyin bo‘lishi kerak; avvalgi savdoni qayta hisoblashga ruxsat yo‘q.")}</p>
   {historyLoading&&<p role="status">{tr("Stavka tarixi yuklanmoqda…")}</p>}{historyError&&<p role="alert">{historyError} {tr("Oxirgi yuklangan tarix saqlanadi.")}</p>}
   {history.map(version=><p key={version.id}>{version.effectiveAt} · {version.mode} · {version.rate}%{version.exemptionReason?' · '+version.exemptionReason:''}</p>)}
   <Pagination page={historyPage} pages={historyPages} busy={historyLoading&&!historyQuery.invalid} blocked={historyQuery.invalid||!!historyError} onPage={setHistoryPage} retry={refresh}/>
  </Card>}
 </div>;
}
