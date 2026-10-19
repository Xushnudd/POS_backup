# Real image bilan lokal restore va rollback

RELEASE-01.06 uchun takrorlanadigan buyruq:

```bash
node scripts/ops/test-release-images.mjs
```

Oldingi image `POS_DRILL_PREVIOUS_IMAGE`, joriy image `POS_DRILL_CURRENT_IMAGE`
orqali tanlanadi. Defaultlar faqat hozir mavjud lokal `pos-app:local` va
`pos-core185-candidate:20261016`. Script ikkalasini darhol immutable IDga resolve
qiladi va o‘sha IDni ishga tushiradi; auto-pull/push/deploy yo‘q. Bitta image ikki
tomonda ishlatilsa rad etadi. `postgres:15-alpine` va hostda GPG kerak.

Faqat yangi `pos-release-drill-*` container/network/volume, private vaqtinchalik
katalog va sintetik kalitlar yaratiladi. `.env` yoki live baza o‘qilmaydi. App porti
faqat loopbackda, DB porti publish qilinmaydi. Runtime non-root1001, read-only,
cap-drop va tmpfs bilan ishlaydi. Bu productionga chiqarish ruxsati emas.

Mashq ketma-ketligi:

1. Oldingi image migratsiyalari bo‘sh bazaga haqiqiy Prisma CLI orqali qo‘llanadi.
   Sintetik owner/session, kassa, ochiq smena, 5 dona mahsulot yaratiladi. Haqiqiy
   HTTP API bilan 1.01 UZS naqd savdo tugatiladi va boshqa draft saqlanadi.
2. O‘zgartirilmagan `backup.sh` haqiqiy `pg_dump`ni GPG bilan shifrlaydi. Manifest
   ham shifrlanadi, checksum va 0600 rejim saqlanadi. Host shimlari faqat PostgreSQL
   CLI oqimini disposable konteynerga uzatadi; DB yoki savdo logikasi mock emas.
3. Backupdan keyin yana bitta source savdosi yoziladi. Source app to‘xtatiladi.
   `restore.sh` yangi bo‘sh targetga haqiqiy restore qiladi. Original savdo, draft,
   payment, qoldiq saqlangan; post-backup savdo yo‘q. Nonempty target qayta restore
   uchun rad. Eski sessiyalar bekor, auth checkpoint pending, readiness503.
4. Joriy image migratsiyalari qo‘llanadi. Har applied migration checksumi
   repository SQLiga mos kelishi shart. Faqat sintetik identifikatorlar bo‘lgan
   targetda operator-review mashqi va yangi test session bajariladi. Haqiqiy
   foydalanuvchi/MFA recovery tasdiqlangan deb ko‘rsatilmaydi.
5. Joriy image original savdoni o‘qiydi/replay qiladi va draftni tugatadi. Keyin
   oldingi **binary image** yangi schemada ishga tushadi: oldingi buyruqlar replay
   qilinadi, yana bitta savdo yaratiladi. Joriy image qayta ishga tushib uni ham
   replay qiladi. Yakuniy Sale3/Payment3/Movement3, summa3.03, qoldiq2; duplicate0.
   DB down-migrate/overwrite va posted hujjatlarni tahrirlash yo‘q.
6. Joriy image haqiqiy receipt grant va shaxsan consented customer reminder yaratadi.
   Haqiqiy worker tayyorlagan ko‘chirma bilan ikkinchi GPG backup/restore bajariladi.
   Auth reviewdan keyin ham eski ikkala capability404, owner list va old-key replay
   available:false bo‘lishi shart. Eski external image URL metadatasi saqlangan.
7. Alohida process app outage/dependency outage va haqiqiy filesystem thresholdini
   kuzatadi. Yakunda barcha vaqtinchalik resurs, dump, GPG va auth kalitlar tozalanadi.

`tasks/evidence/release-images-20261016.json` actual image IDlari, migration
checksumlari, backup hash/o‘lchami, vaqt, iqtisodiy invariantlar va limitlarni
saqlaydi. Joriy mashqda 179→188 migratsiya o‘tdi. RTO boshlanishi — restore boshlanishi,
tugashi — current image orqali draftni tugatish va aniq payment/stock tekshiruvi.
Backupdan oldingi yo‘qolgan savdo0; ataylab post-backup yaratilgan va targetda
yo‘q savdo1. Shu sabab butun backup strategiyasi uchun “RPO loss0” deyilmaydi.
15min/4h texnik targetlar productionda o‘lchangan yoki shartnomaviy SLA emas.

Haqiqiy off-host recovery, real dataset/timing, secret custody, operator review,
staging rollout, provider/offline reconciliation va pilot qabuli o‘z bandlarida
ochiq qoladi. Oldingi image o‘zgarsa yoki yangi destructive contract migration
paydo bo‘lsa bu mashq qayta o‘tishi kerak; eski image’ni ko‘r-ko‘rona qaytarmang.
