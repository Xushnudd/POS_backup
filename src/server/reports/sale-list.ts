import {Prisma} from '@prisma/client';
import {parseListQuery,reportListSorts} from '@/lib/list-query';
import {AccessError} from '../auth/policy';
export function reportSaleList(params:URLSearchParams){
 let query;try{query=parseListQuery(params,reportListSorts,'default',50);}catch(error){throw new AccessError(400,error instanceof Error?error.message:'INVALID_FILTER');}
 const orderBy:Prisma.SaleOrderByWithRelationInput[]=query.sort==='amount_asc'||query.sort==='amount_desc'?[{totalAmount:query.sort==='amount_asc'?'asc':'desc'},{id:'asc'}]:[{completedAt:'desc'},{id:'asc'}];
 const search:Prisma.SaleWhereInput=query.search?{OR:[{receiptNo:{contains:query.search,mode:'insensitive'}},{customer:{fullName:{contains:query.search,mode:'insensitive'}}}]}:{};
 return {...query,orderBy,searchFilter:search};
}
