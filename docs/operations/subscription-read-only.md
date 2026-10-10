# Obuna tugagandan keyingi read-only

ADR-062: amaldagi trial yoki paidThrough sanasining keyingisidan tarif versiyasidagi graceDays qo‘llanadi. Grace tugagan aniq vaqtdan boshlab yangi biznes amallari rad etiladi. Legacy enrollment yo‘q tashkilotlar alohida ko‘chirilmaguncha avtomatik bloklanmaydi. Yangi foydalanuvchi/tashkilot yaratish bir martalik trialning mavjud qoidalarini saqlaydi; tashkilot identifikatori almashib trialni reset qilish qo‘shilmagan.

`GET /api/billing` yangi `businessWritesAllowed` flagini beradi; `newSalesAllowed` eski contract uchun saqlanadi. Trial/active/grace true, expired false, legacy_unmanaged true. `/billing` read-only haqida aniq tushuntiradi. SUBSCRIPTION_EXPIRED HTTP409: yangi savdo, kirim, qaytarish, payment/stock/journal va biznes sozlamalarini o‘zgartirish taqiqlanadi; ko‘rish va eksport qoladi.

## Ikki qatlam

`runOperation` avval live actor va qo‘shimcha authorizationni tekshiradi; oldingi committed actor/hash resultni qaytaradi. Faqat yangi biznes work oldidan DB entitlement tekshiriladi. Bu expired davrda lost-ACK original amalni yana yozmasdan tiklaydi. Payload/actor/revocation tekshiruvlari saqlanadi. Operation INSERT trigger yakunda ham wall-clock entitlementni tekshiradi: ish davomida grace tugasa business changes va operation birga rollback. Clock transaction boshlangan vaqtga muzlatilmaydi; UTC clock_timestamp ishlatiladi.

74 reviewed biznes jadvalida INSERT/UPDATE/DELETE DB guard mavjud. Organization faqat UPDATE guard bilan: boshqa yangi biznes yaratish va privileged fixture/parent cascade o‘chirishni avtomatik purge sifatida o‘zgartirmaydi. Root organizationId yoki reviewed parent FK zanjiri orqali tenant aniqlanadi; UPDATE eski va yangi tenantni tekshiradi, expired ma’lumotni active tenantga o‘tkazib bypass qilish mumkin emas. Direct Prisma yoki eski non-idempotent API ham guarddan o‘tadi. Applied migration113 readonly tables/operationsni,114 esa polimorf trigger record fieldlarini jadval bo‘yicha ajratishni,115 subscription tuple lock va Sale uchun lock upgrade oldini olishni,116 faqat unposted draft cancellation tombstone istisnosini qo‘shadi; applied fayllar qayta yozilmagan.

Organization shared lock supported plan assignment/renewal bilan tartiblanadi. Subscription FOR SHARE stale Serializable tuplega40001 qaytaradi; runOperation bounded retry yangi snapshotda qayta tekshiradi. Tasdiqlangan billing payment obunani atomik uzaytiradi va keyingi oddiy biznes yozuvi yana ishlaydi. Buning o‘zi POS cash posting emas, Click/fiskal adapter emas.

## Ochiq qoladigan amallar

Aniq ro‘yxat `read-only-policy.ts`da; noma’lum operation biznes deb qaraladi. Billing invoice create/cancel/payment confirmation/subscription policy va vakolatli platform tariff/cost/retention boshqaruvi tiklash uchun ochiq. Job enqueue/retry faqat mavjud reconciliation/catalog_export/tenant_export turlarini qabul qiladi. Authentication, sessiya revoke, security notice va support core ochiq. Bu exceptionlar o‘z live authorizationini saqlaydi; exception operation ichidagi noqonuniy Product/Payment/Stock yozuvi DB guard tomonidan baribir rad etiladi.

Audit log, diagnostic incidents, support, billing, worker/security/auth operational tables guarddan mustasno: read/download audit, authentication va mavjud technical queue/lease/expiry cleanup iqtisodiy posting emas. Invitation acceptance yoki boshqa oqim yangi membership/product/sale yozsa, biznes jadvali guardi qo‘llanadi. Manual stock reservationning faqat allaqachon server muddati tugagan system expiry entry, remainingQuantity0 va status expired o‘zgarishi tor SQL shartlari bilan ochiq. Cash-ticket reconciliation yoki yangi rezerv bundan foydalanmaydi; physical inventory miqdori o‘zgarmaydi. Ma’lumotlar avtomatik o‘chirilmaydi. `sale.create` uchun state=cancelled, actor mavjud va result aynan `{cancelled:true}` bo‘lgan original tombstone INSERT ochiq: bu pending unposted so‘rovni to‘xtatadi, Sale/Payment yozmaydi. Live actor/hash/replay tekshiruvlari cancelDraftIntentda saqlanadi; completed state yoki boshqa operation turi ushbu istisnodan foydalana olmaydi.

Eski product/category catch bloklari UnknownRequestErrorni umumiy API mapperga uzatadi: SQL read-only rad etishi generic500ga yashirilmaydi. Boshqa database xatolari maxfiy SQLni javobga chiqarmaydi.

## Qolgan scope

Bu organization close/cancel funksiyasi emas. Owner reauthentication, closure lifecycle, legal hold va category retention alohida bajariladi. Irreversible deletion blocked_external. BIZ-02.07 hali done emas. Staging/prod migration/deploy, haqiqiy payment/fiscal/hardware yoki huquqiy qabul ushbu isolated sinovlar bilan tasdiqlanmaydi.
