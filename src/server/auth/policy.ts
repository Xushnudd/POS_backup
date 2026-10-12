import { TENANT_DIRECT_MODELS, TENANT_PARENT_SCOPES } from './tenant-models'
import type { TokenPayload } from '@/lib/auth'
import { routePermissionRoles, type BusinessRole } from './route-permissions'

export class AccessError extends Error {
  constructor(public status: number, public code: string, message = 'Bu amal uchun ruxsat yo‘q', public retryAfterSeconds?:number, public details?:unknown) { super(message) }
}
export function tenantScope(model: string, context: TokenPayload): Record<string, unknown> {
  const org = context.organizationId
  const stores = context.role === 'owner' ? { organizationId: org } : { organizationId: org, id: { in: context.storeIds } }
  const storeRelation = { store: stores }
  switch (model) {
    case 'InventoryValuationSequence': case 'InventoryValuationEvent':
      if(context.role!=='owner')throw new AccessError(403,'OWNER_REQUIRED','Tashkilot bo‘yicha tannarx tarixi faqat egasiga ochiq');
      return {organizationId:org}
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
    default: {
      const parent = TENANT_PARENT_SCOPES[model]
      if (parent) return { [parent[1]]: tenantScope(parent[0], context) }
      if ((TENANT_DIRECT_MODELS as readonly string[]).includes(model)) return { organizationId: org }
      throw new AccessError(403, 'UNSCOPED_MODEL', 'Bu model alohida vakolat tekshiruvini talab qiladi')
    }
  }
}
export function assertRoutePermission(path: string, method: string, role: string) {
  if (!['owner', 'admin', 'cashier'].includes(role)) throw new AccessError(403, 'FORBIDDEN')
  const roles = routePermissionRoles(path, method)
  if (!roles?.includes(role as BusinessRole)) {
    throw new AccessError(403, path.endsWith('/void') && role === 'cashier' ? 'MANAGER_REQUIRED' : 'FORBIDDEN')
  }
}
