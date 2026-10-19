import type { customerStatement } from './ledger'
// Only trusted numeric values bypass text protection. Quote every cell so
// delimiters, quotes and line breaks cannot become additional CSV columns.
export function csvText(value:unknown):string {
 const text=value==null?'':String(value)
 const safe=/^[\s\uFEFF]*[=+\-@]/u.test(text)?"'"+text:text
 return '"'+safe.replaceAll('"','""')+'"'
}
export function statementCsv(statement:Awaited<ReturnType<typeof customerStatement>>,period:{from:string|null;to:string|null}):string {
 const row=(values:unknown[])=>values.map(csvText).join(',')
 const money=(value:{toFixed:(digits:number)=>string})=>'"'+value.toFixed(2)+'"'
 const lines=[row(['Mijoz ID',statement.customer.id]),row(['Mijoz',statement.customer.fullName]),row(['Tashkilot vaqt zonasi',statement.timezone]),row(['Davr boshlanishi',period.from]),row(['Davr oxiri',period.to])]
 for(const [label,value] of [['Davr boshidagi qarz',statement.summary.openingBalance],['Qarz oshishi',statement.summary.increases],['Qarz kamayishi',statement.summary.reductions],['Davr oxiridagi qarz',statement.summary.closingBalance],['Joriy qarz',statement.summary.currentBalance]] as const)lines.push(csvText(label)+','+money(value))
 for(const [label,value] of [['Joriy muddati o‘tgan qarz',statement.aging.overdue],['Joriy muddati kelmagan qarz',statement.aging.upcoming],['Joriy muddatsiz qarz',statement.aging.noDueDate],['Joriy taqsimlanmagan qarz',statement.aging.unallocated]] as const)lines.push(csvText(label)+','+money(value))
 lines.push('',row(['Yozuv ID','Manba','Manba ID','Savdo ID','Chek','Boshlang‘ich hujjat ID','Summa','Qoldiq','Sana (UTC)','Muddat (UTC)','Xodim','Sabab']))
 for(const entry of statement.entries) {
  lines.push([...[entry.id,entry.sourceType,entry.sourceId,entry.saleId,entry.receiptNo,entry.debtOriginId].map(csvText),money(entry.amount),money(entry.balance),...[entry.effectiveAt.toISOString(),entry.dueAt?.toISOString(),entry.actorName,entry.note].map(csvText)].join(','))
 }
 return '\uFEFF'+lines.join('\r\n')+'\r\n'
}
