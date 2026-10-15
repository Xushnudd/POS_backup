import {requestTrace,logEvent} from './observability/context'
import {requestOriginAllowed} from './auth/request-origin'
import {errorGuidance} from '@/lib/error-guidance'
import { consumeLimit } from './auth/rate-limit'
import { IntegrationUnavailable } from './integrations/contracts'
import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRequestToken, verifySession } from './auth/session'
import { AccessError, assertRoutePermission, tenantScope } from './auth/policy'
import {assertCustomRoutePermission} from './auth/custom-role-policy'
import type { TokenPayload } from '@/lib/auth'
import { apiMetrics } from './monitoring/metrics'
import { billingDatabaseError } from './billing/errors'
import {loyaltyDatabaseError} from './loyalty/errors'
import { sanitizeResponse, sanitizeTotpPresentation } from './auth/response'
import { consumeRequestBudget,consumePublicRequestBudget,requestBudgetSetting } from './auth/request-budget'

const refs: Record<string, string> = {
  customRoleId:'CustomRole',
  reservationId:'StockReservation',locationId:'StockLocation',fromLocationId:'StockLocation',toLocationId:'StockLocation',orderItemId:'PurchaseOrderItem',stockDocumentId:'StockDocument',storeId:'Store', fromStoreId:'Store', toStoreId:'Store', registerId:'Register', shiftId:'Shift',
  invoiceId:'SupplierInvoice',expenseCategoryId:'ExpenseCategory',accountId:'FinancialAccount',fromAccountId:'FinancialAccount',toAccountId:'FinancialAccount',
  taxProfileId:'TaxProfile',brandId:'Brand',parentId:'Category',productId:'Product', categoryId:'Category', customerId:'Customer', supplierId:'Supplier',
  targetMembershipId:'OrganizationUser',organizationUserId:'OrganizationUser', cashierId:'User',
}
const pathModels: Record<string, string> = {
  roles:'CustomRole',
  brands:'Brand',taxes:'TaxProfile',files:'FileAsset','supplier-invoices':'SupplierInvoice','purchase-orders':'PurchaseOrder','supplier-payments':'SupplierPayment',organizations:'Organization', stores:'Store', registers:'Register', products:'Product', categories:'Category',
  customers:'Customer', suppliers:'Supplier', sales:'Sale', shifts:'Shift', transfers:'StockTransfer', 'stock-documents':'StockDocument', 'stock-counts':'StockCount',
}
async function assertReference(model: string, id: unknown, context: TokenPayload) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new AccessError(400,'INVALID_ID','Identifikator noto‘g‘ri')
  const name = model[0].toLowerCase() + model.slice(1)
  // Runtime delegate lookup is confined here; caller supplies an allowlisted model.
  const delegate = (prisma as unknown as Record<string, { findFirst(args: unknown): Promise<unknown> }>)[name]
  const found = await delegate.findFirst({ where: { id, AND: tenantScope(model, context) }, select: { id: true } })
  if (!found) throw new AccessError(404,'NOT_FOUND','Resurs topilmadi')
}
export async function validateTenantReferences(value: unknown, context: TokenPayload): Promise<void> {
  if (Array.isArray(value)) { for (const item of value) await validateTenantReferences(item, context); return }
  if (!value || typeof value !== 'object') return
  for (const [key, id] of Object.entries(value)) {
    if(key==='imageUrl'&&typeof id==='string'&&id.startsWith('/api/files/')){await assertReference('FileAsset',id.slice(11),context);if(!await prisma.fileAsset.findFirst({where:{id:id.slice(11),organizationId:context.organizationId,deletedAt:null,OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}]}}))throw new AccessError(409,'FILE_UNAVAILABLE')}
    if (key === 'organizationId' && id !== context.organizationId) throw new AccessError(403,'TENANT_MISMATCH')
    if (refs[key] && id !== undefined && id !== null) await assertReference(refs[key], id, context)
    if (key === 'storeIds' && Array.isArray(id)) for (const store of id) await assertReference('Store', store, context)
    if (context.role === 'cashier' && key === 'organizationUserId' && id !== context.organizationUserId) throw new AccessError(403,'FORBIDDEN')
    if (key === 'cashierId' && id !== context.userId) throw new AccessError(403,'FORBIDDEN')
    if (context.role !== 'owner' && key === 'role' && id === 'owner') throw new AccessError(403,'FORBIDDEN')
    if (id && typeof id === 'object') await validateTenantReferences(id, context)
  }
}
async function boundedBody(request: NextRequest): Promise<string> {
  const deadlineMs=requestBudgetSetting('API_BODY_TIMEOUT_MS')
  const reader = request.clone().body?.getReader()
  if (!reader) return ''
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0, text = ''
  let timer:ReturnType<typeof setTimeout>|undefined
  const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new AccessError(408,'REQUEST_BODY_TIMEOUT')),deadlineMs);timer.unref()})
  try {
    for (;;) {
      const { value, done } = await Promise.race([reader.read(),deadline])
      if (done) break
      size += value.byteLength
      if (size > 1024 * 1024) {
        // A tee cancellation can wait for the other branch; do not await it.
        void reader.cancel().catch(() => undefined)
        throw new AccessError(413, 'PAYLOAD_TOO_LARGE')
      }
      text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
  } catch (error) {
    void reader.cancel().catch(()=>undefined)
    if (error instanceof AccessError) throw error
    throw new AccessError(400, 'INVALID_JSON')
  } finally {
    if(timer)clearTimeout(timer)
    reader.releaseLock()
  }
}
export function withApi<C>(handler: (request: NextRequest, context: C) => Promise<Response>, options: { public?: boolean; validateBodyReferences?: boolean; binary?: boolean; touchSession?:boolean; totpPresentation?:'enrollment'|'recoveryCodes' } = {}) {
  return async (request: NextRequest, routeContext: C): Promise<Response> => {
    const requestId = randomUUID()
    return requestTrace.run({requestId},async()=>{
    const started=Date.now()
    try {
      const path = new URL(request.url).pathname
      const queryParams=new URL(request.url).searchParams
      for (const field of ['page','limit']) {
        const value=queryParams.get(field)
        if (value!==null && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value)<1 || (field==='limit' && Number(value)>200))) throw new AccessError(400,'INVALID_PAGINATION')
      }
      const mutation = !['GET','HEAD','OPTIONS'].includes(request.method)
      if (mutation) {
        const origin = request.headers.get('origin')
        const expected = process.env.APP_ORIGIN ?? new URL(request.url).origin
        // JSON-only plus exact Origin/Sec-Fetch-Site forms the cookie CSRF boundary.
        if (!requestOriginAllowed(origin,expected) || request.headers.get('sec-fetch-site') === 'cross-site') throw new AccessError(403,'CSRF_REJECTED')
        if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AccessError(415,'JSON_REQUIRED','JSON so‘rov talab qilinadi')
        const length = request.headers.get('content-length')
        if (length && !/^\d+$/.test(length)) throw new AccessError(400,'INVALID_CONTENT_LENGTH')
        if (length && Number(length) > 1024 * 1024) throw new AccessError(413,'PAYLOAD_TOO_LARGE')
      }
      let context: TokenPayload | null = null
      // Keep health probes and logout usable; public authentication writes share
      // a bounded admission budget even when no trusted client IP is available.
      if(options.public&&mutation&&path!=='/api/auth/logout')await consumePublicRequestBudget(request.headers)
      if (!options.public) {
        const token = getRequestToken(request)
        context = token ? await verifySession(token,{touch:options.touchSession!==false}) : null
        if (!context) throw new AccessError(401,'UNAUTHORIZED','Avtorizatsiya talab qilinadi')
        requestTrace.getStore()!.organizationId=context.organizationId
        assertRoutePermission(path, request.method, context.role)
        assertCustomRoutePermission(context,path,request.method)
        // Shared across replicas, scoped to tenant + actor, before reference scans,
        // parsing/import workers and business handlers. Specific budgets still apply.
        await consumeRequestBudget(context,request.method)
        const segments = path.split('/').filter(Boolean)
        if (segments[2] && segments[2] !== 'switch' && !(segments[1]==='products'&&segments[2]==='prices') && !(segments[1]==='sales'&&segments[2]==='preview') && pathModels[segments[1]]) await assertReference(pathModels[segments[1]], segments[2], context)
        await validateTenantReferences(Object.fromEntries(new URL(request.url).searchParams), context)
      }
      if (mutation) {
        const text = await boundedBody(request)
        if (text) {
          let body: unknown
          try { body = JSON.parse(text) } catch { throw new AccessError(400,'INVALID_JSON','JSON noto‘g‘ri') }
          if (context && options.validateBodyReferences !== false) await validateTenantReferences(body, context)
        }
      }
      if(context&&path.startsWith('/api/offline-cash'))await consumeLimit(mutation?'offline-cash.write':'offline-cash.read',context.organizationId+':'+context.userId,mutation?30:120,60000)
      if(context&&request.method==='GET'&&path.startsWith('/api/reports/')){
        const identity=context.organizationId+':'+context.userId
        await consumeLimit('report.read',identity,60,60000)
        if(path==='/api/reports/reconciliation')await consumeLimit('report.reconciliation',identity,10,60000)
      }
      if(context&&(path.startsWith('/api/finance/')||path.startsWith('/api/supplier-payments')||path.startsWith('/api/supplier-invoices')||path.startsWith('/api/purchase-orders')||/^\/api\/suppliers\/[0-9a-f-]{36}\/ledger$/i.test(path)))await consumeLimit(mutation?'finance.write':'finance.read',context.organizationId+':'+context.userId,60,60000)
      const result = await handler(request, routeContext)
      if(options.binary && result.ok && !result.headers.get('content-type')?.includes('application/json')){
        const response=new Response(result.body,{status:result.status,headers:result.headers});
        response.headers.set('X-Request-Id',requestId);response.headers.set('Cache-Control','private, no-store');response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Content-Security-Policy',"default-src 'none'; sandbox");
        apiMetrics.record(context?.organizationId,result.status,Date.now()-started)
        logEvent('api_response',{status:result.status,durationMs:Date.now()-started});return response;
      }
      const data = await result.json()
      if(data.error){const guide=errorGuidance(data.error.code,data.error.message);data.error={...data.error,...guide};data.requestId=requestId}
      apiMetrics.record(context?.organizationId,result.status,Date.now()-started)
      logEvent('api_response',{status:result.status,durationMs:Date.now()-started,...(data.error?.code?{code:data.error.code}:{})})
      const response = NextResponse.json(sanitizeTotpPresentation(data, context?.role, path, request.method, result.ok ? options.totpPresentation : undefined), { status: result.status, headers: result.headers })
      response.headers.set('X-Request-Id', requestId)
      response.headers.set('Cache-Control','private, no-store')
      response.headers.set('X-Content-Type-Options','nosniff')
      return response
    } catch (error) {
      const billingError = billingDatabaseError(error)??loyaltyDatabaseError(error)
      if (billingError) error = billingError
      let status = 500, code = 'INTERNAL_ERROR', message = 'Server xatosi'
      if (error instanceof AccessError) ({status,code,message} = error)
      else if(error instanceof IntegrationUnavailable){status=503;code='INTEGRATION_UNAVAILABLE';message='Tashqi xizmat sozlanmagan; rahbarga murojaat qiling'}
      else if (error instanceof z.ZodError) { status=400;code='VALIDATION_ERROR';message='Ma’lumotlar noto‘g‘ri' }
      else if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2025'].includes(error.code)) {
        status = error.code === 'P2025' ? 404 : 409; code = error.code === 'P2025' ? 'NOT_FOUND' : 'CONFLICT'; message = 'Resurs topilmadi yoki amal takrorlangan'
      }
      const guide=errorGuidance(code,message);message=guide.message
      apiMetrics.record(requestTrace.getStore()?.organizationId,status,Date.now()-started)
      logEvent('api_error',{status,code,durationMs:Date.now()-started})
      return NextResponse.json({ success:false, error:{code,message,nextAction:guide.nextAction,...(error instanceof z.ZodError?{details:error.issues.map(issue=>({path:issue.path,code:issue.code,message:issue.message}))}:{}),...(error instanceof AccessError&&error.details!==undefined?{details:sanitizeResponse(JSON.parse(JSON.stringify(error.details)),'cashier')}:{})}, requestId }, { status, headers:{'X-Request-Id':requestId,'Cache-Control':'private, no-store',...(error instanceof AccessError&&error.retryAfterSeconds?{'Retry-After':String(error.retryAfterSeconds)}:{})} })
    }
    })
  }
}
