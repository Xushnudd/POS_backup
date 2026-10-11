'use client'
import {useRef,useState} from 'react'
import {api} from '@/lib/api'
import {useAuth} from '@/context/AuthContext'
import type {OrganizationMember} from '@/types'
type Base='admin'|'cashier'
type Profile={id:string;name:string;baseRole:Base;permissions:string[];revision:number;isActive:boolean;_count:{members:number}}
type Listing={rows:Profile[];total:number;page:number;catalog:{key:string;baseRoles:string[]}[];templates:{name:string;baseRole:Base;permissions:string[]}[]}
type Editor={id?:string;name:string;baseRole:Base;permissions:string[];revision?:number;isActive:boolean;reason:string}
const initial:Editor={name:'',baseRole:'admin',permissions:[],isActive:true,reason:''}
export default function RolesPage(){
 const {user,organization,role}=useAuth()
 if(role!=='owner')return <p role="alert">Rollarni faqat tashkilot egasi boshqaradi.</p>
 return user&&organization?<RolesPanel key={`${user.id}:${organization.id}:${role}`} organizationId={organization.id}/>:null
}
function RolesPanel({organizationId}:{organizationId:string}){
 const [data,setData]=useState<Listing|null>(null),[members,setMembers]=useState<OrganizationMember[]>([]),[editor,setEditor]=useState<Editor|null>(null)
 const [search,setSearch]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const [memberId,setMemberId]=useState(''),[profileId,setProfileId]=useState('')
 const flight=useRef(false),pending=useRef<{signature:string;id:string}|null>(null)
 async function load(page=1){
  const [roles,staff]=await Promise.all([api.request<Listing>(`/roles?page=${page}&search=${encodeURIComponent(search)}`),api.organizations.users(organizationId)])
  setData(roles.data??null);setMembers(staff.data??[])
 }
 async function perform(work:()=>Promise<void>){
  if(flight.current)return
  flight.current=true;setBusy(true);setError('');setMessage('')
  try{await work()}catch(failure){setError(failure instanceof Error?failure.message:'Amal bajarilmadi')}
  finally{flight.current=false;setBusy(false)}
 }
 async function save(){
  if(!editor)return
  const {id,revision,baseRole,isActive,...fields}=editor
  const body=id?{...fields,isActive,expectedRevision:revision}:{...fields,baseRole}
  // A failed acknowledgement can be retried with the same immutable request identity.
  const signature=JSON.stringify({id,body})
  if(pending.current?.signature!==signature)pending.current={signature,id:crypto.randomUUID()}
  await api.request(id?`/roles/${id}`:'/roles',{method:id?'PUT':'POST',body:JSON.stringify({...body,operationId:pending.current.id})})
  pending.current=null;setEditor(null);setMessage('Rol saqlandi. Vakolat o‘zgargan xodimlar qayta kirishi kerak.');await load(data?.page??1)
 }
 return <div className="space-y-5"><h1 className="text-2xl font-bold">Rollar va vakolatlar</h1>
  <p>Maxsus rol asosiy admin yoki kassir huquqlarini cheklaydi. Filial chegaralari va qo‘shimcha tasdiqlar saqlanadi. Shaxsiy xavfsizlik va tashkilotni almashtirish imkoniyatlari saqlanadi.</p>
  <p>Namunalar hech kimga avtomatik biriktirilmaydi. O‘qish vakolati asosiy rolga ko‘rinadigan ma’lumotlarni ham ochishi mumkin; xodimga berishdan oldin tekshiring.</p>
  <form onSubmit={event=>{event.preventDefault();void perform(()=>load())}} className="flex gap-3"><label>Rol nomi<input disabled={busy} maxLength={100} value={search} onChange={event=>setSearch(event.target.value)} className="block border rounded p-2"/></label><button disabled={busy}>Rollarni yuklash</button></form>
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  {data&&<><div className="flex flex-wrap gap-3"><button disabled={busy} onClick={()=>setEditor({...initial,permissions:[]})}>Yangi rol</button>{data.templates.map(template=><button key={template.name} disabled={busy} onClick={()=>setEditor({...initial,...template,permissions:[...template.permissions]})}>{template.name} namunasi</button>)}</div>
   <ul>{data.rows.map(row=><li key={row.id} className="border rounded p-3 flex gap-3"><span>{row.name} — {row.baseRole==='admin'?'Admin':'Kassir'}; {row.isActive?'Faol':'Nofaol'}; versiya {row.revision}; {row._count.members} xodim</span><button disabled={busy} onClick={()=>setEditor({id:row.id,name:row.name,baseRole:row.baseRole,permissions:[...row.permissions],revision:row.revision,isActive:row.isActive,reason:''})}>Tahrirlash</button></li>)}</ul>
   <div className="flex gap-3"><button disabled={busy||data.page===1} onClick={()=>void perform(()=>load(data.page-1))}>Oldingi</button><span>Sahifa {data.page}; jami {data.total}</span><button disabled={busy||data.page*20>=data.total} onClick={()=>void perform(()=>load(data.page+1))}>Keyingi</button></div>
   {editor&&<form onSubmit={event=>{event.preventDefault();void perform(save)}} className="border rounded p-4 space-y-3"><h2 className="font-semibold">{editor.id?'Rolni tahrirlash':'Rol yaratish'}</h2>
    <label className="block">Nom<input required minLength={2} maxLength={80} disabled={busy} value={editor.name} onChange={event=>setEditor({...editor,name:event.target.value})} className="block border p-2"/></label>
    <label className="block">Asosiy rol<select disabled={busy||!!editor.id} value={editor.baseRole} onChange={event=>setEditor({...editor,baseRole:event.target.value as Base,permissions:[]})}><option value="admin">Admin</option><option value="cashier">Kassir</option></select></label>
    <p>GET — ko‘rish; POST — yaratish yoki tasdiqlash; PUT/PATCH — o‘zgartirish; DELETE — olib tashlash. Har bir tanlov faqat ko‘rsatilgan amalni ochadi.</p>
    <fieldset disabled={busy} className="max-h-80 overflow-auto"><legend>Vakolatlar ({editor.permissions.length})</legend>{data.catalog.filter(item=>item.baseRoles.includes(editor.baseRole)).map(item=><label key={item.key} className="block"><input type="checkbox" checked={editor.permissions.includes(item.key)} onChange={event=>setEditor({...editor,permissions:event.target.checked?[...editor.permissions,item.key]:editor.permissions.filter(key=>key!==item.key)})}/><span className="ml-2">{item.key}</span></label>)}</fieldset>
    {editor.id&&<label className="block"><input type="checkbox" disabled={busy} checked={editor.isActive} onChange={event=>setEditor({...editor,isActive:event.target.checked})}/> Faol. O‘chirilsa shu profil xodimlari tizimga kira olmaydi.</label>}
    <label className="block">Sabab<textarea required minLength={3} maxLength={2000} disabled={busy} value={editor.reason} onChange={event=>setEditor({...editor,reason:event.target.value})} className="block border p-2"/></label>
    <p>Vakolat yoki faol holat o‘zgarsa barcha biriktirilgan sessiyalar bekor qilinadi. Eskirgan versiya avtomatik ustidan yozilmaydi.</p><button disabled={busy}>Saqlash</button><button type="button" disabled={busy} onClick={()=>setEditor(null)} className="ml-3">Bekor qilish</button>
   </form>}
   <form onSubmit={event=>{event.preventDefault();void perform(async()=>{await api.organizations.updateMember(organizationId,memberId,{customRoleId:profileId||null});setMessage('Profil biriktirildi; xodim qayta kirishi kerak.');await load(data.page)})}} className="border rounded p-4 space-y-3"><h2 className="font-semibold">Xodimga biriktirish</h2>
    <label className="block">Xodim<select required disabled={busy} value={memberId} onChange={event=>setMemberId(event.target.value)}><option value="">Tanlang</option>{members.filter(member=>member.isActive&&!member.archivedAt&&member.role!=='owner').map(member=><option key={member.id} value={member.id}>{member.user.fullName} — {member.customRoleName??member.role}</option>)}</select></label>
    <label className="block">Ushbu sahifadagi profil<select disabled={busy} value={profileId} onChange={event=>setProfileId(event.target.value)}><option value="">Maxsus profilni olib tashlash</option>{data.rows.filter(row=>row.isActive).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><p>Profilni olib tashlash asosiy rolning to‘liq huquqlarini qaytaradi. Filial biriktirishlari o‘zgarmaydi. Boshqa sahifadagi profil uchun ro‘yxatdan qidiring.</p><button disabled={busy||!memberId}>Biriktirishni saqlash</button>
   </form>
  </>}
 </div>
}
