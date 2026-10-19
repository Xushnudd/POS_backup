import {test} from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
// Extended conditional formatting executes ExcelJS's actual CommonJS UUID v4
// dependency path. A real XLSX roundtrip also protects exact decimal text.
test('ExcelJS retains exact exported strings and extended formatting with the patched UUID dependency',async()=>{
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Synthetic report')
 sheet.addRow(['000001','12345678901234.123456',10])
 sheet.addConditionalFormatting({ref:'C1:C1',rules:[{type:'iconSet',iconSet:'3Stars',priority:1,cfvo:[{type:'percent',value:0},{type:'percent',value:33},{type:'percent',value:67}]}]})
 const bytes=await book.xlsx.writeBuffer(),restored=new ExcelJS.Workbook();await restored.xlsx.load(bytes)
 const row=restored.getWorksheet('Synthetic report')!.getRow(1)
 assert.equal(row.getCell(1).value,'000001');assert.equal(row.getCell(2).value,'12345678901234.123456');assert.equal(row.getCell(3).value,10)
 const formatting=restored.getWorksheet('Synthetic report')! as unknown as {conditionalFormattings:{rules:{x14Id:string}[]}[]}
 const rule=formatting.conditionalFormattings[0].rules[0]
 assert.match(rule.x14Id,/^\{[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}\}$/)
})
