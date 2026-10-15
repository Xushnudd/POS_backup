'use client';



import {useTranslation} from '@/context/LocaleContext';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import {useUnsavedChanges} from '@/hooks/useUnsavedChanges';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';

type ReceiptItem = { id: string; productId: string; quantity: string; unitCost: string };
type OriginalItem = { productId: string; productName: string; unit: string };
type Result = { previewOnly: true; amount: string; lines: {
  id: string; quantity: string; unit: string; allocatedAmount: string;
  landedUnitCost: string; roundingResidual: string;
}[] };

export default function LandedCostPreview({ documentId, documentNo, items, originals }: {
  documentId: string; documentNo: string; items: ReceiptItem[]; originals: OriginalItem[];
}) {
 const {t:tr}=useTranslation();

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('value');
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useUnsavedChanges(Boolean(amount||method!=='value'||Object.values(weights).some(value=>value)),busy);
  const mounted = useRef(true), pending = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const invalidate = () => { setResult(null); setError(''); };
  async function calculate(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setResult(null);
    try {
      const response = await api.request<Result>(`/stock-documents/${documentId}/landed-cost-preview`, {
        method: 'POST', signal: AbortSignal.timeout(15_000), body: JSON.stringify({ amount, method,
          ...(method === 'weight' ? { weights: items.map(item => ({ stockDocumentItemId: item.id, unitWeightKg: weights[item.id] ?? '' })) } : {}),
        }),
      });
      if (mounted.current) {
        if (!response.data?.previewOnly) throw new Error('Hisoblash javobi olinmadi. Qayta urinib ko‘ring.');
        setResult(response.data);
      }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Hisoblash bajarilmadi. Qayta urinib ko‘ring.');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const name = (id: string) => {
    const item = items.find(row => row.id === id);
    return originals.find(row => row.productId === item?.productId)?.productName ?? 'Kirim qatori';
  };
  return <section aria-label={`Kirim xarajatlari: ${documentNo}`} className="my-3 rounded-lg border p-3 space-y-3">
    <h4 className="font-semibold">{documentNo}{tr(": qo‘shimcha xarajat taqsimoti")}</h4>
    <p>{tr("Bu oldindan hisoblash. Tannarx, ombor, qarz yoki pul balansi o‘zgarmaydi.")}</p>
    <form onSubmit={calculate} className="space-y-3">
      <Input label={tr("Qo‘shimcha xarajat summasi")} inputMode="decimal" value={amount} required disabled={busy}
        maxLength={15} onChange={event => { invalidate(); setAmount(event.target.value); }} />
      <Select label={tr("Taqsimlash usuli")} value={method} disabled={busy} onChange={event => { invalidate(); setMethod(event.target.value); }}
        options={[{ value: 'value', label: tr("Original xarid qiymati bo‘yicha") }, { value: 'quantity', label: tr("Bir xil bazaviy birlikdagi miqdor bo‘yicha") }, { value: 'weight', label: tr("Vazn bo‘yicha") }]} />
      {method === 'weight' && items.map(item => <Input key={item.id} label={`${name(item.id)}: kg / bazaviy birlik`}
        inputMode="decimal" value={weights[item.id] ?? ''} required disabled={busy} maxLength={19}
        onChange={event => { invalidate(); setWeights(previous => ({ ...previous, [item.id]: event.target.value })); }} />)}
      <Button type="submit" isLoading={busy}>{busy ? tr("Hisoblanmoqda") : error ? tr("Qayta hisoblash") : tr("Taqsimotni hisoblash")}</Button>
    </form>
    {busy&&<p role="status">{tr("Taqsimot hisoblanmoqda…")}</p>}
    {!busy&&(amount||method!=='value'||Object.values(weights).some(value=>value))&&<p role="status">{tr("Taqsimot formasi saqlanmagan; oldindan hisoblash hujjat yaratmaydi.")}</p>}
    {error && <p role="alert">{error}</p>}
    {result && <div role="status" className="overflow-x-auto">
      <p>{tr("Hisoblandi. Jami xarajat:")}{' '}{result.amount}{tr(". Moliyaviy hujjat yaratilmagan.")}</p>
      <table className="w-full text-left"><caption className="sr-only">{tr("Original kirim bo‘yicha xarajat taqsimoti")}</caption>
        <thead><tr><th scope="col">{tr("Mahsulot")}</th><th scope="col">{tr("Qabul miqdori")}</th><th scope="col">{tr("Xarajat ulushi")}</th><th scope="col">{tr("Hisoblangan birlik tannarxi")}</th><th scope="col">{tr("Yaxlitlash qoldig‘i")}</th></tr></thead>
        <tbody>{result.lines.map(line => <tr key={line.id}><td>{name(line.id)}</td><td>{line.quantity} {line.unit}</td><td>{line.allocatedAmount}</td><td>{line.landedUnitCost}</td><td>{line.roundingResidual}</td></tr>)}</tbody>
      </table>
      <p>{tr("Yaxlitlash qoldig‘i xarajat ulushining bir qismi; birlik tannarxiga ko‘paytirib jami summani qayta hisoblamang.")}</p>
    </div>}
  </section>;
}
