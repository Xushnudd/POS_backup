export const productListSorts=['name_asc','name_desc','price_asc','price_desc','sku'] as const;
export const customerListSorts=['name_asc','name_desc','newest','oldest'] as const;
export const categoryListSorts=['order','name_asc','name_desc'] as const;
export const unitListSorts=['name_asc','name_desc','code'] as const;
export const namedListSorts=['name_asc','name_desc','newest','oldest'] as const;
export const journalListSorts=['newest','oldest'] as const;
export const inventoryListSorts=['newest','oldest','name_asc','name_desc','quantity_asc','quantity_desc'] as const;
export const financialListSorts=['newest','oldest','amount_asc','amount_desc'] as const;
export const batchListSorts=['expiry_asc','expiry_desc','code'] as const;
export const serialListSorts=['code_asc','code_desc','newest','oldest'] as const;
export const replenishmentListSorts=['store','name_asc','name_desc','quantity_asc','quantity_desc','suggested_desc'] as const;
export const purchaseReportSorts=['default','name_asc','name_desc','value_asc','value_desc'] as const;
export const breakdownReportSorts=['revenue_desc','revenue_asc','name_asc','name_desc'] as const;
export const supplierBalanceSorts=['source','name_asc','name_desc','unpaid_asc','unpaid_desc','overdue_desc'] as const;
export const reportListSorts=['default','amount_asc','amount_desc'] as const;
export const reconciliationListSorts=['source','expected_asc','expected_desc'] as const;
export const variantListSorts=['source','name_asc','name_desc','price_asc','price_desc'] as const;
export const duplicateListSorts=['source','name_asc','name_desc'] as const;
export type ProductListSort=typeof productListSorts[number];
export type CustomerListSort=typeof customerListSorts[number];
export function parseListQuery<T extends string>(params:Pick<URLSearchParams,'get'>,sorts:readonly T[],defaultSort:T,defaultLimit=20){
  const pageText=params.get('page')??'1',limitText=params.get('limit')??String(defaultLimit);
  const page=Number(pageText),limit=Number(limitText),skip=(page-1)*limit;
  if(!/^\d+$/.test(pageText)||!/^\d+$/.test(limitText)||!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(limit)||limit<1||limit>200||skip>2147483647)throw Error('INVALID_PAGINATION');
  const search=(params.get('search')??'').trim(),sort=params.get('sort')??defaultSort;
  if(search.length>200||!sorts.some(value=>value===sort))throw Error('INVALID_FILTER');
  return{page,limit,skip,search,sort:sort as T};
}
