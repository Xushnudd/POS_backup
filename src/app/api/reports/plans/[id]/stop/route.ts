import {NextRequest,NextResponse} from 'next/server';
import {withApi} from '@/server/api';
import {consumeLimit} from '@/server/auth/rate-limit';
import {reportContext} from '@/server/reports/http-context';
import {stopScheduleSchema} from '@/server/reports/schedule-contract';
import {stopSchedule} from '@/server/reports/schedules';
export const POST=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
  const context=await reportContext(request);await consumeLimit('report.plan.stop',context.organizationId+':'+context.userId,10,60000);
  return NextResponse.json({success:true,data:await stopSchedule(context,(await params).id,stopScheduleSchema.parse(await request.json()))});
});
