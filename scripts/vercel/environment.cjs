// Validate deployment settings without printing connection strings or keys.
const { isIP } = require('node:net');

function localHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  return host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
    || host === '::1' || host === '0.0.0.0' || host.startsWith('127.')
    || (!isIP(host) && !host.includes('.'));
}

function validateVercelEnvironment(environment, nodeVersion = process.versions.node) {
  if (Number(nodeVersion.split('.')[0]) !== 24) throw new Error('Vercel requires Node.js 24.x for this project.');
  if (environment.NODE_ENV && environment.NODE_ENV !== 'production') {
    throw new Error('Remove the local NODE_ENV override from Vercel; the web build runs in production mode.');
  }
  if (!environment.DATABASE_URL) throw new Error('Set the private DATABASE_URL in Vercel Environment Variables.');
  let database;
  try { database = new URL(environment.DATABASE_URL); }
  catch { throw new Error('DATABASE_URL must be a valid private PostgreSQL connection string.'); }
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname || !database.pathname.slice(1)) {
    throw new Error('DATABASE_URL must reference PostgreSQL and a database name.');
  }
  if (localHost(database.hostname)) {
    throw new Error('DATABASE_URL points to a local Docker/workstation database. Use the hosted database URL in Vercel.');
  }
  if (database.hostname.endsWith('.neon.tech') && !['require', 'verify-ca', 'verify-full'].includes(database.searchParams.get('sslmode'))) {
    throw new Error('Keep the TLS sslmode parameter from the official Neon connection string.');
  }
  if (!environment.APP_ORIGIN) {
    throw new Error('Set APP_ORIGIN to the exact HTTPS site origin in Vercel, without a trailing slash.');
  }
  let origin;
  try { origin = new URL(environment.APP_ORIGIN); }
  catch { throw new Error('APP_ORIGIN must be a valid HTTPS site origin.'); }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.search || origin.hash
    || environment.APP_ORIGIN !== origin.origin || localHost(origin.hostname)) {
    throw new Error('APP_ORIGIN must be the public HTTPS site origin, without credentials, path, query, fragment or trailing slash.');
  }
}

module.exports = { validateVercelEnvironment };
