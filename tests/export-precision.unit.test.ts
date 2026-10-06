import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Prisma } from '@prisma/client'
import { productValue,shortage } from '@/server/exports/csv'
import { paging,exportCap } from '@/server/catalog/queries'
test('Large stock valuations and shortages stay exact without changing global Decimal precision',()=>{
 const precision=Prisma.Decimal.precision,max=new Prisma.Decimal('99999999999999.999999')
 assert.equal(productValue(max,max),'9999999999999999999800000000.00')
 assert.equal(shortage(max.negated(),max),'199999999999999.999998')
 assert.equal(productValue(new Prisma.Decimal('-1.123456'),new Prisma.Decimal('0.123456')),'-0.14')
 assert.equal(shortage(new Prisma.Decimal(5),new Prisma.Decimal(3)),'0.000000')
 assert.equal(Prisma.Decimal.precision,precision)
})
test('Shared read pagination rejects unsafe offsets and exports refuse truncation past the cap',()=>{
 assert.deepEqual(paging(new URLSearchParams('page=2&limit=200')),{page:2,limit:200,skip:200})
 for(const query of ['page=0','limit=201','page=1.5','page=9007199254740991&limit=200'])assert.throws(()=>paging(new URLSearchParams(query)))
 assert.doesNotThrow(()=>exportCap(10000));assert.throws(()=>exportCap(10001))
})
