'use client';
import {useCallback} from 'react';
import {useListQuery} from './useListQuery';
const sourceOrder=['source'] as const;
/** Append-only journals retain their authoritative chronological/ordinal order.
 * Their read page is shareable; draft bodies and secrets never enter the URL.
 * Unsupported sort/search/limit values are rejected rather than silently ignored.
 */
export function useReadPage(prefix:string,pageSize=20){
 const {query,params,changeQuery}=useListQuery(sourceOrder,'source',prefix,pageSize);
 const invalid=!query||query.limit!==pageSize||!!query.search;
 const page=query?.page??1;
 const setPage=useCallback((next:number|((current:number)=>number))=>changeQuery({page:String(typeof next==='function'?next(page):next)}),[page,changeQuery]);
 const reset=useCallback(()=>changeQuery({page:'',limit:'',sort:'',search:''}),[changeQuery]);
 return {page,setPage,invalid,reset,params,changeQuery};
}
