import {parseListQuery,journalListSorts} from '@/lib/list-query'
import {assertLiveContext} from '@/server/operations'
import {cursorExport,EXPORT_PAGE_SIZE} from '../cursor'
import {csv,numeric,EXPORT_CAP} from "@/server/exports/csv"
import {consumeLimit} from "@/server/auth/rate-limit"
import {dateRange} from "@/server/reports/dates"
import {Prisma} from "@prisma/client"
import {AccessError} from "@/server/auth/policy"
import {scopedPrisma} from "@/server/auth/scoped-prisma"
import {NextResponse} from "next/server"
import {operatorSelect} from "@/server/auth/user-dto"
import type {NextRequest} from 'next/server'
import type {TokenPayload} from '@/lib/auth'
// Shared authorized query. HTTP authentication remains in the route wrapper.
export async function queryShifts(payload:TokenPayload,request:NextRequest) {
  try {
    const db = scopedPrisma(payload)

    const { searchParams } = new URL(request.url)
    const registerId = searchParams.get('registerId')
    const status = searchParams.get('status')
    let query;try{query=parseListQuery(searchParams,journalListSorts,'newest',50)}catch(error){throw new AccessError(400,error instanceof Error?error.message:'INVALID_FILTER')}
    const {page,limit,skip,sort,search}=query,orderBy=[{openedAt:sort==='oldest'?'asc' as const:'desc' as const},{id:'asc' as const}]
    const paginated=['page','limit','search','sort'].some(key=>searchParams.has(key))

    const where: Prisma.ShiftWhereInput = {}

    if(search)where.OR=[{register:{name:{contains:search,mode:'insensitive'}}},{organizationUser:{user:{fullName:{contains:search,mode:'insensitive'}}}}]
    if (registerId) {
      where.registerId = registerId
    }

    if (status) {
      where.status = status
    }

    if(status&&!['open','closed'].includes(status))throw new AccessError(400,'INVALID_STATUS')
    const storeId=searchParams.get('storeId')
    if(storeId)where.register={storeId}
    const organization=await db.organization.findUniqueOrThrow({where:{id:payload.organizationId},select:{timezone:true}})
    const range=dateRange(searchParams.get('from'),searchParams.get('to'),organization.timezone)
    if(Object.keys(range).length)where.openedAt=range
    if(searchParams.get('format')==='csv'){
      if(payload.role==='cashier')throw new AccessError(403,'FORBIDDEN')
      await consumeLimit('shift.export',payload.organizationId+':'+payload.userId,10,60000)
      const data=await db.$transaction(async tx=>{
        const total=await tx.shift.count({where})
        if(total>EXPORT_CAP)throw new AccessError(413,'EXPORT_TOO_LARGE','Eksport 10000 qatordan oshdi; filtrni toraytiring')
        const rows=await cursorExport(cursor=>tx.shift.findMany({where,include:{register:{include:{store:true}},organizationUser:{select:{user:{select:{fullName:true}}}}},orderBy,take:EXPORT_PAGE_SIZE,...(cursor?{cursor:{id:cursor},skip:1}:{})}))
        const cash=(value:Prisma.Decimal|null)=>value===null?'':numeric(value)
        return {filename:'shifts-'+payload.organizationId+'.csv',content:csv([['ID','Filial','Kassa','Xodim','Holat','Ochilgan (UTC)','Yopilgan (UTC)','Boshlang‘ich naqd','Yopilish kutilgan naqd','Sanab chiqilgan','Farq'],...rows.map(row=>[row.id,row.register.store.name,row.register.name,row.organizationUser.user.fullName,row.status,row.openedAt.toISOString(),row.closedAt?.toISOString(),cash(row.openingCash),cash(row.expectedCash),cash(row.countedCash),cash(row.cashDifference)])])}
      },{isolationLevel:'RepeatableRead'})
      return NextResponse.json({success:true,data})
    }
    const result=await db.$transaction(async tx=>{
      await assertLiveContext(tx,payload);
      const total=await tx.shift.count({where});
      const shifts=await tx.shift.findMany({where,include:{register:true,organizationUser:{include:{user:{select:operatorSelect}}}},orderBy,...(paginated?{skip,take:limit}:{})});
      return {success:true,data:shifts,...(paginated?{pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}}:{})};
    },{isolationLevel:'RepeatableRead'});
    return NextResponse.json(result)

  } catch (error) {
    if (error instanceof AccessError) throw error
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}
