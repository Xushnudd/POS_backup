# Tashkilotni yopish lifecycle core

`src/server/retention/closure-phase.ts` — BIZ-02.07 uchun sof, hali HTTP/DB oqimiga ulanmagan holat hisoblash moduli. Bu modul autentifikatsiya qilmaydi, tashkilotni yopmaydi, yangi API yoki avtomatik worker yaratmaydi. Mavjud retention API `closureAvailable=false` qaytarishda davom etadi.

`newClosureSnapshot` so‘rov sanasi, tasdiqlangan policy version ID, bekor qilish kunlari va aniq UTC deadline nusxasini yaratadi. Kun 86400000 millisekund hisoblanadi; server lokal vaqt zonasiga bog‘liq emas. Keyingi policy publication avvalgi so‘rov muddatini yashirin o‘zgartirmasligi kerak. Saqlanadigan deadline formula bilan mos bo‘lmasa modul uni rad etadi.

So‘rov yo‘q bo‘lsa `open`. So‘rov yaratilgan ondan deadlinegacha `cancellation_window`: closure biznes yozuvlarini bloklashni talab qiladi, bekor qilish mumkin. Deadlinega aynan yetganda `review_required`: bekor qilish yopiladi, biznes bloklanishi saqlanadi. Bu holat avtomatik o‘chirish yoki yakuniy huquqiy qaror emas. Barcha holatda `automaticDeletionAllowed=false`.

`cancelClosureSnapshot` original so‘rov obyektini o‘zgartirmaydi; birinchi bekor qilish vaqtini saqlaydi. Keyingi takroriy chaqiruv yangi vaqt yozmaydi. Persistence qatlamida original actor, tenant, payload va operation key hali alohida tekshirilishi shart. Bekor qilish closure blokini olib tashlaydi; obuna entitlementini tiklamaydi. Yakuniy yozish ruxsati kamida obuna ruxsati **va** closure bloki yo‘qligi orqali hisoblanishi kerak. Boshqa vakolat, terminal, shift va stock qoidalari ham saqlanadi.

Modul kelajakdagi eventga nisbatan eski observation vaqtini, noto‘g‘ri sanani, deadline chegarasidagi yoki undan keyingi cancellation eventni va 1..365 oralig‘idan tashqari policy kunlarini rad etadi. Production caller vaqtni klientdan qabul qilmasdan DB wall-clock orqali olishi va eventni transaction ichida saqlashi kerak.

## Ulanishi kerak bo‘lgan qismlar

Ownerning amaldagi vakolati va yangi qayta autentifikatsiya; xavfsiz eksportni taqdim etish; immutable DB snapshot/history; audit va idempotent operation; parallel sale posting/yopish/bekor qilishni tartiblovchi SQL locks va terminal write guards; bekor qilish hamda eksport uchun read-only istisnolari; HTTP va UI; haqiqiy isolated DB va browser acceptance. Bu modul ushbu qismlarning o‘rnini bosmaydi. Huquqiy retention toifalari va irreversible deletion `blocked_external` bo‘lib qoladi.

Tekshiruv: `tests/closure-phase.unit.test.ts` uch scenario guruhi. To‘liq unit regression 69/69 PASS; test compilation barcha test-server/API TypeScript manbalarini ham tekshiradi. DB/browser/build acceptance ushbu ulanmagan modul uchun da’vo qilinmaydi.
