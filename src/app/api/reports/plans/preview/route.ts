import {NextRequest,NextResponse} from 'next/server';
import {withApi} from '@/server/api';
import {consumeLimit} from '@/server/auth/rate-limit';
import {reportContext} from '@/server/reports/http-context';
import {previewSchedule} from '@/server/reports/schedules';
export const POST=withApi(async(request:NextRequest)=>{
  const context=await reportContext(request);await consumeLimit('report.plan.preview',context.organizationId+':'+context.userId,5,60000);
  return NextResponse.json({success:true,data:await previewSchedule(context,await request.json())});
});
