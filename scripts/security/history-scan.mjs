import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findings } from './scan.mjs';

// Read only objects reachable from local refs; never fetch or contact a remote.
export function scanHistory(root, limits = {}) {
  const maxBlobBytes = limits.maxBlobBytes ?? 4 * 1024 * 1024;
  const maxTotalBytes = limits.maxTotalBytes ?? 256 * 1024 * 1024;
  const maxBlobs = limits.maxBlobs ?? 20000;
  for (const value of [maxBlobBytes, maxTotalBytes, maxBlobs]) {
    if (!Number.isSafeInteger(value) || value < 1) throw Error('Invalid scan budget');
  }
  const git = (args, options = {}) => execFileSync('git', args, {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'], ...options,
  });
  const objectRows = git(['rev-list', '--objects', '--all']).trim().split('\n').filter(Boolean);
  const objects = new Map();
  for (const row of objectRows) {
    const match = /^([a-f0-9]{40,64})(?: (.*))?$/.exec(row);
    if (!match) throw Error('Invalid object inventory');
    objects.set(match[1], match[2] ?? null);
  }
  const metadata = objects.size ? git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], { input: [...objects.keys()].join('\n') + '\n' }) : '';
  const results = [], skipped = [];
  let scanned = 0, bytes = 0, binary = 0, blobs = 0;
  for (const line of metadata.trim().split('\n').filter(Boolean)) {
    const match = /^([a-f0-9]{40,64}) (blob|tree|commit|tag) (\d+)$/.exec(line);
    if (!match) throw Error('Invalid object metadata');
    const [, object, type, rawSize] = match;
    if (type !== 'blob') continue;
    blobs++;
    const size = Number(rawSize), file = objects.get(object);
    if (!Number.isSafeInteger(size)) throw Error('Invalid blob size');
    // Report historical credential-store paths without reading their contents.
    if (file && ((/(^|\/)\.env(?:$|[._])/.test(file) && !file.endsWith('.example')) || /\.(pem|key|p12|pfx)$/i.test(file))) {
      results.push({ object, file, line: 0, kind: 'historical_credential_store' });
      continue;
    }
    if (size > maxBlobBytes || bytes + size > maxTotalBytes || scanned + binary >= maxBlobs) {
      skipped.push({ object, file, size, reason: size > maxBlobBytes ? 'blob_size_limit' : 'scan_budget' });
      continue;
    }
    const buffer = git(['cat-file', 'blob', object], { encoding: null, maxBuffer: maxBlobBytes + 1 });
    bytes += buffer.length;
    if (buffer.includes(0)) { binary++; continue; }
    scanned++;
    for (const item of findings(buffer.toString('utf8'))) results.push({ object, file, ...item });
  }
  return {
    version: 1, scanned, binary, blobs, bytes, findings: results, skipped,
    complete: skipped.length === 0,
    scope: 'Local refs reachable blobs only; no network, reflogs, unreachable objects, LFS payloads, archives or image CVEs. File is one Git inventory path per object, not every occurrence. Credential-store paths reported without reading contents. Binary blobs excluded. Known token patterns only.',
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = scanHistory(process.cwd());
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.findings.length ? 1 : result.complete ? 0 : 2;
  } catch {
    // Git errors can include file contents; do not print exceptions/stderr.
    console.error('Local history scan failed; no file content logged');
    process.exitCode = 2;
  }
}
