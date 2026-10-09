import {NextRequest} from 'next/server'
import {withApi} from '@/server/api'
import {getRequestToken,verifyToken} from '@/lib/auth'
import {AccessError} from '@/server/auth/policy'
import {consumeLimit} from '@/server/auth/rate-limit'
import {readJobExport} from '@/server/jobs/catalog-export'
import {acquireExportDownload,exportDownloadStream} from '@/server/jobs/download-stream'
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{const ctx=await verifyToken(getRequestToken(request)??'');if(!ctx)throw new AccessError(401,'UNAUTHORIZED');await consumeLimit('job.export.download',ctx.organizationId+':'+ctx.userId,10,60000);if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED');const release=acquireExportDownload();try{const file=await readJobExport(ctx,(await params).id);return new Response(exportDownloadStream(file.data!,release,request.signal),{headers:{'Content-Type':file.mime,'Content-Disposition':'attachment; filename="'+file.filename+'"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}catch(error){release();throw error}},{binary:true})
