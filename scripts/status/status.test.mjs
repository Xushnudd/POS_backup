import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validate, snapshot, render } from '../../ops/status/status.mjs';
import { createStatusServer } from '../../ops/status/server.mjs';

const fixture = () => ({ version: 1, updatedAt: '2026-10-16T12:00:00.000Z', validForMinutes: 60, components: [{ id: 'pos', name: 'Savdo', status: 'operational' }], incidents: [] });
test('stale and future snapshots never assert operational status', () => {
  const data = validate(fixture());
  assert.equal(snapshot(data, Date.parse(data.updatedAt)).components[0].status, 'operational');
  for (const offset of [-1, 3600001]) assert.equal(snapshot(data, Date.parse(data.updatedAt) + offset).components[0].status, 'unknown');
});
test('public schema rejects private fields, duplicate IDs and unknown states', () => {
  for (const change of [d => { d.ticket = { email: 'private@example.invalid' }; }, d => d.components.push(d.components[0]), d => { d.components[0].status = '__proto__'; }, d => { d.validForMinutes = 999999; }]) {
    const data = fixture(); change(data); assert.throws(() => validate(data));
  }
});
test('incident ordering, component linkage and unresolved operational claims are enforced', () => {
  const data = fixture();
  data.incidents = [{ id: 'drill-1', title: 'Mashq', components: ['pos'], updates: [{ at: data.updatedAt, phase: 'investigating', message: 'Tekshiruv' }] }];
  assert.throws(() => validate(data));
  data.components[0].status = 'outage'; validate(data);
  data.incidents[0].updates.push({ ...data.incidents[0].updates[0] }); assert.throws(() => validate(data));
  data.incidents[0].updates.pop(); data.incidents[0].components = ['missing']; assert.throws(() => validate(data));
});
test('HTML escapes reviewed text instead of executing markup', () => {
  const data = fixture(); data.components[0].name = '<img src=x onerror=alert(1)>';
  const html = render(snapshot(validate(data), Date.parse(data.updatedAt)));
  assert.ok(!html.includes('<img')); assert.ok(html.includes('&lt;img'));
});
test('HTTP publication: HEAD, no private paths, no writes, atomic updates and corrupt-data fail closed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pos-status-'));
  const path = join(dir, 'public.json'); writeFileSync(path, JSON.stringify(fixture()));
  const server = createStatusServer(path);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(base); assert.equal(page.status, 200);
    assert.equal(page.headers.get('cache-control'), 'no-store');
    assert.ok(page.headers.get('content-security-policy').includes("default-src 'none'"));
    assert.equal(await (await fetch(base, { method: 'HEAD' })).text(), '');
    for (const route of ['/server.mjs', '/.env', '/incidents/private.md', '/%2e%2e/package.json']) assert.equal((await fetch(base + route)).status, 404);
    assert.equal((await fetch(base, { method: 'POST', body: 'mutation' })).status, 405);
    const next = fixture(); next.updatedAt = new Date().toISOString(); next.components[0].status = 'degraded';
    writeFileSync(path + '.next', JSON.stringify(next)); renameSync(path + '.next', path);
    assert.equal((await (await fetch(base + '/status.json')).json()).components[0].status, 'degraded');
    writeFileSync(path, '{broken');
    for (const route of ['/', '/status.json', '/healthz']) assert.equal((await fetch(base + route)).status, 503);
  } finally { await new Promise(resolve => server.close(resolve)); rmSync(dir, { recursive: true, force: true }); }
});
