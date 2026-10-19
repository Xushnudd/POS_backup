import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSalesListQuery} from '@/lib/sales-list-query';

test('Sales URL contract rejects unbounded/ambiguous pagination and unknown filters',()=>{
  for(const query of ['page=0','page=-1','page=1x','page=1.5','page=1e2','page=','limit=201','limit=0','page=9007199254740993','page=2147483648&limit=2','sort=costPrice','status=anything','search='+ 'a'.repeat(201)]){
    assert.throws(()=>parseSalesListQuery(new URLSearchParams(query)),/INVALID_/);
  }
  assert.deepEqual(parseSalesListQuery(new URLSearchParams()),{page:1,limit:20,skip:0,status:'',sort:'newest',search:''});
  assert.deepEqual(parseSalesListQuery(new URLSearchParams('page=3&limit=50&status=returned&sort=amount_asc&search=%20Receipt%20')),
    {page:3,limit:50,skip:100,status:'returned',sort:'amount_asc',search:'Receipt'});
});
