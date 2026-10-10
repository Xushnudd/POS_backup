import { pathToFileURL } from 'node:url'

export async function probe(origin, fetcher = fetch, timeoutMs = 5000) {
  const base = new URL(origin)
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/' ||
    (base.protocol !== 'https:' && !(base.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(base.hostname))))
    throw new Error('HTTPS origin without credentials/path required; HTTP allowed only on loopback')
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) throw new Error('INVALID_TIMEOUT')
  const started = performance.now()
  try {
    const response = await fetcher(new URL('/api/health/ready', base), {
      signal: AbortSignal.timeout(timeoutMs), redirect: 'error', headers: { accept: 'application/json' },
    })
    // Read at most 1 KiB; a broken/proxied endpoint must not exhaust the probe.
    const reader = response.body?.getReader()
    let size = 0, text = ''
    if (reader) {
      try {
        for (;;) {
          const part = await reader.read(); if (part.done) break
          size += part.value.byteLength
          if (size > 1024) { void reader.cancel().catch(() => undefined); throw new Error('PROBE_RESPONSE_TOO_LARGE') }
          text += new TextDecoder().decode(part.value)
        }
      } finally { reader.releaseLock() }
    }
    let ready = false
    try { ready = response.status === 200 && JSON.parse(text).status === 'ready' } catch { /* Untrusted response body never logged. */ }
    return { ready, code: ready ? 'UPTIME_READY' : 'UPTIME_UNAVAILABLE', durationMs: Math.round(performance.now() - started) }
  } catch {
    return { ready: false, code: 'UPTIME_UNREACHABLE', durationMs: Math.round(performance.now() - started) }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await probe(process.env.POS_PROBE_ORIGIN ?? '')
    console.log(JSON.stringify({ event: 'external_uptime_probe', ...result }))
    if (!result.ready) process.exitCode = 1
  } catch {
    console.error(JSON.stringify({ event: 'external_uptime_probe', code: 'INVALID_PROBE_CONFIG' }))
    process.exitCode = 2
  }
}
