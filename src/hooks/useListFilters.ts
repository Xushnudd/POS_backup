'use client';
import {useMemo} from 'react';
import {useListQuery} from './useListQuery';
// Stable applied values for effect dependencies; financial form drafts remain
// independent. Only explicitly listed filter names are forwarded to the API.
export function useListFilters<T extends string>(sorts:readonly T[],defaultSort:T,fields:readonly string[],prefix=''){
 const state=useListQuery(sorts,defaultSort,prefix);
 const serialized=JSON.stringify(Object.fromEntries(fields.map(key=>[key,state.params.get(prefix+key)??'']).filter(([,value])=>value)));
 const filters=useMemo(()=>JSON.parse(serialized) as Record<string,string>,[serialized]);
 return {...state,filters};
}
