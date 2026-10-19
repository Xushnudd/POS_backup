import {test} from 'node:test'
import assert from 'node:assert/strict'
import {acquireExportDownload,exportDownloadStream} from '@/server/jobs/download-stream'
import {asyncExportDownloadStream} from '@/server/jobs/download-stream'
test('Export streams bound concurrent buffers and release slots after exact chunked consumption',async()=>{
 const first=acquireExportDownload(),second=acquireExportDownload();assert.throws(()=>acquireExportDownload(),{code:'EXPORT_DOWNLOAD_BUSY'});const bytes=Uint8Array.from({length:131073},(_,i)=>i%251),stream=exportDownloadStream(bytes,first,new AbortController().signal),reader=stream.getReader(),chunks:Uint8Array[]=[];
 for(;;){const item=await reader.read();if(item.done)break;assert.ok(item.value.length<=65536);chunks.push(item.value)}assert.deepEqual(Buffer.concat(chunks),Buffer.from(bytes));first();const fresh=acquireExportDownload();assert.throws(()=>acquireExportDownload(),{code:'EXPORT_DOWNLOAD_BUSY'});fresh();second();
});
test('HTTP abort and stream cancellation free their slots exactly once',async()=>{
 const abort=new AbortController(),one=acquireExportDownload(),two=acquireExportDownload(),reader=exportDownloadStream(new Uint8Array(200000),one,abort.signal).getReader();await reader.read();abort.abort();await assert.rejects(()=>reader.read());one();const replacement=acquireExportDownload();assert.throws(()=>acquireExportDownload(),{code:'EXPORT_DOWNLOAD_BUSY'});await exportDownloadStream(new Uint8Array(200000),two,new AbortController().signal).cancel();two();const another=acquireExportDownload();replacement();another();
});
test('Async DB download has true pull backpressure, exact bytes and completion only after EOF',async()=>{
 let reads=0,completed=0,released=0
 async function* source(){for(let i=0;i<3;i++){reads++;yield new Uint8Array([i])}}
 const stream=asyncExportDownloadStream(source(),async()=>{completed++},()=>{released++},new AbortController().signal)
 await new Promise(resolve=>setImmediate(resolve));assert.equal(reads,0)
 const reader=stream.getReader();assert.deepEqual((await reader.read()).value,new Uint8Array([0]));assert.equal(reads,1);assert.equal(completed,0)
 assert.deepEqual((await reader.read()).value,new Uint8Array([1]));assert.deepEqual((await reader.read()).value,new Uint8Array([2]));assert.equal(completed,0)
 assert.equal((await reader.read()).done,true);assert.equal(completed,1);assert.equal(released,1)
})
test('Async download cancellation, source failure and audit failure release once without false EOF',async()=>{
 for(const mode of ['cancel','source','audit']){
  let completed=0,released=0,closed=0
  async function* source(){try{yield new Uint8Array([1]);if(mode==='source')throw Error('Synthetic source failure')}finally{closed++}}
  const reader=asyncExportDownloadStream(source(),async()=>{if(mode==='audit')throw Error('Synthetic audit failure');completed++},()=>{released++},new AbortController().signal).getReader()
  await reader.read()
  if(mode==='cancel')await reader.cancel();else await assert.rejects(reader.read())
  assert.equal(released,1);assert.equal(completed,0);assert.equal(closed,1)
 }
})
