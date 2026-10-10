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
