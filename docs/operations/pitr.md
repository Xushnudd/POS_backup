# PostgreSQL15: WAL va aniq vaqtga tiklash

`OPS-03.03` uchun PostgreSQLning o‘z `pg_basebackup`, WAL archive, `pg_verifybackup` va recovery target imkoniyatlari ishlatiladi. `pg_dump` bu zanjirni almashtirmaydi. Yangi texnologiya talab qilinmadi. Haqiqiy disposable sinov dalili: [pitr-drill-20261016.json](../../tasks/evidence/pitr-drill-20261016.json). Bu lokal texnik qabul; real host, tashqi shifrlangan nusxa, scheduler yoki mijoz production SLA qabuli emas.

## Tayyor konfiguratsiya va vakolat

`docker-compose.pitr.yml` ixtiyoriy overlay; default lokal Composega avtomatik ulanmaydi. U PostgreSQLga `ops/postgresql/pitr.conf`ni beradi: `wal_level=replica`, `full_page_writes=on`, `archive_mode=on`, `archive_timeout=60s`; har tugagan WAL segment `archive-wal.sh` orqali himoyalangan repositoryga yoziladi. `pitr-init` faqat shu Compose projectning alohida repository volume kataloglarini yaratib, PostgreSQL OS akkauntiga beradi. Boshqa cluster/muhit ayni repositorydan foydalanmasin. Bu konfiguratsiyani mavjud bazaga ulash PostgreSQL restartini talab qiladi; operator va egasining real deployment uchun alohida ruxsatisiz ishga tushirmang.

Repository, `base`, `archive` kataloglari `0700`, WAL va metadata `0600`. Docker/host administrator vakolati backupni to‘liq o‘qish vakolatidir; faqat vakolatli operatorga beriladi. Physical backup barcha tenantlar va auth tarixini saqlaydi. Oddiy app/support xodimlariga repository mounti yoki Docker vakolati berilmaydi. Masofaviy base backup uchun alohida `LOGIN REPLICATION` roli, cheklangan `pg_hba.conf`, TLS va private `PGPASSFILE` talab qilinadi; passwordni command argumenti yoki logga yozmang. Tayyor script normal libpq environment/`.pgpass`dan foydalanadi. Lokal OS backup operatorining vakolati ham alohida audit qilinadi.

WAL arxivchisi private katalog egasi/mode’ni tekshiradi, vaqtinchalik faylni diskka sync qiladi va atomic hard-link bilan nashr etadi. Qayta urinishda faqat aynan bir xil fayl qabul qilinadi; boshqacha mazmun mavjud WALni almashtirmaydi. Arxiv yo‘q/to‘la/ruxsatsiz bo‘lsa nonzero qaytariladi va PostgreSQL qayta urinadi. Bunday xatoda `pg_wal` o‘sadi: disk va `pg_stat_archiver` nazorati majburiy. Bu profil at-rest shifrlash yoki off-host failure domain yaratmaydi; ular `OPS-03.01`ning alohida tashqi qabulidir.

## Base backup va retention

`ops/postgresql/pitr-policy.json`: har 24 soatda base backup, 60 soniyalik WAL switch, 30 kun texnik backup oynasi. Bu buxgalteriya hujjatlarini saqlash muddati emas. Production scheduler real host tanlanganda o‘rnatiladi; hozir hech qanday timer yoqilmadi.

Operator tasdiqlagan private env va explicit Compose overlaylar bilan serverni boshqaradi. Quyidagi misol faqat tanlangan muhit uchun; `.env` avtomatik o‘qilmasin va to‘liq rendered config logga chiqarilmasin:

```bash
docker compose --env-file "$pos_env" -f docker-compose.yml -f docker-compose.release.yml -f docker-compose.pitr.yml config --quiet
# Deployment/maintenance/restart egasining alohida tasdig‘idan keyin.
# Ishlayotgan va PITR qabul qilingan DBda lokal OS operator backupi:
docker compose --env-file "$pos_env" -f docker-compose.yml -f docker-compose.release.yml -f docker-compose.pitr.yml exec -T --user postgres db sh -ec 'export PGUSER="$POSTGRES_USER" PGHOST=/var/run/postgresql; exec /bin/sh /ops/pitr/base-backup.sh /repository'
```

`base-backup.sh` incomplete backupni `.pending.*`da saqlaydi; stream WAL va SHA256 manifest oladi, `pg_verifybackup` muvaffaqiyatidan keyingina ready nomga atomic ko‘chiradi. Xatoli backup tayyor nusxa hisoblanmaydi. Fayl/config va alohida secret recovery tartibi [mavjud backup runbookida](deployment-readiness.md) saqlanadi. External tablespace/symlinklar bo‘lgan cluster uchun yo‘l xaritasi va izolatsiya alohida sinovdan o‘tishi kerak; ushbu POS drill bunday tablespace ishlatmaydi.

`retention-plan.mjs <repository> <policy-json>` faqat reja chiqaradi. Uni repository egasi OS accountda ishlating. U metadata/ownership/mode’larni tekshiradi, cutoffdan avval tugagan eng yaqin base backupni ham saqlaydi; shundan boshlab barcha zarur WALlar qoladi. Yangi repository hali 30 kunlik tarixga ega bo‘lmasa `requestedWindowCovered=false` qaytaradi. Boshqa timeline/historylar taxmin qilinib o‘chirilmaydi. `automaticDeletion=false`; script hech narsa o‘chirmaydi. Real huquqiy/operatsion tasdiqsiz irreversible deletion taqiqlangan. Retentionni bitta WAL faylining yoshiga qarab qisqartirish yoki `pg_archivecleanup`ni ko‘r-ko‘rona ishlatish recovery zanjirini buzishi mumkin.

## Xavfsiz tiklash

1. Barcha kerakli WALlar va verified base mavjudligini tekshiring. Original clusterning PG15 major versiyasi, extension/locale/platform mosligi shart. Kerakli UTC target va operator/ticketni private audit jurnaliga yozing; avvalgi hujjatni o‘zgartirmang.
2. **Yangi empty offline target** ajrating. Original/live DB yoki mavjud fayllar ustiga yozmang. `prepare-restore.sh <base> <archive> <empty-target> '<YYYY-MM-DD HH:MM:SS.ffffff+00>' <restore-wal.sh-absolute-path>`ni PostgreSQL OS accountida bajaring. Faqat absolute xavfsiz yo‘llar va qat’iy UTC format qabul qilinadi; symlink yo‘llar va nonempty target rad etiladi. `pg_verifybackup` yana bajariladi.
3. Targetni network/tashqi vendor/app trafficdan izolatsiyalab PostgreSQL bilan ishga tushiring. `restore_command` readonly archivdan nusxa oladi, `recovery_target_timeline=current`, `recovery_target_time`, `recovery_target_inclusive=true`, `recovery_target_action=pause`, read-only va noTCP konfiguratsiya qo‘yiladi. Targetdan avval arxiv tugasa PostgreSQL fatal bilan to‘xtashi kerak; “ishga tushdi” deb qabul qilmang.
4. `pg_is_in_recovery()`, `pg_is_wal_replay_paused()`, `pg_last_xact_replay_timestamp()`, targetgacha/targetdan keyingi ledger hamda exact monetary qiymatlarni tekshiring. Pause qilingan cluster **ishga chiqarilmaydi va avtomatik promote qilinmaydi**. WAL/PITR barcha tenantlarni vaqt bo‘yicha qaytaradi; bitta tenant recovery uchun [alohida tartib](tenant-recovery.md) ishlatiladi.
5. Real tiklashda [auth quarantine/review](auth-restore-quarantine.md), provider/outbox va offline navbat reconciliation, tasdiqlangan RPO data-loss tahlili va operator review shart. Ushbu physical recovery helper ularni avtomatik bajarildi deb hisoblamaydi. App/jobs/dispatchni tekshiruvgacha ishga tushirmang. Keyin faqat alohida tasdiq bilan promote/routing ochiladi.

## Qayta bajariladigan amaliy sinov

```bash
npm run test:ops
# Existing approved local images: PostgreSQL15 + Node24-bearing app image.
POS_PITR_NODE_IMAGE=pos-app:local node scripts/ops/test-pitr.mjs
```

Drill `.env`ni o‘qimaydi va mavjud DBga ulanmaydi; noyob nomli 4 volume va 3 container yaratadi, port ochmaydi, `--network none` ishlatadi. Monetary fixture 100.00→125.75 commit bo‘ladi, target olinadi, keyin 0.00 commit qilinadi. Real base+WALdan targetga tiklanganda 125.75 va targetgacha ledger saqlanishi, keyingi yozuv yo‘qligi, read-only write rejection tekshiriladi. OS boshqa UIDning o‘qish/yozishi, conflicting WAL overwrite, nonempty target, config injection va yetib bo‘lmaydigan future target rad etiladi. Retention real yangi repositoryda ham ishlatiladi; 30 kun o‘tgan deb da’vo qilinmaydi. Barcha drill container/volumelari tozalanadi. JSON dalilda source revision, fayl SHA256, image ID, real target/last replay timestamp va o‘lchangan tiny-fixture recovery vaqti bor. Bu vaqt manba avariyasidan to‘liq POS mijoz tayyorligigacha production RTO emas.

Asoslar: [PG15 continuous archive](https://www.postgresql.org/docs/15/continuous-archiving.html), [pg_basebackup](https://www.postgresql.org/docs/15/app-pgbasebackup.html), [WAL sozlamalari](https://www.postgresql.org/docs/15/runtime-config-wal.html), [recovery targets](https://www.postgresql.org/docs/15/recovery-target-settings.html). Real off-host nusxa, deployment, monitoring alert va operator key custody dalillari alohida ochiq qoladi.
