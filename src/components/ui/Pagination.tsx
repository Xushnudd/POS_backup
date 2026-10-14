'use client';
import Button from './Button';
export default function Pagination({page,pages,busy,blocked=false,onPage,retry}:{page:number;pages:number;busy:boolean;blocked?:boolean;onPage:(page:number)=>void;retry?:()=>void}){
 return <div className="flex items-center gap-3 mt-3"><Button disabled={busy||blocked||page<=1} onClick={()=>onPage(page-1)}>Oldingi</Button><span>{page} / {Math.max(1,pages)}</span><Button disabled={busy||blocked||page>=pages} onClick={()=>onPage(page+1)}>Keyingi</Button>{retry&&<Button disabled={busy} onClick={retry}>Qayta yuklash</Button>}</div>;
}
