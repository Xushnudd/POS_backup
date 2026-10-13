import {NextRequest,NextResponse} from 'next/server';
import {withApi} from '@/server/api';
import {reportContext} from '@/server/reports/http-context';
import {listScheduleRuns} from '@/server/reports/schedules';
export const GET=withApi(async(request:NextRequest,{params}:{params:Promise<{id:string}>})=>{
  const context=await reportContext(request),page=Number(request.nextUrl.searchParams.get('page')??1);
  const result=await listScheduleRuns(context,(await params).id,page);
  return NextResponse.json({success:true,data:result.rows,pagination:{page,limit:20,total:result.total,totalPages:Math.ceil(result.total/20)}});
});
