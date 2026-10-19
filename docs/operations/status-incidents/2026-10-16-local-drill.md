# Mahalliy status mustaqilligi mashqi

- ID: local-process-drill; sana: 2026-10-16; bu sintetik mashq.
- Mas’ul: avtomatlashtirilgan Codex lokal qabul sinovi; real on-call tayinlanmagan.
- Ta’sir: faqat yangi vaqtinchalik HTTP test jarayoni; real POS/baza tegilmagan.
- Aniqlash: 08:42:29.535Z — test jarayoniga SIGTERMdan keyin HTTP ulanishi
  rad etildi. Native va container status endpointlari 200 bilan outage qaytardi.
- 08:42:29.549Z — sabab identified: boshqariladigan SIGTERM.
- 08:42:29.672Z — yangi test jarayoni HTTP javob berdi; monitoring.
- 08:42:29.678Z — resolved; har ikkala sahifa Tiklandi yozuvini ko‘rsatdi.
- Dalil: `tasks/evidence/status186/drill.json`, `public-drill.json`.

Asosiy sabab atayin to‘xtatilgan test jarayoni. Status xizmati undan mustaqil
bo‘lgani sabab uzilmadi. Tiklash test jarayonini qayta boshlash orqali bajarildi.
Business data ishlatilmadi; real pul/ma’lumot yo‘qolishi haqida xulosa yo‘q.

Oldini olish: statusni POS compose/network/DBga bog‘lamaslik; eskirgan tasdiqni
unknown qilish; yangi status workflow har tegishli o‘zgarishda mashqni takrorlaydi.
Bu nazoratlar hozir implementatsiya qilindi, keyingi source o‘zgarishida CI
mas’uli natijani ko‘radi. Real host outage uchun mustaqil mashina va operator
qabulini deploymentdan oldin mahsulot egasi ta’minlaydi; sana hali belgilanmagan.

Mashqdagi dastlabki xatolar: public bind katalog 0700 bo‘lgani uchun non-root
container o‘qiy olmadi; faqat sintetik public katalog 0755ga o‘zgartirildi.
SIGTERM bilan tugagan jarayonni cleanup ikkinchi marta kutdi; signalCode ham
tekshirildi. Oxirgi mashq exit0, container va native processlar tozalandi.

Ommaviy matnni Codex ushbu sintetik mashq uchun ko‘rib chiqdi: mijoz/ticket/sirlar
yo‘q. Productionda inson publication reviewi kerak. Mashq JSON default public
snapshotga ko‘chirilmagan; default hali unknown va incidents bo‘sh.
