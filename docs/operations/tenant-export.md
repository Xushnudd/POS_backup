# Tashkilot biznes ma’lumotlari eksporti

`/jobs` sahifasida tashkilot egasi “Tashkilot ma’lumotlari JSON eksporti” turini tanlaydi, sababni yozadi, oldindan ko‘rib tasdiqlaydi. Barcha filiallar olinadi; filial yoki mahsulot filtri qabul qilinmaydi. Faqat faol egasining parol sessiyasi ishlaydi. Bu SaaS obunani yangilashga bog‘liq emas; mavjud ma’lumotni chiqarish imkoniyati saqlanadi.

API: `POST /api/jobs` body `{operationId:UUID,type:"tenant_export",reason:string(3..2000)}`. Mavjud tor enqueue limiti5/min, tashkilotda20active job chegarasi va original-key replay qo‘llanadi. `GET /api/jobs`, `GET /api/jobs/{id}/events`, `POST /api/jobs/{id}/retry` va `GET /api/jobs/{id}/export` ishlaydi. Download owner/current tenant/live session,10/min, bounded streaming slot, attachment/no-store/nosniff. Hozirgi worker `npm run worker:jobs` yoki operatsion `--once` rejimida bajaradi; production server ichida taxminiy cron yaratilmagan.

## Fayl va tekshirish

JSON format `pos-tenant-export`, version1. `organizationId`, `asOf` va `datasets` mavjud. Prisma Decimal qiymatlari string: masalan `"12345678901234.123456"`; Date ISO, binary `{encoding:"base64",data:"..."}`. Manifest har dataset uchun model/rows/sha256 va umumiy rowCount beradi. Dataset hash — tartiblangan qatorlarning JSON ko‘rinishi, har qatordan keyin LF. Har dataset unique primary key bo‘yicha saralanadi. Butun fayl sha256/size JobExportda saqlanadi va download paytida yana tekshiriladi. FileAssetning o‘z bytes/size/sha256 mosligi ham tekshiriladi.

Barcha datasetlar bitta RepeatableRead snapshotda olinadi; worker artifact, succeeded holati va auditni bir atomik tranzaksiyada saqlaydi. Authorization ish boshida va natijani chiqarishdan oldin qayta tekshiriladi; bekor qilingan sessiya exportni nashr qilmaydi. Lease/token/generation fencing va heartbeat mavjud navbat qoidalarini saqlaydi. Late audit failure artifact/successni rollback qiladi; keyingi valid original-job retry bitta artifact yaratadi. Yo‘qolgan enqueue javobi DurableMutationda asl operationId bilan tiklanadi.

Jami100000qator va16MiB chegarasi. FileAsset8qatorlik, boshqa dataset250qatorlik sahifalarda olinadi; bitta snapshot60s deadline. Chegaradan oshganda qisman fayl nashr qilinmaydi. EXPORT_TOO_LARGE, EXPORT_SCHEMA_UNREVIEWED, EXPORT_CORRUPTED avtomatik takrorlanmaydigan `dead` holati va aniq lastError beradi. Owner sababni bartaraf etgach qayta tasdiqlashi mumkin. Vaqtinchalik WORK_FAILED cheklangan retry bilan ishlaydi. Artifact24soat mavjud; keyin worker faqat fayl baytlarini tozalaydi, biznes ma’lumotini o‘chirmaydi. Faol fayllar tashkilot bo‘yicha32MiB kvotada.

## Xavfsizlik va doira

Bu ko‘chma biznes eksporti; PostgreSQL restore/backup fayli emas. Session, invitation, auth challenge/contact proofs, platform access, worker/security/provider operational queues va idempotency Operation natijalari chiqarilmaydi. Operation natijasi asl credential javobini saqlashi mumkin. User passwordHash va OrganizationUser pinHash chiqarilmaydi. Audit action/actor/entity/time metadata saqlanadi; beforeData/afterData va boshqa ichki diagnostics/proof/payload maydonlari chiqarilmaydi. Aniq to‘liq `omittedModels` va `omittedFields` ro‘yxati fayl manifestida mavjud; bu yo‘qotishlar yashirilmaydi. Tenant users joriy yoki arxivlangan membership orqali, global plan/support policy faqat shu tenant ishlatgan versiya orqali tanlanadi. Ichki platform-policy author/reason eksportga qo‘shilmaydi.

`tenant-export-contract.ts` har model uchun reviewed scope yoki omissionni belgilaydi. Reviewed schema fingerprint yangi model, scalar field yoki relationni avtomatik chiqarishni rad etadi. Schema o‘zgarsa scope/secret decisions, fingerprint va testsni birga review qilish kerak. Fingerprintni postinstall/build orqali avtomatik yangilash mumkin emas.

Migration111 tenant_export job/artifact turini,112 esa aniq export-failure kodlarini qo‘shadi. Readiness ikkisini talab qiladi. Applied migrationlar qayta yozilmaydi.

BIZ-02.07 hali `in_progress`: organization close/cancel va qayta autentifikatsiya keyingi core ishlar. Obuna read-only guardlari va eksport uchun recovery istisnolari `subscription-read-only.md`da. Huquqiy retention toifalari, legal hold va irreversible deletion alohida tashqi tasdiq talab qiladi. Ushbu eksport tashkilotni yopmaydi, moliyaviy tarixni yoki asl fayllarni o‘chirmaydi.
