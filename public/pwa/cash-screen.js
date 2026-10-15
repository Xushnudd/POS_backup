import { ownedErrorMessage } from './messages.js';
import { t, messageText, currentLocale } from './static-locale.js';
import { formatLocaleMoney, formatLocaleDate } from './format.js';
import { listCashTickets, unlockCashTicket, takeOfflineCash, readCashAction, acknowledgeCash, observeCashClock } from './cash-store.js';
import { usableCashTicket } from './cash-crypto.js';
const selector = document.querySelector('#ticket'), phrase = document.querySelector('#phrase'), tender = document.querySelector('#tender'), message = document.querySelector('#message'), details = document.querySelector('#details'), take = document.querySelector('#take'), sync = document.querySelector('#sync');
let ticket, stored, busy = false, clockFailed = false;
let currentMessage = '', currentValues;
const show = (text, values) => { currentMessage = text; currentValues = values; message.textContent = values ? t(text, { ...values, ...(typeof values.error === 'string' ? { error: messageText(values.error) } : {}) }) : messageText(text); };
const stateLabel = (state) => t({ unused: 'Ishlatilmagan', pending: 'Javob kutilmoqda', synced: 'Server tasdiqlagan', conflict: 'Qo‘lda tekshirish kerak', cancelled: 'Bekor qilingan' }[state]);
async function inventory() { const selected = selector.value, rows = await listCashTickets(); selector.replaceChildren(new Option(t('Ruxsatni tanlang'), ''), ...rows.filter(r => r.deviceId === localStorage.getItem('pos_device_id')).map(r => new Option(r.id + ' · ' + stateLabel(r.state), r.id))); selector.value = selected; }
async function render() { if (!ticket || !stored)
    return; const action = await readCashAction(stored.cashOperationId); details.replaceChildren(); for (const text of [...ticket.payload.items.map(i => i.name + ' · ' + i.quantity + ' ' + i.unit + ' · ' + i.unitPrice), t('Jami:') + ' ' + formatLocaleMoney(ticket.payload.totalAmount, currentLocale()), t('Muddati:') + ' ' + formatLocaleDate(ticket.payload.expiresAt, currentLocale(), true, 'UTC') + ' UTC', t('Holat:') + ' ' + stateLabel(stored.state), ...(action ? [t('Olingan naqd:') + ' ' + formatLocaleMoney(action.cashTendered, currentLocale()), t('Qaytim:') + ' ' + formatLocaleMoney(action.cashChange, currentLocale()), t('Original amal:') + ' ' + action.id] : []), ...(stored.result ? [t('Server natijasi:') + ' ' + JSON.stringify(stored.result)] : [])]) {
    const p = document.createElement('p');
    p.textContent = text;
    details.append(p);
} take.disabled = busy || clockFailed || stored.state !== 'unused' || !usableCashTicket(ticket, Date.now(), stored.lastSeen); sync.disabled = busy || !['pending', 'conflict', 'unused'].includes(stored.state); }
async function refresh() { if (!stored)
    return; stored = (await listCashTickets()).find(r => r.id === stored.id); await render(); }
selector.onchange = () => { ticket = undefined; stored = undefined; details.replaceChildren(); take.disabled = true; sync.disabled = true; phrase.value = ''; show('Unlock iborasini kiriting'); };
document.querySelector('#unlock').onclick = async () => { if (busy)
    return; busy = true; try {
    const result = await unlockCashTicket(selector.value, phrase.value);
    phrase.value = '';
    ticket = result.ticket;
    stored = result.stored;
    clockFailed = false;
    await observeCashClock(stored.id);
    await refresh();
    show('Faqat shu savat uchun bir marta naqd pul qabul qilinadi.');
}
catch (e) {
    show(ownedErrorMessage(e, 'Ruxsat ochilmadi'));
}
finally {
    busy = false;
    await render();
} };
take.onclick = async () => { if (busy || !ticket || !stored)
    return; busy = true; take.disabled = true; try {
    await takeOfflineCash(ticket, tender.value);
    show('Naqd qabul lokal saqlandi. SERVER TASDIQLAMAGAN: aloqada original amalni sinxronlang. Qayta pul olmang.');
    await refresh();
}
catch (e) {
    show(ownedErrorMessage(e, 'Naqd amal saqlanmadi'));
}
finally {
    busy = false;
    await render();
} };
sync.onclick = async () => { if (busy || !ticket || !stored)
    return; busy = true; try {
    const response = await fetch('/api/offline-cash/' + stored.id, { credentials: 'same-origin', cache: 'no-store' }), body = await response.json();
    if (!response.ok)
        throw new Error('Asl sessiyada kirib server natijasini tekshiring');
    const proof = body.data;
    if (proof.leaseId !== stored.id || proof.cashOperationId !== stored.cashOperationId || proof.organizationId !== stored.organizationId || proof.userId !== stored.userId || proof.deviceId !== stored.deviceId)
        throw new Error('Server proof original ruxsatga mos emas');
    if (proof.state === 'cancelled') {
        await acknowledgeCash(stored.id, 'cancelled', { leaseId: proof.leaseId, cashOperationId: proof.cashOperationId, state: 'cancelled', approvedBy: proof.proof?.approvedBy });
        show('Rahbar original pul/tovar natijasini hal qilgan. Yangi pul olmang.');
    }
    else if (proof.state === 'consumed') {
        if (proof.saleId !== ticket.payload.saleId)
            throw new Error('Asl chek server proofga mos emas');
        await acknowledgeCash(stored.id, 'synced', { saleId: proof.saleId, state: 'consumed' });
        show('Asl chek serverda yakunlangan. Yangi pul olmang.');
    }
    else {
        const action = await readCashAction(stored.cashOperationId);
        if (!action)
            throw new Error('Pul olinmagan. Ishlatilmagan ticketni rahbar bilan bekor qiling.');
        const result = await fetch('/api/sync', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ commands: [{ operationId: action.id, type: 'offline.cash', payload: { leaseId: action.leaseId, deviceId: action.deviceId, cashTendered: action.cashTendered } }] }) });
        const reply = await result.json();
        if (!result.ok)
            throw new Error('Server sinxronizatsiyasi rad');
        const ack = reply.data?.[0];
        if (reply.data?.length !== 1 || ack?.operationId !== action.id || !['synced', 'conflict', 'pending'].includes(ack.state))
            throw new Error('Server acknowledgement noto‘g‘ri');
        if (ack.state === 'synced' && (ack.result?.id !== ticket.payload.saleId || ack.result?.status !== 'completed' || ack.result?.organizationId !== stored.organizationId))
            throw new Error('Original chek acknowledgement mos emas');
        if (ack.state !== 'pending')
            await acknowledgeCash(stored.id, ack.state, ack.state === 'synced' ? { saleId: ack.result.id, receiptNo: ack.result.receiptNo, totalAmount: ack.result.totalAmount, cashChange: ack.result.cashChange } : undefined, ack.code);
        if (ack.state === 'conflict')
            show('Konflikt: {code}. Rahbar pul/tovar natijasini tekshirsin; qayta pul olmang.', { code: ack.code ?? '' });
        else
            show(ack.state === 'synced' ? 'Original naqd savdo serverda yakunlandi.' : 'Natija noma’lum; original amalni saqlang va yana tekshiring.');
    }
    await refresh();
}
catch (e) {
    show('{error}; original amal saqlangan. Yangi pul olmang; natijani yana tekshiring.', { error: ownedErrorMessage(e, 'Server bilan aloqa yo‘q') });
}
finally {
    busy = false;
    await render();
} };
setInterval(() => { if (!ticket || !stored || stored.state !== 'unused' || busy)
    return; void observeCashClock(stored.id).then(refresh).catch(() => { clockFailed = true; take.disabled = true; show('Qurilma vaqti tekshirilmadi; offline naqd qabul bloklandi'); }); }, 1000);
void inventory().catch(() => show('Lokal offline ruxsatlar yuklanmadi'));
window.addEventListener('pos:display-locale', () => { show(currentMessage, currentValues); void inventory(); void render(); });
