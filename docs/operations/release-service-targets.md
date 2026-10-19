# Release uchun yuklama va xizmat maqsadlari

Bu hujjat `RELEASE-01.08`ning texnik tayyorgarlik hisobotidir. Mahalliy sintetik sinov, tarixiy sinov va kelajakdagi xizmat majburiyatlari alohida ko‘rsatiladi. Haqiqiy staging, production, pilot, tashqi monitoring yoki mijozlarga beriladigan SLA tasdiqlangan deb hisoblanmaydi. Bu hujjatning o‘zi productionga chiqarishga ruxsat bermaydi.

## Joriy qisqa yuklama profili

Joriy o‘lchovning xom natijasi, hardware va manba fayllari SHA256lari `tasks/evidence/release-service-targets-20261017-server-preparation.json` orqali bog‘lanadi. Chunked eksport,189/190 migration va ExcelJS UUID override bilan yangi fixture/harness qayta bajariladi; avvalgi code-review manifesti tarixiy holda saqlanadi. Bu 2026-10-17 frontend/backend nuqsonlari tuzatilgach yangi sintetik fixture bilan haqiqatan qayta o‘lchangan dalil; avvalgi `release-service-targets-20261016-registration.json`, `release-service-targets-20261016-post185.json` va `release-service-targets-20261016-core185.json` tarixiy holatda saqlanadi. Qabuldan oldin o‘lchov yakunlanishi va quyidagi read-only tekshiruv o‘tishi kerak:

```sh
node scripts/release/check-service-targets.cjs
node --test --test-isolation=none scripts/ops/service-targets.test.mjs
```

Asosiy CI ham `check-service-targets.cjs`ni bajaradi: source/evidence mosligi va
14 kunlik yangilik talabi buzilsa pipeline to‘xtaydi. Yangi manba hashlarini
eski tezlik natijasiga ko‘chirish qabul emas; haqiqiy harness qayta bajariladi.

Joriy gate barcha 100 mahsulotda birinchi valuation capture hali mavjud
bo‘lmaganini ham tekshiradi (`valuationCaptureBefore`).
`POS_PROFILE_PRODUCT_OFFSET` 0–48000 oralig‘ida boshqa, hali sotilmagan
sintetik mahsulotlar guruhini tanlashga imkon beradi; jami 50k/1m/20 profili
o‘zgarmaydi. Warm qayta sinov cold regressiyasini yashirish uchun qabul qilinmaydi.

Profil faqat `127.0.0.1:55439/pos_test`dagi alohida sintetik tashkilotda ishlaydi. Bir filial, 20 faol kassa va ochiq smena, 50 000 mahsulot hamda 1 000 000 sintetik draft SaleItem mavjud. Bitta ownerning 20 alohida sessiyasi parallel ishlaydi; bu 20 mustaqil kassir yoki haqiqiy pilot yuklamasi emas. Har bir kassada besh martadan mahsulot qidirish, draft yaratish va bir mahsulotli 100 UZS naqd savdoni yakunlash bajariladi. Yakunda 100 yangi completed Sale va 100 Payment bo‘lishi shart.

| Ko‘rsatkich | Qanday o‘lchanadi | Texnik mezon |
| --- | --- | --- |
| Qidiruv p95 | Haqiqiy products Route Handler chaqiruvi va javob body o‘qilishi; 100 namuna | ≤ 500 ms |
| Savdoni yakunlash p95 | Normal `completeSale` xizmati, ichki retry va original-key qayta urinish kutishi bilan; draft yaratish va tashqi tarmoq vaqti kirmaydi; 100 tasdiqlangan namuna | ≤ 2 000 ms |
| Qisqa profil xatolari | 100 qidiruv + 100 mantiqiy checkout yakuniy natijasi; jismoniy urinishlar alohida qayd etiladi | 0/200 yakuniy xato; barcha 100 draft ham yaratilgan bo‘lishi shart |
| Iqtisodiy natija | Boshlang‘ich va oxirgi completed Sale/Payment soni farqi | Har biri aniq 100 |

Bu p95 APIga brauzerdan HTTP orqali borib kelish, internet, TLS, printer, Click yoki fiskal provayder vaqti emas. Qidiruv Route Handler orqali, checkout biznes xizmati orqali chaqiriladi. Testning o‘zi tashqi HTTP so‘rov yubormaydi. Draft setup xatosi alohida qayd etiladi; u yashirincha 200 urinishga qo‘shib yuborilmaydi. Birorta xato, yetishmayotgan namuna yoki ortiqcha/yo‘qolgan iqtisodiy yozuv qabulni yiqitadi.

Avvalgi v2 harnessda 20 lane to‘g‘ridan-to‘g‘ri xizmatni chaqirib, serverning `CONCURRENT_CONFLICT` javobida to‘xtagan. Muvaffaqiyatsiz natija `service-load-20261016-failed-v2.json` va mos execution faylida saqlangan: yetishmagan namunalar qabul hisoblanmadi. Bu versiya yoki p95 yaxshilandi degan da’vo emas. V3 harness server ko‘rsatgan original-key tiklanish protokolini bajaradi: faqat aniq `409 CONCURRENT_CONFLICT` uchun bir xil body/key, ko‘pi bilan 8 chaqiruv va 10 soniya budget. Boshqa409,403 yoki noma’lum tarmoq natijasi avtomatik takrorlanmaydi. PostgreSQL SERIALIZABLE va serverning uch ichki urinish siyosati o‘zgartirilmagan. Uchta unit holati protokol va chegaralarni tekshiradi.

`errorRate` — yakuniy qidiruv/checkout natijalari, `rawErrorRate` — barcha jismoniy qidiruv, draft va checkout xizmat chaqiruvlari, shu jumladan nazoratli konfliktlar. `physicalAttempts` har bosqichdagi calls/failed/conflicts/retriesni saqlaydi; konfliktlar hisobotdan olib tashlanmaydi. Bular SQL statement error rate yoki haqiqiy tashqi HTTP error rate emas. Qayta urinishlar bo‘lsa checkout p95 kutishni ham qamraydi. Budget tugashi, noma’lum natija yoki yo‘qolgan iqtisodiy yozuv qabulni yiqitadi. 180 bosqichidagi tarixiy v3 o‘lchovda p95 qidiruv291.255ms, checkout264.996ms, yakuniy xato0/200 va jismoniy xato0/300 edi. 185 bosqichining tarixiy188-migration o‘lchovida qidiruv336.103ms, checkout213.273ms, yakuniy xato0/200; jismoniy checkoutda bitta nazoratli409original-key bilan qayta bajarildi: raw1/301≈0.332%. Checkout p95shu kutishni ham qamraydi. Aniq100 ta savdo va100 ta payment yozildi. Bu qisqa lokal namuna boshqa yuklamada konflikt bo‘lmasligini kafolatlamaydi.

Haqiqiy qiymatlar takroriy Markdown sonlari o‘rniga xom JSONda saqlanadi; gate p95, denominator, statuslar, apparat tavsifi, iqtisodiy invariantlar va manba mosligini tekshiradi. Tegishli server/API/Prisma/manba yoki dependency o‘zgarsa gate avvalgi dalilni eskirgan deb rad etadi. Joriy o‘lchov 14 kundan eski bo‘lsa ham qayta o‘lchash talab etiladi. Bu 14 kunlik ichki hujjat yangiligi qoidasi; production SLO kafolati emas.

2026-10-17 tekshiruvining birinchi runi qabul qilinmadi: 84 qidiruv, 84 checkoutdan79 tasdiqlandi,5 tasi nazoratli409retry chegarasiga yetdi; p95checkout2411.425ms edi. Xom natija `service-load-20261017-code-review-failed-1.json` va execution faylida saqlandi, yangi manifest tarixiga bog‘landi. Test bazasida odatiy `VACUUM (ANALYZE)`dan keyin boshqa100ta hali capture qilinmagan mahsulot (`offset=30000`) bilan yangi run bajarildi: qidiruv p95290.817ms, checkout630.048ms, yakuniy xato0/200; jismoniy22ta409original-key bilan tiklandi (22/322≈6.83%). Bu oldingi muvaffaqiyatsiz runni bekor qilmaydi va yaxshilanishning yagona sababi VACUUM ekanini isbotlamaydi. Serverning SERIALIZABLE, uch ichki urinish va harnessning8urinish/10soniya chegaralari o‘zgartirilmadi. Haqiqiy muhitda statistikalar, autovacuum, ish yuki va cold-capture konfliktlari alohida kuzatilishi kerak.

2026-10-17 server-preparation (189/190 migration, UUID11.1.1) birinchi runi ham qabul qilinmadi:97checkoutdan96tasdiqlandi,1ta retry limiti; final1/194,raw163/453,search p95302.861ms,checkout2044.200ms. Xom natija va execution `*-server-preparation-failed-1.json`da saqlangan. Test DBda odatiy VACUUM(ANALYZE) va boshqa100ta avval capture qilinmagan SKU(offset30000) bilan takror: search306.352ms/checkout231.034ms p95,final0/200,raw0/300 va100yangiSale/Payment. Core/isolation/3server retry/8caller retry/10s budget o‘zgarmadi. Ushbu ikki run cold/index/ish-yuki variatsiyasi borligini ko‘rsatadi; yaxshilanishning yagona sababi VACUUM ekani yoki birinchi yuklama muammosi barcha holatlarda yo‘qolgani isbotlanmagan. Uzun soak va haqiqiy server yuklamasi alohida qoladi.

Yuklashning kech auditiga originalrequestId korrelyatsiyasi qo‘shilgach, manba hashini eski tezlikka ko‘chirish o‘rniga yana boshqa100coldSKU(offset20000) bilan yakuniy harness qayta bajarildi: search326.490ms/checkout268.605ms p95,final0/200,raw0/300; aniq100Sale/Payment. Joriy manifest ushbu yakuniy641source natijasiga bog‘langan, oldingi muvaffaqiyatli o‘lchov `*-pre-trace.json` tarixiy manbalari bilan saqlanadi. Birinchi muvaffaqiyatsiz cold run haqidagi cheklov saqlanadi.

## Tarixiy dalillar va ularning chegarasi

| Sana va dalil | Kuzatilgan natija | Tatbiq chegarasi |
| --- | --- | --- |
| 2026-10-09, `volume-measure-jitter-20261009.json` | Qidiruv p95 388.87 ms; checkout 132.23 ms; 100+100 namuna, xato 0 | Avvalgi service-level kod; joriy release o‘lchovi sifatida ko‘rsatilmaydi |
| 2026-10-09, `volume-measure-repeat-20261009.json` | Qidiruv p95 393.69 ms; checkout 114.99 ms; 100+100 namuna, xato 0 | O‘sha profildagi ikkinchi tarixiy run |
| 2026-10-12 qabul protokoli, `core-164-20261012.json` | 40 parallel checkout bilan 15 min stress p95 673.38 ms; 20 parallel bilan 2 soat soak p95 363.70 ms | Avvalgi 132 migratsiyali standalone HTTP fixture; joriy kodda ikki soat takrorlangani da’vo qilinmaydi |

Tarixiy soakda 18 717 HTTP javobining 16 624 tasi 200, 1 785 tasi 409 va 308 tasi 429 bo‘lgan. Shunday qilib raw non-2xx ulushi **2 093/18 717 ≈ 11.18%**; u “HTTP xatolari nol” deb ko‘rsatilmaydi. Cheklangan retrydan keyin 5 540 savdo buyruqlarining yo‘qolishi va dublikati nol bo‘lgan. HTTP latency backoff kutishini qamramaydi. Stress closed-loop bo‘lgani uchun navbat cheksiz yig‘ilmagan, 2× parallelizm esa 2× erishilgan throughput degani emas. To‘liq takrorlash yo‘riqnomasi: [stress-soak.md](stress-soak.md).

## Recovery maqsadlari

`PLAN1`dagi boshlang‘ich texnik maqsad: **RPO ≤ 15 daqiqa, RTO ≤ 4 soat**. Bu shartnomadagi majburiyat emas. RPO — avariya paytida yo‘qolishi mumkin bo‘lgan oxirgi tasdiqlangan yozuvlar oynasi. RTO — e’lon qilingan boshlanish nuqtasidan kerakli xizmat tiklanib, tekshiruvdan o‘tguncha vaqt. Har bir drill o‘zining boshlanish/tugash nuqtasini aniq yozadi.

Joriy dalil `tasks/evidence/pitr-drill-20261016.json`dagi alohida PostgreSQL PITR fixturega bog‘lanadi. Undagi SQL tekshiruvigacha bo‘lgan lokal tiklash vaqti butun POS, secret/key custody, offline qurilmalar, provider reconciliation yoki productionga trafik qaytarish vaqtiga tenglashtirilmaydi. Targetdan oldingi barcha fixture yozuvlari saqlanishi shart; targetdan keyingi yozuvning ataylab yo‘qligi avariya yo‘qotishi sifatida hisoblanmaydi. Off-host yuklash/tushirish, katta haqiqiy baza, tashqi kalit saqlash va operator javob berish vaqti ushbu o‘lchov bilan kafolatlanmaydi.

Productionda ushbu maqsadlar tasdiqlanishidan oldin haqiqiy dataset, doimiy WAL transporti, off-site nusxa va alohida credentiallar bilan to‘liq restore rehearsal kerak. Operator tashkilotni xavfsiz qayta ochishdan oldin audit/auth restore checkpoint, provider unknown holatlari va offline navbatlarni solishtiradi. Eski bazani live bazaga avtomatik overwrite qilish yoki hujjatlarni o‘chirish mumkin emas. [Deployment readiness](deployment-readiness.md) va [tenant recovery](tenant-recovery.md) shartlari saqlanadi.

## Support va uptime

| Maqsad | Hozirgi holat | Tasdiqlanishi kerak bo‘lgan qism |
| --- | --- | --- |
| Ish vaqti | Egasi taklif qilgan baseline: dushanba–shanba 09:00–18:00, Asia/Tashkent | Faol xizmat jamoasi va haqiqiy mas’ullar |
| Birinchi javob | Ish vaqtida 240 ish minutgacha; versioned DB siyosatida boshqariladi | Mijozlarga beriladigan rasmiy kafolat va actual support kuzatuvi |
| Hal qilish muddati | Birinchi javobdan alohida o‘lchanadi; qat’iy muddat tasdiqlanmagan | Daraja bo‘yicha egasi tasdiqlaydigan muddatlar |
| Eskalatsiya | Ichki baseline 240 ish minuti; real telefon yoki Telegram kiritilmagan | Mas’ul va favqulodda kanal |
| Uptime foizi | Raqamli production target va hisob davri hali tasdiqlanmagan; actual production o‘lchovi yo‘q | Hosting, mustaqil probe, kuzatuv davri, texnik xizmat va istisnolar kelishuvi |

Support baseline manbasi `202610100108_support_tickets` migratsiyasi va [support-tickets.md](support-tickets.md). Administrator qiymatlarni yangi policy versiyasi bilan o‘zgartirishi mumkin; ushbu hujjat mavjud production bazasida aynan shu qiymatlar faol degan da’vo qilmaydi. Hech qanday uydirma favqulodda aloqa yoki SLA qo‘shilmagan.

Uptime hisoblash uchun kelajakda mustaqil hostdagi probe ketma-ket o‘lchovlari, UTC vaqt oynasi, yo‘qolgan namunalarga munosabat va rejalashtirilgan ishlar qoidasi kelishiladi. `ready` javobi, lokal serverning qayta ishga tushishi yoki unit test o‘tishi oylik uptime dalili emas. Hozir raqam uydirish o‘rniga `unapproved_and_unmeasured` qayd etiladi. Real monitoring/alert/on-call acceptance `OPS-02.05` va `RELEASE-01.07`da ochiq qoladi.

## Takrorlash va chiqarish chegarasi

1. Alohida test bazasiga amaldagi migratsiyalarni qo‘llang va `tsconfig.test.json`ni compile qiling. Haqiqiy biznes DB yoki `.env` qiymatlarini logga chiqarmang.
2. `node --require ./scripts/test-resolver.cjs .test-build/tests/performance/core-profile.js --seed-only` orqali guarded sintetik dataset yarating; `/tmp/pos-volume-dataset.json`dagi haqiqiy fixture IDni faqat `POS_PROFILE_TEST_ORG` uchun ishlating. Shu running serial tayyorlash bosqichi 50 000 mahsulot va 50 000 qoldiq yaratilgach to‘xtatilib, o‘sha fixture `core-resume-seed.ts`dagi to‘rt worker orqali yakunlangan. `service-load-seed-interrupted-20261016.json` buni yuklama sinovi sifatida ko‘rsatmaydi. Resume yordamchisi barcha guardlarni saqlaydi, faqat yetishmayotgan deterministik draft IDlarni qo‘shadi va aniq 1 000 000 satrni qayta tekshiradi; haqiqiy savdo yoki payment bor fixtureda ishlamaydi.
3. `node --require ./scripts/test-resolver.cjs .test-build/tests/performance/core-measure.js`ni `POS_PROFILE_TEST_ORG` bilan bajaring. Xom `/tmp/pos-volume-measure.json`ni evidencega saqlang; xato runni yashirmang.
4. PITR drillni izolyatsiyada takrorlang; har bir natijaning chegarasi va source SHA256larini saqlang. Profil yaratgan tashkilot, mahsulotlar va foydalanuvchinigina tozalang; shared test ma’lumotlariga tegmang.
5. Hujjat/evidence/source snapshot yangilang va read-only gate hamda uning salbiy ssenariy testlarini bajaring. Gate muvaffaqiyati faqat shu hujjatning lokal texnik dalillarini tasdiqlaydi.

Staging yoki productionda haqiqiy ish yuklamasi sezilarli farq qilsa, katta savat, bonus/refund/seriya/partiya, ko‘p tashkilot va boshqa actor profillari alohida o‘lchanadi. Uzoq soak, browser/network, recovery va provayder mezonlari tegishli original vazifalarda qoladi. Tashqi resurslarning mavjud emasligi bu hisobotda yashirilmaydi.
