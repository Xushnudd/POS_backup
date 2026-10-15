'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import {useReadPage} from '@/hooks/useReadPage';
import ReadQueryNotice from '@/components/ui/ReadQueryNotice';
import {useAuth} from '@/context/AuthContext';
import ReceiptCostApplication from './ReceiptCostApplication';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DurableMutation from '@/components/forms/DurableMutation';
import Input from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import ReceiptCostPrepare from './ReceiptCostPrepare';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import Button from '@/components/ui/Button';

type Plan = {
  id: string; amount: string; method: string; status: string; reason: string;
  applications:{id:string;reversalOfId:string|null;amount:string;createdAt:string}[];
  createdAt: string; cancelledAt: string | null; cancellationReason: string | null;
};

export default function ReceiptCostHistory({ documentId, documentNo, returnPath, items }: {
  documentId: string; documentNo: string; returnPath: string; items: {id:string;productId:string}[];
}) {
 const {formatDate}=useTranslation();

 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

  const {role}=useAuth();
  const {page,setPage,invalid,reset}=useReadPage('cost_'+documentId+'_');
  const [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<Plan[]>([]), [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true), [error, setError] = useState('');
  const [reasons,setReasons]=useState<Record<string,string>>({}),[posting,setPosting]=useState<Record<string,boolean>>({});
  const writing=Object.values(posting).some(Boolean);
  const discard=useUnsavedChanges(Object.values(reasons).some(Boolean),writing);
  const writingChanged=useCallback((id:string,saving:boolean)=>setPosting(old=>({...old,[id]:saving})),[]);
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    void (async () => {
      if(invalid)return;setBusy(true); setError('');
      try {
        const response = await api.request<{ rows: Plan[]; total: number }>(
          `/stock-documents/${documentId}/cost-plans?page=${page}`,
          { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) },
        );
        if (live) {
          if (!response.data) throw new Error('Taqsimot tarixi olinmadi.');
          setRows(response.data.rows); setTotal(response.data.total);
        }
      } catch (cause) {
        if (live) setError(displayErrorMessage(cause,'Taqsimot tarixi yuklanmadi.'));
      } finally { if (live) setBusy(false); }
    })();
    return () => { live = false; controller.abort(); };
  }, [documentId, page, revision,invalid]);
  const refresh = () => { setBusy(true); setRevision(value => value + 1); };
  return <><ReceiptCostPrepare documentId={documentId} documentNo={documentNo} items={items} returnPath={returnPath} onDone={refresh}/>
  <section aria-label={tr("Taqsimot tarixi: {value1}",{value1:String(documentNo)})} className="my-3 space-y-3 rounded-lg border p-3">
    <h4 className="font-semibold">{tr("Saqlangan xarajat taqsimotlari")}</h4>
    <p>{tr("Tayyorlash va tannarxga qo‘llash alohida amallar. Qo‘llashdan oldin hisobni tekshiring; qo‘llangan xarajatni avval reversal qilish kerak.")}</p>
    <ReadQueryNotice invalid={invalid} reset={reset}/>
    {busy&&!invalid && <p role="status">{tr("Taqsimot tarixi yuklanmoqda…")}</p>}
    {error && <p role="alert">{uiMessage(error)}</p>}
    {!busy && !error && !invalid && !rows.length && <p>{tr("Saqlangan taqsimot yo‘q.")}</p>}
    {rows.map(row => <article key={row.id} aria-label={tr("Taqsimot {value1}",{value1:String(row.id)})} className="space-y-2 border p-3">
      <p>{tr("Summa:")}{' '}{row.amount} {tr("· Usul:")}{' '}{({ value: 'Qiymat', quantity: tr("Miqdor"), weight: tr("Vazn") } as Record<string, string>)[row.method] ?? row.method}</p>
      <p>{tr("Holat:")}{' '}{row.status === 'prepared' ? row.applications?.some(a=>!a.reversalOfId)&&!row.applications?.some(a=>a.reversalOfId)?tr("Tannarxga qo‘llangan"):row.applications?.length?tr("Tannarx reversali yozilgan"):tr("Tayyor, qo‘llanmagan") : row.status === 'cancelled' ? tr("Bekor qilingan") : row.status}</p>
      <p>{tr("Sabab:")}{' '}{row.reason}</p><p>{tr("Yaratilgan:")}{' '}{formatDate(row.createdAt,true)}</p>
      {row.status === 'cancelled' && <><p>{tr("Bekor qilish sababi:")}{' '}{row.cancellationReason}</p><p>{tr("Bekor qilingan:")}{' '}{row.cancelledAt ? formatDate(row.cancelledAt,true) : '—'}</p></>}
      {role==='owner'&&<ReceiptCostApplication documentId={documentId} planId={row.id} status={row.status} applications={row.applications??[]} ready={!busy&&!error&&!writing&&!invalid} returnPath={returnPath} onDone={refresh} onWriting={writingChanged}/>}
      {/* Keep recovery available after a lost ACK even if the next GET sees cancelled. */}
      <CancelPlan key={row.id} row={row} documentId={documentId} returnPath={returnPath} reason={reasons[row.id]??''}
        onReason={reason=>setReasons(old=>({...old,[row.id]:reason}))}
        onDone={original=>{setReasons(old=>old[row.id]===original?{...old,[row.id]:''}:old);refresh();}}
        onWriting={writingChanged} ready={!busy&&!error&&!writing&&!invalid} />
    </article>)}
    <Pagination page={page} pages={Math.ceil(total / 20)} busy={busy&&!invalid||writing} blocked={invalid||!!error} onPage={value=>{setBusy(true);setPage(value);}} retry={refresh} />
    <Button variant="outline" disabled={writing} onClick={()=>{if(discard())setReasons({});}}>{tr("Bekor qilish qoralamalarini tozalash")}</Button>
  </section></>;
}

function CancelPlan({ row, documentId, returnPath, onDone, ready, reason, onReason, onWriting }: {
  row: Plan; documentId: string; returnPath: string; onDone: (originalReason:string) => void; ready:boolean;
  reason:string;onReason:(reason:string)=>void;onWriting:(id:string,saving:boolean)=>void;
}) {
 const {t:tr}=useTranslation();

  const writingChanged=useCallback((saving:boolean)=>onWriting(row.id,saving),[row.id,onWriting]);
  // Cancelled rows still mount the durable action to recover an original committed
  // operation. Its fresh-action button is hidden for terminal rows.
  return <DurableMutation path={`/stock-documents/${documentId}/cost-plans/${row.id}/cancel`}
    returnPath={returnPath} body={{ reason }} label={tr("Tayyor taqsimotni bekor qilish")}
    allowNew={row.status === 'prepared'&&(!row.applications?.some(a=>!a.reversalOfId)||!!row.applications?.some(a=>a.reversalOfId))} canSubmit={ready}
    review={[tr("Taqsimot: {value1}",{value1:String(row.id)}), tr("Summa: {value1}",{value1:String(row.amount)}), reason, tr("Faqat qo‘llanmagan taqsimot bekor qilinadi. Moliyaviy posting yaratilmaydi.")]}
    onSavingChange={writingChanged} onDone={(_result,body)=>onDone(typeof body?.reason==='string'?body.reason:'')}>
    {row.status === 'prepared' && <Input label={tr("Taqsimotni bekor qilish sababi")} value={reason} maxLength={2000} onChange={event => onReason(event.target.value)} />}
  </DurableMutation>;
}
