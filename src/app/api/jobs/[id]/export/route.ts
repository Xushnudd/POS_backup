import {NextRequest,NextResponse} from 'next/server'
import {verifyToken,getRequestToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {withApi} from '@/server/api'
import {consumeLimit} from '@/server/auth/rate-limit'
import {readJobExport,jobExportMetadata,jobExportBytes,completeExportDownload} from '@/server/jobs/catalog-export'
import {acquireExportDownload,asyncExportDownloadStream} from '@/server/jobs/download-stream'
import {requestTrace} from '@/server/observability/context'

export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
 const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED')
 await consumeLimit('job.export.download',ctx.organizationId+':'+ctx.userId,10,60000)
 if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')
 const id=(await params).id
 if(request.nextUrl.searchParams.get('metadata')==='1')return NextResponse.json({success:true,data:await jobExportMetadata(ctx,id)})
 const release=acquireExportDownload()
 try{
  const file=await readJobExport(ctx,id,{auditDownload:false,signal:request.signal})
  const trace=requestTrace.getStore()
  const complete=()=>trace?requestTrace.run(trace,()=>completeExportDownload(ctx,id)):completeExportDownload(ctx,id)
  return new Response(asyncExportDownloadStream(jobExportBytes(ctx,file),complete,release,request.signal),{headers:{'Content-Type':file.mime,'Content-Length':String(file.size),'Content-Disposition':'attachment; filename="'+file.filename+'"','X-Export-SHA256':file.sha256,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})
 }catch(error){release();throw error}
},{binary:true})
