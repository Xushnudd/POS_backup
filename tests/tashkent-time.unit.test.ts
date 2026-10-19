import test from 'node:test';
import assert from 'node:assert/strict';
import {tashkentLocalToISO} from '@/lib/tashkent-time';
test('Tashkent campaign dates retain the business day and midnight independently of browser timezone',()=>{
 assert.equal(tashkentLocalToISO('2026-10-14T00:00'),'2026-10-13T19:00:00.000Z');assert.equal(tashkentLocalToISO('2026-10-14T23:59'),'2026-10-14T18:59:00.000Z');
 assert.equal(tashkentLocalToISO('2028-02-29T09:15'),'2028-02-29T04:15:00.000Z');
 for(const invalid of ['2026-02-29T09:00','2026-13-01T00:00','2026-10-14T24:00','2026-10-14T10:60','bad','2026-10-14T10:00+05:00'])assert.throws(()=>tashkentLocalToISO(invalid),/INVALID_BUSINESS_TIME/);
});
