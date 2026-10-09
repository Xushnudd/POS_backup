'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {api} from '@/lib/api';
import {useAuth} from '@/context/AuthContext';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import DurableMutation from '@/components/forms/DurableMutation';
import PendingActions from '@/components/forms/PendingActions';
type Data={product:{id:string;unit:string};conversions:{tradeUnit:string;ratio:string;isActive:boolean}[]};
export default function ProductUnits(){const {id}=useParams<{id:string}>(),{organization,user,role}=useAuth();return user&&organization&&role==='owner'?<Editor key={organization.id+user.id+id} id={id}/>:<p>Konvertatsiyani faqat egasi boshqaradi.</p>;}
function Editor({id}:{id:string}){
 const path='/products/'+id+'/units';const [data,setData]=useState<Data|null>(null),[tradeUnit,setTradeUnit]=useState(''),[ratio,setRatio]=useState('12'),[isActive,setActive]=useState(true),[reason,setReason]=useState(''),[revision,setRevision]=useState(0),[error,setError]=useState('');
 useEffect(()=>{let live=true;void api.request<Data>(path).then(r=>{if(live){setData(r.data??null);setError('')}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Yuklanmadi')});return()=>{live=false}},[path,revision]);const refresh=()=>setRevision(n=>n+1);
 return <div className="space-y-4"><h1 className="text-2xl font-bold">Mahsulot birlik konvertatsiyasi</h1><Link href="/products">Mahsulotlar</Link><Link href="/settings/units">Birliklar katalogi</Link><p>Masalan: 1 quti = 12 dona. Qoldiq va narx asosiy birlikda hisoblanadi. Kirimda tannarxni asosiy birlik uchun kiriting. Nisbat o‘zgarsa ochiq savat qayta ko‘rib chiqiladi; yakunlangan hujjatdagi nisbat saqlanadi.</p>{error&&<p role="alert">{error}<Button onClick={refresh}>Qayta yuklash</Button></p>}{!data?<p role="status">Yuklanmoqda...</p>:<><p>Asosiy birlik: {data.product.unit}</p><ul>{data.conversions.map(row=><li key={row.tradeUnit}>1 {row.tradeUnit} = {row.ratio} {data.product.unit} — {row.isActive?'faol':'o‘chirilgan'} <Button onClick={()=>{setTradeUnit(row.tradeUnit);setRatio(row.ratio);setActive(row.isActive)}}>Nisbatni tanlash</Button></li>)}</ul><PendingActions prefix={path} returnPath={path} revision={revision} onDone={refresh}/><DurableMutation key={revision} path={path} returnPath={path} body={{tradeUnit,ratio,isActive,reason}} label="Konvertatsiyani saqlash" review={['1 '+tradeUnit+' = '+ratio+' '+data.product.unit,'Faol: '+isActive,'Sabab: '+reason]} onDone={refresh}><Input label="Savdo birligi kodi" value={tradeUnit} maxLength={32} onChange={e=>setTradeUnit(e.target.value)}/><Input label="Asosiy birliklar soni" value={ratio} onChange={e=>setRatio(e.target.value)}/><label className="flex gap-2"><input type="checkbox" checked={isActive} onChange={e=>setActive(e.target.checked)}/>Konvertatsiya faol</label><Input label="Konvertatsiya sababi" value={reason} minLength={3} maxLength={2000} onChange={e=>setReason(e.target.value)}/></DurableMutation></>}</div>;
}
