import {NextRequest} from 'next/server'
import {z} from 'zod'
import type {TokenPayload} from '@/lib/auth'
import {assertRoutePermission,AccessError} from '@/server/auth/policy'
import {assertCustomRoutePermission} from '@/server/auth/custom-role-policy'
import {validateTenantReferences} from '@/server/api'
import {prisma} from '@/lib/prisma'
import {assertLiveContext} from '@/server/operations'
import {reportArtifact} from '@/server/exports/report-formats'
import {REPORT_EXPORTS} from '@/lib/report-exports'
import {REPORT_QUERIES} from './report-queries'
export const reportExportSchema=z.object({
 report:z.enum(Object.keys(REPORT_QUERIES) as [keyof typeof REPORT_QUERIES,...(keyof typeof REPORT_QUERIES)[]]),
 format:z.enum(['csv','xlsx','pdf']),
 filters:z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/).max(50),z.string().max(2000)).default({}),
}).strict().refine(v=>Object.keys(v.filters).every(k=>(REPORT_EXPORTS[v.report].filters as readonly string[]).includes(k)),'Noma’lum hisobot filtri').refine(v=>Object.keys(v.filters).length<=30&&!Object.keys(v.filters).some(k=>['organizationId','format','page','limit','password','token','session'].includes(k)),'Tenant va pagination maydonlari eksport filtri emas')
export async function reportExport(context:TokenPayload,input:z.infer<typeof reportExportSchema>){
 const descriptor=reportExportSchema.parse(input),entry=REPORT_QUERIES[descriptor.report]
 assertRoutePermission(entry.path,'GET',context.role);assertCustomRoutePermission(context,entry.path,'GET')
 const params=new URLSearchParams({...descriptor.filters,organizationId:context.organizationId,format:'csv'})
 await prisma.$transaction(async tx=>assertLiveContext(tx,context))
 await validateTenantReferences(Object.fromEntries(params),context)
 const asOf=new Date().toISOString(),response=await entry.query(context,new NextRequest('http://pos.internal'+entry.path+'?'+params.toString()))
 const result=await response.json()
 if(!response.ok||!result.success||typeof result.data?.content!=='string'||typeof result.data?.filename!=='string')throw new AccessError(response.status>=400?response.status:409,result.error?.code??'EXPORT_CORRUPTED')
 return reportArtifact({...result.data,title:REPORT_EXPORTS[descriptor.report].label},descriptor.format,result.data.meta?.asOf??result.meta?.asOf??asOf)
}
