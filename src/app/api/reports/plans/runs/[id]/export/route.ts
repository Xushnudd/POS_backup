import {NextRequest} from 'next/server';
import {z} from 'zod';
import {withApi} from '@/server/api';
import {consumeLimit} from '@/server/auth/rate-limit';
import {reportContext} from '@/server/reports/http-context';
import {scheduledArtifact} from '@/server/reports/schedule-artifact';
import {acquireExportDownload,exportDownloadStream} from '@/server/jobs/download-stream';
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
  const context=await reportContext(request);await consumeLimit('report.plan.export',context.organizationId+':'+context.userId,10,60000);
  const format=z.enum(['json','csv','xlsx','pdf']).parse(request.nextUrl.searchParams.get('format')??'json'),view=z.enum(['kpi','forecast','backtest']).parse(request.nextUrl.searchParams.get('view')??'kpi');
  const release=acquireExportDownload();
  try{
    const file=await scheduledArtifact(context,(await params).id,format,view);
    return new Response(exportDownloadStream(file.data,release,request.signal),{headers:{'Content-Type':file.mime,'Content-Disposition':'attachment; filename="'+file.filename+'"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  }catch(error){release();throw error;}
},{binary:true});
