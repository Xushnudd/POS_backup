# Monitoring core

Owner GET /api/monitoring,12/minute: faqat own tenant API counters va queued/
running/dead jobs, queued/running/unknown/review/failed provider counts. Payload,
lease token, proof/external ID, user va secret chiqarilmaydi. Live role/session
va tenant tekshiriladi; admin/cashier rad. Polling idle sessiyani uzaytirmaydi.
API metrikasi har processda512tenantgacha,5min non-overlapping window va fixed
latency buckets. Evicted/expired window available=false; bu traffic0 yoki cluster
aggregate dalili emas. Authsiz traffic tenantga yozilmaydi. Structured stdout
avvalgi requestId/tenant korrelyatsiyasini saqlaydi.

API500+, javob>=2s, DB round-trip>=500ms,5mindan ko‘p overdue job, dead job,
expired provider lease yoki unknown/review/failed result explicit alert code
beradi. Bu query observation; PostgreSQL serverining barcha global querylari
monitor qilinyapti degani emas. Provider registry bo‘sh, vendor latency/SDK yo‘q.
Monitoring iqtisodiy yozuv yoki provider execute/lookup bajarmaydi.

Provider worker haqiqiy tanlangan binding chaqirilganda `provider_transport`
structured stdout yozuvi chiqaradi: tenant/operation korrelyatsiyasi,
`payment|fiscal.submit|lookup`, safe outcome va millisekund davomiylik. Request,
raw provider code, exception message va external ID chiqmaydi. Log sink xatosi
settlement yoki retry qarorini o‘zgartirmaydi. Real binding yo‘qligida real vendor
latency o‘lchandi deb ko‘rsatilmaydi. Worker loglarini kuzatish appdagi process-local
API histogramidan alohida; ularni cluster aggregate deb qo‘shmang.

Alohida process/host: POS_PROBE_ORIGIN=https://your-approved-origin node
scripts/ops/uptime-probe.mjs. HTTP faqat loopback; redirect,credentials/query/path
rad,timeout5s,body1KiB. Ready200 + JSON status:ready talab; outage/non-ready
exit1 va safe code. App o‘chganida shu script ishlashi uchun ikkinchi hostdagi
scheduler/monitoringdan ishga tushiring. Secret, raw URL yoki response body logga
chiqmaydi. Self-signed TLSni productionda tekshirmasdan qabul qilish rejimi yo‘q.

Hostdagi haqiqiy data filesystem: POS_DATA_DIRECTORY=/your-data-mount node
scripts/ops/host-health.mjs. Default minfree1GiB va5%; operator
POS_DISK_MIN_FREE_BYTES/POS_DISK_MIN_FREE_PERCENT bilan o‘zgartiradi. statfs
BigInt/read-only, bad path/stats/error→safe HOST_DISK_UNAVAILABLE. Path va raw
filesystem error chiqarilmaydi. POS_DATA_DIRECTORY aynan DB/export/backuplar
joylashgan mount bo‘lsin; /tmp testi DB disk monitoringining o‘rnini bosmaydi.

API/probe JSONdagi alertni haqiqiy monitoring/on-call kanaliga ulash, scheduler,
backup mas’ul/escalation va external-host outage rehearsal hali tashqi operator
ishi. Script/unit/synthetic qabul borligi haqiqiy on-callga yetkazildi degani emas.
OPS-02.05 bu core bilan done bo‘lmaydi.

## 2026-10-16 lokal fault acceptance

`tests/monitoring.integration.test.ts`dagi uchta PostgreSQL testi owner/tenant
izolatsiyasi, sun’iy API503/3s, overdue/dead job, 650ms haqiqiy DB lock,
expired provider lease, test-only failed provider va buzilgan log sinkni tekshiradi.
Vendor endpoint yoki hardware protokoli ishlatilmaydi. Failed provider queued
holatni yashirmaydi: `PROVIDER_RECONCILIATION_REQUIRED` paydo bo‘ladi, payment va
inventory movement yozilmaydi. Transport logida maxfiy maydon yo‘qligi tekshiriladi.

`node scripts/ops/test-release-images.mjs` haqiqiy app image’ini alohida konteynerda
ishga tushiradi. Boshqa OS processidagi uptime CLI avval `UPTIME_READY`, auth
restore quarantine/yo‘q DB uchun `UPTIME_UNAVAILABLE`, app to‘xtatilganda esa
`UPTIME_UNREACHABLE` qaytaradi. Haqiqiy `statfs` uchun threshold available capacitydan
yuqoriga qo‘yilganda `HOST_DISK_LOW`, nol threshold bilan `HOST_DISK_READY` chiqadi;
host diski to‘ldirilmaydi. Bu disk test mountiga tegishli, mavjud biznes DB diskiga
nosozlik kiritilmaydi. Natija `tasks/evidence/release-images-20261016.json`da.

OPS-02.02ning sun’iy failure qabul mezoni shu lokal dalillar bilan bajarilgan.
Mustaqil haqiqiy hostga scheduler o‘rnatish, tanlangan disk mountlari, real on-call
yetkazish va production monitoring hali bajarilmagan; OPS-02.05/06 va
RELEASE-01.07 bundan avtomatik yopilmaydi.
