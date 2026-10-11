import {AccessError} from '@/server/auth/policy'
export const EXPORT_PAGE_SIZE=500
// Caller keeps one RepeatableRead transaction and stable ordering including id.
export async function cursorExport<T extends {id:string}>(read:(cursor?:string)=>Promise<T[]>,cap=10000):Promise<T[]>{
 const rows:T[]=[];let cursor:string|undefined
 for(;;){const page=await read(cursor);if(!page.length)break;if(rows.length+page.length>cap)throw new AccessError(413,'EXPORT_TOO_LARGE');if(page.length>EXPORT_PAGE_SIZE||page[page.length-1].id===cursor)throw new AccessError(409,'EXPORT_CORRUPTED');rows.push(...page);cursor=page[page.length-1].id}
 return rows
}
