import test from 'node:test'
import assert from 'node:assert/strict'
import {Prisma} from '@prisma/client'
import {assertExportCoverage} from '@/server/jobs/tenant-export'
import {DIRECT_MODELS,CHILD_RELATIONS,OMITTED_MODELS,SPECIAL_MODELS,OMITTED_FIELDS} from '@/server/jobs/tenant-export-contract'
test('Every Prisma model has one reviewed tenant export decision and secret fields are excluded',()=>{
 assertExportCoverage()
 const names=[...DIRECT_MODELS,...Object.keys(CHILD_RELATIONS),...Object.keys(OMITTED_MODELS),...SPECIAL_MODELS]
 assert.equal(new Set(names).size,names.length)
 assert.equal(names.length,Prisma.dmmf.datamodel.models.length)
 for(const model of Prisma.dmmf.datamodel.models){
  if(OMITTED_MODELS[model.name])continue
  for(const field of model.fields.filter(f=>/passwordHash|pinHash|tokenHash|sealedSecret|secretHash|leaseToken/.test(f.name)))assert.ok(OMITTED_FIELDS[model.name]?.includes(field.name),model.name+'.'+field.name)
 }
})
test('A new scalar field blocks exports until explicitly reviewed, even on an existing model',()=>{
 const model=Prisma.dmmf.datamodel.models[0] as unknown as {fields:Array<(typeof Prisma.dmmf.datamodel.models)[number]['fields'][number]>}
 model.fields.push({...model.fields[0],name:'unreviewedSecretToken'})
 try{assert.throws(assertExportCoverage,{code:'EXPORT_SCHEMA_UNREVIEWED'})}finally{model.fields.pop()}
 assertExportCoverage()
})
