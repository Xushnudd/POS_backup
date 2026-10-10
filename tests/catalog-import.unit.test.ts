import test from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import {spreadsheetRows} from '@/server/catalog/spreadsheets'
import {xlsxTable} from '@/server/exports/xlsx'
test('CSV preserves exact numeric text and quoted commas; XLSX strings roundtrip without formula execution',async()=>{
 const text='name,sku,barcode,unit,salePrice,costPrice\r\n"Text, value",00123,000123,dona,0.10,90071992547409.123456\r\n'
 const rows=await spreadsheetRows('csv',Buffer.from(text).toString('base64'));assert.equal(rows[1][1],'00123');assert.equal(rows[1][5],'90071992547409.123456');assert.equal(rows[1][0],'Text, value')
 const xlsx=await xlsxTable([rows[0],['=SUM(1,2)','@sku','+barcode','dona','0.10','90071992547409.123456']]);const back=await spreadsheetRows('xlsx',xlsx);assert.equal(back[1][0],'=SUM(1,2)');assert.equal(back[1][5],'90071992547409.123456')
})
test('Workbook active content, multiple sheets, malformed/base64/large files fail closed',async()=>{
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet('Data');sheet.addRow(['sku']);sheet.getCell('A2').value={formula:'1+1',result:2};await assert.rejects(async()=>spreadsheetRows('xlsx',Buffer.from(await book.xlsx.writeBuffer()).toString('base64')),/Fayl oddiy/)
 book.addWorksheet('Other');await assert.rejects(async()=>spreadsheetRows('xlsx',Buffer.from(await book.xlsx.writeBuffer()).toString('base64')))
 await assert.rejects(()=>spreadsheetRows('xlsx',Buffer.from('invalid').toString('base64')));await assert.rejects(()=>spreadsheetRows('csv','%%%'));await assert.rejects(()=>spreadsheetRows('csv','A'.repeat(700004)))
 const huge='sku\n'+'entry\n'.repeat(1001);await assert.rejects(()=>spreadsheetRows('csv',Buffer.from(huge).toString('base64')),{status:413,code:'IMPORT_FILE_LIMIT'})
})
