'use client';
import {useSearchParams} from 'next/navigation';
import {useCallback} from 'react';
import {parseListQuery} from '@/lib/list-query';
export function useListQuery<T extends string>(sorts:readonly T[],defaultSort:T,prefix='',defaultLimit=20){
  const params=useSearchParams();
  let query:ReturnType<typeof parseListQuery<T>>|undefined;
  try{query=parseListQuery({get:key=>params.get(prefix+key)},sorts,defaultSort,defaultLimit);}catch{/* An invalid URL must be visible, not silently broaden a query. */}
  const changeQuery=useCallback((changes:Record<string,string>)=>{
    const next=new URLSearchParams(params.toString());
    for(const [key,value] of Object.entries(changes)){if(value)next.set(prefix+key,value);else next.delete(prefix+key);}
    window.history.pushState(null,'',window.location.pathname+(next.size?'?'+next.toString():'')+window.location.hash);
  },[params,prefix]);
  const replaceQuery=useCallback((changes:Record<string,string>)=>{
    const next=new URLSearchParams(params.toString());
    for(const [key,value] of Object.entries(changes)){if(value)next.set(prefix+key,value);else next.delete(prefix+key);}
    window.history.replaceState(null,'',window.location.pathname+(next.size?'?'+next.toString():'')+window.location.hash);
  },[params,prefix]);
  return {query,params,changeQuery,replaceQuery};
}
