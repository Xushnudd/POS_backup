export const productListSorts=['name_asc','name_desc','price_asc','price_desc','sku'] as const;
export const customerListSorts=['name_asc','name_desc','newest','oldest'] as const;
export const categoryListSorts=['order','name_asc','name_desc'] as const;
export const unitListSorts=['name_asc','name_desc','code'] as const;
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
