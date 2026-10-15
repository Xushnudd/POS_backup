'use client';




import {useTranslation} from '@/context/LocaleContext';

import {useReadPage} from '@/hooks/useReadPage';
import ReadQueryNotice from '@/components/ui/ReadQueryNotice';
import {useCallback,useEffect,useState} from 'react';
import {api} from '@/lib/api';
import DurableMutation from '@/components/forms/DurableMutation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
type App={id:string;reversalOfId:string|null;amount:string;createdAt:string};
type Preview={expectedHash:string;amount:string;products:{productId:string;inventoryCorrection:string;cogsCorrection:string;varianceCorrection:string;roundingCorrection:string;beforeAverageCost:string;afterAverageCost:string;transitCorrection:string;storeCorrections:{storeId:string;amount:string}[]}[]};
type Journal={applications:(App&{products:Preview['products']})[];continuations:{id:string;productId:string;storeId:string;varianceCorrection:string;roundingCorrection:string;cogsCorrection:string;sourceOperationId:string|null;sourceAuditId:string|null;createdAt:string}[];pages:number;total:number};
export default function ReceiptCostApplication({documentId,planId,status,applications,ready,returnPath,onDone,onWriting}:{documentId:string;planId:string;status:string;applications:App[];ready:boolean;returnPath:string;onDone:()=>void;onWriting:(id:string,saving:boolean)=>void}){
 const {t:tr}=useTranslation();

 const historyQuery=useReadPage('valuation_'+planId+'_'),historyPage=historyQuery.page,setHistoryPage=historyQuery.setPage;
 const [localApplied,setLocalApplied]=useState<string|null>(null),[localReversed,setLocalReversed]=useState(false);
 const original=applications.find(row=>!row.reversalOfId),appliedId=original?.id??localApplied;
 const reversed=localReversed||applications.some(row=>row.reversalOfId===appliedId);
 const [history,setHistory]=useState<Journal|null>(null),[historyError,setHistoryError]=useState(''),[historyBusy,setHistoryBusy]=useState(false),[historyOpened,setHistoryOpened]=useState(false),[revision,setRevision]=useState(0);
 const refresh=()=>{setRevision(value=>value+1);onDone();};
 useEffect(()=>{if(!historyOpened||historyQuery.invalid)return;let live=true;void(async()=>{setHistoryBusy(true);setHistoryError('');try{const r=await api.request<Journal>(`/stock-documents/${documentId}/cost-plans/${planId}/applications?page=${historyPage}`);if(!r.data)throw Error('Jurnal olinmadi');if(live)setHistory(r.data)}catch(e){if(live)setHistoryError(e instanceof Error?e.message:'Jurnal yuklanmadi')}finally{if(live)setHistoryBusy(false)}})();return()=>{live=false};},[documentId,planId,historyOpened,historyPage,revision,historyQuery.invalid]);
 const writingApply=useCallback((saving:boolean)=>onWriting(planId+':apply',saving),[planId,onWriting]);
 const writingReverse=useCallback((saving:boolean)=>onWriting(planId+':reverse',saving),[planId,onWriting]);
 return <section aria-label={`Tannarx jurnali ${planId}`} className="space-y-3 border-t pt-3">
  <p>{reversed?tr("Tannarx qo‘llanishi bekor qilingan."):appliedId?tr("Xarajat tannarxga qo‘llangan."):tr("Taqsimot tannarxga hali qo‘llanmagan.")} {tr("Eski kirim va savdolar o‘zgarmaydi, xarajat qayta to‘lanmaydi.")}</p>
  <CostAction path={`/stock-documents/${documentId}/cost-plans/${planId}/apply`} previewPath={`/stock-documents/${documentId}/cost-plans/${planId}/application-preview`} returnPath={returnPath} ready={ready} allowed={status==='prepared'&&!appliedId} label={tr("Xarajatni tannarxga qo‘llash")} onWriting={writingApply} onDone={result=>{if(result&&typeof result==='object'&&'id' in result&&typeof result.id==='string')setLocalApplied(result.id);refresh();}}/>
  <CostAction path={`/stock-documents/${documentId}/cost-plans/${planId}/reverse`} previewPath={`/stock-documents/${documentId}/cost-plans/${planId}/application-preview`} returnPath={returnPath} ready={ready} allowed={status==='prepared'&&!!appliedId&&!reversed} reverseApplicationId={appliedId??''} label={tr("Qo‘llangan tannarxni bekor qilish")} onWriting={writingReverse} onDone={()=>{setLocalReversed(true);refresh();}}/>
  <Button variant="outline" disabled={historyBusy} onClick={()=>{setHistoryOpened(true);setHistoryBusy(true);setRevision(value=>value+1);}}>{tr("Tannarx jurnalini ko‘rish / yangilash")}</Button>
  <ReadQueryNotice invalid={historyQuery.invalid} reset={historyQuery.reset}/>{historyBusy&&!historyQuery.invalid&&<p role="status">{tr("Tannarx jurnali yuklanmoqda…")}</p>}{historyError&&<p role="alert">{historyError}{tr(". Oxirgi jurnal saqlangan; qayta yuklang.")}</p>}
  {history&&<div className="space-y-3">{history.applications.map(row=><article key={row.id}><p>{row.reversalOfId?tr("Reversal"):tr("Qo‘llash")} · {row.amount} · {row.createdAt} · {row.id}</p>{row.products.map(p=><p key={p.productId}>SKU {p.productId}{tr(": zaxira")}{' '}{p.inventoryCorrection}{tr("; sotilgan tannarx")}{' '}{p.cogsCorrection}{tr("; qiymat farqi")}{' '}{p.varianceCorrection}{tr("; yaxlitlash")}{' '}{p.roundingCorrection}{tr("; tranzit")}{' '}{p.transitCorrection}</p>)}</article>)}
   <h5>{tr("Keyingi qiymat o‘zgarishlari (")}{history.total})</h5>{!historyBusy&&!historyError&&!historyQuery.invalid&&!history.total&&<p>{tr("Keyingi qiymat tuzatishlari yo‘q.")}</p>}{history.continuations.map(row=><p key={row.id}>{row.createdAt} {tr("· SKU")}{' '}{row.productId} {tr("· filial")}{' '}{row.storeId} {tr("· COGS")}{' '}{row.cogsCorrection} {tr("· qiymat farqi")}{' '}{row.varianceCorrection} {tr("· yaxlitlash")}{' '}{row.roundingCorrection} {tr("· manba")}{' '}{row.sourceOperationId??row.sourceAuditId}</p>)}
   <Pagination page={historyPage} pages={history.pages} busy={historyBusy&&!historyQuery.invalid} blocked={historyQuery.invalid||!!historyError} onPage={setHistoryPage} retry={()=>{setHistoryBusy(true);setRevision(value=>value+1);}}/>
  </div>}
 </section>;
}
function CostAction({path,previewPath,returnPath,ready,allowed,label,reverseApplicationId,onWriting,onDone}:{path:string;previewPath:string;returnPath:string;ready:boolean;allowed:boolean;label:string;reverseApplicationId?:string;onWriting:(saving:boolean)=>void;onDone:(result?:unknown)=>void}){
 const {t:tr}=useTranslation();

 const [preview,setPreview]=useState<Preview|null>(null),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[writing,setWriting]=useState(false),[error,setError]=useState('');
 useUnsavedChanges(allowed&&reason.length>0,writing);
 const savingChanged=useCallback((value:boolean)=>{setWriting(value);onWriting(value);},[onWriting]);
 const load=async()=>{if(busy||writing||!ready||!allowed)return;setBusy(true);setError('');setPreview(null);try{const r=await api.request<Preview>(previewPath,{method:'POST',body:JSON.stringify(reverseApplicationId?{reverseApplicationId}:{})});if(!r.data)throw Error('Hisob olinmadi');setPreview(r.data)}catch(e){setError(e instanceof Error?e.message:'Hisob yuklanmadi')}finally{setBusy(false)}};
 const review=preview?[`Jurnal summasi: ${preview.amount}`,reason,...preview.products.flatMap(p=>[`SKU ${p.productId}: tannarx ${p.beforeAverageCost} → ${p.afterAverageCost}`,`Zaxira ${p.inventoryCorrection}, COGS ${p.cogsCorrection}, farq ${p.varianceCorrection}, yaxlitlash ${p.roundingCorrection}, tranzit ${p.transitCorrection}`,...p.storeCorrections.filter(row=>row.amount!=='0').map(row=>`Zaxira filiali ${row.storeId}: ${row.amount}`)]),'Pul qayta to‘lanmaydi. Eski hujjatlar o‘zgarmaydi.']:[];
 return <div className="space-y-2">
  {allowed&&<><Button disabled={!ready||busy||writing} onClick={()=>void load()}>{label}{tr(": hisobni yangilash")}</Button>{busy&&<p role="status">{tr("Tannarx hisobi yuklanmoqda…")}</p>}{error&&<p role="alert">{error}{tr(". Sabab qoralamasi saqlangan.")}</p>}</>}
  {/* Always mounted: a committed action must still recover after reload even
      when fresh metadata already reports applied/reversed. */}
  <DurableMutation path={path} returnPath={returnPath} allowNew={allowed} canSubmit={ready&&!busy&&!error} canReview={!!preview&&reason.trim().length>=3} onRejected={code=>{if(code==='COST_PREVIEW_CHANGED'||code==='COST_SOURCE_RECONCILIATION_REQUIRED')setPreview(null);}} body={{expectedHash:preview?.expectedHash??'',reason,...(reverseApplicationId!==undefined?{reverseApplicationId}: {})}} label={label} review={review} onSavingChange={savingChanged} onDone={result=>{setReason('');setPreview(null);onDone(result);}}>
   {allowed&&<Input label={reverseApplicationId!==undefined?tr("Tannarxni bekor qilish sababi"):tr("Tannarxni qo‘llash sababi")} value={reason} minLength={3} maxLength={2000} onChange={event=>setReason(event.target.value)}/>}
  </DurableMutation>
 </div>;
}
