import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {REQUIRED_EXTENDED_MIGRATIONS} from '@/server/deployment/required-migrations';
test('Readiness covers every extended core migration, including native gift funding, without duplicate contracts',()=>{
 const expected=readdirSync('prisma/migrations',{withFileTypes:true}).filter(row=>row.isDirectory()&&/^202610\d{6}_/.test(row.name)&&Number(row.name.split('_')[0].slice(-4))>=133).map(row=>row.name).sort();
 assert.deepEqual([...REQUIRED_EXTENDED_MIGRATIONS].sort(),expected);assert.equal(new Set(REQUIRED_EXTENDED_MIGRATIONS).size,REQUIRED_EXTENDED_MIGRATIONS.length);
});
