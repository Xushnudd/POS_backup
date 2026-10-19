import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load, snapshot, render } from './status.mjs';

const css = readFileSync(new URL('./style.css', import.meta.url));
export function createStatusServer(path) {
  load(path); // Reject invalid publication before listening.
  return createServer((req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const send = (status, type, body) => { res.writeHead(status, { 'Content-Type': type }); res.end(req.method === 'HEAD' ? undefined : body); };
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return send(405, 'text/plain', 'Method not allowed'); }
    if (req.url === '/style.css') return send(200, 'text/css; charset=utf-8', css);
    if (!['/', '/status.json', '/healthz'].includes(req.url)) return send(404, 'text/plain', 'Not found');
    try {
      const data = snapshot(load(path));
      if (req.url === '/healthz') return send(200, 'application/json', JSON.stringify({ statusServer: 'ok', stale: data.stale }));
      if (req.url === '/status.json') return send(200, 'application/json; charset=utf-8', JSON.stringify(data));
      return send(200, 'text/html; charset=utf-8', render(data));
    } catch { return send(503, 'text/plain; charset=utf-8', 'Holat ma’lumoti mavjud emas.'); }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8091);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid PORT');
  const path = process.env.STATUS_FILE ?? fileURLToPath(new URL('./public-status.json', import.meta.url));
  const server = createStatusServer(path);
  server.listen(port, process.env.HOST ?? '127.0.0.1', () => console.log('Status server listening'));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { server.close(); server.closeIdleConnections(); setTimeout(() => process.exit(0), 5000).unref(); });
}
