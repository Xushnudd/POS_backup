const encode = (bytes) => btoa(Array.from(bytes, b => String.fromCharCode(b)).join(''));
const decode = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export function stableJSON(value) { if (Array.isArray(value))
    return '[' + value.map(stableJSON).join(',') + ']'; if (value !== null && typeof value === 'object')
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stableJSON(value[key])).join(',') + '}'; return JSON.stringify(value); }
export function ticketMessage(payload) { return stableJSON(payload); }
export async function verifyCashTicket(ticket) { try {
    const key = await crypto.subtle.importKey('jwk', ticket.publicKey, { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, decode(ticket.signature), new TextEncoder().encode(ticketMessage(ticket.payload)));
}
catch {
    return false;
} }
async function encryptionKey(phrase, salt) { if (phrase.length < 12 || phrase.length > 200)
    throw new Error('Unlock iborasi 12–200 belgidan iborat bo‘lsin'); const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(phrase), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: new Uint8Array(salt), iterations: 210000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); }
export async function encryptCashTicket(ticket, phrase) { if (!await verifyCashTicket(ticket))
    throw new Error('Offline ruxsat imzosi noto‘g‘ri'); const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), key = await encryptionKey(phrase, salt), ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(ticket))); return { version: 1, salt: encode(salt), iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)), iterations: 210000 }; }
export async function decryptCashTicket(value, phrase) { if (value.version !== 1 || value.iterations !== 210000 || value.ciphertext.length > 100000)
    throw new Error('Offline format qo‘llanmaydi'); const salt = decode(value.salt), iv = decode(value.iv); if (salt.length !== 16 || iv.length !== 12)
    throw new Error('Offline format noto‘g‘ri'); try {
    const key = await encryptionKey(phrase, salt), plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, decode(value.ciphertext)), ticket = JSON.parse(new TextDecoder().decode(plain));
    if (!await verifyCashTicket(ticket))
        throw new Error('Signature');
    return ticket;
}
catch {
    throw new Error('Unlock iborasi yoki offline ruxsat noto‘g‘ri');
} }
export function offlineCashAmount(total, tender) { const cents = (v) => { if (!/^\d{1,12}(\.\d{1,2})?$/.test(v))
    throw new Error('Naqd summa ikki kasrli musbat son bo‘lsin'); const [whole, fraction = ''] = v.split('.'); return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, '0')); }; const applied = cents(total), given = cents(tender); if (applied <= BigInt(0) || given < applied)
    throw new Error('Berilgan naqd pul savdo summasidan kam'); const difference = given - applied; return { cashTendered: (given / BigInt(100)) + '.' + (given % BigInt(100)).toString().padStart(2, '0'), cashChange: (difference / BigInt(100)) + '.' + (difference % BigInt(100)).toString().padStart(2, '0') }; }
export function usableCashTicket(ticket, now, seen, device = localStorage.getItem('pos_device_id')) { const p = ticket.payload, issued = Date.parse(p.issuedAt), expiry = Date.parse(p.expiresAt); return p.version === 1 && Number.isFinite(now) && Number.isFinite(issued) && Number.isFinite(expiry) && now >= issued && now >= seen && now < expiry && expiry - issued <= 300000 && p.deviceId === device; }
