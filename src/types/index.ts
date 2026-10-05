export type Role = 'owner' | 'admin' | 'cashier';

export interface User {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  isActive?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  tin?: string | null;
  phone: string;
  currencyCode: string;
  timezone: string;
  allowNegativeStock: boolean;
  receiptFooter?: string | null;
}

export interface Store {
  id: string;
  organizationId?: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  isActive?: boolean;
  registers?: Register[];
}

export interface Register {
  id: string;
  storeId?: string;
  name: string;
  code: string;
  isActive?: boolean;
}

export interface AuthUser {
  id: string;
  fullName: string;
  phone: string;
  email?: string | null;
  organizationUserId?: string;
}

export interface AuthData {
  token: string;
  user: AuthUser;
  organization: {
    id: string;
    name: string;
    currencyCode?: string;
    tin?: string | null;
    phone?: string;
    timezone?: string;
    allowNegativeStock?: boolean;
    receiptFooter?: string | null;
  };
  role: Role;
  stores?: Store[];
}

export interface Category {
  id: string;
  organizationId?: string;
  name: string;
  sortOrder: number;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  organizationId: string;
  categoryId?: string | null;
  category?: Category | null;
  name: string;
  sku: string;
  barcode: string;
  unit: string;
  unitPrecision?: number;
  salePrice: number;
  costPrice: number;
  minStock: number;
  imageUrl?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  balance?: number;
}

export interface InventoryBalance {
  storeId: string;
  productId: string;
  quantity: number;
  updatedAt?: string;
  product?: Product;
  store?: Store;
}

export type DocumentType = 'purchase' | 'adjustment' | 'transfer_out' | 'transfer_in' | 'return_in' | 'reversal';
export type DocumentStatus = 'draft' | 'confirmed';

export interface StockDocumentItem {
  id?: string;
  stockDocumentId?: string;
  productId: string;
  product?: Product;
  quantity: number;
  unitCost: number;
  note?: string | null;
}

export interface StockDocument {
  id: string;
  organizationId: string;
  storeId: string;
  store?: Store;
  supplierId?: string | null;
  supplier?: Supplier | null;
  documentType: DocumentType;
  documentNo: string;
  reversalOfId?: string | null;
  reversal?: {id:string;documentNo:string} | null;
  status: DocumentStatus;
  note?: string | null;
  createdBy: string;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
  items: StockDocumentItem[];
}

export interface StockTransferItem {
  id?: string;
  stockTransferId?: string;
  productId: string;
  product?: Product;
  receivedQuantity?: number;
  returnedQuantity?: number;
  quantity: number;
  unitCost: number;
}

export interface StockTransfer {
  id: string;
  organizationId: string;
  fromStoreId: string;
  fromStore?: Store;
  toStoreId: string;
  toStore?: Store;
  status: 'draft' | 'sent' | 'received' | 'cancelled' | 'closed';
  note?: string | null;
  createdBy: string;
  sentAt?: string | null;
  receivedAt?: string | null;
  createdAt: string;
  items: StockTransferItem[];
}

export interface Customer {
  id: string;
  organizationId: string;
  fullName: string;
  phone: string;
  address?: string | null;
  note?: string | null;
  creditLimit: number;
  debt?: number | string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Supplier {
  id: string;
  organizationId: string;
  name: string;
  phone?: string | null;
  tin?: string | null;
  address?: string | null;
  note?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type ShiftStatus = 'open' | 'closed';

export interface CashMovement {
  id: string;
  shiftId: string;
  movementType: 'cash_in' | 'cash_out';
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface Shift {
  id: string;
  registerId: string;
  register?: Register;
  organizationUserId: string;
  organizationUser?: {
    user: User;
    role: Role;
  };
  openedAt: string;
  openingCash: number;
  closedAt?: string | null;
  expectedCash?: number | null;
  countedCash?: number | null;
  cashDifference?: number | null;
  status: ShiftStatus;
  note?: string | null;
  cashMovements?: CashMovement[];
  sales?: Sale[];
  payments?: Payment[];
}

export type SaleStatus = 'draft' | 'completed' | 'voided' | 'partially_returned' | 'returned';
export type PaymentType = 'cash' | 'card' | 'transfer' | 'credit';

export interface SaleItem {
  id?: string;
  saleId?: string;
  productId: string;
  productName: string;
  sku: string;
  unit?: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
  unitCost: number;
}

export interface Payment {
  id?: string;
  organizationId?: string;
  storeId?: string;
  shiftId?: string | null;
  saleId?: string | null;
  customerId?: string | null;
  paymentType: PaymentType;
  direction: 'in' | 'out';
  amount: number;
  referenceNo?: string | null;
  paidAt?: string;
  note?: string | null;
}

export interface DebtAllocationTarget {saleId:string|null;receiptNo:string|null;balance:string}

export interface CustomerDebt {
  customerId: string;
  customerName: string;
  creditLimit: number;
  totalDebt: number;
  remainingCredit: number;
  recentPayments: Payment[];
  allocationTargets?: {page:number;hasMore:boolean;items:DebtAllocationTarget[]};
}

export interface AuditSummary {id:string;actorId:string|null;entityType:string;entityId:string;action:string;createdAt:string;actor:{fullName:string}|null}
export interface SaleReturnHistory {
  id:string;returnReceiptNo:string;returnedAt:string;status:string;refundAmount:string;reason:string|null;
  processor:{fullName:string};
  items:{id:string;saleItemId:string;quantity:string;lineTotal:string;disposition:string;saleItem:{productName:string;sku:string;unit:string|null}}[];
}
export interface Sale {
  saleReturns?:{id:string;refundAmount:string;returnReceiptNo:string;returnedAt:string}[];
  id: string;
  organizationId: string;
  storeId: string;
  registerId: string;
  shiftId: string;
  cashierId: string;
  customerId?: string | null;
  customer?: Customer | null;
  receiptNo: string;
  status: SaleStatus;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  note?: string | null;
  completedAt?: string | null;
  voidedAt?: string | null;
  createdAt: string;
  items: SaleItem[];
  payments?: Payment[];
  register?: Register;
  shift?: Shift;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  lineTotal: number;
}

export interface DashboardReportData {
  date: string;
  totalSales: number;
  totalRevenue: number;
  averageCheck: number;
  cashPayments: number;
  cardPayments: number;
  openShifts: number;
  lowStockCount: number;
  topProducts: {
    id: string;
    name: string;
    sku: string;
    quantity: number;
    revenue: number;
  }[];
}

export interface SalesReportSummary {
  totalRevenue: number;
  totalDiscount: number;
  totalItems: number;
  averageSale: number;
}

export interface ProductReportItem extends Product {
  quantitySold: number;
  revenue: number;
  cost: number;
  profit: number;
  profitMargin: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary?: SalesReportSummary;
}

export interface OrganizationMember {
 id: string; role: Role; isActive: boolean;
 user: User; stores?: Store[];
}

export interface CatalogUnit {id:string;code:string;name:string;precision:number;isActive:boolean}
export interface ProductBarcode {id:string;value:string;isPrimary:boolean}

export interface StockCountReading {
 id:string;round:number;quantity:string|number;countedBy:string;countedAt:string;
}
export interface StockCountLine {
 id:string;productId:string;productName:string;sku:string;unit:string;unitChanged?:boolean;
 expectedQuantity?:string|number;unitCost?:string|number;readings:StockCountReading[];
}
export interface StockCount {
 id:string;storeId:string;scope:'full'|'partial';blind:boolean;status:'counting'|'review'|'approved'|'cancelled';
 createdAt:string;approvedBy?:string|null;approvedAt?:string|null;adjustmentId?:string|null;reason?:string|null;
 store?:{name:string};lines?:StockCountLine[];
}

export interface CustomerDebtDocumentInput {
 operationId:string;kind:'opening'|'increase'|'decrease'|'write_off';amount:string;reason:string;saleId?:string;effectiveAt?:string;dueAt?:string;
}
export interface CustomerStatementEntry {
 id:string;sourceType:string;sourceId:string;saleId:string|null;receiptNo:string|null;amount:string;balance:string;
 effectiveAt:string;dueAt:string|null;createdAt:string;note:string|null;actorId:string|null;actorName:string|null;
}
export interface CustomerStatement {
 aging:{asOf:string;overdue:string;upcoming:string;noDueDate:string;unallocated:string;debtTotal:string;creditBalance:string;requiresReconciliation:boolean};
 customer:{id:string;fullName:string};entries:CustomerStatementEntry[];
 summary:{openingBalance:string;increases:string;reductions:string;closingBalance:string;currentBalance:string};
 pagination:{page:number;limit:number;total:number;totalPages:number};
}
