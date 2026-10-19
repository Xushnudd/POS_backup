import {spawn} from 'node:child_process'
import {createHash} from 'node:crypto'
import {constants,openSync,closeSync,readFileSync,writeFileSync,fstatSync} from 'node:fs'
import {createInterface} from 'node:readline'
import {pathToFileURL} from 'node:url'

const identifier=/^[A-Za-z_][A-Za-z0-9_]*$/
const quote=name=>{if(typeof name!=='string'||!identifier.test(name))throw new Error('DATASET_IDENTIFIER_INVALID');return '"'+name+'"'}
export function connectionEnvironment(input,environment=process.env){
 let url
 try{url=new URL(input)}catch{throw new Error('DATASET_CONNECTION_INVALID')}
 if(!['postgresql:','postgres:'].includes(url.protocol)||!url.hostname||!url.username||!url.pathname.slice(1)||url.hash)throw new Error('DATASET_CONNECTION_INVALID')
 const env={...environment,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGCONNECT_TIMEOUT:'10',PGOPTIONS:'-c default_transaction_read_only=on -c statement_timeout=60000 -c lock_timeout=5000 -c timezone=UTC'}
 const options={sslmode:'PGSSLMODE',sslrootcert:'PGSSLROOTCERT',sslcert:'PGSSLCERT',sslkey:'PGSSLKEY'}
 for(const [key,value] of url.searchParams){if(options[key])env[options[key]]=value;else if(!['schema','connection_limit','pool_timeout','pgbouncer'].includes(key))throw new Error('DATASET_CONNECTION_INVALID')}
 for(const key of ['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE'])if(/[\0\r\n]/.test(env[key]))throw new Error('DATASET_CONNECTION_INVALID')
 return env
}
export function validateProjection(tables){
 if(!Array.isArray(tables)||!tables.length||tables.length>1000)throw new Error('DATASET_MANIFEST_INVALID')
 const names=new Set()
 for(const t of tables){
  quote(t.name);if(names.has(t.name))throw new Error('DATASET_MANIFEST_INVALID');names.add(t.name)
  if(!Array.isArray(t.columns)||!t.columns.length||t.columns.length>200||!Array.isArray(t.key))throw new Error('DATASET_MANIFEST_INVALID')
  const columns=new Set();for(const c of t.columns){quote(c.name);if(columns.has(c.name)||typeof c.type!=='string')throw new Error('DATASET_MANIFEST_INVALID');columns.add(c.name)}
  if(t.key.some(k=>!columns.has(k))||new Set(t.key).size!==t.key.length)throw new Error('DATASET_MANIFEST_INVALID')
 }
 return tables
}
export function projectionSql(t){
 const fields=t.columns.map(c=>c.type==='numeric'?`to_jsonb(trim_scale(${quote(c.name)}))`:`to_jsonb(${quote(c.name)})`)
 // COPY streams through libpq; SELECT would buffer the full table in psql.
 // JSON escapes control characters, so tab separators/control-A CSV quotes
 // cannot collide with record text. Hash exact decimals without JSON.parse.
 return `COPY (SELECT '${t.name}',jsonb_build_array(${fields.join(',')})::text FROM public.${quote(t.name)} ORDER BY ${t.key.length?t.key.map(quote).join(','):`jsonb_build_array(${fields.join(',')})::text COLLATE "C"`}) TO STDOUT WITH (FORMAT csv, DELIMITER E'\\t', QUOTE E'\\x01');`
}
const schemaSql=`SELECT jsonb_agg(jsonb_build_object('name',t.table_name,'columns',(SELECT jsonb_agg(jsonb_build_object('name',c.column_name,'type',c.data_type) ORDER BY c.ordinal_position) FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=t.table_name),'key',(SELECT jsonb_agg(a.attname ORDER BY k.ordinality) FROM pg_index i JOIN pg_class r ON r.oid=i.indrelid JOIN pg_namespace n ON n.oid=r.relnamespace CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum,ordinality) JOIN pg_attribute a ON a.attrelid=r.oid AND a.attnum=k.attnum WHERE n.nspname='public' AND r.relname=t.table_name AND i.indisprimary)) ORDER BY t.table_name) FROM information_schema.tables t WHERE t.table_schema='public' AND t.table_type='BASE TABLE' AND t.table_name<>'_prisma_migrations';`
async function query(env,sql,onLine){
 const docker=env.POS_MIGRATION_PG_MODE==='isolated_docker'
 if(docker&&(env.PGHOST!=='127.0.0.1'||env.PGPORT!=='55439'||env.PGUSER!=='pos_test'||!/^pos_(test|dataset_[a-z]+_[0-9a-f]+)$/.test(env.PGDATABASE)))throw new Error('DATASET_ISOLATION_REQUIRED')
 const args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1']
 const child=spawn(docker?'docker':'psql',docker?['exec','-i','-e','PGOPTIONS','pos-plan-test-db','psql','-U','pos_test','-d',env.PGDATABASE,...args]:args,{env,stdio:['pipe','pipe','pipe']})
 // Native errors can include SQL data or connection credentials. Never forward them.
 child.stderr.resume();child.stdin.on('error',()=>{});child.stdin.end(sql)
 let failed=false,lineFailure
 const lines=createInterface({input:child.stdout,crlfDelay:Infinity})
 lines.on('line',line=>{if(failed||!line)return;try{onLine(line)}catch(e){failed=true;lineFailure=e;child.kill()}})
 await new Promise((resolve,reject)=>{child.once('error',()=>reject(new Error('DATASET_QUERY_FAILED')));child.once('close',code=>code===0&&!failed?resolve():reject(lineFailure??new Error('DATASET_QUERY_FAILED')))})
}
function begin(){return `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL TIME ZONE 'UTC'; SET LOCAL extra_float_digits=3;\n`}
export async function captureDataset(env,projection){
 let schema
 await query(env,begin()+schemaSql+'\nCOMMIT;',line=>{schema=JSON.parse(line)})
 schema=schema.map(t=>({...t,key:t.key??[]}))
 validateProjection(schema)
 const tables=validateProjection(projection??schema)
 for(const t of tables){const actual=schema.find(s=>s.name===t.name);if(!actual||JSON.stringify(actual.key)!==JSON.stringify(t.key)||t.columns.some(c=>!actual.columns.some(a=>a.name===c.name&&a.type===c.type)))throw new Error('DATASET_SCHEMA_INCOMPATIBLE')}
 const state=new Map(tables.map(t=>[t.name,{count:0,hash:createHash('sha256')}]))
 let asOf,platform
 await query(env,begin()+`SELECT 'snapshot\t'||transaction_timestamp()::text; SELECT 'platform\t'||jsonb_build_object('encoding',pg_encoding_to_char(encoding),'collation',datcollate,'ctype',datctype,'serverMajor',current_setting('server_version_num')::int/10000)::text FROM pg_database WHERE datname=current_database();\n`+tables.map(projectionSql).join('\n')+'\nCOMMIT;',line=>{
  const separator=line.indexOf('\t'),name=line.slice(0,separator),record=line.slice(separator+1)
  if(name==='snapshot'){asOf=record;return}
  if(name==='platform'){platform=JSON.parse(record);return}
  const table=state.get(name);if(!table||separator<0)throw new Error('DATASET_OUTPUT_INVALID')
  table.count++;table.hash.update(record+'\n')
 })
 if(!asOf)throw new Error('DATASET_OUTPUT_INVALID')
 return {version:1,asOf,platform,tables:tables.map(t=>({...t,rows:state.get(t.name).count,sha256:state.get(t.name).hash.digest('hex')}))}
}
export async function reconcileDataset(env){
 let result
 await query(env,readFileSync(new URL('./migration-reconcile.sql',import.meta.url),'utf8'),line=>{result=JSON.parse(line)})
 if(!result)throw new Error('DATASET_OUTPUT_INVALID')
 return result
}
export function compareDatasets(before,after){
 if(before.version!==1||after.version!==1)throw new Error('DATASET_MANIFEST_INVALID')
 validateProjection(before.tables);validateProjection(after.tables)
 const changes=[]
 if(JSON.stringify(before.platform)!==JSON.stringify(after.platform))throw new Error('DATASET_PLATFORM_INCOMPATIBLE')
 for(const t of before.tables){const a=after.tables.find(row=>row.name===t.name);if(!Number.isSafeInteger(t.rows)||t.rows<0||!/^[a-f0-9]{64}$/.test(t.sha256))throw new Error('DATASET_MANIFEST_INVALID');if(!a||a.rows!==t.rows||a.sha256!==t.sha256)changes.push({table:t.name,expectedRows:t.rows,actualRows:a?.rows??null,contentChanged:a?.sha256!==t.sha256})}
 return {preserved:changes.length===0,tables:before.tables.length,rows:before.tables.reduce((sum,t)=>sum+t.rows,0),changes}
}
function privateRead(path){const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const stat=fstatSync(fd);if(!stat.isFile()||stat.size>2*1024*1024||(stat.mode&0o077))throw new Error('DATASET_PRIVATE_FILE_REQUIRED');return JSON.parse(readFileSync(fd,'utf8'))}finally{closeSync(fd)}}
function privateWrite(path,value){const fd=openSync(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n')}finally{closeSync(fd)}}
async function main(){
 const [command,input,report,...extra]=process.argv.slice(2)
 if(extra.length||!input||!['capture','verify'].includes(command)||(command==='verify'&&!report)||(command==='capture'&&report))throw new Error('DATASET_USAGE_INVALID')
 if(process.env.MIGRATION_SOURCE_QUIESCED!=='true')throw new Error('DATASET_QUIESCENCE_REQUIRED')
 const env=connectionEnvironment(process.env.DATABASE_URL)
 if(command==='capture'){const ledger=await reconcileDataset(env);privateWrite(input,{...await captureDataset(env),ledger});console.info('PASS: private baseline captured; no database changes');return}
 const baseline=privateRead(input);if(baseline.version!==1)throw new Error('DATASET_MANIFEST_INVALID');validateProjection(baseline.tables)
 const after=await captureDataset(env,baseline.tables),comparison=compareDatasets(baseline,after),ledger=await reconcileDataset(env)
 const ledgerPreserved=JSON.stringify(baseline.ledger)===JSON.stringify(ledger)
 privateWrite(report,{version:1,capturedAt:after.asOf,comparison,ledger,ledgerPreserved});if(!comparison.preserved||!ledgerPreserved)throw new Error('DATASET_CHANGED')
 console.info(`PASS: ${comparison.tables} original tables / ${comparison.rows} rows preserved; no database changes`)
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{const code=error instanceof Error&&/^DATASET_[A-Z_]+$/.test(error.message)?error.message:'DATASET_FAILED';console.error(code);process.exitCode=1})
