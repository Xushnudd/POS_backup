# Release image va kalit xavfsizligi

OPS-01.05ning image/runtime/kalit contracti lokal isolated Docker va PostgreSQL bilan tekshiriladi. Bu real staging, production deployment, tashqi secret-store ACL yoki registryga publish qilingan release qabuli emas. Ular alohida operator tasdig‘ini talab qiladi.

`docker-compose.release.yml`dagi app, jobs, reconciliation va migrate bir xil `POS_IMAGE`ni ishlatadi. `scripts/ops/release-entrypoint.mjs` ayni Compose qiymatini `POS_RELEASE_IMAGE` orqali tekshiradi: `repository@sha256:<64 lowercase hex>` shakli, production rejimi va non-root UID majburiy. Mutable tag, root va development rejimi child jarayon boshlanishidan oldin rad etiladi; rad javobida input/secret chop etilmaydi. Appning `node server.js` buyrug‘i explicit: Compose entrypoint almashtirilganda image CMD yo‘qolishiga tayanilmaydi. Worker va migrationning avvalgi buyruqlari saqlanadi. SIGTERM/SIGINT childga uzatiladi; exit code saqlanadi.

Release root filesystem read-only, UID/GID1001, barcha Linux capabilities olib tashlangan va `no-new-privileges` yoqilgan. Faqat `/tmp` va Next cache uchun har biri64MiB `noexec,nosuid,nodev` tmpfs mavjud. Moliyaviy hujjat, export va rasm baytlari hozir bazada saqlanadi; tmpfs backup emas. Alohida fayl saqlash joyi qo‘shilsa u explicit vakolatli volume bilan chiqariladi. Development/local HTTP overlay bu cheklovlarni olmaydi.

Runtime secretlar build argument yoki Dockerfile ENVga berilmaydi. `.dockerignore` environment fayllari, private keylar va `.local` recovery materiallarini build contextdan chiqaradi. Runtime credentiallar operator boshqaradigan environment/secret store orqali beriladi; Docker administratori ularni o‘qiy olishi sabab uning vakolati cheklanishi kerak. Ushbu kod tashqi secret managerni o‘rnatmaydi.

Izolatsiyalangan tekshiruv buyruqlari:

```bash
npm run test:ops
node --test scripts/ops/release-compose.integration.mjs
node scripts/ops/check-release-image.mjs "$approved_immutable_image"
node scripts/ops/test-release-image-negative.mjs "$available_immutable_base_image"
```

Auditor Docker image’ni faqat o‘qiydi, xususiy0700 vaqtinchalik katalogda0600 archive yaratib, oxirida o‘chiradi. Configdagi baked credentiallar, root user, to‘liq history va **barcha** saved layerlar tekshiriladi; keyingi layerda o‘chirilgan `.env` ham topiladi. GNU tar gzip OCI va eski tar formatlarini o‘qiydi; layer ichidagi fayllar hostga unpack qilinmaydi. Source scan bilan birga private credential-store yo‘llari, to‘liq PEM key bloklari va ma’lum token markerlari tekshiriladi. Noma’lum ixtiyoriy secretlarning yo‘qligini regex bilan mutlaq isbotlab bo‘lmaydi; bu cheklov JSON natijasida ochiq yozilgan.

GnuTLS cryptographic self-testlari public test keylarini system libraryga joylaydi. Aynan olti vektor rasmiy [GnuTLS3.7.9 source](https://gitlab.com/gnutls/gnutls/-/blob/3.7.9/lib/crypto-selftests-pk.c) bilan fingerprint bo‘yicha solishtirildi. `public-crypto-test-vectors.json` faqat metadata/hash saqlaydi: exact library path, whole-binary SHA256 va har vektor uchun bitta occurrence. Library o‘zgarsa yoki shu public key boshqa faylga yana qo‘shilsa ham audit rad etadi; barcha vendor fayllariga umumiy istisno yo‘q. Raw keylar natijaga yoki repositoryga ko‘chirilmagan. Crypto parserdagi BEGIN matnining o‘zi key deb olinmaydi; header label borligi alohida hisoblanadi.

Kalit aylantirish [TOTP rekey runbook](totp-key-rotation.md) orqali operator tomonidan bajariladi. Izolatsiyalangan test eski envelope overlap olib tashlangach ochilmasligi, yangi envelope va authenticator ishlashi, eski counter qayta ishlamasligi, audit xatosida rollback, parallel apply bir marta va CLI maintenance/vakolat talablarini tekshiradi. Bu mavjud production kalitlarini avtomatik o‘zgartirmaydi.

2026-10-16 lokal candidate qabul dalili: [release-image-security-20261016.json](../../tasks/evidence/release-image-security-20261016.json). Docker’ning lokal RepoDigest’i registryda mavjudlik yoki push qilinganini bildirmaydi. Haqiqiy release uchun tasdiqlangan registry manifest digest va alohida production ruxsati kerak.

185 bosqichidagi joriy candidate: `tasks/evidence/core185-20261016/image-audit.json` va `tasks/evidence/release-images-20261016.json`. Next standalone tracing web bundle uchun yetarli bo‘lsa ham, raw `.worker-build` jarayoniga kerakli paketlarni har doim ko‘chirmaydi. Dockerfile alohida runtime-deps stage’da ayni lockfile bilan `npm prune --omit=dev --ignore-scripts` qilib production dependency closure’ni ham kiritadi. CLI migration avvalgidek alohida. Haqiqiy non-root/read-only worker shu image’da shaxsan ko‘chirma tayyorladi; barcha19layer auditi0credentialpath/unknownmarker bilan o‘tdi. Oldingi180 image dalili tarixiy saqlangan, joriy digest uning o‘rniga ko‘rsatilmaydi.
