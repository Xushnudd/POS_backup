import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
test('Public claims map to accepted original capabilities and contain no obsolete invented pricing/popularity claims', () => {
 const evidence=JSON.parse(readFileSync('tasks/evidence/marketing-capabilities-20261010.json','utf8')) as {features:Record<string,string[]>}
 const plan=readFileSync('tasks/PLAN1.md','utf8')
 for(const ids of Object.values(evidence.features))for(const id of ids)assert.ok(plan.includes('- [x] **'+id+'**'),'Unaccepted marketing capability '+id)
 const source=readFileSync('src/app/page.tsx','utf8')+'\n'+readFileSync('src/components/landing/LandingContent.tsx','utf8')
 assert.doesNotMatch(source,/100\+|Cheksiz kassalar|Shaxsiy menejer|Eng ommabop|25000|50000/)
 assert.match(source,/publicPricing/)
 assert.match(source,/fiskal bo‘lmagan/)
 assert.match(source,/hali ulanmagan/)
})
