# Rejalashtirilgan ichki hisobotlar

Tashkilot egasi `/reports/plans` orqali o‘chirilgan jadval yaratadi, hisobni oldindan ko‘radi va so‘ng avtomatik yaratishga alohida ruxsat beradi. Kunlik, haftalik yoki oylik jadval, filiallar, KPI, hisob davri, fayl saqlanishi va o‘tkazib yuborilgan davr siyosati egasi tomonidan sozlanadi. Hozirgi contract: Asia/Tashkent, UZS; boshqa vaqt zonasi uchun DST siyosati tasdiqlanmaguncha yoqilmaydi. Real SMS/e-mail yetkazish mavjud emas; natija faqat autentifikatsiyalangan egasiga yuklanadi.

## Jadval va ruxsat

- Sozlash `report.schedule.configure` idempotent operatsiyasi va MFA bilan bajariladi. Bir xil original kalit bir xil natijani qaytaradi; o‘zgargan payload rad etiladi. Tahrir original revisionga bog‘langan; boshqa tabdagi yangilanish ustidan yozilmaydi.
- Ruxsat faol owner a’zoligiga tegishli, bir sessiya muddatiga bog‘lanmaydi. Oddiy logout jadvalni bekor qilmaydi. A’zolik/User bloklanishi, owner roli yo‘qolishi, custom role yoki tashkilot valyuta/timezone o‘zgarishi navbatdagi ishning nashrini bekor qiladi. Nashrdan avval fresh transactionda grant yana tekshiriladi va parallel revocation bilan lock orqali ketma-ketlashtiriladi.
- To‘xtatish revisionni oshiradi; oldingi queued/running ish endi fayl chiqarmaydi. To‘xtatish read-only tashkilotda ham ruxsat etiladi. Yangi/tahrirlangan siyosat business-writable admission talab qiladi. Moliyaviy tarix va oldingi tayyor natijalar o‘zgartirilmaydi.
- Native PostgreSQL guard konfiguratsiya uchun aynan shu transactiondagi faol owner audit dalilini talab qiladi. Tenant, original snapshot va terminal run tarixi himoyalangan.

## Worker va duplicate himoyasi

Mavjud `npm run worker:build` va `npm run worker:jobs` ishlatiladi. Alohida cron kutubxonasi yoki tashqi scheduler qo‘shilmagan. Worker maintenance vaqtida yangi ish olmaydi; SIGTERMda faol ishni tugatadi. Har siklda oddiy job va report navbatidan ko‘pi bilan bittadan bajaradi. `--once` ko‘pi bilan 100 ta bajarish bilan tugaydi.

Original run kaliti `(scheduleId, revision, scheduledFor)` unique. Enqueue/claim PostgreSQL `FOR UPDATE SKIP LOCKED` bilan ishlaydi. Lease 30 soniya; heartbeat 5 soniyada uzaytiradi. Uchta cheklangan urinish, exponential backoff va nonce eski workerning natija chiqarishini to‘sadi. Lease tugasa shu original run tiklanadi, yangi run yaratilmaydi. Audit kech xato bersa natija ham rollback qilinadi.

`latest_only` o‘tkazilgan eski occurrence uchun `MISSED_PERIOD_SKIPPED` terminal yozuvini qoldirib, oxirgi davrni oladi. `catch_up` har eski davrni navbat bilan yaratadi; tarixiy davrning hisob cutoffi o‘sha original jadval vaqtidir. Bu tarixiy database snapshotini tiklash degani emas: keyin yaratilgan correctionlar uchun mavjud hisobotlarning as-of contracti ishlaydi. E-mail/SMSga bir marta yetkazish haqida da’vo yo‘q.

## KPI formulalari

Filiallar bir xil davr/cutoff va mavjud `financialSummary` / `profitSummary` orqali hisoblanadi. Completed savdolar; voided/draftlar daromadga qo‘shilmaydi. Qaytarishlar va late-cost correction jurnallari mavjud accounting contract bo‘yicha olinadi. Decimal clone precision 50; pul oddiy JS floating-pointga aylantirilmaydi.

| KPI | Formula |
|---|---|
| saleCount | Davrdagi yakunlangan cheklar soni |
| grossRevenue | Gross yakunlangan chek summasi |
| refundAmount | Hisob contractidagi qaytarilgan summa |
| netSales | Soliq chiqarilgan sotuv minus soliqsiz qaytarish |
| cogs | Original tannarx minus qaytgan qism, qo‘llangan correctionlar bilan |
| grossProfit | netSales − cogs |
| grossMarginPercent | grossProfit / netSales × 100; netSales ≤ 0 bo‘lsa N/A |
| operatingExpenses | Mavjud profit engine operatsion xarajati va correctionlari |
| operatingProfit | Mavjud profit engine operatsion foydasi |
| averageSale | netSales / saleCount; chek bo‘lmasa N/A |

Kunlik davrda faqat tugagan kunlar yoki ish boshlangan vaqtgacha qisman joriy kun tanlanadi. Oldingi ISO hafta dushanba–yakshanba, oldingi oy to‘liq kalendar oy. Chegaralar tashkilot vaqt zonasida hisoblanadi.

## Prognoz va sifat o‘lchovi

Egasi mahsulotlar, tarix, training oynasi, backtest va kelajak kunlarini tanlaydi. `moving_average` oldingi N kun; `weekday_average` oldingi haftalardagi aynan shu hafta kunining o‘rtachasi. Faqat yakunlangan gross sale itemning asosiy birlikdagi miqdori olinadi. Qaytarish, stockout yoki yo‘qotilgan talab modeli emas. Mahsulot/filial yaratilishidan oldingi kunlar nol deb uydirilmaydi. Joriy tugamagan kun trainingga kirmaydi.

Rolling-origin bir kunlik holdoutda har bir prediction faqat undan oldingi tarixdan olinadi. MAE, RMSE, WAPE va doim nol baseline MAE qaytariladi. Haqiqiy miqdor jami nol bo‘lsa WAPE N/A. Tarix/training yetmasa yoki ijobiy kuzatuv bo‘lmasa `insufficient_history`, prediction yo‘q. Keyingi ko‘p kunlik recursive forecast bir kunlik backtest sifati bilan kafolatlangan deb ko‘rsatilmaydi. ML platformasi qo‘shilmagan.

Sintetik qabul sinovlari: doimiy 3.000001 miqdor xatosi nol; weekday 1–7 pattern o‘z hafta kunini bashorat qiladi; oxirgi kun shock70 faqat oldingi nol tarixdan prediction0 beradi, MAE5/WAPE100 va nol baseline ustidan yaxshilanish yo‘q. Bu real biznes aniqligi yoki pilot natijasi emas. Har real hisobot o‘z actual tarixidagi xatolikni ko‘rsatadi.

## Chegaralar, eksport va recovery

Tashkilotga 20 ta jadval, 20 ta queued/running run; hisobotga 20 filial, 20 mahsulot va ko‘pi bilan 100 filial-mahsulot qatori. Demand aggregation 50,000 qator; ortsa qisman hisob berilmaydi. Snapshot 4MiB; JobExport bilan umumiy private fayl kvotasi 32MiB. Kvota umumiy advisory mutex va PostgreSQL JSON hajmi bo‘yicha tekshiriladi.

JSON to‘liq natijani, CSV/XLSX va browser-print PDF esa tanlangan KPI/forecast/backtest bo‘limini beradi. Numeric decimal precision va CSV formula-injection himoyasi umumiy eksport modulidan. `pdf` native server PDF emas: HTML fayl brauzerda chop etilib PDFga saqlanadi. Read-onlyda mavjud faylni ko‘rish/eksport mumkin. Expiry 1–720 soat administrator tanlovidir; worker faqat derived snapshot baytlarini tozalaydi, original moliyaviy va audit yozuvlari saqlanadi.

Restoreda ReportSchedule tashkilot biznes eksportiga kiradi; vaqtinchalik ReportScheduleRun natijalari tenant JSON eksportida alohida omitted toifa. To‘liq database backup ikkalasini saqlaydi. Restore quarantine `auth_restore_ready()` false bo‘lsa report grant nashrga ruxsat bermaydi. Recovery rehearsal real staging yoki off-site backup sinovi o‘rnini bosmaydi.
