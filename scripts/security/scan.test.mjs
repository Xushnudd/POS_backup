import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findings} from './scan.mjs';
test('Known token and private key findings expose type and line only',()=>{
 const secret='ghp_'+'a'.repeat(36),input='ordinary text\n'+secret+'\n-----BEGIN '+ 'PRIVATE KEY-----';const result=findings(input);assert.deepEqual(result,[{kind:'private_key',line:3},{kind:'github_token',line:2}]);assert.ok(!JSON.stringify(result).includes(secret));
});
test('Repeated scans reset regex state and ordinary placeholders remain clean',()=>{const input='AKIA'+'A'.repeat(16);assert.deepEqual(findings(input),findings(input));assert.deepEqual(findings('process.env.API_KEY; example-only-password; ghp_fixture'),[])});
