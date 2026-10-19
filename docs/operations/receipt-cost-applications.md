# Kirim xarajatini tannarxga qo‘llash

PUR-01.05 kirimning qiymat, miqdor yoki explicit vazn bo‘yicha taqsimotini, tarixiy moving-average hisobini va alohida correction jurnalini qamrab oladi. Ish mavjud PostgreSQL, Prisma.Decimal, Next.js va durable IndexedDB formasi orqali bajariladi; tashqi provayder talab qilinmaydi.

## Egasi bajaradigan tartib

1. Kirim filialida haqiqatan to‘langan, qaytarilmagan kapitalizatsiya xarajatini tanlang. Tayyor taqsimotdagi qatorlar va jami xarajatni tekshiring; vazn usulida kg/bazaviy birlikni kiriting.
2. Supplier buyurtmasi ichidagi «Tannarx jurnali»da sababni yozing va hisobni yangilang. Server zaxira, sotilgan mahsulot tannarxi, transit, qiymat farqi va yaxlitlash qoldig‘ini chiqaradi.
3. Oldindan ko‘rish va MFA bilan tasdiqlang. Tasdiqdan keyin original operationId/body brauzerda saqlanadi. Javob noaniq bo‘lsa «Original amalni qayta tekshirish»dan foydalaning; yangi operationId bilan takror xarajat yaratmang.
4. Bekor qilish yangi reversal jurnalini yaratadi; eski jurnal o‘chirilmaydi. Reversed plan qayta qo‘llanmaydi: bekor qilingan tayyor taqsimot o‘rniga yangi reviewed plan zarur. Faol applied planni avval reversalsiz cancel qilish yoki original paid expense/source receiptni qaytarish rad etiladi.
5. «Tannarx jurnalini ko‘rish / yangilash» original application/reversal va keyingi source-linked correctionlarni pagination bilan ko‘rsatadi. Hisob olish yoki MFA ishlamasa yangi posting bajarilmaydi; draft sabab va original unknown-result recovery saqlanadi.

## Hisob, filial va tranzaksiya

Server native ketma-ketlik va original receipt/sale/return/transfer/adjustment/audit manbalarini qayta tekshiradi. Eski hujjatlar o‘zgarmaydi. 60-digit Decimal hisobida inventory + COGS + variance + rounding jami allocationga teng. Yangi cash payment yoki FinancialDocument yozilmaydi. COGS actual sale/return filialiga, global variance/rounding original kirim/xarajat filialiga va correction qo‘llangan sanaga bog‘lanadi (ADR081/085/086).

Expense → receipt → plan → sorted Product locks va Serializable operation ishlatiladi. Hash/source o‘zgarsa COST_PREVIEW_CHANGED bilan yangi review talab qilinadi. Bir xil original key/body bitta natijani qaytaradi; boshqa payload rad etiladi. Hal qilinmagan offline cash ticket, muddati o‘tgan bo‘lsa ham, avval hal qilinadi. Noma’lum legacy order, tasdiqlanmagan manual override yoki manfiy tarixdan taxminiy tannarx chiqarilmaydi.

ReceiptCostApplication va ReceiptCostContinuation immutable tenant/session/source jurnallaridir. SQL149–159 conservation, native sequence, transaction sanasi, current transaction source, actual branch/item, effective return snapshot va read-only admissionni tekshiradi. Yozish yoki audit xatosi original operatsiya, Product cost, native events va barcha jurnal yozuvlarini birga rollback qiladi.

## Keyingi harakatlar

Fee qo‘llangan SKUning keyingi purchase receipt, stock confirmation/reversal/count, transfer send/receive/return, supplier credit, linked return va owner cost override operatsiyasi shu tranzaksiyada tarixni qayta hisoblaydi. Zarur o‘zgarish alohida continuation jurnaliga yoziladi. Oddiy sale actual current issue costni snapshot qiladi; har checkoutda butun tarix qayta skan qilinmaydi.

Faol fee bor transferda jo‘natish paytidagi current cost yangi issueUnitCostSnapshotga muzlatiladi; eski draft unitCost o‘zgarmaydi. Fee yo‘q transferlarning avvalgi frozen-cost qoidasi saqlanadi. Actual write-off allaqachon corrected issue costni xarajat qilgan bo‘lsa, freight variance yana hisoblanmaydi. Manual absolute override displaced freightni original expense filialidagi farq jurnaliga ajratadi. Selective reversal boshqa paid fee manbalarini saqlaydi.

Profit summary, product va category/customer/employee breakdown hisobotlari application hamda continuation COGS correctionlarini posting sanasida bir marta hisoblaydi. Return effective snapshoti ishlatiladi; current inventory qiymatiga tarixiy correction qayta qo‘shilmaydi.

## Xavfsiz chegaralar va qabul

200 receipt product, jami10000 native fact, 8MiB application snapshot; continuation uchun 10000 oldingi yozuv va500000 hisoblash work cap. Limitdan oshsa aniq xato qaytadi, qisman posting yo‘q. Egasi preview/apply/reverse/historyga kira oladi; admin yoki kassirga tarixiy cost arrays berilmaydi. Ichki projection capability actual actor rolini almashtirmaydi va tirik sessiya tekshiruvini saqlaydi.

Lokal sintetik qabul loglari va source hashlar tasks/evidence/receipt-cost-applications-complete-20261013.json faylida. Haqiqiy staging/production, provider, hardware va pilot sinovlari bu qabulga kirmaydi. Migrationlar appdan oldin maintenance tartibida qo‘llanadi; backup va restore rehearsal uchun scripts/ops/test-valuation-migrations.sh mavjud. Bu hujjat production deployment tasdig‘i emas.
