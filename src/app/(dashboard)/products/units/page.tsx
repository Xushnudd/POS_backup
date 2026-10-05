'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { CatalogUnit } from '@/types'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
export default function UnitsPage(){
 const [units,setUnits]=useState<CatalogUnit[]>([]),[code,setCode]=useState(''),[name,setName]=useState(''),[precision,setPrecision]=useState(0)
 const [editing,setEditing]=useState<CatalogUnit|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const load=useCallback(async()=>{try{const result=await api.units.list();setUnits(result.data??[])}catch(error){setError(error instanceof Error?error.message:'Birliklar yuklanmadi')}},[])
 useEffect(()=>{void Promise.resolve().then(load)},[load])
 return <div className="max-w-3xl space-y-4">
  <h1 className="text-xl font-bold">Mahsulot birliklari</h1><Link href="/products" className="text-blue-700 text-sm">Mahsulotlarga qaytish</Link>
  <p className="text-sm">Aniqlik kasrdan keyingi raqamlar sonidir: dona — 0, kilogramm — 6 gacha. Mahsulotda ishlatilgan birlik aniqligi o‘zgarmaydi. Quti boshqa birlikka avtomatik aylantirilmaydi.</p>
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  <Card title={editing?'Birlik nomini tahrirlash':'Yangi birlik'}><form className="space-y-3" onSubmit={async event=>{
   event.preventDefault();setBusy(true);setError('');
   try{if(editing)await api.units.update(editing.id,{name,precision});else await api.units.create({code,name,precision});setEditing(null);setCode('');setName('');setPrecision(0);await load()}
   catch(error){setError(error instanceof Error?error.message:'Birlik saqlanmadi')}finally{setBusy(false)}
  }}><Input label="Kod" value={code} onChange={e=>setCode(e.target.value)} disabled={Boolean(editing)} pattern="[a-z][a-z0-9_-]{0,31}" required/><Input label="Nomi" value={name} onChange={e=>setName(e.target.value)} maxLength={100} required/><Input label="Kasr aniqligi" type="number" value={precision} onChange={e=>setPrecision(Number(e.target.value))} min={0} max={6} step={1} required/><div className="flex gap-2"><Button type="submit" isLoading={busy}>Saqlash</Button>{editing&&<Button type="button" onClick={()=>{setEditing(null);setCode('');setName('');setPrecision(0)}}>Bekor qilish</Button>}</div></form></Card>
  <Card title="Birliklar"><table className="w-full text-sm"><thead><tr><th className="text-left p-2">Kod</th><th className="text-left p-2">Nomi</th><th className="p-2">Aniqlik</th><th className="p-2">Amallar</th></tr></thead><tbody>{units.map(unit=><tr key={unit.id} className="border-t"><td className="p-2">{unit.code}</td><td className="p-2">{unit.name}{unit.isActive?'':' (arxiv)'}</td><td className="p-2 text-center">{unit.precision}</td><td className="p-2"><div className="flex gap-2"><Button size="sm" disabled={busy} onClick={()=>{setEditing(unit);setCode(unit.code);setName(unit.name);setPrecision(unit.precision)}}>Tahrirlash</Button><Button size="sm" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{await api.units.update(unit.id,{isActive:!unit.isActive});await load()}catch(error){setError(error instanceof Error?error.message:'Holat o‘zgarmadi')}finally{setBusy(false)}}}>{unit.isActive?'Arxivlash':'Faollashtirish'}</Button></div></td></tr>)}</tbody></table></Card>
 </div>
}
