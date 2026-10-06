'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {api} from '@/lib/api';
import {useAuth} from '@/context/AuthContext';
import type {Sale} from '@/types';
import Button from '@/components/ui/Button';
export default function Drafts(){
 const {organization,role,user}=useAuth();const [rows,setRows]=useState<Sale[]>([]),[page,setPage]=useState(1),[pages,setPages]=useState(1),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{if(!organization)return;setBusy(true);setError('');try{const response=await api.sales.list({organizationId:organization.id,status:'draft',page,limit:20});setRows(response.data??[]);setPages(response.pagination?.totalPages??1);}catch(e){setError(e instanceof Error?e.message:'Qoralamalar yuklanmadi');}finally{setBusy(false);}},[organization,page]);
 useEffect(()=>{void Promise.resolve().then(load);},[load]);
 return <div className="space-y-4"><h1 className="text-2xl font-bold">Server qoralamalari</h1><p>Faqat serverga yetgan qoralamalar. Boshqa qurilmadagi faqat lokal savat bu ro‘yxatda yo‘q. O‘z qoralamangizni ayni kassa va faol smenada davom ettiring. Natijasi noma’lum savdoni yangidan yaratmang.</p><Link href="/help#device">Qurilma ishdan chiqsa yordam</Link><Button onClick={load} disabled={busy}>Yangilash</Button>{busy&&<p role="status">Yuklanmoqda...</p>}{error&&<p role="alert">{error}</p>}{!busy&&!error&&!rows.length&&<p>Serverda qoralama yo‘q.</p>}
 {rows.map(row=><article key={row.id} className="p-4 bg-white border rounded space-y-2"><h2 className="font-bold">{row.receiptNo}</h2><p>{row.totalAmount} so‘m · {row.createdAt} · {row.items?.length} qator</p>{row.cashierId===user?.id&&<Link className="underline text-blue-800" href={'/pos?draft='+row.id}>Qoralamani ochish</Link>}{role!=='cashier'&&<Button variant="danger" onClick={async()=>{if(!confirm('Faqat ushbu qoralamani bekor qilasizmi?'))return;try{await api.sales.void(row.id);await load();}catch(e){setError(e instanceof Error?e.message:'Bekor qilinmadi');}}}>Qoralamani bekor qilish</Button>}</article>)}<div className="flex gap-3"><Button disabled={page===1||busy} onClick={()=>setPage(p=>p-1)}>Oldingi</Button><span>{page} / {Math.max(pages,1)}</span><Button disabled={page>=pages||busy} onClick={()=>setPage(p=>p+1)}>Keyingi</Button></div></div>
}
