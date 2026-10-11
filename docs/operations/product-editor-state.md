# Mahsulot editorining holati

UX-01.05 core ishlari davomida `/products` va `/products/{id}` ekranlari tekshirildi. Bu hujjat UX-01.05 ning butun loyiha bo‘yicha yakuniy qabuli emas.

## Yuklash va qayta urinish

Mahsulot tafsilotining API xatosi “Mahsulot topilmadi”ga aylantirilmaydi: xato matni va “Qayta yuklash” ko‘rinadi. Haqiqatan data bo‘lmasa mavjud topilmagan holati saqlanadi. Katalog ro‘yxatida ham yuklash xatosi va retry mavjud. Ro‘yxat so‘rovlari lokal generation bilan ajratiladi; eski search/filter javobi yangi natijalarni yoki ularning loading/error holatini almashtirmaydi. Bu serverdagi tenant/permission nazoratining o‘rnini bosmaydi.

## Draft va scope

Editor organization/user/role/product bo‘yicha komponent kalitiga ega. Katalogdagi yangi va tahrirlash modallari original baseline bilan solishtiriladi. Avtomatik berilgan boshlang‘ich SKU/barkod qiymati hali foydalanuvchi o‘zgarishi deb belgilanmaydi. Kategoriya modalidagi yozilgan nom ham draft hisoblanadi. Escape/X/Cancel orqali rad etilgan discard inputlarni saqlaydi.

Mahsulot tafsiloti bitta page guardga asosiy forma va qo‘shimcha barkod drafti/busy holatini birlashtiradi. Asosiy forma muvaffaqiyatli saqlanganda barkod drafti mavjud bo‘lsa sahifa tark etilmaydi. Asosiy ma’lumotlar “saqlandi” belgisi bilan ko‘rsatiladi, barkod inputi saqlanadi. Barkod ro‘yxatini refresh qilish uning draftini reset qilmaydi. Asosiy forma yoki barkod mutatsiyasi ketayotganda o‘zaro tahrir inputlari bloklanadi.

## Aniqlik va takror so‘rov

Tannarx va minimum qoldiq ko‘pi bilan olti, sotuv narxi ikki kasr xonali decimal satr sifatida yuboriladi. `Number` yoki `parseFloat` bilan moliyaviy qiymat o‘zgartirilmaydi. Backendning ruxsat, interval va schema tekshiruvlari saqlanadi. Chegara browser testida quyidagi qiymatlar ishlatilgan:

- Tannarx va minimum qoldiq: `99999999999999.123456`.
- Sotuv narxi: `999999999999.99`.

Product create/update, inline category create hamda barkod amallari synchronous flight ref bilan takror submitdan himoyalanadi. Bu mavjud server idempotency/unique cheklovlarini almashtirmaydi. UI sinovi server javobini ushlab turib, ikki `requestSubmit()` paytida bitta HTTP so‘rov ketishini tekshiradi. Backend rad etgan update original inputlarni saqlaydi; UI muvaffaqiyatni faqat server javobidan keyin bildiradi.

## Qabul dalili va qolgan chegara

`tests/e2e/product-editor-state.spec.ts` real lokal HTTPS sessiyasi va isolated `localhost:55439/pos_test` bilan ishlaydi. Loading failure/retry, exact decimal database roundtrip, delayed response, main/barcode draft, create/edit/category modallarini rad etilgan yopish, double submit va delayed old search testlari bor. Oldingi besh katalog formasining `catalog-unsaved.spec.ts` regressiyasi bilan birga uch brauzerda tekshiriladi.

Tashqi provider/hardware, production deployment va pilot qabul qilinmaydi. Boshqa editorlar, SPA back/forward, to‘liq retry/pending/saved coverage va reload recovery bo‘yicha original UX-01.05 ochiq qoladi. Keyingi hujjatlardagi original done hisobiga bu ikki sahifa alohida band sifatida qo‘shilmaydi.
