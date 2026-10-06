import {
  ApiResponse,
  CatalogUnit,
  ProductBarcode,
  Organization,
  OrganizationMember,
  AuthData,
  Category,
  Customer,
  CustomerDebt,
  DashboardReportData,
  InventoryBalance,
  Payment,
  Product,
  ProductReportItem,
  Register,
  Sale,
  SaleReturnHistory,
  AuditSummary,
  Shift,
  StockDocument,
  StockCount,
  CustomerStatement,
  CustomerDebtDocumentInput,
  StockTransfer,
  Store,
  Supplier,
} from '@/types';

export class ApiError extends Error { code?: string; details?: unknown; status?: number; }
class ApiClient {
  csvExport=(path:'/products'|'/customers'|'/reports/sales'|'/reports/products'|'/suppliers'|'/inventory/movements'|'/shifts'|'/audit'|'/categories'|'/units'|`/products/${string}/barcodes`|'/stock-documents'|'/transfers'|'/inventory/balances',params:Record<string,string>)=>this.request<{filename:string;content:string}>(`${path}?${new URLSearchParams({...params,format:'csv'})}`);
  sessions = {
    list:(page=1)=>this.request<{id:string;organizationId:string;createdAt:string;expiresAt:string;idleExpiresAt:string;current:boolean}[]>(`/auth/sessions?page=${page}&limit=20`),
    revoke:(sessionId:string)=>this.request('/auth/sessions',{method:'POST',body:JSON.stringify({sessionId})}),
  };
  auditSummary = (params:Record<string,string>) => this.request<AuditSummary[]>(`/audit?${new URLSearchParams({...params,view:'summary',limit:'50'})}`);
  private getBaseUrl(): string {
    return process.env.NEXT_PUBLIC_API_URL || '/api';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const url = `${this.getBaseUrl()}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'same-origin',
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        const errorMsg =
          data?.error?.message || data?.message || `Xatolik: ${response.statusText}`;
        const error = new ApiError(errorMsg);
        error.code = data?.error?.code;
        error.status = response.status;
        error.details = data?.error?.details;
        throw error;
      }

      return data;
    } catch (err: unknown) {
      // If error is network or JSON parsing error
      if (!(err instanceof ApiError) || !err.code) {
        console.error(`API Request failed on [${endpoint}]:`, err);
      }
      throw err;
    }
  }

  operations = {
    cancelDraftIntent: (operationId:string,payload:Record<string,unknown>) => this.request<{state:'cancelled'|'created';saleId?:string}>('/operations/cancel',{method:'POST',body:JSON.stringify({operationId,payload})}),
    status: (type: string, operationId: string) => this.request<{state:'not_found'|'completed'|'cancelled';result?:Sale}>(`/operations?${new URLSearchParams({type,operationId})}`),
  };

  // Authentication
  auth = {
    login: (body: { phone: string; password: string }) =>
      this.request<AuthData>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    register: (body: {
      fullName: string;
      phone: string;
      password: string;
      organizationName: string;
      email?: string;
      tin?: string;
    }) =>
      this.request<AuthData>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    acceptInvitation: (data:{token:string;fullName?:string;password?:string}) => this.request<{organizationId:string;membershipId:string}>('/auth/invitations/accept',{method:'POST',body:JSON.stringify(data)}),
    logout: () => this.request('/auth/logout', { method: 'POST', body: '{}' }),
    logoutAll: () => this.request('/auth/logout-all', { method: 'POST', body: '{}' }),
    changePassword:(currentPassword:string,newPassword:string)=>this.request('/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})}),
    me: () => this.request<AuthData>('/auth/me'),
  };

  units = {
    list: (params:Record<string,string>={}) => this.request<CatalogUnit[]>(`/units?${new URLSearchParams(params)}`),
    create: (data:{code:string;name:string;precision:number}) => this.request<CatalogUnit>('/units',{method:'POST',body:JSON.stringify(data)}),
    update: (id:string,data:{name?:string;precision?:number;isActive?:boolean}) => this.request<CatalogUnit>(`/units/${id}`,{method:'PUT',body:JSON.stringify(data)}),
  };
  barcodes = {
    list: (id:string,params:Record<string,string>={}) => this.request<ProductBarcode[]>(`/products/${id}/barcodes?${new URLSearchParams(params)}`),
    add: (id:string,value:string) => this.request<ProductBarcode>(`/products/${id}/barcodes`,{method:'POST',body:JSON.stringify({value})}),
    remove: (id:string,barcodeId:string) => this.request(`/products/${id}/barcodes/${barcodeId}`,{method:'DELETE',body:'{}'}),
  };

  // Products
  products = {
    list: (params: {
      organizationId: string;
      search?: string;
      categoryId?: string;
      barcode?: string;
      page?: number;
      limit?: number;
    }) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          q.append(k, String(v));
        }
      });
      return this.request<Product[]>(`/products?${q.toString()}`);
    },

    get: (id: string) => this.request<Product>(`/products/${id}`),

    findByBarcode: (organizationId: string, barcode: string) => {
      const query = new URLSearchParams({ organizationId, barcode });
      return this.request<Product>(`/products?${query.toString()}`);
    },

    create: (data: Partial<Product>) =>
      this.request<Product>('/products', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<Product>) =>
      this.request<Product>(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      this.request(`/products/${id}`, {
        method: 'DELETE',
      }),
  };

  archive = {
    list:(kind:'products'|'customers'|'categories',params:Record<string,string>)=>this.request<{id:string;name?:string;fullName?:string;isActive:boolean}[]>(`/${kind}?${new URLSearchParams(params)}`),
    setActive:(kind:'products'|'customers'|'categories',id:string,isActive:boolean)=>this.request(`/${kind}/${id}`,{method:'PUT',body:JSON.stringify({isActive})}),
  };

  // Categories
  categories = {
    list: (organizationId: string,params:Record<string,string>={}) =>
      this.request<Category[]>(`/categories?${new URLSearchParams({organizationId,...params})}`),

    create: (data: { organizationId: string; name: string; sortOrder?: number }) =>
      this.request<Category>('/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<Category>) =>
      this.request<Category>(`/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      this.request(`/categories/${id}`, {
        method: 'DELETE',
      }),
  };

  // Sales
  sales = {
    printRequest:(id:string,data:{operationId:string;width:58|80;copy:boolean})=>this.request(`/sales/${id}/print-requests`,{method:'POST',body:JSON.stringify(data)}),
    list: (params: {
      organizationId: string;
      customerId?:string;
      storeId?: string;
      shiftId?: string;
      status?: string;
      page?: number;
      limit?: number;
    }) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          q.append(k, String(v));
        }
      });
      return this.request<Sale[]>(`/sales?${q.toString()}`);
    },

    get: (id: string) => this.request<Sale>(`/sales/${id}`),

    create: (data: Record<string, unknown>) =>
      this.request<Sale>('/sales', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Record<string, unknown>) =>
      this.request<Sale>(`/sales/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    complete: (id: string, data: { creditDueAt?:string; payments: { paymentType: string; amount: number; referenceNo?: string }[] }) =>
      this.request<Sale>(`/sales/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    returnHistory: (id:string,page=1) => this.request<SaleReturnHistory[]>(`/sales/${id}/returns?page=${page}&limit=20`),
    returns: (id: string, data: {operationId:string;shiftId:string;reason:string;items:{saleItemId:string;quantity:number;disposition:'sellable'|'damaged'|'write_off'}[]}) =>
      this.request(`/sales/${id}/returns`, {method:'POST',body:JSON.stringify(data)}),

    void: (id: string) =>
      this.request<Sale>(`/sales/${id}/void`, {
        method: 'POST',
      }),
  };

  // Shifts
  shifts = {
    list: (params: { registerId?: string; status?: string } = {}) => {
      const q = new URLSearchParams();
      if (params.registerId) q.append('registerId', params.registerId);
      if (params.status) q.append('status', params.status);
      return this.request<Shift[]>(`/shifts?${q.toString()}`);
    },

    get: (id: string) => this.request<Shift>(`/shifts/${id}`),

    open: (data: { registerId: string; organizationUserId: string; openingCash: number; note?: string; operationId: string }) =>
      this.request<Shift>('/shifts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    close: (id: string, data: { countedCash: number; note?: string }) =>
      this.request<Shift>(`/shifts/${id}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    cashMovement: (id: string, data: { movementType: 'cash_in' | 'cash_out'; amount: number; reason: string; operationId?: string }) =>
      this.request(`/shifts/${id}/cash-movements`, {
        method: 'POST',
        body: JSON.stringify({ ...data, operationId: data.operationId ?? crypto.randomUUID() }),
      }),
  };

  // Inventory
  inventory = {
    balances: (params: { organizationId: string; storeId?: string; lowStock?: boolean;search?:string;categoryId?:string;page?:number;limit?:number }) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          q.append(k, String(v));
        }
      });
      return this.request<InventoryBalance[]>(`/inventory/balances?${q.toString()}`);
    },

    movements: (params: { organizationId: string; storeId?: string; productId?: string; movementType?:string;sourceType?:string;sourceId?:string;from?:string;to?:string;page?:number;limit?:number }) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          q.append(k, String(v));
        }
      });
      return this.request<Record<string, unknown>[]>(`/inventory/movements?${q.toString()}`);
    },
  };

  // Stock Documents (Kirim / Tuzatish)
  stockCounts={
    list:(page=1,filter:'active'|'all'='active')=>this.request<StockCount[]>(`/stock-counts?page=${page}&limit=50&filter=${filter}`),
    get:(id:string)=>this.request<StockCount>(`/stock-counts/${id}`),
    start:(data:{operationId:string;organizationId:string;storeId:string;scope:'full'|'partial';blind:boolean;productIds?:string[]})=>this.request<StockCount>('/stock-counts',{method:'POST',body:JSON.stringify(data)}),
    record:(id:string,data:{operationId:string;items:{lineId:string;quantity:string}[]})=>this.request<StockCount>(`/stock-counts/${id}`,{method:'POST',body:JSON.stringify(data)}),
    submit:(id:string)=>this.request<StockCount>(`/stock-counts/${id}/submit`,{method:'POST',body:'{}'}),
    decide:(id:string,action:'approve'|'cancel',data:{operationId:string;reason:string})=>this.request<StockCount>(`/stock-counts/${id}/${action}`,{method:'POST',body:JSON.stringify(data)}),
  };

  stockDocuments = {
    list: (params: {
      organizationId: string;
      storeId?: string;
      documentType?: string;
      supplierId?:string;from?:string;to?:string;search?:string;
      status?: string;
      page?: number;
      limit?: number;
    }) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          q.append(k, String(v));
        }
      });
      return this.request<StockDocument[]>(`/stock-documents?${q.toString()}`);
    },

    get: (id: string) => this.request<StockDocument>(`/stock-documents/${id}`),

    create: (data: {
      organizationId: string;
      storeId: string;
      supplierId?: string;
      documentType: string;
      documentNo: string;
      note?: string;
      items: { productId: string; quantity: number; unitCost: number; note?: string }[];
    }) =>
      this.request<StockDocument>('/stock-documents', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    reverse: (id:string,data:{operationId:string;reason:string}) =>
      this.request<StockDocument>(`/stock-documents/${id}/reverse`,{method:"POST",body:JSON.stringify(data)}),

    confirm: (id: string) =>
      this.request<StockDocument>(`/stock-documents/${id}/confirm`, {
        method: 'POST',
      }),
  };

  // Transfers
  transfers = {
    list: (params: { organizationId: string; status?: string; page?: number; limit?: number;fromStoreId?:string;toStoreId?:string;from?:string;to?:string }) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          q.append(k, String(v));
        }
      });
      return this.request<StockTransfer[]>(`/transfers?${q.toString()}`);
    },

    create: (data: {
      organizationId: string;
      fromStoreId: string;
      toStoreId: string;
      note?: string;
      items: { productId: string; quantity: number; unitCost: number }[];
    }) =>
      this.request<StockTransfer>('/transfers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    returnTransit: (id:string,data:{operationId:string;reason:string}) => this.request<StockTransfer>(`/transfers/${id}/return`,{method:"POST",body:JSON.stringify(data)}),

    cancel: (id:string,reason:string) => this.request<StockTransfer>(`/transfers/${id}/cancel`,{method:"POST",body:JSON.stringify({reason})}),

    send: (id: string) =>
      this.request<StockTransfer>(`/transfers/${id}/send`, {
        method: 'POST',
      }),

    receive: (id: string) =>
      this.request<StockTransfer>(`/transfers/${id}/receive`, {
        method: 'POST',
      }),
  };

  // Customers
  customers = {
    list: (params: { organizationId: string; search?: string; page?: number; limit?: number }) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          q.append(k, String(v));
        }
      });
      return this.request<Customer[]>(`/customers?${q.toString()}`);
    },

    get: (id: string) => this.request<Customer>(`/customers/${id}`),

    create: (data: Partial<Customer>) =>
      this.request<Customer>('/customers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<Customer>) =>
      this.request<Customer>(`/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    exportStatement:(id:string,params:{from?:string;to?:string;format?:'csv'|'commercial-csv'|'html'}={})=>this.request<{filename:string;content:string}>(`/customers/${id}/ledger?${new URLSearchParams({format:'csv',...Object.fromEntries(Object.entries(params).filter(([,value])=>value))})}`),
    statement:(id:string,params:{page?:number;from?:string;to?:string}={})=>this.request<CustomerStatement>(`/customers/${id}/ledger?${new URLSearchParams(Object.entries(params).filter(([,v])=>v!==undefined&&v!=='').map(([k,v])=>[k,String(v)]))}`),
    postDebtDocument:(id:string,data:CustomerDebtDocumentInput)=>this.request<{id:string}>(`/customers/${id}/ledger`,{method:'POST',body:JSON.stringify(data)}),
    getDebt: (id: string, targetsPage?:number) => this.request<CustomerDebt>(`/customers/${id}/debt${targetsPage?`?targetsPage=${targetsPage}`:''}`),
  };

  // Suppliers
  suppliers = {
    get:(id:string)=>this.request<Supplier>(`/suppliers/${id}`),
    purchases:(id:string,params:Record<string,string>={})=>this.request<StockDocument[]>(`/suppliers/${id}/purchases?${new URLSearchParams(params)}`),
    totals:(id:string,params:Record<string,string>={})=>this.request<{purchases:number;reversals:number;purchaseValue:string;reversalValue:string;netPurchaseValue:string;basis:string;currency:string}>(`/suppliers/${id}/purchase-totals?${new URLSearchParams(params)}`),
    list: (organizationId: string,params:Record<string,string>={}) =>
      this.request<Supplier[]>(`/suppliers?${new URLSearchParams({organizationId,...params})}`),

    create: (data: Partial<Supplier>) =>
      this.request<Supplier>('/suppliers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: Partial<Supplier>) =>
      this.request<Supplier>(`/suppliers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  };

  // Payments & Debt Collection
  payments = {
    credit: (data: {
      organizationId: string;
      storeId: string;
      customerId: string;
      amount: number | string;
      shiftId: string;
      operationId: string;
      referenceNo?: string;
      note?: string;
      allocations?:{saleId:string|null;amount:string}[];
    }) =>
      this.request<Payment>('/payments/credit', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // Reports
  reports = {
    reconciliation: (params:{kind:string;storeId?:string;page:number}) => this.request<Record<string,unknown>[]>(`/reports/reconciliation?${new URLSearchParams(Object.entries(params).filter(([,v])=>v!==undefined).map(([k,v])=>[k,String(v)]))}`),
    dashboard: (params: { organizationId: string; storeId?: string; date?: string }) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          q.append(k, String(v));
        }
      });
      return this.request<DashboardReportData>(`/reports/dashboard?${q.toString()}`);
    },

    sales: (params: { organizationId: string; storeId?: string; startDate?: string; endDate?: string }) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          q.append(k, String(v));
        }
      });
      return this.request<Sale[]>(`/reports/sales?${q.toString()}`);
    },

    products: (params: { organizationId: string; storeId?: string; startDate?: string; endDate?: string }) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          q.append(k, String(v));
        }
      });
      return this.request<ProductReportItem[]>(`/reports/products?${q.toString()}`);
    },
  };

  // Stores & Registers
  stores = {
    list: (organizationId: string) =>
      this.request<Store[]>(`/stores?organizationId=${organizationId}`),

    create: (data: { organizationId: string; name: string; address?: string; phone?: string }) =>
      this.request<Store>('/stores', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    registers: (storeId: string) =>
      this.request<Register[]>(`/stores/${storeId}/registers`),

    createRegister: (storeId: string, data: { name: string; code: string }) =>
      this.request<Register>(`/stores/${storeId}/registers`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // Organizations & Users
  organizations = {
    list: () => this.request<Organization[]>('/organizations'),
    switch: (targetOrganizationId:string) => this.request('/organizations/switch',{method:'POST',body:JSON.stringify({targetOrganizationId})}),
    get: (id: string) => this.request<Organization>(`/organizations/${id}`),

    update: (id: string, data: Record<string, unknown>) =>
      this.request<Organization>(`/organizations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    revokeInvitation: (id:string,invitationId:string) => this.request(`/organizations/${id}/invitations/${invitationId}`,{method:'DELETE',body:'{}'}),
    createInvitation: (id:string,data:{phone:string;role:'admin'|'cashier';storeIds:string[]}) => this.request<{id:string;expiresAt:string;invitationToken:string}>(`/organizations/${id}/invitations`,{method:'POST',body:JSON.stringify(data)}),
    updateMember: (id:string,memberId:string,data:{role?:string;isActive?:boolean;storeIds?:string[]}) => this.request(`/organizations/${id}/users/${memberId}`,{method:'PUT',body:JSON.stringify(data)}),
    users: (id: string) => this.request<OrganizationMember[]>(`/organizations/${id}/users`),

    addUser: (
      id: string,
      data: {
        fullName: string;
        phone: string;
        password: string;
        role: string;
        email?: string;
        storeIds?: string[];
      }
    ) =>
      this.request(`/organizations/${id}/users`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };
}

export const api = new ApiClient();
