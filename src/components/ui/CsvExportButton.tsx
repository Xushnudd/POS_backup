'use client';
import {errorMessage as displayErrorMessage} from '@/i18n/errors';

import {useTranslation} from '@/context/LocaleContext';

import { useState } from 'react';
import { api } from '@/lib/api';
import { downloadCsv } from '@/lib/download';
import Button from './Button';
export default function CsvExportButton({path,params,label}:{path:Parameters<typeof api.csvExport>[0];params:Record<string,string>;label?:string}){
 const {message:uiMessage}=useTranslation();

 const {t:tr}=useTranslation();

 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <div><Button variant="outline" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const response=await api.csvExport(path,params);if(!response.data)throw new Error('Eksport natijasi kelmadi');downloadCsv(response.data);}catch(error){setError(displayErrorMessage(error,'Eksport amalga oshmadi'));}finally{setBusy(false);}}}>{busy?tr("Eksport tayyorlanmoqda..."):(label??tr('CSV eksport'))}</Button>{error&&<p role="alert" className="text-xs text-red-600">{uiMessage(error)}</p>}</div>;
}
