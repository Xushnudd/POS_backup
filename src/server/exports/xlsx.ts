import ExcelJS from 'exceljs'
import {AccessError} from '../auth/policy'
// Exact decimal values are strings in XLSX: Excel's binary numbers cannot
// represent every 20,6 cost. Strings also never become executable formulas.
export async function xlsxTable(rows:string[][]){
 if(rows.length>10001||rows.some(r=>r.length>40))throw new AccessError(413,'EXPORT_TOO_LARGE')
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('POS',{views:[{state:'frozen',ySplit:1}]});sheet.addRows(rows);sheet.getRow(1).font={bold:true};sheet.columns.forEach(c=>{c.width=24});if(rows.length)sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:rows[0].length}}
 return Buffer.from(await book.xlsx.writeBuffer()).toString('base64')
}
