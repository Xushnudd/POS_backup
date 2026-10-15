import test from 'node:test';
import assert from 'node:assert/strict';
import {requestOriginAllowed} from '@/server/auth/request-origin';
import {validateProductionEnvironment} from '@/server/config';
test('Production/test Origin remains exact and production still refuses HTTP configuration',()=>{
 for(const mode of ['production','test']){
  assert.equal(requestOriginAllowed('https://pos.example.invalid','https://pos.example.invalid',mode),true);
  for(const origin of ['http://localhost:3000','http://localhost:3443','https://localhost:3443','https://pos.example.invalid/','null'])assert.equal(requestOriginAllowed(origin,'https://pos.example.invalid',mode),false);
 }
 assert.throws(()=>validateProductionEnvironment({NODE_ENV:'production',DATABASE_URL:'postgresql://fixture:fixture@db:5432/fixture',APP_ORIGIN:'http://localhost:3000'}),/HTTPS/);
});
test('Development permits only configured Origin and fixed local interfaces; cross-host/port/suffix variants stay denied',()=>{
 for(const origin of ['http://localhost:3000','http://localhost:3443','https://localhost:3443'])assert.equal(requestOriginAllowed(origin,'http://localhost:3000','development'),true);
 for(const origin of ['http://localhost:9999','http://localhost.attacker.invalid:3000','https://attacker.invalid','null','http://127.0.0.1:3000'])assert.equal(requestOriginAllowed(origin,'http://localhost:3000','development'),false);
 assert.equal(requestOriginAllowed(null,'http://localhost:3000','production'),true);
});
