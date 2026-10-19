# Tashkilot egasi va kassir uchun ishga tushirish qo‘llanmasi

2026-10-11. Ushbu qo‘llanma mavjud core UI oqimlariga asoslangan. Real pilot
foydalanuvchi hali bu hujjatni tekshirib tasdiqlamagan. RELEASE-01.09 shu qabul
bo‘lmaguncha done emas. Operator quyidagi protokolni har bir biznes va filialda
alohida bajarib, haqiqiy dalillarni qayd etadi.

## 1. Ish boshlashdan oldingi hisob

Egasi, hisob uchun javobgar xodim va eski dastur mas’uli bir xil o‘tish vaqtini
kelishsin. Shu vaqtdagi tovar miqdori/tannarx, kassadagi sanalgan pul, bank
qoldig‘i, mijoz va yetkazib beruvchi qarzlari alohida hujjatga chiqarilsin.
Eski va yangi dasturda bir xil savdoni ikki marta yuritishga yo‘l qo‘yilmasin.
Kelishilgan qoldiqni operator o‘zicha taxmin qilmaydi; tafovut bo‘lsa tasdiq
olinmaguncha import yoki boshlang‘ich hujjat tasdiqlanmaydi.

Egasi tizimga kirsin, to‘g‘ri tashkilotni tanlasin. `/settings`da tashkilot
ma’lumoti va filiallarni, filialga tegishli kassalarni tekshirsin. Har kassir
alohida hisob bilan ishlasin. Yangi hisob yoki mavjud foydalanuvchiga bir
martalik taklif orqali xodim qo‘shilsin; mavjud hisobning paroli qayta yozilmasin.
Kassirga kerakli filiallar biriktirilsin. Maxsus rol uchun `/roles`da kerakli
ruxsatlar tanlansin; baza roli cheklovini ko‘tarish mumkin emas. Vakolat o‘zgargach
xodim qayta login qiladi.

`/security`da egasi/operator authenticator ulasin va bir martalik recovery
kodlarni xavfsiz saqlasin. Kod/kalitlarni support ticket, ekran dalili yoki
umumiy chatga qo‘shmang. Majburiy MFA deployment sozlamasi alohida operator
qarori; faktorlar tayyor bo‘lmaguncha avtomatik yoqilmaydi.

## 2. Katalog importi

`/products/import`da mavjud CSV yoki XLSX faylni tanlang. Andoza uchun mavjud
katalog eksportining ustunlarini ishlating. Parser quyidagi nomlarni taniydi:

| Ustun | Ma’nosi |
|---|---|
| Mahsulot / name | Mahsulot nomi |
| SKU / sku | Tashkilot ichida noyob kod |
| Asosiy barkod / barcode | Asosiy barkod; Excel’da text formatda saqlang |
| Birlik / unit | Mavjud sotish birligi kodi, masalan dona yoki kg |
| Sotuv narxi / salePrice | Sotuv narxi |
| Tannarx / costPrice | Asosiy birlik tannarxi |
| Minimal qoldiq / minStock | Kam qoldiq chegarasi |
| Kategoriya / category | Kategoriya |
| Qo‘shimcha barkodlar / additional | `|` bilan ajratilgan barkodlar, masalan `0012|0013` |

Narx va kasr qiymatlarini manba bilan aynan solishtiring. Barkod boshidagi nolni
Excel son deb o‘zgartirmasin. Miqdorni katalog importiga savdo yoki kirim sifatida
aralashtirmang: katalog importi stock/payment yozmaydi.

Avval preview bajaring. Invalid va duplicate qatorlar sababini o‘qing, error
CSV orqali manba faylni tuzating. Preview tasdiqlanmaguncha import yozilmaydi. Bu import mavjud SKU/barkodni yangilash uchun emas: mavjud kod conflict deb ko‘rsatiladi.
Tasdiqdan oldin tashkilot, valid/invalid qatorlar, mahsulot birligi, narx va
barkodlarni qayta tekshiring. Katalog o‘zgarsa stale preview rad qilinadi; yangi
preview oling. Noaniq javobda pending operatsiya natijasini tekshiring; yangi
UUID bilan ko‘r-ko‘rona qayta import qilmang.

Importdan keyin mahsulotlar soni, tanlangan namuna SKU/barkod/narxlar va
CSV eksportni manba bilan solishtiring. Barcha xatolar hal bo‘lmaguncha
onboarding katalog bosqichini tasdiqlamang.

## 3. Boshlang‘ich tovar, pul va qarz

`/inventory`da to‘g‘ri filial uchun `Boshlang‘ich qoldiq` hujjatini yarating.
Haqiqiy sanalgan miqdor va tegishli tannarxni kiriting. Birlik yoki qadoqdan
asosiy birlikka o‘tish koeffitsiyentini tekshiring. Qoralamani ko‘rib, egasi
sifatida tasdiqlang. Tasdiq qoldiq jurnaliga yoziladi; uni ikkinchi marta
boshlang‘ich qoldiq bilan takrorlash hisobni oshiradi. Xato bo‘lsa tarixni
bevosita o‘zgartirish o‘rniga tegishli qarshi hujjat oqimini ishlating.

Naqd kassa smenasini haqiqiy sanalgan boshlang‘ich pul bilan oching. `/finance`
da bank va boshqa hisoblarni yarating, manbaga mos boshlang‘ich summani
ko‘rsating. Kassa hisobi tegishli filial/kassa va ochiq smenaga mos bo‘lsin.
Ayni pulni bir marta smena opening va yana mustaqil opening kirim sifatida
ikki marta qo‘shmang. Ichki o‘tkazmani savdo tushumi sifatida hisoblamang.

`/customers`da mijozni tekshiring, kredit limitini egasi tasdiqlasin. Mijoz
kartasidagi qarz hujjati orqali boshlang‘ich qarz, sababi, effective sana va
kerakli due sanani kiriting. Manbadagi ayni qarzni ham eski savdo, ham opening
document sifatida takrorlamang. Mavjud noaniq qarzga taxminiy to‘lov targeti
biriktirmang; reconciliation talabini avval hal qiling. Yetkazib beruvchilarni
`/suppliers`da alohida tekshiring; xarid hujjati va uning invoice/payment
manbalari qarzga qanday ta’sir qilishini ko‘chirma bilan solishtiring.

Tovar miqdori/qiymati, kassadagi pul, bank, mijoz va yetkazib beruvchi qarzi
bir xil o‘tish sanasiga tegishli bo‘lsin. Dalilda raw parol/token yo‘q, lekin
hisob mas’ulining haqiqiy tasdig‘i va barcha tafovutlarning sababi bo‘lsin.

## 4. Kassir treningi

`/training` alohida o‘quv mashqi. Misol mahsuloti real katalogga kirmaydi,
sale/payment/stock yoki hardware operatsiyasi yuborilmaydi. Kassir mashq mahsuloti,
berilgan naqd va qaytimni tekshiradi. Mashqni real smenadagi savdo deb yozmang.

Keyin kassir haqiqiy tizimda quyidagilarni tushunganini ko‘rsatsin:

1. Tashkilot, filial, kassa va o‘z ochiq smenasini tekshirish.
2. Mahsulot qidirish, barkod/miqdor/birlik/narxni tekshirish. F2 qidiruv,
   F9 to‘lov oynasi, Escape oynani yopish uchun ishlatiladi.
3. To‘lov turi, naqd berilgan pul, qaytim va nasiya mijoz/muddatini tekshirish.
4. Chegirma yoki qaytarishda tegishli vakolat/tasdiqni olish.
5. Javob yo‘qolsa asl operatsiya natijasini tekshirish; yangi savdoni takrorlamaslik.
6. Chek print xatosi savdo bekor bo‘lganini anglatmasligini tushunish.
7. Smenani yopishda pulni sanash, tafovut sababini yozish va zarur tasdiqni olish.
8. Aloqa uzilganda pending/synchronization holatini kuzatish; lokal navbatni
   tozalamaslik yoki boshqa hisobga shoshilib o‘tmaslik.

Haqiqiy nazorat savdosi oddiy journal yozuvini yaratadi. Oldindan egasi roziligini
va qanday reconciliation qilinishini belgilang. Zarur bo‘lsa odatiy qaytarish
oqimi bilan yopilsin; bazadan sale/paymentni qo‘lda o‘chirmang.

## 5. Onboarding bosqichlarini tasdiqlash

`/onboarding`da har filial uchun olti bosqich mavjud: tashkilot, filial/kassa,
katalog, boshlang‘ich qoldiq, kassir va savdo. Egasi sababni yozadi va joriy
haqiqiy ma’lumotni ko‘rib, ketma-ket tasdiqlaydi. Status serverda saqlanadi;
sahifani yopish tasdiqni yo‘qotmaydi. Ma’lumot keyin bloklansa status bu holatni
ko‘rsatadi; eski tasdiq joriy ma’lumotga yashirin qayta yozilmaydi.

`complete` haqiqiy biznesning huquqiy/fiskal yoki hardware readiness sertifikati
emas. Hardware, fiskalizatsiya, E-POS, Click va tashqi delivery tanlanmaguncha
real vendor adapter yoki vendor muvaffaqiyatini va’da qilmang. Oddiy browser
chek chiqarish va maxsus hardware driver bir xil qabul hisoblanmaydi.

## 6. Ish davomida noaniq holat

`/help` tiklash qo‘llanmasidan foydalaning. Pending operatsiyani avval asl key
bilan tekshiring. `STEP_UP_REQUIRED` bo‘lsa authenticator orqali ayni amaldagi
payloadni tasdiqlang. `AUTH_RESTORE_REVIEW_REQUIRED` bo‘lsa operator restore
review kerak; yangi login urinishlari karantinni ochmaydi. Read-only obunada
mavjud ma’lumot va eksport ochiq, yangi savdo esa grace tugagach bloklanadi.

`/tickets`da ichki support murojaat ochish mumkin. RequestId, amal vaqti,
tashkilot/filial va safe operatsiya IDni bering. Tasdiqlanmagan telefon,
Telegram kanal yoki SLAni mijozga kafolat sifatida ko‘rsatmang. Fayl/dalildan
maxfiy kalit, recovery kodi va ortiqcha shaxsiy ma’lumotlarni chiqarib tashlang.

## 7. Pilot foydalanuvchi qabul protokoli

Har bandga haqiqiy sana, mas’ul, safe dalil reference va natija yoziladi.
Bo‘sh band avtomatik passed deb belgilanmaydi.

| Tekshiruv | Kutilgan natija | Haqiqiy natija / dalil |
|---|---|---|
| Biznes/filial/kassa | To‘g‘ri faol scope va vakolat | To‘ldirilmagan |
| Import preview/xato/retry | Invalid yozilmaydi, original-key retry bir marta | To‘ldirilmagan |
| Katalog namunalari | SKU/barkod/birlik/narx manbaga mos | To‘ldirilmagan |
| Opening stock | Kelishilgan count/qiymat bilan mos | To‘ldirilmagan |
| Opening cash/bank | Ayni pul ikki marta kirmagan | To‘ldirilmagan |
| Opening debt | Mijoz/supplier ko‘chirmasi manbaga mos | To‘ldirilmagan |
| Kassir mashqi | Pul/stock posting yo‘q, kassir qaytimni tushundi | To‘ldirilmagan |
| Haqiqiy nazorat sale/return | Stock/payment/debt/shift tushuntirilmagan farqsiz | To‘ldirilmagan |
| Lost ACK/offline | Takroriy savdo yo‘q, pending navbat saqlangan | To‘ldirilmagan |
| MFA/recovery | Privileged amal tasdiqsiz rad, kodlar saqlangan | To‘ldirilmagan |
| Onboarding restart | Filial checkpointlari saqlangan | To‘ldirilmagan |
| Foydalanuvchi qo‘llanmani bajardi | Qo‘shimcha taxminiy instruction kerak bo‘lmagan | To‘ldirilmagan |

Oxirgi banddagi real pilot feedback bilan qo‘llanma tuzatilgandan keyingina
RELEASE-01.09 qabul qilinadi. Real ishga tushirish sanasi, imzolangan opening
hisob va qurilma/vendor qabuli boshqa original bandlarda alohida qoladi.
