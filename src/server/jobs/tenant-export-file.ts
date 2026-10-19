import {randomUUID} from 'node:crypto'
import {constants} from 'node:fs'
import {open,lstat,realpath,link,unlink} from 'node:fs/promises'
import {dirname,isAbsolute} from 'node:path'
import type {TokenPayload} from '@/lib/auth'
import {prisma} from '@/lib/prisma'
import {AccessError} from '../auth/policy'
import {assertLiveContext,audit} from '../operations'
import {streamTenantExport} from './tenant-export'

async function authorize(ctx:TokenPayload){
 if(ctx.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED')
 await prisma.$transaction(async tx=>{
  await assertLiveContext(tx,ctx)
  if(!await tx.session.findFirst({where:{id:ctx.sessionId,userId:ctx.userId,organizationId:ctx.organizationId,authenticationMethod:'password'}}))throw new AccessError(403,'PASSWORD_SESSION_REQUIRED')
 })
}
// Explicit owner-authorized operator export. Not a JobExport or closure prerequisite.
export async function tenantExportToFile(ctx:TokenPayload,output:string,reason:string){
 if(!isAbsolute(output)||reason.trim().length<3||reason.length>2000)throw new AccessError(400,'EXPORT_INPUT_INVALID')
 await authorize(ctx)
 const parent=dirname(output),stat=await lstat(parent),uid=process.getuid?.()
 if(uid===undefined||stat.isSymbolicLink()||!stat.isDirectory()||stat.uid!==uid||(stat.mode&0o077)!==0||await realpath(parent)!==parent)throw new AccessError(400,'EXPORT_PRIVATE_DIRECTORY_REQUIRED')
 const temporary=output+'.partial-'+randomUUID()
 const file=await open(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600)
 let closed=false,published=false,completed=false
 try{
  const metadata=await streamTenantExport(ctx.organizationId,async chunk=>{
   let offset=0
   while(offset<chunk.length){const {bytesWritten}=await file.write(chunk,offset,chunk.length-offset);if(!bytesWritten)throw Error('EXPORT_WRITE_FAILED');offset+=bytesWritten}
  })
  await file.sync();await file.close();closed=true
  await authorize(ctx)
  await prisma.$transaction(async tx=>{
   await assertLiveContext(tx,ctx)
   await audit(tx,ctx,'Organization',ctx.organizationId,'operator_export_prepared',{...metadata,reason,deliveryConfirmed:false})
  })
  // Hard link is exclusive: unlike rename, it cannot overwrite an existing archive.
  await link(temporary,output)
  published=true
  await unlink(temporary)
  const directory=await open(parent,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW)
  try{await directory.sync()}finally{await directory.close()}
  completed=true
  return metadata
 }finally{
  if(!closed)await file.close()
  if(published&&!completed)await unlink(output)
  await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error})
 }
}
