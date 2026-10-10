import type { TokenPayload } from '@/lib/auth'

export class AccessError extends Error {
  constructor(public status: number, public code: string, message = 'Bu amal uchun ruxsat yo‘q', public retryAfterSeconds?:number, public details?:unknown) { super(message) }
}
export function tenantScope(model: string, context: TokenPayload): Record<string, unknown> {
  const org = context.organizationId
  const stores = context.role === 'owner' ? { organizationId: org } : { organizationId: org, id: { in: context.storeIds } }
  const storeRelation = { store: stores }
  switch (model) {
    case 'Organization': return { id: org }
    case 'User': return { organizationUsers: { some: { organizationId: org, isActive: true } } }
    case 'Store': return stores
    case 'Register': return storeRelation
    case 'Shift': return { register: storeRelation, ...(context.role === 'cashier' && { organizationUserId: context.organizationUserId }) }
    case 'CashMovement': return { shift: tenantScope('Shift', context) }
    case 'InventoryBalance': return storeRelation
    case 'Sale': return { organizationId: org, ...storeRelation, ...(context.role === 'cashier' && { cashierId: context.userId }) }
    case 'SaleItem': return { sale: tenantScope('Sale', context) }
    case 'SaleReturn': return { sale: tenantScope('Sale', context) }
    case 'SaleReturnItem': return { saleReturn: tenantScope('SaleReturn', context) }
    case 'CustomerAdvanceAllocation': case 'CustomerAdvanceRefund': return {advance:{organizationId:org}}
    case 'SupplierCredit': return {invoice:tenantScope('SupplierInvoice',context)}
    case 'PurchaseOrderItem': return {order:tenantScope('PurchaseOrder',context)}
    case 'StockDocumentItem': return { stockDocument: tenantScope('StockDocument', context) }
    case 'StockTransferItem': return { stockTransfer: tenantScope('StockTransfer', context) }
    case 'StockTransfer': return { organizationId: org, fromStore: stores, toStore: stores }
    case 'UserStore': return { organizationUser: { organizationId: org }, store: stores }
    case 'FinancialDocument': return {organizationId:org,...(context.role==='owner'?{}:{storeId:{in:context.storeIds},entries:{every:{account:{organizationId:org,storeId:{in:context.storeIds}}}}})}
    case 'ProviderIntent': case 'ReceiptCostPlan': case 'StockLocation': case 'StockReservation': case 'LocationBalance': case 'ReservationItem': case 'PurchaseOrder': case 'SupplierInvoice': case 'SupplierPayment':
    case 'FinancialAccount': case 'ReturnDispositionEntry': case 'TransferDispositionEntry': case 'DamageLocation': return {organizationId:org,...(context.role==='owner'?{}:{storeId:{in:context.storeIds}})}
    case 'StockCount': case 'StockDocument': case 'InventoryMovement': case 'Payment': return { organizationId: org, ...storeRelation }
    default: return { organizationId: org }
  }
}
export function assertRoutePermission(path: string, method: string, role: string) {
  if (!['owner', 'admin', 'cashier'].includes(role)) throw new AccessError(403, 'FORBIDDEN')
  const area = path.split('/')[2]
  const read = method === 'GET' || method === 'HEAD'
  if (area === 'billing' && read) return
  // Platform/support actions have their own operator + explicit owner-grant DAL.
  // A business role never grants cross-organization support access by itself.
  if(area==='deployment'&&read)return
  if(area==='deployment')throw new AccessError(403,'FORBIDDEN')
  if(area==='support')return
  if(area==='offline-cash')return
  if(area==='price-rules'&&path==='/api/price-rules/quote'&&method==='POST')return
  if (area === 'organizations' && !path.endsWith('/switch') && !read && role !== 'owner') throw new AccessError(403, 'FORBIDDEN')
  if (area === 'organizations' && path.includes('/users') && role !== 'owner') throw new AccessError(403, 'FORBIDDEN')
  if(area==='ownership-transfers' && (read || (method==='POST' && /^\/api\/ownership-transfers\/[0-9a-f-]{36}$/i.test(path))))return
  if (role === 'cashier') {
    const allowed = ['sales', 'shifts', 'products', 'categories', 'customers', 'stores', 'auth', 'operations', 'sync', 'files', 'brands', 'taxes']
    if (area === 'organizations' && (read || path.endsWith('/switch'))) return
    if (!allowed.includes(area) || (['products','categories','customers','stores','files','brands','taxes'].includes(area) && !read)) throw new AccessError(403, 'FORBIDDEN')
    if (path.endsWith('/void')) throw new AccessError(403, 'MANAGER_REQUIRED')
  }
}
