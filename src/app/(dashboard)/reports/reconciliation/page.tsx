'use client'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useOrganization } from '@/context/OrganizationContext'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
const names:Record<string,string>={inventory:'Ombor qoldig‘i',sales:'Savdo va to‘lov',returns:'Qaytarish summasi',shifts:'Yopilgan smena'}
const labels:Record<string,string>={productName:'Mahsulot',receiptNo:'Chek',returnReceiptNo:'Qaytarma chek',expected:'Kutilgan',actual:'Saqlangan',difference:'Farq',itemAmount:'Chek qatorlari jami',paymentAmount:'Original to‘lov jami'}
export default function ReconciliationPage(){
 const {stores}=useOrganization()
 const [kind,setKind]=useState('inventory'),[storeId,setStoreId]=useState(''),[page,setPage]=useState(1)
 const [rows,setRows]=useState<Record<string,unknown>[]>([]),[total,setTotal]=useState(0)
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const load=useCallback(async()=>{
  setBusy(true);setError('')
  try{const result=await api.reports.reconciliation({kind,storeId:storeId||undefined,page});setRows(result.data??[]);setTotal(result.pagination?.total??0)}
  catch(error){setError(error instanceof Error?error.message:'Hisobni tekshirib bo‘lmadi')}
  finally{setBusy(false)}
 },[kind,storeId,page])
 useEffect(()=>{void Promise.resolve().then(load)},[load])
 const columns=rows.length?Object.keys(rows[0]).filter(key=>labels[key]):[]
 return <div className="space-y-4">
  <h1 className="text-xl font-bold">Qoldiq va pul hisobini solishtirish</h1>
  <p className="text-sm">Bu tekshiruv farqlarni ko‘rsatadi. Tarixni avtomatik o‘zgartirmaydi. Sababni tekshirib, vakolatli tuzatish hujjati bilan hal qiling. Harakat hujjatisiz kiritilgan eski boshlang‘ich qoldiq ham farq sifatida chiqadi.</p>
  <div className="flex flex-wrap gap-3">
   <select aria-label="Tekshiruv turi" value={kind} onChange={e=>{setKind(e.target.value);setPage(1)}} className="border rounded-lg p-2">{Object.entries(names).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
   <select aria-label="Filial" value={storeId} onChange={e=>{setStoreId(e.target.value);setPage(1)}} className="border rounded-lg p-2"><option value="">Vakolatli barcha filiallar</option>{stores.map(store=><option key={store.id} value={store.id}>{store.name}</option>)}</select>
   <Button onClick={()=>{void load()}} disabled={busy}>Qayta tekshirish</Button>
  </div>
  {error?<p role="alert" className="text-red-700">{error}</p>:busy?<LoadingSpinner/>:<>
   <p role="status">Aniqlangan farqlar: {total}</p>
   {rows.length>0 && <div className="overflow-auto bg-white border rounded-xl"><table className="w-full text-sm"><thead><tr><th className="p-3 text-left">Filial</th>{columns.map(key=><th key={key} className="p-3 text-left">{labels[key]}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={index} className="border-t"><td className="p-3">{stores.find(store=>store.id===row.storeId)?.name??String(row.storeId)}</td>{columns.map(key=><td key={key} className="p-3">{String(row[key]??'—')}</td>)}</tr>)}</tbody></table></div>}
   <div className="flex gap-2"><Button disabled={page===1} onClick={()=>setPage(old=>old-1)}>Oldingi</Button><span>{page}</span><Button disabled={page*50>=total} onClick={()=>setPage(old=>old+1)}>Keyingi</Button></div>
  </>}
 </div>
}
