import {NextRequest,NextResponse} from 'next/server';
import {withApi} from '@/server/api';
import {consumeLimit} from '@/server/auth/rate-limit';
import {reportContext} from '@/server/reports/http-context';
import {configureScheduleSchema} from '@/server/reports/schedule-contract';
import {configureSchedule,listSchedules} from '@/server/reports/schedules';
export const GET=withApi(async(request:NextRequest)=>{
  const context=await reportContext(request);return NextResponse.json({success:true,data:await listSchedules(context)});
});
export const POST=withApi(async(request:NextRequest)=>{
  const context=await reportContext(request);await consumeLimit('report.plan.configure',context.organizationId+':'+context.userId,10,60000);
  return NextResponse.json({success:true,data:await configureSchedule(context,configureScheduleSchema.parse(await request.json()))});
});
