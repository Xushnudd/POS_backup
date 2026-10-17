import test from 'node:test'
import assert from 'node:assert/strict'
import {deploymentRelease} from '@/server/deployment/state'
import {ApiError} from '@/lib/api'
import {errorMessage} from '@/i18n/errors'
import {localizeOwnedMessage} from '@/i18n/messages'
test('An absent Next deployment ID, including the actual DefinePlugin false value, always yields a string release',()=>{
 for(const value of [undefined,null,false,true,'','bad release','x'.repeat(101),'<script>'])assert.equal(deploymentRelease(value),'unversioned')
 for(const value of ['release-20261017','a456a518','v1.2_3'])assert.equal(deploymentRelease(value),value)
})
test('Known reconciliation and cost denials have actionable translated guidance without raw server diagnostics',()=>{
 for(const code of ['RECOUNT_REQUIRED','ROLE_REVISION_CHANGED','INVALID_PIN','DISCREPANCY_REMAINS','RESULT_UNKNOWN','COST_CHANGE_FORBIDDEN']){
  const error=new ApiError('private SQL diagnostic');error.code=code;error.requestId='review-request'
  const message=errorMessage(error),ru=localizeOwnedMessage(message,'ru')
  assert.ok(!message.includes('private SQL'));assert.ok(!message.startsWith('Amalni bajarib bo‘lmadi.'))
  assert.ok(message.includes('review-request'));assert.notEqual(ru,message);assert.ok(!ru.includes('So‘rov:'))
 }
 const unknown=new ApiError('unreviewed private error');unknown.code='UNKNOWN_REVIEW_TEST'
 assert.ok(!errorMessage(unknown).includes('unreviewed private'))
})
