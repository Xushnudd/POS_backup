# API vakolat va chegara reyestri

2026-10-06. Bu reyestr route-boundaries.integration.test.ts bilan birga yuritiladi. Test har bir real export qilingan protected HTTP handlerni chaqiradi; yangi route ham avtomatik sinovga kiradi. Hozir90 template va126 handler. Public istisnolar login/register/invitation acceptance/logout hamda health. Public degani CSRF/JSON/hajm limitidan ozod degani emas.

Gateway matritsasi `src/server/auth/policy.ts`: owner/admin serverdagi tenant/store bilan; tashkilotni tahrirlash va xodimlarni boshqarish owner-only. Cashier faqat sales/shifts/products/categories/customers/stores/auth/operations/sync; katalog/mijoz/do‘kon mutatsiyalari yopiq. `/void` manager-only. Ownership recipient GET/accept o‘z persistent requestiga ega. **Gateway allow yakuniy ruxsat emas:** return, corrections, bank deposit, settlement, export/cost, pending-close, foreign actor va branch cheklovlari xizmat ichida ham tekshiriladi. UI yashirish himoya o‘rnini bosmaydi.

`Positive scoped reads…` testida mavjud list/detail/export-file guruhlari valid owner parametrlari bilan200. Moliyaviy mutation success va role/store negative holatlari economic/production-batch/reports-finance/catalog integration va actual cashier browser ssenariylarida. Worker foydalanuvchi sessiyasi yasamaydi: har organization explicit scoped SQL, locked transaction va system audit. Vendor yoki hardware job bu reyestrda mavjud deb taxmin qilinmagan.

| Route template | HTTP exports | Kirish siyosati | Avtomatik negative tekshiruv |
| --- | --- | --- | --- |
| /api/audit | GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/auth/change-password | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/auth/invitations/accept | POST | public; JSON/CSRF mutation checks | public exception |
| /api/auth/login | POST | public; JSON/CSRF mutation checks | public exception |
| /api/auth/logout | POST | public; JSON/CSRF mutation checks | public exception |
| /api/auth/logout-all | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/auth/me | GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/auth/register | POST | public; JSON/CSRF mutation checks | public exception |
| /api/auth/sessions | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/categories/[id] | PUT, DELETE | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/categories | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/customers/[id]/debt | GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/customers/[id]/ledger | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/customers/[id] | GET, PUT, DELETE | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/customers | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/health/live |  | public; JSON/CSRF mutation checks | public exception |
| /api/health/ready |  | public; JSON/CSRF mutation checks | public exception |
| /api/incidents/[id] | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/incidents | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/inventory/balances | GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/inventory/movements | GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/inventory/thresholds | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/operations/cancel | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/operations/handover | GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/operations/overview | GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/operations | GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/organizations/[id]/invitations/[invitationId] | DELETE | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/organizations/[id]/invitations | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/organizations/[id] | GET, PUT | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/organizations/[id]/transfer-ownership | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/organizations/[id]/users/[userId] | PUT | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/organizations/[id]/users | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/organizations | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/organizations/switch | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/ownership-transfers/[id] | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/ownership-transfers | GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/payments/credit | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/payments | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/products/[id]/barcodes/[barcodeId] | DELETE | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/products/[id]/barcodes/generate | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/products/[id]/barcodes/labels | GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/products/[id]/barcodes | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/products/[id] | GET, PUT, DELETE | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/products | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/registers/[id] | PUT | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/reports/dashboard | GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/reports/products | GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/reports/purchases | GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/reports/reconciliation | GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/reports/replenishment | GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/reports/sales | GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/sales/[id]/complete | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/sales/[id]/print-requests | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/sales/[id]/returns | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/sales/[id]/returns/preview | POST | live session + owner/admin service; cashier denied; original branch; read-only economic preview, budget30/min | unauth401; foreign organization/store403/404; invalid input400; manager required403 |
| /api/sales/[id] | GET, PUT | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/sales/[id]/void | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/sales | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/settings/discounts | GET, PUT | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/shifts/[id]/cash-movements | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/shifts/[id]/close-rejection | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/shifts/[id]/corrections | POST, GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/shifts/[id] | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/shifts | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/stock-counts/[id]/approve | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/stock-counts/[id]/cancel | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/stock-counts/[id] | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/stock-counts/[id]/submit | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/stock-counts | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/stock-documents/[id]/confirm | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/stock-documents/[id]/reverse | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/stock-documents/[id] | GET, PUT | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/stock-documents | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/stores/[id]/registers | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/stores/[id] | GET, PUT, DELETE | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/stores | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/suppliers/[id]/purchase-totals | GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/suppliers/[id]/purchases | GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/suppliers/[id] | PUT, GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/suppliers | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/sync/reviews/[id] | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/sync/reviews | GET | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/sync | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/transfers/[id]/cancel | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/transfers/[id]/receive | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/transfers/[id]/return | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/transfers/[id]/send | POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/transfers | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/units/[id] | PUT | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |
| /api/units | GET, POST | live session; owner/admin/cashier gateway + service policy | unauth401; foreign organization403/404; foreign store403/404; forbidden cashier403 |

2026-10-07: manual return preview yangi kirish nuqtasi; original sale lock + live context + same-branch shift; iqtisodiy yozuv va Operation yaratilmaydi.
