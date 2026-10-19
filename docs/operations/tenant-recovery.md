# Bitta tashkilot uchun tiklash rejasini tuzish

Bu operatorning **read-only recovery planning** amali. SQL import/upsert, moliyaviy balansni qayta yozish, boshqa tenantni rollback yoki avtomatik apply yo‘q. OPS-03.05 qabuli isolated recovery nusxada reja va boshqa tenant hashlarini tekshirish; haqiqiy production recovery bu qabul bilan bajarilmagan.

## Tartib

1. Tasdiqlangan encrypted backupni yangi empty **offline isolated** bazaga `restore.sh` orqali oching. [Auth quarantine](auth-restore-quarantine.md) saqlanadi; sourcega app, jobs yoki provayderlar ulanmasin. Bitta mijoz uchun butun productionni eski dump bilan overwrite qilmang.
2. Source backup manifest/checksum, source/target database identifikatorlari, tashkilot IDsi va tegishli operator ruxsatini private case jurnalida belgilang. Shared users va boshqa tashkilotga tegishli FKlar uchun alohida review kerak.
3. Node24 dependency/prisma client va `npm run worker:build` tayyor bo‘lsin. Credentials faqat private inherited environment/secret store orqali. Command argument, terminal history yoki logga URL/password qo‘ymang.
4. Quyidagi environment qiymatlarini operator sozlaydi (namunada haqiqiy manzil/key/tasdiq yo‘q):
   - `TENANT_RECOVERY_SOURCE_URL`, `TENANT_RECOVERY_SOURCE_CONFIRM_DATABASE`: offline recovered database va uning aniq nomi.
   - `TENANT_RECOVERY_TARGET_URL`, `TENANT_RECOVERY_TARGET_CONFIRM_DATABASE`: solishtiriladigan target va aniq nomi. Database identities turlicha bo‘lsin; DNS alias/host izolatsiyasini operator alohida tekshiradi.
   - `TENANT_RECOVERY_ORGANIZATION_ID`: ikkala nusxada mavjud tashkilot UUIDsi.
   - `TENANT_RECOVERY_REVIEWER`: vakolatli operatorning nonsecret identifikatori3–200belgi.
   - `TENANT_RECOVERY_CASE_REFERENCE`: real backup/approval casega nonsecret reference10–500belgi; API key/token qo‘ymang.
   - `TENANT_RECOVERY_PLAN_FILE`: mavjud bo‘lmagan yangi mutlaq output path; real (symlink emas), operator-owned0700 katalogda. Image ichida directory/fayl app UIDga mos bo‘lsin.
5. `npm run worker:tenant-recovery-plan`. CLI source/targetni alohida RepeatableRead **SET TRANSACTION READ ONLY** snapshotda o‘qiydi. Tasdiq nomi noto‘g‘ri, bir xil DB, unsafe output, mavjud output, schema/migration-checksum/size/integrity muammosi yoki tashkilot yo‘q bo‘lsa rad. Baza yoki credential qiymati logga chiqarilmaydi.
6. Output0600, exclusive/no-follow yaratilib fayl ham katalog entrysi ham fsync qilinadi. Stdout faqat safe status, model soni va planSHA256; shu hashni private case jurnaliga mustaqil yozing. Keyin operator auditga kirish/saqlash qoidasini qo‘llaydi. Reja public export/download katalogiga qo‘yilmaydi; egasi o‘zgartira oladigan faylning hashini mustaqil qayd etish tamper detection uchun zarur.

## Rejada nima bor

Organization-scoped portable **business** datasetlar taqqoslanadi: birlamchi yoki reviewed composite unique kalitlar, row digest, FK dependency fields, source/target snapshot/hash, reviewer/case va farqlar:

- `missing`: recovered source’da bor, current target’da yo‘q — faqat review candidate.
- `changed`: bir xil key, boshqa row digest — avtomatik eski versiya bilan overwrite qilinmaydi.
- `currentOnly`: target’dagi key — saqlanadi, avtomatik delete yo‘q.

Row payload/telefon/parol/token/data blob rejaga ko‘chirilmaydi. Existing tenant-export schema inventory, omitted fields va binary integrity ishlatiladi. Read-only snapshotda database migration names/checksumlari applicationdagi `prisma/migrations` bilan aynan teng bo‘lishi kerak; old/new/unreviewed schema bilan taxminiy plan yo‘q. Tugallanmagan va rolled-back bo‘lmagan migration mavjud bo‘lsa ham reja rad etiladi. Release migration katalogi worker bilan birga packaged bo‘lsin. Credentials/security/operational model omissionlari explicit yoziladi. Bu **portable_business_data_not_database_restore**: to‘liq raw database row importi emas. Shared User/BillingPlanVersion/SupportPolicyVersion business metadata ham review-only; organization membership/role/security yoki platform konfiguratsiyasini qaytarib qo‘ymang.

Source va target snapshotlari ketma-ket, distributed bir snapshot emas. Kelajakdagi applydan oldin targetni drain qilish, qayta solishtirish va row/FK/operator approval preconditionlari talab qilinadi. Hozir apply/import engine yo‘q. Moliyaviy yoki stock farqi topilsa mavjud tasdiqlangan posting/reversal/correction command va original idempotency keylar bilan alohida reja tuziladi; tarixiy sale/payment/journalni raw UPDATE/DELETE qilish taqiqlanadi. Missing tenantga raw restore qilish bu CLI bilan ruxsat etilmaydi.

Source/target connector vakolati OS/operator credential boundaryda; bu public HTTP endpoint yoki platform-user authentication emas. SQL READ ONLY ushbu commandning yozishini cheklaydi; privileged DBAning boshqa commandlari o‘rnida authorization kafolati bermaydi. Existing export100000row/32MiB chegarasi oshsa reja aniq xato bilan to‘xtaydi, truncate qilinmaydi. Katta tenant uchun mavjud large-export arxitekturasi alohida ochiq.

## Isolated qabul

`tests/tenant-recovery.integration.test.ts`: faqat127.0.0.1:55439/pos_test; private descriptor orqali pg_dump→yangi disposable pg_restore clone→quarantine. Source-only unreferenced category, changed/current-only product va shared userli foreign tenant bilan plan. Database transaction_read_only=on haqiqiy SQL bilan tekshiriladi; foreign portable-business manifest hashlar before/after teng, target yangi yozuvi va edit saqlanadi, source asl holatda qoladi. CLI wrong confirmation/same DB/existing file/unsafe parent rad; source checksum tampering va unfinished migration rad;0600 va stdout/file SHA binding, secret/phone nolog. Test clone/fayllar cleanup qilinadi. Bu real mijozning qabul dalili emas.
