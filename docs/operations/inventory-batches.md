# Partiya va yaroqlilik nazorati

Owner `/inventory/batches` sahifasida yangi, hali ombor/savdo/transfer tarixi yo‘q SKU uchun nazoratni MFA orqali yoqadi. Eski qoldiq taxminiy partiyalarga bo‘linmaydi. Nazoratni o‘chirish mumkin emas; ogohlantirish kunlari 0–3650 oralig‘ida o‘zgartiriladi. Oddiy mahsulotlar avvalgi oqimda ishlaydi.

Kirim va musbat tuzatishda `batchInput = {code, receivedOn, expiresOn}` majburiy. Sanalar haqiqiy `YYYY-MM-DD` kunlari; kirim kuni yaroqlilik kunidan keyin yoki bugundan keyin bo‘lmaydi. Kod bitta mahsulot doirasida yagona va o‘sha kodning sanalari o‘zgarmaydi. Bir kodga keyingi kirim ayni sanalar bilan qo‘shilishi mumkin. Miqdorlar Decimal(20,6), unit qoidalari saqlanadi.

Savdo va transfer jo‘natish bir transaction ichida yaroqli partiyalarni `expiresOn → receivedOn → id` tartibida sarflaydi. Yaroqlilik kuni tashkilot timezoneidagi oxirgi yaroqli kun hisoblanadi. Muddati o‘tgan qoldiq balansda ko‘rinadi, ammo sotilmaydi/jo‘natilmaydi. Yaroqli qoldiq yetmasa savdo, payment va movement birga rollback bo‘ladi. FEFO miqdor va projection invariantlari PostgreSQL triggerlarida ham tekshiriladi. Kassadagi jismoniy tanlash FEFOga mos bo‘lishi kerak.

Qaytarma va transfer qabuli original manfiy batch entrylardan tiklaydi. Bir nechta original partiya bo‘lsa, qisman qabul/qaytarmada `entryId + quantity` tanlovi kerak; butun qolgan miqdorni qabul qilish avtomatik taqsimlanadi. Tanlov `/inventory/batches/sources` orqali ko‘rinadi. Damage/shortage original entryga immutable disposition yozadi; sellable qoldiqqa qo‘shilmaydi. Supplier goods return original invoice/kirim partiyasidan chiqadi; expiry bo‘lsa ham yetkazib beruvchiga qaytarish mumkin. Hujjat reversal original lotga bog‘lanadi.

`/inventory/batches` sahifasida filial, search va expired/due_soon/valid filtrlari bor; filtr count va paginationdan oldin SQLda ishlaydi. 50 qatorli sahifalar, manager uchun to‘liq CSV va umumiy background `inventory-batches` report eksporti bor. Cashier ko‘rishi mumkin, sozlash owner, sanash va source tanlash owner/admin. Boshqa tenant yoki ruxsatsiz filial ma’lumotlari ochilmaydi. Chekda amalda sarflangan kod, miqdor va expiry ko‘rinadi; bu brauzer chek nusxasi, real printer integratsiyasi emas.

Partiyalarni shu sahifada **partiya bo‘yicha sanang**. Har bir ma’lum partiya, shu jumladan nol qoldiqli partiya, alohida ko‘rsatiladi. Snapshot hash miqdorlar va joriy tannarxni qamrab oladi. O‘zgarish bo‘lsa eski sanash qo‘llanmaydi. Farqlar alohida tasdiqlangan adjustment hujjatlari va audit bilan yoziladi; bir partiyadagi ortiqcha boshqa partiyadagi kamomad bilan yashirilmaydi. Oddiy umumiy StockCount tracked SKU bilan boshlanmaydi: u partiya tarkibini bilmaydi. Yangi noma’lum partiyani sanash orqali yaratmang; uning haqiqiy kirim hujjatini kiriting.

O‘qish xatosi draftni o‘chirmaydi va yangi yozishni to‘sadi. Commitdan keyingi yo‘qolgan javob original operationId/body orqali PendingActionsda qayta tekshiriladi. Yangi operationId bilan takroriy iqtisodiy effekt yaratilmaydi.

Jobs worker har 5 minutda joriy musbat filial qoldiqlari bo‘yicha ichki `batch_expiry_warning` audit yozadi. Bir partiya/filial/biznes kuni/holat uchun dedup ishlaydi. Ogohlantirishlar ichki audit va expiry hisobotida; SMS/e-mail yuborilgani da’vo qilinmaydi. Worker ishlashini mavjud jobs deployment tartibi bilan kuzating.

Chegaralar: mavjud SKU tarixini backfill qilish yo‘q; batch-tracked SKU uchun offline cash ticket lease hozir rad etiladi, chunki qurilma offline expiry va original lot sarfini isbotlay olmaydi. Online sale ishlaydi. Manual reservation umumiy miqdorni ushlab turadi, lotni alohida rezerv qilmaydi; checkoutda amaldagi yaroqli FEFO yana tekshiriladi. Offline vendor/protokol yoki hardware taxmin qilinmagan.

Himoya chegaralari: har SKU/filialda FEFO ko‘rishi 10000 musbat partiya; CSV 10000 natija; bir batch-count 500 ma’lum partiya. Limit oshsa aniq xato qaytadi, qisman muvaffaqiyat deb ko‘rsatilmaydi. Worker bir yurishda ko‘pi bilan 100×1000 branch-batch ko‘radi va undan oshsa scan tugamaganini qaytaradi. Katta real dataset/pilot profiling alohida qabul bo‘lib qoladi.

Migration 140–148 yangi immutable batch/entry/disposition jurnallarini, source conservation, read-only subscription/closure admission va indekslarni qo‘shadi. Tenant export uch jurnalni ham qamrab oladi. Production rollout oldidan haqiqiy bazaning backup/restore va migrate dry-run tartibini bajaring; bu lokal test natijasi haqiqiy production rollout yoki pilot dalili emas.
