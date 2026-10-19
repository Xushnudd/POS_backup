'use client';
import {useTranslation} from '@/context/LocaleContext';

import type {ReactNode} from 'react';
import Input from './Input';
import Select from './Select';
import Button from './Button';
export default function ListFilter({search,sort,label,placeholder,options,disabled=false,onChange,children,reset={},maxLength=200,fields=[]}:{
  search:string;sort:string;label:string;placeholder?:string;options:{value:string;label:string}[];
  disabled?:boolean;onChange:(changes:Record<string,string>)=>void;children?:ReactNode;reset?:Record<string,string>;maxLength?:number;fields?:readonly string[];
}){
 const {t:tr}=useTranslation();

  return <form key={search} className="flex flex-wrap items-end gap-3" onSubmit={event=>{
    event.preventDefault();const form=new FormData(event.currentTarget);
    onChange({search:String(form.get('search')??'').trim(),page:'1',...Object.fromEntries(fields.map(key=>[key,String(form.get(key)??'').trim()]))});
  }}>
    <Input name="search" label={label} placeholder={placeholder} maxLength={maxLength} defaultValue={search} disabled={disabled}/>
    <Button type="submit" disabled={disabled}>{tr("Qidirish")}</Button>
    <Select label={tr("Saralash")} value={sort} disabled={disabled} options={options} onChange={event=>onChange({sort:event.target.value,page:'1'})}/>
    {children}
    <Button disabled={disabled} variant="outline" onClick={()=>onChange({search:'',sort:'',page:'',limit:'',categoryId:'',...reset})}>{tr("Filtrlarni tozalash")}</Button>
  </form>;
}
