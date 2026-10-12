# Xarid xarajatlarini taqsimlash: hisoblash contracti

`src/server/purchases/landed-cost.ts` sof hisoblash moduli. Haqiqiy buyurtma kirimi
uchun vakolatli preview API mavjud; kirim tasdiqlash, supplier qarzi, cash journal
yoki hisobot postingiga hali ulanmagan.
`PUR-01.05` to‘liq tugallangan emas.

## Kirish va usullar

- `amount`: qo‘shimcha xarajat, manfiy bo‘lmagan, ko‘pi bilan ikki kasr xonali
  decimal string; yuqori chegara 999999999999.99.
- `lines`: 1–200 original kirim qatori. UUIDlar noyob; quantity musbat,
  unitCost manfiy emas, ikkalasida ham ko‘pi bilan olti kasr xonasi.
  Quantity allaqachon bazaviy birlikka o‘tkazilgan bo‘lishi kerak.
- `value`: baza miqdori × xaridning original birlik tannarxi.
- `quantity`: baza miqdori. Qatorlarning bazaviy birliklari bir xil bo‘lishi
  shart; dona va kgni to‘g‘ridan-to‘g‘ri qo‘shish rad etiladi.
- `weight`: baza miqdori × kg/bazaviy birlik snapshoti. Har bir qatorga
  musbat `unitWeightKg` berilishi shart; katalog yoki uskuna qiymati taxmin qilinmaydi.

Denominator nol bo‘lsa, hatto xarajat nol bo‘lganda ham hisob rad etiladi.
Nol qiymatli mahsulot value usulida xarajat olmaydi. Musbat qiymatli mahsulotlar
bo‘lmasa quantity yoki haqiqiy vazn snapshotli weight usulini tanlash kerak.
String exponent, ortiqcha kasr xonasi, manfiy, NaN va Infinity qabul qilinmaydi.

## Yaxlitlash va natija

Qatorlar UUID bo‘yicha deterministik tartiblanadi. Xarajat integer sentlarda,
taqsimlash asosi esa integer BigInt bilan hisoblanadi. Musbat asosli oxirgi
qatorgacha ulush pastga yaxlitlanadi; oxirgi musbat qator jami sent qoldig‘ini
oladi. Kirish qatorlari tartibi o‘zgarsa natija o‘zgarmaydi. Bu siyosat
largest-remainder emas: kichik xarajatda oxirgi qator ko‘proq sent olishi mumkin.

`allocatedAmount` moliyaviy qiymatning manbasi. `landedUnitCost` olti kasr xonali
birlik tannarxi; uni quantityga ko‘paytirib allocatedAmountni qayta yasash mumkin
emas. `roundingResidual` quyidagi tenglikni aynan saqlaydi:

```
(landedUnitCost − unitCost) × quantity + roundingResidual = allocatedAmount
sum(allocatedAmount) = amount
```

Rounding residual signed bo‘lishi mumkin; bu manfiy xarajat degani emas.
Katta quantity uchun residual ham sezilarli bo‘lishi mumkin. Natijadagi original
quantity, unitCost, unit va optional vazn kelajakdagi hujjat snapshotiga tegishli.

## PUR-01.05 tugashi uchun qolgan implementatsiya

1. Previewda server original, tenant/branch scoped kirim qatorlarini o‘zi yuklaydi;
   postingda ham shu chegarani va original receipt fingerprintini saqlash kerak.
2. Xarajat va allocation original kirimga bog‘langan immutable hujjat/jurnalga
   yoziladi; boshqa xarajat hujjati bilan double-count qilinmaydi. Cash yoki
   supplier qarzi mavjud tasdiqlangan hujjat orqali yuradi, hisoblash funksiyasi
   ularga mustaqil posting yaratmaydi.
3. Stock va sotilgan qism uchun alohida value/cost-correction jurnalini qurish,
   rounding residualni ham shu hisobda saqlash kerak. Hozirgi moving-average
   arxitekturasida tarixiy kirimdan aynan qaysi dona sotilganini taxmin qilish
   mumkin emas; ADR-081da tasdiqlangan moving-average tarixini qayta hisoblash siyosati
   va uning original snapshoti talab qilinadi; posting hali implementatsiya qilinmagan.
4. Original SaleItem yoki return tannarxi tarixini qayta yozmasdan correctionning
   foyda, valuation va qaytarish hisobotlariga ta’sirini ko‘rsatish kerak.
5. Serializability, product lock tartibi, original-key replay, parallel posting,
   audit rollback, tenant/branch/vakolat va SQL immutability cheklovlarini tekshirish.
6. Vakolatli UI, unknown-result recovery, API hamda database integration va
   browser testlari. Faqat shu gate’lardan keyin parent `done`ga o‘tadi.

Hozirgi sof hisoblashni tekshirish:

```
npm test
node --require ./scripts/test-resolver.cjs .test-build/tests/landed-cost.unit.test.js
```

## Haqiqiy kirim uchun preview API

`POST /api/stock-documents/{id}/landed-cost-preview` — owner yoki assigned branch
admin, current active session. JSON/CSRF/tenant reference chegaralari mavjud
`withApi` orqali tekshiriladi. Har user/tashkilot uchun 30 so‘rov/minut; javob
private/no-store. Bu POST hisoblash uchun; bazaga moliyaviy yozuv kiritmaydi.

```json
{"amount":"120.25","method":"value"}
```

Quantity usuli ham shu formatda `method: "quantity"`. Weight usulida:

```json
{
  "amount": "120.25",
  "method": "weight",
  "weights": [{"stockDocumentItemId":"original-row-uuid","unitWeightKg":"0.5"}]
}
```

UUID placeholder o‘rniga haqiqiy kirim qatori UUIDsi kerak. Weight rejimida aynan
shu hujjatning har bir qatoriga musbat kg/baza-birligi beriladi. Narx, quantity,
unit yoki client-computed allocationni yuborish rad etiladi. Vazn hozir operator
bergan preview input; katalog/hardware tomonidan tasdiqlangan qiymat deb olinmaydi.

Server tasdiqlangan, reversal bo‘lmagan `purchase`ni yuklaydi. Miqdor va xarid
tannarxi StockDocumentItemdan, birlik original PurchaseOrderItem snapshotidan
olinadi. Partial receipt original buyurtmaning butun miqdoridan emas, aynan
qabul qilingan miqdordan hisoblanadi. Live Product.costPrice o‘zgarsa ham preview
original tannarxdan foydalanadi. Unit snapshoti yo‘q manual kirim taxminiy birlik
bilan to‘ldirilmaydi: `409 PURCHASE_RECEIPT_REQUIRED` qaytadi.

Javobda `previewOnly: true`, `stockDocumentId`, `storeId`, method, amount va
taqsimot lines bor. `422 LANDED_COST_ZERO_DENOMINATOR` boshqa usulni tanlashni
bildiradi. Natija xarajat post qilinganini yoki tarixiy foyda tuzatilganini
anglatmaydi. Preview uchun operationId yaratilmaydi; qayta hisoblash yozuv
dublikatini yaratmaydi, chunki biznes posting umuman bajarilmaydi.

## Foydalanuvchi ekrani

Supplier detail → “Xarid buyurtmalari” → kerakli buyurtma → “Original qabullar”
ostida har bir kirimning qo‘shimcha xarajat taqsimoti bor. Summani va usulni tanlang;
weight rejimida har bir mahsulotning kg/bazaviy birlik qiymatini kiriting.
Natijada original qabul miqdori, ajratilgan xarajat, hisoblangan birlik tannarxi va
signed rounding qoldig‘i ko‘rinadi. Bu qatorda “oldindan hisoblash” deb ochiq yozilgan.

Summani, usulni yoki vaznni o‘zgartirish eski natijani darhol olib tashlaydi.
Hisoblanayotganda inputlar va submit band; synchronous pending guard takror submitni
to‘sadi. Tarmoq xatosida inputlar saqlanadi va qayta hisoblash tugmasi chiqadi.
So‘rov 15 soniyadan so‘ng timeout bo‘ladi; preview biznes yozuvi yaratmagani uchun
qayta urinish cash, invoice yoki stock dublikatini hosil qilmaydi. Sahifa reloadida
preview inputlari tiklanmaydi; mavjud kirim hujjati o‘z holatida qoladi.

## To‘langan xarajatga bog‘langan tayyor taqsimot

096 migratsiya `ReceiptCostPlan`ni qo‘shadi. Bu tayyorlangan, hali inventory value
yoki sotilgan qism COGSiga qo‘llanmagan hujjat. `prepared` va `cancelled` holatlari
bor; `applied` holati hozir yo‘q. Bu jurnalning mavjudligi kapitalizatsiya tugadi
degan ma’noni anglatmaydi. Cash yoki supplier qarziga yangi yozuv yaratmaydi.

`POST /api/stock-documents/{id}/cost-plans` owner yoki filialga biriktirilgan admin
uchun. JSON:

```json
{
  "operationId": "original-operation-uuid",
  "expenseDocumentId": "paid-expense-document-uuid",
  "amount": "120.25",
  "method": "value",
  "reason": "Original yetkazish xarajatini shu kirimga tayyorlash"
}
```

UUID placeholderlarini haqiqiy UUID bilan almashtirish kerak. Expense avval
mavjud finance expense oqimida to‘langan bo‘lishi, `capitalised` categoryga va
shu kirimning tashkilot/filialiga tegishli bo‘lishi shart. Bank account ishlatilsa,
bu mavjud qo‘lda tasdiqlangan ichki hisob, real payment provider integratsiyasi
emas. Body amount original expense amount bilan aynan mos kelishi kerak; yangi
expense yoki qo‘shimcha cash debit yaratilmaydi. Weight inputlari previewdagi
format bilan beriladi; server original kirim snapshotini o‘zi qayta hisoblaydi.

Bir expense bir vaqtda faqat bitta `prepared` taqsimotga tegishli. Buni source
row lock, SERIALIZABLE runOperation va SQL partial unique index himoya qiladi.
Yangi taqsimot va audit bir tranzaksiyada; original operationId/payload replay
bitta yozuvni qaytaradi. Audit xatosida assignment va Operation ham rollback.
Expense yoki kirimni bekor qilishdan oldin faol plan bekor qilinishi shart;
DB triggerlar raw SQL reversalda ham shu talabni tekshiradi.

`GET /api/stock-documents/{id}/cost-plans?page=1` → `data.rows` va `data.total`,
20 qator/sahifa, eski cancelled tarix ham ko‘rinadi.

`POST /api/stock-documents/{id}/cost-plans/{planId}/cancel`:

```json
{"operationId":"original-cancel-operation-uuid","reason":"Hali qo‘llanmagan taqsimot kerak emas"}
```

Cancel original snapshotni o‘zgartirmaydi, actor/time/reasonni yozadi. Cash,
invoice yoki cost reversalni o‘zi bajarmaydi. Cancelled source yangi plan uchun
qayta ishlatilishi mumkin; bekor qilingan expense esa qayta tanlanmaydi.
Yangi statuslar keyingi additive migration va value-journal gate’lari orqali
kiritiladi. Qo‘llash UI, actual capitalization/COGS correction va reporting
hali ochiq; hozirgi UI faqat read-only preview qiladi.


## Saqlangan taqsimot tarixi va bekor qilish ekrani

Supplier → xarid buyurtmasi → original qabul ostida saqlangan taqsimotlar 20
qatorlik sahifalarda ko‘rsatiladi. Summa, usul, holat, yaratish sababi/sanasi va
bekor qilish sababi/sanasi saqlangan hujjatdan olinadi. GET xatosida eski qatorlar
faol amallar bilan ko‘rsatilmaydi; qayta yuklash mavjud, so‘rov 15 soniyada tugaydi.

Tayyor taqsimotni bekor qilish avval sabab va amalni ko‘rib tasdiqlashni talab
qiladi. Mavjud DurableMutation original payload va operationIdni tenant/user/device
chegarasidagi IndexedDBga yozadi. Server bekor qilib, HTTP javobi yo‘qolsa, reload
qilingan sahifada cancelled holat ko‘rinsa ham original amalni qayta tekshirish
saqlanadi. Bekor qilingan hujjatdan yangi bekor qilish amali yaratilmaydi.
Mavjud supplier returnPath orqali umumiy pending-amal recovery ham ishlaydi.

Bu ekran yangi allocation yaratish yoki tannarxga qo‘llash imkoniyati emas.
Tayyorlash API mavjud; tayyorlash formasi, moving-average correction posting/jurnal,
hisobotlar va to‘liq PUR-01.05 qabuli hali ochiq.

## Moving-average replay hisoblash chegarasi (2026-10-12)

`src/server/inventory/cost-replay.ts` tasdiqlangan ADR-081 siyosati uchun sof hisoblash modulidir. U hali posting endpointiga ulanmagan va `ReceiptCostPlan`ning `prepared` holati kapitalizatsiya qilinganini anglatmaydi.

Kirish: bitta mahsulotning isbotlangan tartibdagi receipt/issue/return hodisalari. Har bir hodisa noyob ID va musbat, qat’iy oshuvchi sequencega ega bo‘ladi. Timestamp yoki UUID sortidan haqiqiy operatsiya tartibini taxmin qilish mumkin emas. Return oldingi issue IDga bog‘lanadi; jami qaytarish original miqdordan oshmaydi. Qo‘shimcha receipt xarajati butun summada beriladi; olti xonagacha yumaloqlangan birlik tannarxiga yashirilmaydi.

Hisobda Prisma Decimalning 60 raqam aniqligidagi nusxasi ishlatiladi. Har bir receipt va sellable returndan keyin amaldagi olti xonali moving average qayta hisoblanadi. Issue shu vaqtdagi tannarxdan, return esa bog‘langan issuen­ing replay tannarxidan foydalanadi. Yakunda `receiptValue = inventoryValue + cogsValue + roundingValue` tengligi tekshiriladi. Yumaloqlash farqi alohida qaytariladi.

Sinov misoli: 10 dona × 10 kirim, 4 dona savdo, 6 dona × 20 yangi kirim, 6 dona savdo va birinchi savdodan 1 dona qaytarish. Birinchi kirimga kechikkan 20 xarajat qo‘shilganda COGS 120dan 132ga o‘zgaradi. Qolgan 7 donaning qiymati 107.999997, rounding qoldig‘i 0.000003 bo‘ladi. Original kirim va savdo snapshotlari o‘zgarmaydi.

Modul manfiy tarixni, tartib buzilishini, takror IDni va bog‘lanmagan/ortiqcha returnni rad etadi. Transfer, supplier return, count/adjustment, damaged return va oldingi katalog cost override uchun tekshirilgan valuation adapterlari hamda manfiy qoldiq correction siyosati hali zarur. DBdagi eski `occurredAt` yozuvlaridan yo‘qolgan tartibni uydirib backfill qilish taqiqlanadi. Posting uchun yana authoritative sequence, transaction locks, immutable correction journal, original operation replay, audit va hisobot integratsiyasi talab qilinadi. Shu sabab PUR-01.05 va INV-01.07 ochiq qoladi.

`planReceiptCostCorrection` bir receiptga qo‘shimcha xarajat uchun oldingi va yangi replay farqlarini hisoblaydi. Yuqoridagi misolda alohida COGS yozuvlari birinchi sale uchun +8, keyingi sale uchun +6 va bog‘langan return uchun −2; qolgan stock correction +7.999999 va rounding correction +0.000001. Jami aynan 20. To‘liq sotilgan receipt xarajati COGSga tushadi, qolmagan zaxira qiymati oshirilmaydi. Bular posting rejasi natijalari; DB jurnaliga yozilgan natija deb hisoblanmaydi.

## Isbotlangan kelajakdagi tartib va boshlang‘ich chegara

SQL134–137 `InventoryValuationSequence` va `InventoryValuationEvent` jadvallarini kiritadi. Bu original InventoryMovementni almashtirmaydi: mavjud yozuvlar o‘zgarmaydi va ularga sequence backfill qilinmaydi. Har bir keyingi original movement va Product.costPrice o‘zgarishi bitta per-product counter bilan transaction ichida qayd etiladi. Rollback counter va eventni ham qaytaradi; original operation replay yangi movement yoki event yaratmaydi. Timestamp faqat ko‘rsatish uchun, costing tartibi sequence orqali olinadi.

Birinchi capture paytida mavjud eski movement soni, boshlang‘ich quantity va unit cost snapshoti olinadi. Oldingi capture davridan kelgan, boshlang‘ich snapshoti yo‘q state NULLligicha qoladi; bugungi balance bilan taxminiy backfill qilinmaydi. Jurnal bo‘lmasa ham mavjud qoldiq nol bo‘lmasa, to‘liq tarix deb olinmaydi. `readProductValuationHistory` ownerning tirik sessiyasini tekshiradi va avtomatik replay uchun nol-qoldiq chegara, eski movementlarning yo‘qligi hamda contiguous sequence talab qiladi. Ma’lumot yetishmasa `COST_HISTORY_INCOMPLETE`/`COST_HISTORY_ORDER_INVALID` bilan rad etadi. Bu eski ma’lumotlar uchun tasdiqlangan reconciliation kerakligini anglatadi, ma’lumotni o‘chirishni emas.

Tartib va eventni generic tenant inserts yoki top-level ORM/raw DB write orqali yasash rad etiladi. Native capture guard original movement snapshotini tekshiradi; journal UPDATE/DELETE bilan almashtirilmaydi. Boshlang‘ich snapshot va sequence identity o‘zgarmaydi. Native capture original Product/InventoryMovementning mavjud biznes-write tekshiruvlarini meros qiladi; alohida public write endpointi yo‘q. Global product tarixi filiallararo ma’lumotni o‘z ichiga olgani uchun owner-only. Oddiy admin/kassirga ochilmaydi. Cost change eventida actorni taxmin qilib yozilmaydi: original owner/API audit va hujjatning mavjud tasdiq tarixi alohida qoladi.

Owner tenant eksportiga ikkala dataset ham kiritilgan, BigInt string bo‘lib chiqariladi; recovery rejasida FKlar schema metadata orqali ko‘rinadi. Bular portable archive, SQL restore buyrug‘i emas. `bash scripts/ops/test-valuation-migrations.sh` dedicated `pos-plan-test-db`da vaqtinchalik bazalar bilan137 fresh migration, synthetic133 dump upgrade/repeat, eski movement hash o‘zgarmasligi, no fake legacy order, native forge rejection va haqiqiy valuation dump/restore hashini tekshiradi. Haqiqiy customer/staging/production qabuli emas.

SQL137 counter bor holatda PK lookupdan foydalanadi; boshlang‘ich legacy/balance scan faqat birinchi captureda. Testlar: actual receipt cost/movement bir transactionda; parallel branch writes; original replay; rollback; readonly generic insert; eski unjournaled stock; owner-only read; exact tenant export. Hozircha bu capture/read/calculation core hisoblanadi. Expense-to-receipt posting, harakat turlari adapterlari va immutable stock/COGS correction journals tugamaguncha PUR-01.05 `done` emas.
