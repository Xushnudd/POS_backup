# UX-01.03 qamrov va tekshirish xaritasi

2026-10-15. Original UX-01.03 lokal core sifatida qabul qilindi. SHA va haqiqiy test cohortlari `tasks/evidence/list-journals-20261015.json` da. Ushbu xarita real hosting/provider/pilot qabulini almashtirmaydi.

Ro‘yxatning qo‘llangan filtri, ruxsat etilgan tartibi va sahifasi URLga yoziladi. Forma uchun hali saqlanmagan summa, sabab, parol, token yoki pending amal payloadi URLga yozilmaydi. Xodim/biznes/rol almashganda tegishli workspace alohida yaratiladi. API o‘zining tenant, filial, rol va jonli sessiya tekshiruvini bajaradi.

| Ekran yoki tarix | URL maydonlari | Manba va tartib |
|---|---|---|
| Mahsulot/mijoz/savdo, supplier, brend, kategoriya, birlik, audit | search/sort/page/limit, endpointning holat/filial/sana filtri | Server allowlisti, count va qatorlar bir snapshotda |
| Inventory balans/hujjat/transfer/movement, sanash/disposition | search/sort/page/limit va mavjud biznes filtrlari | Original ombor va qaytarish jurnali; o‘qish zaxirani tuzatmaydi |
| Partiya/serial, replenishment, arxiv | search/sort/page/limit, holat/tur va scope | FEFO yoki tanlangan safe sort, manba hujjatlari saqlanadi |
| Smena, finance, jobs/incidents | search/sort/page/limit va endpoint filtrlari | Summalar server Decimalida saralanadi; worker payloadi public DTOga kirmaydi |
| Asosiy savdo/mahsulot hisoboti | tab/dateMode/startDate/endDate/asOf/search/sort/page/limit | Chek qidiruvi butun davrning pul hodisalari yig‘indisini o‘zgartirmaydi; bu UI va metadatada ochiq |
| Xarid/supplier balance/kesim | asOf, tegishli sana/filial/kesim/search/sort/page/limit | CSV ham shu cutoff va to‘liq filtrlangan manbadan, UI sahifasi bilan kesilmaydi |
| Reconciliation | kind/storeId/search/sort/page/limit | Faqat farqni ko‘rsatadi; tarix yoki stock avtomatik o‘zgarmaydi |
| Ommaviy narx tarixi | history_field/search/sort/page/limit | Faqat original frozen mahsulot/SKU/manba matni; cost faqat egaga |
| Rezerv tarixi | reservation_status/kind/search/sort/page/limit | Rezervning asl holatlari; expiry server vaqti bilan. Zona/stock forma drafti alohida |
| Variantlar | status/search/sort/page/limit | Butun root guruh bo‘yicha global narx/nom sort; maxfiy tannarx DTOda yo‘q |
| Mijozning original birlashgan xarid tarixi | search/sort/page/limit | Original customerId, savdo/to‘lov/qaytarish yozuvlari o‘zgarmaydi |
| Legacy telefon dublikatlari | phone/search/sort/page/limit | Nom qidiruvi diagnoz guruhining haqiqiy dublikat sonini kamaytirmaydi; auto-merge yo‘q |
| Xodimlar | staff_tab/status/search/sort/page/limit | Owner scope; opt-in paging. Parametrsiz eski to‘liq DTO contracti saqlanadi |
| Server qoralamalari | search/sort/page/limit | Faqat serverdagi qoralamalar; lokal savatlar taxmin qilinmaydi |
| Supplier kirim hujjatlari | purchases_from/to/storeId/status/search/sort/page/limit | Holat/raqam filtri supplierning davr qiymati yig‘indisidan alohida tushuntiriladi |
| Mijoz qarz ko‘chirmasi | ledger_from/to/page | Asl vaqt/ID ketma-ketligi, har qatorning qoldig‘i. UI limit20ni aniq yuboradi; eski API default50 saqlanadi |
| Mijoz avansi va savdolari | advances_page; customer_sales_search/sort/page/limit | Avans qarzdan alohida, savdo cash/credit/refund manbalari saqlanadi |
| Supplier invoice/to‘lov/taqsimot | supplier_ledger_page; supplier_alloc_paymentId/page | Original jurnallar. Read sahifa almashganda boshqa to‘lov/invoice drafti o‘chmaydi |
| Buyurtma va qabul/cost tarixi | purchase_orders_page; receipts_<id>_page; cost_<id>_page; valuation_<id>_page | Original buyurtma/qabul/taqsimot/correction ketma-ketligi |
| Refund, serial va smena correction tarixi | returns_page; serial_history_<id>_page; shift_corrections_page | Refund/correction20, serial50; ordinal/running balance tartibi ixtiyoriy qayta saralanmaydi |
| Hisobot ishlari | runs_scheduleId/page | O‘qish jadvali edit qilinayotgan policy/revisiondan mustaqil; export original run grantini qayta tekshiradi |
| Obuna invoicelari | billing_invoices_page | Original ichki invoice va qo‘lda qayd etilgan to‘lov; Click API tasdig‘i deb ko‘rsatilmaydi |
| Sessiya/xavfsizlik hodisalari | sessions_view/page; security_events_page | Account scope, original90 kunlik tarix. Parol/OTP/credential URLda yo‘q |
| Support berilgan/olingan grantlar | issued_grants_page; support_grants_page | Native50; operator biznesi/filiali bo‘yicha har ko‘rish alohida audit va ruxsat talab qiladi |
| Soliq profili/versiya, narx qoidasi/guruh | taxes_page; tax_versions_page; price_rules_page; customer_groups_page | Profil/qoidaning original tartibi; guruh50, boshqa read20. Tahrir maydonlari alohida |
| Maxsus rollar | search/page | Vakolatli owner, asl nom/ID tartibi; role assignment va noaniq amal kaliti saqlanadi |
| Lokal navbat/server konfliktlari | local_state/search/sort/page/limit; review_page | Lokal DB to‘liq actor/device scope bilan o‘qilib keyin sahifalanadi. Qidiruv faqat ID/tur/xato kodi, payload emas |
| Offline cash ruxsati/qoralama | offline_leases_page; offline_drafts_page | Faqat mavjud core ruxsatlari. Unlock iborasi, imzo va cash ticket payloadi URLga chiqmaydi |
| Qo‘shimcha barkodlar | barcodes_search/page/limit | Birinchi asosiy barkod, keyin manbaning asl tartibi. Maxsus scanner yoki tarozi formati qo‘shilmagan |
| Platforma overview / xarajat budjeti | page/search; budget_target/from/to/page | Ko‘rish tugmasi orqali tasdiqlanadigan read. URLdan avtomatik muhim amal yuborilmaydi; boshqa query natijasi shu filtrning yangi natijasi deb ko‘rsatilmaydi |

## Tartib va cheklovlar

`useListQuery`, `useListFilters`, `ListFilter`, `DataTable`, `Pagination` mavjud React/Tailwind stackini ishlatadi. Yangi jadval/form frameworki qo‘shilmadi. `useReadPage` append-only va versiya jurnallari uchun faqat native sahifa va fixed limitni qabul qiladi: qo‘llanmagan search/sort/limit yashirincha e’tiborsiz qoldirilmaydi, reset bilan xato ko‘rsatiladi. Bunday jurnalda saralashni almashtirish qoldiq yoki ordinal ma’nosini buzishi mumkin.

Har xil HTTP sahifalar bitta muzlatilgan snapshot deb hisoblanmaydi. Live ro‘yxatga yangi yozuv qo‘shilsa refresh kerak; moliyaviy hisobotlarda mavjud `asOf` contracti qo‘llanadi. O‘qish xatosi zero state emas. Oxirgi muvaffaqiyatli yozuvlar saqlansa, xato ochiq ko‘rsatiladi va yangi hisob/yakunlash amallari mavjud readiness guardlari bilan cheklanadi. Unknown ACKni tiklash alohida original amal kaliti bilan mavjud qoladi.

## Formalar, selectorlar va yagona hujjatlar

Mahsulot/kassa/filial/qarz tanlash controlining qidiruvi formaning bir qismidir. Tanlangan obyekt va review/draft saqlanishi ustuvor; selectorni read ro‘yxat bilan bir xil deb avtomatik reset qilinmaydi. Ommaviy narx tahriri bir tasdiqda100 mahsulotgacha va discard-confirmation bilan; narx tarixi URLdan mustaqil.

Kassa savati, bir chek qatorlari, bir return/transfer receipt, bitta cost snapshot, ruxsat katalogi, capi bor media fayllari, onboarding bosqichlari va parametrlar to‘plami mustaqil qidiriladigan jurnal emas. Bitta hujjatning to‘liq chegaralangan tarkibi bo‘lib qoladi. Barcha qatorlarni bexabar `slice` qilib kesish mumkin emas. Boshqa jurnalga ochiladigan ma’lumot bo‘lsa, manbaning alohida paging contracti ishlatiladi.

UI va API sinovlari local izolatsiyalangan `pos_test` uchun. Real hosting, provider, hardware yoki pilot qabulini isbotlamaydi. Uz/Ru barcha matnlar qamrovi original UX-01.02 da alohida ochiq.
