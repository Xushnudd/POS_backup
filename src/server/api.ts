import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRequestToken, verifySession } from './auth/session'
import { AccessError, assertRoutePermission, tenantScope } from './auth/policy'
import type { TokenPayload } from '@/lib/auth'

const refs: Record<string, string> = {
  storeId:'Store', fromStoreId:'Store', toStoreId:'Store', registerId:'Register', shiftId:'Shift',
  productId:'Product', categoryId:'Category', customerId:'Customer', supplierId:'Supplier',
  organizationUserId:'OrganizationUser', cashierId:'User',
}
const pathModels: Record<string, string> = {
  organizations:'Organization', stores:'Store', registers:'Register', products:'Product', categories:'Category',
  customers:'Customer', suppliers:'Supplier', sales:'Sale', shifts:'Shift', transfers:'StockTransfer', 'stock-documents':'StockDocument',
}
async function assertReference(model: string, id: unknown, context: TokenPayload) {
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new AccessError(400,'INVALID_ID','Identifikator noto‘g‘ri')
  const name = model[0].toLowerCase() + model.slice(1)
  // Runtime delegate lookup is confined here; caller supplies an allowlisted model.
  const delegate = (prisma as unknown as Record<string, { findFirst(args: unknown): Promise<unknown> }>)[name]
  const found = await delegate.findFirst({ where: { id, AND: tenantScope(model, context) }, select: { id: true } })
  if (!found) throw new AccessError(404,'NOT_FOUND','Resurs topilmadi')
}
async function validateRefs(value: unknown, context: TokenPayload): Promise<void> {
  if (Array.isArray(value)) { for (const item of value) await validateRefs(item, context); return }
  if (!value || typeof value !== 'object') return
  for (const [key, id] of Object.entries(value)) {
    if (key === 'organizationId' && id !== context.organizationId) throw new AccessError(403,'TENANT_MISMATCH')
    if (refs[key] && id !== undefined && id !== null) await assertReference(refs[key], id, context)
    if (key === 'storeIds' && Array.isArray(id)) for (const store of id) await assertReference('Store', store, context)
    if (context.role === 'cashier' && key === 'organizationUserId' && id !== context.organizationUserId) throw new AccessError(403,'FORBIDDEN')
    if (key === 'cashierId' && id !== context.userId) throw new AccessError(403,'FORBIDDEN')
    if (context.role !== 'owner' && key === 'role' && id === 'owner') throw new AccessError(403,'FORBIDDEN')
    if (id && typeof id === 'object') await validateRefs(id, context)
  }
}
function sanitize(value: unknown, role?: string): unknown {
  if (Array.isArray(value)) return value.map(x => sanitize(x, role))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([key]) =>
    !['passwordHash','tokenHash','password','resetToken','secret'].includes(key) &&
    !(role === 'cashier' && ['costPrice','unitCost','profit','profitMargin','cost'].includes(key))
  ).map(([key,val]) => [key,sanitize(val,role)]))
}
async function boundedBody(request: NextRequest): Promise<string> {
  const reader = request.clone().body?.getReader()
  if (!reader) return ''
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let size = 0, text = ''
  try {
    for (;;) {
      const { value, done } = await reader.read()
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
    if (error instanceof AccessError) throw error
    throw new AccessError(400, 'INVALID_JSON')
  } finally {
    reader.releaseLock()
  }
}
export function withApi<C>(handler: (request: NextRequest, context: C) => Promise<Response>, options: { public?: boolean } = {}) {
  return async (request: NextRequest, routeContext: C): Promise<Response> => {
    const requestId = randomUUID()
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
        if ((origin && origin !== expected) || request.headers.get('sec-fetch-site') === 'cross-site') throw new AccessError(403,'CSRF_REJECTED')
        if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AccessError(415,'JSON_REQUIRED','JSON so‘rov talab qilinadi')
        const length = request.headers.get('content-length')
        if (length && !/^\d+$/.test(length)) throw new AccessError(400,'INVALID_CONTENT_LENGTH')
        if (length && Number(length) > 1024 * 1024) throw new AccessError(413,'PAYLOAD_TOO_LARGE')
      }
      let context: TokenPayload | null = null
      if (!options.public) {
        const token = getRequestToken(request)
        context = token ? await verifySession(token) : null
        if (!context) throw new AccessError(401,'UNAUTHORIZED','Avtorizatsiya talab qilinadi')
        assertRoutePermission(path, request.method, context.role)
        const segments = path.split('/').filter(Boolean)
        if (segments[2] && segments[2] !== 'switch' && pathModels[segments[1]]) await assertReference(pathModels[segments[1]], segments[2], context)
        await validateRefs(Object.fromEntries(new URL(request.url).searchParams), context)
      }
      if (mutation) {
        const text = await boundedBody(request)
        if (text) {
          let body: unknown
          try { body = JSON.parse(text) } catch { throw new AccessError(400,'INVALID_JSON','JSON noto‘g‘ri') }
          if (context) await validateRefs(body, context)
        }
      }
      const result = await handler(request, routeContext)
      const data = await result.json()
      const response = NextResponse.json(sanitize(data, context?.role), { status: result.status, headers: result.headers })
      response.headers.set('X-Request-Id', requestId)
      response.headers.set('Cache-Control','private, no-store')
      response.headers.set('X-Content-Type-Options','nosniff')
      return response
    } catch (error) {
      let status = 500, code = 'INTERNAL_ERROR', message = 'Server xatosi'
      if (error instanceof AccessError) ({status,code,message} = error)
      else if (error instanceof z.ZodError) { status=400;code='VALIDATION_ERROR';message='Ma’lumotlar noto‘g‘ri' }
      else if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2025'].includes(error.code)) {
        status = error.code === 'P2025' ? 404 : 409; code = error.code === 'P2025' ? 'NOT_FOUND' : 'CONFLICT'; message = 'Resurs topilmadi yoki amal takrorlangan'
      }
      console.error(JSON.stringify({event:'api_error',requestId,status,code}))
      return NextResponse.json({ success:false, error:{code,message}, requestId }, { status, headers:{'X-Request-Id':requestId,'Cache-Control':'private, no-store'} })
    }
  }
}
