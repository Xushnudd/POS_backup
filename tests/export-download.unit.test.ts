import {test} from 'node:test'
import assert from 'node:assert/strict'
import {acquireExportDownload,exportDownloadStream} from '@/server/jobs/download-stream'
test('Export streams bound concurrent buffers and release slots after exact chunked consumption',async()=>{
 const first=acquireExportDownload(),second=acquireExportDownload();assert.throws(()=>acquireExportDownload(),{code:'EXPORT_DOWNLOAD_BUSY'});const bytes=Uint8Array.from({length:131073},(_,i)=>i%251),stream=exportDownloadStream(bytes,first,new AbortController().signal),reader=stream.getReader(),chunks:Uint8Array[]=[];
 for(;;){const item=await reader.read();if(item.done)break;assert.ok(item.value.length<=65536);chunks.push(item.value)}assert.deepEqual(Buffer.concat(chunks),Buffer.from(bytes));first();const fresh=acquireExportDownload();assert.throws(()=>acquireExportDownload(),{code:'EXPORT_DOWNLOAD_BUSY'});fresh();second();
});
test('HTTP abort and stream cancellation free their slots exactly once',async()=>{
 const abort=new AbortController(),one=acquireExportDownload(),two=acquireExportDownload(),reader=exportDownloadStream(new Uint8Array(200000),one,abort.signal).getReader();await reader.read();abort.abort();await assert.rejects(()=>reader.read());one();const replacement=acquireExportDownload();assert.throws(()=>acquireExportDownload(),{code:'EXPORT_DOWNLOAD_BUSY'});await exportDownloadStream(new Uint8Array(200000),two,new AbortController().signal).cancel();two();const another=acquireExportDownload();replacement();another();
});
