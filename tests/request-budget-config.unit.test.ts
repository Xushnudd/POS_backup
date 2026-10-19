import {test} from 'node:test'
import assert from 'node:assert/strict'
import {requestBudgetSetting} from '@/server/auth/request-budget-config'
test('Request budgets have bounded defaults and invalid configuration fails closed',()=>{
 assert.equal(requestBudgetSetting('API_READS_PER_MINUTE',{}),600)
 assert.equal(requestBudgetSetting('API_WRITES_PER_MINUTE',{}),300)
 assert.equal(requestBudgetSetting('API_PUBLIC_WRITES_PER_MINUTE',{}),1200)
 assert.equal(requestBudgetSetting('API_BODY_TIMEOUT_MS',{}),10000)
 for(const value of ['NaN','-1','0','9','100001','Infinity','1e3'])assert.throws(()=>requestBudgetSetting('API_READS_PER_MINUTE',{API_READS_PER_MINUTE:value}),{code:'REQUEST_BUDGET_UNAVAILABLE'})
 assert.equal(requestBudgetSetting('API_BODY_TIMEOUT_MS',{API_BODY_TIMEOUT_MS:'50'}),50)
})
