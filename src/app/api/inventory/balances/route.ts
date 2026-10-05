import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { withApi } from '@/server/api'
import { prisma } from '@/lib/prisma'
import { scopedPrisma } from '@/server/auth/scoped-prisma'
import { verifyToken, getRequestToken } from '@/lib/auth'
import { AccessError } from '@/server/auth/policy'
export const GET=withApi(async(request:NextRequest)=>{
 const context=await verifyToken(getRequestToken(request)??'')
 if (!context) throw new AccessError(401,'UNAUTHORIZED')
 const q=new URL(request.url).searchParams,page=Number(q.get('page')??1),limit=Number(q.get('limit')??50)
 const store=q.get('storeId'),category=q.get('categoryId'),low=q.get('lowStock')==='true'
 const scope=context.role==='owner'?Prisma.empty:context.storeIds.length?Prisma.sql`AND b."storeId" IN (${Prisma.join(context.storeIds)})`:Prisma.sql`AND FALSE`
 const filter=Prisma.sql`FROM "InventoryBalance" b JOIN "Store" s ON s.id=b."storeId" JOIN "Product" p ON p.id=b."productId"
 WHERE s."organizationId"=${context.organizationId} AND p."organizationId"=${context.organizationId} ${scope}
 ${store?Prisma.sql`AND b."storeId"=${store}`:Prisma.empty} ${category?Prisma.sql`AND p."categoryId"=${category}`:Prisma.empty}
 ${low?Prisma.sql`AND p."minStock">0 AND b.quantity<p."minStock"`:Prisma.empty}`
 const [keys,count]=await prisma.$transaction([
  prisma.$queryRaw<{storeId:string;productId:string}[]>(Prisma.sql`SELECT b."storeId",b."productId" ${filter} ORDER BY b."updatedAt" DESC,b."storeId",b."productId" LIMIT ${limit} OFFSET ${(page-1)*limit}`),
  prisma.$queryRaw<{count:bigint}[]>(Prisma.sql`SELECT count(*) ${filter}`),
 ],{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead})
 const db=scopedPrisma(context)
 const rows=keys.length?await db.inventoryBalance.findMany({where:{OR:keys},include:{product:{include:{category:true}},store:true}}):[]
 const balances=keys.map(key=>rows.find(row=>row.storeId===key.storeId&&row.productId===key.productId))
 const total=Number(count[0].count)
 return NextResponse.json({success:true,data:balances,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}})
})
