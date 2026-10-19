try {
// Output is consumed inside a private temporary file, never printed to an operator log.
const url = new URL(process.env.POS_DATABASE_CONNECTION)
if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('PostgreSQL URL required')
const values = {
  PGHOST: url.hostname.replace(/^\[|\]$/g,''), PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
  PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGCONNECT_TIMEOUT: '10',
}
const parameters = { sslmode:'PGSSLMODE', sslrootcert:'PGSSLROOTCERT', sslcert:'PGSSLCERT', sslkey:'PGSSLKEY', connect_timeout:'PGCONNECT_TIMEOUT' }
for (const [key,value] of url.searchParams) {
  if (parameters[key]) values[parameters[key]]=value
  else if (!['schema','connection_limit','pool_timeout','pgbouncer'].includes(key)) throw new Error('Unsupported connection option')
}
if (!values.PGHOST || !values.PGDATABASE || !values.PGUSER) throw new Error('Connection host, database and user required')
for (const [key,value] of Object.entries(values)) {
  if (/[\0\r\n]/.test(value)) throw new Error('Invalid connection value')
  process.stdout.write(`${key}=${value}\0`)
}

} catch {
  console.error("PostgreSQL connection configuration invalid")
  process.exit(1)
}
