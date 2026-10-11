import {queryReportsSales} from '../exports/queries/reports-sales'
import {queryReportsProducts} from '../exports/queries/reports-products'
import {queryReportsPurchases} from '../exports/queries/reports-purchases'
import {queryReportsBreakdowns} from '../exports/queries/reports-breakdowns'
import {queryReportsSupplierBalances} from '../exports/queries/reports-supplier-balances'
import {queryInventoryBalances} from '../exports/queries/inventory-balances'
import {queryInventoryMovements} from '../exports/queries/inventory-movements'
import {queryInventoryDispositions} from '../exports/queries/inventory-dispositions'
import {queryProducts} from '../exports/queries/products'
import {queryCategories} from '../exports/queries/categories'
import {queryUnits} from '../exports/queries/units'
import {queryCustomers} from '../exports/queries/customers'
import {querySuppliers} from '../exports/queries/suppliers'
import {queryShifts} from '../exports/queries/shifts'
import {queryStockDocuments} from '../exports/queries/stock-documents'
import {queryTransfers} from '../exports/queries/transfers'
import {queryAudit} from '../exports/queries/audit'
import {queryProductsPrices} from '../exports/queries/products-prices'
export const REPORT_QUERIES = {
 'reports-sales':{path:'/api/reports/sales',query:queryReportsSales},
 'reports-products':{path:'/api/reports/products',query:queryReportsProducts},
 'reports-purchases':{path:'/api/reports/purchases',query:queryReportsPurchases},
 'reports-breakdowns':{path:'/api/reports/breakdowns',query:queryReportsBreakdowns},
 'reports-supplier-balances':{path:'/api/reports/supplier-balances',query:queryReportsSupplierBalances},
 'inventory-balances':{path:'/api/inventory/balances',query:queryInventoryBalances},
 'inventory-movements':{path:'/api/inventory/movements',query:queryInventoryMovements},
 'inventory-dispositions':{path:'/api/inventory/dispositions',query:queryInventoryDispositions},
 'products':{path:'/api/products',query:queryProducts},
 'categories':{path:'/api/categories',query:queryCategories},
 'units':{path:'/api/units',query:queryUnits},
 'customers':{path:'/api/customers',query:queryCustomers},
 'suppliers':{path:'/api/suppliers',query:querySuppliers},
 'shifts':{path:'/api/shifts',query:queryShifts},
 'stock-documents':{path:'/api/stock-documents',query:queryStockDocuments},
 'transfers':{path:'/api/transfers',query:queryTransfers},
 'audit':{path:'/api/audit',query:queryAudit},
 'products-prices':{path:'/api/products/prices',query:queryProductsPrices},
} as const
