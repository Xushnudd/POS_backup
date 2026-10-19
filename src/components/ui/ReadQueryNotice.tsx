'use client';
import {useTranslation} from '@/context/LocaleContext';

import Button from './Button';
export default function ReadQueryNotice({invalid,reset}:{invalid:boolean;reset:()=>void}){
 const {t:tr}=useTranslation();

 return invalid?<p role="alert">{tr("Tarixning URL sahifasi noto‘g‘ri yoki qo‘llanmagan filtr bor.")}{' '}<Button variant="outline" onClick={reset}>{tr("Tarix filtrini tozalash")}</Button></p>:null;
}
