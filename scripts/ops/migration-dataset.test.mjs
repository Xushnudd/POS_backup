import {test} from 'node:test'
import assert from 'node:assert/strict'
import {connectionEnvironment,validateProjection,projectionSql,compareDatasets} from './migration-dataset.mjs'
const table={name:'InventoryBalance',columns:[{name:'storeId',type:'text'},{name:'productId',type:'text'},{name:'quantity',type:'numeric'}],key:['storeId','productId'],rows:2,sha256:'a'.repeat(64)}
test('Exact numeric projection and deterministic composite key; malicious manifest identifiers rejected',()=>{
 assert.match(projectionSql(table),/trim_scale\("quantity"\)/);assert.match(projectionSql(table),/ORDER BY "storeId","productId"/)
 for(const name of ['bad";DELETE','a\nb','x\t'])assert.throws(()=>validateProjection([{...table,name}]))
 assert.throws(()=>validateProjection([{...table,key:['missing']}]))
 assert.throws(()=>validateProjection([table,table]))
})
test('Same row count with changed content fails; missing rows/tables fail; unchanged projection passes',()=>{
 const before={version:1,tables:[table]}
 assert.equal(compareDatasets(before,before).preserved,true)
 assert.equal(compareDatasets(before,{version:1,tables:[{...table,sha256:'b'.repeat(64)}]}).preserved,false)
 assert.equal(compareDatasets(before,{version:1,tables:[{...table,rows:1}]}).preserved,false)
 assert.throws(()=>compareDatasets({...before,version:2},before))
 assert.throws(()=>compareDatasets({version:1,tables:[{...table,sha256:'bad'}]},before))
})
test('libpq gets connection through environment; unexpected options/invalid URLs rejected',()=>{
 const env=connectionEnvironment('postgresql://operator:private-password@127.0.0.1:55439/pos_test?sslmode=require',{})
 assert.equal(env.PGPASSWORD,'private-password');assert.equal(env.PGSSLMODE,'require');assert.match(env.PGOPTIONS,/default_transaction_read_only=on/)
 for(const url of ['http://example.invalid/db','postgresql://localhost/db','postgresql://u:p@localhost/db?options=-c%20read_only=off'])assert.throws(()=>connectionEnvironment(url,{}))
})

test('Tables without a primary key use canonical complete-record sorting',()=>{
 const noKey={...table,key:[]};assert.equal(validateProjection([noKey])[0],noKey)
 assert.match(projectionSql(noKey),/ORDER BY jsonb_build_array.*COLLATE "C"/)
})

test('Platform/collation mismatch and missing identifier cannot silently pass',()=>{
 assert.throws(()=>validateProjection([{...table,name:undefined}]))
 const before={version:1,platform:{encoding:'UTF8',collation:'C'},tables:[table]}
 assert.throws(()=>compareDatasets(before,{...before,platform:{encoding:'UTF8',collation:'other'}}),/DATASET_PLATFORM_INCOMPATIBLE/)
})

test('CLI rejects unconfirmed quiescence and unsafe baseline files without exposing inputs',async()=>{
 const {spawnSync}=await import('node:child_process')
 const {mkdtempSync,writeFileSync,symlinkSync,rmSync,chmodSync}=await import('node:fs')
 const {tmpdir}=await import('node:os')
 const dir=mkdtempSync(tmpdir()+'/pos-dataset-test-'),script=new URL('./migration-dataset.mjs',import.meta.url).pathname
 const env={...process.env,DATABASE_URL:'postgresql://test:TEST_ONLY_PASSWORD@localhost/unavailable',MIGRATION_SOURCE_QUIESCED:'true'}
 const run=(file,extra={})=>spawnSync(process.execPath,[script,'verify',file,dir+'/report.json'],{env:{...env,...extra},encoding:'utf8'})
 try{
  const file=dir+'/input.json';writeFileSync(file,'PRIVATE_FILE_CONTENT',{mode:0o644})
  let result=run(file,{MIGRATION_SOURCE_QUIESCED:'false'});assert.notEqual(result.status,0);assert.match(result.stderr,/DATASET_QUIESCENCE_REQUIRED/)
  result=run(file);assert.notEqual(result.status,0);assert.match(result.stderr,/DATASET_PRIVATE_FILE_REQUIRED/)
  chmodSync(file,0o600);symlinkSync(file,dir+'/linked.json')
  for(const path of [file,dir+'/linked.json']){result=run(path);assert.notEqual(result.status,0);assert.ok(!result.stderr.includes('PRIVATE_FILE_CONTENT'));assert.ok(!result.stderr.includes('TEST_ONLY_PASSWORD'));assert.ok(!result.stderr.includes(dir))}
 }finally{rmSync(dir,{recursive:true,force:true})}
})
