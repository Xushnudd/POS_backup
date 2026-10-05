'use client'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { ProductBarcode } from '@/types'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'
export default function ProductBarcodes({productId,readOnly=false}:{productId:string;readOnly?:boolean}){
 const [rows,setRows]=useState<ProductBarcode[]>([]),[value,setValue]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const load=useCallback(async()=>{try{const response=await api.barcodes.list(productId);setRows(response.data??[])}catch(error){setError(error instanceof Error?error.message:'Barkodlar yuklanmadi')}},[productId])
 useEffect(()=>{void Promise.resolve().then(load)},[load])
 return <Card title="Mahsulot barkodlari">
  {error&&<p role="alert" className="text-red-700 text-sm mb-2">{error}</p>}
  <ul className="space-y-2">{rows.map(row=><li key={row.id} className="flex items-center justify-between gap-2"><span className="font-mono text-sm">{row.value}{row.isPrimary?' (asosiy)':''}</span>{!readOnly&&!row.isPrimary&&<Button size="sm" variant="outline" disabled={busy} onClick={async()=>{
   setBusy(true);setError('');try{await api.barcodes.remove(productId,row.id);await load()}catch(error){setError(error instanceof Error?error.message:'Barkod o‘chirilmadi')}finally{setBusy(false)}
  }}>O‘chirish</Button>}</li>)}</ul>
  {!readOnly&&<form className="flex gap-2 items-end mt-4" onSubmit={async event=>{
   event.preventDefault();setBusy(true);setError('');try{await api.barcodes.add(productId,value.trim());setValue('');await load()}catch(error){setError(error instanceof Error?error.message:'Barkod qo‘shilmadi')}finally{setBusy(false)}
  }}><Input label="Qo‘shimcha barkod" value={value} onChange={e=>setValue(e.target.value)} minLength={2} maxLength={200} required/><Button type="submit" isLoading={busy}>Qo‘shish</Button></form>}
 </Card>
}
