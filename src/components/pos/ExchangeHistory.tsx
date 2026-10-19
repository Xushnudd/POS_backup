'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';


import {useTranslation} from '@/context/LocaleContext';

import {useEffect,useState} from 'react';import Link from 'next/link';import {api} from '@/lib/api';
type Row={id:string;originalSaleId:string;replacementSaleId:string;cashDifference:string;debtDifference:string;cashTendered:string;cashChange:string;createdAt:string};
export default function ExchangeHistory({saleId}:{saleId:string}){
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();
const [rows,setRows]=useState<Row[]>([]),[error,setError]=useState('');useEffect(()=>{let live=true;void api.request<Row[]>('/exchanges?saleId='+saleId).then(r=>{if(live)setRows(r.data??[])}).catch(e=>{if(live)setError(displayErrorMessage(e))});return()=>{live=false}},[saleId]);return <section aria-label={tr("Almashtirish hujjatlari")}>{error&&<p role="alert">{uiMessage(error)}</p>}{rows.map(row=><article key={row.id}><p>{tr("Almashtirish: naqd farq")}{' '}{row.cashDifference}{tr("; nasiya farqi")}{' '}{row.debtDifference}{tr("; haqiqiy berilgan naqd")}{' '}{row.cashTendered}{tr("; qaytim")}{' '}{row.cashChange}.</p><Link href={'/sales/'+row.originalSaleId}>{tr("Original savdo")}</Link>{' · '}<Link href={'/sales/'+row.replacementSaleId}>{tr("Almashtirishdagi yangi savdo")}</Link></article>)}</section>}
