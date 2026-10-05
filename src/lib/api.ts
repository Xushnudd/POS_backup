import {
  ApiResponse,
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
  Shift,
  StockDocument,
  StockTransfer,
  Store,
  Supplier,
  User,
} from '@/types';

class ApiClient {
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
        const error: any = new Error(errorMsg);
        error.code = data?.error?.code;
        error.details = data?.error?.details;
        throw error;
      }

      return data;
    } catch (err: any) {
      // If error is network or JSON parsing error
      if (!err.code) {
        console.error(`API Request failed on [${endpoint}]:`, err);
      }
      throw err;
    }
  }

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

    logout: () => this.request('/auth/logout', { method: 'POST', body: '{}' }),
    logoutAll: () => this.request('/auth/logout-all', { method: 'POST', body: '{}' }),
    me: () => this.request<AuthData>('/auth/me'),
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

  // Categories
  categories = {
    list: (organizationId: string) =>
      this.request<Category[]>(`/categories?organizationId=${organizationId}`),

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
    list: (params: {
      organizationId: string;
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

    create: (data: any) =>
      this.request<Sale>('/sales', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (id: string, data: any) =>
      this.request<Sale>(`/sales/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    complete: (id: string, data: { payments: { paymentType: string; amount: number; referenceNo?: string }[] }) =>
      this.request<Sale>(`/sales/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

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
    balances: (params: { organizationId: string; storeId?: string; lowStock?: boolean }) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          q.append(k, String(v));
        }
      });
      return this.request<InventoryBalance[]>(`/inventory/balances?${q.toString()}`);
    },

    movements: (params: { organizationId: string; storeId?: string; productId?: string }) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          q.append(k, String(v));
        }
      });
      return this.request<any[]>(`/inventory/movements?${q.toString()}`);
    },
  };

  // Stock Documents (Kirim / Tuzatish)
  stockDocuments = {
    list: (params: {
      organizationId: string;
      storeId?: string;
      documentType?: string;
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

    confirm: (id: string) =>
      this.request<StockDocument>(`/stock-documents/${id}/confirm`, {
        method: 'POST',
      }),
  };

  // Transfers
  transfers = {
    list: (params: { organizationId: string; status?: string; page?: number; limit?: number }) => {
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

    getDebt: (id: string) => this.request<CustomerDebt>(`/customers/${id}/debt`),
  };

  // Suppliers
  suppliers = {
    list: (organizationId: string) =>
      this.request<Supplier[]>(`/suppliers?organizationId=${organizationId}`),

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
    }) =>
      this.request<Payment>('/payments/credit', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // Reports
  reports = {
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
    get: (id: string) => this.request<any>(`/organizations/${id}`),

    update: (id: string, data: any) =>
      this.request<any>(`/organizations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    users: (id: string) => this.request<any[]>(`/organizations/${id}/users`),

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
