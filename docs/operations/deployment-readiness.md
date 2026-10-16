# Staging va productionga texnik tayyorgarlik

Haqiqiy server, domen, sertifikat, off-site saqlash, monitoring va pilot hali tasdiqlanmagan. Ushbu fayllar konfiguratsiya va tartibni tayyorlaydi; deployment yoki mijoz qabul dalili emas. Haqiqiy production deployment faqat egasining alohida tasdig‘idan keyin.

## Muhitlarni ajratish

`ops/environments/staging.env.example` va `production.env.example` qiymatsiz namuna. Har birini repositorydan tashqaridagi operator-owned0600 faylga ko‘chiring. Development `.env`ni nusxalab ishlatmang. Har muhitning PostgreSQL user/password/database, AUTH_CHALLENGE_SECRET, old-key overlap, maintenance katalogi, GPG recovery vakolati, Compose project va backup katalogi alohida. Imkon bo‘lsa staging/production alohida host va credential storeda bo‘lsin. Production ma’lumotini stagingga ko‘chirish alohida ruxsat va anonimlashtirish talab qiladi.

POSTGRES_DB/USER nomi namunada muhitga ajratilgan. DATABASE_URL internal `db` servisiga, aynan shu database/user/passwordga mos va paroli URL-encoded bo‘lsin. Operator uch muhit credentiallari bir xil emasligini private muhitda tekshiradi; bu hujjat mavjud kalitlarni tekshirganini da’vo qilmaydi. Compose project nomi volume/networkni ajratadi; boshqa muhitning volume nomini override qilmang. `docker compose down -v` production amali emas.

Private env fayllarini networkga ulanmasdan tekshirish:

```bash
node scripts/ops/check-environment-isolation.mjs "$dev_env" "$staging_env" "$production_env"
```

Checker own0600/no-symlink fayllar, baza targeti/parol/active+old key reuse, release MFA/loopback/image IDni rad etadi. Secret/path/URL chop etilmaydi. DNS alias, haqiqiy host izolatsiyasi va secret-store ACL operator qabulini talab qiladi; `ready_for_operator_review` real deploy readiness emas.

Rendered network/volume/bind tekshiruvi va uchta haqiqiy sintetik bazada cross-environment write sinovi [muhit izolatsiyasi protokoli](environment-isolation.md)da. Bu lokal dalil haqiqiy staging/production muhitlari tasdiqlanmaganini o‘zgartirmaydi.

Bir immutable image digestni stagingdan productionga ko‘tarish mumkin: runtime secrets buildga berilmaydi. POS_RELEASE build/runtime deployment ID bilan bir xil bo‘lsin. POS_IMAGEga approved `registry/image@sha256:...`ning haqiqiy qiymatini kiriting; namuna uydirma digest bermaydi. Base Compose legacy defaultlarini saqlaydi, release overlay MFAni majburiy yoqadi va bo‘sh asosiy kalitni rad etadi. Startup enabled MFA uchun key va ikkala flag mosligini, overlap ≤2 valid distinct keyligini tekshiradi; noto‘g‘ri konfiguratsiya ishga tushmaydi. `npm run test:ops` private-env va uptime/disk core sinovlarini bajaradi va CIga ulangan; CI real deploy/pilot emas.

App/jobs/reconciliation bir xil runtime auth va API budget sozlamalarini oladi. Migration alohida process, avtomatik app startupga qo‘shilmagan.

Barcha amallar operatorning aniq private env fayli bilan; auto-discovered `.env` yoki shell secret override ishlatmang. Quyidagi buyruqlar deployment yo‘riqnomasi, hozir bajarilgani emas:

```bash
# pos_env — operator tanlagan mutlaq private fayl yo‘li, secret qiymati emas.
docker compose --env-file "$pos_env" -f docker-compose.yml -f docker-compose.release.yml -f docker-compose.maintenance.yml config --quiet
```

`config`ni --quiet ishlating; to‘liq rendered output credentiallarni ko‘rsatishi mumkin. Docker daemon vakolati credential va DB vakolati sifatida cheklansin; Compose environment secret store o‘rnini bosmaydi. Host va registryning aniq secret boshqaruvi tashqi muhit tasdiqlanganda qabul qilinadi.

[Release image xavfsizligi](release-image-security.md) release overlaydagi digest/non-root startup gate, read-only root, tmpfs va layered credential auditni tushuntiradi. Lokal isolated image qabulidan keyin ham haqiqiy registry, secret-store ACL va staging/production operator qabuli alohida qoladi.

## TLS va firewall

`ops/nginx/pos.conf.template` host-local reverse proxy uchun. Operator haqiqiy hostname, loopback app porti va mavjud certificate/private-key mutlaq yo‘llarini qo‘yadi; barcha __TOKEN__lar almashtirilmaguncha ishlatmang. `nginx -t` va certificate chain/hostname/expiry tekshiruvi **tanlangan nginx versiyasi va hostda** bajariladi. Hozir nginx o‘rnatilgani yoki domen/TLS ishlayotgani da’vo qilinmaydi. Template rasmiy [proxy](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) va [TLS](https://nginx.org/en/docs/http/ngx_http_ssl_module.html) direktivalari asosida tayyorlandi.

Ilova porti loopback; DB host porti umuman publish qilinmagan. Firewall faqat TLS ingress va operatorning cheklangan boshqaruv kirishini ochsin. TRUST_PROXY_IP faqat shu proxy forwarding headerlarni almashtirgani va appga bevosita tashqi kirish yopilgani sinovidan so‘ng true bo‘ladi. CDN/LB qo‘shilsa trusted chain alohida tekshiriladi. 12MiB proxy chegarasi fayl import/upload uchun tashqi admission, appdagi kichik JSON limitlari saqlanadi. Streaming uchun buffering off, API cache yo‘q, write upstream retry o‘chiq. Nginx error loglari private bo‘lsin; body/token logging qo‘shmang.

## Chiqarish va rollback

1. Tasdiqlangan source revision, immutable image digest, release ID, migration ro‘yxati va oldingi image digestni private release jurnaliga yozing. CI lint/typecheck/unit/integration/worker/build va secret scanner natijalari bo‘lsin. Build muvaffaqiyati real staging qabuli emas.
2. Stagingda yangi isolated database, alohida keys va operator-owned maintenance state bilan migration deploy, readiness, auth/MFA, cash sale/payment/stock/return/debt/shift, offline replay, job va export sinovlarini bajaring. Quyidagi command **faqat tanlangan va tasdiqlangan muhit** uchun:
   `docker compose --env-file "$pos_env" -f docker-compose.yml -f docker-compose.release.yml -f docker-compose.maintenance.yml --profile migration run --rm migrate`
3. Encrypted backup, manifest va alohida secret recovery nusxasi; checksum va fresh empty isolated restore tekshiruvi. [Restore quarantine](auth-restore-quarantine.md) operator reviewisiz target trafficga ochilmaydi.
4. Production uchun egadan alohida ruxsat oling. [Maintenance tartibi](maintenance.md) bilan barcha app/workerlarni drain qiling; non-durable CRUD ham hostda to‘xtasin. Aktiv transaction/lease holatini tekshiring, so‘ng alohida migration va immutable app/jobs/monitoring release. Ushbu qo‘llanma deploymentni o‘zi bajarmaydi.
5. TLS readiness va tenantlararo authorization, bir cash sale→exact replay→refund, shift/stock/ledger reconciliation, export va pending offline queue bo‘yicha smoke. Real biznesda test operatsiyasini mas’ul oldindan tasdiqlaydi; moliyaviy tarixni yashirin o‘chirmang.
6. Xato bo‘lsa trafficni to‘xtating. Avvalgi image faqat yangi schema bilan old/new compatibility test o‘tgan bo‘lsa qaytariladi. DBni avtomatik down-migrate yoki eski dump bilan overwrite qilmang. Restore zarur bo‘lsa yangi empty offline target, RPO data-loss tahlili, quarantine va operator credential/access review talab qilinadi. Navbat va provider unresolved natijalari qayta solishtiriladi; asl operation keys saqlanadi.

## Backup va monitoringni tayyorlash

`backup.sh` encrypted DB+manifest, `backup-secrets.sh` alohida explicit private recovery fayli, `restore.sh` faqat tasdiqlangan empty target. Recovery decryption key asosiy DB hostdan mustaqil vakolat bilan saqlanadi. Off-site storage tanlanmagani sabab nusxani tashqi servisga yuboruvchi adapter, manzil va muvaffaqiyat dalili yaratilmaydi.

`ops/systemd/` backup/uptime/disk service va timer namunalari hamda private env/account/path yo‘riqnomasi tayyor; o‘rnatilmagan.

Host scheduler konfiguratsiyasi tanlangan hostda operator tomonidan o‘rnatiladi: daily backup va secret backup (secret o‘zgarganda), periodic restore rehearsal, mustaqil uptime probe va DB/export/backup disk mountlarini host-health tekshirish. Interval/RPO/RTO va retention operatordan tasdiq oladi; synthetic48s restore real SLA emas. Failed yoki kechikkan backup, checksum/decrypt/restore xatosi, disk threshold, readiness outage, dead job va reconciliation incident uchun real mas’ul/on-call yetkazish sinovi kerak. [Monitoring core](monitoring.md) scriptlaridan foydalaning. Monitoring provayderi tanlanmaguncha delivery blocked_external; avtomatik backup deletion hozir yo‘q.

## Yakuniy readiness va pilot qabul

- [ ] Host/operator, domain/certificate chain, firewall va trusted proxy tasdiqlangan.
- [ ] Dev/staging/production database/keys/volumes/private files alohida; MFA enabled, platform recovery operatori bor.
- [ ] Real immutable image non-root startup, migrations va shared maintenance/readiness routing qabuldan o‘tgan.
- [ ] Cash POS, exact retry/concurrent stock/refund, permissions, offline sync, export, backup restore va app rollback stagingda dalillangan.
- [ ] Off-site encrypted backup/recovery key access, actual scheduler, RPO/RTO va monitoring alert mas’ulga yetkazilishi tekshirilgan.
- [ ] [Onboarding](onboarding-guide.md) bo‘yicha haqiqiy pilot xodim mustaqil ishlagan; sana/mas’ul/natija/defectlar haqiqiy protokolda.
- [ ] Vendor/fiscal/hardware integratsiyasiz ishlashning biznes/hujjat talabi egasi tomonidan tasdiqlangan; deferred adapterga fake production implementation yo‘q.
- [ ] Production deployment uchun alohida owner tasdig‘i yozilgan.

Bo‘sh checkboxlar tashqi qabul bo‘lmaganini bildiradi. Hozirgi original vazifalar STATUSda blocked_external yoki core in_progress bo‘lib qoladi; checklistni hujjat yozilgani uchungina belgilamang.
