import {parseListQuery,customerListSorts} from '@/lib/list-query'
import {cursorExport,EXPORT_PAGE_SIZE} from '../cursor'
import {normalizeCustomerPhone} from "@/server/customers/identity"
import {assertLiveContext} from "@/server/operations"
import {activeStatus} from "@/server/catalog/status"
import {csv,numeric,EXPORT_CAP} from "@/server/exports/csv"
import {consumeLimit} from "@/server/auth/rate-limit"
import {Prisma} from "@prisma/client"
import {AccessError} from "@/server/auth/policy"
import {scopedPrisma} from "@/server/auth/scoped-prisma"
import {NextResponse} from "next/server"
import type {NextRequest} from 'next/server'
import type {TokenPayload} from '@/lib/auth'
// Shared authorized query. HTTP authentication remains in the route wrapper.
export async function queryCustomers(payload:TokenPayload,request:NextRequest) {
  try {
    const db = scopedPrisma(payload)

    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')
    let query:ReturnType<typeof parseListQuery<typeof customerListSorts[number]>>
    try{query=parseListQuery(searchParams,customerListSorts,'name_asc')}catch(error){throw new AccessError(400,error instanceof Error?error.message:'INVALID_FILTER')}
    const {search,page,limit,skip,sort}=query

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_PARAM', message: 'Organization ID talab qilinadi' } },
        { status: 400 }
      )
    }

    const where: Prisma.CustomerWhereInput = {
      organizationId,
      ...activeStatus(searchParams, payload),
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: normalizeCustomerPhone(search)??search, mode: 'insensitive' } },
        ...(normalizeCustomerPhone(search)?[{canonicalPhone:{contains:normalizeCustomerPhone(search)!}}]:[]),
      ]
    }

    const orderBy:Prisma.CustomerOrderByWithRelationInput[]=sort==='name_desc'?[{fullName:'desc'},{id:'desc'}]
      :sort==='newest'?[{createdAt:'desc'},{id:'desc'}]:sort==='oldest'?[{createdAt:'asc'},{id:'asc'}]
      :[{fullName:'asc'},{id:'asc'}]
    if(searchParams.get('format')==='csv'){
      if(payload.role!=='owner')throw new AccessError(403,'FORBIDDEN')
      await consumeLimit('customers.export',payload.organizationId+':'+payload.userId,10,60000)
      const data=await db.$transaction(async tx=>{
      await assertLiveContext(tx,payload)
        const total=await tx.customer.count({where})
        if(total>EXPORT_CAP)throw new AccessError(413,'EXPORT_TOO_LARGE','Eksport 10000 qatordan oshdi; filtrni toraytiring')
        const rows=await cursorExport(cursor=>tx.customer.findMany({where,orderBy,select:{id:true,fullName:true,phone:true,address:true,creditLimit:true},take:EXPORT_PAGE_SIZE,...(cursor?{cursor:{id:cursor},skip:1}:{})}))
        const debts=await tx.debtEntry.groupBy({by:['customerId'],where:{customerId:{in:rows.map(row=>row.id)}},_sum:{amount:true}})
        const balances=new Map(debts.map(row=>[row.customerId,row._sum.amount??new Prisma.Decimal(0)]))
        return {filename:'customers-'+payload.organizationId+'.csv',content:csv([['ID','Mijoz','Telefon','Manzil','Nasiya limiti','Joriy ledger qoldig‘i'],...rows.map(row=>[row.id,row.fullName,row.phone,row.address,numeric(row.creditLimit),numeric(balances.get(row.id)??0)])])}
      },{isolationLevel:'RepeatableRead'})
      return NextResponse.json({success:true,data})
    }

    const [customers, total] = await db.$transaction(async tx=>{
      await assertLiveContext(tx,payload)
      const rows=await tx.customer.findMany({where,orderBy,skip,take:limit})
      return [rows,await tx.customer.count({where})] as const
    },{isolationLevel:'RepeatableRead'})

    return NextResponse.json({
      success: true,
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })

  } catch (error) {
    if (error instanceof AccessError) throw error
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Server xatosi' } },
      { status: 500 }
    )
  }
}
