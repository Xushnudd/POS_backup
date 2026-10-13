'use client';
import {useSearchParams} from 'next/navigation';
import {useCallback} from 'react';
import {parseListQuery} from '@/lib/list-query';
export function useListQuery<T extends string>(sorts:readonly T[],defaultSort:T){
  const params=useSearchParams();
  let query:ReturnType<typeof parseListQuery<T>>|undefined;
  try{query=parseListQuery(params,sorts,defaultSort);}catch{/* An invalid URL must be visible, not silently broaden a query. */}
  const changeQuery=useCallback((changes:Record<string,string>)=>{
    const next=new URLSearchParams(params.toString());
    for(const [key,value] of Object.entries(changes)){if(value)next.set(key,value);else next.delete(key);}
    window.history.pushState(null,'',window.location.pathname+(next.size?'?'+next.toString():'')+window.location.hash);
  },[params]);
  return {query,params,changeQuery};
}
