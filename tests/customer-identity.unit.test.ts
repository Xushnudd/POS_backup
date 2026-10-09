import {test} from 'node:test'
import assert from 'node:assert/strict'
import {normalizeCustomerPhone,customerPhoneSchema} from '@/server/customers/identity'
test('Customer phone identity normalizes local/explicit international punctuation and rejects unsafe or invalid text',()=>{for(const text of ['90 123-45-67','998901234567','+998 (90) 123.45.67'])assert.equal(customerPhoneSchema.parse(text),'998901234567');assert.equal(customerPhoneSchema.parse('+1 (202) 555-0123'),'12025550123');for(const text of ['123','abc998901234567','998<script>','++998901234567','1'.repeat(16)]){assert.equal(normalizeCustomerPhone(text),null);assert.equal(customerPhoneSchema.safeParse(text).success,false)}})
