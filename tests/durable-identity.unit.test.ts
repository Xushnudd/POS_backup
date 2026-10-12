import {test} from 'node:test'
import assert from 'node:assert/strict'
import {durableIdentity} from '../src/lib/durable-identity'
test('shared job and onboarding endpoints distinguish commands without matching edited reason or hash',()=>{
 assert.equal(durableIdentity('/jobs',{type:'report_export',reason:'old'}),'type:report_export')
 assert.equal(durableIdentity('/jobs',{type:'report_export',reason:'new'}),'type:report_export')
 assert.notEqual(durableIdentity('/jobs',{type:'report_export'}),durableIdentity('/jobs',{type:'catalog_export'}))
 assert.equal(durableIdentity('/onboarding',{step:'register',confirmationHash:'changed'}),'step:register')
 assert.notEqual(durableIdentity('/onboarding',{step:'register'}),durableIdentity('/onboarding',{step:'catalog'}))
})
test('legacy single-command endpoints and malformed local values cannot invent a discriminator',()=>{
 for(const value of [null,undefined,[],{},'x',{type:1},{step:{}}])assert.equal(durableIdentity('/jobs',value),'')
 assert.equal(durableIdentity('/finance/expenses',{type:'report_export'}),'')
 assert.equal(durableIdentity('/onboarding/other',{step:'catalog'}),'')
})

test('brand status acknowledgement cannot occupy a name editor at the same PUT resource',()=>{
 const path='/brands/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
 assert.equal(durableIdentity(path,{name:'old'}),durableIdentity(path,{name:'new'}))
 assert.notEqual(durableIdentity(path,{name:'draft'}),durableIdentity(path,{isActive:false}))
 assert.equal(durableIdentity(path,{isActive:false}),durableIdentity(path,{isActive:true}))
 assert.equal(durableIdentity('/brands',{name:'new'}),'')
})

test('billing shared endpoints distinguish actual target entities without separating edited bank references or reasons',()=>{
 assert.equal(durableIdentity('/billing/payments',{billingInvoiceId:'invoice-one',proofReference:'old'}),durableIdentity('/billing/payments',{billingInvoiceId:'invoice-one',proofReference:'new'}))
 assert.notEqual(durableIdentity('/billing/payments',{billingInvoiceId:'invoice-one'}),durableIdentity('/billing/payments',{billingInvoiceId:'invoice-two'}))
 assert.notEqual(durableIdentity('/billing/plans',{code:'start'}),durableIdentity('/billing/plans',{code:'business'}))
 assert.notEqual(durableIdentity('/billing/assign',{targetOrganizationId:'one'}),durableIdentity('/billing/assign',{targetOrganizationId:'two'}))
 for(const path of ['/billing/payments','/billing/plans','/billing/assign'])assert.equal(durableIdentity(path,{}),'')
})
