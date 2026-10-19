import { readFileSync } from 'node:fs';

const states = { unknown: 'Holat tasdiqlanmagan', operational: 'Ishlayapti', degraded: 'Qisman uzilish', outage: 'Uzilish', maintenance: 'Texnik ishlar' };
const phases = { investigating: 'Tekshirilmoqda', identified: 'Sabab aniqlandi', monitoring: 'Kuzatilmoqda', resolved: 'Tiklandi' };
function keys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join() !== [...expected].sort().join()) throw Error('Invalid public status schema');
}
function text(value, max = 400) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f]/.test(value)) throw Error('Invalid public text');
}
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) throw Error('Invalid timestamp');
}
export function validate(data) {
  keys(data, ['version', 'updatedAt', 'validForMinutes', 'components', 'incidents']);
  if (data.version !== 1 || !Number.isInteger(data.validForMinutes) || data.validForMinutes < 1 || data.validForMinutes > 1440) throw Error('Invalid validity');
  timestamp(data.updatedAt);
  if (!Array.isArray(data.components) || data.components.length < 1 || data.components.length > 20 || !Array.isArray(data.incidents) || data.incidents.length > 100) throw Error('Invalid collection');
  const ids = new Set();
  for (const c of data.components) {
    keys(c, ['id', 'name', 'status']); text(c.name, 80);
    if (typeof c.id !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(c.id) || ids.has(c.id) || !Object.hasOwn(states, c.status)) throw Error('Invalid component');
    ids.add(c.id);
  }
  const incidentIds = new Set();
  for (const incident of data.incidents) {
    keys(incident, ['id', 'title', 'components', 'updates']); text(incident.title, 120);
    if (typeof incident.id !== 'string' || !/^[a-z0-9-]{1,60}$/.test(incident.id) || incidentIds.has(incident.id)) throw Error('Invalid incident id');
    incidentIds.add(incident.id);
    if (!Array.isArray(incident.components) || !incident.components.length || incident.components.some(id => !ids.has(id)) || new Set(incident.components).size !== incident.components.length) throw Error('Invalid incident components');
    if (!Array.isArray(incident.updates) || !incident.updates.length || incident.updates.length > 50) throw Error('Invalid timeline');
    let previous = -Infinity;
    let resolved = false;
    for (const update of incident.updates) {
      keys(update, ['at', 'phase', 'message']); timestamp(update.at); text(update.message);
      const at = Date.parse(update.at);
      if (!Object.hasOwn(phases, update.phase) || at <= previous || at > Date.parse(data.updatedAt) || resolved) throw Error('Invalid timeline order');
      previous = at; resolved = update.phase === 'resolved';
    }
    if (!resolved && incident.components.some(id => data.components.find(c => c.id === id).status === 'operational')) throw Error('Open incident cannot be operational');
  }
  return data;
}
export function load(path) {
  const raw = readFileSync(path);
  if (raw.length > 262144) throw Error('Public snapshot too large');
  return validate(JSON.parse(raw));
}
export function snapshot(data, now = Date.now()) {
  const age = now - Date.parse(data.updatedAt);
  const stale = age < 0 || age > data.validForMinutes * 60000;
  return { ...data, stale, components: data.components.map(c => ({ ...c, status: stale ? 'unknown' : c.status })) };
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function render(data) {
  return `<!doctype html><html lang="uz"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Shuni POS — xizmat holati</title><link rel="stylesheet" href="/style.css"><main><h1>Xizmat holati</h1><p>Oxirgi tasdiq: <time>${escape(data.updatedAt)}</time></p>${data.stale ? '<p role="status">Ma’lumot eskirgan yoki vaqti noto‘g‘ri. Joriy holat tasdiqlanmagan.</p>' : ''}<ul>${data.components.map(c => `<li><strong>${escape(c.name)}</strong><span>${states[c.status]}</span></li>`).join('')}</ul><h2>Hodisalar jurnali</h2>${data.incidents.length ? [...data.incidents].reverse().map(i => `<article><h3>${escape(i.title)}</h3><p>${escape(i.id)}</p><ol>${i.updates.map(u => `<li><time>${escape(u.at)}</time><strong>${phases[u.phase]}</strong><p>${escape(u.message)}</p></li>`).join('')}</ol></article>`).join('') : '<p>E’lon qilingan hodisalar yo‘q. Bu uzilish bo‘lmaganini tasdiqlamaydi.</p>'}<p>Holat mas’ul tomonidan yangilanadi. Sahifani yangilab tekshiring.</p></main></html>`;
}
