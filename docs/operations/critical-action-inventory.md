# MFA xavfli amallar inventari

2026-10-11. `AUTH_CRITICAL_MFA_REQUIRED=true` markaziy siyosat, UI proof/retry va
operator restore gate tekshiriladi. Default false mavjud tashkilotlarning
factorlari ulanmagan holatda kutilmaganda bloklanmasligi uchun saqlanadi.
Production rollout deployment qarori: owner/operatorlar avval TOTP ulashi,
recovery kodlarni saqlashi, key overlap va restore tartibini bilishi kerak.

| Yo‘l | Ikkinchi faktor va mustaqil vakolat |
|---|---|
| Organization member create/update, role create/update, invitation create | Exact action/op UUID/payload MFA; owner+live tenant scope, coarse role va CustomRole permission qo‘shimcha tekshiruv |
| Ownership request/accept/cancel | Har tomon o‘z sessiyasi/proofi; last-owner va recipient guard; qabul session tokeni Operationga yozilmaydi |
| Billing plan publish/assign, invoice settlement, subscription cancellation, integration cost record/cancel | Markaziy MFA; tegishli owner yoki live platform grant; iqtisodiy source/ledger/idempotency guard saqlanadi |
| Retention policy publish, closure request/cancel | Markaziy MFA; owner/platform scope; closure/shift guard saqlanadi |
| Offline cash policy, support policy/grant | Markaziy MFA va tegishli owner/platform vakolati; grant expiration/revocation saqlanadi |
| Platform overview | Featureflagdan mustaqil majburiy exact MFA + live platform_admin + password session; cross-tenant result cache yo‘q |
| Owner/admin password change | Fresh current password + exact yangi parolga private HMAC bilan bog‘langan MFA; barcha sessiya/PIN revoke atomik; success old cookie qayta ishlamaydi |
| TOTP enrollment / backup-code rotation / recovery | Fresh current password; confirm/rotation yangi counter, recovery hashed one-use backup; faktor/sessionlar revoke; provisioning faqat original javobda |
| Operator rekey | HTTP emas: deployment key va live platform grant, explicit maintenance+DB confirmation; counts-only audit provenance; counter/backup saqlanadi |
| Restore/review | HTTP emas: confirmed empty offline DB, persistent karantin, barcha eski factor/session/takliflarni invalid qilish, operator credential/access reconciliation; review dalili immutable |

SaaS/public account boshlang‘ich ro‘yxatdan o‘tishi hali faktor yo‘q paytda
bootstrap oqimi hisoblanadi. Session issuance restore SQL gate’ga bo‘ysunadi.
Cashier o‘z PINini o‘rnatishi fresh password, cashier-only scope, rate limit va
PIN-session revoke bilan himoyalangan; owner/adminga PIN session berilmaydi.
Cashier oddiy password change fresh current password bilan qoladi.
Invitation revoke va session logout kabi accessni kamaytirish
amalining o‘zi yangi capability bermaydi; tegishli live owner/self scope mavjud.
Contact verification parol/session yoki biznes vakolatini o‘zi bermaydi; provider
bo‘lmasa fail closed. Real SMS/e-mail delivery blocked_external.

Oddiy sale/payment/refund/stock/shift mutation har qator uchun TOTP so‘ramaydi.
Ular mavjud role/store authorization, manager approval, transaction, operation
key, source va stock consistency guardlariga bo‘ysunadi. Permission proof
ularning birontasini almashtirmaydi. DB/schema/secret boshqaruvining OS/operator
vakolati API orqali berilmaydi; uning haqiqiy IAM/TLS rollout qabuli alohida OPS.

Markaziy ro‘yxat source: `src/server/auth/critical-actions.ts`, jami21 action;
platform overview alohida majburiy action. Yangi role/config/capability mutation
qo‘shilganda inventar, markaziy policy, UI action label va negative/rollback/replay
testlar birga yangilanadi. Noma’lum future endpointga CustomRole default deny.
