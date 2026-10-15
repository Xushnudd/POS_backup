'use client';
import {useTranslation} from '@/context/LocaleContext';

import { useState } from 'react';
import { api } from '@/lib/api';
import { downloadCsv } from '@/lib/download';
import Button from './Button';
export default function CsvExportButton({path,params,label='CSV eksport'}:{path:Parameters<typeof api.csvExport>[0];params:Record<string,string>;label?:string}){
 const {t:tr}=useTranslation();

 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <div><Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const response=await api.csvExport(path,params);if(!response.data)throw new Error('Eksport natijasi kelmadi');downloadCsv(response.data);}catch(error){setError(error instanceof Error?error.message:'Eksport amalga oshmadi');}finally{setBusy(false);}}}>{busy?tr("Eksport tayyorlanmoqda..."):label}</Button>{error&&<p role="alert" className="text-xs text-red-600">{error}</p>}</div>;
}
