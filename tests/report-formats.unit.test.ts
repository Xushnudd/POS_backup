import test from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'
import {reportArtifact,reportRows} from '@/server/exports/report-formats'
import {csv,numeric} from '@/server/exports/csv'
import {reportExportSchema} from '@/server/jobs/report-export'
import {REPORT_EXPORTS} from '@/lib/report-exports'
import {REPORT_QUERIES} from '@/server/jobs/report-queries'
test('CSV format conversion preserves every row, quoted newline, exact decimal and safe plain XLSX cells',async()=>{
 const content=csv([['Name','Cost'],...Array.from({length:1001},(_,n)=>['Row '+n+',"\n=SUM(1,2)',numeric('12345678901234.123456',6)])]),rows=reportRows(content)
 assert.equal(rows.length,1002);assert.equal(rows[1][1],'12345678901234.123456');assert.ok(rows[1][0].includes('\n'))
 const artifact=await reportArtifact({content,filename:'test.csv'},'xlsx','2026-10-11T00:00:00Z')
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(artifact.data as never)
 const sheet=workbook.worksheets[0];assert.equal(sheet.rowCount,1002);assert.equal(sheet.getCell('B1002').value,'12345678901234.123456');assert.equal(typeof sheet.getCell('A2').value,'string')
 const printable=await reportArtifact({content:csv([['<script>alert(1)</script>','IMG'],['<img src="https://evil.invalid/x">','=1+1']]),filename:'report.csv'},'pdf','2026-10-11T00:00:00Z')
 assert.equal(printable.mime,'text/html; charset=utf-8');assert.ok(!printable.data.toString().includes('<script>'));assert.ok(!printable.data.toString().includes('<img'));assert.ok(printable.data.toString().includes('Content-Security-Policy'));assert.ok(printable.data.toString().includes('PDF sifatida saqlash'))
 assert.throws(()=>reportRows('"unterminated'),{code:'EXPORT_CORRUPTED'});assert.throws(()=>reportRows('"a"b'),{code:'EXPORT_CORRUPTED'})
})
test('Every report selector has a reviewed shared query; forbidden/ignored filters and arbitrary paths fail validation',()=>{
 assert.deepEqual(Object.keys(REPORT_EXPORTS).sort(),Object.keys(REPORT_QUERIES).sort())
 const base={report:'reports-sales',format:'xlsx',filters:{storeId:'branch'}}
 assert.ok(reportExportSchema.safeParse(base).success)
 for(const filters of [{organizationId:'foreign'},{page:'2'},{token:'secret'},{url:'https://evil.invalid'},{lowStock:'true'}])assert.equal(reportExportSchema.safeParse({...base,filters}).success,false)
 assert.equal(reportExportSchema.safeParse({...base,report:'../../auth/users'}).success,false)
})
