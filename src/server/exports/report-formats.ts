import ExcelJS from 'exceljs'
import {createHash} from 'node:crypto'
import {AccessError} from '@/server/auth/policy'
export type ReportFormat='csv'|'xlsx'|'pdf'
const MAX_BYTES=16*1024*1024,MAX_ROWS=10100,MAX_COLUMNS=40
// RFC4180: quoted delimiters, embedded newlines, escaped quotes and exact decimal strings.
export function reportRows(content:string):string[][]{
 if(Buffer.byteLength(content)>MAX_BYTES)throw new AccessError(413,'EXPORT_TOO_LARGE')
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false
 const text=content.replace(/^\uFEFF/,'')
 const endCell=()=>{row.push(cell);cell='';closed=false;if(row.length>MAX_COLUMNS)throw new AccessError(413,'EXPORT_TOO_LARGE')}
 const endRow=()=>{endCell();rows.push(row);row=[];if(rows.length>MAX_ROWS)throw new AccessError(413,'EXPORT_TOO_LARGE')}
 for(let n=0;n<text.length;n++){const c=text[n];if(quoted){if(c==='"'){if(text[n+1]==='"'){cell+='"';n++}else{quoted=false;closed=true}}else cell+=c;continue}
  if(c==='"'){if(cell||closed)throw new AccessError(409,'EXPORT_CORRUPTED');quoted=true}
  else if(c===',')endCell()
  else if(c==='\r'||c==='\n'){if(c==='\r'&&text[n+1]==='\n')n++;endRow()}
  else{if(closed)throw new AccessError(409,'EXPORT_CORRUPTED');cell+=c}
 }
 if(quoted)throw new AccessError(409,'EXPORT_CORRUPTED')
 if(cell||row.length||closed)endRow()
 return rows
}
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
export async function reportArtifact(source:{content:string;filename:string;title?:string},format:ReportFormat,asOf:string){
 const rows=reportRows(source.content),base=source.filename.replace(/\.csv$/i,'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,150)||'report'
 let data:Buffer,mime:string,filename:string
 if(format==='csv'){data=Buffer.from(source.content);mime='text/csv; charset=utf-8';filename=base+'.csv'}
 else if(format==='xlsx'){
  const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('POS');book.created=new Date(asOf)
  for(const row of rows)sheet.addRow(row) // All cells are strings: no binary rounding and no formula objects.
  sheet.columns.forEach(column=>{column.width=24});sheet.getRow(1).font={bold:true}
  data=Buffer.from(await book.xlsx.writeBuffer());mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';filename=base+'.xlsx'
 }else{
  // Native browser Print → Save as PDF; no browser/server runtime dependency or external URLs.
  const columns=Math.max(1,...rows.map(row=>row.length))
  const headerIndex=rows.findIndex(row=>row.length===columns),title=source.title??base
  const renderRow=(row:string[],index:number,header=false)=>'<tr data-export-row="'+index+'">'+row.map(cell=>header?'<th scope="col">'+escape(cell)+'</th>':'<td>'+escape(cell)+'</td>').join('')+'</tr>'
  const metadata=headerIndex>0?'<table class="metadata"><tbody>'+rows.slice(0,headerIndex).map((row,index)=>renderRow(row,index)).join('')+'</tbody></table>':''
  const html='<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;; style-src &apos;unsafe-inline&apos;; base-uri &apos;none&apos;; form-action &apos;none&apos;"><title>'+escape(title)+'</title><style>@page{size:A3 landscape;margin:10mm}body{font:10px sans-serif;color:#111}table{border-collapse:collapse;width:100%;table-layout:fixed}thead{display:table-header-group}th{text-align:left;background:#eee}.metadata{width:auto;margin-bottom:12px}td,th{border:1px solid #bbb;padding:3px;white-space:pre-wrap;overflow-wrap:anywhere}tr{break-inside:avoid}h1{font-size:16px}.instructions{font-size:12px}@media print{.instructions{display:none}}</style></head><body><h1>'+escape(title)+'</h1><p class="instructions">Brauzerda Chop etish (Ctrl+P) → PDF sifatida saqlash. Barcha filtrlangan qatorlar ushbu hujjatda.</p><p>Hisob holati UTC: '+escape(asOf)+'</p>'+metadata+'<table><colgroup>'+Array.from({length:columns},()=>'<col style="width:'+String(100/columns)+'%">').join('')+'</colgroup><thead>'+renderRow(rows[headerIndex]??[],headerIndex,true)+'</thead><tbody>'+rows.slice(headerIndex+1).map((row,index)=>renderRow(row,index+headerIndex+1)).join('')+'</tbody></table></body></html>'
  data=Buffer.from(html);mime='text/html; charset=utf-8';filename=base+'.print.html'
 }
 if(data.length>MAX_BYTES)throw new AccessError(413,'EXPORT_TOO_LARGE')
 return {data,size:data.length,sha256:createHash('sha256').update(data).digest('hex'),rowCount:rows.length,filename,mime,asOf}
}
