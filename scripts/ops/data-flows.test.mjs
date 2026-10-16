import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs'
import {join,dirname} from 'node:path'
import {tmpdir} from 'node:os'
const require=createRequire(import.meta.url),{validate}=require('../release/check-data-flows.cjs')
test('Data-flow inventory rejects unapproved vendor activation and unreviewed boundary changes/new adapters',()=>{
 const registry=JSON.parse(readFileSync('ops/privacy/data-flows.json','utf8'))
 assert.equal(validate(registry).activeThirdPartyProviders,0)
 const activated=structuredClone(registry);activated.flows.find(row=>row.party==='third_party').status='active'
 assert.throws(()=>validate(activated),/EXTERNAL_PROVIDER_NOT_APPROVED/)
 const root=mkdtempSync(join(tmpdir(),'pos-flow-review-'))
 try{
  for(const file of Object.keys(registry.sourceHashes)){mkdirSync(dirname(join(root,file)),{recursive:true});writeFileSync(join(root,file),readFileSync(file))}
  assert.equal(validate(registry,root).activeThirdPartyProviders,0)
  writeFileSync(join(root,'src/server/integrations/unreviewed-adapter.ts'),'export const pendingAdapter=true;')
  assert.throws(()=>validate(registry,root),/SOURCE_REVIEW_REQUIRED/)
  rmSync(join(root,'src/server/integrations/unreviewed-adapter.ts'))
  writeFileSync(join(root,'src/proxy.ts'),"// accidental CSP expansion")
  assert.throws(()=>validate(registry,root),/SOURCE_REVIEW_REQUIRED/)
 }finally{rmSync(root,{recursive:true,force:true})}
})
