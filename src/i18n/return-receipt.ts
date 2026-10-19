import type {SaleReturnHistory} from '@/types';
import type {Locale} from './locale';
import {translate,translateKnownLabel,type MessageKey} from './messages';
import {formatLocaleDate,formatLocaleMoney} from './format';
/** Pure display projection. Original names, notes, source IDs and amounts are
 * escaped, never translated or mutated. No financial or printing side effects. */
export function returnReceiptHtml(row:SaleReturnHistory,saleId:string,timeZone:string,locale:Locale):string{
 const text=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
 const t=(key:MessageKey)=>text(translate(key,locale));
 const dispositions:Record<string,MessageKey>={sellable:'Sotiladigan qoldiqqa qaytarilgan',damaged:'Brak — sotiladigan qoldiqqa qo‘shilmagan',write_off:'Hisobdan chiqarilgan'};
 const roles:Record<string,MessageKey>={owner:"Do'kon egasi",admin:'Administrator',cashier:'Kassir'};
 const role=row.approvedRole?(roles[row.approvedRole]?translate(roles[row.approvedRole],locale):row.approvedRole):translate('eski hujjatda noma’lum',locale);
 return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${t('Qaytarma chek')}</title><style>@page{size:80mm 297mm;margin:4mm}body{font:12px system-ui;width:72mm;margin:auto;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}td{border-bottom:1px dashed #999;padding:5px}h1{font-size:16px}</style></head><body><h1>${t('QAYTARMA CHEK — NUSXA')}</h1><p>${t('FISKAL EMAS. Brauzerda Ctrl+P orqali chop etish/PDF saqlash.')}</p><p>${text(row.returnReceiptNo)}</p><p>${t('Original savdo:')} ${text(saleId)}</p><p>${text(formatLocaleDate(row.returnedAt,locale,true,timeZone))} (${text(timeZone)})</p><p>${t('Xodim:')} ${text(row.processor.fullName)}; ${t('tasdiq:')} ${text(role)}</p><p>${t('Sabab:')} ${text(row.reason)}</p><table>${row.items.map(item=>`<tr><td>${text(item.saleItem.productName)}<br>${text(item.quantity)} ${text(item.saleItem.unit)}<br>${text(translateKnownLabel(dispositions[item.disposition]??item.disposition,locale))}</td><td>${text(formatLocaleMoney(item.lineTotal,locale))}</td></tr>`).join('')}</table><p>${t('Qaytarilgan tovar qiymati:')} ${text(formatLocaleMoney(row.refundAmount,locale))}</p><p>${t('Bu qiymatning hammasi naqd refund degani emas; nasiya qismi qarzni kamaytirishi mumkin.')}</p></body></html>`;
}
