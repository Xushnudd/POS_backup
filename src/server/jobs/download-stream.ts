import {AccessError} from '../auth/policy'
let active=0
export function acquireExportDownload(){
 if(active>=2)throw new AccessError(429,'EXPORT_DOWNLOAD_BUSY','Hozir katta fayllar yuklanmoqda; bir necha soniyadan keyin qayta urinib ko‘ring',3)
 active++;let released=false
 return ()=>{if(!released){released=true;active--}}
}
// Retain at most two bounded source buffers per process. Each emitted chunk
// owns its bytes, so the final queued chunk does not retain the entire file.
export function exportDownloadStream(data:Uint8Array,release:()=>void,signal:AbortSignal){
 let offset=0,done=false,timer:ReturnType<typeof setTimeout>|undefined,controller:ReadableStreamDefaultController<Uint8Array>
 const finish=()=>{if(done)return;done=true;data=new Uint8Array(0);if(timer)clearTimeout(timer);signal.removeEventListener('abort',abort);release()}
 const abort=()=>{if(!done){controller.error(new Error('Download cancelled'));finish()}}
 return new ReadableStream<Uint8Array>({
  start(value){controller=value;if(signal.aborted){abort();return}signal.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>{if(!done){controller.error(new Error('Download time limit exceeded'));finish()}},300000);timer.unref()},
  pull(value){if(done)return;if(offset>=data.byteLength){value.close();finish();return}const end=Math.min(offset+65536,data.byteLength);value.enqueue(new Uint8Array(data.subarray(offset,end)));offset=end},
  cancel(){finish()},
 })
}
