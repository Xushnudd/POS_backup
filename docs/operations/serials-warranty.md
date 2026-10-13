# Seriya raqami va kafolat core — INV-02.07

Har serial bitta haqiqiy birlikdir. SerialNumber current state projectioni, immutable SerialEvent original harakati, Warranty sotuv paytidagi kafolat snapshoti va WarrantyService servis jurnali mavjud. Mavjud PostgreSQL/Prisma, Zod, Next.js va durable IndexedDB ishlatiladi; yangi paket yoki vendor integratsiyasi qo‘shilmagan.

## Foydalanish

1. Egasi Ombor → «Seriya raqamlari va kafolat»da tarixi yo‘q, precision0 birlikli mahsulotni tanlaydi. Kafolat kunlari/shartlari va sababni kiritib, preview/MFA orqali nazoratni yoqadi. Nazorat keyin o‘chirilmaydi. Eski qoldiqdan taxminiy seriallar yaratilmaydi; zarur bo‘lsa yangi SKU ochiladi. Partiya va serial nazorati bir SKUda birga yoqilmaydi.
2. Supplier buyurtmasining qisman qabulida yoki stock receipt/opening hujjatida har butun birlik uchun bitta serial kiritiladi. Registry trim va upper-case normalization bilan tashkilot bo‘yicha unique. Ichki identifikator1–100ASCII harf/raqam va nuqta, underscore, slash, hyphen qabul qiladi; bu vendor protokoli yoki maxsus skaner formati emas.
3. Kassadagi to‘lov oynasida aniq sotiladigan seriallarni belgilang. Miqdor bilan seriallar soni teng bo‘lishi shart. Server current branch/state va stockni qayta tekshiradi. Checkout operationId/body, jumladan serial tanlovi, unknown result/reload uchun saqlanadi. Bir birlik ikki parallel savdoga o‘tmaydi.
4. Original chekdagi qaytarishda aynan shu sale itemga sotilgan birlik tanlanadi. Sellable → available; damaged → damaged; write_off → retired. Original kafolat o‘zgarmaydi. Keyingi qayta sotish yangi sale-linked kafolat snapshotini yaratadi. Almashtirish return + replacement sale bilan birga yoziladi; bir birlikni qaytarib qayta sotish ham native tartibda ko‘rinadi.
5. Transfer jo‘natishida seriallar tanlanadi. Qisman soz/brak/kamomad qabulida har kategoriya uchun original transit seriallar tanlanadi. Butun qolgan to‘plamni qabul/qaytarish aniq original set bo‘lganda avtomatik olinishi mumkin; qisman noaniq tanlov rad. Current lastTransferId boshqa yoki eski transferdan birlik olishni taqiqlaydi.
6. Supplier goods return faqat original receiptning available birliklarini oladi. Negative stock adjustmentda serial picker ishlatiladi. Loss reversal original retired birlikni tiklaydi; yangi serial uydirilmaydi. Generic aggregate StockCount serialized SKU uchun rad: aniq birlik ro‘yxati va source-linked receipt/loss/reversal bilan solishtiriladi.
7. Owner/admin sotilgan birlikning original kafolati bo‘yicha opened → in_progress → resolved/rejected servis yozadi. Closed holatdan yangi opened murojaat mumkin; parallel ochiq murojaat ketma-ketligi nazorat qilinadi. Note majburiy. Servis stock, pul, refund yoki tashqi repair vendor amalini yaratmaydi. Returned/resold birlikning eski kafolati bo‘yicha yangi servis rad; tarix o‘qish uchun qoladi.

Kafolat starti sale postingining database transaction vaqti (UTC), yakuni administrator kiritgan kunlar ×24soat.0kun muddati tugagan intervaldir. Bu avtomatik huquqiy kafolat yoki manufacturer siyosati emas; shartni biznes egasi kiritadi. Expiry tashqarisidagi murojaatni qayd qilish mumkin, lekin qoplash avtomatik tasdiqlanmaydi; withinWarranty audit metadata bo‘lib, operatorning actual resolved/rejected qarori izoh bilan yoziladi. Policy o‘zgarishi faqat keyingi sotuvlarga ta’sir qiladi.

## Transaction va native himoya

Receipt/sale/return/transfer bilan serial event va current state aynan bir Serializable operation ichida yoziladi. Unique organization+code, movement+serial, serial+ordinal va warranty+ordinal mavjud. Event ordinalni native trigger master versiondan ajratadi; bir transaction sanasi teng bo‘lsa ham return-before-resale tartibi yo‘qolmaydi. Service tartibi original Warranty lock ostida ajratiladi. Native movement/disposition count va available serial count physical balancega teng bo‘lishi shart. Raw stock delete, serial state edit, eski event/warranty/service edit/delete, policy owner-audit proofsiz tahrir va sent transfer input tahriri rad.

Original receipt/sale/payment hujjatlari qayta yozilmaydi. Late warranty/event/audit failure barcha money, stock, movement, unit-state, warranty va Operation yozuvlarini rollback qiladi. Original-key replay bir xil javobni qaytaradi; payload o‘zgarishi conflict. Fee-bearing exchange existing dated cost projectiondan ham o‘tadi.

Owner org bo‘yicha, admin assigned branch bo‘yicha izni ko‘radi. Cashier availability uchun minimal serial DTO oladi; servis notes va boshqa kassirning sale identifierlari ro‘yxatdan berilmaydi. History pagination read-only, tenant/session/role/branch tekshiradi. Serial sahifa actor/org/role/store o‘zgarsa workspace draft/resultni qayta boshlaydi. Pending durable amallar actor/org/device chegarasida saqlanadi.

## Chegaralar va chiqarish

Bir serial source postingda max500unit; query50row/page, unit/servis history50row/page. List latest20events/latest warranty va latest20services summarydir; «Barcha original serial tarixini ochish» pagination orqali saqlangan izni chiqaradi. Noto‘g‘ri yoki yetishmayotgan serial, boshqa receipt/sale/transfer va hali sotilgan yoki retired birlik fail-closed. Serialized offline cash lease hozir rad; oddiy SKU offline ishlashi saqlanadi. Real skaner/hardware yoki vendor repair integratsiyasi bajarilgan deb hisoblanmaydi.

SQL160–166 appdan oldin maintenance jarayonida qo‘llanadi. Feature productionga hali chiqarilmagan. SQL166 intermediate pre-release serial journals bo‘shligini talab qiladi: mavjud unproven tarixga timestamp/UUID asosida taxminiy ordinal backfill qilmaydi. Bunday row mavjud bo‘lsa migration operatorni aniq xato bilan to‘xtatadi; ma’lumot avtomatik o‘chirilmaydi. Oldingi real deployment schema uchun serial tracking defaultfalse bo‘lib qoladi.

Lokal qabul: real synthetic receipt → sale → warranty/service → return/resale, transfer, supplier withdrawal/loss reversal, concurrent checkout, late fault rollback, same-transaction exchange, durable MFA/lost-ACK/reload va actual serial/warranty/service dump-restore. Dalil `tasks/evidence/serials-warranty-20261013.json`. Production/pilot/provider/hardware dalili emas; real deployment amalga oshirilmagan.
