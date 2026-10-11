// Shared user-facing report selection and reviewed filter keys.
export const REPORT_EXPORTS = {
  "reports-sales": {
    "label": "Savdolar va qaytarishlar",
    "filters": [
      "startDate",
      "endDate",
      "asOf",
      "storeId"
    ]
  },
  "reports-products": {
    "label": "Mahsulotlar bo‘yicha savdo",
    "filters": [
      "storeId",
      "categoryId",
      "startDate",
      "endDate",
      "asOf"
    ]
  },
  "reports-purchases": {
    "label": "Xaridlar",
    "filters": [
      "view",
      "from",
      "to",
      "supplierId",
      "productId",
      "storeId",
      "asOf"
    ]
  },
  "reports-breakdowns": {
    "label": "Savdo kesimlari",
    "filters": [
      "dimension",
      "startDate",
      "endDate",
      "asOf",
      "storeId"
    ]
  },
  "reports-supplier-balances": {
    "label": "Yetkazib beruvchi balansi",
    "filters": [
      "asOf",
      "supplierId",
      "storeId"
    ]
  },
  "inventory-balances": {
    "label": "Ombor qoldiqlari",
    "filters": [
      "storeId",
      "categoryId",
      "lowStock",
      "inactiveDays",
      "search"
    ]
  },
  "inventory-movements": {
    "label": "Ombor harakati",
    "filters": [
      "storeId",
      "productId",
      "movementType",
      "sourceId",
      "sourceType",
      "from",
      "to"
    ]
  },
  "inventory-dispositions": {
    "label": "Qaytarilgan tovar yo‘nalishlari",
    "filters": [
      "disposition",
      "storeId"
    ]
  },
  "products": {
    "label": "Mahsulot katalogi",
    "filters": [
      "search",
      "categoryId",
      "status"
    ]
  },
  "categories": {
    "label": "Kategoriyalar",
    "filters": [
      "search",
      "status"
    ]
  },
  "units": {
    "label": "O‘lchov birliklari",
    "filters": [
      "status",
      "search"
    ]
  },
  "customers": {
    "label": "Mijozlar",
    "filters": [
      "search",
      "status"
    ]
  },
  "suppliers": {
    "label": "Yetkazib beruvchilar",
    "filters": [
      "search",
      "status"
    ]
  },
  "shifts": {
    "label": "Smenalar",
    "filters": [
      "registerId",
      "status",
      "storeId",
      "from",
      "to"
    ]
  },
  "stock-documents": {
    "label": "Ombor hujjatlari",
    "filters": [
      "documentType",
      "status",
      "search",
      "storeId",
      "supplierId",
      "from",
      "to"
    ]
  },
  "transfers": {
    "label": "Filiallararo transferlar",
    "filters": [
      "status",
      "fromStoreId",
      "toStoreId",
      "from",
      "to"
    ]
  },
  "audit": {
    "label": "Audit amallari",
    "filters": [
      "view",
      "entityId",
      "actorId",
      "from",
      "to",
      "entityType",
      "action"
    ]
  },
  "products-prices": {
    "label": "Narx tarixi",
    "filters": [
      "field",
      "productId"
    ]
  }
} as const
