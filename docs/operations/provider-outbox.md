# Provider outbox core

Bu vendor-neutral arxitektura. Production registry bo‘sh: Click, fiskal servis yoki hardware chaqirilmaydi. Test adapterlari faqat tests ichida. Mavjud naqd savdo oqimi o‘zgarmaydi.

## Tranzaksiya va holatlar

Tasdiqlangan business service `runOperation` ichida `enqueueProviderIntentTx` chaqiradi. Operation, business yozuvi, immutable intent, outbox va audit birga commit yoki rollback bo‘ladi. SQL original manba, tashkilot/filial va takror business identityni himoyalaydi. Yangi operation kaliti/provider bilan unknown yoki confirmed subjectni ikkinchi marta yuborib bo‘lmaydi.

Worker qisqa tranzaksiyada claim qiladi va commitdan keyin transportni chaqiradi. Lease 30 soniya, transport chegarasi 10 soniya. Yakunlash alohida qisqa tranzaksiyada lease token/generation orqali tekshiriladi. Confirmed/failed domain hook faqat DB yozuvlari uchun; hook/audit xatosi butun lokal yakunlashni rollback qiladi. Kelajakdagi adapter haqiqiy domain postingni o‘zi ta’minlashi va ushbu contract testlaridan o‘tishi kerak.

Outbox: queued → running → confirmed/failed yoki unknown → running (lookup). Intent: awaiting → confirmed/failed/needs_review. Confirmed original uchun owner-approved kompensatsiya alohida immutable child intent yaratadi: original compensating → compensated; child muvaffaqiyatsiz/noaniq bo‘lsa needs_review. Original proof va tarix qayta yozilmaydi.

## Unknown va restart

Timeout, yo‘qolgan javob, malformed natija yoki expired lease submitni qayta yubormaydi. Original intent UUID orqali lookup qilinadi, external ID javobda kelmagan bo‘lsa ham. Kechikkan eski worker natijasi fencing sababli post qilinmaydi; ma’lum external ID almashgan javob ham final postingga ruxsat bermaydi. Distributed transaction yoki remote exactly-once kafolati berilmaydi.

Lookup exponential backoff bilan 5 soniyadan boshlanadi, 300 soniyaga cheklanadi. Har 8 lookupdan keyin review; `not_found` ham review, qayta charge uchun dalil emas. Owner sabab va original operationId bilan lookupni davom ettiradi; lifetime maksimum 32 lookup, counters reset qilinmaydi. Registry konfiguratsiyasiz navbat claim qilinmaydi. Maintenance yangi worker admissionni to‘xtatadi.

## Operator amallari

Owner `GET /api/integration-operations?page=1` orqali o‘z tashkilot/filialidagi 20 ta yozuvni ko‘radi. Request payload, request hash, lease va external ID chiqarilmaydi. `POST /api/integration-operations/{id}/lookup` body: `{operationId: UUID, reason: string}`; sabab 3–2000 belgi, limit 10/minute. Bu faqat lookupni davom ettiradi; submit endpointi mavjud emas. Original operationIdni noaniq javobdan keyin saqlash kerak.

Manual review paytida SQL bilan status/proofni o‘zgartirmang va yangi kalit bilan charge yubormang. Real vendor hujjatlari mavjud bo‘lganda original operation identity bilan authoritative status tekshiriladi. Lookup/idempotency ishonchli bo‘lmasa avtomatik qayta charge yoqilmaydi. Secretlar request/auditga kiritilmaydi; vendor credentiallar keyingi alohida integratsiya konfiguratsiyasida saqlanadi.

## Migratsiya va tiklash

098–099 additive migratsiyalar; qo‘llangan fayllar tahrirlanmaydi. Readiness ushbu migratsiyalarni talab qiladi. Backup intent/outbox/events/Operationni birga saqlashi kerak. Restore eski snapshotga remote business natijasini qaytarmaydi: maintenance ostida tiklab, orphan/unknown holatlar bo‘yicha authoritative lookup/reconciliation bajarilmaguncha provider bindingni yoqmang. Restart testi remote-side test proofdan keyingi process exit va boshqa processdagi lookupni tekshiradi; real vendor sandbox/pilot qabulini almashtirmaydi.

### Restore uchun majburiy lookup (126)

`AuthRestoreCheckpoint` pending bo‘lsa claim, transport va lokal settlement bloklanadi. Reviewdan keyin ham checkpoint sanasidan oldin yaratilgan intentlar qayta submit qilinmaydi: queued→running lookup transition SQL bilan ruxsat etiladi, submit attempt o‘smaydi va original intent UUID lookup qilinadi. SQL orqali eski queued intentni submitga claim qilish rad. Oldin olingan submit claim ham restore tarixidan keyin transportga yuborilmaydi; lease expiry orqali lookupga qaytadi. Oddiy yangi intentlar oldingi submit oqimini saqlaydi.

Lookup `not_found` bo‘lsa manual review; shu javob charge qilishga ruxsat bermaydi. Kelajakdagi haqiqiy adapter source backupda umuman yo‘q remote operatsiyalarni ham authoritative reconcile qilishi kerak. Ichki tarixdagi confirmed/failed yozuvlarni ham real provider bilan solishtirish operator vazifasi; bu kod mavjud bo‘lmagan vendor query/list API yaratmaydi. Offline qurilmadagi browser queue backup tarkibi deb hisoblanmaydi. OPS-03.06ning to‘liq tashqi qabuli ushbu guarddan alohida.
