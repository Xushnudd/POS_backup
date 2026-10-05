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

export type DocumentType = 'purchase' | 'adjustment' | 'transfer_out' | 'transfer_in' | 'return_in';
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
  status: 'draft' | 'sent' | 'received';
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
  debt?: number;
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

export interface CustomerDebt {
  customerId: string;
  customerName: string;
  creditLimit: number;
  totalDebt: number;
  remainingCredit: number;
  recentPayments: Payment[];
}

export interface Sale {
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
