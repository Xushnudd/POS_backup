import 'exceljs' // Trace the native dependency into the standalone image.
import {join} from 'node:path'
import {Worker} from 'node:worker_threads'
import {AccessError} from '../auth/policy'
// Parsing an untrusted workbook never shares the API heap. Two bounded workers
// and a deadline protect against zip bombs, hostile XML and oversized CSV rows.
const parser=`const {parentPort,workerData:d}=require('node:worker_threads');
const ExcelJS=require(d.module),{Readable}=require('node:stream');
(async()=>{const workbook=new ExcelJS.Workbook(),bytes=Buffer.from(d.content,'base64');
if(d.format==='xlsx')await workbook.xlsx.load(bytes);else await workbook.csv.read(Readable.from([bytes]),{map:v=>v});
if(workbook.worksheets.length!==1)throw Error('ONE_SHEET_REQUIRED');const sheet=workbook.worksheets[0];
if(sheet.rowCount>1001||sheet.columnCount>30)throw Error('IMPORT_ROW_LIMIT');const rows=[];
sheet.eachRow({includeEmpty:true},(row,n)=>{const values=[];for(let i=1;i<=sheet.columnCount;i++){const v=row.getCell(i).value;
if(v!==null&&typeof v!=='string'&&typeof v!=='number')throw Error('PLAIN_VALUES_REQUIRED');
const text=v===null?'':String(v);if(text.length>4000)throw Error('IMPORT_CELL_LIMIT');values.push(text)}rows.push(values)});
parentPort.postMessage({rows})})().catch(()=>parentPort.postMessage({error:true}));`
let active=0
export async function spreadsheetRows(format:'csv'|'xlsx',content:string):Promise<string[][]>{
 if(!/^[A-Za-z0-9+/]*={0,2}$/.test(content)||content.length>700000||Buffer.from(content,'base64').toString('base64')!==content)throw new AccessError(413,'IMPORT_FILE_LIMIT')
 if(active>=2)throw new AccessError(429,'IMPORT_BUSY','Import band; original fayl bilan qayta tekshiring',5)
 active++
 return new Promise((resolve,reject)=>{
  // Resolve at native runtime: bundlers can otherwise replace resolve() with
  // a numeric module ID, which a separate Node worker cannot require.
  let finished=false,worker:Worker;try{const nativeRequire=process.getBuiltinModule('module').createRequire(join(process.cwd(),'package.json'));worker=new Worker(parser,{eval:true,workerData:{module:nativeRequire.resolve('exceljs'),format,content},resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:16,stackSizeMb:4}})}catch{active--;reject(new AccessError(503,'IMPORT_BUSY'));return}
  const finish=(rows?:string[][])=>{if(finished)return;finished=true;clearTimeout(timer);active--;void worker.terminate();if(rows)resolve(rows);else reject(new AccessError(400,'INVALID_IMPORT_FILE','Fayl oddiy qiymatli bitta jadval, eng ko‘pi1000 qator va30 ustun bo‘lsin'))}
  const timer=setTimeout(()=>finish(),10000)
  worker.once('message',(m:{rows?:string[][]})=>finish(m.rows));worker.once('error',()=>finish());worker.once('exit',()=>{if(!finished)finish()})
 })
}
