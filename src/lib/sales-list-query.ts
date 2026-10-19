import {parseListQuery} from './list-query';
export const saleListStatuses = ['', 'draft', 'completed', 'voided', 'partially_returned', 'returned'] as const;
export const saleListSorts = ['newest', 'oldest', 'amount_desc', 'amount_asc', 'receipt'] as const;
export type SaleListSort = typeof saleListSorts[number];

// The same contract is used by the URL-driven UI and the API. Invalid values are
// rejected rather than silently turning a broken filter into an unfiltered list.
export function parseSalesListQuery(params: Pick<URLSearchParams, 'get'>) {
  const {page,limit,skip,search,sort}=parseListQuery(params,saleListSorts,'newest');
  const status = params.get('status') ?? '';
  if (!saleListStatuses.some(value => value === status)) {
    throw new Error('INVALID_FILTER');
  }
  return { page, limit, skip, status, sort: sort as SaleListSort, search };
}
