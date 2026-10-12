'use client'
import {useEffect,useRef,useState} from 'react'
import {api,ApiError} from '@/lib/api'
import {useUnsavedChanges,confirmUnsavedChanges} from '@/hooks/useUnsavedChanges'
import {useAuth} from '@/context/AuthContext'
import type {OrganizationMember} from '@/types'
type Base='admin'|'cashier'
type Profile={id:string;name:string;baseRole:Base;permissions:string[];revision:number;isActive:boolean;_count:{members:number}}
type Listing={rows:Profile[];total:number;page:number;catalog:{key:string;baseRoles:string[]}[];templates:{name:string;baseRole:Base;permissions:string[]}[]}
type Editor={id?:string;name:string;baseRole:Base;permissions:string[];revision?:number;isActive:boolean;reason:string}
const initial:Editor={name:'',baseRole:'admin',permissions:[],isActive:true,reason:''}
type RoleRequest={path:string;method:'POST'|'PUT';body:Record<string,unknown>}
type AssignmentRequest={memberId:string;customRoleId:string|null;operationId:string}
const editorIdentity=(editor:Editor|null)=>editor?JSON.stringify({...editor,permissions:[...editor.permissions].sort()}):''
const definiteFailure=(failure:unknown)=>failure instanceof ApiError&&([400,403,404,413,415].includes(failure.status??0)||failure.code==='ROLE_REVISION_CHANGED')
const unknownWarning='Natijasi noma’lum rol amali bor. Sahifani tark etish asl kalit bilan qayta tekshirishni qiyinlashtiradi. Tark etishni tasdiqlaysizmi?'
export default function RolesPage(){
 const {user,organization,role}=useAuth()
 if(role!=='owner')return <p role="alert">Rollarni faqat tashkilot egasi boshqaradi.</p>
 return user&&organization?<RolesPanel key={`${user.id}:${organization.id}:${role}`} organizationId={organization.id}/>:null
}
function RolesPanel({organizationId}:{organizationId:string}){
 const [data,setData]=useState<Listing|null>(null),[members,setMembers]=useState<OrganizationMember[]>([]),[editor,setEditor]=useState<Editor|null>(null)
 const [search,setSearch]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const [memberId,setMemberId]=useState(''),[profileId,setProfileId]=useState(''),[profileName,setProfileName]=useState('')
 const [baseline,setBaseline]=useState<Editor|null>(null),[assignmentBaseline,setAssignmentBaseline]=useState('')
 const [roleRequest,setRoleRequest]=useState<RoleRequest|null>(null),[assignmentRequest,setAssignmentRequest]=useState<AssignmentRequest|null>(null)
 const [loading,setLoading]=useState(false),[readError,setReadError]=useState('')
 const ready=!!data&&!loading&&!readError
 const flight=useRef(false),live=useRef(true)
 const roleDirty=!!editor&&editorIdentity(editor)!==editorIdentity(baseline)
 const assignmentDirty=!!memberId&&profileId!==assignmentBaseline
 useUnsavedChanges(roleDirty||assignmentDirty||!!roleRequest||!!assignmentRequest,busy,roleRequest||assignmentRequest?unknownWarning:undefined)
 useEffect(()=>{live.current=true;return()=>{live.current=false}},[])
 function openEditor(next:Editor){if(roleRequest||!confirmUnsavedChanges(roleDirty,busy))return;setEditor(next);setBaseline(next.id?{...next,permissions:[...next.permissions]}:{...initial,permissions:[]})}
 function selectMember(id:string){if(assignmentRequest||!confirmUnsavedChanges(assignmentDirty,busy))return;const member=members.find(member=>member.id===id),current=member?.customRoleId??'';setMemberId(id);setProfileId(current);setProfileName(member?.customRoleName??'');setAssignmentBaseline(current)}
 async function load(page=1){
  if(live.current)setLoading(true)
  try{const [roles,staff]=await Promise.all([api.request<Listing>(`/roles?page=${page}&search=${encodeURIComponent(search)}`),api.organizations.users(organizationId)])
   if(!roles.data||!staff.data)throw new Error('Rollar yoki xodimlar natijasi mavjud emas')
   if(live.current){setData(roles.data);setMembers(staff.data);setReadError('')}}
  catch(failure){if(live.current)setReadError(failure instanceof Error?failure.message:'Rollar yuklanmadi');throw failure}
  finally{if(live.current)setLoading(false)}
 }
 async function perform(work:()=>Promise<void>){
  if(flight.current||!live.current)return
  flight.current=true;setBusy(true);setError('');setMessage('')
  try{await work()}catch(failure){if(live.current)setError(failure instanceof Error?failure.message:'Amal bajarilmadi')}
  finally{flight.current=false;if(live.current)setBusy(false)}
 }
 async function refreshAfterSave(){try{await load(data?.page??1)}catch(failure){if(live.current)setError('Amal saqlandi; ro‘yxat yangilanmadi. Rollarni qayta yuklang. '+(failure instanceof Error?failure.message:''))}}
 async function save(){
  if(!editor||(!roleRequest&&!ready))return
  const {id,revision,baseRole,isActive,...fields}=editor
  const body=id?{...fields,isActive,expectedRevision:revision}:{...fields,baseRole}
  // A failed acknowledgement can be retried with the same immutable request identity.
  const retrying=!!roleRequest
  const request:RoleRequest=roleRequest??{path:id?`/roles/${id}`:'/roles',method:id?'PUT':'POST',body:{...body,permissions:[...fields.permissions],operationId:crypto.randomUUID()}}
  setRoleRequest(request)
  try{await api.request(request.path,{method:request.method,body:JSON.stringify(request.body)})}
  catch(failure){if(!retrying&&definiteFailure(failure)&&live.current)setRoleRequest(null);throw failure}
  if(!live.current)return
  setRoleRequest(null);setEditor(null);setBaseline(null);setMessage('Rol saqlandi. Vakolat o‘zgargan xodimlar qayta kirishi kerak.');await refreshAfterSave()
 }
 async function assign(){
  if(!memberId||(!assignmentRequest&&!ready))return
  const retrying=!!assignmentRequest
  const request=assignmentRequest??{memberId,customRoleId:profileId||null,operationId:crypto.randomUUID()}
  setAssignmentRequest(request)
  try{await api.organizations.updateMember(organizationId,request.memberId,{customRoleId:request.customRoleId,operationId:request.operationId})}
  catch(failure){if(!retrying&&definiteFailure(failure)&&live.current)setAssignmentRequest(null);throw failure}
  if(!live.current)return
  setAssignmentRequest(null);setAssignmentBaseline(request.customRoleId??'');setMessage('Profil biriktirildi; xodim qayta kirishi kerak.');await refreshAfterSave()
 }
 return <div className="space-y-5"><h1 className="text-2xl font-bold">Rollar va vakolatlar</h1>
  <p>Maxsus rol asosiy admin yoki kassir huquqlarini cheklaydi. Filial chegaralari va qo‘shimcha tasdiqlar saqlanadi. Shaxsiy xavfsizlik va tashkilotni almashtirish imkoniyatlari saqlanadi.</p>
  <p>Namunalar hech kimga avtomatik biriktirilmaydi. O‘qish vakolati asosiy rolga ko‘rinadigan ma’lumotlarni ham ochishi mumkin; xodimga berishdan oldin tekshiring.</p>
  <form onSubmit={event=>{event.preventDefault();void perform(()=>load())}} className="flex gap-3"><label>Rol nomi<input disabled={busy} maxLength={100} value={search} onChange={event=>setSearch(event.target.value)} className="block border rounded p-2"/></label><button disabled={busy}>Rollarni yuklash</button></form>
  {readError&&<p role="alert">{readError}. Oxirgi ro‘yxat va draftlar saqlangan; yangi amal oldidan rollarni qayta yuklang.</p>}{error&&error!==readError&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  {loading&&<p role="status">Rollar va xodimlar yuklanmoqda...</p>}
  {busy&&!loading&&<p role="status">Amal javobi kutilmoqda...</p>}
  {roleDirty&&<p role="status">Saqlanmagan rol o‘zgarishlari bor.</p>}
  {assignmentDirty&&<p role="status">Saqlanmagan profil biriktirish o‘zgarishi bor.</p>}
  {roleRequest&&<p role="status">Rol amali natijasi tekshirilmoqda. Asl kalit: {String(roleRequest.body.operationId)}</p>}
  {assignmentRequest&&<p role="status">Biriktirish amali natijasi tekshirilmoqda. Asl kalit: {assignmentRequest.operationId}</p>}
  {data&&<><div className="flex flex-wrap gap-3"><button disabled={busy||!ready||!!roleRequest} onClick={()=>openEditor({...initial,permissions:[]})}>Yangi rol</button>{data.templates.map(template=><button key={template.name} disabled={busy||!ready||!!roleRequest} onClick={()=>openEditor({...initial,...template,permissions:[...template.permissions]})}>{template.name} namunasi</button>)}</div>
   <ul>{data.rows.map(row=><li key={row.id} className="border rounded p-3 flex gap-3"><span>{row.name} — {row.baseRole==='admin'?'Admin':'Kassir'}; {row.isActive?'Faol':'Nofaol'}; versiya {row.revision}; {row._count.members} xodim</span><button disabled={busy||!ready||!!roleRequest} onClick={()=>openEditor({id:row.id,name:row.name,baseRole:row.baseRole,permissions:[...row.permissions],revision:row.revision,isActive:row.isActive,reason:''})}>Tahrirlash</button></li>)}</ul>
   <div className="flex gap-3"><button disabled={busy||data.page===1} onClick={()=>void perform(()=>load(data.page-1))}>Oldingi</button><span>Sahifa {data.page}; jami {data.total}</span><button disabled={busy||data.page*20>=data.total} onClick={()=>void perform(()=>load(data.page+1))}>Keyingi</button></div>
   {editor&&<form onSubmit={event=>{event.preventDefault();void perform(save)}} className="border rounded p-4 space-y-3"><h2 className="font-semibold">{editor.id?'Rolni tahrirlash':'Rol yaratish'}</h2>
    <label className="block">Nom<input required minLength={2} maxLength={80} disabled={busy||!ready||!!roleRequest} value={editor.name} onChange={event=>setEditor({...editor,name:event.target.value})} className="block border p-2"/></label>
    <label className="block">Asosiy rol<select aria-label="Asosiy rol" disabled={busy||!ready||!!roleRequest||!!editor.id} value={editor.baseRole} onChange={event=>setEditor({...editor,baseRole:event.target.value as Base,permissions:[]})}><option value="admin">Admin</option><option value="cashier">Kassir</option></select></label>
    <p>GET — ko‘rish; POST — yaratish yoki tasdiqlash; PUT/PATCH — o‘zgartirish; DELETE — olib tashlash. Har bir tanlov faqat ko‘rsatilgan amalni ochadi.</p>
    <fieldset disabled={busy||!ready||!!roleRequest} className="max-h-80 overflow-auto"><legend>Vakolatlar ({editor.permissions.length})</legend>{data.catalog.filter(item=>item.baseRoles.includes(editor.baseRole)).map(item=><label key={item.key} className="block"><input type="checkbox" checked={editor.permissions.includes(item.key)} onChange={event=>setEditor({...editor,permissions:event.target.checked?[...editor.permissions,item.key]:editor.permissions.filter(key=>key!==item.key)})}/><span className="ml-2">{item.key}</span></label>)}</fieldset>
    {editor.id&&<label className="block"><input type="checkbox" disabled={busy||!ready||!!roleRequest} checked={editor.isActive} onChange={event=>setEditor({...editor,isActive:event.target.checked})}/> Faol. O‘chirilsa shu profil xodimlari tizimga kira olmaydi.</label>}
    <label className="block">Sabab<textarea required minLength={3} maxLength={2000} disabled={busy||!ready||!!roleRequest} value={editor.reason} onChange={event=>setEditor({...editor,reason:event.target.value})} className="block border p-2"/></label>
    <p>Vakolat yoki faol holat o‘zgarsa barcha biriktirilgan sessiyalar bekor qilinadi. Eskirgan versiya avtomatik ustidan yozilmaydi.</p><button disabled={busy||(!roleRequest&&!ready)}>{roleRequest?'Original rol amalini tekshirish':'Saqlash'}</button><button type="button" disabled={busy||!ready||!!roleRequest} onClick={()=>{if(confirmUnsavedChanges(roleDirty,busy||!!roleRequest)){setEditor(null);setBaseline(null)}}} className="ml-3">Bekor qilish</button>
   </form>}
   <form onSubmit={event=>{event.preventDefault();void perform(assign)}} className="border rounded p-4 space-y-3"><h2 className="font-semibold">Xodimga biriktirish</h2>
    <label className="block">Xodim<select aria-label="Xodim" required disabled={busy||!ready||!!assignmentRequest} value={memberId} onChange={event=>selectMember(event.target.value)}><option value="">Tanlang</option>{members.filter(member=>member.isActive&&!member.archivedAt&&member.role!=='owner').map(member=><option key={member.id} value={member.id}>{member.user.fullName} — {member.customRoleName??member.role}</option>)}</select></label>
    <label className="block">Ushbu sahifadagi profil<select aria-label="Ushbu sahifadagi profil" disabled={busy||!ready||!!assignmentRequest} value={profileId} onChange={event=>{setProfileId(event.target.value);setProfileName(data.rows.find(row=>row.id===event.target.value)?.name??'')}}><option value="">Maxsus profilni olib tashlash</option>{profileId&&!data.rows.some(row=>row.id===profileId&&row.isActive)&&<option value={profileId}>{profileName||'Tanlangan profil'} (shu ro‘yxatda faol emas)</option>}{data.rows.filter(row=>row.isActive).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label><p>Profilni olib tashlash asosiy rolning to‘liq huquqlarini qaytaradi. Filial biriktirishlari o‘zgarmaydi. Boshqa sahifadagi profil uchun ro‘yxatdan qidiring.</p><button disabled={busy||(!assignmentRequest&&!ready)||!memberId||(!assignmentDirty&&!assignmentRequest)}>{assignmentRequest?'Original biriktirish amalini tekshirish':'Biriktirishni saqlash'}</button>{assignmentDirty&&<button type="button" disabled={busy||!ready||!!assignmentRequest} onClick={()=>{if(confirmUnsavedChanges(assignmentDirty,busy)){setProfileId(assignmentBaseline);setProfileName(members.find(member=>member.id===memberId)?.customRoleName??'')}}}>Biriktirishni bekor qilish</button>}
   </form>
  </>}
 </div>
}
