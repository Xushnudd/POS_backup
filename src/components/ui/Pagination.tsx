'use client';
import {useTranslation} from '@/context/LocaleContext';

import Button from './Button';
export default function Pagination({page,pages,busy,blocked=false,onPage,retry}:{page:number;pages:number;busy:boolean;blocked?:boolean;onPage:(page:number)=>void;retry?:()=>void}){
 const {t:tr}=useTranslation();

 return <div className="flex items-center gap-3 mt-3"><Button disabled={busy||blocked||page<=1} onClick={()=>onPage(page-1)}>{tr("Oldingi")}</Button><span>{page} / {Math.max(1,pages)}</span><Button disabled={busy||blocked||page>=pages} onClick={()=>onPage(page+1)}>{tr("Keyingi")}</Button>{retry&&<Button disabled={busy} onClick={retry}>{tr("Qayta yuklash")}</Button>}</div>;
}
