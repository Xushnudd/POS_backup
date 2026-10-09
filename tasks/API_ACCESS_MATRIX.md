# API vakolat va chegara reyestri

2026-10-08. Bu reyestr route-boundaries.integration.test.ts bilan birga yuritiladi. Test har bir real export qilingan protected HTTP handlerni chaqiradi; yangi route ham avtomatik sinovga kiradi. Hozir146 template va201 handler. Public istisnolar login/register/invitation acceptance/logout hamda health. Public degani CSRF/JSON/hajm limitidan ozod degani emas.

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
| /api/brands | GET, POST | live session; same organization; manager mutations/list-files; cashier active brands/protected binary read | unauth401; foreign404; cashier mutation403; expiry/delete410 |
| /api/brands/[id] | PUT | live session; same organization; manager mutations/list-files; cashier active brands/protected binary read | unauth401; foreign404; cashier mutation403; expiry/delete410 |
| /api/files | GET, POST | live session; same organization; manager mutations/list-files; cashier active brands/protected binary read | unauth401; foreign404; cashier mutation403; expiry/delete410 |
| /api/files/[id] | GET, DELETE | live session; same organization; manager mutations/list-files; cashier active brands/protected binary read | unauth401; foreign404; cashier mutation403; expiry/delete410 |
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


2026-10-08 qo‘shimcha vakolatlar:

| Route | HTTP | Vakolat / qo‘shimcha chegara | Dalil |
| --- | --- | --- | --- |
| /api/products/prices | GET, POST | Sale history/change owner/admin; cost history/change/export owner-only; cashier403; tenant product refs; max100 reviewed atomic rows; read CSV max10000 | route-boundaries dynamic negatives; reports-finance price batch; three-browser lost acknowledgement |
| /api/inventory/dispositions | GET | Owner barcha o‘z filiallari; admin assigned branches; cashier403; paginated journal and page-product balances; full CSV max10000 | route-boundaries dynamic negatives; reports-finance damaged/refund rollback; three-browser journal |

`/api/products/[id]` PUT manual cost change owner-only; unchanged cost admin formni buzmaydi. `/api/products` CSV cost ustuni owner-only. Narxlar yo‘li literal collection endpoint; generic product-ID reference checkdan chiqarilgan, har bir request item/query product ref validatsiyasi saqlangan.


2026-10-08 ichki finance qo‘shimchasi:

| Route | HTTP | Serverdagi vakolat |
| --- | --- | --- |
| /api/finance/accounts | GET, POST | Read owner/admin assigned stores; create owner-only; cashier403 |
| /api/finance/categories | GET, POST | Read owner/admin; create owner-only; tenant scoped |
| /api/finance/expenses | POST | Owner/admin, account/category/shift scoped, sufficient balance, live session |
| /api/finance/transfers | POST | Owner/admin; ikkala hisob ham assigned scope; atomic equal signed postings |
| /api/finance/documents | GET | Owner/admin; admin document va barcha entry account filiallariga ruxsatli; scoped CSV |
| /api/finance/documents/[id]/reverse | POST | Owner/admin; original barcha hisoblar scoped; original reversal once |
| /api/reports/profit | GET | Owner/admin assigned stores; frozen sale costs; report budget |

`reports-finance.integration.test.ts`: cash/bank balancing, duplicate replay, two concurrent debits, audit rollback, immutable cash mirror, cashier/admin deny va cross-branch transfer detail/export/reversal deny. `Finance UI…` browser ssenariyi exact cents va lost-response original reversalni reload orqali tiklaydi. Yangi handlerlar dynamic boundary testiga avtomatik kiradi. Bu qo‘shimcha SEC-01.02/04 ni o‘zi yakunlamaydi: qolgan core guruhlar qabul qilinishda ham reyestr va testlar yangilanadi.

### Savdo kesimlari qo‘shimchasi

| Route | HTTP | Chegara | Dalil |
| --- | --- | --- | --- |
| /api/reports/breakdowns | GET | Owner/admin assigned stores; cashier403; explicit dimension allowlist, current live scope, CSV full cap/rate; all five revenue totals reconcile overall | Dynamic route boundaries and five-dimension integration fixture; HTTPS breakdown browser |

Supplier ledger yangi boundaries:

| Route | Methods | Vakolat va scope | Majburiy invariant |
| --- | --- | --- | --- |
| /api/suppliers/[id]/ledger | GET, POST | owner/admin; organization + assigned branch | confirmed original receipt; expectedAmount; replay |
| /api/supplier-payments | POST | owner/admin; live supplier/account/shift | bank proof; cash journal atomic; same branch allocation |
| /api/supplier-payments/[id]/allocate | POST | owner/admin; scoped payment | existing advance; invoice remaining bound; no extra cash |
| /api/supplier-payments/[id]/allocations | GET | owner/admin; scoped parent payment | bounded history/count; no foreign rows |

Automatic protected-handler enumeration barcha yangi routega401/tenant/store/cashier negative tekshiruvlarni qo‘llaydi. Positive supplier ledger integration explicit assigned/unassigned admin, foreign owner, owner va cashierni tekshiradi.

| Route | Methods | Vakolat va scope | Majburiy invariant |
| --- | --- | --- | --- |
| /api/purchase-orders | GET, POST | owner/admin; organization + assigned branch | immutable original items; order no stock/cash |
| /api/purchase-orders/[id] | GET | owner/admin; scoped order | aggregate original received/remaining |
| /api/purchase-orders/[id]/receive | POST | owner/admin; scoped original order/item | stock/invoice/receipt/audit/Operation atomic |
| /api/purchase-orders/[id]/receipts | GET | owner/admin; scoped parent | bounded receipt/invoice history |
| /api/reports/supplier-balances | GET | owner/admin; scoped invoice/payment branches | exact aging; past cutoff; full CSV; cashier403 |


| Route | Methods | Vakolat va scope | Majburiy invariant |
| --- | --- | --- | --- |
| /api/supplier-invoices/[id] | GET | owner/admin; original invoice organization + assigned branch | original/net value and remaining quantity |
| /api/supplier-invoices/[id]/credits | GET, POST | owner/admin; scoped invoice + original receipt items | preview, quantity/value bounds, immutable release, atomic stock/debt, no fake cash refund |

Dynamic boundary tests yangi handlerlarni ham tekshiradi. Explicit supplier credit tests foreign owner404/cashier403, paid advance, late audit rollback, parallel original quantity va deferred malformed journal rad holatlarini tekshiradi. Bu SEC-01.02/04ni alohida qabul mezonisiz avtomatik done qilmaydi.


| Route | Methods | Vakolat va scope | Majburiy invariant |
| --- | --- | --- | --- |
| /api/products/[id]/variants | GET, POST | live owner/admin read/create; cashier read only; parent organization scoped | assigned store quantities, hidden cost, unique canonical options, original operation replay, no invented stock/cash |

Variant POST cashier403/foreign404; GET cashier200 va faqat assigned store qty, foreign404 explicit testli. ProductVariant composite SQL FKs, immutable relation va unit checks negative direct DB testlarda tekshiriladi. Har SKU barcode/sale/return mustaqil; generic boundary inventory yangi GET/POSTni ham qamrab oladi.

| /api/auth/pin | POST | own cashier + password reauthentication | owner/admin403; invalid password403; malformed400; live session401 |
| /api/auth/pin-switch | GET, POST | live source session; active assigned branch; target cashier only | foreign/hidden403/404; invalidPIN401; rate429; source consumed401; no elevation |

### Soliq/chegirma va PIN scope qo‘shimchasi (057..059)
GET/POST `/taxes`, PUT `/taxes/[id]`, GET/POST `/taxes/[id]/versions`, POST `/sales/preview` common withApi orqali. Soliq mutatsiyasi owner-only; cashier faqat active konfiguratsiyani o‘qiydi. Preview scope/own-open-shiftni talab qiladi, financial side effect yaratmaydi; price/tax fingerprint create va completionda qayta tekshiriladi. PIN-switch `targetMembershipId` maxsus scoped maydoni orqali target cashier/branchni tekshiradi, `auth/me` PIN sessionda boshqa branchni nested DTOda chiqarmaydi. Yangi foiz/sabab/approval request actorni almashtira olmaydi; cashier limit va current policy yakunlashda ham tekshiriladi. 151 PG integration va focused9; final browser protokoli statusda. Bu yozuv SEC-01.02/04ni avtomatik yopmaydi.


Support DAL qo‘shimchasi (2026-10-08): gateway `support` uchun oddiy biznes rolini yakuniy ruxsat deb olmaydi, xizmatning owner/operator-grant nazorati majburiy. `/api/support/operators` GET owner/password-session; `/api/support/grants` GET issued owner yoki received explicit operator, POST owner explicit consent; `/api/support/grants/[id]/revoke` POST own owner; `/api/support/grants/[id]/view` GET grant operator/password session + active branch/scope/current expiry/revoke. Foreign organization/store query umumiy guardda rad. New route inventory126/176; dedicated support integration wrong actor/platform_admin auto-bypass/foreign branch/missing scope/expiry/revoke/disabled operator/session/SQL/audit failure sinovlari bor. SupportGrant bilan biznesga soxta owner role/session berilmaydi; readonly limited DTO, write routes mavjud emas.


Narx/mijoz qo‘shimcha DALlari: price-rules GET manager scoped shared/assigned branch history; POST shared owner yoki assigned-branch admin, archive same branch va live operation; POSTquote cashier/manager scoped store/product/customer read-only, no stock/payment. customer-groups GET tenant bounded names, POST/assign owner-only. customer-merges GET normalized legacy duplicates va POST reviewed settled merge owner-only; customer history root+immutable original aliases receiptlari own tenant + branch + cashier-own-sale scope. Source/target/group scope SQL FK bilan ham saqlanadi, kerakli live session transaction ichida qayta tekshiriladi. Bular SEC-01.04 exhaustive semantic owner/admin/cashier har-action positive matritsasini o‘z-o‘zidan complete qilmaydi.
| /api/price-rules | GET, POST | manager history; global mutation owner / branch admin DAL | common negative inventory + price integration |
| /api/price-rules/[id]/archive | POST | live owner or assigned branch admin | scoped operation/replay + price integration |
| /api/price-rules/quote | POST | cashier/manager scoped read-only quote | foreign store/customer/product/session + price integration |
| /api/customer-groups | GET, POST | tenant list; owner create | common negative inventory + group integration |
| /api/customer-groups/assign | POST | owner, tenant active customer/group | common negative inventory + group integration |
| /api/customer-merges | GET, POST | owner-only legacy diagnosis / settled merge | tenant/admin/session + identity integration |
| /api/customers/[id]/history | GET | own tenant/store/cashier own receipts, root+aliases | common inventory + identity integration |

| /api/inventory/locations | GET, POST | manager scoped branch locations/reservations; reviewed create | inventory negative192 + reservation role/live tests |
| /api/inventory/locations/move | POST | manager scoped product/source/destination, stock freeze and exact available | journal/conservation/replay integration |
| /api/inventory/reservations | POST | manager scoped exact quantities; expiry <=24h | competing holds/tenant/cashier/revoke integration |
| /api/inventory/reservations/[id]/release | POST | manager scoped original reservation, immutable release | replay/expiry/journal integration |
| /api/inventory/position | GET | manager live branch/product, bounded zones; no cost/PII | common inventory + formula integration |

Worker expiry organizationId scope, max100/SKIPLOCKED, source actor NULL/system audit; no impersonation. Stock reservation consumption is manager-only for manual holds, source-bound for future cash tickets. Sale completion receives reservationId in its immutable idempotency payload, never trusts client stock balances.


Offline cash DAL (2026-10-09): quyidagi gateway yo‘llari owner/admin/cashier business rolelar uchun ko‘rinishi mumkin, ammo yakuniy vakolat live transaction ichida tekshiriladi. Owner branch siyosatini boshqaradi; cashier/admin faqat o‘z source lease/draftidan foydalanadi. Native rate30write/120read per actor/min. Foreign tenant/store/reference, disabled source, expired/changed session, boshqa device/shift/role va arbitrary payment rad. Worker cash-ticket holdni expiry bilan yechmaydi. Owner original cashierga aylantirilmaydi. Full boundary inventory143/198 va dedicated offline PG testlar shu kontraktlarni tekshiradi; **SEC-01.04 exhaustive semantic har-action positive role matritsasi hali ochiq**.

| Route template | HTTP exports | Kirish siyosati | Avtomatik tekshiruv |
| --- | --- | --- | --- |
| /api/offline-cash | GET, POST | live branch; owner lists branch / others own leases; issue own current draft/session/device/shift | quota, two devices, exact stock and replay, tenant/source checks |
| /api/offline-cash/policy | POST | live owner only; current branch | disabled default, amount/TTL validation, idempotency/audit rollback |
| /api/offline-cash/[id] | GET | original user or owner, same branch; minimal terminal proof | source identity + exact original sale/operation proof |
| /api/offline-cash/[id]/cancel | POST | live owner actual goods/cash reconciliation; unposted source only | net-refund proof, expiry hold retention, void/replay/no fake payment |
| /api/offline-cash/[id]/settle | POST | live owner verified original goods+cash/evidence, open source shift | different owner/blocked source/expired lease, original quote/cost, refund/replay/audit |
| /api/sync | POST | original live session/device for offline.cash; current price/tax/policy/expiry/shift | strict cash-only payload, conflicts durable, atomic sale/payment/stock |


Katalog import: POST `/catalog-import/preview` va `/catalog-import`, GET `/catalog-import/export` live owner-only DAL. Preview read-only bounded worker, commit operation+current confirmationHash+SQL unique; other tenant/customer IDs uploadedfiledan foydalanib scope o‘zgartira olmaydi. Full146/201 negativeinventory va dedicatedimport3test owner/actualadmin/cashier/revoke/rollback; SEC-01.04 exhaustive semantic matrix hali ochiq.

Onboarding GET/POST `/api/onboarding`: live owner va own active branch; stale hash/ordered source/immutable checkpoints. Exchange GET/POST `/api/exchanges`, POST `/api/exchanges/preview`: live owner/admin, original sale branch va own current open shift; cashier403. Full149templates/206handlers negativeinventory `/tmp/pos-exchange-integration.log`; actual assigned admin/cashier, tenant/session, auditrollback dedicated4tests. Source sale/customer/product references DALda tekshiriladi, nested replacement organization/register/cashier clientdan olinmaydi. Bu qo‘shimchalar SEC-01.04 barcha semantik amallar matritsasini avtomatik yopmaydi.

Jobs GET/POST `/api/jobs`, GET `/api/jobs/[id]/events`, POST `/api/jobs/[id]/retry`: live owner, tenant/source branch, strict allowlisted reconciliation, active source session and final authorization check. Full152templates/210handlers negativeinventory `/tmp/pos-jobs-integration.log`; dedicated5actual source/role/revoke/claim/recovery/quota/HTTP429/413 cases. Native worker reads stored source, final fence+systemactor=null; actualowner queue/retry actors alohida immutable proof. Worker credential/token frontendga yuborilmaydi.

SEC-02.09: GET `/api/auth/security` va POST `/api/auth/security/read`, `/api/auth/security/retry` owner/admin/cashierning faqat own global accounti. Membership/Session current-context tekshiruvi; history account-wide, org-wide boshqa xodim history accessi yo‘q. NoticeId/EventId source DALda userId bilan bog‘lanadi; raw device/token/phone/IP/UA/hash DTOga chiqmaydi. GET no-touch polling, POST real user action/live runOperation+actor proof. Foreign404, revoked401, retry onlydead/bounded30, read/rate60/30 va retry10/min. Worker systemactor=null, source recipient Event.userId, global inactive user skipped, Event/Notice unique+SQL immutable guards. Dedicated security PG va HTTPS uchbrowser qabul artefaktlari EXECUTION_STATUSdagi individual protokolda beriladi; SEC-01.04 umumiy matritsa alohida ochiq qoladi.

SEC-02.09 yakuniy qabul: full155templates/213handlers va191PG tests `/tmp/pos-security-integration-final.log`,6browser `/tmp/pos-security-browser.log`. Har biri actualownsource/liveauthority va negative route inventory bilan; umumiy SEC-01.04 holati o‘zgartirilmagan.
