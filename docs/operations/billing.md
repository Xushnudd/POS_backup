# SaaS obuna: operator va biznes egasi qo‘llanmasi

## Tasdiqlangan model

2026-10-10 mahsulot egasi SaaS-first, UZS oylik obunani tasdiqladi. Boshlang‘ich
Start:99000 (1filial/1kassa/3xodim), Business:249000 (3/5/15), Pro:499000
(10/20/50). Narxlar migratsiyadagi boshlang‘ich konfiguratsiya; runtime va UI
bazadagi versiyalardan foydalanadi. Hardcoded narx bilan hisoblash yo‘q.
Yangi tashkilotga Pro trial bir marta14kun, so‘ng7kun grace. Trial reja va
muddatlari administrator tomonidan kelajakdagi tashkilotlar uchun o‘zgartiriladi;
trial kamida1kun. Mavjud trial sanalari qayta yozilmaydi.

Eski tashkilotlar avtomatik bloklanmaydi: legacy_unmanaged. Platforma administratori
alohida sabab bilan tarifga ko‘chiradi. Legacy enrollment yangi trial bermaydi;
shu vaqtdan konfiguratsiyadagi grace boshlanadi. Yangi tashkilotda mavjud trial
qayta boshlanmaydi. O‘tishni oldindan biznes egasi bilan kelishib bajaring.

## Narx va vakolat

`/billing`: tarif narxi, jami limitlar, current subscription va usage bir bazadan.
Oddiy biznes egasi platforma tarifini o‘zgartira olmaydi. Faqat faol
PlatformOperator.platform_admin va password session yangi immutable versiya
publish qiladi. Operator o‘zining original operationId va sababini tasdiqlaydi;
audit va Operation bir transaction. Support operator bu vakolatga ega emas.
Hech qanday default platforma admin hisobi yoki signup orqali self-escalation yo‘q.

Yangi versiya mavjud subscriber tarifini avtomatik almashtirmaydi. Tarifga
alohida ko‘chirish UI/API original-key idempotent; past limitda existing data
saqlanadi. Narxi o‘zgargan eski invoice ham original snapshotda qoladi. Yangi
invoice current planVersionIdni tekshiradi: ko‘rilgan versiya eskirsa409
BILLING_PLAN_CHANGED, operator narxini qayta ko‘rib tasdiqlash kerak.

## Limit va expiry

SQL organization lock parallel create ni seriallashtiradi. Filial, barcha
filiallarning kassalari va tashkilot membershiplari jami hisoblanadi; owner ham
xodim. Arxivlangan/inactive obyektlar ham countga kiradi, archive bypass yo‘q.
Store/Register/OrganizationUser tenant identity ko‘chirish bilan bypass rad.
PLAN_LIMIT_REACHED409: upgrade yoki operator tasdiqlagan yuqori limit kerak;
ma’lumot avtomatik delete qilinmaydi. Trial Pro limitlari ham shu guarddan o‘tadi.

Expiry clock PostgreSQL NOW. Trial/paidThroughdan keyingi grace oxirigacha
amaldagi imkoniyatlar ishlaydi. Grace yakuni inclusive: aynan o‘sha paytdan
expired. SQL yangi Sale INSERT, yangi filial/kassa/xodimni rad etadi.
Ko‘rish va eksport qoladi. Existing sale/return/pending original-key recovery,
refund va smena yopish moliyaviy majburiyatlari obuna sabab tashlab ketilmaydi;
blanket barcha mutationlar yopilgan degan va’da yo‘q. Banner polling sessiya
idle muddatini uzaytirmaydi. UI ruxsati server/SQL guard o‘rnini bosmaydi.

## Invoice va qo‘lda to‘lov

Owner tarifni tanlab original operationId bilan oylik invoice yaratadi. Bir
organizationda bir open invoice. Invoice amount/currency/original price version
va period immutable. Pul yechish yoki Click chaqirig‘i bajarilmaydi.
PeriodStart=max(database NOW,trialEndsAt,paidThrough); bitta UTC kalendar oy,
month-end clamping (31yanvar→28/29fevral), vaqt millisekundgacha saqlanadi.
Bu oldindan to‘lanadigan xizmat: yopiq unpaid gap uchun taxminiy qarz yozilmaydi.

Faqat platforma administratori bankdagi original tushumni tashqarida tekshirib,
manual_bank proof reference va sabab bilan tasdiqlaydi. Reference trimmed/NFKC/
lowercase SHA256, global unique; API token yoki credential kiritmang.
Reference original bayonnoma identifikatori; bank/provayder request formatini
ifodalamaydi. Bir invoice bir payment. Payment+paid invoice+subscription muddat
va tarif+audit+Operation atomic; kech audit xatosi hammasini rollback qiladi.
Raw orphan payment yoki proofsiz paidThrough SQLda rad. Bank kitobini taxminiy
request bilan avtomatik tekshirish yoki real Click confirmation yo‘q.

Bu platformaning xizmat haqi jurnali: POS Payment/CashMovement/AccountEntryga
ikkinchi cash yozuvi yaratmaydi. Real POS biznesning tushumi bilan aralashmaydi.
ProofHash list/API/auditga chiqmaydi. Operator tasdiqlagan payment muddatni ochadi;
expired eski invoice periodi tugagan bo‘lsa cancel qilib yangisini yarating.
Paid invoice cancel qilinmaydi; haqiqiy billing refund alohida tasdiqlangan
siyosat va integratsiya talab qiladi, fake refund yozilmagan.

Cancel-at-period-end owner niyatini qayd qiladi; current paid muddat qisqarmaydi,
avtomatik charge mavjud emas. Yangi tasdiqlangan to‘lov renewalni tiklaydi.
Invoice cancellation faqat open holatga va sabab bilan; payment yo‘q bo‘lsa pul
qaytimi yaratilmaydi. Invoice/Payment tarix pagination20; yangi key bilan duplicate
billing rad, unknown ACKda original key qayta tekshiriladi. Invoice UI local
pending queue reload/retryda aynan original operationni saqlaydi.

## Migratsiya va qabul chegarasi

100–105 additive migratsiyalar: approved seeds, one-time new-org enrollment,
immutable versions, subscription/quotas, invoices/proofs, deferred atomic
settlement va identity guards. Applied fayllarni tahrirlamang. Deploymentdan
oldin backup, maintenance va readiness contracti; existing tenantlarni avtomatik
tarifga ko‘chirmang. Invoice qonuniy fiskal schyot-faktura yoki Click receipt emas;
ikki turdagi hujjatni aralashtirmang. Production payment SDK, webhook, bank API,
SMS, local license yoki avtomatik recurring charge yozilmagan.

## Integratsiya xarajat budjeti

Platforma administratori `/billing`da tashkilot, manba hujjat identifikatori,
valyuta, davr, iste’mol miqdori, birlik narxi va hisoblash asosini kiritadi.
Fiscal/SMS/printer_agent/payment/hosting/backup/other alohida turlar.
Provayder narxlari taxmin qilinmaydi; `estimated` baholangan yozuvni ochiq belgilaydi.
Miqdor × narx Decimal bilan, ikki kasrgacha HALF_UP; original-key replay bitta yozuv.
Ayni manba/tur/valyuta/davr uchun bitta faol yozuv; boshqa oylarga qayta yozish mumkin.
Xato yozuv sabab bilan bekor qilinadi, tarix saqlanadi, original qiymat o‘zgarmaydi.

Hisobot faqat tanlangan intervalga to‘liq kirgan davrlarni qo‘shadi; qisman davrlar
alohida sanaladi, taxminiy proratsiya yo‘q. Valyutalar alohida; FX konversiya yo‘q.
UZS recordedContribution = shu intervalda qayd qilingan prepaid subscription tushumi
− ma’lum UZS manba xarajatlari. Bu buxgalteriya foydasi yoki earned revenue emas.
Yo‘q turlar noma’lum, baholangan/boshqa valyuta/qisman davr bo‘lsa marja to‘liq emas.
Sahifa20, CSV barcha filtrlangan yozuvlar, maksimum10000 va formula himoyasi.
Xarajat yozuvi POS Payment/CashMovement/AccountEntry yaratmaydi.
