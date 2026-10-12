'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DurableMutation from '@/components/forms/DurableMutation';
import Input from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';

type Plan = {
  id: string; amount: string; method: string; status: string; reason: string;
  createdAt: string; cancelledAt: string | null; cancellationReason: string | null;
};

export default function ReceiptCostHistory({ documentId, documentNo, returnPath }: {
  documentId: string; documentNo: string; returnPath: string;
}) {
  const [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<Plan[]>([]), [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    void (async () => {
      setBusy(true); setError(''); setRows([]);
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
        if (live) setError(cause instanceof Error ? cause.message : 'Taqsimot tarixi yuklanmadi.');
      } finally { if (live) setBusy(false); }
    })();
    return () => { live = false; controller.abort(); };
  }, [documentId, page, revision]);
  const refresh = () => setRevision(value => value + 1);
  return <section aria-label={`Taqsimot tarixi: ${documentNo}`} className="my-3 space-y-3 rounded-lg border p-3">
    <h4 className="font-semibold">Saqlangan xarajat taqsimotlari</h4>
    <p>Tayyor taqsimot hali tannarxga qo‘llanmagan. Bekor qilish ombor, pul yoki qarz balansini o‘zgartirmaydi.</p>
    {busy && <p role="status">Taqsimot tarixi yuklanmoqda…</p>}
    {error && <p role="alert">{error}</p>}
    {!busy && !error && !rows.length && <p>Saqlangan taqsimot yo‘q.</p>}
    {rows.map(row => <article key={row.id} aria-label={`Taqsimot ${row.id}`} className="space-y-2 border p-3">
      <p>Summa: {row.amount} · Usul: {({ value: 'Qiymat', quantity: 'Miqdor', weight: 'Vazn' } as Record<string, string>)[row.method] ?? row.method}</p>
      <p>Holat: {row.status === 'prepared' ? 'Tayyor, qo‘llanmagan' : row.status === 'cancelled' ? 'Bekor qilingan' : row.status}</p>
      <p>Sabab: {row.reason}</p><p>Yaratilgan: {new Date(row.createdAt).toLocaleString('uz-UZ')}</p>
      {row.status === 'cancelled' && <><p>Bekor qilish sababi: {row.cancellationReason}</p><p>Bekor qilingan: {row.cancelledAt ? new Date(row.cancelledAt).toLocaleString('uz-UZ') : '—'}</p></>}
      {/* Keep recovery available after a lost ACK even if the next GET sees cancelled. */}
      <CancelPlan key={row.id + ':' + revision} row={row} documentId={documentId} returnPath={returnPath} onDone={refresh} />
    </article>)}
    <Pagination page={page} pages={Math.ceil(total / 20)} busy={busy} onPage={setPage} retry={refresh} />
  </section>;
}

function CancelPlan({ row, documentId, returnPath, onDone }: {
  row: Plan; documentId: string; returnPath: string; onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  // Cancelled rows still mount the durable action to recover an original committed
  // operation. Its fresh-action button is hidden for terminal rows.
  return <DurableMutation path={`/stock-documents/${documentId}/cost-plans/${row.id}/cancel`}
    returnPath={returnPath} body={{ reason }} label="Tayyor taqsimotni bekor qilish"
    allowNew={row.status === 'prepared'}
    review={[`Taqsimot: ${row.id}`, `Summa: ${row.amount}`, reason, 'Faqat qo‘llanmagan taqsimot bekor qilinadi. Moliyaviy posting yaratilmaydi.']}
    onDone={onDone}>
    {row.status === 'prepared' && <Input label="Taqsimotni bekor qilish sababi" value={reason} maxLength={2000} onChange={event => setReason(event.target.value)} />}
  </DurableMutation>;
}
