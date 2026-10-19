# Lokal Git tarixida sir izlarini tekshirish

QA-01.08ning mustaqil texnik qismi. `npm run security:history:test` sintetik
vaqtinchalik Git repozitoriylarda ishlaydi. `npm run security:history` esa
joriy repozitoriyning barcha **lokal ref**laridan reachable bloblarni tekshiradi.
Remote fetch, npm audit, registry yoki tashqi API ishlatilmaydi.

Natijada faqat object ID, inventardagi fayl yo‘li, satr va token turi bor;
tokenning o‘zi yoki Git stderr chiqarilmaydi. `.env` va kalit fayllari
inventarda ko‘rinsa kontenti o‘qilmaydi, yo‘li finding bo‘ladi. Bir xil blobning
barcha tarixiy fayl nomlari emas, Git bergan bitta inventar yo‘li qayd etiladi.

Chegaralar: blob 4MiB, umumiy o‘qish 256MiB, 20000 blob; katta fayl/byudjet
yetishmasligi `skipped` va `complete:false`. NUL baytli binarylar alohida
sanab chiqarib tashlanadi. Archive/LFS ichki kontenti, reflog/unreachable
objectlar, credentialning haqiqiyligi va barcha mumkin bo‘lgan secret formatlar
tekshirilmaydi. `complete:true` faqat shu cheklangan doira inventarida skip
bo‘lmaganini anglatadi, “repo hech qachon secret saqlamagan” degani emas.

Exit0 — shu doirada finding va skip yo‘q; exit1 — finding bor;
exit2 — natija to‘liq emas yoki scan xatosi. Xato exceptioni sir chiqarmaslik
uchun umumiy matn bilan beriladi. Shallow clone uchun faqat mavjud tarix
tekshiriladi; to‘liq tarix deb ko‘rsatish mumkin emas.

Finding topilsa tokenni javob/logga nusxalamang. Mas’ul bilan yopiq muhitda
uning haqiqiyligini tekshiring. Haqiqiy credential bo‘lsa tegishli owner orqali
revoke/rotation va ta’sir tekshiruvi kerak; Gitdan o‘chirishning o‘zi yetmaydi.
Scanner rotation yoki history rewrite qilmaydi. Sintetik test qiymati bo‘lsa
aniq object/sabab bilan review qaydi talab qilinadi, avtomatik allowlist yo‘q.

Bu ish paket/CVE, image yoki staging xavfsizlik qabulini almashtirmaydi.
QA-01.08 original bandi bu scanner tayyorligi bilan done bo‘lmaydi.

Asosiy CI `actions/checkout`da `fetch-depth: 0` bilan mavjud to‘liq tarixni
oladi va source scan bilan birga `security:history:test` hamda
`security:history`ni bajaradi. Finding yoki incomplete scan pipeline’ni
to‘xtatadi. Lokal scannerning o‘zi tarmoqqa ulanmaydi.
