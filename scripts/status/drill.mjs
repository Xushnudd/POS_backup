import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync, writeFileSync, renameSync, rmSync, readFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const engine = process.env.CONTAINER_ENGINE ?? 'docker';
const image = process.env.STATUS_IMAGE ?? 'localhost/pos-status:ops0206';
const dir = mkdtempSync(join(tmpdir(), 'pos-status-drill-'));
chmodSync(dir, 0o755); // Public synthetic snapshot must be readable by container's non-root user.
const name = `pos-status-drill-${process.pid}`;
const events = [];
const children = [];
let started = false;
const run = args => {
  const r = spawnSync(engine, args, { encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0) throw Error(`Container command failed: ${args[0]} ${r.stderr}`);
  return r.stdout.trim();
};
async function port() {
  const s = createServer(); await new Promise(r => s.listen(0, '127.0.0.1', r));
  const p = s.address().port; await new Promise(r => s.close(r)); return p;
}
async function ready(url) {
  for (let n = 0; n < 60; n++) {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(1000) }); if (r.ok) return r; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw Error('Service did not become ready');
}
function start(args, env = {}) {
  const child = spawn(process.execPath, args, { env: { ...process.env, ...env }, stdio: 'ignore' });
  children.push(child); return child;
}
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const done = new Promise(r => child.once('exit', r)); child.kill('SIGTERM'); await done;
}
const data = { version: 1, updatedAt: new Date().toISOString(), validForMinutes: 60, components: [{ id: 'pos', name: 'Sintetik mashq xizmati', status: 'unknown' }], incidents: [] };
function publish() {
  data.updatedAt = new Date().toISOString();
  writeFileSync(join(dir, 'public.json.next'), JSON.stringify(data));
  renameSync(join(dir, 'public.json.next'), join(dir, 'public.json'));
}
async function phase(phase, status, message) {
  await new Promise(r => setTimeout(r, 5));
  const at = new Date().toISOString();
  data.components[0].status = status;
  data.incidents[0].updates.push({ at, phase, message }); publish(); events.push({ at, phase, message });
}
try {
  publish();
  const nativePort = await port(); const appPort = await port(); const containerPort = await port();
  const native = start([resolve('ops/status/server.mjs')], { PORT: String(nativePort), STATUS_FILE: join(dir, 'public.json') });
  const app = start(['--input-type=module', '-e', `import{createServer}from'node:http';createServer((q,s)=>s.end('synthetic service')).listen(${appPort},'127.0.0.1')`]);
  await ready(`http://127.0.0.1:${appPort}`); await ready(`http://127.0.0.1:${nativePort}`);
  run(['run', '-d', '--name', name, '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit=64', '--memory=128m', '-p', `127.0.0.1:${containerPort}:8091`, '-v', `${dir}:/status-data:ro,Z`, '-e', 'STATUS_FILE=/status-data/public.json', image]); started = true;
  await ready(`http://127.0.0.1:${containerPort}`);
  const inspect = JSON.parse(run(['inspect', name]))[0];
  assert.equal(inspect.Config.User, 'node'); assert.equal(inspect.HostConfig.ReadonlyRootfs, true);
  await stop(app);
  await assert.rejects(() => fetch(`http://127.0.0.1:${appPort}`, { signal: AbortSignal.timeout(1000) }));
  data.incidents = [{ id: 'local-process-drill', title: 'Mahalliy sintetik uzilish mashqi', components: ['pos'], updates: [] }];
  await phase('investigating', 'outage', 'Sintetik xizmat to‘xtatildi; holat sahifasi tekshirilmoqda.');
  for (const p of [nativePort, containerPort]) {
    const r = await fetch(`http://127.0.0.1:${p}/status.json`); assert.equal(r.status, 200);
    assert.equal((await r.json()).components[0].status, 'outage');
  }
  await phase('identified', 'outage', 'Sabab: mashq davomida alohida test jarayoniga SIGTERM yuborildi.');
  const recovered = start(['--input-type=module', '-e', `import{createServer}from'node:http';createServer((q,s)=>s.end('synthetic service')).listen(${appPort},'127.0.0.1')`]);
  await ready(`http://127.0.0.1:${appPort}`);
  await phase('monitoring', 'degraded', 'Test jarayoni qayta ishga tushdi; HTTP javobi tekshirildi.');
  await phase('resolved', 'operational', 'Sintetik xizmat qayta ochildi. Real POS yoki hosting sinovi emas.');
  for (const p of [nativePort, containerPort]) {
    const html = await (await fetch(`http://127.0.0.1:${p}`)).text(); assert.ok(html.includes('Tiklandi'));
  }
  assert.equal(run(['exec', name, 'node', '-e', "const fs=require('fs');try{fs.writeFileSync('/status/write-probe','x');process.exit(1)}catch(e){if(e.code!=='EROFS')process.exit(2)}console.log('read-only')"]), 'read-only');
  const health = run(['healthcheck', 'run', name]);
  const sources = {};
  for (const path of ['ops/status/server.mjs', 'ops/status/status.mjs', 'ops/status/Dockerfile', 'ops/status/style.css', 'docker-compose.status.yml', 'scripts/status/drill.mjs', 'scripts/status/status.test.mjs']) sources[path] = createHash('sha256').update(readFileSync(path)).digest('hex');
  writeFileSync('tasks/evidence/status186/drill.json', JSON.stringify({ date: new Date().toISOString(), scope: 'local_native_and_oci_synthetic_process_drill', node: process.version, engine, imageId: inspect.Image, native: 'pass', container: 'pass', independentDuringSyntheticOutage: true, nonRoot: true, readOnly: true, healthcheck: health || 'pass', events, sources, limits: ['No actual remote hosting/domain/TLS or real POS outage.', 'Linux Node24 and Podman tested; Windows/macOS and Docker Engine not executed.', 'No business data or existing done feature tested or changed.'] }, null, 2) + '\n');
  writeFileSync('tasks/evidence/status186/public-drill.json', JSON.stringify(data, null, 2) + '\n');
  await stop(recovered); await stop(native);
  console.log('Native + container + independent outage/timeline + read-only/health: PASS');
} finally {
  for (const child of children) await stop(child);
  if (started) run(['rm', '-f', name]);
  rmSync(dir, { recursive: true, force: true });
}
