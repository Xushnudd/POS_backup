'use client';

import {useTranslation} from '@/context/LocaleContext';

import {useState} from 'react';
export default function DiscountInput({label,amount,percent,onChange}:{label:string;amount:number;percent?:number;onChange:(amount:number,percent?:number)=>void}){
 const {t:tr}=useTranslation();

 const [mode,setMode]=useState<'amount'|'percent'>(percent===undefined?'amount':'percent');
 return <div className="flex gap-2"><select aria-label={label+' turi'} className="text-gray-900 bg-white border rounded-lg" value={mode} onChange={e=>{const next=e.target.value as typeof mode;setMode(next);onChange(0,next==='percent'?0:undefined);}}><option value="amount">{tr("Summa")}</option><option value="percent">{tr("Foiz")}</option></select><input aria-label={label} type="number" min="0" max={mode==='percent'?100:undefined} step="0.01" value={(mode==='percent'?percent:amount)??''} onChange={e=>{const value=Number(e.target.value);if(Number.isFinite(value)&&value>=0&&(mode!=='percent'||value<=100))onChange(mode==='amount'?value:0,mode==='percent'?value:undefined);}} className="w-full min-w-0 text-gray-900 bg-white border rounded-lg p-2"/></div>;
}
