'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import DurableMutation from '@/components/forms/DurableMutation';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';

type Source = { id: string; amount: string; reason: string; category: { name: string } | null };
export default function ReceiptCostPrepare({ documentId, documentNo, items, returnPath, onDone }: {
  documentId: string; documentNo: string; items: { id: string; productId: string }[];
  returnPath: string; onDone: () => void;
}) {
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

  const [search, setSearch] = useState(''), [page, setPage] = useState(1), [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<Source[]>([]), [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Source | null>(null), [reason, setReason] = useState('');
  const [method, setMethod] = useState('value'), [weights, setWeights] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true), [posting, setPosting] = useState(false), [error, setError] = useState('');
  const discard = useUnsavedChanges(Boolean(selected || reason || method !== 'value' || Object.values(weights).some(Boolean)), posting);
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    void (async () => {
      setLoading(true); setError('');
      try {
        const response = await api.request<{ rows: Source[]; total: number }>(`/stock-documents/${documentId}/cost-sources?` +
          new URLSearchParams({ search, page: String(page) }), { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
        if (!response.data) throw new Error('Xarajatlar ro‘yxati olinmadi.');
        if (live) { setRows(response.data.rows); setTotal(response.data.total); }
      } catch (cause) { if (live) setError(displayErrorMessage(cause,'Xarajatlar yuklanmadi.')); }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; controller.abort(); };
  }, [documentId, search, page, revision]);
  const refresh = () => { setLoading(true); setRevision(value => value + 1); };
  const body = { expenseDocumentId: selected?.id ?? '', amount: selected?.amount ?? '', method,
    ...(method === 'weight' ? { weights: items.map(item => ({ stockDocumentItemId: item.id, unitWeightKg: weights[item.id] ?? '' })) } : {}), reason };
  const clear = () => { setSelected(null); setReason(''); setMethod('value'); setWeights({}); };
  return <section aria-label={tr("Taqsimotni tayyorlash: {value1}",{value1:String(documentNo)})} className="my-3 rounded-lg border p-3 space-y-3">
    <h4 className="font-semibold">{tr("Mavjud xarajatdan taqsimot tayyorlash")}</h4>
    <p>{tr("Shu filialda oldin qayd etilgan kapitalizatsiya xarajati tanlanadi. Tayyorlash yangi xarajat, pul yoki tannarx yozuvini yaratmaydi.")}</p>
    <Input label={tr("Taqsimot uchun xarajat qidirish")} value={search} maxLength={200} disabled={posting}
      onChange={event => { setLoading(true); setSearch(event.target.value); setPage(1); }} />
    {loading && <p role="status">{tr("Xarajatlar yuklanmoqda…")}</p>}
    {error && <p role="alert">{uiMessage(error)}</p>}
    {!loading && !error && !rows.length && <p>{tr("Mos, taqsimlanmagan kapitalizatsiya xarajati yo‘q.")}</p>}
    <Pagination page={page} pages={Math.ceil(total / 20)} busy={loading || posting}
      onPage={value => { setLoading(true); setPage(value); }} retry={refresh} />
    {selected && <p>{tr("Tanlangan original xarajat:")}{' '}{selected.reason} · {selected.amount} · {selected.id}</p>}
    <DurableMutation path={`/stock-documents/${documentId}/cost-plans`} returnPath={returnPath} body={body}
      label={tr("Kirim xarajatini tayyorlash")} onSavingChange={setPosting}
      canSubmit={!loading && !error} allowNew={Boolean(selected) && reason.trim().length >= 3}
      review={[tr("Kirim: {value1}",{value1:String(documentNo)}), tr("Xarajat: {value1}",{value1:String(selected?.id ?? 'Tanlanmagan')}), tr("Original summa: {value1}",{value1:String(selected?.amount ?? '—')}),
        tr("Usul: {value1}",{value1:String(method)}), reason, ...(method === 'weight' ? items.map(item => `${item.id}: ${weights[item.id] ?? ''} kg/baza`) : []),
        tr("Faqat tayyor taqsimot saqlanadi. Inventory va COGSga qo‘llanmaydi.")]}
      onDone={(_result, originalBody) => {
        if (JSON.stringify(originalBody) === JSON.stringify(body)) clear();
        refresh(); onDone();
      }}>
      {rows.map(row => <Button key={row.id} variant="outline"
        onClick={() => setSelected(row)}>
        {tr("Xarajatni tanlash:")}{' '}{row.reason} · {row.amount} · {row.category?.name ?? tr("Toifa")}
      </Button>)}
      <Select label={tr("Saqlanadigan taqsimot usuli")} value={method} onChange={event => setMethod(event.target.value)}
        options={[{ value: 'value', label: tr("Original qiymat") }, { value: 'quantity', label: tr("Bir xil bazaviy birlik miqdori") }, { value: 'weight', label: tr("Vazn") }]} />
      {method === 'weight' && items.map((item, index) => <Input key={item.id} label={tr("Saqlanadigan taqsimot qatori {value1}: kg / bazaviy birlik",{value1:String(index + 1)})}
        inputMode="decimal" maxLength={19} value={weights[item.id] ?? ''}
        onChange={event => setWeights(previous => ({ ...previous, [item.id]: event.target.value }))} />)}
      <Input label={tr("Taqsimotni tayyorlash sababi")} value={reason} maxLength={2000} onChange={event => setReason(event.target.value)} />
      <Button variant="outline" onClick={() => { if (discard()) clear(); }}>{tr("Tayyorlash qoralamasini tozalash")}</Button>
    </DurableMutation>
  </section>;
}
