import { Prisma } from '@prisma/client'
import { AccessError } from '../auth/policy'
import { dateRange } from '../reports/dates'
import { searchTerm } from '../catalog/queries'
export function documentFilters(q:URLSearchParams,timezone:string):Prisma.StockDocumentWhereInput{
 const where:Prisma.StockDocumentWhereInput={}
 const type=q.get('documentType'),status=q.get('status'),search=searchTerm(q)
 if(type&&!['purchase','adjustment','transfer_out','transfer_in','return_in','reversal'].includes(type))throw new AccessError(400,'INVALID_DOCUMENT_TYPE')
 if(status&&!['draft','confirmed'].includes(status))throw new AccessError(400,'INVALID_STATUS')
 if(type)where.documentType=type
 if(status)where.status=status
 if(q.get('storeId'))where.storeId=q.get('storeId')!
 if(q.get('supplierId'))where.supplierId=q.get('supplierId')!
 if(search)where.documentNo={contains:search,mode:'insensitive'}
 const range=dateRange(q.get('from'),q.get('to'),timezone)
 if(Object.keys(range).length)where.createdAt=range
 return where
}
export function transferFilters(q:URLSearchParams,timezone:string):Prisma.StockTransferWhereInput{
 const where:Prisma.StockTransferWhereInput={}
 const status=q.get('status')
 if(status&&!['draft','sent','received','closed','cancelled'].includes(status))throw new AccessError(400,'INVALID_STATUS')
 if(status)where.status=status
 if(q.get('fromStoreId'))where.fromStoreId=q.get('fromStoreId')!
 if(q.get('toStoreId'))where.toStoreId=q.get('toStoreId')!
 const range=dateRange(q.get('from'),q.get('to'),timezone)
 if(Object.keys(range).length)where.createdAt=range
 return where
}
